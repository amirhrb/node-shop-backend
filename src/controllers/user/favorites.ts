import { NextFunction, Request, Response } from "express";
import BaseController from "../helpers/base";
import mongoose from "mongoose";
import Favorite, { IFavorites } from "../../models/user/favorites";
import AppError from "../../utils/error";

class FavoritesController extends BaseController<IFavorites> {
  constructor() {
    super(Favorite);
  }

  toggleFavorite = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { productId } = req.body;

    if (!productId) {
      return next(new AppError("Product id is required", 400));
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let favorite: IFavorites | IFavorites[] | null = await Favorite.findOne({
        _id: req.user.id,
      }).session(session);

      if (!favorite) {
        // If no favorite document exists, create a new one
        favorite = await Favorite.create(
          [
            {
              _id: req.user.id,
              products: [productId],
            },
          ],
          { session }
        );
        favorite = favorite[0];
      } else {
        // Check if the product already exists in the products array
        if (favorite.products.includes(productId)) {
          favorite.products = favorite.products.filter(
            (product) => product.toString() !== productId.toString()
          );
          await favorite.save({ session });
        } else if (!favorite.products.includes(productId)){
          favorite.products.push(productId);
          await favorite.save({ session });
        } else {
          next(new AppError("Unknown error occurred", 400))
        }
      }

      res.status(201).json({
        status: "success",
        data: favorite,
      });

      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  };

  getFavorites = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      req.params.id = req.user.id;
      return await this.getOne()(req, res, next);
    } catch (error) {
      next(error);
    }
  };

  deleteFavorite = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const favorites = await Favorite.findById(req.user.id).session(session);

      if (!favorites) {
        return next(new AppError("Favorites not found", 404));
      }

      favorites.products = favorites.products.filter(
        (product) => product.toString() !== req.params.productId
      );

      await favorites.save({ session });

      res.status(204).json({
        status: "success",
        message: "Favorite deleted successfully",
      });

      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  };
  deleteAllFavorites = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      req.params.id = req.user.id;
      return await this.deleteOne()(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

export default FavoritesController;
