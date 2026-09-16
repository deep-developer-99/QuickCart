import { Router } from "express";

import {
  createOrderController,
  getMyOrdersController,
  getOrderByIdController,
  getVendorOrdersController,
  updateVendorOrderStatusController,
  getVendorDashboardController,
} from "../controllers/orderController";

import authMiddleware from "../middleware/authMiddleware";

const router = Router();

// User Routes
router.post("/", authMiddleware("user"), createOrderController);

router.get("/my-orders", authMiddleware("user"), getMyOrdersController);

// Vendor Routes
router.get(
  "/vendor/dashboard",
  authMiddleware("vendor"),
  getVendorDashboardController,
);

router.get("/vendor", authMiddleware("vendor"), getVendorOrdersController);

router.put(
  "/:id/status",
  authMiddleware("vendor"),
  updateVendorOrderStatusController,
);

// User Single Order
router.get("/:id", authMiddleware("user"), getOrderByIdController);

export default router;
