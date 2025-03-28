import { Request, Response, NextFunction } from "express";
import ZarinpalCheckout from "zarinpal-checkout";
import Order, { IOrder } from "../models/order";
import BaseController from "./helpers/base";
import Cart, { ICart } from "../models/cart";
import AppError from "../utils/error";
import mongoose, { ClientSession } from "mongoose";
import SMS from "../utils/sms";
import User, { IUser } from "../models/user/user";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { createLogger, format, transports } from "winston";
import { setTimeout } from "timers/promises";

// Load environment variables
dotenv.config();

// Configure logger
const logger = createLogger({
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new transports.File({ filename: "logs/payment-error.log", level: "error" }),
    new transports.File({ filename: "logs/payment.log" }),
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
  ],
});

interface ZarinpalPaymentRequest {
  Amount: number;
  CallbackURL: string;
  Description: string;
  Email: string;
  Mobile: string;
  metadata: {
    userId: string;
    shippingAddress: string;
    paymentMethod: string;
    products: string;
    totalAmount: string;
  };
}

type PaymentResponse = {
  status: number;
  message?: string;
  url?: string;
  authority?: string;
  RefId?: string;
  metadata?: Record<string, any>;
};

type ZarinpalInstance = {
  PaymentRequest: (data: ZarinpalPaymentRequest) => Promise<PaymentResponse>;
  PaymentVerification: (data: {
    Amount: number;
    Authority: string;
  }) => Promise<PaymentResponse>;
};

class OrderController extends BaseController<IOrder> {
  private zarinpal: ZarinpalInstance;
  private readonly CURRENCY = "IRR";
  private readonly PAYMENT_METHODS = {
    ONLINE: "online",
    CASH_ON_DELIVERY: "cash_on_delivery",
  } as const;
  private readonly MIN_AMOUNT = 10000; // Minimum amount in Rial
  private readonly MAX_AMOUNT = 900000000; // Maximum amount in Rial
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 5000; // 5 seconds

  // Rate limiter for payment endpoints
  public readonly paymentRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: "Too many payment attempts, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  });

