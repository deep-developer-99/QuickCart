import { Router } from "express";
import {
  getPublicThemeController,
} from "../controllers/themeController";

const router = Router();

router.get("/public", getPublicThemeController);

export default router;
