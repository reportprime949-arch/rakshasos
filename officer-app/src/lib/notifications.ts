import { messaging } from "./firebase";
import { getToken } from "firebase/messaging";

export const requestNotificationPermission = async () => {
  try {
    const msg = await messaging();
    if (!msg) return null;

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const token = await getToken(msg, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      });
      console.log("FCM Token:", token);
      return token;
    }
  } catch (error) {
    console.error("Error requesting notification permission:", error);
  }
  return null;
};
