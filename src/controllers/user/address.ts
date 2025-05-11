import { NextFunction, Request, Response } from "express";
import Address, { IAddress } from "../../models/user/address";
import BaseController from "../helpers/base";
import mongoose from "mongoose";
import User from "../../models/user/user";
import AppError from "../../utils/error";

class AddressController extends BaseController<IAddress> {
  constructor() {
    super(Address);
  }

  createAddress = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Set the user ID for the address
      req.body.user = req.user.id;

      // Check if this is the first address for the user
      const addressCount = await Address.countDocuments({ user: req.user.id });

      // If it's the first address or explicitly set as default
      if (addressCount === 0 || req.body.isDefault) {
        // If setting as default, unset any existing default
        if (addressCount > 0 && req.body.isDefault) {
          await Address.updateMany(
            { user: req.user.id, isDefault: true },
            { isDefault: false },
            { session }
          );
        }

        // First address is automatically the default
        req.body.isDefault = true;
      }

      // Create the new address
      const newAddress = new Address(req.body);
      await newAddress.save({ session });

      // Add the address to the user's addresses array
      await User.findByIdAndUpdate(
        req.user.id,
        { $addToSet: { addresses: newAddress._id } },
        { session }
      );

      await session.commitTransaction();

      res.status(201).json({
        status: "success",
        data: newAddress,
      });
    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      session.endSession();
    }
  };

  getAllAddresses = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const addresses = await Address.find({ user: req.user.id });

      res.status(200).json({
        status: "success",
        results: addresses.length,
        data: addresses,
      });
    } catch (error) {
      next(error);
    }
  };

  getAddress = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const address = await Address.findOne({
        _id: req.params.id,
        user: req.user.id,
      });

      if (!address) {
        return next(AppError.notFound("Address"));
      }

      res.status(200).json({
        status: "success",
        data: address,
      });
    } catch (error) {
      next(error);
    }
  };

  updateAddress = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check if the address belongs to the user
      const address = await Address.findOne({
        _id: req.params.id,
        user: req.user.id,
      });

      if (!address) {
        await session.abortTransaction();
        return next(AppError.notFound("Address"));
      }

      // If setting as default, unset any existing default
      if (req.body.isDefault) {
        await Address.updateMany(
          { user: req.user.id, isDefault: true },
          { isDefault: false },
          { session }
        );
      }

      // Update the address
      const updatedAddress = await Address.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true, session }
      );

      await session.commitTransaction();

      res.status(200).json({
        status: "success",
        data: updatedAddress,
      });
    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      session.endSession();
    }
  };

  setDefaultAddress = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check if the address belongs to the user
      const address = await Address.findOne({
        _id: req.params.id,
        user: req.user.id,
      });

      if (!address) {
        await session.abortTransaction();
        return next(AppError.notFound("Address"));
      }

      // Unset any existing default
      await Address.updateMany(
        { user: req.user.id, isDefault: true },
        { isDefault: false },
        { session }
      );

      // Set the new default
      const updatedAddress = await Address.findByIdAndUpdate(
        req.params.id,
        { isDefault: true },
        { new: true, session }
      );

      await session.commitTransaction();

      res.status(200).json({
        status: "success",
        data: updatedAddress,
      });
    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      session.endSession();
    }
  };

  deleteAddress = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check if the address belongs to the user
      const address = await Address.findOne({
        _id: req.params.id,
        user: req.user.id,
      });

      if (!address) {
        await session.abortTransaction();
        return next(AppError.notFound("Address"));
      }

      // Remove the address from the user's addresses array
      await User.findByIdAndUpdate(
        req.user.id,
        { $pull: { addresses: req.params.id } },
        { session }
      );

      // Delete the address
      await Address.findByIdAndDelete(req.params.id).session(session);

      // If the deleted address was the default and there are other addresses,
      // set the first one as default
      if (address.isDefault) {
        const remainingAddresses = await Address.find({ user: req.user.id })
          .sort({ createdAt: 1 })
          .limit(1)
          .session(session);

        if (remainingAddresses.length > 0) {
          await Address.findByIdAndUpdate(
            remainingAddresses[0]._id,
            { isDefault: true },
            { session }
          );
        }
      }

      await session.commitTransaction();

      res.status(204).json({
        status: "success",
        data: null,
      });
    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      session.endSession();
    }
  };
}

export default AddressController;
