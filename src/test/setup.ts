import mongoose from "mongoose";
import dotenv from "dotenv";

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
jest.mock("zarinpal-checkout", () => ({
  create: jest.fn().mockReturnValue({
    PaymentRequest: jest.fn().mockImplementation(({ Amount }) => {
      if (Amount <= 0) {
        return Promise.resolve({ status: -9, message: "Invalid amount" });
      }
      return Promise.resolve({
        status: 100,
        url: "https://sandbox.zarinpal.com/pg/StartPay/test-authority",
        authority: "test-authority",
      });
    }),
    PaymentVerification: jest.fn().mockImplementation(({ Authority }) => {
      if (Authority === "test-authority") {
        return Promise.resolve({
          status: 100,
          RefID: "test-ref-id",
        });
      }
      return Promise.resolve({
        status: -21,
        message: "Failed or cancelled",
      });
    }),
  }),
}));

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
