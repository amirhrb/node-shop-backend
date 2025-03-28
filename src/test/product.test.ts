import { Request, Response } from "express";
import ProductController from "../controllers/product/product";
import Product from "../models/product/product";
import AppError from "../utils/error";
import uploadImage from "../utils/cloudinary-controller";
import { Express } from "express";

// Set test environment
process.env.NODE_ENV = "test";

// Mock cloudinary-controller
jest.mock("../utils/cloudinary-controller", () => {
  return jest.fn().mockImplementation(() => {
    return Promise.resolve({
      secure_url: "https://res.cloudinary.com/test/image/upload/test-image.jpg",
      public_id: "test-public-id",
    });
  });
});

// Mock Product model
jest.mock("../models/product/product", () => {
  return {
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
  };
});

// Mock BaseController methods
jest.mock("../controllers/helpers/base", () => {
  return class MockBaseController {
    constructor() {}
    createOne(excludeFields = []) {
      return jest.fn().mockImplementation((req, res) => {
        res.status(201).json({
          status: "success",
          data: {
            data: { _id: "new-product-id", ...req.body },
          },
        });
      });
    }
    updateOne() {
      return jest.fn().mockImplementation((req, res) => {
        res.status(200).json({
          status: "success",
          data: {
            data: { _id: req.params.id, ...req.body },
          },
        });
      });
    }
    getOne() {
      return jest.fn().mockImplementation((req, res) => {
        res.status(200).json({
          status: "success",
          data: {
            data: {
              _id: req.params.id,
              name: "Test Product",
              price: 100,
              description: "Test description",
              stockQuantity: 10,
            },
          },
        });
      });
    }
    getAll() {
      return jest.fn().mockImplementation((req, res) => {
        res.status(200).json({
          status: "success",
          results: 2,
          data: {
            data: [
              {
                _id: "product-1",
                name: "Product 1",
                price: 100,
                stockQuantity: 10,
              },
              {
                _id: "product-2",
                name: "Product 2",
                price: 200,
                stockQuantity: 5,
              },
            ],
          },
        });
      });
    }
  };
});

// Mock Uploader
jest.mock("../utils/uploader", () => {
  return class MockUploader {
    upload = {
      fields: jest
        .fn()
        .mockReturnValue((req: Request, res: Response, next: Function) => {
          next();
        }),
    };
  };
});

// Mock sharp
jest.mock("sharp", () => {
  return jest.fn().mockImplementation(() => {
    return {
      resize: jest.fn().mockReturnThis(),
      toFormat: jest.fn().mockReturnThis(),
      jpeg: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue(Buffer.from("test-buffer")),
    };
  });
});

