import { MongooseError, Error as MongooseValidationError } from "mongoose";
import logger from "./logger";

export enum ErrorType {
  VALIDATION = "ValidationError",
  DUPLICATE = "DuplicateError",
  AUTHENTICATION = "AuthenticationError",
  AUTHORIZATION = "AuthorizationError",
  NOT_FOUND = "NotFoundError",
  PAYMENT = "PaymentError",
  INTERNAL = "InternalError",
}

interface ErrorDetails {
  field?: string;
  message: string;
  value?: string | number | boolean | null | undefined;
}

interface ZarinpalError {
  statusCode?: number;
  message?: string;
  code?: number;
}

interface MongoDBDuplicateKeyError extends MongooseError {
  code: number;
  keyPattern: Record<string, unknown>;
}

class AppError extends Error {
  public statusCode: number;
  public status: string;
  public isOperational: boolean;
  public type: ErrorType;
  public details: ErrorDetails[];

  constructor(
    message: string,
    statusCode: number,
    type: ErrorType = ErrorType.INTERNAL
  ) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.type = type;
    this.details = [{ message }];
    Error.captureStackTrace(this, this.constructor);
  }

  private logError(): void {
    logger.error({
      type: this.type,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      stack: this.stack,
    });
  }

  public static handleMongooseError(error: MongooseError): AppError {
    if (error.name === "ValidationError") {
      const validationError =
        error as unknown as MongooseValidationError.ValidationError;
      const details = Object.values(validationError.errors).map(
        (err: unknown) => {
          const validErr = err as MongooseValidationError.ValidatorError;
          return {
            field: validErr.path,
            message: validErr.message,
            value: validErr.value,
          };
        }
      );

      const appError = new AppError(
        "Validation Error",
        400,
        ErrorType.VALIDATION
      );
      appError.details = details;
      return appError;
    }
    if ((error as MongoDBDuplicateKeyError).code === 11000) {
      const duplicateError = error as MongoDBDuplicateKeyError;
      const field = Object.keys(duplicateError.keyPattern)[0];
      const appError = new AppError(
        `Duplicate field value: ${field}. Please use another value.`,
        400,
        ErrorType.DUPLICATE
      );
      appError.details = [{ field, message: `${field} already exists` }];
      return appError;
    }

    return new AppError("Something went wrong", 500);
  }

  public static handleZarinpalError(error: ZarinpalError): AppError {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Payment processing failed";

    const paymentError = new AppError(message, statusCode, ErrorType.PAYMENT);
    paymentError.details = [
      {
        message: message,
        ...(error.code && { field: "code", value: error.code }),
      },
    ];

    return paymentError;
  }

  public static notFound(resource: string): AppError {
    return new AppError(`${resource} not found`, 404, ErrorType.NOT_FOUND);
  }

  public static unauthorized(message = "Unauthorized access"): AppError {
    return new AppError(message, 401, ErrorType.AUTHENTICATION);
  }

  public static forbidden(message = "Forbidden access"): AppError {
    return new AppError(message, 403, ErrorType.AUTHORIZATION);
  }

  public static badRequest(message: string, field?: string): AppError {
    const error = new AppError(message, 400);
    if (field) {
      error.details = [{ field, message }];
    }
    return error;
  }
}

export default AppError;
