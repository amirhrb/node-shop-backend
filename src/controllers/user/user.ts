import { Request, Response, NextFunction } from "express";
import User, { IUser } from "../../models/user/user";
import BaseController from "../helpers/base";
import AppError from "../../utils/error";
import Permission from "../../models/user/permission";
import Role from "../../models/user/role";

class UserController extends BaseController<IUser> {
  constructor() {
    super(User);
  }

  getMe = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    req.params.id = req.user.id;
    return await this.getOne({ path: "profile addresses" })(req, res, next);
  };

  updateMe = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (req.body.password) {
        return next(
          new AppError(
            "This route is not for password update. Please use /updatePassword",
            400
          )
        );
      }

      const { email, username, firstname, lastname } = req.body;

      const { id } = req.user;
      const user = await User.findByIdAndUpdate(
        id,
        { email, username, firstname, lastname },
        {
          new: true,
          runValidators: true,
        }
      );

      res.status(200).json({ status: "success", data: user });
    } catch (error) {
      next(error);
    }
  };

  changePhone = async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // retired code :/ once upon a time i did it with password stuff
      if (req.body.password) {
        return next(
          new AppError(
            "This route is not for password update. Please use /updatePassword",
            400
          )
        );
      }

      const { phone } = req.body;

      const { id } = req.user;
      const user = await User.findByIdAndUpdate(
        id,
        { phone },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!user) {
        return next(new AppError("User not found", 404));
      }

      next(); // go for sending verification code to user
    } catch (error) {
      next(error);
    }
  };

  deleteMe = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.user;

      await User.findByIdAndUpdate(id, { active: false });
      res.status(204).json({ status: "success", data: null });
    } catch (error) {
      next(error);
    }
  };

  getAllUsers = this.getAll(undefined, undefined, true);
  getUserByID = this.getOne();
  updateUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Remove sensitive fields that should not be updated by regular admins
      delete req.body.password;
      delete req.body.roles;
      delete req.body.permissions;
      delete req.body.isVerified;
      delete req.body.active;
      delete req.body.loginAttempts;
      delete req.body.loginExpires;
      delete req.body.lastLoginAttempt;
      delete req.body.phoneVerificationToken;
      delete req.body.phoneVerificationExpires;
      delete req.body.phone;
      delete req.body.previousPhone;
      delete req.body.newPhone;
      delete req.body.email;

      return await this.updateOne()(req, res, next);
    } catch (error) {
      next(error);
    }
  };
  deleteUser = this.deleteOne();

  getUserPermissions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) {
        return next(new AppError("user id is required", 404));
      }
      const user = await User.findById(id).populate({
        path: "permissions",
        select: "id name description action resource conditions",
      });
      if (!user) {
        return next(new AppError("User not found", 404));
      }
      res.status(200).json({
        status: "success",
        data: user.permissions,
      });
    } catch (error) {
      next(error);
    }
  };
  getUserRoles = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) {
        return next(new AppError("user id is required", 404));
      }
      const user = await User.findById(id).populate({
        path: "roles",
        select: "id name description",
      });
      if (!user) {
        return next(new AppError("User not found", 404));
      }
      res.status(200).json({
        status: "success",
        data: user.roles,
      });
    } catch (error) {
      next(error);
    }
  };
  getPermissionById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) {
        return next(new AppError("permission id is required", 404));
      }
      const permission = await Permission.findById(id).populate({
        path: "roles",
        select: "id name description",
      });
      if (!permission) {
        return next(new AppError("permission not found", 404));
      }
      res.status(200).json({
        status: "success",
        data: permission,
      });
    } catch (error) {
      next(error);
    }
  };
  getRoleById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) {
        return next(new AppError("role id is required", 404));
      }
      const role = await Role.findById(id).populate({
        path: "permissions",
        select: "id name description action resource condition",
      });
      if (!role) {
        return next(new AppError("role not found", 404));
      }
      res.status(200).json({
        status: "success",
        data: role,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default UserController;
