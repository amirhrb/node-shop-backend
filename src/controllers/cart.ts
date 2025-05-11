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
      const cartItem = await Cart.findOne({
        product: productDoc.id,
        user: userId,
      });

      if (cartItem) {
        // update the quantity if the item is already in the cart
        cartItem.quantity = parseInt(quantity);

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

  getCartSummary = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user.id;
      const cartItems = await Cart.find({ user: userId }).populate('product');
      
      const summary = {
        totalItems: cartItems.length,
        totalQuantity: cartItems.reduce((sum, item) => sum + item.quantity, 0),
        totalPrice: await Cart.calcTotalPrice(userId),
        items: cartItems
      };

      res.status(200).json({
        status: "success",
        data: summary
      });
    } catch (error) {
      next(error);
    }
  };

  clearCart = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const userId = req.user.id;
    const cartItems = await Cart.find({ user: userId });

    if (!cartItems.length) {
      return next(new AppError("There is no product with that id", 404));
    }

    const response = await Cart.deleteMany({ user: userId });

    if (response.deletedCount > 0 && response.acknowledged) {
      res.status(204).send();
    } else {
      return next(new AppError("Deletion was not acknowledged", 400));
    }
  };

  deleteCartItem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const userId = req.user.id;
    const cartId = req.params.id;

    if (!cartId) {
      return next(new AppError("Cart id is required", 400));
    }

    const cartItem = await Cart.findOne({ user: userId, product: cartId });

    if (!cartItem) {
      return next(
        new AppError("There is no product with that id in cart", 400)
      );
    }

    req.params.id = (cartItem._id as string).toString();
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
