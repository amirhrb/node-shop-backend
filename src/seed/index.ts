import populateDB from "./populate-db";
import logger from "../utils/logger";

const runSeed = async () => {
  try {
    await populateDB();
    logger.info("Seeding completed successfully");
  } catch (error) {
    logger.error("Error during seeding:", error);
    process.exit(1);
  }
};

runSeed();
