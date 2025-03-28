import { Request, Response, NextFunction } from "express";
import ZarinpalCheckout from "zarinpal-checkout";
import AppError from "../utils/error";

class Payment {
  private zarinpal: any;

  constructor() {
    this.zarinpal = ZarinpalCheckout.create(
      process.env.ZARINPAL_MERCHANT_ID as string,
      process.env.ZARINPAL_IS_SANDBOX === "true"
    );
  }

  createPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, description } = req.body;

      if (!amount || amount <= 0) {
        return next(new AppError("Invalid amount", 400));
      }

      const result = await this.zarinpal.PaymentRequest({
        amount,
        description,
        callback_url: process.env.ZARINPAL_CALLBACK_URL,
      });

      if (result.code !== 100) {
        return next(new AppError(result.message, 400));
      }

      // Store payment amount in session for verification
      req.session.paymentAmount = amount;

      res.status(200).json({
        status: "success",
        data: {
          authority: result.authority,
          url: `https://www.zarinpal.com/pg/StartPay/${result.authority}`,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  verifyPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { Authority, Status } = req.query;
      const amount = req.session?.paymentAmount;

      if (Status !== "OK" || !amount) {
        return next(new AppError("Payment failed or invalid", 400));
      }

      const result = await this.zarinpal.PaymentVerification({
        amount,
        authority: Authority,
      });

      if (result.code !== 100) {
        return next(new AppError(result.message, 400));
      }

      // Clear payment amount from session
      delete req.session.paymentAmount;

      res.status(200).json({
        status: "success",
        data: {
          refId: result.refId,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

export default Payment;
