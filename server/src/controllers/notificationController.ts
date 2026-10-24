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
import { deleteManagedNotification, editManagedNotification, getEligibleCustomers, getManagedNotificationHistory, resendManagedNotification, sendManualNotification } from "../services/notificationService";
import Offer from "../models/Offer";
import { Types } from "mongoose";
import Category from "../models/Category";
import Product from "../models/Product";

const isNotificationRole = (role?: string): role is "admin" | "vendor" =>
  role === "admin" || role === "vendor";

const isTokenRole = (role?: string): role is "admin" | "vendor" | "user" =>
  role === "admin" || role === "vendor" || role === "user";

export const registerFcmTokenController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user || !isTokenRole(req.user.role)) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    const { token } = req.body;

    if (typeof token !== "string" || !token.trim() || token.trim().length > 4096) {
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
    if (!req.user || !isTokenRole(req.user.role)) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    const { token } = req.body;

    if (typeof token !== "string" || !token.trim() || token.trim().length > 4096) {
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
      req.user.role,
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

    await markAllNotificationsAsRead(req.user.id, req.user.role);

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

export const eligibleCustomersController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== "admin" && req.user.role !== "vendor")) { res.status(403).json({ success: false, message: "Access denied" }); return; }
    if (req.query.search !== undefined && (typeof req.query.search !== "string" || req.query.search.length > 100)) { res.status(400).json({ success: false, message: "search must be text no longer than 100 characters" }); return; }
    const result = await getEligibleCustomers(req.user.role, req.user.role === "vendor" ? req.user.id : undefined, req.query.page, req.query.limit, req.query.search);
    res.status(200).json({ success: true, ...result });
  } catch (error) { res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Failed to search customers" }); }
};

export const sendManualNotificationController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== "admin" && req.user.role !== "vendor")) { res.status(403).json({ success: false, message: "Access denied" }); return; }
    const { audience, customerId, kind, title, message, category, offerId } = req.body ?? {};
    if (!(["individual", "all"].includes(audience)) || !(["custom", "offer"].includes(kind))) { res.status(400).json({ success: false, message: "Invalid audience or kind" }); return; }
    if (audience === "all" && kind !== "offer") { res.status(400).json({ success: false, message: "Broadcast is available for offer notifications only" }); return; }
    const normalizedTitle = typeof title === "string" ? title.trim() : "";
    const normalizedMessage = typeof message === "string" ? message.trim() : "";
    if (kind === "custom" && (normalizedTitle.length < 1 || normalizedTitle.length > 120 || normalizedMessage.length < 1 || normalizedMessage.length > 240)) { res.status(400).json({ success: false, message: "Title (1–120) and message (1–240) are required" }); return; }
    if (audience === "individual" && customerId !== undefined && (typeof customerId !== "string" || !Types.ObjectId.isValid(customerId))) { res.status(400).json({ success: false, message: "customerId must be a valid customer ID" }); return; }
    if (audience === "all" && customerId !== undefined) { res.status(400).json({ success: false, message: "customerId cannot be used with a broadcast audience" }); return; }
    let relatedId: string | undefined;
    let sendTitle = normalizedTitle;
    let sendMessage = normalizedMessage;
    let data: Record<string, string> = { event: "CUSTOM", role: "user" };
    if (kind === "offer") {
      if (category !== "offer") { res.status(400).json({ success: false, message: "Offer notification category must be offer" }); return; }
      if (typeof offerId !== "string" || !Types.ObjectId.isValid(offerId)) { res.status(400).json({ success: false, message: "A valid offerId is required" }); return; }
      const filter: Record<string, unknown> = { _id: offerId, status: "published", deletedAt: null };
      if (req.user.role === "vendor") Object.assign(filter, { ownerId: req.user.id, ownerRole: "vendor" });
      const offer = await Offer.findOne(filter).lean();
      if (!offer) { res.status(404).json({ success: false, message: "Published offer not found or unavailable" }); return; }
      const targetExists = Types.ObjectId.isValid(offer.redirectValue) && (offer.redirectType === "category"
        ? await Category.exists({ _id: offer.redirectValue, isActive: true })
        : await Product.exists({ _id: offer.redirectValue, isActive: true }));
      if (!targetExists) { res.status(400).json({ success: false, message: "Offer destination is not available" }); return; }
      relatedId = offer._id.toString();
      sendTitle = offer.title;
      sendMessage = offer.message;
      data = { event: "NEW_OFFER", type: "NEW_OFFER", offerId: offer._id.toString(), role: "user", title: offer.title, message: offer.message, redirectType: offer.redirectType, redirectValue: offer.redirectValue };
    } else if (category !== "general" && category !== "custom") {
      res.status(400).json({ success: false, message: "Custom notification category must be general or custom" }); return;
    }
    const result = await sendManualNotification({
      senderId: req.user.id, senderRole: req.user.role, recipientId: customerId,
      audience, type: kind === "offer" ? "NEW_OFFER" : "CUSTOM", title: sendTitle,
      message: sendMessage, category: kind === "offer" ? "offer" : category,
      relatedId, action: kind === "offer" ? { type: "offer", id: relatedId, redirectType: data.redirectType as "category" | "product", redirectValue: data.redirectValue } : { type: "none" }, data, idempotencyKey: req.get("Idempotency-Key")?.slice(0, 100),
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send notification";
    res.status(message.includes("not ordered") ? 403 : 400).json({ success: false, message });
  }
};

export const managedNotificationHistoryController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== "admin" && req.user.role !== "vendor")) { res.status(403).json({ success: false, message: "Access denied" }); return; }
    res.status(200).json({ success: true, ...(await getManagedNotificationHistory(req.user.id, req.user.role, req.query.page, req.query.limit, req.query)) });
  } catch (error) { res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Failed to fetch history" }); }
};

export const deleteManagedNotificationController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== "admin" && req.user.role !== "vendor")) { res.status(403).json({ success: false, message: "Access denied" }); return; }
    const result = await deleteManagedNotification(req.params.id as string, req.user.id, req.user.role);
    if (!result) { res.status(404).json({ success: false, message: "Notification not found" }); return; }
    res.status(200).json({ success: true, message: "Campaign history hidden; a delivered push cannot be recalled", data: result });
  } catch (error) { res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Failed to delete history entry" }); }
};

export const editManagedNotificationController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== "admin" && req.user.role !== "vendor")) { res.status(403).json({ success: false, message: "Access denied" }); return; }
    const result = await editManagedNotification(req.params.id as string, req.user.id, req.user.role, { title: String(req.body?.title ?? ""), message: String(req.body?.message ?? "") });
    if (!result) { res.status(404).json({ success: false, message: "Campaign not found" }); return; }
    res.status(200).json({ success: true, message: "Campaign updated; push delivery requires an explicit resend", data: result });
  } catch (error) { res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Failed to edit campaign" }); }
};

export const resendManagedNotificationController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== "admin" && req.user.role !== "vendor")) { res.status(403).json({ success: false, message: "Access denied" }); return; }
    const result = await resendManagedNotification(req.params.id as string, req.user.id, req.user.role, String(req.get("Idempotency-Key") ?? ""));
    res.status(200).json({ success: true, message: result.duplicate ? "Duplicate resend request" : "Resend completed", data: result });
  } catch (error) { res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Failed to resend campaign" }); }
};
