import { RequestHandler, Router } from "express";
import Authentication from "../../controllers/helpers/authentication";
import ReviewsController from "../../controllers/product/review";
import { PermissionAction, ResourceType } from "../../models/user/permission";

const router = Router({
  mergeParams: true,
});

const auth = new Authentication();
const reviews = new ReviewsController();

router
  .route("/")
  .post(
    auth.protect as RequestHandler,
    auth.hasAnyPermission([
      { action: PermissionAction.CREATE, resource: ResourceType.REVIEW },
      { action: PermissionAction.MANAGE, resource: ResourceType.REVIEW },
    ]) as RequestHandler,
    reviews.createReview as RequestHandler
  )
  .get(reviews.getReviews as RequestHandler);

router
  .route("/:id")
  .all(auth.protect as RequestHandler)
  .get(reviews.getReview as RequestHandler)
  .patch(
    auth.hasAnyPermission([
      { action: PermissionAction.UPDATE, resource: ResourceType.REVIEW },
    ]) as RequestHandler,
    reviews.updateReview as RequestHandler
  )
  .delete(
    auth.hasAnyPermission([
      { action: PermissionAction.DELETE, resource: ResourceType.REVIEW },
    ]) as RequestHandler,
    reviews.deleteReview as RequestHandler
  );

router.route("/:id/toggle-publish").post(
  auth.hasAnyPermission([
    { action: PermissionAction.UPDATE, resource: ResourceType.REVIEW },
    { action: PermissionAction.MANAGE, resource: ResourceType.REVIEW },
  ]) as RequestHandler,
  reviews.togglePublish as RequestHandler
);

router
  .route("/:id/toggle-verification")
  .post(
    auth.hasAnyPermission([
      { action: PermissionAction.MANAGE, resource: ResourceType.REVIEW },
    ]) as RequestHandler,
    reviews.toggleVerification as RequestHandler
  );
export default router;
