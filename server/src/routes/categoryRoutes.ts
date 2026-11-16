import { Router } from "express";

import {
  getCategoryCatalogController,
  getAllCategoriesController,
  getCategoryByIdController,
  getSubcategoriesByParentController,
} from "../controllers/categoryController";

const router = Router();

router.get("/", getAllCategoriesController);
router.get("/catalog", getCategoryCatalogController);
router.get("/:id/subcategories", getSubcategoriesByParentController);

router.get("/:id", getCategoryByIdController);

export default router;
