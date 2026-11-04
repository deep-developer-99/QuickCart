import { Router } from "express";

import {
  getAllCategoriesController,
  getCategoryByIdController,
  getSubcategoriesByParentController,
} from "../controllers/categoryController";

const router = Router();

router.get("/", getAllCategoriesController);
router.get("/:id/subcategories", getSubcategoriesByParentController);

router.get("/:id", getCategoryByIdController);

export default router;
