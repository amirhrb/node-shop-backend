import mongoose, { Schema, Document } from "mongoose";

export enum PermissionAction {
  CREATE = "create",
  READ = "read",
  UPDATE = "update",
  DELETE = "delete",
  MANAGE = "manage", // Special permission that includes all actions
  SUPER = "super",
}

export enum ResourceType {
  USER = "user",
  REVIEW = "review",
  CART = "cart",
  ORDER = "order",
  PRODUCT = "product",
  CATEGORY = "category",
  ROLE = "role",
  PERMISSION = "permission",
  SETTINGS = "settings",
  DASHBOARD = "dashboard",
  LIKE = "like",
  FAVORITE = "favorite",
  PROFILE = "profile",
  ADDRESS = "address",
}

export interface PermissionConditions {
  ownerOnly?: boolean;
  department?: string[];
  status?: string[];
  [key: string]: unknown;
}

export interface IPermission extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  action: PermissionAction;
  resource: ResourceType;
  roles: mongoose.Types.ObjectId[];
  conditions?: PermissionConditions;
}

const permissionSchema = new Schema<IPermission>(
  {
    name: {
      type: String,
      required: [true, "Permission name is required"],
      unique: true,
    },
    description: {
      type: String,
      required: [true, "Permission description is required"],
    },
    action: {
      type: String,
      enum: Object.values(PermissionAction),
      required: [true, "Permission action is required"],
    },
    resource: {
      type: String,
      enum: Object.values(ResourceType),
      required: [true, "Resource type is required"],
    },
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role",
      },
    ],
    conditions: {
      type: Map,
      of: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique permission per resource and action
permissionSchema.index({ resource: 1, action: 1 }, { unique: true });

const Permission = mongoose.model<IPermission>("Permission", permissionSchema);

export default Permission;
