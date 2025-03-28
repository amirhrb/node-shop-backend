import mongoose, { Document, Model, Schema } from "mongoose";

export interface IRole extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  permissions: mongoose.Types.ObjectId[];
  users: mongoose.Types.ObjectId[];
}

const roleSchema: Schema<IRole> = new mongoose.Schema<IRole>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
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
  },
  {
    timestamps: true,
  }
);

const Role: Model<IRole> = mongoose.model<IRole>("Role", roleSchema);

export default Role;
