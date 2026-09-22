import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import {
  getNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController,
  notificationStreamController,
} from "../controllers/notificationController";

const router = Router();

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
