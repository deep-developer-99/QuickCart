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
  createPaytmSessionController,
  verifyPaytmPaymentController,
  getPaytmPaymentStatusController,
} from "../controllers/paytmPaymentController";

const router = Router();

// User payment/order routes
router.post(
  "/paytm/session",
  authMiddleware("user"),
  createPaytmSessionController,
);
router.post(
  "/paytm/verify",
  authMiddleware("user"),
  verifyPaytmPaymentController,
);
router.get(
  "/paytm/:paymentId/status",
  authMiddleware("user"),
  getPaytmPaymentStatusController,
);
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
