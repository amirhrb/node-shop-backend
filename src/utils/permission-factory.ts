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
  const uniquePermissions = new Map<string, PermissionObject>();

  configs.forEach((config) => {
    const { resource, actions, ownerOnly, description } = config;
    actions.forEach((action) => {
      const name = `${resource}:${action}${ownerOnly ? ":owner" : ""}`;
      if (!uniquePermissions.has(name)) {
        uniquePermissions.set(name, {
          name,
          description: description || `${action} ${resource}`,
          action,
          resource,
          conditions: ownerOnly ? { ownerOnly: true } : undefined,
        });
      }
    });
  });

  return Array.from(uniquePermissions.values());
};

// Common permission sets
export const userProfilePermissionsCommon = createPermissions([
  {
    resource: ResourceType.PROFILE,
    actions: [PermissionAction.READ, PermissionAction.UPDATE],
    ownerOnly: true,
    description: "Manage own user profile",
  },
  {
    resource: ResourceType.USER,
    actions: [
      PermissionAction.READ,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    ownerOnly: true,
    description: "Manage own user account",
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
    description: "Manage own shopping cart",
  },
]);

export const orderPermissionsCommon = createPermissions([
  {
    resource: ResourceType.ORDER,
    actions: [PermissionAction.CREATE, PermissionAction.READ],
    ownerOnly: true,
    description: "Manage own orders",
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

// Admin permission sets with more granular control
export const adminPermissions = createPermissions([
  {
    resource: ResourceType.USER,
    actions: [PermissionAction.MANAGE],
    description: "Manage user accounts and permissions",
  },
  {
    resource: ResourceType.PRODUCT,
    actions: [
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
      PermissionAction.MANAGE,
    ],
    description: "Full product management",
  },
  {
    resource: ResourceType.ORDER,
    actions: [PermissionAction.UPDATE, PermissionAction.MANAGE],
    description: "Process and manage orders",
  },
  {
    resource: ResourceType.REVIEW,
    actions: [PermissionAction.MANAGE],
    description: "Moderate reviews",
  },
  {
    resource: ResourceType.CATEGORY,
    actions: [
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
      PermissionAction.MANAGE,
    ],
    description: "Manage product categories",
  },
  {
    resource: ResourceType.DASHBOARD,
    actions: [PermissionAction.READ, PermissionAction.MANAGE],
    description: "Access analytics dashboard",
  },
  {
    resource: ResourceType.SETTINGS,
    actions: [PermissionAction.UPDATE],
    description: "Configure system settings",
  },
  {
    resource: ResourceType.ROLE,
    actions: [
      PermissionAction.CREATE,
      PermissionAction.READ,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
      PermissionAction.MANAGE,
    ],
    description: "Manage user roles and permissions",
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
