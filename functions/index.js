const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Jalan setiap menit, cek siapa yang perlu dikirimi notif
exports.sendScheduledNotifications = functions.pubsub
  .schedule("every 1 minutes")
  .timeZone("Asia/Jakarta")
  .onRun(async () => {
    const now = new Date();
    const currentTime =
      String(now.getHours()).padStart(2, "0") + ":" +
      String(now.getMinutes()).padStart(2, "0");

    const usersSnap = await admin.firestore().collection("users").get();
    const messages = [];

    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data();
      const token    = data.fcmToken;
      const schedule = data.notifSchedule;
      if (!token || !schedule) continue;

      let title = null;
      let body  = null;

      if (schedule.pagi === currentTime) {
        title = "Selamat Pagii 🌤️";
        body  = "Kamu harus semangat yahh hari ini, soalnya ada mimpi yang harus kamu kejar hehe :)";
      } else if (schedule.sore === currentTime) {
        title = "Selamat Soree!! 🌅";
        body  = "Kamu pasti lelah yahh sekarang, ayoo tetap semangat dan jangan lupa istirahat yahh...";
      } else if (schedule.malam === currentTime) {
        title = "Selamat Malam!! 🌙";
        body  = "Gimana kamu hari ini, kamu pasti capek yahh :( apakah ada yang mau kamu ceritakan tentang hari ini";
      }

      if (title) {
        messages.push({ to: token, title, body, sound: "default" });
      }
    }

    // Kirim ke Expo Push Service (gratis, tidak perlu FCM langsung)
    if (messages.length > 0) {
      const fetch = require("node-fetch");
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });
    }

    return null;
  });