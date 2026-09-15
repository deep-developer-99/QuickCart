import { Router } from "express";

import {
  getAllCategoriesController,
  getCategoryByIdController,
} from "../controllers/categoryController";

const router = Router();

router.get("/", getAllCategoriesController);

router.get("/:id", getCategoryByIdController);

export default router;
