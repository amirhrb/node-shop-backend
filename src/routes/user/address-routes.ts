import { RequestHandler, Router } from "express";
import Authentication from "../../controllers/helpers/authentication";
import AddressController from "../../controllers/user/address";
import { PermissionAction, ResourceType } from "../../models/user/permission";

const router = Router({
  mergeParams: true,
});
const auth = new Authentication();
const address = new AddressController();

router
  .route("/")
  .all(auth.protect as RequestHandler)
  .post(
    auth.hasAnyPermission([
      { action: PermissionAction.CREATE, resource: ResourceType.ADDRESS },
      { action: PermissionAction.MANAGE, resource: ResourceType.ADDRESS },
    ]) as RequestHandler,
    address.createAddress as RequestHandler
  )
  .get(
    auth.hasAnyPermission([
      { action: PermissionAction.READ, resource: ResourceType.ADDRESS },
      { action: PermissionAction.MANAGE, resource: ResourceType.ADDRESS },
    ]) as RequestHandler,
    address.getAllAddresses as RequestHandler
  );

router
  .route("/:id")
  .get(
    auth.hasAnyPermission([
      { action: PermissionAction.READ, resource: ResourceType.ADDRESS },
      { action: PermissionAction.MANAGE, resource: ResourceType.ADDRESS },
    ]) as RequestHandler,
    address.getAddress as RequestHandler
  )
  .patch(
    auth.hasAnyPermission([
      { action: PermissionAction.UPDATE, resource: ResourceType.ADDRESS },
      { action: PermissionAction.MANAGE, resource: ResourceType.ADDRESS },
    ]) as RequestHandler,
    address.updateAddress
  )
  .delete(
    auth.hasAnyPermission([
      { action: PermissionAction.DELETE, resource: ResourceType.ADDRESS },
      { action: PermissionAction.MANAGE, resource: ResourceType.ADDRESS },
    ]) as RequestHandler,
    address.deleteAddress as RequestHandler
  );
router.route("/:id/set-default").post(
  auth.hasAnyPermission([
    { action: PermissionAction.UPDATE, resource: ResourceType.ADDRESS },
    { action: PermissionAction.MANAGE, resource: ResourceType.ADDRESS },
  ]) as RequestHandler,
  address.setDefaultAddress
);
export default router;
