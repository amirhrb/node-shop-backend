import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user/user";
import Product from "../models/product/product";
import Role from "../models/user/role";
import Permission from "../models/user/permission";
import { products } from "./data/product.json";
import { users } from "./data/user.json";
import logger from "../utils/logger";
import Profile from "../models/user/profile";
import RefreshToken from "../models/user/tokens";
import Like from "../models/Like";
import Address from "../models/user/address";
import Order from "../models/order";
import Review from "../models/product/reviews";
import Favorite from "../models/user/favorites";
import CartItem from "../models/cart";
import {
  adminPermissions,
  superAdminPermissions,
  defaultUserPermissions,
} from "../utils/permission-factory";

dotenv.config();

const createAdminRolesAndUsers = async (
  session: mongoose.ClientSession
): Promise<void> => {
  // Create admin roles
  const roles = {
    superAdmin: await Role.create(
      [
        {
          name: "super-admin",
          description: "Super Admin role with management and super access",
          isDefault: false,
        },
      ],
      { session }
    ),
    admin: await Role.create(
      [
        {
          name: "admin",
          description: "Admin role with management access",
          isDefault: false,
        },
      ],
      { session }
    ),
  };
  // Create admin permissions using the permission factory
  const permissions = {
    admin: await Permission.create(
      adminPermissions.map((permission) => ({
        ...permission,
        roles: [roles.admin[0]._id],
      })),
      { session, ordered: true }
    ),
    superAdmin: await Permission.create(
      superAdminPermissions.map((permission) => ({
        ...permission,
        roles: [roles.superAdmin[0]._id],
      })),
      { session, ordered: true }
    ),
  };
  // Update roles with permissions
  roles.admin[0].permissions = permissions.admin.map((p) => p._id);
  roles.superAdmin[0].permissions = permissions.superAdmin.map((p) => p._id);

  await Promise.all([
    roles.admin[0].save({ session }),
    roles.superAdmin[0].save({ session }),
  ]);

  // Get or create user role and permissions
  let userRole = await Role.findOne({ name: "user" }).session(session);
  if (!userRole) {
    userRole = (
      await Role.create(
        [
          {
            name: "user",
            description: "Default user role with basic permissions",
            isDefault: true,
          },
        ],
        { session }
      )
    )[0];
  }

  // Create user permissions using the permission factory
  const userPermissions = await Permission.create(
    defaultUserPermissions.map((permission) => ({
      ...permission,
      roles: [userRole._id],
    })),
    { session, ordered: true }
  );

  userRole.permissions = userPermissions.map((p) => p._id);
  await userRole.save({ session });

  // Create admin users
  const adminUsers = [
    {
      username: process.env.SUPER_ADMIN_USERNAME,
      firstName: process.env.SUPER_ADMIN_FIRST_NAME,
      lastName: process.env.SUPER_ADMIN_LAST_NAME,
      email: process.env.SUPER_ADMIN_EMAIL,
      phone: process.env.SUPER_ADMIN_PHONE,
      roles: [userRole._id, roles.superAdmin[0]._id],
      permissions: [
        ...userPermissions.map((p) => p._id),
        ...permissions.superAdmin.map((p) => p._id),
      ],
      isVerified: true,
    },
    {
      username: process.env.ADMIN_USERNAME,
        firstname: process.env.ADMIN_FIRST_NAME,
        lastname: process.env.ADMIN_LAST_NAME,
      email: process.env.ADMIN_EMAIL,
      phone: process.env.ADMIN_PHONE,
      roles: [userRole._id, roles.admin[0]._id],
      permissions: [
        ...userPermissions.map((p) => p._id),
        ...permissions.admin.map((p) => p._id),
      ],
      isVerified: true,
    },
  ];

  const createdAdmins = await User.create(adminUsers, {
    session,
    ordered: true,
  });

  // Update roles with admin user references
  for (const admin of createdAdmins) {
    if (admin.roles.includes(roles.admin[0]._id)) {
      await roles.admin[0]
        .updateOne({ $push: { users: admin._id } })
        .session(session);
    }
    if (admin.roles.includes(roles.superAdmin[0]._id)) {
      await roles.superAdmin[0]
        .updateOne({ $push: { users: admin._id } })
        .session(session);
    }
    await userRole.updateOne({ $push: { users: admin._id } }).session(session);
  }
};

const populateDevData = async (
  session: mongoose.ClientSession
): Promise<void> => {
  // Create regular users
  const regularUsers = users.map((user) => ({
    ...user,
    isVerified: true,
  }));

  const createdUsers = await User.create(regularUsers, {
    session,
    ordered: true,
  });
  logger.info(`Created ${createdUsers.length} regular users`);

  // Create products
  const createdProducts = await Product.create(products, {
    session,
    ordered: true,
  });
  logger.info(`Created ${createdProducts.length} products`);
};

const populateDB = async (): Promise<never> => {
  try {
    // Connect to MongoDB with increased timeout
    console.log(process.env.MONGO_URI?.slice(-10), process.env.NODE_ENV);

    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/node-shop-backend",
      {
        serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
        connectTimeoutMS: 30000,
      }
    );

    logger.info("Connected to MongoDB");

    // Start a session
    const session = await mongoose.startSession();

    await session.withTransaction(async () => {
      // Delete existing data
      await User.deleteMany({}).session(session);
      await Profile.deleteMany({}).session(session);
      await Address.deleteMany({}).session(session);
      await Order.deleteMany({}).session(session);
      await RefreshToken.deleteMany({}).session(session);
      await Like.deleteMany({}).session(session);
      await Review.deleteMany({}).session(session);
      await Favorite.deleteMany({}).session(session);
      await CartItem.deleteMany({}).session(session);
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

export const checkAndSeedProductionDB = async (): Promise<void> => {
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
