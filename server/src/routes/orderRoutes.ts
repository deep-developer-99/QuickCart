import { Router } from "express";

import {
  createOrderController,
  createRazorpayOrderController,
  verifyRazorpayPaymentController,
  getMyOrdersController,
  getOrderByIdController,
  getVendorOrdersController,
  updateVendorOrderStatusController,
  getVendorDashboardController,
} from "../controllers/orderController";

import authMiddleware from "../middleware/authMiddleware";

const router = Router();

// User payment/order routes
router.post("/", authMiddleware("user"), createOrderController);

router.post(
  "/razorpay/create-order",
  authMiddleware("user"),
  createRazorpayOrderController,
);

router.post(
  "/razorpay/verify",
  authMiddleware("user"),
  verifyRazorpayPaymentController,
);

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
