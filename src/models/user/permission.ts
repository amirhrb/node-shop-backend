import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPermission extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  roles: mongoose.Types.ObjectId[];
}

const permissionSchema: Schema<IPermission> = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role",
      },
    ],
  },
  { timestamps: true }
);

const Permission = mongoose.model<IPermission>("Permission", permissionSchema);

export default Permission;
