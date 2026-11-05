import { Router } from "express";
import { getPublicHomepageSectionsController } from "../controllers/homepageSectionController";

const router = Router();
router.get("/", getPublicHomepageSectionsController);

export default router;
