import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user/user";
import Product from "../models/product/product";
import Role from "../models/user/role";
import Permission from "../models/user/permission";
import { products } from "./data/products.json";
import { users } from "./data/users.json";
import logger from "../utils/logger";
import { validateEnv } from "../config/env.config";

dotenv.config();

const createAdminRolesAndUsers = async (session: mongoose.ClientSession) => {
  // Create admin roles
  const roles = {
    superAdmin: await Role.create([{ name: "super-admin" }], {
      session,
      ordered: true,
    }),
    admin: await Role.create([{ name: "admin" }], {
      session,
      ordered: true,
    }),
  };
  logger.info("Created admin roles");

  // Create admin permissions
  const permissions = {
    superAdmin: await Permission.create(
      [
        {
          name: "super-admin",
          roles: [roles.superAdmin[0]._id],
        },
      ],
      {
        session,
        ordered: true,
      }
    ),
    admin: await Permission.create(
      [
        {
          name: "admin",
          roles: [roles.admin[0]._id],
        },
      ],
      {
        session,
        ordered: true,
      }
    ),
  };
  logger.info("Created admin permissions");

  roles.admin[0].permissions.push(permissions.admin[0]._id);
  roles.superAdmin[0].permissions.push(permissions.superAdmin[0]._id);
  await roles.admin[0].save({ session });
  await roles.superAdmin[0].save({ session });
  logger.info("Roles updated by new permissions");

  // Get or create user role and permission
  let userRole = await Role.findOne({ name: "user" }).session(session);
  let userPermission = await Permission.findOne({ name: "user" }).session(
    session
  );

  if (!userRole) {
    const newUserRole = await Role.create([{ name: "user" }], {
      session,
      ordered: true,
    });
    userRole = newUserRole[0];
  }
  if (!userPermission) {
    const newUserPermission = await Permission.create(
      [{ name: "user", roles: [userRole._id] }],
      { session, ordered: true }
    );
    userPermission = newUserPermission[0];
    userRole.permissions.push(userPermission._id);
    await userRole.save({ session });
  }

  // Create admin users from environment variables
  const adminUsers = [
    {
      username: process.env.SUPER_ADMIN_USERNAME,
      firstName: process.env.SUPER_ADMIN_FIRST_NAME,
      lastName: process.env.SUPER_ADMIN_LAST_NAME,
      email: process.env.SUPER_ADMIN_EMAIL,
      phone: process.env.SUPER_ADMIN_PHONE,
      password: process.env.SUPER_ADMIN_PASSWORD,
      roles: [userRole._id, roles.superAdmin[0]._id], // User role first, then admin role
      permissions: [userPermission._id, permissions.superAdmin[0]._id], // User permission first, then admin permission
      isVerified: true,
    },
    {
      username: process.env.ADMIN_USERNAME,
      firstName: process.env.ADMIN_FIRST_NAME,
      lastName: process.env.ADMIN_LAST_NAME,
      email: process.env.ADMIN_EMAIL,
      phone: process.env.ADMIN_PHONE,
      password: process.env.ADMIN_PASSWORD,
      roles: [userRole._id, roles.admin[0]._id], // User role first, then admin role
      permissions: [userPermission._id, permissions.admin[0]._id], // User permission first, then admin permission
      isVerified: true,
    },
  ];

  // Create admin users in database
  const createdAdmins = await User.create(adminUsers, {
    session,
    ordered: true,
  });

  // Update roles with admin user references
  await Promise.all([
    roles.admin[0]
      .updateOne({
        $push: {
          users: {
            $each: createdAdmins
              .filter((admin) => admin.roles.includes(roles.admin[0]._id))
              .map((admin) => admin._id),
          },
        },
      })
      .session(session),
    roles.superAdmin[0]
      .updateOne({
        $push: {
          users: {
            $each: createdAdmins
              .filter((admin) => admin.roles.includes(roles.superAdmin[0]._id))
              .map((admin) => admin._id),
          },
        },
      })
      .session(session),
    userRole
      .updateOne({
        $push: {
          users: {
            $each: createdAdmins.map((admin) => admin._id),
          },
        },
      })
      .session(session),
  ]);
  logger.info("Updated admin role-user relationships");
};

const populateDevData = async (session: mongoose.ClientSession) => {
  // Get user role and permission
  const userRole = await Role.findOne({ name: "user" }).session(session);
  const userPermission = await Permission.findOne({ name: "user" }).session(
    session
  );

  if (!userRole || !userPermission) {
    return logger.error("User role or permission not found");
  }

  // Create regular users
  const regularUsers = users
    .filter((user) => user.role === "user")
    .map((user) => ({
      ...user,
      isVerified: true,
      roles: [userRole._id], // Only user role for regular users
      permissions: [userPermission._id], // Only user permission for regular users
    }));

  const createdUsers = await User.create(regularUsers, {
    session,
    ordered: true,
  });
  logger.info(`Created ${createdUsers.length} regular users`);

  // Update user role with new user references
  await userRole
    .updateOne({
      $push: {
        users: {
          $each: createdUsers.map((user) => user._id),
        },
      },
    })
    .session(session);

  // Create products
  const createdProducts = await Product.create(products, {
    session,
    ordered: true,
  });
  logger.info(`Created ${createdProducts.length} products`);
};

const populateDB = async () => {
  try {
    // Validate environment variables
    const env = validateEnv();

    // Connect to MongoDB
    await mongoose.connect(env.MONGO_URI);
    logger.info("Connected to MongoDB");

    // Start a session
    const session = await mongoose.startSession();

    await session.withTransaction(async () => {
      // Delete existing data
      await User.deleteMany({}).session(session);
      await Product.deleteMany({}).session(session);
      await Role.deleteMany({}).session(session);
      await Permission.deleteMany({}).session(session);
      logger.info("Deleted existing data");

      // Create admin roles and users (both in dev and prod)
      await createAdminRolesAndUsers(session);

      // Only populate test data in development
      if (process.env.NODE_ENV !== "production") {
        logger.info(
          "Development environment detected, populating test data..."
        );
        await populateDevData(session);
      }
    });

    // End session
    await session.endSession();

    logger.info("Database populated successfully!");
    process.exit(0);
  } catch (error) {
    logger.error("Error populating database:", error);
    process.exit(1);
  }
};

export const checkAndSeedProductionDB = async () => {
  try {
    // Check if database is empty
    const userCount = await User.countDocuments();
    const roleCount = await Role.countDocuments();
    const permissionCount = await Permission.countDocuments();
    const productCount = await Product.countDocuments();

    if (
      userCount === 0 &&
      roleCount === 0 &&
      permissionCount === 0 &&
      productCount === 0
    ) {
      logger.info("Production database is empty, seeding initial data...");

      // Start a session
      const session = await mongoose.startSession();

      await session.withTransaction(async () => {
        // Create admin roles and users
        await createAdminRolesAndUsers(session);
      });

      // End session
      await session.endSession();
      logger.info("Production database seeded successfully!");
    } else {
      logger.info("Production database already contains data, skipping seed.");
    }
  } catch (error) {
    logger.error("Error checking/seeding production database:", error);
    throw error;
  }
};

export default populateDB;
