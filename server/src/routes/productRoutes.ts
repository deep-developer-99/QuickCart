import { Router } from "express";

import {
  createProductController,
  getAllProductsController,
  getProductByIdController,
  getVendorProductsController,
  updateProductController,
  deleteProductController,
  restoreProductController,
} from "../controllers/productController";

import authMiddleware from "../middleware/authMiddleware";

const router = Router();

router.get("/", getAllProductsController);
router.get("/vendor", authMiddleware("vendor"), getVendorProductsController);
router.post("/", authMiddleware("vendor"), createProductController);
router.put("/:id/restore", authMiddleware("vendor"), restoreProductController);
router
  .route("/:id")
  .put(authMiddleware("vendor"), updateProductController)
  .delete(authMiddleware("vendor"), deleteProductController);

router.get("/:id", getProductByIdController);

export default router;
