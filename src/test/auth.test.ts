/// <reference types="jest" />

import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import express, { Request, Response } from "express";
import app from "../app";

// Mock User model methods
jest.mock("../models/user/user", () => {
  return {
    findById: jest.fn().mockImplementation((id) => ({
      phone: "09123456789",
      createPhoneVerificationToken: jest.fn().mockReturnValue("123456"),
      save: jest.fn().mockResolvedValue(true),
    })),
    findOne: jest.fn().mockImplementation((query) => {
      if (query.phone === "09123456788") {
        return {
          _id: "existing-user-id",
          phone: "09123456788",
          createPhoneVerificationToken: jest.fn().mockReturnValue("123456"),
          save: jest.fn().mockResolvedValue(true),
        };
      }
      return null;
    }),
    create: jest.fn().mockImplementation((data) => {
      return [
        {
          _id: "new-user-id",
          phone: data[0]?.phone || "09123456789",
          createPhoneVerificationToken: jest.fn().mockReturnValue("123456"),
          save: jest.fn().mockResolvedValue(true),
        },
      ];
    }),
    deleteMany: jest.fn().mockResolvedValue(true),
  };
});

// Mock RefreshToken model methods
jest.mock("../models/user/tokens", () => {
  return {
    create: jest.fn().mockResolvedValue(true),
    findOne: jest.fn().mockImplementation((query) => {
      if (query.refreshToken === "valid-refresh-token") {
        return {
          refreshToken: "valid-refresh-token",
          user: "user-id",
        };
      }
      return null;
    }),
    findOneAndDelete: jest.fn().mockResolvedValue(true),
    deleteMany: jest.fn().mockResolvedValue(true),
  };
});

// Mock app routes
jest.mock("../app", () => {
  const app = express();

  app.post = jest.fn().mockImplementation((path, handler) => {
    if (path === "/api/v1/users/send-code") {
      return app;
    }
    if (path === "/api/v1/users/verify-code") {
      return app;
    }
    if (path === "/api/v1/users/logout") {
      return app;
    }
    if (path === "/api/v1/users/refresh-token") {
      return app;
    }
    return app;
  });

  app.patch = jest.fn().mockImplementation((path, handler) => {
    if (path === "/api/v1/users/update-profile") {
      return app;
    }
    return app;
  });

  return app;
});

describe("Authentication", () => {
  describe("POST /api/v1/users/send-code", () => {
    it("should send verification code to a new phone number", async () => {
      const response = await request(app).post("/api/v1/users/send-code").send({
        phone: "09123456789",
      });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.message).toContain(
        "Verification code sent successfully"
      );
      expect(response.body.userId).toBeDefined();
    });

    it("should send verification code to an existing phone number", async () => {
      const response = await request(app).post("/api/v1/users/send-code").send({
        phone: "09123456788",
      });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.message).toContain(
        "Verification code sent successfully"
      );
      expect(response.body.userId).toBeDefined();
    });
  });

  describe("POST /api/v1/users/verify-code", () => {
    it("should verify code and log in a new user", async () => {
      const response = await request(app)
        .post("/api/v1/users/verify-code")
        .send({
          userId: "user-id",
          code: "123456",
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.message).toContain("Logged in successfully");
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.isProfileComplete).toBe(false);
    });

    it("should reject invalid verification code", async () => {
      const response = await request(app)
        .post("/api/v1/users/verify-code")
        .send({
          userId: "user-id",
          code: "invalid-code",
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("fail");
      expect(response.body.message).toContain(
        "Invalid or expired verification code"
      );
    });
  });

  describe("PATCH /api/v1/users/update-profile", () => {
    it("should update user profile after login", async () => {
      const response = await request(app)
        .patch("/api/v1/users/update-profile")
        .set("Authorization", "Bearer access-token")
        .send({
          firstName: "John",
          lastName: "Doe",
          username: "johndoe",
          email: "john@example.com",
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.message).toContain("Profile updated successfully");
    });

    it("should reject profile update without authentication", async () => {
      const response = await request(app)
        .patch("/api/v1/users/update-profile")
        .send({
          firstName: "John",
          lastName: "Doe",
          username: "johndoe",
          email: "john@example.com",
        });

      expect(response.status).toBe(401);
      expect(response.body.status).toBe("fail");
    });
  });

  describe("POST /api/v1/users/logout", () => {
    it("should log out a user", async () => {
      const response = await request(app)
        .post("/api/v1/users/logout")
        .set("Authorization", "Bearer access-token")
        .send({
          refreshToken: "refresh-token",
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.message).toContain("Logged out successfully");
    });
  });

  describe("POST /api/v1/users/refresh-token", () => {
    it("should refresh access token", async () => {
      const response = await request(app)
        .post("/api/v1/users/refresh-token")
        .send({
          refreshToken: "valid-refresh-token",
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.accessToken).toBeDefined();
    });

    it("should reject invalid refresh token", async () => {
      const response = await request(app)
        .post("/api/v1/users/refresh-token")
        .send({
          refreshToken: "invalid-token",
        });

      expect(response.status).toBe(401);
      expect(response.body.status).toBe("fail");
    });
  });
});
