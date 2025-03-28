import { Request, Response, NextFunction } from "express";
import Like, { ILike } from "../models/Like";
import Product from "../models/product/product";
import Review from "../models/product/reviews";
import BaseController from "./helpers/base";
import AppError from "../utils/error";

class LikeController extends BaseController<ILike> {
  constructor() {
    super(Like);
  }
  // Like a product or review
  createLike = async (req: Request, res: Response) => {
    try {
      const { productId, reviewId } = req.body;
      const userId = req.user.id;
  
      // Validate that exactly one ID is provided
      if ((!productId && !reviewId) || (productId && reviewId)) {
        res.status(400).json({ 
          message: "Exactly one of productId or reviewId must be provided" 
        });
      }
  
      // Check if the product or review exists
      if (productId) {
        const product = await Product.findById(productId);
        if (!product) {
          res.status(404).json({ message: "Product not found" });
        }
      } else if (reviewId) {
        const review = await Review.findById(reviewId);
        if (!review) {
          res.status(404).json({ message: "Review not found" });
        }
      }
  
      // Check if like already exists
      const existingLike = await Like.findOne({
        user: userId,
        $or: [
          { product: productId },
          { review: reviewId }
        ]
      });
  
      if (existingLike) {
        res.status(400).json({ message: "Already liked" });
      }
  
      // Create new like
      const like = await Like.create({
        user: userId,
        product: productId,
        review: reviewId
      });
  
      // Update product or review likes count
      if (productId) {
        await Product.findByIdAndUpdate(productId, {
          $push: { likes: like._id }
        });
      } else if (reviewId) {
        await Review.findByIdAndUpdate(reviewId, {
          $push: { likes: like._id }
        });
      }
  
      res.status(201).json(like);
    } catch (error) {
      res.status(500).json({ message: "Error creating like", error });
    }
  };
  
  // Unlike a product or review
  removeLike = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { productId, reviewId } = req.params;
      const userId = req.user.id;
  
      const like = await Like.findOneAndDelete({
        user: userId,
        $or: [
          { product: productId },
          { review: reviewId }
        ]
      });
  
      if (!like) {
        return next(new AppError("Like not found", 404));
      }
  
      // Remove like from product or review
      if (productId) {
        await Product.findByIdAndUpdate(productId, {
          $pull: { likes: like?._id }
        });
      } else if (reviewId) {
        await Review.findByIdAndUpdate(reviewId, {
          $pull: { likes: like?._id }
        });
      }
  
      res.json({ message: "Like removed successfully" });
    } catch (error) {
      next(error);
    }
  };
  
  // Get likes for a product or review
  getLikes = async (req: Request, res: Response) => {
    try {
      const { productId, reviewId } = req.params;
      const query: any = {};
  
      if (productId) query.product = productId;
      if (reviewId) query.review = reviewId;
  
      const likes = await Like.find(query)
        .populate('user', 'name email')
        .sort('-createdAt');
  
      res.json(likes);
    } catch (error) {
      res.status(500).json({ message: "Error fetching likes", error });
    }
  };
  
  // Check if user has liked a product or review
  checkLikeStatus = async (req: Request, res: Response) => {
    try {
      const { productId, reviewId } = req.params;
      const userId = req.user.id;
  
      const like = await Like.findOne({
        user: userId,
        $or: [
          { product: productId },
          { review: reviewId }
        ]
      });
  
      res.json({ isLiked: !!like });
    } catch (error) {
      res.status(500).json({ message: "Error checking like status", error });
    }
  };
}
export default LikeController;