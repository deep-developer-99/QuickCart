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
import UserNotification, { IUserNotification, UserNotificationType } from "../models/UserNotification";
import { createHash, randomUUID } from "crypto";
import Offer from "../models/Offer";
import Category from "../models/Category";
import Product from "../models/Product";

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
  vendorId: string,
) => {
  const messages: Record<string, string> = {
    Placed: "Your order has been placed successfully.",
    Accepted: "Good news! Your order has been accepted.",
    "Out for Delivery": "Your order is on its way!",
    Delivered: "Your order has been delivered.",
  };
  const message = messages[status];
  if (!message) return;

  const order = await Order.findById(orderId).select("user").lean();
  if (!order || order.user.toString() !== customerId) return;
  return createUserCampaign({
    recipients: [customerId], senderId: vendorId, senderRole: "vendor",
    type: "ORDER_STATUS_UPDATED", category: "announcement", title: `Order ${status}`, message,
    relatedId: orderId, action: { type: "order", id: orderId },
    data: { event: "ORDER_STATUS_UPDATED", orderId, status }, campaignId: randomUUID(),
  });
};

interface PublishedOfferNotification {
  offerId: string;
  title: string;
  message: string;
  redirectType: "category" | "product";
  redirectValue: string;
}

const deliverUserNotification = async (record: IUserNotification, data?: Record<string, string>) => {
  const recipient = await User.findById(record.recipient).select("fcmTokens").lean();
  const tokens = recipient?.fcmTokens ?? [];
  if (!tokens.length) {
    await UserNotification.updateOne({ _id: record._id }, { $set: { dispatchStatus: "no_devices", skippedCount: 1 } });
    return { attempted: 0, accepted: 0, failed: 0, skipped: 1 };
  }
  try {
    const response = await sendFirebaseNotification(tokens, {
      notificationId: record._id.toString(), type: record.type === "CUSTOM_MESSAGE" ? "CUSTOM_MESSAGE" : record.type,
      title: record.title, message: record.message, relatedId: record.relatedId?.toString(), role: "user", data,
    });
    const accepted = response.responses.filter((item) => item.success).length;
    const failed = response.responses.length - accepted;
    const invalid = response.responses.flatMap((item, index) => {
      const code = item.error?.code ?? "";
      return !item.success && (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) ? [response.tokens[index]] : [];
    });
    if (invalid.length) await User.updateOne({ _id: record.recipient }, { $pull: { fcmTokens: { $in: invalid } } });
    const dispatchStatus = accepted === 0 ? "failed" : failed ? "partial" : "accepted";
    await UserNotification.updateOne({ _id: record._id }, { $set: { dispatchStatus, attemptedCount: response.tokens.length, acceptedCount: accepted, failedCount: failed, skippedCount: 0 } });
    return { attempted: response.tokens.length, accepted, failed, skipped: 0 };
  } catch (error) {
    console.error("Firebase customer notification delivery failed:", error);
    await UserNotification.updateOne({ _id: record._id }, { $set: { dispatchStatus: "failed", attemptedCount: tokens.length, acceptedCount: 0, failedCount: tokens.length, skippedCount: 0 } });
    return { attempted: tokens.length, accepted: 0, failed: tokens.length, skipped: 0 };
  }
};

