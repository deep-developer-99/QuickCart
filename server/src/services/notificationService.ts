import { Types } from "mongoose";
import Notification, {
  NotificationRole,
  NotificationType,
} from "../models/Notification";
import Admin from "../models/Admin";
import { emitNotification } from "../utils/notificationStream";

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

  emitNotification(data.recipientRole, data.recipient.toString(), notification);

  return notification;
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
    {
      _id: notificationId,
      recipient,
    },
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
