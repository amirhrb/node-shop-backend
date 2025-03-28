import { Request, Response, NextFunction } from "express";
import User from "../models/user/user";

// Define interfaces for the populated objects
interface Permission {
  name: string;
  [key: string]: any;
}

interface Role {
  permissions: Permission[];
  [key: string]: any;
}

interface PopulatedUser {
  roles: Role[];
  permissions: Permission[];
  [key: string]: any;
}

export const checkPermissions = (requiredPermissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await User.findById(req.user.id)
      .populate({
        path: "roles",
        populate: {
          path: "permissions",
          model: "Permission",
        },
      })
      .populate("permissions");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const populatedUser = user as unknown as PopulatedUser;
    const userPermissions = new Set<string>();

    // Add permissions from roles
    populatedUser.roles.forEach((role) => {
      role.permissions.forEach((permission) => {
        userPermissions.add(permission.name);
      });
    });

    // Add direct permissions
    populatedUser.permissions.forEach((permission) => {
      userPermissions.add(permission.name);
    });

    const hasPermission = requiredPermissions.every((perm) =>
      userPermissions.has(perm)
    );

    if (!hasPermission) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
};
