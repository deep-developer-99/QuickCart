import { Router } from "express";

import {
  getAllUsersController,
  getAllVendorsController,
  approveVendorController,
  rejectVendorController,
  deactivateVendorController,
  activateVendorController,
  getAllProductsAdminController,
  getAllOrdersAdminController,
  getAdminDashboardController,
} from "../controllers/adminController";

import authMiddleware from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware("admin"));

// Dashboard
router.get("/dashboard", getAdminDashboardController);

// Users
router.get("/users", getAllUsersController);

// Vendors
router.get("/vendors", getAllVendorsController);

router.put("/vendors/:id/approve", approveVendorController);

router.put("/vendors/:id/reject", rejectVendorController);

router.put("/vendors/:id/deactivate", deactivateVendorController);

router.put("/vendors/:id/activate", activateVendorController);

// Products
router.get("/products", getAllProductsAdminController);

// Orders
router.get("/orders", getAllOrdersAdminController);

export default router;
