import { firebaseAdminMessaging } from "../config/firebaseAdmin";

interface FcmNotificationPayload {
  notificationId: string;
  type: "NEW_ORDER" | "NEW_VENDOR" | "ORDER_STATUS_UPDATED" | "NEW_OFFER" | "CUSTOM" | "CUSTOM_MESSAGE";
  title: string;
  message: string;
  relatedId?: string;
  role: "admin" | "vendor" | "user";
  data?: Record<string, string>;
}

const FCM_MULTICAST_LIMIT = 500;

export const sendFirebaseNotification = async (
  tokens: string[],
  payload: FcmNotificationPayload,
) => {
  const uniqueTokens = [...new Set(tokens.filter(Boolean))];

  if (uniqueTokens.length === 0) {
    return { responses: [], tokens: [] };
  }

  const responses = [] as Awaited<
    ReturnType<typeof firebaseAdminMessaging.sendEachForMulticast>
  >["responses"];

  for (let index = 0; index < uniqueTokens.length; index += FCM_MULTICAST_LIMIT) {
    const tokens = uniqueTokens.slice(index, index + FCM_MULTICAST_LIMIT);
    const response = await firebaseAdminMessaging.sendEachForMulticast({
      tokens,
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
        ...(payload.role === "user"
          ? {}
          : {
              url:
                payload.type === "NEW_ORDER"
                  ? "/vendor/orders"
                  : "/admin/vendors",
            }),
        createdAt: new Date().toISOString(),
        ...payload.data,
      },
      ...(payload.role === "user"
        ? {}
        : {
            webpush: {
              fcmOptions: {
                link:
                  payload.type === "NEW_ORDER"
                    ? "/vendor/orders"
                    : "/admin/vendors",
              },
            },
          }),
    });
    responses.push(...response.responses);
  }

  return { responses, tokens: uniqueTokens };
};
