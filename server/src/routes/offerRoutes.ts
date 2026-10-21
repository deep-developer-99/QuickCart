import { Router } from "express";

import authMiddleware from "../middleware/authMiddleware";
import { getPublishedOfferController } from "../controllers/offerController";

const router = Router();

router.get("/:id", getPublishedOfferController);

export default router;