describe("Product Controller", () => {
  let productController: ProductController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    productController = new ProductController();
    mockNext = jest.fn();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockReq = {
      body: {},
      params: {},
      query: {},
      files: {},
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe("createProduct", () => {
    it("should create a new product", async () => {
      // Setup
      mockReq.body = {
        name: "Test Product",
        price: 100,
        description: "Test description",
        category: "electronics",
        stockQuantity: 10,
        ratingsQuantity: 5, // Should be deleted
        ratingsAverage: 4.5, // Should be deleted
      };

      // Execute
      await productController.createProduct(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Assert
      expect(mockReq.body.ratingsQuantity).toBeUndefined();
      expect(mockReq.body.ratingsAverage).toBeUndefined();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: {
          data: {
            _id: "new-product-id",
            name: "Test Product",
            price: 100,
            description: "Test description",
            category: "electronics",
            stockQuantity: 10,
          },
        },
      });
    });
  });

  describe("updateProduct", () => {
    it("should update a product", async () => {
      // Setup
      mockReq.params = { id: "product-123" };
      mockReq.body = {
        price: 150,
        stockQuantity: 20,
        ratingsQuantity: 10, // Should be deleted
        ratingsAverage: 4.8, // Should be deleted
      };

      // Execute
      await productController.updateProduct(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Assert
      expect(mockReq.body.ratingsQuantity).toBeUndefined();
      expect(mockReq.body.ratingsAverage).toBeUndefined();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: {
          data: {
            _id: "product-123",
            price: 150,
            stockQuantity: 20,
          },
        },
      });
    });
  });

  describe("deleteProduct", () => {
    it.skip("should delete a product", async () => {
      // Setup
      mockReq.params = { id: "product-123" };

      // Mock Product.findById to return a product
      (Product.findById as jest.Mock).mockResolvedValue({
        _id: "product-123",
        cloudinaryPublicId: "test-public-id",
      });

      // Mock Product.findByIdAndDelete
      (Product.findByIdAndDelete as jest.Mock).mockResolvedValue({
        _id: "product-123",
      });

      // Execute
      await productController.deleteProduct(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Assert
      expect(Product.findById).toHaveBeenCalledWith("product-123");
      expect(Product.findByIdAndDelete).toHaveBeenCalledWith("product-123");
      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: null,
      });
    });

    it("should return error if product not found", async () => {
      // Setup
      mockReq.params = { id: "nonexistent-product" };

      // Mock Product.findById to return null
      (Product.findById as jest.Mock).mockResolvedValue(null);

      // Execute
      await productController.deleteProduct(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Assert
      expect(Product.findById).toHaveBeenCalledWith("nonexistent-product");
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "No product found with that ID",
          statusCode: 404,
        })
      );
    });
  });

  describe("handleProductImagesUpload", () => {
    it.skip("should upload product images", async () => {
      // Create a custom request with files property for testing
      const mockReqWithFiles = {
        ...mockReq,
        files: {
          images: [
            {
              buffer: Buffer.from("test-image-1"),
              filename: "test-image-1.jpg",
              fieldname: "images",
              originalname: "test-image-1.jpg",
              encoding: "7bit",
              mimetype: "image/jpeg",
              destination: "/tmp",
              path: "/tmp/test-image-1.jpg",
              size: 1024,
            },
            {
              buffer: Buffer.from("test-image-2"),
              filename: "test-image-2.jpg",
              fieldname: "images",
              originalname: "test-image-2.jpg",
              encoding: "7bit",
              mimetype: "image/jpeg",
              destination: "/tmp",
              path: "/tmp/test-image-2.jpg",
              size: 1024,
            },
          ],
        },
        body: {
          images: [] as string[],
          cloudinaryPublicId: "",
        },
      };

      // Execute
      await productController.handleProductImagesUpload(
        mockReqWithFiles as any,
        mockRes as Response,
        mockNext
      );

      // Assert
      expect(uploadImage).toHaveBeenCalledTimes(2);
      expect(mockReqWithFiles.body.images).toEqual([
        "https://res.cloudinary.com/test/image/upload/test-image.jpg",
        "https://res.cloudinary.com/test/image/upload/test-image.jpg",
      ]);
      expect(mockReqWithFiles.body.cloudinaryPublicId).toBe("test-public-id");
      expect(mockNext).toHaveBeenCalled();
    });

    it("should continue if no images are provided", async () => {
      // Setup
      const mockReqWithEmptyFiles = {
        ...mockReq,
        files: {},
        body: {},
      };

      // Execute
      await productController.handleProductImagesUpload(
        mockReqWithEmptyFiles as any,
        mockRes as Response,
        mockNext
      );

      // Assert
      expect(uploadImage).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("checkProduct", () => {
    it.skip("should check if product exists", async () => {
      // Setup
      mockReq.params = { id: "product-123" };

      // Mock Product.findById to return a product
      (Product.findById as jest.Mock).mockResolvedValue({
        _id: "product-123",
        name: "Test Product",
      });

      // Execute
      await productController.checkProduct(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Assert
      expect(Product.findById).toHaveBeenCalledWith("product-123");
      expect(mockNext).toHaveBeenCalled();
    });

    it.skip("should return error if product not found", async () => {
      // Setup
      mockReq.params = { id: "nonexistent-product" };

      // Mock Product.findById to return null
      (Product.findById as jest.Mock).mockResolvedValue(null);

      // Execute
      await productController.checkProduct(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Assert
      expect(Product.findById).toHaveBeenCalledWith("nonexistent-product");
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "No product found with that ID",
          statusCode: 404,
        })
      );
    });
  });
});
