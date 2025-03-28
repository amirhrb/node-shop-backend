export const mockPaymentData = {
  successful: {
    authority: "A00000000000000000000000000000123456",
    amount: 1000000, // 1,000,000 Rials
    description: "Test payment for order #12345",
    callbackUrl: "http://localhost:3000/api/v1/payments/verify",
    mobile: "09123456789",
    email: "test@example.com",
  },
  failed: {
    authority: "A00000000000000000000000000000654321",
    amount: 500000,
    status: -1,
    error: "Payment failed",
  },
  pending: {
    authority: "A00000000000000000000000000000789012",
    amount: 750000,
    status: 100,
  },
  verification: {
    successful: {
      authority: "A00000000000000000000000000000123456",
      status: 100,
      refId: "12345678901234567890",
    },
    failed: {
      authority: "A00000000000000000000000000000654321",
      status: -21,
      error: "Payment verification failed",
    },
  },
};

export const mockZarinpalResponses = {
  request: {
    successful: {
      code: 100,
      authority: mockPaymentData.successful.authority,
      message: "Success",
    },
    failed: {
      code: -9,
      message: "Invalid amount",
    },
  },
  verify: {
    successful: {
      code: 100,
      refId: mockPaymentData.verification.successful.refId,
      message: "Transaction verified",
    },
    failed: {
      code: -21,
      message: "Transaction failed or canceled by user",
    },
  },
};