const createUserCampaign = async (args: {
  recipients?: string[]; recipientCursor?: AsyncIterable<{ _id: Types.ObjectId }>;
  senderId: string; senderRole: "admin" | "vendor"; campaignId: string;
  type: UserNotificationType; category: "offer" | "announcement"; title: string; message: string;
  relatedId?: string; action?: IUserNotification["action"]; data?: Record<string, string>;
  requestFingerprint?: string;
}) => {
  const totals = { campaignId: args.campaignId, recipients: 0, stored: 0, attempted: 0, accepted: 0, failed: 0, skipped: 0 };
  const existingCampaign = await UserNotification.find({ campaignId: args.campaignId })
    .select("+requestFingerprint recipient attemptedCount acceptedCount failedCount skippedCount")
    .lean();
  if (existingCampaign.length) {
    if (!args.requestFingerprint || existingCampaign.some((record) => record.requestFingerprint !== args.requestFingerprint)) {
      throw new Error("Idempotency-Key was already used for a different campaign or an earlier request");
    }
    return {
      ...totals,
      duplicate: true,
      recipients: existingCampaign.length,
      stored: existingCampaign.length,
      attempted: existingCampaign.reduce((sum, row) => sum + row.attemptedCount, 0),
      accepted: existingCampaign.reduce((sum, row) => sum + row.acceptedCount, 0),
      failed: existingCampaign.reduce((sum, row) => sum + row.failedCount, 0),
      skipped: existingCampaign.reduce((sum, row) => sum + row.skippedCount, 0),
    };
  }
  const sendBatch = async (ids: string[]) => {
    if (!ids.length) return;
    const previouslyStored = await UserNotification.find({ campaignId: args.campaignId, recipient: { $in: ids } }).distinct("recipient");
    const existing = new Set(previouslyStored.map((id) => id.toString()));
    const pendingIds = ids.filter((id) => !existing.has(id));
    if (!pendingIds.length) return;
    // Persist the entire recipient batch before any Firebase attempt.
    const records = await UserNotification.insertMany(pendingIds.map((recipient) => ({
      recipient: new Types.ObjectId(recipient), recipientRole: "user", sender: new Types.ObjectId(args.senderId), senderRole: args.senderRole,
      campaignId: args.campaignId, type: args.type, category: args.category, title: args.title, message: args.message,
      requestFingerprint: args.requestFingerprint,
      relatedId: args.relatedId ? new Types.ObjectId(args.relatedId) : undefined, action: args.action ?? { type: "none" }, dispatchStatus: "stored",
    })), { ordered: false });
    totals.recipients += pendingIds.length;
    totals.stored += records.length;
    // Process individually so one Firebase failure does not affect other recipients.
    for (const record of records) {
      const result = await deliverUserNotification(record, args.data);
      totals.attempted += result.attempted; totals.accepted += result.accepted; totals.failed += result.failed; totals.skipped += result.skipped;
    }
  };
  let batch: string[] = [];
  if (args.recipients) {
    for (const id of args.recipients) {
      if (!Types.ObjectId.isValid(id)) continue;
      batch.push(id);
      if (batch.length === 25) { await sendBatch(batch); batch = []; }
    }
  } else if (args.recipientCursor) {
    for await (const user of args.recipientCursor) {
      batch.push(user._id.toString());
      if (batch.length === 25) { await sendBatch(batch); batch = []; }
    }
  }
  if (batch.length) await sendBatch(batch);
  return totals;
};

export const notifyEligibleCustomersAboutOffer = async (
  offer: PublishedOfferNotification,
  options: { senderId?: string; senderRole?: "admin" | "vendor"; audience?: "all" | "vendor_customers"; idempotencyKey?: string; campaignId?: string } = {},
) => {
  const senderId = options.senderId;
  const senderRole = options.senderRole;
  if (!senderId || !senderRole) throw new Error("Notification sender is required");
  const offerDoc = await Offer.findOne({ _id: offer.offerId, status: "published", deletedAt: null }).lean();
  if (!offerDoc) throw new Error("Published offer is not available");
  const destination = Types.ObjectId.isValid(offerDoc.redirectValue) && (offerDoc.redirectType === "category"
    ? await Category.exists({ _id: offerDoc.redirectValue, isActive: true })
    : await Product.exists({ _id: offerDoc.redirectValue, isActive: true }));
  if (!destination) throw new Error("Offer destination is not available");
  const campaignId = options.campaignId ?? (options.idempotencyKey ? `offer:${offer.offerId}:${options.idempotencyKey}` : randomUUID());
  const audience = options.audience === "vendor_customers" && senderRole === "vendor"
    ? await Order.distinct("user", { "items.vendor": senderId })
    : undefined;
  return createUserCampaign({
    recipients: audience?.map((id) => id.toString()), recipientCursor: audience ? undefined : User.find({}).select("_id").lean().cursor(),
    senderId, senderRole, campaignId, type: "NEW_OFFER", category: "offer", title: offerDoc.title,
    message: offerDoc.message, relatedId: offerDoc._id.toString(),
    action: { type: "offer", id: offerDoc._id.toString(), redirectType: offerDoc.redirectType, redirectValue: offerDoc.redirectValue },
    data: { event: "NEW_OFFER", type: "NEW_OFFER", offerId: offerDoc._id.toString(), role: "user", title: offerDoc.title, message: offerDoc.message, redirectType: offerDoc.redirectType, redirectValue: offerDoc.redirectValue },
  });
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
  senderId: string; senderRole: "admin" | "vendor"; recipientId?: string; recipientIds?: string[]; audience: "individual" | "all";
  type: "CUSTOM" | "NEW_OFFER"; title: string; message: string; category: string;
  relatedId?: string; data?: Record<string, string>; action?: IUserNotification["action"]; idempotencyKey?: string;
}) => {
  let recipients: string[] | undefined;
  let recipientCursor: AsyncIterable<{ _id: Types.ObjectId }> | undefined;
  let requestRecipients: string[] | "all";
  if (args.audience === "individual") {
    const requested = args.recipientIds ?? (args.recipientId ? [args.recipientId] : []);
    if (!requested.length) throw new Error("At least one customerId is required");
    if (requested.length > 500) throw new Error("A targeted campaign can include at most 500 customers");
    if (requested.some((id) => !/^[a-f\d]{24}$/i.test(id))) throw new Error("Every customer ID must be a valid MongoDB ObjectId");
    recipients = [...new Set(requested.map((id) => new Types.ObjectId(id).toString()))];
    const foundCustomers = await User.find({ _id: { $in: recipients } }).distinct("_id");
    if (foundCustomers.length !== recipients.length) throw new Error("One or more selected customers do not exist or are not eligible");
    if (args.senderRole === "vendor") {
      const orderedCustomers = await Order.distinct("user", { user: { $in: recipients }, "items.vendor": args.senderId });
      if (orderedCustomers.length !== recipients.length) throw new Error("One or more customers are not eligible: they have not ordered from this vendor");
    }
    requestRecipients = recipients;
  } else if (args.senderRole === "vendor") {
    recipients = (await Order.distinct("user", { "items.vendor": args.senderId })).map((id) => id.toString());
    requestRecipients = "all";
  } else {
    recipientCursor = User.find({}).select("_id").lean().cursor();
    requestRecipients = "all";
  }
  const campaignId = args.idempotencyKey ? `manual:${args.senderRole}:${args.senderId}:${args.idempotencyKey}` : randomUUID();
  const requestFingerprint = createHash("sha256").update(JSON.stringify({
    senderId: args.senderId,
    senderRole: args.senderRole,
    audience: args.audience,
    recipients: typeof requestRecipients === "string" ? requestRecipients : [...requestRecipients].sort(),
    type: args.type,
    category: args.category,
    title: args.title,
    message: args.message,
    relatedId: args.relatedId,
  })).digest("hex");
  return createUserCampaign({
    recipients, recipientCursor, senderId: args.senderId, senderRole: args.senderRole, campaignId,
    type: args.type === "CUSTOM" ? "CUSTOM_MESSAGE" : args.type,
    category: args.category === "offer" ? "offer" : "announcement", title: args.title, message: args.message,
    relatedId: args.relatedId, action: args.action, data: args.data,
    requestFingerprint,
  });
};

