import { Router } from "express";

import authMiddleware from "../middleware/authMiddleware";
import { actorRateLimit } from "../middleware/actorRateLimit";
import { validatePagination } from "../middleware/validatePagination";
import { deleteOfferController, getManagedOffersController, getPublishedOfferController, publishOfferController, resendOfferNotificationController, updateOfferController, createOfferController } from "../controllers/offerController";

const router = Router();

router.get("/managed", authMiddleware("admin", "vendor"), validatePagination, getManagedOffersController);
router.post("/", authMiddleware("admin", "vendor"), createOfferController);
router.put("/:id", authMiddleware("admin", "vendor"), updateOfferController);
router.put("/:id/publish", authMiddleware("admin", "vendor"), publishOfferController);
router.delete("/:id", authMiddleware("admin", "vendor"), deleteOfferController);
router.post("/:id/resend-notification", authMiddleware("admin", "vendor"), actorRateLimit("offer-resend", 5, 15 * 60 * 1000), resendOfferNotificationController);
router.get("/:id", getPublishedOfferController);

export default router;
