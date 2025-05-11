import { RequestHandler, Router } from "express";
import Authentication from "../../controllers/helpers/authentication";
import cartRouter from "../cart-routes";
import orderRouter from "./order-routes";
import profileRouter from "./profile-routes";
import addressRouter from "./address-routes";
import favoritesRouter from "./favorites-routes";
import UserController from "../../controllers/user/user";
import { PermissionAction, ResourceType } from "../../models/user/permission";
import mongoose from "mongoose";

const router = Router({
  mergeParams: true,
});

// Mount sub-routers
router.use("/cart", cartRouter);
router.use("/orders", orderRouter);
router.use("/profile", profileRouter);
router.use("/address", addressRouter);
router.use("/favorites", favoritesRouter);

const auth = new Authentication();
const user = new UserController();

// Authentication routes (public)
router.post("/send-code", auth.sendVerificationCode as RequestHandler);
router.post(
  "/verify-code",
  auth.verifyCode as RequestHandler,
  auth.confirmLogin as RequestHandler
);
router.post("/refresh-token", auth.refreshToken as RequestHandler);

// Protected routes
router.use(auth.protect as RequestHandler);

// User management routes
router.post("/logout-all", auth.logoutAll as RequestHandler);
router.post("/logout", auth.logout as RequestHandler);

router
  .route("/me")
  .get(
    auth.hasAnyPermission([
      { action: PermissionAction.READ, resource: ResourceType.USER },
      { action: PermissionAction.MANAGE, resource: ResourceType.USER },
    ]) as RequestHandler,
    user.getMe as RequestHandler
  )
  .patch(
    auth.hasAnyPermission([
      { action: PermissionAction.UPDATE, resource: ResourceType.USER },
      { action: PermissionAction.MANAGE, resource: ResourceType.USER },
    ]) as RequestHandler,
    user.updateMe as RequestHandler
  )
  .delete(
    auth.hasAnyPermission([
      { action: PermissionAction.DELETE, resource: ResourceType.USER },
      { action: PermissionAction.MANAGE, resource: ResourceType.USER },
    ]) as RequestHandler,
    user.deleteMe as RequestHandler
  );

router.patch(
  "/change-phone",
  auth.hasAnyPermission([
    { action: PermissionAction.UPDATE, resource: ResourceType.USER },
    { action: PermissionAction.MANAGE, resource: ResourceType.USER },
  ]) as RequestHandler,
  user.changePhone as RequestHandler,
  auth.sendVerificationCode as RequestHandler
);
router.post(
  "/change-phone/verify-code",
  auth.hasAnyPermission([
    { action: PermissionAction.UPDATE, resource: ResourceType.USER },
    { action: PermissionAction.MANAGE, resource: ResourceType.USER },
  ]) as RequestHandler,
  auth.verifyCode as RequestHandler,
  auth.confirmPhoneChange as RequestHandler
);

// Admin route to get all users
router.get(
  "/",
  auth.hasAnyPermission([
    { action: PermissionAction.MANAGE, resource: ResourceType.USER },
  ]) as RequestHandler,
  user.getAllUsers as RequestHandler
);

// role-permission related routes
router.get(
  "/:id/permissions",
  auth.hasAnyPermission([
    { action: PermissionAction.READ, resource: ResourceType.USER },
    { action: PermissionAction.MANAGE, resource: ResourceType.USER },
  ]) as RequestHandler,
  user.getUserPermissions as RequestHandler
);
router.get(
  "/:id/roles",
  auth.hasAnyPermission([
    { action: PermissionAction.READ, resource: ResourceType.USER },
    { action: PermissionAction.MANAGE, resource: ResourceType.USER },
  ]) as RequestHandler,
  user.getUserRoles as RequestHandler
);
router.get(
  "/role/:id",
  auth.hasAnyPermission([
    { action: PermissionAction.READ, resource: ResourceType.USER },
    { action: PermissionAction.MANAGE, resource: ResourceType.USER },
  ]) as RequestHandler,
  user.getRoleById as RequestHandler
);
router.get(
  "/permission/:id",
  auth.hasAnyPermission([
    { action: PermissionAction.READ, resource: ResourceType.USER },
    { action: PermissionAction.MANAGE, resource: ResourceType.USER },
  ]) as RequestHandler,
  user.getPermissionById as RequestHandler
);

/**
 * @route   POST /api/v1/users/promote-to-admin
 * @desc    Promote a user to admin or superAdmin role
 * @access  Super Admin only
 * @body    {
 *   userId: string,
 *   roleType: "admin" | "superAdmin" (default: "admin")
 * }
 */
router.post(
  "/promote-to-admin",
  auth.hasAnyPermission([
    { action: PermissionAction.SUPER, resource: ResourceType.USER },
  ]) as RequestHandler,
  auth.promoteToAdmin as RequestHandler
);

/**
 * @route   POST /api/v1/users/demote-from-role
 * @desc    Demote a user from admin or superAdmin role
 * @access  Super Admin only
 * @body    {
 *   userId: string,
 *   roleType: "admin" | "superAdmin" (default: "admin")
 * }
 */
router.post(
  "/demote-from-role",
  auth.hasAnyPermission([
    { action: PermissionAction.SUPER, resource: ResourceType.USER },
  ]) as RequestHandler,
  auth.demoteFromRole as RequestHandler
);

/**
 * @route   POST /api/v1/users/manage-permissions
 * @desc    Add or remove permissions for a user
 * @access  Super Admin only
 * @body    {
 *   userId: string,
 *   permissionsToAdd: [{ action: PermissionAction, resource: ResourceType, conditions?: {} }],
 *   permissionsToRemove: [{ action: PermissionAction, resource: ResourceType }]
 * }
 */
router.post(
  "/manage-permissions",
  auth.hasAnyPermission([
    { action: PermissionAction.MANAGE, resource: ResourceType.USER },
  ]) as RequestHandler,
  auth.manageUserPermissions as RequestHandler
);

router
  .route("/:id")
  .get(
    auth.hasAnyPermission([
      { action: PermissionAction.READ, resource: ResourceType.USER },
      { action: PermissionAction.MANAGE, resource: ResourceType.USER },
    ]) as RequestHandler,
    user.getUserByID as RequestHandler
  )
  .patch(
    auth.hasAnyPermission(
      [
        { action: PermissionAction.UPDATE, resource: ResourceType.USER },
        { action: PermissionAction.MANAGE, resource: ResourceType.USER },
      ],
      async (req) => {
        return new mongoose.Types.ObjectId(req.params.id);
      }
    ) as RequestHandler,
    user.updateUser as RequestHandler
  )
  .delete(
    auth.hasAnyPermission(
      [
        { action: PermissionAction.DELETE, resource: ResourceType.USER },
        { action: PermissionAction.MANAGE, resource: ResourceType.USER },
      ],
      async (req) => {
        return new mongoose.Types.ObjectId(req.params.id);
      }
    ) as RequestHandler,
    user.deleteUser as RequestHandler
  );

export default router;