export const getManagedNotificationHistory = async (senderId: string, senderRole: "admin" | "vendor", page?: unknown, limit?: unknown, filters: { search?: unknown; category?: unknown; senderRole?: unknown; campaignId?: unknown; from?: unknown; to?: unknown } = {}) => {
  const pagination = getPagination(page, limit, 20);
  const match: Record<string, any> = { deletedAt: null };
  if (senderRole === "vendor") Object.assign(match, { sender: senderId, senderRole });
  else if (filters.senderRole === "admin" || filters.senderRole === "vendor") match.senderRole = filters.senderRole;
  if (filters.category === "offer" || filters.category === "announcement") match.category = filters.category;
  if (typeof filters.campaignId === "string" && filters.campaignId.trim()) match.campaignId = filters.campaignId.trim();
  if (typeof filters.search === "string" && filters.search.trim()) {
    const term = filters.search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    match.$or = [{ title: { $regex: term, $options: "i" } }, { message: { $regex: term, $options: "i" } }];
  }
  const date: Record<string, Date> = {};
  if (typeof filters.from === "string" && !Number.isNaN(Date.parse(filters.from))) date.$gte = new Date(filters.from);
  if (typeof filters.to === "string" && !Number.isNaN(Date.parse(filters.to))) date.$lte = new Date(filters.to);
  if (Object.keys(date).length) match.createdAt = date;
  const pipeline: any[] = [
    { $match: match },
    { $group: { _id: "$campaignId", title: { $first: "$title" }, message: { $first: "$message" }, category: { $first: "$category" }, type: { $first: "$type" }, relatedId: { $first: "$relatedId" }, action: { $first: "$action" }, sender: { $first: "$sender" }, senderRole: { $first: "$senderRole" }, createdAt: { $min: "$createdAt" }, updatedAt: { $max: "$updatedAt" }, recipientCount: { $sum: 1 }, stored: { $sum: 1 }, attempted: { $sum: "$attemptedCount" }, accepted: { $sum: "$acceptedCount" }, failed: { $sum: "$failedCount" }, skipped: { $sum: "$skippedCount" }, statuses: { $push: "$dispatchStatus" } } },
    { $sort: { createdAt: -1 } },
    { $facet: { data: [{ $skip: pagination.skip }, { $limit: pagination.limit }], total: [{ $count: "count" }] } },
  ];
  const [result] = await UserNotification.aggregate(pipeline);
  const totalItems = result?.total?.[0]?.count ?? 0;
  const data = (result?.data ?? []).map((campaign: any) => ({ ...campaign, dispatchStatus: campaign.statuses.every((s: string) => s === "accepted") ? "accepted" : campaign.statuses.some((s: string) => s === "accepted" || s === "partial") ? "partial" : campaign.statuses.every((s: string) => s === "no_devices") ? "no_devices" : campaign.statuses.every((s: string) => s === "stored") ? "stored" : "failed", statuses: undefined }));
  return { data, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

const campaignAccessFilter = (campaignId: string, senderId: string, senderRole: "admin" | "vendor") => ({ campaignId, ...(senderRole === "vendor" ? { sender: senderId, senderRole } : {}) });

export const editManagedNotification = async (campaignId: string, senderId: string, senderRole: "admin" | "vendor", input: { title: string; message: string }) => {
  const title = input.title.trim(), message = input.message.trim();
  if (!title || title.length > 120 || !message || message.length > 240) throw new Error("Title and message are required (up to 120 and 240 characters)");
  const filter = { ...campaignAccessFilter(campaignId, senderId, senderRole), deletedAt: null };
  const existing = await UserNotification.findOne(filter).select("campaignId").lean();
  if (!existing) return null;
  if (!(await UserNotification.updateMany(filter, { $set: { title, message } })).matchedCount) return null;
  return { campaignId, title, message };
};

export const deleteManagedNotification = async (campaignId: string, senderId: string, senderRole: "admin" | "vendor") => {
  const filter = { ...campaignAccessFilter(campaignId, senderId, senderRole), deletedAt: null };
  const first = await UserNotification.findOne(filter).select("campaignId").lean();
  if (!first) return null;
  const deletedAt = new Date();
  await UserNotification.updateMany(filter, { $set: { deletedAt } });
  return { campaignId, deletedAt };
};

export const resendManagedNotification = async (campaignId: string, senderId: string, senderRole: "admin" | "vendor", idempotencyKey: string) => {
  const key = idempotencyKey.trim().slice(0, 100);
  if (!key) throw new Error("Idempotency-Key header is required");
  const filter = { ...campaignAccessFilter(campaignId, senderId, senderRole), deletedAt: null };
  const records = await UserNotification.find(filter).sort({ _id: 1 }).lean();
  if (!records.length) throw new Error("Notification campaign not found");
  const first = records[0];
  let data: Record<string, string> = { event: first.type, role: "user" };
  if (first.type === "NEW_OFFER") {
    const offer = first.relatedId && await Offer.findOne({ _id: first.relatedId, status: "published", deletedAt: null }).lean();
    if (!offer) throw new Error("Published offer is no longer available");
    const destination = Types.ObjectId.isValid(offer.redirectValue) && (offer.redirectType === "category" ? await Category.exists({ _id: offer.redirectValue, isActive: true }) : await Product.exists({ _id: offer.redirectValue, isActive: true }));
    if (!destination) throw new Error("Offer destination is no longer available");
    data = { event: "NEW_OFFER", type: "NEW_OFFER", offerId: offer._id.toString(), role: "user", title: first.title, message: first.message, redirectType: offer.redirectType, redirectValue: offer.redirectValue };
  } else if (first.type === "ORDER_STATUS_UPDATED" && first.relatedId) {
    data = { event: "ORDER_STATUS_UPDATED", orderId: first.relatedId.toString(), role: "user" };
  } else data = { event: "CUSTOM", type: "CUSTOM_MESSAGE", role: "user" };
  const anchor = await UserNotification.findOneAndUpdate({ ...filter, resendKeys: { $ne: key } }, { $addToSet: { resendKeys: key } }, { new: true });
  if (!anchor) {
    const latest = await UserNotification.find(filter).select("attemptedCount acceptedCount failedCount skippedCount").lean();
    return { duplicate: true, campaignId, recipients: latest.length, attempted: latest.reduce((sum, row) => sum + row.attemptedCount, 0), accepted: latest.reduce((sum, row) => sum + row.acceptedCount, 0), failed: latest.reduce((sum, row) => sum + row.failedCount, 0), skipped: latest.reduce((sum, row) => sum + row.skippedCount, 0) };
  }
  const totals = { duplicate: false, campaignId, recipients: records.length, attempted: 0, accepted: 0, failed: 0, skipped: 0 };
  for (const record of records) {
    const result = await deliverUserNotification(record as IUserNotification, data);
    totals.attempted += result.attempted; totals.accepted += result.accepted; totals.failed += result.failed; totals.skipped += result.skipped;
  }
  return totals;
};
