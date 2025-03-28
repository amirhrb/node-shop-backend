import mongoose, { Document, Model, Schema } from "mongoose";

export interface IToken extends Document {
  user: Schema.Types.ObjectId;
  refreshToken: string;
  clientFingerprint: {
    ip: string;
    userAgent: string;
  };
}

const tokensSchema: Schema<IToken> = new Schema<IToken>({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: [true, "UserId is required"],
  },
  refreshToken: {
    type: String,
    required: [true, "Refresh token is required"],
  },
  clientFingerprint: {
    ip: String,
    userAgent: String,
  },
});

// Pre-save middleware to ensure clientFingerprint is properly set
tokensSchema.pre("save", function (next) {
  if (
    !this.clientFingerprint ||
    !this.clientFingerprint.ip ||
    !this.clientFingerprint.userAgent
  ) {
    return next(new Error("Client fingerprint data is required"));
  }
  next();
});

tokensSchema.index({ user: 1 });
tokensSchema.index({ refreshToken: 1 });

const RefreshToken: Model<IToken> = mongoose.model<IToken>(
  "Token",
  tokensSchema
);

export default RefreshToken;
