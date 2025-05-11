import mongoose, { Document, Model, Schema } from "mongoose";

export interface IAddress extends Document {
  user: mongoose.Types.ObjectId;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

const addressSchema: Schema<IAddress> = new mongoose.Schema<IAddress>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      auto: false,
    },
    addressLine: {
      type: String,
      required: [true, "Address is required"],
    },
    city: {
      type: String,
      required: [true, "City is required"],
    },
    state: {
      type: String,
      required: [true, "State is required"],
    },
    postalCode: {
      type: String,
      required: [true, "Postal Code is required"],
    },
    country: {
      type: String,
      required: [true, "Country is required"],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one default address per user
addressSchema.index(
  { user: 1, isDefault: 1 },
  {
    unique: true,
    partialFilterExpression: { isDefault: true },
  }
);

// Create a compound index for user to efficiently query all addresses for a user
addressSchema.index({ user: 1 });

const Address: Model<IAddress> = mongoose.model<IAddress>(
  "Address",
  addressSchema
);

export default Address;
