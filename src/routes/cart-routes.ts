import { RequestHandler, Router } from "express";
import Cart from "../controllers/cart";
import Authentication from "../controllers/helpers/authentication";
import { PermissionAction, ResourceType } from "../models/user/permission";

const router = Router({
  mergeParams: true,
});
const auth = new Authentication();
const cart = new Cart();

router
  .route("/")
  .all(auth.protect as RequestHandler)
  .post(
    auth.hasAnyPermission([
      { action: PermissionAction.CREATE, resource: ResourceType.CART },
      { action: PermissionAction.MANAGE, resource: ResourceType.CART },
    ]) as RequestHandler,
    cart.addOrUpdateCartItem as RequestHandler
  )
  .get(
    auth.hasAnyPermission([
      { action: PermissionAction.READ, resource: ResourceType.CART },
      { action: PermissionAction.MANAGE, resource: ResourceType.CART },
    ]) as RequestHandler,
    cart.getCartList as RequestHandler
  );

router
  .route("/:id")
  .all(
    auth.protect as RequestHandler,
    auth.hasAnyPermission([
      { action: PermissionAction.UPDATE, resource: ResourceType.CART },
      { action: PermissionAction.MANAGE, resource: ResourceType.CART },
    ]) as RequestHandler,
    cart.checkCartOwner as RequestHandler
  )
  .patch(cart.updateCartItem as RequestHandler)
  .delete(cart.deleteCartItem as RequestHandler);

export default router;
