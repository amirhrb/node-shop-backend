import mongoose, { Model, Schema, Document, Query } from "mongoose";
import Product from "./product";

export interface IReview extends Document {
  rating: number;
  review: string;
  user: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  likes: mongoose.Types.ObjectId[];
  isPublished: boolean;
  isVerified: boolean;
  populate: () => Promise<IReview>;
  likeCount: number;
  isLikedBy: (userId: mongoose.Types.ObjectId) => boolean;
  addLike: (likeId: mongoose.Types.ObjectId) => void;
  removeLike: (likeId: mongoose.Types.ObjectId) => void;
}

export interface IReviewModel extends Model<IReview> {
  calcAverageRatings(productId: mongoose.Types.ObjectId): Promise<void>;
}

interface ReviewQuery extends Query<Record<string, unknown>, IReview> {
  r?: IReview;
}

const reviewsSchema: Schema<IReview> = new mongoose.Schema(
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
    rating: {
      type: Number,
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating must be at most 5"],
      required: [true, "Rating is required"],
    },
    review: {
      type: String,
      required: [true, "Review is required"],
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Like",
      },
    ],
  },
  {
    timestamps: true,
  }
);

reviewsSchema.index({ createdAt: -1 });

reviewsSchema.pre(/^find/, function (next): void {
  this.populate([
    {
      path: "user",
      select: "name email profile.photo",
    },
    {
      path: "product",
      select: "name price category owner ogImage",
    },
  ]);

  next();
});

reviewsSchema.statics.calcAverageRatings = async function (
  productId: mongoose.Types.ObjectId
): Promise<void> {
  const stats = await this.aggregate([
    {
      $match: { product: productId },
    },
    {
      $group: {
        _id: "$product",
        nRating: { $sum: 1 },
        avgRating: { $avg: "$rating" },
      },
    },
  ]);

  await Product.findByIdAndUpdate(productId, {
    numOfReviews: stats.length > 0 ? stats[0].nRating : 0,
    ratingsAverage: stats.length > 0 ? stats[0].avgRating : 0,
  });
};

reviewsSchema.post("save", async function (): Promise<void> {
  await (this.constructor as IReviewModel).calcAverageRatings(this.product);
});

reviewsSchema.pre<ReviewQuery>(
  /^findOneAnd/,
  async function (next): Promise<void> {
    const doc = await (this.model as IReviewModel).findOne(this.getQuery());

    if (doc) {
      this.r = doc;
    }
    next();
  }
);

reviewsSchema.post<ReviewQuery>(
  /^findOneAnd/,
  async function (): Promise<void> {
    if (this.r) {
      await (this.model as IReviewModel).calcAverageRatings(this.r.product);
    }
  }
);

// Virtual field for like count
reviewsSchema.virtual("likeCount").get(function (this: IReview): number {
  return this.likes.length;
});

const Review: IReviewModel = mongoose.model<IReview, IReviewModel>(
  "Review",
  reviewsSchema
);

export default Review;
