import { RequestHandler, Router } from "express";
import Cart from "../controllers/cart";
import CartModel from "../models/cart";
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
    ]) as RequestHandler,
    cart.addOrUpdateCartItem as RequestHandler
  )
  .get(
    auth.hasAnyPermission([
      { action: PermissionAction.READ, resource: ResourceType.CART },
      { action: PermissionAction.MANAGE, resource: ResourceType.CART },
    ]) as RequestHandler,
    cart.getCartList as RequestHandler
  )
  .delete(
    auth.hasAnyPermission([
      { action: PermissionAction.CREATE, resource: ResourceType.CART },
    ]) as RequestHandler,
    cart.clearCart as RequestHandler
  );

router.get(
  "/summary",
  auth.protect as RequestHandler,
  auth.hasAnyPermission([
    { action: PermissionAction.READ, resource: ResourceType.CART },
    { action: PermissionAction.MANAGE, resource: ResourceType.CART },
  ]) as RequestHandler,
  cart.getCartSummary as RequestHandler
);

router.route("/:id").delete(
  auth.protect as RequestHandler,
  auth.hasAnyPermission(
    [{ action: PermissionAction.CREATE, resource: ResourceType.CART }],
    async (req) => {
      const cart = await CartModel.findOne({
        product: req.params.id,
        user: req.user.id,
      });
      return cart?.user;
    }
  ) as RequestHandler,
  cart.deleteCartItem
);

export default router;
