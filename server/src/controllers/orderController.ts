import { Response } from "express";

import Address from "../models/Address";

import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { calculateCheckout } from "../services/checkoutService";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getVendorOrders,
  updateVendorOrderStatus,
  getVendorDashboard,
} from "../services/orderService";
import {
  createRazorpayOrder,
  fetchRazorpayOrder,
  getRazorpayKeyId,
  verifyRazorpayPayment,
} from "../services/paymentService";

export const createOrderController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }

    const { addressId, paymentMethod } = req.body;

    if (!addressId) {
      res
        .status(400)
        .json({ success: false, message: "Address ID is required" });
      return;
    }

    // This endpoint is intentionally kept for COD. Online payments use the
    // Razorpay create/verify endpoints below so an unpaid order is never created.
    if (paymentMethod !== "COD") {
      res.status(400).json({
        success: false,
        message: "Online payments must be completed through Razorpay",
      });
      return;
    }

    const order = await createOrder(req.user.id, {
      addressId,
      paymentMethod: "COD",
    });

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: { order },
    });
  } catch (error) {
    console.error("Create COD order error:", error);
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create order",
    });
  }
};

export const createRazorpayOrderController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }

    const { addressId } = req.body;

    if (!addressId) {
      res
        .status(400)
        .json({ success: false, message: "Address ID is required" });
      return;
    }

    // Validate the address and cart before opening Razorpay Checkout.
    const address = await Address.findOne({
      _id: addressId,
      user: req.user.id,
    });

    if (!address) {
      res.status(400).json({
        success: false,
        message: "Address not found",
      });
      return;
    }

    const checkout = await calculateCheckout(req.user.id);

    const razorpayOrder = await createRazorpayOrder(
      checkout.totalAmount,
      `qc_${Date.now()}_${req.user.id.slice(-8)}`,
    );

    res.status(200).json({
      success: true,
      data: {
        keyId: getRazorpayKeyId(),
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
    });
  } catch (error) {
    console.error("Create Razorpay order error:", error);
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create Razorpay order",
    });
  }
};

export const verifyRazorpayPaymentController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }

    const { addressId, razorpayPaymentId, razorpayOrderId, razorpaySignature } =
      req.body;

    if (
      !addressId ||
      !razorpayPaymentId ||
      !razorpayOrderId ||
      !razorpaySignature
    ) {
      res.status(400).json({
        success: false,
        message: "Payment verification details are required",
      });
      return;
    }

    const isSignatureValid = verifyRazorpayPayment(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );

    if (!isSignatureValid) {
      res.status(400).json({
        success: false,
        message: "Invalid Razorpay payment signature",
      });
      return;
    }

    // Recalculate the current cart total and compare it with the Razorpay
    // order amount before creating the QuickCart order.
    const checkout = await calculateCheckout(req.user.id);
    const razorpayOrder = await fetchRazorpayOrder(razorpayOrderId);
    const expectedAmount = Math.round(checkout.totalAmount * 100);

    if (razorpayOrder.amount !== expectedAmount) {
      res.status(400).json({
        success: false,
        message: "Payment amount does not match the current cart total",
      });
      return;
    }

    const order = await createOrder(req.user.id, {
      addressId,
      paymentMethod: "RAZORPAY",
      paymentId: razorpayPaymentId,
      razorpayOrderId,
    });

    res.status(201).json({
      success: true,
      message: "Payment verified and order placed successfully",
      data: {
        order,
        paymentId: razorpayPaymentId,
        razorpayOrderId,
      },
    });
  } catch (error) {
    console.error("Verify Razorpay payment error:", error);
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to verify Razorpay payment",
    });
  }
};

export const getMyOrdersController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }

    const orders = await getMyOrders(req.user.id);
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error("Get my orders error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch orders",
    });
  }
};

export const getOrderByIdController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }

    const { id } = req.params as { id: string };
    const order = await getOrderById(id, req.user.id);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("Get order error:", error);
    res.status(404).json({
      success: false,
      message: error instanceof Error ? error.message : "Order not found",
    });
  }
};

export const getVendorOrdersController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }

    const orders = await getVendorOrders(req.user.id);
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error("Get vendor orders error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch vendor orders",
    });
  }
};

export const updateVendorOrderStatusController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }

    const { id } = req.params as { id: string };
    const { status } = req.body;

    if (!status) {
      res
        .status(400)
        .json({ success: false, message: "Order status is required" });
      return;
    }

    const order = await updateVendorOrderStatus(id, req.user.id, status);
    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update order status",
    });
  }
};

export const getVendorDashboardController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const dashboard = await getVendorDashboard(req.user.id);
    res.status(200).json({ success: true, data: dashboard });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch vendor dashboard",
    });
  }
};
