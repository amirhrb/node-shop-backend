import mongoose, { Document, Model } from "mongoose";
import Product from "./product/product";

export interface OrderItem {
  product: mongoose.Types.ObjectId;
  quantity: number;
}
export interface IOrder extends Document {
  user: string;
  orderItems: OrderItem[];
  shippingAddress: mongoose.Types.ObjectId;
  paymentMethod?: string;
  totalAmount: number;
  paymentStatus?: boolean;
  status?: string;
  currency?: string;
  shippedAt: Date;
  transactionId?: string;
}

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "UserId is required"],
    },
    orderItems: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: [true, "ProductId is required"],
        },
        quantity: {
          type: Number,
          required: [true, "Quantity is required"],
          min: [1, "Quantity must be grater the zero"],
        },
      },
    ],
    shippingAddress: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      required: [true, "Shipping Address is required"],
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ["online", "cash_on_delivery"],
        message: "Invalid Payment Method",
      },
      required: [true, "Payment Method is required"],
      default: "Online Payment",
    },
    totalAmount: {
      type: Number,
      required: [true, "Total Amount is required"],
    },
    status: {
      type: String,
      trim: true,
      enum: {
        values: [
          "not-paid",
          "pay-on-delivery",
          "Pending",
          "Shipped",
          "Delivered",
          "Cancelled",
        ],
        message: "Invalid Status",
      },
      required: [true, "Status is required"],
      default: "Pending",
    },
    currency: {
      type: String,
      enum: {
        values: ["IRR", "IRT"],
        message: "Invalid Currency",
      },
      default: "IRR",
      required: [true, "Currency is required"],
    },
    paymentStatus: {
      type: Boolean,
      default: false,
    },
    shippedAt: Date,
    transactionId: {
      type: String,
      sparse: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ user: 1, status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

// adjust stock when order status changes to 'Cancelled' or 'Pending'
orderSchema.pre("save", async function (next) {
  // we can not use this.isNew because mongoose set it false by default
  // because it treat it as incomplete transaction so it's not yet finished so it's not get saved to the DB
  // we can use this.isModified('status')
  if (this.isModified("status")) {
    const originalOrder = await Order.findById(this._id).lean();

    if (
      originalOrder &&
      originalOrder.status !== "Cancelled" &&
      this.status === "Cancelled"
    ) {
      // If the status changes from anything to 'canceled', increase the stock
      await adjustStock(originalOrder.orderItems, true);
    }
  } else if (this.status === "Pending") {
    // If the status changes from anything to 'pending', decrease the stock
    await adjustStock(this.orderItems, false);
  }
  next();
});

const adjustStock = async (
  orderItems: OrderItem[],
  increment: boolean
): Promise<void> => {
  const adjustment = increment ? 1 : -1;

  const updateStockPromises = orderItems.map(async (item) => {
    await Product.findByIdAndUpdate(
      item.product,
      { $inc: { stockQuantity: adjustment * item.quantity } },
      { new: true, useFindAndModify: false }
    );
  });

  await Promise.all(updateStockPromises);
};

const Order: Model<IOrder> = mongoose.model<IOrder>("Order", orderSchema);

export default Order;
