import { RequestHandler, Router } from "express";
import Authentication from "../../controllers/helpers/authentication";
import ReviewsController from "../../controllers/product/review";
import { PermissionAction, ResourceType } from "../../models/user/permission";
import Review from "../../models/product/reviews";

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
  .get(
    auth.protect as RequestHandler,
    auth.hasAnyPermission([
      { action: PermissionAction.MANAGE, resource: ResourceType.REVIEW },
    ]) as RequestHandler,
    reviews.getReviews as RequestHandler
  );

router
  .route("/:id")
  .all(auth.protect as RequestHandler)
  .get(reviews.getReview as RequestHandler)
  .patch(
    auth.hasAnyPermission(
      [{ action: PermissionAction.UPDATE, resource: ResourceType.REVIEW }],
      async (req) => {
        const review = await Review.findById(req.params.id);
        return review?.user;
      }
    ) as RequestHandler,
    reviews.updateReview as RequestHandler
  )
  .delete(
    auth.hasAnyPermission(
      [{ action: PermissionAction.DELETE, resource: ResourceType.REVIEW }],
      async (req) => {
        const review = await Review.findById(req.params.id);
        return review?.user;
      }
    ) as RequestHandler,
    reviews.deleteReview as RequestHandler
  );

// admin routes
router
  .route("/user/:id")
  .get(
    auth.protect as RequestHandler,
    reviews.getUserReviews as RequestHandler
  );

router
  .route("/product/:id")
  .get(
    auth.protect as RequestHandler,
    reviews.getProductReviews as RequestHandler
  );

router.route("/:id/toggle-publish").patch(
  auth.protect as RequestHandler,
  auth.hasAnyPermission(
    [
      { action: PermissionAction.MANAGE, resource: ResourceType.REVIEW },
      { action: PermissionAction.UPDATE, resource: ResourceType.REVIEW },
    ],
    async (req) => {
      const review = await Review.findById(req.params.id);
      return review?.user;
    }
  ) as RequestHandler,
  reviews.togglePublish as RequestHandler
);

router
  .route("/:id/toggle-verification")
  .patch(
    auth.protect as RequestHandler,
    auth.hasAnyPermission([
      { action: PermissionAction.MANAGE, resource: ResourceType.REVIEW },
    ]) as RequestHandler,
    reviews.toggleVerification as RequestHandler
  );
export default router;
