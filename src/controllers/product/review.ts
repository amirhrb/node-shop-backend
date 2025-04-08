import { Request, Response, NextFunction } from "express";
import Review, { IReview } from "../../models/product/reviews";
import BaseController from "../helpers/base";
import AppError from "../../utils/error";
import Product from "../../models/product/product";
import Order from "../../models/order";
// import Role from "../../models/user/role";

class ReviewsController extends BaseController<IReview> {
  constructor() {
    super(Review);
  }

  createReview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (req.params.productId) req.body.product = req.params.productId;
      const { product, rating, review } = req.body;

      if (!product || !rating || !review) {
        return next(
          new AppError("You need to add the product id, rating and review", 400)
        );
      }
      // Todo: Add image to reviews
      const productExist = await Product.findById(product);

      if (!productExist) {
        return next(new AppError("There is no product with that id", 400));
      }

      // Check if the user has ordered the product and the order is delivered
      const orderExist = await Order.findOne({
        user: req.user.id,
        "orderItems.product": product,
        status: "delivered",
      });

      if (!orderExist) {
        return next(
          new AppError(
            "You can only review products you have ordered and are delivered",
            400
          )
        );
      }

      req.body.user = req.user.id;

      return await this.createOne()(req, res, next);
    } catch (error) {
      next(error);
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

  // checkReviewOwner = ({
  //   allowAdmin = false,
  // }: {
  //   allowAdmin?: boolean;
  // }): ((req: Request, _res: Response, next: NextFunction) => Promise<void>) => {
  //   return async (
  //     req: Request,
  //     _res: Response,
  //     next: NextFunction
  //   ): Promise<void> => {
  //     try {
  //       const { id } = req.params;

  //       const review = await Review.findById(id);

  //       if (!review) {
  //         return next(new AppError("Review not found", 404));
  //       }

  //       // Allow admin users to proceed if it allowed
  //       if (allowAdmin) {
  //         const userRoles = await Role.find({ _id: { $in: req.user.roles } });
  //         const isAdmin = userRoles.some(
  //           (role: { name: string }) =>
  //             role.name === "admin" || role.name === "super-admin"
  //         );
  //         if (isAdmin) {
  //           return next();
  //         }
  //       }

  //       // Allow review owner to proceed
  //       if (review.user.id.toString() === req.user.id) {
  //         return next();
  //       }

  //       // If the user is neither the owner nor an admin, deny access
  //       return next(
  //         new AppError("You don't have permission to perform this action", 403)
  //       );
  //     } catch (error) {
  //       next(error);
  //     }
  //   };
  // };
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
  deleteReview = this.deleteOne();
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
}

export default ReviewsController;
