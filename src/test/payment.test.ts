import { Request, Response } from "express";
import { mockPaymentData, mockZarinpalResponses } from "./mock/payment";
import Payment from "../controllers/payment";
import AppError from "../utils/error";

// Set test environment
process.env.NODE_ENV = "test";

// Mock Zarinpal service
jest.mock("zarinpal-checkout", () => {
  return {
    create: jest.fn().mockReturnValue({
      PaymentRequest: jest.fn().mockImplementation(({ amount }) => {
        if (amount <= 0) {
          return Promise.resolve(mockZarinpalResponses.request.failed);
        }
        return Promise.resolve(mockZarinpalResponses.request.successful);
      }),
      PaymentVerification: jest.fn().mockImplementation(({ authority }) => {
        if (authority === mockPaymentData.verification.successful.authority) {
          return Promise.resolve(mockZarinpalResponses.verify.successful);
        }
        return Promise.resolve(mockZarinpalResponses.verify.failed);
      }),
    }),
  };
});

// Set environment variables for testing
process.env.ZARINPAL_MERCHANT_ID = "test-merchant-id";
process.env.ZARINPAL_IS_SANDBOX = "true";
process.env.ZARINPAL_CALLBACK_URL =
  "http://localhost:3000/api/v1/payments/verify";

// Extend Request type to include session
declare module "express-serve-static-core" {
  interface Request {
    session: {
      paymentAmount?: number;
    };
  }
}

describe("Payment Controller", () => {
  let payment: Payment;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    payment = new Payment();
    mockNext = jest.fn();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe("createPayment", () => {
    it("should create a successful payment request", async () => {
      mockReq = {
        body: {
          amount: mockPaymentData.successful.amount,
          description: mockPaymentData.successful.description,
        },
        session: {},
      };

      // Override the implementation for this specific test
      const mockZarinpal = {
        PaymentRequest: jest
          .fn()
          .mockResolvedValue(mockZarinpalResponses.request.successful),
      };

      // Replace the zarinpal property with our mock
      (payment as any).zarinpal = mockZarinpal;

      await payment.createPayment(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: {
          authority: mockPaymentData.successful.authority,
          url: `https://www.zarinpal.com/pg/StartPay/${mockPaymentData.successful.authority}`,
        },
      });
      expect(mockReq.session?.paymentAmount).toBe(
        mockPaymentData.successful.amount
      );
    });

    it("should handle invalid amount error", async () => {
      mockReq = {
        body: {
          amount: -1,
          description: "Invalid payment",
        },
        session: {},
      };

      await payment.createPayment(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    });
  });

  describe("verifyPayment", () => {
    it("should verify successful payment", async () => {
      mockReq = {
        query: {
          Authority: mockPaymentData.verification.successful.authority,
          Status: "OK",
        },
        session: {
          paymentAmount: mockPaymentData.successful.amount,
        },
      };

      // Override the implementation for this specific test
      const mockZarinpal = {
        PaymentVerification: jest
          .fn()
          .mockResolvedValue(mockZarinpalResponses.verify.successful),
      };

      // Replace the zarinpal property with our mock
      (payment as any).zarinpal = mockZarinpal;

      await payment.verifyPayment(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: {
          refId: mockPaymentData.verification.successful.refId,
        },
      });
      expect(mockReq.session?.paymentAmount).toBeUndefined();
    });

    it("should handle failed payment verification", async () => {
      mockReq = {
        query: {
          Authority: mockPaymentData.verification.failed.authority,
          Status: "NOK",
        },
        session: {
          paymentAmount: mockPaymentData.failed.amount,
        },
      };

      await payment.verifyPayment(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    });
  });
});
