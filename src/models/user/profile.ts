import mongoose, { Document, Model, Schema } from "mongoose";

export interface IProfile extends Document {
  bio?: string;
  photo?: string;
  dateOfBirth?: Date;
  gender?: string;
  occupation?: string;
  website?: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
  };
  interests?: string[];
  location?: {
    country?: string;
    city?: string;
  };
  lastActive?: Date;
  settings?: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    language: string;
    timezone: string;
  };
}

const profileSchema: Schema<IProfile> = new mongoose.Schema(
  {
    bio: {
      type: String,
      trim: true,
      maxlength: [500, "Bio cannot be longer than 500 characters"],
    },
    photo: {
      type: String,
      default:
        "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg",
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
    },
    occupation: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
      validate: {
        validator: function (v: string): boolean {
          return /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(
            v
          );
        },
        message: "Please enter a valid URL",
      },
    },
    socialLinks: {
      facebook: String,
      twitter: String,
      linkedin: String,
      instagram: String,
    },
    interests: [String],
    location: {
      country: String,
      city: String,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    settings: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      smsNotifications: {
        type: Boolean,
        default: true,
      },
      language: {
        type: String,
        default: "en",
      },
      timezone: {
        type: String,
        default: "UTC",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Update lastActive timestamp on profile access
profileSchema.pre("save", function (next) {
  this.lastActive = new Date();
  next();
});

// Create indexes for better query performance
profileSchema.index({ lastActive: -1 });
profileSchema.index({ "location.country": 1, "location.city": 1 });

const Profile: Model<IProfile> = mongoose.model<IProfile>(
  "Profile",
  profileSchema
);

export default Profile;
