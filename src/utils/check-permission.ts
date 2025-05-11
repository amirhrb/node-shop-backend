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

export interface ResourceData {
  ownerId?: mongoose.Types.ObjectId;
  status?: string;
  department?: string;
}

const checkCondition = (
  conditions: PermissionConditions,
  user: IUser,
  resource?: ResourceData
): boolean => {
  // If no condition is provided, access is granted
  if (!conditions) return true;

  // Check all conditions and combine results
  const checks: boolean[] = [];

  // Owner check
  if (conditions.ownerOnly) {
    if (!resource?.ownerId) return false; // Fail if ownerId is required but not provided
    checks.push((user._id as mongoose.Types.ObjectId).equals(resource.ownerId));
  }

  // Department check
  if (conditions.department) {
    if (!resource?.department) return false; // Fail if department is required but not provided
    checks.push(conditions.department.includes(resource.department));
  }

  // Status check
  if (conditions.status) {
    if (!resource?.status) return false; // Fail if status is required but not provided
    checks.push(conditions.status.includes(resource.status));
  }

  // If no checks were performed, return true
  if (checks.length === 0) return true;

  // All specified conditions must be met
  return checks.every(Boolean);
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

  const populatedUser = await User.findById(user._id).populate<{
    permissions: IPermission[];
  }>({
    path: "permissions",
    select: "name action resource conditions description",
  });

  if (!populatedUser) {
    return false;
  }

  // Find all permissions for the user's roles that match the action and resource
  const matchingPermissions = populatedUser.permissions.filter((permission) => {
    // If user has SUPER permission for this resource, it grants access to any action
    if (
      permission.resource === resource &&
      permission.action === PermissionAction.SUPER
    ) {
      return true;
    }

    // Traditional permission match
    return (
      permission.action === action && permission.resource === resource
    );
  });

  if (matchingPermissions.length === 0) {
    return false;
  }

  // Check if any permission has conditions
  const permissionsWithConditions = matchingPermissions.filter(
    (permission) => permission.conditions
  );

  if (permissionsWithConditions.length === 0) {
    return true;
  }

  // Check for MANAGE permissions with ownerOnly condition first
  const hasManagePermission = permissionsWithConditions.some((permission) => 
    permission.action === PermissionAction.MANAGE && 
    permission.conditions?.ownerOnly && 
    checkCondition(permission.conditions, user, resourceData)
  );

  if (hasManagePermission) {
    return true;
  }

  // Check if any other conditions are met
  return permissionsWithConditions.some((permission) => 
    checkCondition(permission.conditions as PermissionConditions, user, resourceData)
  );
};
