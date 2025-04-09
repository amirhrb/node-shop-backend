import { Request, Response } from "express";
import CartController from "../controllers/cart";
import Cart from "../models/cart";
import Product from "../models/product/product";

// Set test environment
process.env.NODE_ENV = "test";

// Mock Cart model
jest.mock("../models/cart", () => {
  return {
    findOne: jest.fn(),
    findById: jest.fn(),
    calcTotalPrice: jest.fn(),
  };
});

// Mock Product model
jest.mock("../models/product/product", () => {
  return {
    findById: jest.fn(),
  };
});

// Mock BaseController methods
jest.mock("../controllers/helpers/base", () => {
  return class MockBaseController {
    constructor() {}
    createOne() {
      return jest.fn().mockImplementation((req, res) => {
        res.status(201).json({
          status: "success",
          data: {
            data: { ...req.body, _id: "new-cart-item-id" },
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
    deleteOne() {
      return jest.fn().mockImplementation((req, res) => {
        res.status(204).json({
          status: "success",
          data: null,
        });
      });
    }
    getAll(additionalData = {}) {
      return jest.fn().mockImplementation((req, res) => {
        res.status(200).json({
          status: "success",
          data: {
            data: [
              {
                _id: "cart-item-1",
                product: "product-1",
                quantity: 2,
                price: 100,
              },
              {
                _id: "cart-item-2",
                product: "product-2",
                quantity: 1,
                price: 200,
              },
            ],
            ...additionalData,
          },
        });
      });
    }
  };
});

describe("Cart Controller", () => {
  let cartController: CartController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    cartController = new CartController();
    mockNext = jest.fn();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockReq = {
      user: { id: "user-123" },
      body: {},
      params: {},
      query: {},
    };

    // Override the deleteOne method for specific tests
    (cartController as any).deleteOne = jest.fn().mockImplementation(() => {
      return (req: Request, res: Response) => {
        res.status(204).json({
          status: "success",
          data: null,
        });
      };
    });
  });

  describe("addOrUpdateCartItem", () => {
    it("should add a new item to the cart", async () => {
      // Setup
      mockReq.body = {
        product: "product-123",
        quantity: 2,
      };

      // Mock Product.findById to return a product
      (Product.findById as jest.Mock).mockResolvedValue({
        _id: "product-123",
        price: 100,
        stockQuantity: 10,
      });

      // Mock Cart.findOne to return null (item not in cart)
      (Cart.findOne as jest.Mock).mockResolvedValue(null);

      // Execute
      await cartController.addOrUpdateCartItem(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Assert
      expect(Product.findById).toHaveBeenCalledWith("product-123");
      expect(Cart.findOne).toHaveBeenCalledWith({
        product: "product-123",
        user: "user-123",
      });
      expect(mockReq.body.price).toBe(100);
      expect(mockReq.body.user).toBe("user-123");
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: {
          data: {
            _id: "new-cart-item-id",
            product: "product-123",
            quantity: 2,
            price: 100,
            user: "user-123",
          },
        },
      });
    });

    it("should update an existing cart item", async () => {
      // Setup
      mockReq.body = {
        product: "product-123",
        quantity: 2,
      };

      // Mock Product.findById to return a product
      (Product.findById as jest.Mock).mockResolvedValue({
        _id: "product-123",
        price: 100,
        stockQuantity: 10,
      });

      // Mock Cart.findOne to return an existing cart item
      (Cart.findOne as jest.Mock).mockResolvedValue({
        _id: "existing-cart-item",
        product: "product-123",
        user: "user-123",
        quantity: 3,
        price: 100,
      });

      // Execute
      await cartController.addOrUpdateCartItem(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Assert
      expect(Product.findById).toHaveBeenCalledWith("product-123");
      expect(Cart.findOne).toHaveBeenCalledWith({
        product: "product-123",
        user: "user-123",
      });
      expect(mockReq.params!.id).toBe("existing-cart-item");
      expect(mockReq.body.quantity).toBe(5); // 3 + 2
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          data: expect.objectContaining({
            data: expect.objectContaining({
              _id: "existing-cart-item",
              quantity: 5,
            }),
          }),
        })
      );
    });

    it("should return error if product not found", async () => {
      // Setup
      mockReq.body = {
        product: "nonexistent-product",
        quantity: 2,
      };

      // Mock Product.findById to return null
      (Product.findById as jest.Mock).mockResolvedValue(null);

      // Execute
      await cartController.addOrUpdateCartItem(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Assert
      expect(Product.findById).toHaveBeenCalledWith("nonexistent-product");
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "There is no product with that id",
          statusCode: 400,
        })
      );
    });

    it("should return error if quantity exceeds stock", async () => {
      // Setup
      mockReq.body = {
        product: "product-123",
        quantity: 20, // More than stock
      };

      // Mock Product.findById to return a product with limited stock
      (Product.findById as jest.Mock).mockResolvedValue({
        _id: "product-123",
        price: 100,
        stockQuantity: 10,
      });

      // Execute
      await cartController.addOrUpdateCartItem(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Assert
      expect(Product.findById).toHaveBeenCalledWith("product-123");
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Not enough stock",
          statusCode: 400,
        })
      );
    });
  });

  describe("getCartList", () => {
    it("should return cart items with total price", async () => {
      // Setup
      mockReq.user = {
        id: "user-123",
      };

      // Mock Cart.calcTotalPrice to return a total
      (Cart.calcTotalPrice as jest.Mock).mockResolvedValue(400);

      // Execute
      await cartController.getCartList(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Assert
      expect(Cart.calcTotalPrice).toHaveBeenCalledWith("user-123");
      expect(mockReq.query!.user).toEqual({ id: "user-123" });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "success",
        data: {
          data: [
            {
              _id: "cart-item-1",
              product: "product-1",
              quantity: 2,
              price: 100,
            },
            {
              _id: "cart-item-2",
              product: "product-2",
              quantity: 1,
              price: 200,
            },
          ],
          totalPrice: 400,
        },
      });
    });
  });
});
