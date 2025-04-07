import {
  PermissionAction,
  ResourceType,
  type IPermission,
  PermissionConditions,
} from "../models/user/permission";
import User, { IUser } from "../models/user/user";
import mongoose from "mongoose";

export interface PermissionCheck {
  action: PermissionAction;
  resource: ResourceType;
  conditions?: PermissionConditions; // Prefix with underscore to indicate unused
}

interface ResourceData {
  ownerId?: mongoose.Types.ObjectId;
  status?: string;
  department?: string;
}

const checkCondition = (
  condition: PermissionConditions,
  user: IUser,
  resource?: ResourceData
): boolean => {
  if (condition.ownerOnly && resource?.ownerId) {
    return (user._id as mongoose.Types.ObjectId).equals(resource.ownerId);
  }

  if (condition.department && resource?.department) {
    return condition.department.includes(resource.department);
  }

  if (condition.status && resource?.status) {
    return condition.status.includes(resource.status);
  }

  return true;
};

export const hasPermission = async (
  user: IUser,
  { action, resource }: PermissionCheck,
  resourceData?: ResourceData
): Promise<boolean> => {
  // Check if user has any roles
  if (!user.roles || user.roles.length === 0) {
    return false;
  }
  const populatedUser = await User.findById(user._id).populate({
    path: "permissions",
    select: "name action resource conditions description",
  });

  if (!populatedUser) {
    return false;
  }

  // Find all permissions for the user's roles that match the action and resource
  const matchingPermissions = populatedUser.permissions.filter((permission) => {
    const permissionDoc = permission as unknown as IPermission;

    // If user has SUPER permission for this resource, it grants access to any action
    if (
      permissionDoc.resource === resource &&
      permissionDoc.action === PermissionAction.SUPER
    ) {
      return true;
    }

    // Traditional permission match
    return (
      permissionDoc.action === action && permissionDoc.resource === resource
    );
  });

  if (matchingPermissions.length === 0) {
    return false;
  }

  // Check if any permission has conditions
  const permissionsWithConditions = matchingPermissions.filter(
    (permission) => (permission as unknown as IPermission).conditions
  );

  if (permissionsWithConditions.length === 0) {
    return true;
  }

  // Check if conditions are met
  return permissionsWithConditions.some((permission) => {
    const permissionConditions = (permission as unknown as IPermission)
      .conditions as PermissionConditions;
    return checkCondition(permissionConditions, user, resourceData);
  });
};
