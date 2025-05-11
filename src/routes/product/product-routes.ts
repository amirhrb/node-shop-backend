import { RequestHandler, Router } from "express";
import Authentication from "../../controllers/helpers/authentication";
import Product from "../../controllers/product/product";
import ProductModel from "../../models/product/product";
import reviewRouter from "./review-routes";
import { PermissionAction, ResourceType } from "../../models/user/permission";

const router = Router({
  mergeParams: true,
});

router.use("/:productId/reviews", reviewRouter);

const auth = new Authentication();
const product = new Product();

router
  .route("/")
  .post(
    auth.protect as RequestHandler,
    auth.hasAnyPermission([
      {
        action: PermissionAction.MANAGE,
        resource: ResourceType.PRODUCT,
      },
    ]) as RequestHandler,
    product.uploadProductImages as RequestHandler,
    product.checkProduct as RequestHandler,
    product.resizeProductImages as RequestHandler,
    product.handleProductImagesUpload as RequestHandler,
    product.createProduct as RequestHandler
  )
  .get(product.getProducts as RequestHandler);

router
  .route("/:id")
  .get(product.getProduct as RequestHandler)
  .all(auth.protect as RequestHandler)
  .patch(
    auth.hasAnyPermission(
      [
        {
          action: PermissionAction.UPDATE,
          resource: ResourceType.PRODUCT,
        },
      ],
      async (req) => {
        const product = await ProductModel.findById(req.params.id);
        return product?.owner;
      }
    ) as RequestHandler,
    product.uploadProductImages as RequestHandler,
    product.checkProduct as RequestHandler,
    product.resizeProductImages as RequestHandler,
    product.handleProductImagesUpload as RequestHandler,
    product.updateProduct as RequestHandler
  )
  .delete(
    auth.hasAnyPermission(
      [
        {
          action: PermissionAction.DELETE,
          resource: ResourceType.PRODUCT,
        },
      ],
      async (req) => {
        const product = await ProductModel.findById(req.params.id);
        return product?.owner;
      }
    ) as RequestHandler,
    product.deleteProduct as RequestHandler
  );

router.route("/:id/toggle-archive").post(
  auth.protect as RequestHandler,
  auth.hasAnyPermission([
    {
      action: PermissionAction.MANAGE,
      resource: ResourceType.PRODUCT,
    },
  ]) as RequestHandler,
  product.toggleArchiveProduct as RequestHandler
);

export default router;
