import { Request, Response, NextFunction } from "express";
import Profile, { IProfile } from "../../models/user/profile";
import BaseController from "../helpers/base";
import uploadImage from "../../utils/cloudinary-controller";
import sharp from "sharp";
import Uploader from "../../utils/uploader";
import { UploadApiResponse } from "cloudinary";
import AppError from "../../utils/error";
import { MulterError } from "multer";

class ProfileController extends BaseController<IProfile> {
  private uploader: Uploader;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private upload: any;
  private readonly errorCode = {
    LIMIT_PART_COUNT: "LIMIT_PART_COUNT",
    LIMIT_FILE_SIZE: "LIMIT_FILE_SIZE",
    LIMIT_FILE_COUNT: "LIMIT_FILE_COUNT",
    LIMIT_FIELD_KEY: "LIMIT_FIELD_KEY",
    LIMIT_FIELD_VALUE: "LIMIT_FIELD_VALUE",
    LIMIT_FIELD_COUNT: "LIMIT_FIELD_COUNT",
    LIMIT_UNEXPECTED_FILE: "LIMIT_UNEXPECTED_FILE",
  };

  constructor() {
    super(Profile);
    this.uploader = new Uploader();
    this.upload = this.uploader.upload.single("photo");
  }

  updateProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      req.params.id = req.user.id;
      return await this.updateOne()(req, res, next);
    } catch (error) {
      next(error);
    }
  };

  getProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      req.params.id = req.user.id;
      return await this.getOne()(req, res, next);
    } catch (error) {
      next(error);
    }
  };

  uploadUserPhoto = (req: Request, res: Response, next: NextFunction): void => {
    try {
      this.upload(req, res, (err: MulterError | null) => {
        if (err) {
          switch (err.code) {
            case this.errorCode.LIMIT_FILE_SIZE:
              return next(new AppError("File size is too large", 400));
            case this.errorCode.LIMIT_UNEXPECTED_FILE:
              return next(new AppError("Invalid file type", 400));
            case this.errorCode.LIMIT_FIELD_KEY:
              return next(
                new AppError(
                  'Invalid field name. Use "photo" as the field name for file upload',
                  400
                )
              );
            default:
              return next(
                new AppError(err.message || "Error uploading file", 400)
              );
          }
        }
        next();
      });
    } catch (error) {
      next(error);
    }
  };

  resizeUserPhoto = async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.file) return next();

    try {
      req.file.filename = `user-${req.user.id}-photo`;

      const resizedBuffer = await sharp(req.file.buffer)
        .resize(500, 500, {
          fit: "cover",
          position: "center",
        })
        .toFormat("jpeg")
        .jpeg({ quality: 90 })
        .toBuffer();

      req.file.buffer = resizedBuffer;

      next();
    } catch (error) {
      next(error);
    }
  };

  handleUploadUserImage = async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.file) {
      return next();
    }
    try {
      const { secure_url } = (await uploadImage(
        req.file,
        "e-buy/users"
      )) as UploadApiResponse;
      req.body.photo = secure_url;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export default ProfileController;
