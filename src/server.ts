import mongoose from "mongoose";
import app from "./app";
import dotenv from "dotenv";
import { checkAndSeedProductionDB } from "./seed/populate-db";
import { Server, IncomingMessage, ServerResponse } from "http";
import logger from "./utils/logger";

// 1. Load .env file (base settings)
dotenv.config();
console.log("Loaded .env file");

// Load environment variables in order of priority
const nodeEnv = process.env.NODE_ENV || "development";

// 2. Load environment specific file (.env.development, .env.test, etc)
const envFile = `.env.${nodeEnv}`;
dotenv.config({ path: envFile });
console.log(`Loaded environment specific file: ${envFile}`);

// 3. Load local override file (.env.development.local, .env.test.local, etc)
const localEnvFile = `${envFile}.local`;
dotenv.config({ path: localEnvFile });
console.log(`Loaded local override file: ${localEnvFile} (if exists)`);

let server: Server<typeof IncomingMessage, typeof ServerResponse>;

const startServer = async (): Promise<void> => {
  try {
    // Connect to the Database
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("Connected to the Database");

    // In production, check and seed the database if empty
    if (process.env.NODE_ENV === "production") {
      await checkAndSeedProductionDB();
    }

    // Start the server
    const port = process.env.PORT;
    server = app.listen(port, () => {
      console.log(
        `${(
          process.env.NODE_ENV as string
        ).toUpperCase()} server is running on http://localhost:${port}`
      );
    });

    // Process handlers for uncaught exceptions and unhandled rejections
    process.on("uncaughtException", (err) => {
      logger.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
      logger.error(`Error ${err.name}: ${err.message}`);

      if (process.env.NODE_ENV === "production") {
        // For uncaught exceptions, exit immediately as the app state is undefined
        process.exit(1);
      }
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (err: Error) => {
      logger.error("UNHANDLED REJECTION! 💥 Shutting down...");
      logger.error(`Error ${err.name}: ${err.message}`);

      if (process.env.NODE_ENV === "production") {
        // For unhandled rejections, try to close the server gracefully first
        server.close(() => {
          process.exit(1);
        });
      }
    });
  } catch (error) {
    logger.error("Error starting server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();