  constructor() {
    super(Order);
    this.zarinpal = this.initializePaymentGateway();
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0) {
        logger.warn(`Operation failed, retrying... (${retries} attempts left)`);
        await setTimeout(this.RETRY_DELAY);
        return this.retryOperation(operation, retries - 1);
      }
      throw error;
    }
  }

  private initializePaymentGateway(): ZarinpalInstance {
    try {
      const merchantId = process.env.ZARINPAL_MERCHANT_ID;
      const isSandbox = process.env.NODE_ENV !== "production";

      if (!merchantId) {
        throw new Error("ZARINPAL_MERCHANT_ID is not defined");
      }

      const gateway = ZarinpalCheckout.create(
        merchantId,
        isSandbox
      ) as ZarinpalInstance;
      logger.info("Payment gateway initialized successfully");
      return gateway;
    } catch (error) {
      logger.error("Failed to initialize payment gateway:", error);
      throw new AppError("Payment gateway initialization failed", 500);
    }
  }

  private validatePaymentAmount(amount: number): void {
    if (amount < this.MIN_AMOUNT) {
      throw new AppError(
        `Payment amount must be at least ${this.MIN_AMOUNT / 10} IRR`,
        400
      );
    }
    if (amount > this.MAX_AMOUNT) {
      throw new AppError(
        `Payment amount cannot exceed ${this.MAX_AMOUNT} IRR`,
        400
      );
    }
  }

  private async checkStockAvailability(userId: string): Promise<ICart[]> {
    const cartList = await Cart.find({ user: userId }).populate("product");

    if (!cartList || cartList.length === 0) {
      throw new AppError("There is no cart list for this user", 404);
    }

    const isStockAvailable = cartList.every(
      (item) => item.quantity <= item.product.stockQuantity
    );

    if (!isStockAvailable) {
      throw new AppError("There is not enough stock for these products", 400);
    }

    return cartList;
  }

  private async createOrderDocument(
    order: Partial<IOrder>,
    session: ClientSession
  ): Promise<IOrder[]> {
    return await Order.create([order], { session });
  }

  createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { shippingAddress, paymentMethod } = req.body;

      if (!shippingAddress) {
        throw new AppError("shippingAddress is required", 400);
      }

      // Remove status and paymentStatus from req.body if they are present
      delete req.body.status;
      delete req.body.paymentStatus;

      const cartList = await this.checkStockAvailability(req.user.id);
      const totalAmount = await Cart.calcTotalPrice(req.user.id);

      const products = cartList.map((item) => ({
        product: item.product._id.toString(),
        quantity: item.quantity,
      }));

      if (paymentMethod === this.PAYMENT_METHODS.ONLINE) {
        await this.handleOnlinePayment(
          req,
          res,
          session,
          totalAmount,
          shippingAddress,
          products
        );
      } else {
        await this.handleCashOnDelivery(
          req,
          res,
          session,
          totalAmount,
          shippingAddress,
          products
        );
      }
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  };

  private async handleOnlinePayment(
    req: Request,
    res: Response,
    session: ClientSession,
    totalAmount: number,
    shippingAddress: string,
    products: any[]
  ): Promise<void> {
    try {
      this.validatePaymentAmount(totalAmount);

      const callbackUrl = `${req.protocol}://${req.get(
        "host"
      )}/api/v1/orders/verify-payment?Amount=${totalAmount}`;

      const response: PaymentResponse = await this.retryOperation(() =>
        this.zarinpal.PaymentRequest({
          Amount: parseInt(totalAmount.toString()),
          CallbackURL: callbackUrl,
          Description: "Payment for order",
          Email: req.user.email,
          Mobile: req.user.phone,
          metadata: {
            userId: req.user.id,
            shippingAddress,
            paymentMethod: this.PAYMENT_METHODS.ONLINE,
            products: JSON.stringify(products),
            totalAmount: totalAmount.toString(),
          },
        })
      );

      if (response.status === 100) {
        logger.info(`Payment initiated for user ${req.user.id}`);
        const newOrder: Partial<IOrder> = {
          user: req.user.id,
          totalAmount,
          orderItems: products as IOrder["orderItems"],
          shippingAddress,
          paymentMethod: this.PAYMENT_METHODS.ONLINE,
          transactionId: response.authority,
          currency: this.CURRENCY,
          status: "not-paid",
        };

        await this.createOrderDocument(newOrder, session);
        await Cart.deleteMany({ user: req.user.id }).session(session);

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
          status: "success",
          url: response.url,
          authority: response.authority,
          amount: totalAmount,
        });
      } else {
        logger.error(
          `Payment initiation failed for user ${req.user.id}: ${response.message}`
        );
        throw new AppError(
          `Payment initiation failed: ${response.message || "Unknown error"}`,
          400
        );
      }
    } catch (error) {
      logger.error("Online payment error:", error);
      throw error;
    }
  }

  private async handleCashOnDelivery(
    req: Request,
    res: Response,
    session: ClientSession,
    totalAmount: number,
    shippingAddress: string,
    products: any[]
  ): Promise<void> {
    const newOrder: Partial<IOrder> = {
      user: req.user.id,
      totalAmount,
      orderItems: products as IOrder["orderItems"],
      shippingAddress,
      paymentMethod: this.PAYMENT_METHODS.CASH_ON_DELIVERY,
      currency: this.CURRENCY,
      status: "pay-on-delivery",
    };

    const order = await this.createOrderDocument(newOrder, session);
    await Cart.deleteMany({ user: req.user.id }).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      status: "success",
      data: order,
    });
  }

  verifyPayment = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { Authority, Status, Amount } = req.query;

      if (!Authority) {
        throw new AppError("Payment authority is required", 400);
      }

      if (Status === "OK") {
        if (!Amount) {
          throw new AppError(
            "Amount is required for payment verification",
            400
          );
        }

        const response: PaymentResponse = await this.retryOperation(() =>
          this.zarinpal.PaymentVerification({
            Amount: parseInt(Amount as string),
            Authority: Authority as string,
          })
        );

        if (response.status === 100 || response.status === 101) {
          const order = await Order.findOne({
            transactionId: Authority,
          }).session(session);

          if (!order) {
            throw new AppError("Order not found", 404);
          }

          order.paymentStatus = true;
          order.status = "Pending";
          await order.save({ session });

          await session.commitTransaction();
          session.endSession();

          logger.info(`Payment verified successfully for user ${req.user.id}`);
          res.json({ message: "/payment-success" });
        } else {
          logger.error(`Payment verification failed: ${response.message}`);
          throw new AppError(
            `Payment verification failed: ${
              response.message || "Unknown error"
            }`,
            400
          );
        }
      } else {
        logger.warn(`Payment cancelled by user`);
        throw new AppError("Payment was cancelled", 400);
      }
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error("Payment verification error:", error);
      next(error);
    }
  };

  private async createOrderFromPayment(
    metadata: any,
    response: PaymentResponse,
    session: ClientSession
  ): Promise<void> {
    await Order.create(
      [
        {
          user: metadata.userId,
          totalAmount: parseFloat(metadata?.totalAmount || "0"),
          orderItems: metadata?.products || [],
          shippingAddress: metadata?.shippingAddress || "",
          paymentMethod: metadata?.paymentMethod || "",
          currency: this.CURRENCY,
          paymentStatus: response.status === 100 || response.status === 101,
          transactionId: response.RefId,
        },
      ],
      { session }
    );

    await Cart.deleteMany({ user: metadata.userId }).session(session);
  }

  getUserOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query.user = req.user.id;
      return await this.getAll()(req, res, next);
    } catch (error) {
      next(error);
    }
  };

  getOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        throw new AppError("id is required", 400);
      }

      const order = await Order.findById(id).populate("orderItems.product");

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      if (order?.user.toString() !== req.user.id) {
        throw new AppError("You don't have order with this id", 401);
      }

      res.status(200).json({
        status: "success",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  updateOrderStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;

      if (!req.body.status) {
        throw new AppError("status required", 400);
      }

      const order = await Order.findById(id)
        .populate({
          path: "orderItems.product",
          select: "name price currency",
        })
        .session(session);

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      if (order.status === "Cancelled") {
        throw new AppError("Order is cancelled you can not change it", 400);
      }

      if (order.status === req.body.status) {
        throw new AppError(
          `The order status is already ${req.body.status}`,
          400
        );
      }

      await this.updateOrderStatusAndNotify(
        order,
        req.body.status,
        req,
        session
      );

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        status: "success",
        message: "Order has been updated successfully",
        data: order,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  };

  private async updateOrderStatusAndNotify(
    order: IOrder,
    newStatus: string,
    req: Request,
    session: ClientSession
  ): Promise<void> {
    if (
      newStatus === "Delivered" &&
      order.paymentMethod === this.PAYMENT_METHODS.CASH_ON_DELIVERY
    ) {
      order.paymentStatus = true;
    }

    if (newStatus === "Shipped") {
      order.shippedAt = new Date(Date.now());
    }

    order.status = newStatus;
    await order.save({ session });

    const user = await User.findById(order.user).session(session);
    const url = `${req.protocol}://${req.get("host")}/api/v1/orders/${
      order.id
    }`;
    await new SMS(user as IUser, url).sendShipped(order);
  }

  cancelOrder = async (req: Request, res: Response, next: NextFunction) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;
      const order = await Order.findById(id).session(session);

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      if (order.user.toString() !== req.user.id) {
        throw new AppError("You don't have order with this id", 401);
      }

      if (order.status === "Cancelled") {
        throw new AppError("Order is already cancelled", 400);
      }

      if (order.status !== "Pending") {
        throw new AppError("Only pending orders can be cancelled", 400);
      }

      order.status = "Cancelled";
      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        status: "success",
        message: "Order has been canceled",
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  };

  // Webhook handler for payment status updates
  handlePaymentWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { orderId, status, transactionId } = req.body;

      if (!orderId || !status || !transactionId) {
        throw new AppError("Invalid webhook payload", 400);
      }

      const order = await Order.findById(orderId);
      if (!order) {
        throw new AppError("Order not found", 404);
      }

      // Update order status based on webhook
      order.paymentStatus = status === "success";
      order.transactionId = transactionId;
      await order.save();

      logger.info(`Payment webhook processed for order ${orderId}: ${status}`);

      // Send notification to user
      const user = await User.findById(order.user);
      if (user) {
        await new SMS(user, "").sendShipped(order);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      logger.error("Webhook processing error:", error);
      next(error);
    }
  };
}

export default OrderController;
