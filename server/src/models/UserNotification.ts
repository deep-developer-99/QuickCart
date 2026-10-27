import mongoose, { Document, Schema, Types } from "mongoose";

export type UserNotificationType = "NEW_OFFER" | "ORDER_STATUS_UPDATED" | "CUSTOM_MESSAGE";
export type UserNotificationDispatchStatus = "stored" | "accepted" | "partial" | "failed" | "no_devices";

export interface IUserNotification extends Document {
  recipient: Types.ObjectId;
  recipientRole: "user";
  sender: Types.ObjectId;
  senderRole: "admin" | "vendor";
  campaignId: string;
  requestFingerprint?: string;
  type: UserNotificationType;
  category: "offer" | "announcement";
  title: string;
  message: string;
  relatedId?: Types.ObjectId;
  action?: { type: "offer" | "order" | "none"; id?: string; redirectType?: "category" | "product"; redirectValue?: string };
  isRead: boolean;
  dispatchStatus: UserNotificationDispatchStatus;
  attemptedCount: number;
  acceptedCount: number;
  failedCount: number;
  skippedCount: number;
  deletedAt?: Date | null;
  resendKeys: string[];
  createdAt: Date;
  updatedAt: Date;
}

const actionSchema = new Schema({
  type: { type: String, enum: ["offer", "order", "none"], required: true },
  id: { type: String },
  redirectType: { type: String, enum: ["category", "product"] },
  redirectValue: { type: String },
}, { _id: false });

const userNotificationSchema = new Schema<IUserNotification>({
  recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
  recipientRole: { type: String, enum: ["user"], required: true, default: "user" },
  sender: { type: Schema.Types.ObjectId, required: true },
  senderRole: { type: String, enum: ["admin", "vendor"], required: true },
  campaignId: { type: String, required: true },
  requestFingerprint: { type: String, select: false },
  type: { type: String, enum: ["NEW_OFFER", "ORDER_STATUS_UPDATED", "CUSTOM_MESSAGE"], required: true },
  category: { type: String, enum: ["offer", "announcement"], required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 240 },
  relatedId: { type: Schema.Types.ObjectId },
  action: { type: actionSchema, default: { type: "none" } },
  isRead: { type: Boolean, default: false },
  dispatchStatus: { type: String, enum: ["stored", "accepted", "partial", "failed", "no_devices"], default: "stored" },
  attemptedCount: { type: Number, default: 0, min: 0 },
  acceptedCount: { type: Number, default: 0, min: 0 },
  failedCount: { type: Number, default: 0, min: 0 },
  skippedCount: { type: Number, default: 0, min: 0 },
  deletedAt: { type: Date, default: null },
  resendKeys: { type: [String], default: [] },
}, { timestamps: true, collection: "usersNotifications" });

userNotificationSchema.index({ recipient: 1, createdAt: -1 });
userNotificationSchema.index({ senderRole: 1, sender: 1, createdAt: -1 });
userNotificationSchema.index({ campaignId: 1, recipient: 1 }, { unique: true });

export default mongoose.models.UserNotification || mongoose.model<IUserNotification>("UserNotification", userNotificationSchema, "usersNotifications");
