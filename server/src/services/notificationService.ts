import { Types } from "mongoose";
import Notification, {
  NotificationRole,
  NotificationType,
} from "../models/Notification";
import Admin from "../models/Admin";
import Vendor from "../models/Vendor";
import User from "../models/User";
import Order from "../models/Order";
import { createPaginationMeta, getPagination } from "../utils/pagination";
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
  sender?: string;
  senderRole?: "admin" | "vendor";
  category?: string;
  idempotencyKey?: string;
}

const deliverNotification = async (data: CreateNotificationData, notificationId: string) => {
  const recipientId = data.recipient.toString();
  const recipient =
    data.recipientRole === "admin"
      ? await Admin.findById(recipientId).select("fcmTokens").lean()
      : data.recipientRole === "vendor"
        ? await Vendor.findById(recipientId).select("fcmTokens").lean()
        : await User.findById(recipientId).select("fcmTokens").lean();

  if (!recipient?.fcmTokens?.length) return { attempted: 0, accepted: 0, failed: 0, skipped: 1 };

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
  let accepted = 0;
  let failed = 0;
  response.tokens.forEach((token, index) => {
    const result = response.responses[index];
    if (result?.success) accepted += 1;
    else failed += 1;
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
    try {
      if (data.recipientRole === "admin") await Admin.updateOne({ _id: recipientId }, update);
      else if (data.recipientRole === "vendor") await Vendor.updateOne({ _id: recipientId }, update);
      else await User.updateOne({ _id: recipientId }, update);
    } catch (error) { console.error("Invalid FCM token cleanup failed:", error); }
  }
  return { attempted: response.tokens.length, accepted, failed, skipped: 0 };
};

export const createNotification = async (data: CreateNotificationData) => {
  let notification;
  try {
    notification = await Notification.create({
      recipient: new Types.ObjectId(data.recipient),
      recipientRole: data.recipientRole,
      type: data.type,
      title: data.title,
      message: data.message,
      relatedId: data.relatedId ? new Types.ObjectId(data.relatedId) : undefined,
      sender: data.sender ? new Types.ObjectId(data.sender) : undefined,
      senderRole: data.senderRole,
      category: data.category,
      idempotencyKey: data.idempotencyKey,
      dispatchStatus: data.deferDelivery ? "stored" : "stored",
    });
  } catch (error: any) {
    if (error?.code === 11000 && data.idempotencyKey) {
      return Notification.findOne({ recipient: data.recipient, recipientRole: data.recipientRole, idempotencyKey: data.idempotencyKey });
    }
    throw error;
  }

  if (data.recipientRole !== "user") {
    // Keep SSE for compatibility with any older open client connection.
    emitNotification(data.recipientRole, data.recipient.toString(), notification);
  }

  const delivery = deliverNotification(data, notification._id.toString())
    .then(async (result) => {
      const dispatchStatus = result.attempted === 0 ? "no_devices" : result.failed === 0 ? "accepted" : result.accepted === 0 ? "failed" : "partial";
      await Notification.updateOne({ _id: notification._id }, { $set: { dispatchStatus, acceptedCount: result.accepted, failedCount: result.failed } });
      return result;
    })
    .catch(async (error) => {
      console.error("Firebase notification delivery failed:", error);
      await Notification.updateOne({ _id: notification._id }, { $set: { dispatchStatus: "failed", failedCount: 1 } });
      return { attempted: 1, accepted: 0, failed: 1, skipped: 0 };
    });
  const deliveryResult = await delivery;

  return Object.assign(notification, { deliveryResult });
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
  options: { senderId?: string; senderRole?: "admin" | "vendor"; audience?: "all" | "vendor_customers"; idempotencyKey?: string } = {},
) => {
  const cursor = User.find({})
    .select("_id")
    .lean()
    .cursor();

  const recipients: string[] = [];
  const totals = { stored: 0, attempted: 0, accepted: 0, failed: 0, skipped: 0 };
  const dispatch = async (ids: string[]) => {
    const result = await Promise.allSettled(ids.map((customerId) => createNotification({
      recipient: customerId,
      recipientRole: "user",
      type: "NEW_OFFER",
      title: offer.title,
      message: offer.message,
      relatedId: offer.offerId,
      sender: options.senderId,
      senderRole: options.senderRole,
      category: "offer",
      idempotencyKey: options.idempotencyKey ? `${options.idempotencyKey}:${customerId}` : undefined,
      data: {
        event: "NEW_OFFER", type: "NEW_OFFER", offerId: offer.offerId,
        role: "user", title: offer.title, message: offer.message,
        redirectType: offer.redirectType, redirectValue: offer.redirectValue,
      },
      deferDelivery: true,
    })));
    result.forEach((outcome: any) => {
      if (outcome.status === "rejected") { totals.failed += 1; totals.attempted += 1; return; }
      const record = outcome.value;
      totals.stored += 1;
      const stats = record?.deliveryResult;
      if (!stats) { totals.skipped += 1; return; }
      totals.attempted += stats.attempted;
      totals.accepted += stats.accepted;
      totals.failed += stats.failed;
      totals.skipped += stats.skipped;
    });
  };

  for await (const customer of cursor) {
    recipients.push(customer._id.toString());

    if (recipients.length < 25) continue;

    await dispatch(recipients.splice(0));
  }

  if (recipients.length > 0) {
    await dispatch(recipients);
  }
  return totals;
};

export const getNotifications = async (
  recipient: string,
  recipientRole: NotificationRole,
) => {
  return Notification.find({ recipient, recipientRole, deletedAt: null })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
};

export const markNotificationAsRead = async (
  notificationId: string,
  recipient: string,
  recipientRole: NotificationRole,
) => {
  return Notification.findOneAndUpdate(
    { _id: notificationId, recipient, recipientRole, deletedAt: null },
    { isRead: true },
    { new: true },
  ).lean();
};

export const markAllNotificationsAsRead = async (recipient: string, recipientRole: NotificationRole) => {
  await Notification.updateMany(
    { recipient, recipientRole, deletedAt: null, isRead: false },
    { $set: { isRead: true } },
  );
};

export const getEligibleCustomers = async (actorRole: "admin" | "vendor", vendorId: string | undefined, page?: unknown, limit?: unknown, search?: unknown) => {
  const pagination = getPagination(page, limit, 20);
  const term = typeof search === "string" ? search.trim().slice(0, 100) : "";
  const filter: Record<string, any> = {};
  if (term) filter.$or = [
    { name: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
    { email: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
    { phone: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
  ];
  if (actorRole === "vendor") {
    if (!vendorId) throw new Error("Vendor identity is required");
    const rows = await Order.aggregate([
      { $match: { "items.vendor": new Types.ObjectId(vendorId) } },
      { $group: { _id: "$user" } },
    ]);
    filter._id = { $in: rows.map((row) => row._id) };
  }
  const [data, totalItems] = await Promise.all([
    User.find(filter).select("name email phone").sort({ name: 1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    User.countDocuments(filter),
  ]);
  return { data, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

export const sendManualNotification = async (args: {
  senderId: string; senderRole: "admin" | "vendor"; recipientId?: string; audience: "individual" | "all";
  type: "CUSTOM" | "NEW_OFFER"; title: string; message: string; category: string;
  relatedId?: string; data?: Record<string, string>; idempotencyKey?: string;
}) => {
  let individualRecipient: string | undefined;
  if (args.audience === "individual") {
    if (!args.recipientId || !Types.ObjectId.isValid(args.recipientId)) throw new Error("A valid customerId is required");
    if (args.senderRole === "vendor") {
      const eligible = await Order.exists({ user: args.recipientId, "items.vendor": args.senderId });
      if (!eligible) throw new Error("Customer has not ordered from this vendor");
    }
    const userExists = await User.exists({ _id: args.recipientId });
    if (!userExists) throw new Error("Customer not found");
    individualRecipient = args.recipientId;
  }
  const totals = { attempted: 0, accepted: 0, failed: 0, skipped: 0 };
  let stored = 0;
  let recipientCount = 0;
  const dispatchBatch = async (batch: string[]) => {
    const records = await Promise.allSettled(batch.map((recipient) => createNotification({
      recipient, recipientRole: "user", type: args.type, title: args.title, message: args.message,
      relatedId: args.relatedId, data: args.data, sender: args.senderId, senderRole: args.senderRole,
      category: args.category, idempotencyKey: args.idempotencyKey ? `${args.idempotencyKey}:${recipient}` : undefined,
    })));
    records.forEach((outcome: any) => {
      if (outcome.status === "rejected") { totals.failed += 1; totals.attempted += 1; return; }
      const record = outcome.value;
      stored += 1;
      const stats = record?.deliveryResult;
      if (!stats) { totals.skipped += 1; return; }
      totals.attempted += stats.attempted; totals.accepted += stats.accepted;
      totals.failed += stats.failed; totals.skipped += stats.skipped;
    });
    recipientCount += batch.length;
  };
  if (individualRecipient) {
    await dispatchBatch([individualRecipient]);
  } else {
    const cursor = User.find({}).select("_id").lean().cursor();
    let batch: string[] = [];
    for await (const user of cursor) {
      batch.push(user._id.toString());
      if (batch.length === 25) { await dispatchBatch(batch); batch = []; }
    }
    if (batch.length) await dispatchBatch(batch);
  }
  return { ...totals, recipients: recipientCount, stored };
};

export const getManagedNotificationHistory = async (senderId: string, senderRole: "admin" | "vendor", page?: unknown, limit?: unknown) => {
  const pagination = getPagination(page, limit, 20);
  const filter = { sender: senderId, senderRole, deletedAt: null };
  const [data, totalItems] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).select("title message category type relatedId dispatchStatus acceptedCount failedCount createdAt sender senderRole").lean(),
    Notification.countDocuments(filter),
  ]);
  return { data, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

export const deleteManagedNotification = async (notificationId: string, senderId: string, senderRole: "admin" | "vendor") => {
  if (!Types.ObjectId.isValid(notificationId)) throw new Error("Notification not found");
  return Notification.findOneAndUpdate({ _id: notificationId, sender: senderId, senderRole, deletedAt: null }, { $set: { deletedAt: new Date() } }, { new: true }).lean();
};
