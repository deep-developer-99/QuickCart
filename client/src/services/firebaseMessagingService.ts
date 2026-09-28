import {
  getToken,
  onMessage,
  type MessagePayload,
  type Messaging,
} from "firebase/messaging";
import { getFirebaseMessaging } from "../config/firebase";
import api from "./api";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

let foregroundUnsubscribe: (() => void) | null = null;

export const registerFirebaseMessaging = async (): Promise<{
  token: string | null;
  messaging: Messaging | null;
}> => {
  if (!VAPID_KEY) {
    console.warn("VITE_FIREBASE_VAPID_KEY is missing.");
    return { token: null, messaging: null };
  }

  const messaging = await getFirebaseMessaging();

  if (!messaging) {
    return { token: null, messaging: null };
  }

  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers are not supported by this browser.");
    return { token: null, messaging };
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    console.warn("Browser notification permission was not granted.");
    return { token: null, messaging };
  }

  const serviceWorkerRegistration = await navigator.serviceWorker.register(
    "/firebase-messaging-sw.js",
  );

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration,
  });

  if (token) {
    await api.post("/notifications/fcm-token", { token });
  }

  return { token: token || null, messaging };
};

export const subscribeToForegroundMessages = (
  messaging: Messaging,
  callback: (payload: MessagePayload) => void,
) => {
  foregroundUnsubscribe?.();
  foregroundUnsubscribe = onMessage(messaging, callback);

  return () => {
    foregroundUnsubscribe?.();
    foregroundUnsubscribe = null;
  };
};

export const removeFirebaseMessagingToken = async (token: string) => {
  try {
    await api.delete("/notifications/fcm-token", {
      data: { token },
    });
  } catch (error) {
    console.error("Failed to remove FCM token:", error);
  }
};
