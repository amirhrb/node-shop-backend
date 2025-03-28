import mongoose, { Schema, Model, Document } from "mongoose";

export interface IProduct extends Document {
  name: string;
  price: number;
  description: string;
  images: string[];
  ogImage: string;
  category: string;
  currency: "IRR" | "USD";
  stockQuantity: number;
  ratingsAverage: number;
  numOfReviews: number;
  cloudinaryPublicId: string;
  isAvailable: boolean;
  discount?: {
    percentage: number;
    validUntil: Date;
  };
  specifications: Record<string, any>;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  tags: string[];
  likes: mongoose.Schema.Types.ObjectId[];
}

const productSchema: Schema<IProduct> = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxLength: [100, "Product name cannot be longer than 100 characters"],
      minLength: [3, "Product name must be at least 3 characters"],
      required: [true, "Product name is required"],
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      minLength: [10, "Description must be at least 10 characters"],
    },
    // IRR
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },
    currency: {
      type: String,
      enum: {
        values: ["IRR", "USD"],
        message: "Currency must be either IRR or USD",
      },
      default: "IRR",
    },
    stockQuantity: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: [0, "Stock quantity cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Stock quantity must be a whole number",
      },
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    images: [String],
    ogImage: String,
    ratingsAverage: {
      type: Number,
      default: 0,
      min: [0, "Rating cannot be below 0"],
      max: [5, "Rating cannot be above 5"],
      set: (val: number) => Math.round(val * 10) / 10, // Round to 1 decimal place
    },
    numOfReviews: {
      type: Number,
      default: 0,
      min: [0, "Number of reviews cannot be negative"],
    },
    cloudinaryPublicId: {
      type: String,
      select: false,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    discount: {
      percentage: {
        type: Number,
        min: [0, "Discount percentage cannot be negative"],
        max: [100, "Discount percentage cannot exceed 100"],
      },
      validUntil: Date,
    },
    specifications: {
      type: Map,
      of: Schema.Types.Mixed,
    },
    weight: {
      type: Number,
      min: [0, "Weight cannot be negative"],
    },
    dimensions: {
      length: {
        type: Number,
        min: [0, "Length cannot be negative"],
      },
      width: {
        type: Number,
        min: [0, "Width cannot be negative"],
      },
      height: {
        type: Number,
        min: [0, "Height cannot be negative"],
      },
    },
    tags: [String],
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Like",
    }]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field for discounted price
productSchema.virtual("discountedPrice").get(function (this: IProduct) {
  if (
    !this.discount ||
    !this.discount.validUntil ||
    this.discount.validUntil < new Date()
  ) {
    return this.price;
  }
  return this.price * (1 - this.discount.percentage / 100);
});

// Virtual field for stock status
productSchema.virtual("stockStatus").get(function (this: IProduct) {
  if (!this.isAvailable) return "Unavailable";
  if (this.stockQuantity === 0) return "Out of Stock";
  if (this.stockQuantity < 5) return "Low Stock";
  return "In Stock";
});

// Virtual field for like count
productSchema.virtual('likeCount').get(function(this: IProduct) {
  return this.likes.length;
});

// Method to check if a user has liked the product
productSchema.methods.isLikedBy = function(userId: mongoose.Types.ObjectId): boolean {
  return this.likes.some((likeId: mongoose.Types.ObjectId) => likeId.equals(userId));
};

// Method to add a like
productSchema.methods.addLike = function(likeId: mongoose.Types.ObjectId): void {
  if (!this.likes.some((id: mongoose.Types.ObjectId) => id.equals(likeId))) {
    this.likes.push(likeId);
  }
};

// Method to remove a like
productSchema.methods.removeLike = function(likeId: mongoose.Types.ObjectId): void {
  this.likes = this.likes.filter((id: mongoose.Types.ObjectId) => !id.equals(likeId));
};

// Indexes
productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ "discount.validUntil": 1 }, { sparse: true });
productSchema.index({ tags: 1 });
// Text index for search
productSchema.index(
  {
    name: "text",
    description: "text",
    tags: "text",
  },
  {
    weights: {
      name: 10,
      tags: 5,
      description: 1,
    },
  }
);

// Pre-save middleware to ensure stockQuantity is an integer
productSchema.pre("save", function (next) {
  if (this.isModified("stockQuantity")) {
    this.stockQuantity = Math.floor(this.stockQuantity);
  }
  next();
});

// Pre-save middleware to update isAvailable based on stockQuantity
productSchema.pre("save", function (next) {
  if (this.stockQuantity === 0) {
    this.isAvailable = false;
  }
  next();
});

const Product: Model<IProduct> = mongoose.model<IProduct>(
  "Product",
  productSchema
);

export default Product;
