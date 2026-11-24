import { Router } from "express";
import { getPublicMobileBannersController } from "../controllers/mobileBannerController";

const router = Router();
router.get("/", getPublicMobileBannersController);
export default router;
