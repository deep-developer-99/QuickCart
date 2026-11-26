import api from "./api";
import type { Notification } from "../types/notification";
import { getPrivateCached, invalidatePrivateCache } from "./queryCache";
import { PRIVATE_CACHE_TTL_MS } from "./cachePolicy";

export const getNotifications = async (): Promise<Notification[]> => {
  const response = await getPrivateCached<{ data?: Notification[] }>("/notifications", {}, PRIVATE_CACHE_TTL_MS.notifications, ["Notifications"]);
  return response.data ?? [];
};

export const markNotificationAsRead = async (notificationId: string) => {
  const response = await api.patch(`/notifications/${notificationId}/read`);
  if (response.data?.success) invalidatePrivateCache(["Notifications"]);
  return response.data;
};

export const markAllNotificationsAsRead = async () => {
  const response = await api.patch("/notifications/read-all");
  if (response.data?.success) invalidatePrivateCache(["Notifications"]);
  return response.data;
};
