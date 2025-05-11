import mongoose, { Document, Schema, Model } from "mongoose";

export interface ICart extends Document {
  user: mongoose.Types.ObjectId;
  product: {
    _id: mongoose.Types.ObjectId;
    name: string;
    stockQuantity: number;
  };
  quantity: number;
  price: number;
  populate: () => Promise<ICart>;
  validateStock: () => Promise<boolean>;
}

interface ICartModel extends Model<ICart> {
  calcTotalPrice(userId: string): Promise<number>;
}

const cartItemSchema: Schema<ICart> = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "UserId is required"],
    },
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
    price: {
      type: Number,
      required: [true, "Price is required"],
    },
  },
  {
    timestamps: true,
  }
);

cartItemSchema.index({ user: 1, product: 1 });

cartItemSchema.index({ user: 1 });

cartItemSchema.pre(/^find/, function (next) {
  this.populate({
    path: "product",
    select: "name price currency category stockQuantity ogImage isAvailable",
  });
  next();
});

cartItemSchema.statics.calcTotalPrice = async function (
  userId: string
): Promise<number> {
  const total = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $group: {
        _id: null,
        totalPrice: { $sum: { $multiply: ["$quantity", "$price"] } },
      },
    },
  ]);

  return total.length > 0 ? total[0].totalPrice : 0;
};

cartItemSchema.methods.validateStock = async function (): Promise<boolean> {
  await this.populate("product");
  return this.product.stockQuantity >= this.quantity;
};

cartItemSchema.pre("save", async function (next) {
  if (this.isModified("quantity")) {
    const isValid = await this.validateStock();
    if (!isValid) {
      return next(new Error("Requested quantity exceeds available stock"));
    }
  }
  next();
});

// Add index for better query performance
cartItemSchema.index({ updatedAt: -1 });

const CartItem: ICartModel = mongoose.model<ICart, ICartModel>(
  "Cart",
  cartItemSchema
);

export default CartItem;
