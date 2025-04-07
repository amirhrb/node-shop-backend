import {
  PermissionAction,
  PermissionConditions,
  ResourceType,
} from "../models/user/permission";

interface PermissionConfig {
  resource: ResourceType;
  actions: PermissionAction[];
  ownerOnly?: boolean;
  description?: string;
}

type PermissionObject = {
  name: string;
  description: string;
  action: PermissionAction;
  resource: ResourceType;
  conditions?: PermissionConditions;
};

export const createPermissions = (
  configs: PermissionConfig[]
): PermissionObject[] => {
  return configs.flatMap((config) => {
    const { resource, actions, ownerOnly, description } = config;
    return actions.map((action) => ({
      name: `${resource}:${action}`,
      description: description || `${action} ${resource}`,
      action,
      resource,
      conditions: ownerOnly ? { ownerOnly: true } : undefined,
    }));
  });
};

// Common permission sets
export const userProfilePermissionsCommon = createPermissions([
  {
    resource: ResourceType.PROFILE,
    actions: [PermissionAction.READ, PermissionAction.UPDATE],
    ownerOnly: true,
    description: "User profile operations",
  },
  {
    resource: ResourceType.USER,
    actions: [
      PermissionAction.READ,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    ownerOnly: true,
    description: "User operations",
  },
]);

export const cartPermissionsCommon = createPermissions([
  {
    resource: ResourceType.CART,
    actions: [
      PermissionAction.CREATE,
      PermissionAction.READ,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    ownerOnly: true,
    description: "Shopping cart operations",
  },
]);

export const orderPermissionsCommon = createPermissions([
  {
    resource: ResourceType.ORDER,
    actions: [PermissionAction.CREATE, PermissionAction.READ],
    ownerOnly: true,
    description: "Order operations",
  },
]);

export const productPermissionsCommon = createPermissions([
  {
    resource: ResourceType.PRODUCT,
    actions: [PermissionAction.READ],
    description: "Product viewing",
  },
]);

export const categoryPermissionsCommon = createPermissions([
  {
    resource: ResourceType.CATEGORY,
    actions: [PermissionAction.READ],
    description: "Category viewing",
  },
]);

export const reviewPermissionsCommon = createPermissions([
  {
    resource: ResourceType.REVIEW,
    actions: [PermissionAction.CREATE, PermissionAction.READ],
    description: "Review operations",
  },
  {
    resource: ResourceType.REVIEW,
    actions: [PermissionAction.UPDATE, PermissionAction.DELETE],
    ownerOnly: true,
    description: "Own review management",
  },
]);

export const likePermissionsCommon = createPermissions([
  {
    resource: ResourceType.LIKE,
    actions: [PermissionAction.CREATE, PermissionAction.READ],
    description: "Like operations",
  },
]);

export const favoritePermissionsCommon = createPermissions([
  {
    resource: ResourceType.FAVORITE,
    actions: [
      PermissionAction.CREATE,
      PermissionAction.READ,
      PermissionAction.DELETE,
    ],
    ownerOnly: true,
    description: "Favorite operations",
  },
]);

export const addressPermissionsCommon = createPermissions([
  {
    resource: ResourceType.ADDRESS,
    actions: [
      PermissionAction.CREATE,
      PermissionAction.READ,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    ownerOnly: true,
    description: "Address management",
  },
]);

export const settingsPermissionsCommon = createPermissions([
  {
    resource: ResourceType.SETTINGS,
    actions: [PermissionAction.READ],
    description: "View application settings",
  },
]);

// Default user permissions
export const defaultUserPermissions = [
  ...userProfilePermissionsCommon,
  ...cartPermissionsCommon,
  ...orderPermissionsCommon,
  ...productPermissionsCommon,
  ...categoryPermissionsCommon,
  ...reviewPermissionsCommon,
  ...likePermissionsCommon,
  ...favoritePermissionsCommon,
  ...addressPermissionsCommon,
  ...settingsPermissionsCommon,
];

// Admin permission sets
export const adminPermissions = createPermissions([
  {
    resource: ResourceType.USER,
    actions: [PermissionAction.MANAGE],
    description: "Manage user resources",
  },
  {
    resource: ResourceType.PRODUCT,
    actions: [PermissionAction.MANAGE],
    description: "Manage product resources",
  },
  {
    resource: ResourceType.ORDER,
    actions: [PermissionAction.MANAGE],
    description: "Manage order operations",
  },
  {
    resource: ResourceType.REVIEW,
    actions: [PermissionAction.MANAGE],
    description: "Manage review operations",
  },
  {
    resource: ResourceType.CATEGORY,
    actions: [PermissionAction.MANAGE],
    description: "Manage product categories",
  },
  {
    resource: ResourceType.DASHBOARD,
    actions: [PermissionAction.READ, PermissionAction.MANAGE],
    description: "Access and manage dashboard",
  },
  {
    resource: ResourceType.SETTINGS,
    actions: [PermissionAction.UPDATE],
    description: "Manage application settings",
  },
  {
    resource: ResourceType.ROLE,
    actions: [PermissionAction.READ, PermissionAction.MANAGE],
    description: "Manage user roles",
  },
]);

// Super admin gets full control over everything
export const superAdminPermissions = createPermissions(
  Object.values(ResourceType).map((resource) => ({
    resource,
    actions: [PermissionAction.SUPER],
    description: `Super access to ${resource} resources`,
  }))
);
