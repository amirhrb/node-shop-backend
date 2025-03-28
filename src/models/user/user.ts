import crypto from "crypto";
import mongoose, { Document, Model, Schema } from "mongoose";
import validator from "validator";
import Profile from "./profile";
import Permission from "./permission";
import Role from "./role";

// Define IUser interface extending Document
export interface IUser extends Document {
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  roles: mongoose.Types.ObjectId[];
  permissions: mongoose.Types.ObjectId[];
  profile?: mongoose.Types.ObjectId;
  address?: string;
  active: boolean;
  loginAttempts?: number;
  isVerified: boolean;
  loginExpires?: Date;
  lastLoginAttempt: Date;
  phoneVerificationToken?: string;
  phoneVerificationExpires?: Date;
  createPhoneVerificationToken: () => string;
  checkLogin: () => boolean;
}

export interface IUserModel extends Model<IUser> {}

const userSchema: Schema<IUser> = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      required: [true, "Please provide a username"],
    },
    firstName: {
      type: String,
      required: [true, "User First Name is required"],
    },
    lastName: {
      type: String,
      required: [true, "User Last Name is required"],
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      validate: {
        validator: (value: string | undefined) => {
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
    profile: {
      type: mongoose.Types.ObjectId,
      ref: "Profile",
    },
    address: {
      type: mongoose.Types.ObjectId,
      ref: "Address",
    },
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
  const user = this;
  if (!user.isNew) return next();

  const session = user.$session(); // Get the current session
  if (!session) return next(new Error("Transaction session not found"));

  try {
    // Create profile with the same _id as user document
    await Profile.create([{ _id: user._id }], { session });

    // Only add default user role if no roles are assigned
    if (!user.roles || user.roles.length === 0) {
      // Create role and permission
      const role = await Role.findOne({ name: "user" }).session(session);
      if (!role) {
        const newRole = await Role.create(
          [{ name: "user", users: [user.id] }],
          {
            session,
          }
        );
        const newPermission = await Permission.create(
          [{ name: "user", roles: [newRole[0]._id] }],
          { session }
        );
        newRole[0].permissions.push(newPermission[0]._id);
        await newRole[0].save({ session });
        this.roles.push(newRole[0]._id as mongoose.Types.ObjectId);
        this.permissions.push(newPermission[0]._id as mongoose.Types.ObjectId);
      } else {
        const permission = await Permission.findOne({
          name: "user",
          roles: role._id,
        }).session(session);
        if (!permission) {
          const newPermission = await Permission.create(
            [{ name: "user", roles: [role._id] }],
            { session }
          );
          role.permissions.push(newPermission[0]._id);
          await role.save({ session });
          this.permissions.push(
            newPermission[0]._id as mongoose.Types.ObjectId
          );
        } else {
          this.permissions.push(permission._id as mongoose.Types.ObjectId);
        }
        role.users.push(user.id);
        await role.save({ session });
        this.roles.push(role._id as mongoose.Types.ObjectId);
      }
    }

    // Set the profile field in the user document
    this.profile = user._id as mongoose.Types.ObjectId;

    next();
  } catch (error: any) {
    next(error);
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
const User: IUserModel = mongoose.model<IUser, IUserModel>("User", userSchema);

export default User;
