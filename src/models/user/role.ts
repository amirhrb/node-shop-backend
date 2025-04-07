import mongoose, { Document, Schema } from "mongoose";

export interface IRole extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  permissions: mongoose.Types.ObjectId[];
  users: mongoose.Types.ObjectId[];
  isDefault?: boolean;
}

const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: [true, "Role name is required"],
      unique: true,
    },
    description: {
      type: String,
      required: [true, "Role description is required"],
    },
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      },
    ],
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to ensure at least one permission exists
roleSchema.pre("save", async function (next) {
  if (this.isModified("permissions") && this.permissions.length === 0) {
    return next(new Error("Role must have at least one permission"));
  }
  next();
});

const Role = mongoose.model<IRole>("Role", roleSchema);

export default Role;
