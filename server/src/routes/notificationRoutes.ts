import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import { actorRateLimit } from "../middleware/actorRateLimit";
import { validatePagination } from "../middleware/validatePagination";
import {
  getNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController,
  notificationStreamController,
  registerFcmTokenController,
  removeFcmTokenController,
  eligibleCustomersController,
  sendManualNotificationController,
  managedNotificationHistoryController,
  deleteManagedNotificationController,
  editManagedNotificationController,
  resendManagedNotificationController,
} from "../controllers/notificationController";

const router = Router();

router.get("/recipients", authMiddleware("admin", "vendor"), validatePagination, eligibleCustomersController);
router.post("/send", authMiddleware("admin", "vendor"), actorRateLimit("manual-notifications", 10, 15 * 60 * 1000), sendManualNotificationController);
router.get("/managed/history", authMiddleware("admin", "vendor"), validatePagination, managedNotificationHistoryController);
router.get("/users-history", authMiddleware("admin", "vendor"), validatePagination, managedNotificationHistoryController);
router.put("/managed/:id", authMiddleware("admin", "vendor"), editManagedNotificationController);
router.post("/managed/:id/resend", authMiddleware("admin", "vendor"), actorRateLimit("notification-resend", 10, 15 * 60 * 1000), resendManagedNotificationController);
router.delete("/managed/:id", authMiddleware("admin", "vendor"), deleteManagedNotificationController);

router.post(
  "/fcm-token",
  authMiddleware("admin", "vendor", "user"),
  registerFcmTokenController,
);

router.delete(
  "/fcm-token",
  authMiddleware("admin", "vendor", "user"),
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
