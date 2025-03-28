import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import compression from "compression";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/errorHandler";
import { defaultRateLimiter, authRateLimiter } from "./middleware/rateLimiter";
import AppError from "./utils/error";
import {
  adminRouter,
  cartRouter,
  orderRouter,
  productRouter,
  reviewRouter,
  userRouter,
  likeRouter
} from "./routes";
import sanitizeInput from "./utils/snitize-input";
import logger from "./utils/logger";
import cloudinaryConfig from "./utils/cloudinary-config";
import { ValidatedEnv } from "./config/env.config";

declare global {
  namespace Express {
    interface Request {
      env: ValidatedEnv;
    }
  }
}

const app: express.Application = express();

// Trust proxy for rate limiting behind reverse proxy
app.set("trust proxy", 3);

// Security middleware
app.use(helmet());
app.use(cors());

// Request logging
app.use(
  morgan(
    (tokens: { [key: string]: any }, req, res) => {
      return JSON.stringify({
        remoteAddr: tokens["remote-addr"](req, res),
        date: tokens["date"](req, res, "clf"),
        method: tokens["method"](req, res),
        url: tokens["url"](req, res),
        httpVersion: tokens["http-version"](req, res),
        status: tokens["status"](req, res),
        contentLength: tokens["res"](req, res, "content-length"),
        referrer: tokens["referrer"](req, res),
        userAgent: tokens["user-agent"](req, res),
        responseTime: tokens["response-time"](req, res),
      });
    },
    {
      stream: {
        write: (message) => logger.info(JSON.parse(message)),
      },
    }
  )
);

// Data sanitization
app.use(mongoSanitize());
app.use(sanitizeInput);
app.use(hpp());

// Rate limiting
app.use("/api", defaultRateLimiter);
app.use("/api/v1/users/login", authRateLimiter);
app.use("/api/v1/users/register", authRateLimiter);

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(cookieParser());

// Cloudinary configuration
cloudinaryConfig();

// Add validated env to request object
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.env = req.app.get("env");
  next();
});

// Routes
app.get("/", (_req: Request, res: Response) => {
  res.send("<h1>Welcome To E-Buy API</h1>");
});

app.use("/api/v1/users", userRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/reviews", reviewRouter);
app.use("/api/v1/like", likeRouter)
app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/orders", orderRouter);
app.use("/api/v1/admin", adminRouter);

// 404 handler
app.all("*", (req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

// Global error handler
app.use(errorHandler);

export default app;
