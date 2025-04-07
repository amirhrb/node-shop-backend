import { Request, Response, NextFunction } from "express";
import Like, { ILike } from "../models/Like";
import Product from "../models/product/product";
import Review from "../models/product/reviews";
import BaseController from "./helpers/base";
import AppError from "../utils/error";

interface LikeQuery {
  product?: string;
  review?: string;
}

class LikeController extends BaseController<ILike> {
  constructor() {
    super(Like);
  }

  // Toggle like for a product or review
  toggleLike = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { productId, reviewId } = req.body;
      const userId = req.user.id;

      // Validate that exactly one ID is provided
      if ((!productId && !reviewId) || (productId && reviewId)) {
        return next(
          new AppError(
            "Exactly one of productId or reviewId must be provided",
            400
          )
        );
      }

      // Check if the product or review exists
      if (productId) {
        const product = await Product.findById(productId);
        if (!product) {
          return next(new AppError("Product not found", 404));
        }
      } else if (reviewId) {
        const review = await Review.findById(reviewId);
        if (!review) {
          return next(new AppError("Review not found", 404));
        }
      }

      // Check if like already exists
      const existingLike = await Like.findOne({
        user: userId,
        $or: [{ product: productId }, { review: reviewId }],
      });

      if (existingLike) {
        // Unlike: Remove the existing like
        await Like.findByIdAndDelete(existingLike._id);

        // Remove like from product or review
        if (productId) {
          await Product.findByIdAndUpdate(productId, {
            $pull: { likes: existingLike._id },
          });
        } else if (reviewId) {
          await Review.findByIdAndUpdate(reviewId, {
            $pull: { likes: existingLike._id },
          });
        }

        res.status(200).json({
          status: "success",
          message: "Like removed successfully",
          liked: false,
        });
      } else {
        // Like: Create a new like
        const like = await Like.create({
          user: userId,
          product: productId,
          review: reviewId,
        });

        // Update product or review likes count
        if (productId) {
          await Product.findByIdAndUpdate(productId, {
            $push: { likes: like._id },
          });
        } else if (reviewId) {
          await Review.findByIdAndUpdate(reviewId, {
            $push: { likes: like._id },
          });
        }

        res.status(201).json({
          status: "success",
          message: "Like added successfully",
          liked: true,
          data: like,
        });
      }
    } catch (error) {
      next(error);
    }
  };

  // Get likes for a product or review
  getLikes = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { productId, reviewId } = req.params;
      const query: LikeQuery = {};

      if (productId) query.product = productId;
      if (reviewId) query.review = reviewId;

      const likes = await Like.find(query)
        .populate("user", "name email")
        .sort("-createdAt");
      if (!likes) {
        res.json({ message: "No likes found" });
      }

      res.json(likes);
    } catch (error) {
      next(error);
    }
  };

  // Check if user has liked a product or review
  checkLikeStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { productId, reviewId } = req.params;
      const userId = req.user.id;

      const like = await Like.findOne({
        user: userId,
        $or: [{ product: productId }, { review: reviewId }],
      });
      res.json({ isLiked: !!like });
    } catch (error) {
      next(error);
    }
  };
}

export default LikeController;
