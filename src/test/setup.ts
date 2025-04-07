import mongoose from "mongoose";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

// Mock mongoose connect and connection methods
jest.mock("mongoose", () => {
  const originalModule = jest.requireActual("mongoose");
  return {
    ...originalModule,
    connect: jest.fn().mockResolvedValue(true),
    connection: {
      ...originalModule.connection,
      db: {
        collections: jest
          .fn()
          .mockResolvedValue([
            { deleteMany: jest.fn().mockResolvedValue(true) },
          ]),
      },
      close: jest.fn().mockResolvedValue(true),
    },
  };
});

// Load test environment variables
dotenv.config({ path: ".env.test" });

// Mock Zarinpal module
jest.mock("zarinpal-node-sdk", () => {
  return jest.fn().mockImplementation(() => ({
    payments: {
      create: jest.fn().mockReturnValue({
        data: {
          code: 100,
          message: "Payment initiated successfully",
          authority: uuidv4(),
          fee_type: "Merchant",
          fee: 0,
        },
        errors: null,
      }),
    },
    verifications: {
      verify: jest.fn().mockReturnValue({
        data: {
          code: 100,
          message: "Payment successful",
          ref_id: 123456789,
          card_pan: "6037***1234",
          card_hash: "A1B2C3D4E5F6G7H8",
          fee_type: "Merchant",
          fee: 0,
        },
        errors: null,
      }),
    },
  }));
});

// Setup function to run before all tests
beforeAll(async () => {
  // Connect to test database
  await mongoose.connect(
    process.env.TEST_DATABASE_URL || "mongodb://localhost:27017/test-db"
  );
});

// Cleanup function to run after all tests
afterAll(async () => {
  // Close database connection
  await mongoose.connection.close();
});

// Reset database before each test
beforeEach(async () => {
  if (!mongoose.connection.db) {
    throw new Error("Database connection not established");
  }

  const collections = await mongoose.connection.db.collections();

  for (const collection of collections) {
    await collection.deleteMany({});
  }
});
