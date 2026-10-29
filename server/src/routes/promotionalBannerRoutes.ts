import { Router } from "express";
import { getActivePromotionalBannersController } from "../controllers/promotionalBannerController";

const router = Router();
router.get("/", getActivePromotionalBannersController);
export default router;
