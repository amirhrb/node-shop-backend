import { Router } from "express";
import Authentication from "../controllers/helpers/authentication";
import Order from "../controllers/order";
import { RequestHandler } from "express";

const router = Router({
  mergeParams: true,
});
const auth = new Authentication();
const order = new Order();

// Cast the handlers to RequestHandler to satisfy TypeScript
const createOrderHandler: RequestHandler = order.createOrder;
const verifyPaymentHandler: RequestHandler = order.verifyPayment;
const getUserOrdersHandler: RequestHandler = order.getUserOrders;
const getOrderHandler: RequestHandler = order.getOrder;
const updateOrderStatusHandler: RequestHandler = order.updateOrderStatus;
const cancelOrderHandler: RequestHandler = order.cancelOrder;

// Public routes
router.route("/verify-payment").get(verifyPaymentHandler);

// Protected routes
router.route("/checkout").post(auth.protect, createOrderHandler);
router.get("/", auth.protect, getUserOrdersHandler);

// Order specific routes
router
  .route("/:id")
  .all(auth.protect)
  .get(getOrderHandler)
  .patch(auth.restrictTo("admin", "super-admin"), updateOrderStatusHandler);

router.patch("/:id/cancel", auth.protect, cancelOrderHandler);

export default router;
