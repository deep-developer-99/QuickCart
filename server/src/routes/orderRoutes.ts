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
  getVendorSalesOverviewController,
  createBuyNowOrderController,
} from "../controllers/orderController";

import authMiddleware from "../middleware/authMiddleware";
import {
  createCashfreeSessionController,
  verifyCashfreePaymentController,
  getCashfreePaymentStatusController,
} from "../controllers/cashfreePaymentController";

const router = Router();

// Cashfree payment routes for the React Native application
router.post(
  "/cashfree/session",
  authMiddleware("user"),
  createCashfreeSessionController,
);
router.post(
  "/cashfree/verify",
  authMiddleware("user"),
  verifyCashfreePaymentController,
);
router.get(
  "/cashfree/:paymentId/status",
  authMiddleware("user"),
  getCashfreePaymentStatusController,
);

// User payment/order routes
router.post("/", authMiddleware("user"), createOrderController);
router.post("/buy-now", authMiddleware("user"), createBuyNowOrderController);

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
  getVendorSalesOverviewController,
);

router.get(
  "/vendor/sales-overview",
  authMiddleware("vendor"),
  getVendorSalesOverviewController,
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
