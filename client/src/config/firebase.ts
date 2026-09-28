import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(app);

let messagingPromise: Promise<Messaging | null> | null = null;

export const getFirebaseMessaging = async (): Promise<Messaging | null> => {
  if (!messagingPromise) {
    messagingPromise = isSupported()
      .then((supported) => (supported ? getMessaging(app) : null))
      .catch((error) => {
        console.error("Firebase Messaging is not supported:", error);
        return null;
      });
  }

  return messagingPromise;
};

export default app;
