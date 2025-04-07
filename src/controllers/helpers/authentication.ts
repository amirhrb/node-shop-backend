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
import { SignOptions } from "jsonwebtoken";
import { PermissionAction, ResourceType } from "../../models/user/permission";
import { hasPermission } from "../../utils/check-permission";

interface JwtPayload {
  id: string;
  iat: number;
  exp: number;
}

class Authentication {
  constructor() {}

  private generateToken = (
    data: { id: string },
    secret: string,
    expiresIn: string
  ): string => {
    return jwt.sign(data, secret, {
      expiresIn,
    } as SignOptions);
  };

  private verifyToken = async (
    token: string,
    secret: string
  ): Promise<JwtPayload> => {
    return new Promise((resolve, reject) => {
      jwt.verify(token, secret, (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded as JwtPayload);
        }
      });
    });
  };

  private sendAccessTokenCookie = (
    token: string,
    req: Request,
    res: Response
  ): void => {
    const cookieExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || "1d";
    const days = parseInt(cookieExpiresIn.replace("d", ""));

    const cookieOptions = {
      expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    };

    res.cookie("access_token", token, cookieOptions);
  };

  private sendRefreshTokenCookie = (
    token: string,
    req: Request,
    res: Response
  ): void => {
    const cookieExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
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
  ): Promise<void> => {
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

  verifyCode = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId, code } = req.body;

      if (!userId || !code) {
        return next(
          new AppError("User ID and verification code are required", 400)
        );
      }

      const user = await User.findById(userId).select(
        "+phoneVerificationToken +phoneVerificationExpires +loginAttempts +loginExpires +lastLoginAttempt"
      );
      if (!user) {
        return next(new AppError("User not found", 404));
      }

      // Check login attempts and lockout
      if (!user.checkLogin()) {
        return next(
          new AppError(
            "Too many login attempts. Account locked for 1 hour.",
            429
          )
        );
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
        await user.save(); // Save the failed attempt
        return next(new AppError("Invalid or expired verification code", 400));
      }

      // Clear verification data and reset login attempts
      user.phoneVerificationToken = undefined;
      user.phoneVerificationExpires = undefined;
      user.loginAttempts = 0;
      user.loginExpires = undefined;
      user.lastLoginAttempt = new Date();

      if (!user.isVerified) {
        user.isVerified = true;
      }

      await user.save();

      // Generate new token pair
      const accessToken = this.generateToken(
        { id: user.id.toString() },
        process.env.JWT_SECRET as string,
        process.env.JWT_ACCESS_EXPIRES_IN as string
      );

      const refreshToken = this.generateToken(
        { id: user.id.toString() },
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

  refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
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
        { id: user.id.toString() },
        process.env.JWT_SECRET as string,
        process.env.JWT_ACCESS_EXPIRES_IN as string
      );

      const newRefreshToken = this.generateToken(
        { id: user.id.toString() },
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

  logout = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await RefreshToken.findOneAndDelete({ refreshToken });
      }

      res.cookie("access_token", "loggedout", {
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

  logoutAll = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.user;

      await RefreshToken.deleteMany({ user: id });

      res.cookie("access_token", "loggedout", {
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

  protect = async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      let token;
      if (req.cookies.access_token) {
        token = req.cookies.access_token;
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

  restrictTo(
    action: PermissionAction,
    resource: ResourceType,
    _conditions?: {
      ownerOnly?: boolean;
      department?: string[];
      status?: string[];
    }
  ) {
    return async (
      req: Request,
      _res: Response,
      next: NextFunction
    ): Promise<void> => {
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

        // Get resource data for condition checking
        const resourceData = {
          ownerId: req.params.userId
            ? new mongoose.Types.ObjectId(req.params.userId)
            : undefined,
          status: req.body.status || (req.query.status as string),
          department: user.department,
        };

        const hasAccess = await hasPermission(
          user,
          { action, resource },
          resourceData
        );

        if (!hasAccess) {
          return next(
            new AppError(
              "You do not have permission to perform this action",
              403
            )
          );
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  // New method to check if user has any of the specified permissions
  hasAnyPermission(
    permissions: { action: PermissionAction; resource: ResourceType }[]
  ) {
    return async (
      req: Request,
      _res: Response,
      next: NextFunction
    ): Promise<void> => {
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

        const permissionChecks = await Promise.all(
          permissions.map(({ action, resource }) =>
            hasPermission(user, { action, resource })
          )
        );

        if (!permissionChecks.some(Boolean)) {
          return next(
            new AppError(
              "You do not have permission to perform this action",
              403
            )
          );
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  // New method to check if user has all of the specified permissions
  hasAllPermissions(
    permissions: { action: PermissionAction; resource: ResourceType }[]
  ) {
    return async (
      req: Request,
      _res: Response,
      next: NextFunction
    ): Promise<void> => {
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

        const hasAllPermissions = await Promise.all(
          permissions.map(({ action, resource }) =>
            hasPermission(user, { action, resource })
          )
        );

        if (!hasAllPermissions.every(Boolean)) {
          return next(
            new AppError(
              "You do not have permission to perform this action",
              403
            )
          );
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  updateProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
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

  promoteToAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId, roleType = "admin" } = req.body;

      if (!userId) {
        return next(new AppError("User ID is required", 400));
      }

      if (!["admin", "superAdmin"].includes(roleType)) {
        return next(
          new AppError(
            "Invalid role type. Must be 'admin' or 'superAdmin'",
            400
          )
        );
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Find the target user
        const targetUser = await User.findById(userId).session(session);
        if (!targetUser) {
          await session.abortTransaction();
          session.endSession();
          return next(new AppError("User not found", 404));
        }

        // Find or create the specified role
        let adminRole = await Role.findOne({ name: roleType }).session(session);
        if (!adminRole) {
          const newRoles = await Role.create(
            [
              {
                name: roleType,
                description:
                  roleType === "admin"
                    ? "Administrator with elevated permissions"
                    : "Super Administrator with full system access",
                isDefault: false,
                users: [targetUser._id],
              },
            ],
            { session }
          );
          adminRole = newRoles[0];
        } else {
          // Check if user already has this role
          const isAlreadyAdmin = targetUser.roles.some(
            (role) => role.toString() === adminRole!._id.toString()
          );

          if (isAlreadyAdmin) {
            await session.abortTransaction();
            session.endSession();
            return next(
              new AppError(`User already has the ${roleType} role`, 400)
            );
          }
        }

        // Find existing admin permissions
        const adminPermissions = await Permission.find({
          action: PermissionAction.MANAGE,
          roles: adminRole._id,
        }).session(session);

        // If no admin permissions exist, create them
        if (adminPermissions.length === 0) {
          const newPermissions = await Permission.create(
            Object.values(ResourceType).map((resource) => ({
              name: `${resource}:manage`,
              description: `Manage ${resource}`,
              action: PermissionAction.MANAGE,
              resource,
              roles: [adminRole!._id],
            })),
            { session }
          );

          // Add permissions to role
          adminRole.permissions = newPermissions.map((p) => p._id);
          await adminRole.save({ session });

          // Add permissions to user
          targetUser.permissions.push(...newPermissions.map((p) => p._id));
        } else {
          // Add existing permissions to user
          const permissionIds = adminPermissions.map((p) => p._id);
          targetUser.permissions.push(
            ...permissionIds.filter(
              (id) =>
                !targetUser.permissions.some(
                  (p) => p.toString() === id.toString()
                )
            )
          );
        }

        // Add user to role's users array if not already there
        if (!adminRole.users.includes(targetUser._id)) {
          adminRole.users.push(targetUser._id);
          await adminRole.save({ session });
        }

        // Add role to user
        targetUser.roles.push(adminRole._id);
        await targetUser.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
          status: "success",
          message: `User promoted to ${roleType} successfully`,
        });
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
      }
    } catch (error) {
      next(error);
    }
  };

  demoteFromRole = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId, roleType = "admin" } = req.body;

      if (!userId) {
        return next(new AppError("User ID is required", 400));
      }

      if (!["admin", "superAdmin"].includes(roleType)) {
        return next(
          new AppError(
            "Invalid role type. Must be 'admin' or 'superAdmin'",
            400
          )
        );
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Find the target user
        const targetUser = await User.findById(userId)
          .populate("roles")
          .populate("permissions")
          .session(session);

        if (!targetUser) {
          await session.abortTransaction();
          session.endSession();
          return next(new AppError("User not found", 404));
        }

        // Find role
        const role = await Role.findOne({ name: roleType })
          .populate("permissions")
          .session(session);

        if (!role) {
          await session.abortTransaction();
          session.endSession();
          return next(new AppError(`${roleType} role not found`, 404));
        }

        // Check if user has the role
        const hasRole = targetUser.roles.some(
          (r) => r._id.toString() === role._id.toString()
        );

        if (!hasRole) {
          await session.abortTransaction();
          session.endSession();
          return next(
            new AppError(`User does not have the ${roleType} role`, 400)
          );
        }

        // Get permission IDs to remove
        const rolePermissionIds = role.permissions.map((p) => p._id.toString());

        // Remove role from user
        targetUser.roles = targetUser.roles.filter(
          (r) => r._id.toString() !== role._id.toString()
        );

        // Remove role's permissions from user (only those that aren't part of other roles)
        const otherRoles = targetUser.roles as mongoose.Types.ObjectId[];
        const otherRoleIds = otherRoles.map((r) => r._id.toString());

        // Get all permissions from user's other roles
        const otherRolesPermissions = await Permission.find({
          roles: { $in: otherRoleIds },
        }).session(session);

        const otherRolesPermissionIds = otherRolesPermissions.map((p) =>
          p._id.toString()
        );

        // Filter out permissions that are unique to the removed role
        targetUser.permissions = targetUser.permissions.filter(
          (p) =>
            !rolePermissionIds.includes(p._id.toString()) ||
            otherRolesPermissionIds.includes(p._id.toString())
        );

        // Remove user from role's users array
        role.users = role.users.filter(
          (u) => u.toString() !== targetUser._id.toString()
        );

        // Save changes
        await Promise.all([
          targetUser.save({ session }),
          role.save({ session }),
        ]);

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
          status: "success",
          message: `User demoted from ${roleType} role successfully`,
        });
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
      }
    } catch (error) {
      next(error);
    }
  };

  manageUserPermissions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        userId,
        permissionsToAdd = [],
        permissionsToRemove = [],
      } = req.body;

      if (!userId) {
        return next(new AppError("User ID is required", 400));
      }

      if (
        !Array.isArray(permissionsToAdd) ||
        !Array.isArray(permissionsToRemove)
      ) {
        return next(
          new AppError("Permissions must be provided as arrays", 400)
        );
      }

      // Find the target user with populated permissions
      const targetUser = await User.findById(userId).populate("permissions");
      if (!targetUser) {
        return next(new AppError("User not found", 404));
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Handle permissions to add
        const permissionsToAddDocs = [];
        if (permissionsToAdd.length > 0) {
          // Validate each permission to add
          for (const permission of permissionsToAdd) {
            if (!permission.action || !permission.resource) {
              await session.abortTransaction();
              session.endSession();
              return next(new AppError("Invalid permission format", 400));
            }
          }

          // Find or create permissions to add
          for (const permission of permissionsToAdd) {
            if (permission.action == PermissionAction.SUPER) {
              return next(
                new AppError("Super permission can not be managed", 400)
              );
            }
            let existingPermission = await Permission.findOne({
              action: permission.action,
              resource: permission.resource,
            }).session(session);

            if (!existingPermission) {
              const newPermission = await Permission.create(
                [
                  {
                    name: `${permission.resource}:${permission.action}`,
                    description: `${permission.action} ${permission.resource}`,
                    action: permission.action,
                    resource: permission.resource,
                    conditions: permission.conditions,
                  },
                ],
                { session }
              );
              existingPermission = newPermission[0];
            }

            permissionsToAddDocs.push(existingPermission);
          }
        }

        // Handle permissions to remove
        const permissionsToRemoveIds: mongoose.Types.ObjectId[] = [];
        if (permissionsToRemove.length > 0) {
          // Validate each permission to remove
          for (const permission of permissionsToRemove) {
            if (!permission.action || !permission.resource) {
              await session.abortTransaction();
              session.endSession();
              return next(new AppError("Invalid permission format", 400));
            }
          }

          // Find permissions to remove
          for (const permission of permissionsToRemove) {
            if (permission.action == PermissionAction.SUPER) {
              return next(
                new AppError("Super permission can not be managed", 400)
              );
            }
            const existingPermission = await Permission.findOne({
              action: permission.action,
              resource: permission.resource,
            }).session(session);

            if (existingPermission) {
              permissionsToRemoveIds.push(existingPermission._id);
            }
          }
        }

        // Get current permissions
        const currentPermissions = targetUser.permissions.map((p) => p._id);

        // Add new permissions (avoid duplicates)
        const permissionsToAddIds = permissionsToAddDocs.map((p) => p._id);

        // Remove specified permissions
        const updatedPermissions = [
          ...currentPermissions.filter(
            (id) => !permissionsToRemoveIds.includes(id)
          ),
          ...permissionsToAddIds.filter(
            (id) => !currentPermissions.includes(id)
          ),
        ];

        // Update user permissions
        targetUser.permissions = updatedPermissions;
        await targetUser.save({ session });

        await session.commitTransaction();
        session.endSession();

        // Get updated user with populated permissions for response
        const updatedUser = await User.findById(userId).populate({
          path: "permissions",
          select: "name action resource conditions",
        });

        res.status(200).json({
          status: "success",
          message: "User permissions updated successfully",
          data: {
            permissions: updatedUser?.permissions,
          },
        });
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        return next(error);
      }
    } catch (error) {
      next(error);
    }
  };
}

export default Authentication;
