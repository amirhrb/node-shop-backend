import { RequestHandler, Router } from "express";
import Authentication from "../../controllers/helpers/authentication";
import ProfileController from "../../controllers/user/profile";
import { PermissionAction, ResourceType } from "../../models/user/permission";

const router = Router({
  mergeParams: true,
});
const auth = new Authentication();
const profile = new ProfileController();

// Apply authentication middleware to all routes
router.use(auth.protect as RequestHandler);

// Profile routes
router.get(
  "/",
  auth.hasAnyPermission([
    { action: PermissionAction.READ, resource: ResourceType.PROFILE },
    { action: PermissionAction.MANAGE, resource: ResourceType.PROFILE },
  ]) as RequestHandler,
  profile.getProfile as RequestHandler
);

router.patch(
  "/",
  auth.hasAnyPermission([
    { action: PermissionAction.UPDATE, resource: ResourceType.PROFILE },
  ]) as RequestHandler,
  profile.uploadUserPhoto as RequestHandler,
  profile.resizeUserPhoto as RequestHandler,
  profile.handleUploadUserImage as RequestHandler,
  profile.updateProfile as RequestHandler
);

export default router;
