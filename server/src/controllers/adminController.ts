import { Response } from "express";

import { AuthenticatedRequest } from "../middleware/authMiddleware";

import {
  getAllUsers,
  getAllVendors,
  approveVendor,
  rejectVendor,
  deactivateVendor,
  activateVendor,
  getAllProductsAdmin,
  getAllOrdersAdmin,
  getAdminDashboard,
} from "../services/adminService";

// Get all vendors
export const getAllVendorsController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const vendors = await getAllVendors();

    res.status(200).json({
      success: true,
      data: vendors,
    });
  } catch (error) {
    console.error("Get vendors error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch vendors",
    });
  }
};

// Approve vendor
export const approveVendorController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };

    const vendor = await approveVendor(id);

    res.status(200).json({
      success: true,
      message: "Vendor approved successfully",
      data: vendor,
    });
  } catch (error) {
    console.error("Approve vendor error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to approve vendor",
    });
  }
};

// Reject vendor
export const rejectVendorController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };

    const vendor = await rejectVendor(id);

    res.status(200).json({
      success: true,
      message: "Vendor rejected successfully",
      data: vendor,
    });
  } catch (error) {
    console.error("Reject vendor error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to reject vendor",
    });
  }
};

// Deactive Vendor
export const deactivateVendorController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };

    const vendor = await deactivateVendor(id);

    res.status(200).json({
      success: true,
      message: "Vendor deactivated successfully",
      data: vendor,
    });
  } catch (error) {
    console.error("Deactivate vendor error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to deactivate vendor",
    });
  }
};

// Activate Vendor
export const activateVendorController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };

    const vendor = await activateVendor(id);

    res.status(200).json({
      success: true,
      message: "Vendor activated successfully",
      data: vendor,
    });
  } catch (error) {
    console.error("Activate vendor error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to activate vendor",
    });
  }
};

// Get All Users
export const getAllUsersController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const users = await getAllUsers();

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Get users error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

// Get All Products
export const getAllProductsAdminController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const products = await getAllProductsAdmin();

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Get admin products error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};

// Get All Orders
export const getAllOrdersAdminController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const orders = await getAllOrdersAdmin();

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Get admin orders error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};

// Get Admin Dashboard
export const getAdminDashboardController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const dashboard = await getAdminDashboard();

    res.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard",
    });
  }
};
