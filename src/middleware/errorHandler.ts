import { Request, Response, NextFunction } from "express";
import AppError from "../utils/error";
import logger from "../utils/logger";

const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    logger.error({
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode,
    });

    res.status(err.statusCode).json({
      status: "error",
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
    return;
  }

  logger.error({
    message: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    status: "error",
    message: "Something went wrong!",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

export { errorHandler };
