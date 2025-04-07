// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Request } from "express";

declare module "express" {
  interface Request {
    user?: mongoose.Document<unknown, object, IUser> &
      IUser &
      Required<{ _id: unknown }> & { __v: number };
  }
}
