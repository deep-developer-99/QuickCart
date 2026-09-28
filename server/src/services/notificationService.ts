import { Types } from "mongoose";
import Notification, {
  NotificationRole,
  NotificationType,
} from "../models/Notification";
import Admin from "../models/Admin";
import Vendor from "../models/Vendor";
import { emitNotification } from "../utils/notificationStream";
import { sendFirebaseNotification } from "./firebaseNotificationService";

interface CreateNotificationData {
  recipient: string | Types.ObjectId;
  recipientRole: NotificationRole;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string | Types.ObjectId;
}

export const createNotification = async (data: CreateNotificationData) => {
  const notification = await Notification.create({
    recipient: new Types.ObjectId(data.recipient),
    recipientRole: data.recipientRole,
    type: data.type,
    title: data.title,
    message: data.message,
    relatedId: data.relatedId ? new Types.ObjectId(data.relatedId) : undefined,
  });

  // Keep SSE for compatibility with any older open client connection.
  emitNotification(data.recipientRole, data.recipient.toString(), notification);

  try {
    const recipientId = data.recipient.toString();

    const recipient =
      data.recipientRole === "admin"
        ? await Admin.findById(recipientId).select("fcmTokens").lean()
        : await Vendor.findById(recipientId).select("fcmTokens").lean();

    if (recipient?.fcmTokens?.length) {
      const response = await sendFirebaseNotification(recipient.fcmTokens, {
        notificationId: notification._id.toString(),
        type: data.type,
        title: data.title,
        message: data.message,
        relatedId: data.relatedId?.toString(),
        role: data.recipientRole,
      });

      // Remove tokens Firebase says are no longer valid.
      const invalidTokens: string[] = [];

      response?.responses.forEach((result, index) => {
        if (!result.success) {
          const code = result.error?.code || "";
          if (
            code.includes("registration-token-not-registered") ||
            code.includes("invalid-registration-token")
          ) {
            invalidTokens.push(recipient.fcmTokens[index]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        if (data.recipientRole === "admin") {
          await Admin.updateOne(
            { _id: recipientId },
            { $pull: { fcmTokens: { $in: invalidTokens } } },
          );
        } else {
          await Vendor.updateOne(
            { _id: recipientId },
            { $pull: { fcmTokens: { $in: invalidTokens } } },
          );
        }
      }
    }
  } catch (error) {
    // Notification history must still work even if FCM has a temporary issue.
    console.error("Firebase notification delivery failed:", error);
  }

  return notification;
};

export const registerFcmToken = async (
  recipientId: string,
  role: NotificationRole,
  token: string,
) => {
  if (role === "admin") {
    return Admin.findByIdAndUpdate(
      recipientId,
      { $addToSet: { fcmTokens: token } },
      { new: true },
    )
      .select("_id fcmTokens")
      .lean();
  }

  return Vendor.findByIdAndUpdate(
    recipientId,
    { $addToSet: { fcmTokens: token } },
    { new: true },
  )
    .select("_id fcmTokens")
    .lean();
};

export const removeFcmToken = async (
  recipientId: string,
  role: NotificationRole,
  token: string,
) => {
  if (role === "admin") {
    return Admin.findByIdAndUpdate(
      recipientId,
      { $pull: { fcmTokens: token } },
      { new: true },
    )
      .select("_id fcmTokens")
      .lean();
  }

  return Vendor.findByIdAndUpdate(
    recipientId,
    { $pull: { fcmTokens: token } },
    { new: true },
  )
    .select("_id fcmTokens")
    .lean();
};

export const notifyVendorsAboutNewOrder = async (
  vendorIds: string[],
  orderId: string,
  itemCount: number,
) => {
  const uniqueVendorIds = [...new Set(vendorIds)];

  await Promise.all(
    uniqueVendorIds.map(async (vendorId) => {
      try {
        await createNotification({
          recipient: vendorId,
          recipientRole: "vendor",
          type: "NEW_ORDER",
          title: "New Order Received",
          message: `You have a new order containing ${itemCount} item${itemCount === 1 ? "" : "s"}.`,
          relatedId: orderId,
        });
      } catch (error) {
        console.error(`Failed to notify vendor ${vendorId}:`, error);
      }
    }),
  );
};

export const notifyAdminsAboutNewVendor = async (
  vendorName: string,
  shopName: string,
  vendorId: string,
) => {
  const admins = await Admin.find({ isActive: true }).select("_id").lean();

  await Promise.all(
    admins.map(async (admin) => {
      try {
        await createNotification({
          recipient: admin._id,
          recipientRole: "admin",
          type: "NEW_VENDOR",
          title: "New Vendor Registration",
          message: `${vendorName} registered ${shopName} and is waiting for approval.`,
          relatedId: vendorId,
        });
      } catch (error) {
        console.error(`Failed to notify admin ${admin._id}:`, error);
      }
    }),
  );
};

export const getNotifications = async (
  recipient: string,
  recipientRole: NotificationRole,
) => {
  return Notification.find({ recipient, recipientRole })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
};

export const markNotificationAsRead = async (
  notificationId: string,
  recipient: string,
) => {
  return Notification.findOneAndUpdate(
    { _id: notificationId, recipient },
    { isRead: true },
    { new: true },
  ).lean();
};

export const markAllNotificationsAsRead = async (recipient: string) => {
  await Notification.updateMany(
    { recipient, isRead: false },
    { $set: { isRead: true } },
  );
};
