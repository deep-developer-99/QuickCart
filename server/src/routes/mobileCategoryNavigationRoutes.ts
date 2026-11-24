import { Router } from "express";
import { getMobileCategoryNavigation } from "../controllers/mobileCategoryNavigationController";

const router = Router();
router.get("/", getMobileCategoryNavigation);
export default router;
