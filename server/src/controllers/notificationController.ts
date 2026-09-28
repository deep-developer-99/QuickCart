import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  registerFcmToken,
  removeFcmToken,
} from "../services/notificationService";
import { addNotificationClient } from "../utils/notificationStream";

const isNotificationRole = (role?: string): role is "admin" | "vendor" =>
  role === "admin" || role === "vendor";

export const registerFcmTokenController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user || !isNotificationRole(req.user.role)) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    const { token } = req.body;

    if (typeof token !== "string" || !token.trim()) {
      res.status(400).json({
        success: false,
        message: "FCM token is required",
      });
      return;
    }

    await registerFcmToken(req.user.id, req.user.role, token.trim());

    res.status(200).json({
      success: true,
      message: "FCM token registered successfully",
    });
  } catch (error) {
    console.error("Register FCM token error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to register FCM token",
    });
  }
};

export const removeFcmTokenController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user || !isNotificationRole(req.user.role)) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    const { token } = req.body;

    if (typeof token !== "string" || !token.trim()) {
      res.status(400).json({
        success: false,
        message: "FCM token is required",
      });
      return;
    }

    await removeFcmToken(req.user.id, req.user.role, token.trim());

    res.status(200).json({
      success: true,
      message: "FCM token removed successfully",
    });
  } catch (error) {
    console.error("Remove FCM token error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove FCM token",
    });
  }
};

export const getNotificationsController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user || !isNotificationRole(req.user.role)) {
      res.status(403).json({
        success: false,
        message:
          "Notifications are available for admin and vendor accounts only",
      });
      return;
    }

    const notifications = await getNotifications(req.user.id, req.user.role);

    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

export const markNotificationReadController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user || !isNotificationRole(req.user.role)) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    const notificationId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const notification = await markNotificationAsRead(
      notificationId,
      req.user.id,
    );

    if (!notification) {
      res.status(404).json({
        success: false,
        message: "Notification not found",
      });
      return;
    }

    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(400).json({
      success: false,
      message: "Failed to mark notification as read",
    });
  }
};

export const markAllNotificationsReadController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user || !isNotificationRole(req.user.role)) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    await markAllNotificationsAsRead(req.user.id);

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notifications as read",
    });
  }
};

export const notificationStreamController = (
  req: AuthenticatedRequest,
  res: Response,
): void => {
  if (!req.user || !isNotificationRole(req.user.role)) {
    res.status(403).end();
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(`event: connected\ndata: {"connected":true}\n\n`);
  addNotificationClient(req.user.role, req.user.id, res);
};
