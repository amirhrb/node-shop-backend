import {Router} from "express";
import Like from "../controllers/like";
import Authentication from "../controllers/helpers/authentication";

const router = Router({
    mergeParams: true,
  });

const auth = new Authentication();
const like = new Like();

// All routes require authentication
router.use(auth.protect);

// Like a product or review
router.post("/", like.createLike);

// Unlike a product or review
router.delete("/:productId?/:reviewId?", like.removeLike);

// Get likes for a product or review
router.get("/:productId?/:reviewId?", like.getLikes);

// Check if user has liked a product or review
router.get("/status/:productId?/:reviewId?", like.checkLikeStatus);

export default router; 