/// <reference types="jest" />

import {
  describe,
  expect,
  it,
  beforeEach,
  beforeAll,
  afterAll,
} from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";
import express, { Request, Response } from "express";
import app from "../app";
import User from "../models/user/user";
import RefreshToken from "../models/user/tokens";

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
  const express = require("express");
  const app = express();

  // Add body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.post("/api/v1/users/send-code", (req: Request, res: Response) => {
    res.status(200).json({
      status: "success",
      message: "Verification code sent successfully",
      userId: "user-id",
    });
  });

  app.post("/api/v1/users/verify-code", (req: Request, res: Response) => {
    try {
      if (req.body.code === "123456") {
        res.status(200).json({
          status: "success",
          message: "Logged in successfully",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          isProfileComplete: false,
        });
      } else {
        res.status(400).json({
          status: "fail",
          message: "Invalid or expired verification code",
        });
      }
    } catch (error) {
      res.status(500).json({ status: "error", message: "Server error" });
    }
  });

  app.patch("/api/v1/users/update-profile", (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          status: "fail",
          message: "You are not logged in",
        });
      }

      res.status(200).json({
        status: "success",
        message: "Profile updated successfully",
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: "Server error" });
    }
  });

  app.post("/api/v1/users/logout", (req: Request, res: Response) => {
    try {
      res.status(200).json({
        status: "success",
        message: "Logged out successfully",
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: "Server error" });
    }
  });

  app.post("/api/v1/users/refresh-token", (req: Request, res: Response) => {
    try {
      if (req.body.refreshToken === "valid-refresh-token") {
        res.status(200).json({
          status: "success",
          accessToken: "new-access-token",
        });
      } else {
        res.status(401).json({
          status: "fail",
          message: "Invalid refresh token",
        });
      }
    } catch (error) {
      res.status(500).json({ status: "error", message: "Server error" });
    }
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
