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

import {
  getAllBannersAdminController,
  createBannerController,
  updateBannerController,
  deleteBannerController,
  toggleBannerStatusController,
} from "../controllers/bannerController";

import {
  getAllCategoriesAdminController,
  createCategoryController,
  updateCategoryController,
  deleteCategoryController,
} from "../controllers/categoryController";

import authMiddleware from "../middleware/authMiddleware";
import { validatePagination } from "../middleware/validatePagination";
import upload from "../middleware/uploadMiddleware";
import {
  createOfferController,
  getAdminOffersController,
  publishOfferController,
  updateOfferController,
} from "../controllers/offerController";
import {
  getAdminThemeController,
  resetAdminThemeController,
  updateAdminThemeController,
} from "../controllers/themeController";

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

// Categories
router.get("/categories", getAllCategoriesAdminController);
router.post("/categories", upload.single("image"), createCategoryController);
router.put("/categories/:id", upload.single("image"), updateCategoryController);
router.delete("/categories/:id", deleteCategoryController);

// Banners
router.get("/banners", getAllBannersAdminController);
router.post("/banners", upload.single("image"), createBannerController);
router.put("/banners/:id", upload.single("image"), updateBannerController);
router.delete("/banners/:id", deleteBannerController);
router.put("/banners/:id/status", toggleBannerStatusController);

// Offers
router.get("/offers", validatePagination, getAdminOffersController);
router.post("/offers", createOfferController);
router.put("/offers/:id", updateOfferController);
router.put("/offers/:id/publish", publishOfferController);

// Global theme
router.get("/theme", getAdminThemeController);
router.patch("/theme", updateAdminThemeController);
router.post("/theme/reset", resetAdminThemeController);

// Orders
router.get("/orders", getAllOrdersAdminController);

export default router;
