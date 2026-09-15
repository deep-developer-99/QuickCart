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
import authorize from "../middleware/authorize";

const router = Router();

// User Routes
router.post("/", authMiddleware, authorize("user"), createOrderController);

router.get(
  "/my-orders",
  authMiddleware,
  authorize("user"),
  getMyOrdersController,
);

// Vendor Routes
router.get(
  "/vendor/dashboard",
  authMiddleware,
  authorize("vendor"),
  getVendorDashboardController,
);

router.get(
  "/vendor",
  authMiddleware,
  authorize("vendor"),
  getVendorOrdersController,
);

router.put(
  "/:id/status",
  authMiddleware,
  authorize("vendor"),
  updateVendorOrderStatusController,
);

// User Single Order
router.get("/:id", authMiddleware, authorize("user"), getOrderByIdController);

export default router;
