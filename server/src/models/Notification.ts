import mongoose, { Document, Schema, Types } from "mongoose";

export type NotificationRole = "admin" | "vendor";
export type NotificationType = "NEW_ORDER" | "NEW_VENDOR";

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
      enum: ["admin", "vendor"],
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["NEW_ORDER", "NEW_VENDOR"],
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
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

const Notification = mongoose.model<INotification>(
  "Notification",
  notificationSchema,
);

export default Notification;
