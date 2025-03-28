declare module "zarinpal-checkout" {
  interface PaymentRequestOptions {
    Amount: number;
    CallbackURL: string;
    Description: string;
    Email?: string;
    Mobile?: string;
    metadata?: Record<string, any>;
  }

  interface PaymentVerificationOptions {
    Amount: number;
    Authority: string;
  }

  interface PaymentResponse {
    status: number;
    url?: string;
    authority?: string;
    RefID?: string;
    metadata?: Record<string, any>;
  }

  interface ZarinpalInstance {
    PaymentRequest(options: PaymentRequestOptions): Promise<PaymentResponse>;
    PaymentVerification(
      options: PaymentVerificationOptions
    ): Promise<PaymentResponse>;
  }

  interface ZarinpalStatic {
    create(merchantId: string, sandbox?: boolean): ZarinpalInstance;
  }

  const Zarinpal: ZarinpalStatic;
  export default Zarinpal;
}
