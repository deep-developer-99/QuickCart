import mongoose, { Document, Schema, Types } from "mongoose";

export type NotificationRole = "admin" | "vendor" | "user";
export type NotificationType =
  | "NEW_ORDER"
  | "NEW_VENDOR"
  | "ORDER_STATUS_UPDATED"
  | "NEW_OFFER"
  | "CUSTOM";

export interface INotification extends Document {
  recipient: Types.ObjectId;
  recipientRole: NotificationRole;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
  sender?: Types.ObjectId;
  senderRole?: "admin" | "vendor";
  category?: string;
  dispatchStatus?: "stored" | "accepted" | "partial" | "failed" | "no_devices";
  acceptedCount?: number;
  failedCount?: number;
  deletedAt?: Date;
  idempotencyKey?: string;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    recipientRole: {
      type: String,
      enum: ["admin", "vendor", "user"],
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["NEW_ORDER", "NEW_VENDOR", "ORDER_STATUS_UPDATED", "NEW_OFFER", "CUSTOM"],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    relatedId: {
      type: Schema.Types.ObjectId,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    sender: { type: Schema.Types.ObjectId, index: true },
    senderRole: { type: String, enum: ["admin", "vendor"], index: true },
    category: { type: String, trim: true, maxlength: 40 },
    dispatchStatus: { type: String, enum: ["stored", "accepted", "partial", "failed", "no_devices"], default: "stored" },
    acceptedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null, index: true },
    idempotencyKey: { type: String },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, recipientRole: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });
notificationSchema.index({ sender: 1, senderRole: 1, type: 1, createdAt: -1 });

const Notification = mongoose.model<INotification>(
  "Notification",
  notificationSchema,
);

export default Notification;
