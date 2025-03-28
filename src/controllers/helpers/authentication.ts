/* eslint-disable no-unused-vars */
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../../models/user/user";
import AppError from "../../utils/error";
import SMS from "../../utils/sms";
import mongoose from "mongoose";
import RefreshToken from "../../models/user/tokens";
import Role from "../../models/user/role";
import Permission from "../../models/user/permission";
import { IRole } from "../../models/user/role";
import { SignOptions } from "jsonwebtoken";

interface JwtPayload {
  id: string;
  iat: number;
}

class Authentication {
  constructor() {}

  generateToken = (data: any, secret: string, expiresIn: string): string => {
    return jwt.sign(data, secret, {
      expiresIn,
    } as SignOptions);
  };

  verifyToken = async (token: string, secret: string): Promise<JwtPayload> => {
    return new Promise((resolve, reject) => {
      jwt.verify(token, secret, (err: any, decoded: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded as JwtPayload);
        }
      });
    });
  };

  sendAccessTokenCookie = (token: string, req: Request, res: Response) => {
    const cookieExpiresIn = process.env.JWT_ACCESS_COOKIE_EXPIRES_IN || "1d";
    const days = parseInt(cookieExpiresIn.replace("d", ""));

    const cookieOptions = {
      expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    };

    res.cookie("jwt", token, cookieOptions);
  };

  sendRefreshTokenCookie = (token: string, req: Request, res: Response) => {
    const cookieExpiresIn = process.env.JWT_REFRESH_COOKIE_EXPIRES_IN || "7d";
    const days = parseInt(cookieExpiresIn.replace("d", ""));

    const cookieOptions = {
      expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: req.secure || req.headers["x-forwarded-proto"] === "https",
      path: "/api/v1/users/refresh-token",
    };

    res.cookie("refresh_token", token, cookieOptions);
  };

  sendVerificationCode = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { phone } = req.body;

      if (!phone) {
        return next(new AppError("Phone number is required", 400));
      }
      let user = await User.findOne({ phone })
        .select("+phoneVerificationToken +phoneVerificationExpires")
        .session(session);

      if (!user) {
        // Create new user if doesn't exist
        const newUser = await User.create(
          [
            {
              phone,
              firstName: phone,
              lastName: phone,
              username: phone,
            },
          ],
          { session }
        );
        user = newUser[0];
      } else if (
        user.phoneVerificationToken &&
        user.phoneVerificationExpires &&
        user.phoneVerificationExpires.getTime() > Date.now()
      ) {
        await session.abortTransaction();
        session.endSession();
        return next(
          new AppError("Previous verification code is still valid", 400)
        );
      }

      const verificationCode = user.createPhoneVerificationToken();
      await user.save({ session });

      // Send verification SMS
      await new SMS(user, verificationCode).sendVerification();

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        status: "success",
        message: "Verification code sent successfully",
        userId: user._id,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  };

  verifyCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, code } = req.body;

      if (!userId || !code) {
        return next(
          new AppError("User ID and verification code are required", 400)
        );
      }

      const user = await User.findById(userId).select(
        "+phoneVerificationToken +phoneVerificationExpires"
      );
      if (!user) {
        return next(new AppError("User not found", 404));
      }

      const hashedToken = crypto
        .createHash("sha256")
        .update(code)
        .digest("hex");

      if (
        user.phoneVerificationToken !== hashedToken ||
        !user.phoneVerificationExpires ||
        user.phoneVerificationExpires < new Date()
      ) {
        return next(new AppError("Invalid or expired verification code", 400));
      }

      // Clear verification data
      user.phoneVerificationToken = undefined;
      user.phoneVerificationExpires = undefined;

      if (!user.isVerified) {
        user.isVerified = true;
      }

      await user.save();

      // Generate tokens
      const accessToken = this.generateToken(
        { id: user._id },
        process.env.JWT_SECRET as string,
        process.env.JWT_ACCESS_EXPIRES_IN as string
      );
      const refreshToken = this.generateToken(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET as string,
        process.env.JWT_REFRESH_EXPIRES_IN as string
      );

      await RefreshToken.create({
        refreshToken,
        user: user._id,
        clientFingerprint: {
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        },
      });

      this.sendAccessTokenCookie(accessToken, req, res);
      this.sendRefreshTokenCookie(refreshToken, req, res);

      res.status(200).json({
        status: "success",
        message: "Logged in successfully",
        accessToken,
        isProfileComplete: Boolean(user.firstName !== user.phone),
      });
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies.refresh_token;
      const clientFingerprint = {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      };

      if (!refreshToken) {
        return next(new AppError("No refresh token found in cookies", 400));
      }

      const decoded = await this.verifyToken(
        refreshToken,
        process.env.JWT_REFRESH_SECRET as string
      );

      // Find and delete the current refresh token (single use)
      const refreshTokenDoc = await RefreshToken.findOneAndDelete({
        refreshToken,
        // Validate fingerprint
        "clientFingerprint.ip": clientFingerprint.ip,
        "clientFingerprint.userAgent": clientFingerprint.userAgent,
      });

      if (!refreshTokenDoc) {
        // If token was valid but fingerprint didn't match, potential theft
        const existingToken = await RefreshToken.findOne({ refreshToken });
        if (existingToken) {
          // Compromise detected - invalidate all refresh tokens for this user
          await RefreshToken.deleteMany({ user: existingToken.user });
          return next(
            new AppError("Security breach detected. Please login again", 401)
          );
        }
        return next(new AppError("Invalid refresh token", 401));
      }

      const user = await User.findById(decoded.id);
      if (!user) {
        return next(new AppError("User not found", 404));
      }

      // Generate new token pair
      const newAccessToken = this.generateToken(
        { id: user._id },
        process.env.JWT_SECRET as string,
        process.env.JWT_ACCESS_EXPIRES_IN as string
      );

      const newRefreshToken = this.generateToken(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET as string,
        process.env.JWT_REFRESH_EXPIRES_IN as string
      );

      // Store new refresh token with fingerprint
      await RefreshToken.create({
        refreshToken: newRefreshToken,
        user: user._id,
        clientFingerprint: clientFingerprint,
      });

      this.sendAccessTokenCookie(newAccessToken, req, res);
      this.sendRefreshTokenCookie(newRefreshToken, req, res);

      res.status(200).json({
        status: "success",
        message: "Tokens refreshed successfully",
        accessToken: newAccessToken,
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await RefreshToken.findOneAndDelete({ refreshToken });
      }

      res.cookie("jwt", "loggedout", {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
      });

      res.status(200).json({
        status: "success",
        message: "Logged out successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  logoutAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.user;

      await RefreshToken.deleteMany({ user: id });

      res.cookie("jwt", "loggedout", {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
      });

      res.status(200).json({
        status: "success",
        message: "Logged out from all devices successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  protect = async (req: Request, res: Response, next: NextFunction) => {
    try {
      let token;
      if (req.cookies.jwt) {
        token = req.cookies.jwt;
      } else if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
      ) {
        token = req.headers.authorization.split(" ")[1];
      }

      if (!token) {
        return next(
          new AppError(
            "You are not logged in! Please log in to get access.",
            401
          )
        );
      }

      const decoded = await this.verifyToken(
        token,
        process.env.JWT_SECRET as string
      );

      const user = await User.findById(decoded.id);

      if (!user) {
        return next(
          new AppError(
            "The user belonging to this token no longer exists.",
            401
          )
        );
      }

      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };

  restrictTo(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const { user } = req;
        if (!user) {
          return next(
            new AppError(
              "You are not logged in! Please log in to get access.",
              401
            )
          );
        }

        // Check if user has required roles
        User.findById(user.id)
          .populate({
            path: "roles",
            select: "name",
          })
          .then((foundUser) => {
            if (!foundUser) {
              return next(new AppError("User not found", 404));
            }

            const userRoles = foundUser.roles as unknown as IRole[];
            const hasRole = userRoles.some((role) => roles.includes(role.name));

            if (!hasRole) {
              return next(
                new AppError(
                  "You do not have permission to perform this action",
                  403
                )
              );
            }

            next();
          })
          .catch((error) => {
            next(error);
          });
      } catch (error) {
        next(error);
      }
    };
  }

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { firstName, lastName, username, email } = req.body;
      const { id } = req.user;

      if (!firstName || !lastName || !username) {
        return next(new AppError("Missing required information", 400));
      }

      const user = await User.findById(id);
      if (!user) {
        return next(new AppError("User not found", 404));
      }

      user.firstName = firstName;
      user.lastName = lastName;
      user.username = username;
      user.email = email;

      await user.save();

      res.status(200).json({
        status: "success",
        message: "Profile updated successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  promoteToAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId }: {userId: string} = req.body;

      if (!userId) {
        return next(new AppError("User ID is required", 400));
      }

      // Find the target user
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return next(new AppError("User not found", 404));
      }

      // Find or create admin role
      let adminRole = await Role.findOne({ name: "admin" });
      if (!adminRole) {
        adminRole = await Role.create({
          name: "admin",
          users: [targetUser._id],
        });
      } else {
        // Check if user is already an admin
        const isAlreadyAdmin = targetUser.roles.some(
          (role) => adminRole && role.toString() === adminRole._id.toString()
        );
        if (isAlreadyAdmin) {
          return next(new AppError("User is already an admin", 400));
        }
        adminRole.users.push(
          targetUser._id as unknown as mongoose.Types.ObjectId
        );
        await adminRole.save();
      }

      // Find or create admin permission
      let adminPermission = await Permission.findOne({
        name: "admin",
        roles: adminRole._id,
      });
      if (!adminPermission) {
        adminPermission = await Permission.create({
          name: "admin",
          roles: [adminRole._id],
        });
      }

      // Add admin role and permission to user
      targetUser.roles = [...targetUser.roles, adminRole._id];
      targetUser.permissions = [...targetUser.permissions, adminPermission._id];
      await targetUser.save();

      res.status(200).json({
        status: "success",
        message: "User promoted to admin successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  demoteToUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return next(new AppError("User ID is required", 400));
      }

      // Find the target user
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return next(new AppError("User not found", 404));
      }

      // Find admin role and permission
      const adminRole = await Role.findOne({ name: "admin" });
      const adminPermission = await Permission.findOne({ name: "admin" });

      if (!adminRole || !adminPermission) {
        return next(new AppError("Admin role or permission not found", 404));
      }

      // Check if user is actually an admin
      const isAdmin = targetUser.roles.some(
        (role) => role.toString() === adminRole._id.toString()
      );

      if (!isAdmin) {
        return next(new AppError("User is not an admin", 400));
      }

      // Remove admin role and permission from user
      targetUser.roles = targetUser.roles.filter(
        (role) => role.toString() !== adminRole._id.toString()
      );
      targetUser.permissions = targetUser.permissions.filter(
        (permission) => permission.toString() !== adminPermission._id.toString()
      );

      // Remove user from admin role's users array
      adminRole.users = adminRole.users.filter(
        (user) =>
          user.toString() !==
          (targetUser._id as mongoose.Types.ObjectId).toString()
      );

      await Promise.all([targetUser.save(), adminRole.save()]);

      res.status(200).json({
        status: "success",
        message: "User demoted to regular user successfully",
      });
    } catch (error) {
      next(error);
    }
  };
}

export default Authentication;
