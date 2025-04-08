import { RequestHandler, Router } from "express";
import Authentication from "../../controllers/helpers/authentication";
import Order from "../../controllers/order";
import { ValidatedEnv } from "../../config/env.config";
import { PermissionAction, ResourceType } from "../../models/user/permission";
import { authRateLimiter } from "../../middleware/rateLimiter";

declare module "express" {
  interface Request {
    env: ValidatedEnv;
  }
}

const router = Router({
  mergeParams: true,
});
const auth = new Authentication();
const order = new Order();

// Public routes with rate limiting
router.get(
  "/verify-payment",
  authRateLimiter,
  order.verifyPayment as RequestHandler
);

// Protected routes with authentication
router.use(auth.protect as RequestHandler);

// Protected routes
router.route("/checkout").post(
  auth.hasAnyPermission([
    { action: PermissionAction.CREATE, resource: ResourceType.ORDER },
    { action: PermissionAction.MANAGE, resource: ResourceType.ORDER },
  ]) as RequestHandler,
  order.createOrder as RequestHandler
);

router.route("/checkout-not-paid/:id").patch(
  auth.hasAnyPermission([
    { action: PermissionAction.CREATE, resource: ResourceType.ORDER },
    { action: PermissionAction.MANAGE, resource: ResourceType.ORDER },
  ]) as RequestHandler,
  order.payForOrder as RequestHandler
);

router.get(
  "/",
  auth.hasAnyPermission([
    { action: PermissionAction.READ, resource: ResourceType.ORDER },
    { action: PermissionAction.MANAGE, resource: ResourceType.ORDER },
  ]) as RequestHandler,
  order.getUserOrders as RequestHandler
);

// admin route
router.get(
  "/admin",
  auth.hasAnyPermission([
    { action: PermissionAction.MANAGE, resource: ResourceType.ORDER },
  ]) as RequestHandler,
  order.getAllOrders as RequestHandler
);

// Order specific routes
router
  .route("/:id")
  .get(
    auth.hasAnyPermission([
      { action: PermissionAction.READ, resource: ResourceType.ORDER },
      { action: PermissionAction.MANAGE, resource: ResourceType.ORDER },
    ]) as RequestHandler,
    order.getOrder as RequestHandler
  )
  .patch(
    auth.hasAnyPermission([
      { action: PermissionAction.UPDATE, resource: ResourceType.ORDER },
      { action: PermissionAction.MANAGE, resource: ResourceType.ORDER },
    ]) as RequestHandler,
    order.updateOrderStatus as RequestHandler
  );

router.patch(
  "/:id/cancel",
  auth.hasAnyPermission([
    { action: PermissionAction.UPDATE, resource: ResourceType.ORDER },
    { action: PermissionAction.MANAGE, resource: ResourceType.ORDER },
  ]) as RequestHandler,
  order.cancelOrder as RequestHandler
);

export default router;
