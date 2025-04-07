import { RequestHandler, Router } from "express";
import Authentication from "../controllers/helpers/authentication";
import Dashboard from "../controllers/dashboard";
import { PermissionAction, ResourceType } from "../models/user/permission";

const router = Router({
  mergeParams: true,
});
const auth = new Authentication();
const dashboard = new Dashboard();

router.use(
  auth.protect as RequestHandler,
  auth.hasAllPermissions([
    { action: PermissionAction.READ, resource: ResourceType.DASHBOARD },
    { action: PermissionAction.MANAGE, resource: ResourceType.DASHBOARD },
  ]) as RequestHandler
);

router.get("/sales", dashboard.getSales as RequestHandler);
router.get("/products", dashboard.getTopProductSales as RequestHandler);
router.get("/users", dashboard.getUserRegistrationsData as RequestHandler);
router.get("/orders", dashboard.getOrdersStats as RequestHandler);
router.get("/revenue", dashboard.getRevenueMetrics as RequestHandler);

export default router;
