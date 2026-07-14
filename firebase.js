// ─── Firebase Core ────────────────────────────────────────
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { doc, getFirestore, setDoc } from "firebase/firestore";

// ─── Expo Notifications (untuk ambil FCM token) ───────────
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

// ─── Konfigurasi Firebase ─────────────────────────────────
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// ─── Initialize Firebase (singleton) ─────────────────────
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

export const auth = getAuth(app);
export const db   = getFirestore(app);
export default app;

// ─────────────────────────────────────────────────────────
// FUNGSI FCM: Ambil Expo Push Token lalu simpan ke Firestore
// ─────────────────────────────────────────────────────────
export async function registerFCMToken(uid) {
  if (!Device.isDevice) {
    console.log("FCM hanya jalan di device fisik.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Izin notifikasi ditolak user.");
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const token = tokenData.data;

  try {
    await setDoc(
      doc(db, "users", uid),
      { fcmToken: token, fcmUpdatedAt: new Date().toISOString() },
      { merge: true }
    );
    console.log("FCM token tersimpan:", token);
  } catch (e) {
    console.error("Gagal simpan FCM token:", e);
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  false,
    }),
  });

  return token;
}

// ─────────────────────────────────────────────────────────
// FUNGSI JADWAL: Simpan preferensi jam notifikasi ke Firestore
// ─────────────────────────────────────────────────────────
export async function saveNotifSchedule(uid, pagi, sore, malam) {
  await setDoc(
    doc(db, "users", uid),
    {
      notifSchedule: { pagi, sore, malam },
      notifScheduleUpdatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}