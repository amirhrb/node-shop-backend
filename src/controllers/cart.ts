import { Request, Response, NextFunction } from "express";
import Cart, { ICart } from "../models/cart";
import Product from "../models/product/product";
import AppError from "../utils/error";
import BaseController from "./helpers/base";

class CartController extends BaseController<ICart> {
  constructor() {
    super(Cart);
  }

  addOrUpdateCartItem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { product, quantity } = req.body;
      const userId = req.user.id;

      if (!product || !quantity) {
        return next(
          new AppError("You need to add the product id and the quantity", 400)
        );
      }

      if (parseInt(quantity) <= 0) {
        return next(new AppError("Positive quantity number required", 400));
      }

      const productDoc = await Product.findById(product);

      if (!productDoc) {
        return next(new AppError("There is no product with that id", 400));
      }

      req.body.price = productDoc.price;

      if (quantity > productDoc.stockQuantity) {
        return next(new AppError("Not enough stock", 400));
      }

      const cartItem = await Cart.findOne({ product, user: userId });

      if (cartItem) {
        // update the quantity if the item is already in the cart
        cartItem.quantity += parseInt(quantity);

        // check the updated quantity with the product stock
        if (cartItem.quantity > productDoc.stockQuantity) {
          return next(new AppError("Not enough stock", 400));
        }

        // Update the cart item using the updateOne method from the base class
        req.params.id = (cartItem._id as string).toString();
        req.body.quantity = cartItem.quantity;
        return await this.updateOne()(req, res, next);
      } else {
        // Use the createOne method from the base class to add a new item
        req.body.user = userId;
        return await this.createOne()(req, res, next);
      }
    } catch (error) {
      next(error);
    }
  };
  updateCartItem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { quantity, product, user } = req.body;

      if (!quantity || parseInt(quantity) < 0) {
        return next(new AppError("Positive quantity number required", 400));
      }

      // Prevent changing ownership or product
      if (product || user) {
        return next(
          new AppError("Cannot change product or user of cart item", 400)
        );
      }

      if (parseInt(quantity) === 0) {
        return await this.deleteOne()(req, res, next);
      }

      return await this.updateOne()(req, res, next);
    } catch (error) {
      next(error);
    }
  };

  checkCartOwner = async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const cart = await Cart.findById(req.params.id);

      if (!cart) {
        return next(new AppError("Cart not found", 404));
      }

      if (cart.user.toString() === req.user.id.toString()) {
        next();
      } else {
        next(new AppError("You don't have cart with this id", 403));
      }
    } catch (error) {
      next(error);
    }
  };
  deleteCartItem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    return this.deleteOne()(req, res, next);
  };

  getCartList = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      req.query.user = req.user;

      const totalPrice = await Cart.calcTotalPrice(req.user.id);

      return this.getAll({ totalPrice })(req, res, next); // immediately invoking the function returned by getAll
    } catch (error) {
      next(error);
    }
  };
}

export default CartController;
