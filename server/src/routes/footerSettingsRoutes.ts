import { Router } from "express";
import { getPublicFooterSettingsController } from "../controllers/footerSettingsController";

const router = Router();
router.get("/", getPublicFooterSettingsController);
export default router;
