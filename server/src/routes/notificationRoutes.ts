import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import {
  getNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController,
  notificationStreamController,
  registerFcmTokenController,
  removeFcmTokenController,
} from "../controllers/notificationController";

const router = Router();

router.post(
  "/fcm-token",
  authMiddleware("admin", "vendor"),
  registerFcmTokenController,
);

router.delete(
  "/fcm-token",
  authMiddleware("admin", "vendor"),
  removeFcmTokenController,
);

// Kept for backward compatibility with the existing SSE implementation.
router.get(
  "/stream",
  authMiddleware("admin", "vendor"),
  notificationStreamController,
);

router.get("/", authMiddleware("admin", "vendor"), getNotificationsController);

router.patch(
  "/read-all",
  authMiddleware("admin", "vendor"),
  markAllNotificationsReadController,
);

router.patch(
  "/:id/read",
  authMiddleware("admin", "vendor"),
  markNotificationReadController,
);

export default router;
