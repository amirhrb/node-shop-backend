import mongoose from "mongoose";
import User from "../models/user/user";
import Product from "../models/product/product";
import Role from "../models/user/role";
import Permission from "../models/user/permission";
import { products } from "./data/product.json";
import { users } from "./data/user.json";
import { reviews } from "./data/review.json";
import { orders } from "./data/order.json";
import { cartItems } from "./data/cart.json";
import { addresses } from "./data/address.json";
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

const createAdminRolesAndUsers = async (
  session: mongoose.ClientSession
): Promise<void> => {
  try {
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
        firstname: process.env.SUPER_ADMIN_FIRST_NAME,
        lastname: process.env.SUPER_ADMIN_LAST_NAME,
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
      await userRole
        .updateOne({ $push: { users: admin._id } })
        .session(session);
    }
  } catch (error) {
    logger.error(error);
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
  // Get the admin users to use as creators
  const admin = await Role.findOne({ name: "admin" });
  const superAdmin = await Role.findOne({ name: "super-admin" });

  const adminUsers = [...(admin?.users || []), ...(superAdmin?.users || [])];

  if (!adminUsers || adminUsers.length === 0) {
    throw new Error("No admin users found to assign as product creators");
  }

  // Assign an admin user as creator for each product
  const productsWithCreator = products.map((product, index) => ({
    ...product,
    owner: adminUsers[index % adminUsers.length]._id,
  }));

  const createdProducts = await Product.create(productsWithCreator, {
    session,
    ordered: true,
  });
  logger.info(`Created ${createdProducts.length} products`);

  // Create reviews for products
  const reviewsWithUserAndProduct = reviews.map((review, index: number) => ({
    ...review,
    user: createdUsers[index % createdUsers.length]._id,
    product: createdProducts[index % createdProducts.length]._id,
  }));

  const createdReviews = await Review.create(reviewsWithUserAndProduct, {
    session,
    ordered: true,
  });
  logger.info(`Created ${createdReviews.length} reviews`);

  // Create cart items
  const cartItemsWithUserAndProduct = cartItems.map((item, index: number) => {
    const randomProduct =
      createdProducts[Math.floor(Math.random() * createdProducts.length)];
    return {
      ...item,
      user: createdUsers[index % createdUsers.length]._id,
      product: randomProduct._id,
      price: randomProduct.price,
      // Ensure quantity doesn't exceed stock
      quantity: Math.min(item.quantity, randomProduct.stockQuantity),
    };
  });

  const createdCartItems = await CartItem.create(cartItemsWithUserAndProduct, {
    session,
    ordered: true,
  });
  logger.info(`Created ${createdCartItems.length} cart items`);

  // Create favorites
  const favoriteEntries = [];
  for (let i = 0; i < createdUsers.length; i++) {
    const randomProducts = createdProducts
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.floor(Math.random() * 5) + 1)
      .map((product) => product._id);

    favoriteEntries.push({
      _id: createdUsers[i]._id,
      products: randomProducts,
    });
  }

  const createdFavorites = await Favorite.create(favoriteEntries, {
    session,
    ordered: true,
  });
  logger.info(`Created ${createdFavorites.length} favorite entries`);

  // Create addresses
  const addressesWithUser = [];

  for (const user of createdUsers) {
    const userAddresses = addresses
      .slice(0, Math.floor(Math.random() * 3) + 1)
      .map((address, index: number) => ({
        ...address,
        user: user._id,
        isDefault: index === 0, // First address is default
      }));

    addressesWithUser.push(...userAddresses);
  }

  const createdAddresses = await Address.create(addressesWithUser, {
    session,
    ordered: true,
  });
  logger.info(`Created ${createdAddresses.length} addresses`);

  // Update users with their addresses
  for (const user of createdUsers) {
    const userAddresses = createdAddresses
      .filter((address) => address.user.toString() === user._id.toString())
      .map((address) => address._id);

    await User.findByIdAndUpdate(
      user._id,
      { $set: { addresses: userAddresses } },
      { session }
    );
  }
  logger.info(`Updated users with their addresses`);

  // Create orders
  const ordersWithUserAndProducts = orders.map((order, index: number) => {
    const user = createdUsers[index % createdUsers.length];
    // Find addresses for this user
    const userAddresses = createdAddresses.filter(
      (address) => address.user.toString() === user._id.toString()
    );

    if (!userAddresses || userAddresses.length === 0) {
      throw new Error(`No addresses found for user ${user._id}`);
    }

    return {
      ...order,
      user: user._id,
      orderItems: order.orderItems.map((item) => ({
        ...item,
        product:
          createdProducts[Math.floor(Math.random() * createdProducts.length)]
            ._id,
      })),
      shippingAddress: userAddresses[0]._id, // Use the first address
    };
  });

  const createdOrders = await Order.create(ordersWithUserAndProducts, {
    session,
    ordered: true,
  });
  logger.info(`Created ${createdOrders.length} orders`);
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
