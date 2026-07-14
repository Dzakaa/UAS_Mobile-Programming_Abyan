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
  apiKey: "AIzaSyAyRd3wGUSVB4tf6d_aY3i9swRtNHmYC-g",
  authDomain: "fir-project-f2523.firebaseapp.com",
  projectId: "fir-project-f2523",
  storageBucket: "fir-project-f2523.firebasestorage.app",
  messagingSenderId: "1092422901050",
  appId: "1:1092422901050:web:06f80cd735e7fed8fac403",
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
//
// Cara kerja:
// 1. Minta izin notifikasi dari user
// 2. Ambil Expo Push Token (format: ExponentPushToken[xxxx])
// 3. Simpan token ke Firestore: users/{uid}/fcmToken
// 4. Expo Push Service yang nanti kirim notif ke device
//    berdasarkan token ini — tidak butuh server sendiri!
// ─────────────────────────────────────────────────────────
export async function registerFCMToken(uid: string): Promise<string | null> {
  // Hanya jalan di device fisik (tidak di emulator/web)
  if (!Device.isDevice) {
    console.log("FCM hanya jalan di device fisik.");
    return null;
  }

  // 1. Minta izin notifikasi
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

  // 2. Ambil Expo Push Token
  // projectId diambil dari app.json → expo.extra.eas.projectId
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const token = tokenData.data;

  // 3. Simpan token ke Firestore agar Cloud Functions bisa baca
  try {
    await setDoc(
      doc(db, "users", uid),
      { fcmToken: token, fcmUpdatedAt: new Date().toISOString() },
      { merge: true }   // merge:true agar tidak overwrite field lain
    );
    console.log("FCM token tersimpan:", token);
  } catch (e) {
    console.error("Gagal simpan FCM token:", e);
  }

  // 4. Setting handler notifikasi saat app terbuka
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
//
// Cloud Functions akan baca ini dan kirim notif tepat waktu
// ke semua device yang punya akun tersebut
// ─────────────────────────────────────────────────────────
export async function saveNotifSchedule(
  uid: string,
  pagi:  string,   // format "HH:MM", contoh "07:00"
  sore:  string,   // format "HH:MM", contoh "15:00"
  malam: string    // format "HH:MM", contoh "20:00"
): Promise<void> {
  await setDoc(
    doc(db, "users", uid),
    {
      notifSchedule: { pagi, sore, malam },
      notifScheduleUpdatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
