import { cleanEnv, str, port, email, url, num, bool } from "envalid";

export type ValidatedEnv = {
  NODE_ENV: string;
  PORT: number;
  MONGO_URI: string;
  HASH_SALT: number;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  ZARINPAL_MERCHANT_ID: string;
  ZARINPAL_IS_SANDBOX: boolean;
  MELIPAYAMAK_USERNAME: string;
  MELIPAYAMAK_PASSWORD: string;
  MELIPAYAMAK_NUMBER: string;
  SUPER_ADMIN_USERNAME: string;
  SUPER_ADMIN_FIRST_NAME: string;
  SUPER_ADMIN_LAST_NAME: string;
  SUPER_ADMIN_EMAIL: string;
  SUPER_ADMIN_PHONE: string;
  SUPER_ADMIN_PASSWORD: string;
  ADMIN_USERNAME: string;
  ADMIN_FIRST_NAME: string;
  ADMIN_LAST_NAME: string;
  ADMIN_EMAIL: string;
  ADMIN_PHONE: string;
  ADMIN_PASSWORD: string;
  MAX_FILE_SIZE: number;
  FILE_UPLOAD_PATH: string;
};

export const validateEnv = (): ValidatedEnv => {
  return cleanEnv(process.env, {
    // Server Configuration
    NODE_ENV: str({ choices: ["development", "production", "test"] }),
    PORT: port({ default: 5000 }),

    // Database Configuration
    MONGO_URI: url(),

    // JWT Configuration
    HASH_SALT: num(),
    // JWT Tokens
    JWT_SECRET: str(),
    JWT_REFRESH_SECRET: str(),
    JWT_ACCESS_EXPIRES_IN: str(),
    JWT_REFRESH_EXPIRES_IN: str(),

    // Cloudinary Configuration
    CLOUDINARY_CLOUD_NAME: str(),
    CLOUDINARY_API_KEY: str(),
    CLOUDINARY_API_SECRET: str(),

    // Zarinpal Configuration
    ZARINPAL_MERCHANT_ID: str(),
    ZARINPAL_IS_SANDBOX: bool({ default: true }),

    // SMS Configuration (Melipayamak)
    MELIPAYAMAK_USERNAME: str(),
    MELIPAYAMAK_PASSWORD: str(),
    MELIPAYAMAK_NUMBER: str(),

    // Super Admin Configuration
    SUPER_ADMIN_USERNAME: str(),
    SUPER_ADMIN_FIRST_NAME: str(),
    SUPER_ADMIN_LAST_NAME: str(),
    SUPER_ADMIN_EMAIL: email(),
    SUPER_ADMIN_PHONE: str(),
    SUPER_ADMIN_PASSWORD: str(),

    // Admin Configuration
    ADMIN_USERNAME: str(),
    ADMIN_FIRST_NAME: str(),
    ADMIN_LAST_NAME: str(),
    ADMIN_EMAIL: email(),
    ADMIN_PHONE: str(),
    ADMIN_PASSWORD: str(),

    // File Upload Configuration
    MAX_FILE_SIZE: num({ default: 5000000 }),
    FILE_UPLOAD_PATH: str({ default: "./public/uploads" }),
  });
};
