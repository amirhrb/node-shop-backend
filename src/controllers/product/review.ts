import { Request, Response, NextFunction } from "express";
import Review, { IReview } from "../../models/product/reviews";
import BaseController from "../helpers/base";
import AppError from "../../utils/error";
import Product from "../../models/product/product";
import Order from "../../models/order";
import User from "../../models/user/user";
import mongoose from "mongoose";

class ReviewsController extends BaseController<IReview> {
  constructor() {
    super(Review);
  }

  createReview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      if (req.params.productId) req.body.product = req.params.productId;
      const { product, rating, review } = req.body;

      if (!product || !rating || !review) {
        return next(
          new AppError("You need to add the product id, rating and review", 400)
        );
      }
      // Todo: Add image to reviews
      const productExist = await Product.findById(product).session(session);

      if (!productExist) {
        return next(new AppError("There is no product with that id", 400));
      }

      // Check if the user has ordered the product and the order is delivered
      const orderExist = await Order.findOne({
        user: req.user.id,
        "orderItems.product": product,
        status: "delivered",
      }).session(session);

      if (!orderExist) {
        return next(
          new AppError(
            "You can only review products you have ordered and are delivered",
            400
          )
        );
      }

      req.body.user = req.user.id;

      // Create the review
      const newReview = await Review.create([req.body], { session });

      // Update the user's reviews array
      await User.updateOne(
        { id: req.user.id },
        {
          $push: {
            reviews: newReview[0]._id,
          },
        },
        { session }
      );

      // Update the product's reviews array
      await Product.updateOne(
        { id: product },
        {
          $push: {
            reviews: newReview[0]._id,
          },
        },
        { session }
      );

      await session.commitTransaction();

      res.status(201).json({
        status: "success",
        data: newReview[0],
      });
    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      session.endSession();
    }
  };

  getReview = this.getOne();

  getReviews = (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (req.params.productId) req.query.product = req.params.productId;
    if (req.body.product) req.query.product = req.body.product;

    return this.getAll()(req, res, next); // immediately invoking the function returned by getAll
  };

  updateReview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      delete req.body.user;
      delete req.body.product;
      delete req.body.likes;
      delete req.body.user;
      delete req.body.isPublished;

      req.body.isVerified = false;

      await this.updateOne()(req, res, next);
    } catch (error) {
      next(error);
    }
  };
  deleteReview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const review = await Review.findById(req.params.id);
      if (!review) {
        return next(new AppError("Review not found", 404));
      }

      // Remove review from user's reviews array
      await User.findByIdAndUpdate(review.user, {
        $pull: { reviews: review._id },
      });
      await Product.findByIdAndUpdate(review.product, {
        $pull: { reviews: review._id },
      });

      // Delete the review
      await Review.findByIdAndDelete(review._id);

      res.status(204).json({
        status: "success",
        data: null,
      });
    } catch (error) {
      next(error);
    }
  };
  togglePublish = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const review = await Review.findById(req.params.id);

      if (!review) {
        return next(new AppError("Review not found", 404));
      }

      review.isPublished = !review.isPublished;

      await review.save();

      res.status(200).json({
        message: `review is ${
          review.isPublished ? "published" : "not published"
        } now`,
        data: review,
      });
    } catch (error) {
      next(error);
    }
  };
  toggleVerification = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const review = await Review.findById(req.params.id);

      if (!review) {
        return next(new AppError("Review not found", 404));
      }

      review.isVerified = !review.isVerified;

      await review.save();

      res.status(200).json({
        message: `review is ${
          review.isVerified ? "verified" : "unverified"
        } now`,
        data: review,
      });
    } catch (error) {
      next(error);
    }
  };
  getUserReviews = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      req.query.user = req.params.id;
      req.query.isPublished = "true";
      req.query.isVerified = "true";

      return await this.getAll()(req, res, next);
    } catch (error) {
      next(error);
    }
  };
  getProductReviews = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      req.query.product = req.params.id;
      req.query.isPublished = "true";
      req.query.isVerified = "true";

      return await this.getAll()(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

export default ReviewsController;
