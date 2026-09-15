import { Response } from "express";

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
import { processFakeRazorpayPayment } from "../services/paymentService";

export const createOrderController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { addressId, paymentMethod } = req.body;

    if (!addressId) {
      res.status(400).json({
        success: false,
        message: "Address ID is required",
      });
      return;
    }

    if (paymentMethod !== "COD" && paymentMethod !== "RAZORPAY_FAKE") {
      res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
      return;
    }

    // Validate cart and calculate total
    const checkout = await calculateCheckout(req.user.id);

    let paymentId: string | undefined;

    // Fake Razorpay payment
    if (paymentMethod === "RAZORPAY_FAKE") {
      const payment = await processFakeRazorpayPayment(checkout.totalAmount);

      if (!payment.success) {
        res.status(400).json({
          success: false,
          message: "Payment failed",
        });
        return;
      }

      paymentId = payment.paymentId;
    }

    // Create order only after successful payment
    const order = await createOrder(req.user.id, {
      addressId,
      paymentMethod,
      paymentId,
    });

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: {
        order,
        paymentId,
      },
    });
  } catch (error) {
    console.error("Create order error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create order",
    });
  }
};

// Get My All Orders
export const getMyOrdersController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const orders = await getMyOrders(req.user.id);

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Get my orders error:", error);

    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch orders",
    });
  }
};

// Get My Single Order
export const getOrderByIdController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { id } = req.params as { id: string };

    const order = await getOrderById(id, req.user.id);

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Get order error:", error);

    res.status(404).json({
      success: false,
      message: error instanceof Error ? error.message : "Order not found",
    });
  }
};

// Changing All Order By Vendor
export const getVendorOrdersController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const orders = await getVendorOrders(req.user.id);

    res.status(200).json({
      success: true,
      data: orders,
    });
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

// Update Order Status By Vendor
export const updateVendorOrderStatusController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { id } = req.params as { id: string };
    const { status } = req.body;

    if (!status) {
      res.status(400).json({
        success: false,
        message: "Order status is required",
      });
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

// Admin Dashboard
export const getVendorDashboardController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const dashboard = await getVendorDashboard(req.user.id);

    res.status(200).json({
      success: true,
      data: dashboard,
    });
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
