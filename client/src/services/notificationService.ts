import api from "./api";
import type { Notification } from "../types/notification";

export const getNotifications = async (): Promise<Notification[]> => {
  const response = await api.get("/notifications");
  return response.data?.data ?? [];
};

export const markNotificationAsRead = async (notificationId: string) => {
  const response = await api.patch(`/notifications/${notificationId}/read`);
  return response.data;
};

export const markAllNotificationsAsRead = async () => {
  const response = await api.patch("/notifications/read-all");
  return response.data;
};
