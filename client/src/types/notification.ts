export type NotificationType = "NEW_ORDER" | "NEW_VENDOR";
export type NotificationRole = "admin" | "vendor";

export interface Notification {
  _id: string;
  recipient: string;
  recipientRole: NotificationRole;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}
