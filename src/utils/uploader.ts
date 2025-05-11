import multer, { FileFilterCallback, Multer } from "multer";
import { Request } from "express";
import AppError from "./error";

class Uploader {
  public upload: Multer;
  private readonly multerStorage: multer.StorageEngine;
  private multerFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ): void => {
    if (file.mimetype.startsWith("image")) {
      cb(null, true);
    } else {
      cb(
        new AppError("Please upload only images", 400) as unknown as null,
        false
      );
    }
  };

  constructor() {
    try {
      this.multerStorage = multer.memoryStorage();
      this.upload = multer({
        storage: this.multerStorage,
        limits: {
          fileSize: 1024 * 1024 * 5, // 5MB
        },
        fileFilter: this.multerFilter,
      });
      console.log('Multer initialized successfully');
    } catch (error) {
      console.error('Multer initialization error:', error);
      throw new Error(`Failed to initialize multer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default Uploader;
