import crypto from "crypto";
import mongoose, { Document, Model, Schema } from "mongoose";
import validator from "validator";
import Profile from "./profile";
import Permission from "./permission";
import Role from "./role";
import { defaultUserPermissions } from "../../utils/permission-factory";

// Define IUser interface extending Document
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  firstname: string;
  lastname: string;
  email?: string;
  phone: string;
  newPhone: string;
  previousPhone: string;
  roles: mongoose.Types.ObjectId[];
  permissions: mongoose.Types.ObjectId[];
  profile?: mongoose.Types.ObjectId;
  addresses: mongoose.Types.ObjectId[];
  reviews: mongoose.Types.ObjectId[];
  active: boolean;
  loginAttempts?: number;
  isVerified: boolean;
  loginExpires?: Date;
  lastLoginAttempt: Date;
  phoneVerificationToken?: string;
  phoneVerificationExpires?: Date;
  createPhoneVerificationToken: () => string;
  checkLogin: () => boolean;
  confirmPhoneChange: () => Promise<void>;
}

const userSchema: Schema<IUser> = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      required: [true, "Please provide a username"],
    },
    firstname: {
      type: String,
      required: [true, "User First Name is required"],
    },
    lastname: {
      type: String,
      required: [true, "User Last Name is required"],
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      validate: {
        validator: (value: string | undefined): boolean => {
          // Skip validation if email is not provided
          if (!value) return true;
          return validator.isEmail(value);
        },
        message: "Email is not valid!",
      },
    },
    phone: {
      type: String,
      unique: true,
      required: [true, "Phone number is required"],
      validate: [validator.isMobilePhone, "Phone number is not valid"],
    },
    newPhone: {
      type: String,
      unique: true,
      sparse: true,
      validate: [validator.isMobilePhone, "Phone number is not valid"],
    },
    previousPhone: {
      type: String,
      select: false,
    },
    profile: {
      type: mongoose.Types.ObjectId,
      ref: "Profile",
    },
    addresses: [
      {
        type: mongoose.Types.ObjectId,
        ref: "Address",
      },
    ],
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role",
      },
    ],
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      },
    ],
    reviews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
      },
    ],
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
    loginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    loginExpires: {
      type: Date,
      select: false,
    },
    lastLoginAttempt: {
      type: Date,
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
      select: false,
    },
    phoneVerificationToken: {
      type: String,
      select: false,
    },
    phoneVerificationExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  }
);

userSchema.index({ createdAt: -1 });

userSchema.pre("save", async function (next) {
  // Skip if phone is not modified or it's a new document
  if (!this.isModified("phone") || this.isNew) {
    return next();
  }

  // Store the new phone number in newPhone
  this.newPhone = this.phone;
  // Revert phone to the original value
  this.phone = this.previousPhone;
  // Set isVerified to false
  this.isVerified = false;

  // Set expiration for newPhone
  setTimeout(async () => {
    try {
      if (this.newPhone) {
        // If newPhone still exists after 15 mins, remove it
        await User.findByIdAndUpdate(this._id, {
          $unset: { newPhone: 1 },
        });
      }
    } catch (error) {
      console.error("Error clearing newPhone:", error);
    }
  }, 15 * 60 * 1000); // 15 minutes

  next();
});

// Add this method to handle successful verification
userSchema.methods.confirmPhoneChange = async function (): Promise<void> {
  if (this.newPhone && this.isVerified) {
    // Store current phone as previous
    this.previousPhone = this.phone;
    // Update main phone number
    this.phone = this.newPhone;
    // Clear alternate phone
    this.newPhone = undefined;
    await this.save();
  }
};

userSchema.pre("save", async function (next) {
  if (!this.isNew) return next();

  const session = this.$session();
  if (!session) return next(new Error("Transaction session not found"));

  try {
    // Create profile with the same _id as user document
    await Profile.create([{ _id: this._id }], { session });

    // Only add default user role if no roles are assigned
    if (!this.roles || this.roles.length === 0) {
      // Find or create default user role
      const defaultRole = await Role.findOne({
        name: "user",
        isDefault: true,
      }).session(session);

      if (!defaultRole) {
        // Create default user role with basic permissions
        const newRole = await Role.create(
          [
            {
              name: "user",
              description: "Default user role with basic permissions",
              isDefault: true,
              users: [this.id],
            },
          ],
          { session }
        );

        // Create basic permissions for the user role
        const userPermissions = await Permission.create(
          defaultUserPermissions.map((permission) => ({
            ...permission,
            roles: [newRole[0]._id],
          })),
          { session }
        );

        // Add permissions to role
        newRole[0].permissions = userPermissions.map((p) => p._id);
        await newRole[0].save({ session });

        // Add role and permissions to user
        this.roles.push(newRole[0]._id as mongoose.Types.ObjectId);
        this.permissions.push(
          ...userPermissions.map((p) => p._id as mongoose.Types.ObjectId)
        );
      } else {
        // Add existing default role to user
        this.roles.push(defaultRole._id as mongoose.Types.ObjectId);
        this.permissions.push(
          ...(defaultRole.permissions as mongoose.Types.ObjectId[])
        );

        // Add user to role's users array
        defaultRole.users.push(this.id);
        await defaultRole.save({ session });
      }
    }

    // Set the profile field in the user document
    this.profile = this._id as mongoose.Types.ObjectId;

    // when user is created prev and active must be the same
    this.previousPhone = this.phone;

    next();
  } catch (error: unknown) {
    next(error as Error);
  }
});

// Method to create a phone verification token
userSchema.methods.createPhoneVerificationToken = function (): string {
  // Generate a 6-digit verification code
  let verificationCode: string;
  if (process.env.NODE_ENV !== "production") {
    verificationCode = "123456";
  } else {
    verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  }
  this.phoneVerificationToken = crypto
    .createHash("sha256")
    .update(verificationCode)
    .digest("hex");
  this.phoneVerificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry
  return verificationCode;
};

// Method to check login attempts and lockout
userSchema.methods.checkLogin = function (): boolean {
  const now = Date.now();

  if (
    this.lastLoginAttempt &&
    now - this.lastLoginAttempt.getTime() <= 60 * 1000
  ) {
    if (this.loginAttempts < 10) {
      this.loginAttempts += 1;
      this.lastLoginAttempt = new Date(now);
      return true;
    } else {
      this.loginExpires = new Date(now + 60 * 60 * 1000);
      return false;
    }
  } else {
    if (this.loginExpires && this.loginExpires > now) {
      return false;
    }
    this.loginExpires = undefined;
    this.loginAttempts = 1;
    this.lastLoginAttempt = new Date(now);
    return true;
  }
};

// Create and export the User model
const User = mongoose.model<IUser, Model<IUser>>("User", userSchema);

export default User;
