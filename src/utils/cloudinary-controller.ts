import { Express } from "express";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import { UploadApiResponse } from "cloudinary";

const uploadImage = async (
  file: Express.Request["file"], // image
  folder: string //  e-commerce/products
): Promise<UploadApiResponse | undefined> => {
  if (!file) {
    throw new Error("No file provided");
  }
  try {
    return new Promise((resolve, reject) => {
      const readableStream = new Readable();
      readableStream.push(file.buffer);
      readableStream.push(null);

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "auto", // Use "auto" to automatically detect the type
          public_id: file.filename, // Use filename as public_id
        },
        (error, result) => {
          if (error) {
            reject(`Image upload failed: ${error}`);
          } else {
            resolve(result);
          }
        }
      );

      readableStream.pipe(uploadStream);
    });
  } catch (error) {
    throw new Error(
      `Upload failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

export default uploadImage;
