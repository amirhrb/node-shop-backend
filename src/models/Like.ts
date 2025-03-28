import mongoose, { Document, Model, Schema } from "mongoose";

export interface ILike extends Document {
  user: mongoose.Schema.Types.ObjectId;
  product?: mongoose.Schema.Types.ObjectId;
  review?: mongoose.Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LikeSchema: Schema<ILike> = new mongoose.Schema<ILike>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    },
    review: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review"
    }
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure a user can only like a product or review once
LikeSchema.index({ user: 1, product: 1 }, { unique: true, sparse: true });
LikeSchema.index({ user: 1, review: 1 }, { unique: true, sparse: true });

// Ensure either product or review is provided, but not both
LikeSchema.pre('save', function(next) {
  if ((!this.product && !this.review) || (this.product && this.review)) {
    next(new Error('Either product or review must be provided, but not both'));
  }
  next();
});

const Like: Model<ILike> = mongoose.model<ILike>("Like", LikeSchema);

export default Like;
