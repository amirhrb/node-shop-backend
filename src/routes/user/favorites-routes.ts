import { RequestHandler, Router } from "express";
import Authentication from "../../controllers/helpers/authentication";
import FavoritesController from "../../controllers/user/favorites";
import { PermissionAction, ResourceType } from "../../models/user/permission";

const router = Router({
  mergeParams: true,
});
const auth = new Authentication();
const favorite = new FavoritesController();

router.use(auth.protect as RequestHandler);

router
  .route("/")
  .post(
    auth.hasAnyPermission([
      { action: PermissionAction.CREATE, resource: ResourceType.FAVORITE },
      { action: PermissionAction.MANAGE, resource: ResourceType.FAVORITE },
    ]) as RequestHandler,
    favorite.toggleFavorite as RequestHandler
  )
  .get(
    auth.hasAnyPermission([
      { action: PermissionAction.READ, resource: ResourceType.FAVORITE },
      { action: PermissionAction.MANAGE, resource: ResourceType.FAVORITE },
    ]) as RequestHandler,
    favorite.getFavorites as RequestHandler
  )
  .delete(
    auth.hasAnyPermission([
      { action: PermissionAction.DELETE, resource: ResourceType.FAVORITE },
      { action: PermissionAction.MANAGE, resource: ResourceType.FAVORITE },
    ]) as RequestHandler,
    favorite.deleteAllFavorites as RequestHandler
  );

router.delete(
  "/:productId",
  auth.hasAnyPermission([
    { action: PermissionAction.DELETE, resource: ResourceType.FAVORITE },
  ]) as RequestHandler,
  favorite.deleteFavorite as RequestHandler
);

export default router;
