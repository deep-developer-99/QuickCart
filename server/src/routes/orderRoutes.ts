import { customerCheckoutGuard } from "../middleware/customerCheckoutGuard";
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
  getCheckoutSummaryController,
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
  customerCheckoutGuard,
  createCashfreeSessionController,
);
router.post(
  "/cashfree/verify",
  authMiddleware("user"),
  customerCheckoutGuard,
  verifyCashfreePaymentController,
);
router.get(
  "/cashfree/:paymentId/status",
  authMiddleware("user"),
  getCashfreePaymentStatusController,
);

// User payment/order routes
router.post("/", authMiddleware("user"), customerCheckoutGuard, createOrderController);
router.post("/buy-now", authMiddleware("user"), customerCheckoutGuard, createBuyNowOrderController);
// POST accepts local cart identifiers/quantities; GET remains for legacy clients.
router.post("/checkout-summary", authMiddleware("user"), getCheckoutSummaryController);
router.get("/checkout-summary", authMiddleware("user"), getCheckoutSummaryController);

router.post(
  "/razorpay/create-order",
  authMiddleware("user"),
  customerCheckoutGuard,
  createRazorpayOrderController,
);

router.post(
  "/razorpay/verify",
  authMiddleware("user"),
  customerCheckoutGuard,
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
