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
  createSubcategoryController,
  deleteSubcategoryController,
  getAdminSubcategoriesController,
  updateSubcategoryController,
  bulkCreateSubcategoriesController,
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
import {
  getAdminPromotionalBannersController,
  createPromotionalBannerController,
  updatePromotionalBannerController,
  deletePromotionalBannerController,
  togglePromotionalBannerController,
} from "../controllers/promotionalBannerController";
import {
  getAdminFooterSettingsController,
  updateAdminFooterSettingsController,
} from "../controllers/footerSettingsController";
import {
  createSearchSuggestionController, deleteSearchSuggestionController,
  getAdminSearchSuggestionsController, reorderSearchSuggestionsController,
  updateSearchSuggestionController, updateSearchSuggestionSettingsController,
} from "../controllers/searchSuggestionController";
import {
  getAdminHomepageSectionsController,
  saveAdminHomepageSectionsController,
} from "../controllers/homepageSectionController";
import { deleteUnusedMobileCategoryNavigationIcon, getAdminMobileCategoryNavigation, saveAdminMobileCategoryNavigation, uploadMobileCategoryNavigationIcon } from "../controllers/mobileCategoryNavigationController";
import { createMobileBannerController, deleteMobileBannerController, getAdminMobileBannersController, reorderMobileBannersController, setMobileBannerStatusController, updateMobileBannerController } from "../controllers/mobileBannerController";

const router = Router();

router.use(authMiddleware("admin"));

// Dashboard
router.get("/dashboard", getAdminDashboardController);

// Homepage product sections
router.get("/homepage-sections", getAdminHomepageSectionsController);
router.put("/homepage-sections", saveAdminHomepageSectionsController);
router.get("/mobile-category-navigation", getAdminMobileCategoryNavigation);
router.put("/mobile-category-navigation", saveAdminMobileCategoryNavigation);
router.post("/mobile-category-navigation/icon", upload.single("icon"), uploadMobileCategoryNavigationIcon);
router.delete("/mobile-category-navigation/icon", deleteUnusedMobileCategoryNavigationIcon);

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
router.get("/subcategories", getAdminSubcategoriesController);
router.post("/subcategories/bulk", bulkCreateSubcategoriesController);
router.post("/subcategories", upload.single("image"), createSubcategoryController);
router.put("/subcategories/:id", upload.single("image"), updateSubcategoryController);
router.delete("/subcategories/:id", deleteSubcategoryController);

// Banners
router.get("/banners", getAllBannersAdminController);
router.post("/banners", upload.fields([{ name: "image", maxCount: 1 }, { name: "mobileImage", maxCount: 1 }]), createBannerController);
router.put("/banners/:id", upload.fields([{ name: "image", maxCount: 1 }, { name: "mobileImage", maxCount: 1 }]), updateBannerController);
router.delete("/banners/:id", deleteBannerController);
router.put("/banners/:id/status", toggleBannerStatusController);

// Mobile app banners are independent of website banners.
router.get("/mobile-banners", getAdminMobileBannersController);
router.post("/mobile-banners", upload.single("image"), createMobileBannerController);
router.put("/mobile-banners/reorder", reorderMobileBannersController);
router.put("/mobile-banners/:id", upload.single("image"), updateMobileBannerController);
router.patch("/mobile-banners/:id/status", setMobileBannerStatusController);
router.delete("/mobile-banners/:id", deleteMobileBannerController);

// Offers
router.get("/offers", validatePagination, getAdminOffersController);
router.post("/offers", createOfferController);
router.put("/offers/:id", updateOfferController);
router.put("/offers/:id/publish", publishOfferController);

// Global theme
router.get("/theme", getAdminThemeController);
router.patch("/theme", updateAdminThemeController);
router.post("/theme/reset", resetAdminThemeController);

// Promotional banners
router.get("/promotional-banners", getAdminPromotionalBannersController);
router.post("/promotional-banners", upload.single("image"), createPromotionalBannerController);
router.put("/promotional-banners/:id", upload.single("image"), updatePromotionalBannerController);
router.delete("/promotional-banners/:id", deletePromotionalBannerController);
router.put("/promotional-banners/:id/status", togglePromotionalBannerController);

// Footer settings
router.get("/footer-settings", getAdminFooterSettingsController);
router.patch("/footer-settings", updateAdminFooterSettingsController);

// Search suggestions
router.get("/search-suggestions", getAdminSearchSuggestionsController);
router.post("/search-suggestions", createSearchSuggestionController);
router.patch("/search-suggestions/reorder", reorderSearchSuggestionsController);
router.patch("/search-suggestions/settings", updateSearchSuggestionSettingsController);
router.put("/search-suggestions/:id", updateSearchSuggestionController);
router.delete("/search-suggestions/:id", deleteSearchSuggestionController);

// Orders
router.get("/orders", getAllOrdersAdminController);

export default router;
