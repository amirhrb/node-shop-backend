import { RequestHandler, Router } from "express";
import Like from "../controllers/like";
import Authentication from "../controllers/helpers/authentication";
import { PermissionAction, ResourceType } from "../models/user/permission";
import { authRateLimiter } from "../middleware/rateLimiter";

const router = Router({
  mergeParams: true,
});

const auth = new Authentication();
const like = new Like();

// All routes require authentication
router.use(auth.protect as RequestHandler);

router
  .route("/")
  .post(
    authRateLimiter,
    auth.hasAnyPermission([
      { action: PermissionAction.CREATE, resource: ResourceType.LIKE },
      { action: PermissionAction.MANAGE, resource: ResourceType.LIKE },
    ]) as RequestHandler,
    like.toggleLike as RequestHandler
  )
  .get(
    auth.hasAnyPermission([
      { action: PermissionAction.READ, resource: ResourceType.LIKE },
      { action: PermissionAction.MANAGE, resource: ResourceType.LIKE },
    ]) as RequestHandler,
    like.getLikes as RequestHandler
  );

// Check if user has liked a product or review
router.get(
  "/status/:productId?/:reviewId?",
  auth.hasAnyPermission([
    { action: PermissionAction.READ, resource: ResourceType.LIKE },
    { action: PermissionAction.MANAGE, resource: ResourceType.LIKE },
  ]) as RequestHandler,
  like.checkLikeStatus as RequestHandler
);

export default router;
