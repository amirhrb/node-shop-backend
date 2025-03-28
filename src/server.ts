import mongoose from "mongoose";
import app from "./app";
import dotenv from "dotenv";
import { validateEnv } from "./config/env.config";
import { checkAndSeedProductionDB } from "./seed/populate-db";
import logger from "./utils/logger";

// Load environment variables in order of priority
const nodeEnv = process.env.NODE_ENV || "development";

// 1. Load .env file (base settings)
dotenv.config({ path: ".env" });
console.log("Loaded .env file");

// 2. Load environment specific file (.env.development, .env.test, etc)
const envFile = `.env.${nodeEnv}`;
dotenv.config({ path: envFile });
console.log(`Loaded environment specific file: ${envFile}`);

// 3. Load local override file (.env.development.local, .env.test.local, etc)
const localEnvFile = `${envFile}.local`;
dotenv.config({ path: localEnvFile });
console.log(`Loaded local override file: ${localEnvFile} (if exists)`);

// Validate environment variables
const env = validateEnv();
console.log(
  `Environment validated successfully. Running in ${env.NODE_ENV} mode`
);

let server: any;

const startServer = async () => {
  try {
    // Connect to the Database
    await mongoose.connect(env.MONGO_URI);
    console.log("Connected to the Database");

    // In production, check and seed the database if empty
    if (env.NODE_ENV === "production") {
      await checkAndSeedProductionDB();
    }

    // Start the server
    const port = env.PORT;
    server = app.listen(port, () => {
      console.log(
        `${env.NODE_ENV} server is running on http://localhost:${port}`
      );
    });

    // Handle any rejection in the entire application
    process.on("unhandledRejection", (error: Error) => {
      console.error("Unhandled Rejection:", error.message);
      shutDownServer();
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error: Error) => {
      console.error("Uncaught Exception:", error.message);
      shutDownServer();
    });
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
};

function shutDownServer() {
  console.error("Shutting down...");
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
}

// Start the server
startServer();
