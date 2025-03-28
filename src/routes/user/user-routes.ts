import { Router } from "express";
import Authentication from "../../controllers/helpers/authentication";
import cartRouter from "../cart-routes";
import orderRouter from "../order-routes";
import profileRouter from "./profile-routes";
import addressRouter from "./address-routes";
import favoritesRouter from "./favorites-routes";
import UserController from "../../controllers/user/user";

const router = Router({
  mergeParams: true,
});
const auth = new Authentication();
const user = new UserController();

// Authentication routes (public)
router.post("/send-code", auth.sendVerificationCode);
router.post("/verify-code", auth.verifyCode);
router.post("/refresh-token", auth.refreshToken);

// Protected routes
router.use(auth.protect);

// Nested routes
router.use("/cart", cartRouter);
router.use("/orders", orderRouter);
router.use("/profile", profileRouter);
router.use("/address", addressRouter);
router.use("/favorites", favoritesRouter);

// User routes
router.post("/logout", auth.logout);
router.post("/logout-all", auth.logoutAll);
router.patch("/update-profile", auth.updateProfile);
router.route("/me").get(user.getMe).delete(user.deleteMe);

// Super Admin routes - must come before admin routes to prevent access
router.post(
  "/promote-to-admin",
  auth.restrictTo("super-admin"),
  auth.promoteToAdmin
);

router.post(
  "/demote-to-user",
  auth.restrictTo("super-admin"),
  auth.demoteToUser
);

// Admin routes
router.use(auth.restrictTo("admin", "super-admin")); // Allow both admin and super-admin access
router.get("/", user.getAllUsers);
router
  .route("/:id")
  .get(user.getUserByID)
  .patch(user.updateUser)
  .delete(user.deleteUser);

export default router;
