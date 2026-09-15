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
import authorize from "../middleware/authorize";

const router = Router();

router.get("/", getAllProductsController);
router.get(
  "/vendor",
  authMiddleware,
  authorize("vendor"),
  getVendorProductsController,
);
router.post("/", authMiddleware, authorize("vendor"), createProductController);
router.put(
  "/:id/restore",
  authMiddleware,
  authorize("vendor"),
  restoreProductController,
);
router
  .route("/:id")
  .put(authMiddleware, authorize("vendor"), updateProductController)
  .delete(authMiddleware, authorize("vendor"), deleteProductController);

router.get("/:id", getProductByIdController);

export default router;
