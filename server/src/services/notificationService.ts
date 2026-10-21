import { Types } from "mongoose";
import Notification, {
  NotificationRole,
  NotificationType,
} from "../models/Notification";
import Admin from "../models/Admin";
import Vendor from "../models/Vendor";
import User from "../models/User";
import { emitNotification } from "../utils/notificationStream";
import { sendFirebaseNotification } from "./firebaseNotificationService";

interface CreateNotificationData {
  recipient: string | Types.ObjectId;
  recipientRole: NotificationRole;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string | Types.ObjectId;
  data?: Record<string, string>;
  deferDelivery?: boolean;
}

const deliverNotification = async (data: CreateNotificationData, notificationId: string) => {
  const recipientId = data.recipient.toString();
  const recipient =
    data.recipientRole === "admin"
      ? await Admin.findById(recipientId).select("fcmTokens").lean()
      : data.recipientRole === "vendor"
        ? await Vendor.findById(recipientId).select("fcmTokens").lean()
        : await User.findById(recipientId).select("fcmTokens").lean();

  if (!recipient?.fcmTokens?.length) return;

  const response = await sendFirebaseNotification(recipient.fcmTokens, {
    notificationId,
    type: data.type,
    title: data.title,
    message: data.message,
    relatedId: data.relatedId?.toString(),
    role: data.recipientRole,
    data: data.data,
  });

  const invalidTokens: string[] = [];
  response.tokens.forEach((token, index) => {
    const result = response.responses[index];
    const code = result?.error?.code || "";
    if (
      !result?.success &&
      (code.includes("registration-token-not-registered") ||
        code.includes("invalid-registration-token"))
    ) {
      invalidTokens.push(token);
    }
  });

  if (invalidTokens.length > 0) {
    const update = { $pull: { fcmTokens: { $in: invalidTokens } } };
    if (data.recipientRole === "admin") {
      await Admin.updateOne({ _id: recipientId }, update);
    } else if (data.recipientRole === "vendor") {
      await Vendor.updateOne({ _id: recipientId }, update);
    } else {
      await User.updateOne({ _id: recipientId }, update);
    }
  }
};

export const createNotification = async (data: CreateNotificationData) => {
  const notification = await Notification.create({
    recipient: new Types.ObjectId(data.recipient),
    recipientRole: data.recipientRole,
    type: data.type,
    title: data.title,
    message: data.message,
    relatedId: data.relatedId ? new Types.ObjectId(data.relatedId) : undefined,
  });

  if (data.recipientRole !== "user") {
    // Keep SSE for compatibility with any older open client connection.
    emitNotification(data.recipientRole, data.recipient.toString(), notification);
  }

  const delivery = deliverNotification(data, notification._id.toString()).catch(
    (error) => console.error("Firebase notification delivery failed:", error),
  );
  if (!data.deferDelivery) await delivery;

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

  if (role === "user") {
    return User.findByIdAndUpdate(
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

  if (role === "user") {
    return User.findByIdAndUpdate(
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

export const notifyCustomerAboutOrderStatus = async (
  customerId: string,
  orderId: string,
  status: string,
) => {
  const messages: Record<string, string> = {
    Placed: "Your order has been placed successfully.",
    Accepted: "Good news! Your order has been accepted.",
    "Out for Delivery": "Your order is on its way!",
    Delivered: "Your order has been delivered.",
  };
  const message = messages[status];
  if (!message) return;

  return createNotification({
    recipient: customerId,
    recipientRole: "user",
    type: "ORDER_STATUS_UPDATED",
    title: `Order ${status}`,
    message,
    relatedId: orderId,
    data: { event: "ORDER_STATUS_UPDATED", orderId, status },
    deferDelivery: true,
  });
};

interface PublishedOfferNotification {
  offerId: string;
  title: string;
  message: string;
  redirectType: "category" | "product";
  redirectValue: string;
}

export const notifyEligibleCustomersAboutOffer = async (
  offer: PublishedOfferNotification,
) => {
  const cursor = User.find({
    fcmTokens: { $exists: true, $ne: [] },
  })
    .select("_id")
    .lean()
    .cursor();

  const recipients: string[] = [];

  for await (const customer of cursor) {
    recipients.push(customer._id.toString());

    if (recipients.length < 25) continue;

    await Promise.all(
      recipients.splice(0).map((customerId) =>
        createNotification({
          recipient: customerId,
          recipientRole: "user",
          type: "NEW_OFFER",
          title: offer.title,
          message: offer.message,
          relatedId: offer.offerId,
          data: {
            event: "NEW_OFFER",
            type: "NEW_OFFER",
            offerId: offer.offerId,
            role: "user",
            title: offer.title,
            message: offer.message,
            redirectType: offer.redirectType,
            redirectValue: offer.redirectValue,
          },
          deferDelivery: true,
        }),
      ),
    );
  }

  if (recipients.length > 0) {
    await Promise.all(
      recipients.map((customerId) =>
        createNotification({
          recipient: customerId,
          recipientRole: "user",
          type: "NEW_OFFER",
          title: offer.title,
          message: offer.message,
          relatedId: offer.offerId,
          data: {
            event: "NEW_OFFER",
            type: "NEW_OFFER",
            offerId: offer.offerId,
            role: "user",
            title: offer.title,
            message: offer.message,
            redirectType: offer.redirectType,
            redirectValue: offer.redirectValue,
          },
          deferDelivery: true,
        }),
      ),
    );
  }
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
