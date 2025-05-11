import { NextFunction, Request, Response, Express } from "express";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { v4 as uuidv4 } from "uuid";
import Product, { IProduct } from "../../models/product/product";
import Uploader from "../../utils/uploader";
import BaseController from "../helpers/base";
import AppError from "../../utils/error";
import sharp from "sharp";
import uploadImage from "../../utils/cloudinary-controller";
import { MulterError } from "multer";

interface RequestWithFiles extends Request {
  files?: {
    images?: Express.Multer.File[];
    ogImage?: Express.Multer.File[];
  };
}

class ProductController extends BaseController<IProduct> {
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
    super(Product);
    this.uploader = new Uploader();
    this.upload = this.uploader.upload.fields([
      { name: "images", maxCount: 8 },
      { name: "ogImage", maxCount: 1 },
    ]);
  }

  createProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      delete req.body.ratingsQuantity;
      delete req.body.ratingsAverage;
      delete req.body.isArchived;
      // Set the user ID from the authenticated user
      req.body.owner = req.user.id;

      return await this.createOne()(req, res, next);
    } catch (error) {
      next(error);
    }
  };

  getProducts = this.getAll(undefined, undefined, true); // enabling search to accept search text query
  getProduct = this.getOne();

  updateProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      delete req.body.ratingsQuantity;
      delete req.body.ratingsAverage;

      return await this.updateOne()(req, res, next);
    } catch (error) {
      next(error);
    }
  };

  toggleArchiveProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const product = await Product.findById(req.params.id);

      if (!product) {
        return next(new AppError("product not found", 404));
      }

      product.isArchived = !product.isArchived;

      await product.save();

      res.status(200).json({
        message: `product is ${
          product.isArchived ? "archived" : "published"
        } now`,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return next(new AppError("No product found with that ID", 404));
      }

      // Delete images from Cloudinary
      await Promise.all(
        [...product.images, product.ogImage].map(async (imgUrl: string) => {
          const publicIdMatch = imgUrl.match(/upload\/(?:v\d+\/)?([^\\.]+)/);
          if (publicIdMatch) {
            const publicIdToDelete = publicIdMatch[1];
            // Delete image from Cloudinary
            await cloudinary.uploader.destroy(publicIdToDelete as string);
          }
        })
      );

      return await this.deleteOne()(req, res, next);
    } catch (error) {
      next(error);
    }
  };

  uploadProductImages = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
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

  resizeProductImages = async (
    req: RequestWithFiles,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.body.publicId || uuidv4();

      // Handle main product images
      if (req.files?.images) {
        const imageFiles = req.files.images;

        await Promise.all(
          imageFiles.map(async (file: Express.Multer.File, i: number) => {
            const filename = `product-${id}-${i + 1}`;
            const resizedBuffer = await sharp(file.buffer)
              .resize(1000, 1000, {
                fit: "cover",
                position: "center",
              })
              .toFormat("jpeg")
              .jpeg({ quality: 90 })
              .toBuffer();

            this.assigneFileToReq(
              req,
              file,
              filename,
              "images",
              resizedBuffer,
              i
            );
          })
        );
      }

      // Handle ogImage
      if (req.files?.ogImage) {
        const ogImageFile = req.files.ogImage[0];
        const filename = `product-${id}-og`;
        const resizedBuffer = await sharp(ogImageFile.buffer)
          .resize(1200, 630, {
            // Standard OG image dimensions
            fit: "cover",
            position: "center",
          })
          .toFormat("jpeg")
          .jpeg({ quality: 90 })
          .toBuffer();
        this.assigneFileToReq(
          req,
          ogImageFile,
          filename,
          "ogImage",
          resizedBuffer
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
  private assigneFileToReq = (
    req: RequestWithFiles,
    file: Express.Multer.File,
    filename: string,
    reqFileName: string,
    resizedBuffer?: Buffer,
    count: number = 0
  ): void => {
    const modifiedFile = {
      ...file,
      buffer: resizedBuffer ? resizedBuffer : file.buffer,
      filename,
    };

    (req.files as { [reqFileName]: Express.Multer.File[] })[reqFileName][
      count
    ] = modifiedFile;
  };

  // Cloudinary Upload
  handleProductImagesUpload = async (
    req: RequestWithFiles,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.files) return next();
    // delete at first to set the real one if req.body is poluted
    delete req.body.cloudinaryPublicId;

    try {
      const newImages: string[] = [];
      const newPublicIds: string[] = [];
      const oldImages = req.body.images || []; // Existing images from database
      let newOgImage: string | undefined;

      // Handle main product images
      if (req.files.images && req.files.images.length > 0) {
        await Promise.all(
          req.files.images.map(async (image: Express.Multer.File) => {
            const { secure_url, public_id } = (await uploadImage(
              image,
              "e-commerce/products"
            )) as UploadApiResponse;

            newImages.push(secure_url);
            newPublicIds.push(public_id);
          })
        );
      }

      // Handle ogImage
      if (req.files.ogImage && req.files.ogImage.length > 0) {
        const ogImageFile = req.files.ogImage[0];
        const { secure_url } = (await uploadImage(
          ogImageFile,
          "e-commerce/product-ogs"
        )) as UploadApiResponse;

        newOgImage = secure_url;
      }

      // Delete old images from Cloudinary that are not in newPublicIds
      const imagesToDelete = oldImages.filter((img: string) => {
        const publicIdMatch = img.match(/upload\/(?:v\d+\/)?([^\\.]+)/);
        const existingPublicId = publicIdMatch ? publicIdMatch[1] : null;
        return existingPublicId && !newPublicIds.includes(existingPublicId);
      });

      // Delete old ogImage if it exists and is being replaced
      if (req.body.ogImage && newOgImage) {
        const oldOgImageMatch = req.body.ogImage.match(
          /upload\/(?:v\d+\/)?([^\\.]+)/
        );
        if (oldOgImageMatch) {
          await cloudinary.uploader.destroy(oldOgImageMatch[1]);
        }
      }
      if (imagesToDelete.length > 0) {
        await Promise.all(
          imagesToDelete.map(async (imgUrl: string) => {
            const publicIdMatch = imgUrl.match(/upload\/(?:v\d+\/)?([^\\.]+)/);
            const publicIdToDelete = publicIdMatch ? publicIdMatch[1] : null;
            if (publicIdToDelete) {
              await cloudinary.uploader.destroy(publicIdToDelete);
            }
          })
        );
      }

      // Update req.body with new images and publicIds
      if (newImages.length > 0) {
        req.body.images = newImages;
      }
      if (newOgImage) {
        req.body.ogImage = newOgImage;
      }

      const regex =
        /[0-9A-Za-z]{8}-[0-9A-Za-z]{4}-4[0-9A-Za-z]{3}-[89ABab][0-9A-Za-z]{3}-[0-9A-Za-z]{12}/;

      if (newPublicIds.length > 0) {
        // Use regex.exec to extract the UUID and assign it to the public id in DB
        req.body.cloudinaryPublicId = (
          regex.exec(newPublicIds[0]) as unknown as string
        )[0];
      }

      next();
    } catch (error) {
      next(error);
    }
  };

  // this middleware will check if the product exist in case of creating and get the product id in case of updating
  // so we can use it on the image name
  checkProduct = async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // If it's a POST request (creating a new product), return an error as the tour already exists
      if (req.method === "POST") {
        const product = await Product.findOne({ name: req.body.name });
        if (product)
          return next(
            new AppError("A product with this name already exists.", 400)
          );
      }

      if (["PUT", "PATCH"].includes(req.method)) {
        const product = await Product.findById(req.params.id);

        if (!product) {
          return next(new AppError("Product not found.", 404));
        }

        req.body.publicId = product.cloudinaryPublicId;

        // Handle image deletion
        if (req.body.deleteImages) {
          const deleteImages =
            typeof req.body.deleteImages === "string"
              ? JSON.parse(req.body.deleteImages)
              : req.body.deleteImages;

          if (Array.isArray(deleteImages) && deleteImages.length > 0) {
            const imagesToDelete = product.images.filter((img) =>
              deleteImages.includes(img)
            );

            await Promise.all(
              imagesToDelete.map(async (imgUrl: string) => {
                const publicIdMatch = imgUrl.match(
                  /upload\/(?:v\d+\/)?([^\\.]+)/
                );
                if (publicIdMatch) {
                  await cloudinary.uploader.destroy(publicIdMatch[1]);
                }
              })
            );

            product.images = product.images.filter(
              (img) => !deleteImages.includes(img)
            );
          }
        }

        // Handle image reordering
        if (req.body.reorderImages) {
          const reorderImages =
            typeof req.body.reorderImages === "string"
              ? JSON.parse(req.body.reorderImages)
              : req.body.reorderImages;

          if (Array.isArray(reorderImages) && reorderImages.length > 0) {
            // Validate that all images in reorderImages exist in product.images
            const validImages = reorderImages.every((img: string) =>
              product.images.includes(img)
            );

            if (!validImages) {
              return next(
                new AppError("Invalid image URLs in reorderImages array", 400)
              );
            }

            // Reorder images according to the provided order
            product.images = reorderImages;
          }
        }

        req.body.images = product.images;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export default ProductController;
