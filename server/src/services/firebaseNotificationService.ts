import { firebaseAdminMessaging } from "../config/firebaseAdmin";

interface FcmNotificationPayload {
  notificationId: string;
  type: "NEW_ORDER" | "NEW_VENDOR";
  title: string;
  message: string;
  relatedId?: string;
  role: "admin" | "vendor";
}

export const sendFirebaseNotification = async (
  tokens: string[],
  payload: FcmNotificationPayload,
) => {
  const uniqueTokens = [...new Set(tokens.filter(Boolean))];

  if (uniqueTokens.length === 0) {
    return;
  }

  const response = await firebaseAdminMessaging.sendEachForMulticast({
    tokens: uniqueTokens,
    notification: {
      title: payload.title,
      body: payload.message,
    },
    data: {
      notificationId: payload.notificationId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      relatedId: payload.relatedId ?? "",
      role: payload.role,
      url: payload.type === "NEW_ORDER" ? "/vendor/orders" : "/admin/vendors",
      createdAt: new Date().toISOString(),
    },
    webpush: {
      fcmOptions: {
        link:
          payload.type === "NEW_ORDER" ? "/vendor/orders" : "/admin/vendors",
      },
    },
  });

  return response;
};
