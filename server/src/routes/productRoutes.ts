import { Router } from "express";

import {
  createProductController,
  getAllProductsController,
  getProductByIdController,
  getProductsByCategoryController,
  getVendorProductsController,
  updateProductController,
  deleteProductController,
  restoreProductController,
} from "../controllers/productController";

import authMiddleware from "../middleware/authMiddleware";
import upload from "../middleware/uploadMiddleware";

const router = Router();

router.get("/", getAllProductsController);
router.get("/category/:categoryId", getProductsByCategoryController);
router.get("/vendor", authMiddleware("vendor"), getVendorProductsController);
router.post(
  "/",
  authMiddleware("vendor"),
  upload.single("image"),
  createProductController,
);
router.put("/:id/restore", authMiddleware("vendor"), restoreProductController);
router
  .route("/:id")
  .put(
    authMiddleware("vendor"),
    upload.single("image"),
    updateProductController,
  )
  .delete(authMiddleware("vendor"), deleteProductController);

router.get("/:id", getProductByIdController);

export default router;
