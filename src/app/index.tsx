import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, BackHandler, Dimensions, Image,
  KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs } from 'firebase/firestore';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  PlusJakartaSans_200ExtraLight,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Jaro_400Regular } from '@expo-google-fonts/jaro';
import { auth, db } from '../../firebase';

// ─── Canvas & scale ───────────────────────────────────────
const CANVAS_W = 390;
const { width: DW, height: DH } = Dimensions.get('window');
const S = DW / CANVAS_W;
const a  = (x: number, y: number) => ({ position: 'absolute' as const, left: x * S, top: y * S });
const sz = (w: number, h: number) => ({ width: w * S, height: h * S });

// ─── Notifikasi setup ─────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

const NOTIF_MESSAGES = {
  pagi:  { title: 'Selamat Pagii 🌤️',   body: 'Kamu harus semangat yahh hari ini, soalnya ada mimpi yang harus kamu kejar hehe :)' },
  sore:  { title: 'Selamat Soree!! 🌅',  body: 'Kamu pasti lelah yahh sekarang, ayoo tetap semangat dan jangan lupa istirahat yahh...' },
  malam: { title: 'Selamat Malam!! 🌙',  body: 'Gimana kamu hari ini, kamu pasti capek yahh :( apakah ada yang mau kamu ceritakan tentang hari ini' },
};

// ─── Minta izin notifikasi ────────────────────────────────
async function requestNotifPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Jadwalkan 3 notifikasi harian (local) ───────────────
async function scheduleNotifications(
  pagiH: number, pagiM: number,
  soreH: number, soreM: number,
  malamH: number, malamM: number,
) {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const schedule = [
    { hour: pagiH,  minute: pagiM,  ...NOTIF_MESSAGES.pagi  },
    { hour: soreH,  minute: soreM,  ...NOTIF_MESSAGES.sore  },
    { hour: malamH, minute: malamM, ...NOTIF_MESSAGES.malam },
  ];

  for (const item of schedule) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: item.title,
        body:  item.body,
        sound: true,
      },
      trigger: {
        type:   Notifications.SchedulableTriggerInputTypes.DAILY,
        hour:   item.hour,
        minute: item.minute,
      },
    });
  }
}

// ─── Helper parse "HH:MM" ────────────────────────────────
function parseTime(str: string): [number, number] {
  const [h, m] = str.split(':').map(Number);
  return [isNaN(h) ? 0 : h, isNaN(m) ? 0 : m];
}

// ─────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_200ExtraLight,
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    Jaro_400Regular,
  });

  // ── Auth ──────────────────────────────────────────────
  const [uid, setUid]           = useState<string | null>(null);
  const [username, setUsername] = useState('');

  const isReady = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => { isReady.current = true; }, 300);
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user && isReady.current) { router.replace('/login'); return; }
      if (user) {
        setUid(user.uid);
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (snap.exists()) setUsername(snap.data().username ?? 'User');
        } catch { setUsername('User'); }
      }
    });
    return () => { clearTimeout(timer); unsub(); };
  }, [router]);

  // ── Kela... loading ───────────────────────────────────
  const [navLoading, setNavLoading] = useState(false);
  const [dots, setDots]             = useState('.');
  useEffect(() => {
    if (!navLoading) { setDots('.'); return; }
    const i = setInterval(() => setDots((p) => p.length >= 3 ? '.' : p + '.'), 400);
    return () => clearInterval(i);
  }, [navLoading]);

  const navigate = async (path: string) => {
    setNavLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    router.push(path as any);
    setNavLoading(false);
  };

  // ── Listener klik notifikasi ──────────────────────────
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const title = response.notification.request.content.title ?? '';
      if (title.includes('Malam')) {
        router.push('/notepad');
      }
    });
    return () => sub.remove();
  }, [router]);

  // ── Double-back exit ──────────────────────────────────
  const backPressCount = useRef(0);
  const backTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      backPressCount.current += 1;
      if (backPressCount.current === 1) {
        Alert.alert(
          'Yakin mau keluar app?',
          'Tekan back sekali lagi dalam 2 detik untuk keluar.',
          [{ text: 'Tetap di sini', onPress: () => { backPressCount.current = 0; } }],
          { cancelable: true }
        );
        backTimer.current = setTimeout(() => { backPressCount.current = 0; }, 2000);
      } else if (backPressCount.current >= 2) {
        if (backTimer.current) clearTimeout(backTimer.current);
        BackHandler.exitApp();
      }
      return true;
    });
    return () => {
      handler.remove();
      if (backTimer.current) clearTimeout(backTimer.current);
    };
  }, []);

  // ── Export / Import state ─────────────────────────────
  const [showTransferPanel, setShowTransferPanel] = useState(false);
  const [importLoading, setImportLoading]         = useState(false);
  const [importResult, setImportResult]           = useState('');

  // ── Export JSON (Sudah Diperbaiki & Dilindungi) ───────
  const handleExport = async () => {
    if (!uid) {
      Alert.alert('Error', 'User belum login.');
      return;
    }
    try {
      // Pembacaan data dibuat berurutan dengan penanganan fallback agar anti-error
      const notesSnap = await getDocs(collection(db, 'users', uid, 'notes')).catch(() => null);
      const assessSnap = await getDocs(collection(db, 'users', uid, 'assessments')).catch(() => null);
      const userSnap = await getDoc(doc(db, 'users', uid)).catch(() => null);

      const userData = userSnap && userSnap.exists() ? userSnap.data() : {};

      // Amankan pemetaan array dari kemungkinan properti bernilai undefined
      const notesList = notesSnap && notesSnap.docs
        ? notesSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        : [];

      const assessmentsList = assessSnap && assessSnap.docs
        ? assessSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        : [];

      const exportData = {
        exportedAt:  new Date().toISOString(),
        appVersion:  '1.0.1',
        user:        { uid, username, ...userData },
        notes:       notesList,
        assessments: assessmentsList,
      };

      const fileName = `kimorimy_backup_${new Date().toISOString().split('T')[0]}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(
        filePath,
        JSON.stringify(exportData, null, 2),
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      const sharingAvailable = await Sharing.isAvailableAsync();

      if (sharingAvailable) {
        await Sharing.shareAsync(filePath, {
          mimeType:    'application/json',
          dialogTitle: 'Kirim / Simpan Backup Kimori .My',
          UTI:         'public.json',
        });
      } else {
        Alert.alert(
          'File Tersimpan ✅',
          `Backup disimpan di storage internal:\n\n${filePath}\n\nBuka via file manager untuk akses file.`
        );
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(
        'Gagal Export',
        `Detail error:\n${msg}\n\nPastikan koneksi internet aktif untuk mengambil data.`
      );
    }
  };

  // ── Import JSON ───────────────────────────────────────
  const handleImport = async () => {
    if (!uid) return;
    setImportLoading(true);
    setImportResult('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        setImportLoading(false);
        return;
      }

      const raw  = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const data = JSON.parse(raw);

      if (!data.notes && !data.assessments) {
        setImportResult('❌ File tidak valid. Pastikan ini file backup Kimori .My');
        setImportLoading(false);
        return;
      }

      let notesCount  = 0;
      let assessCount = 0;

      for (const note of (data.notes ?? [])) {
        const { id, ...rest } = note;
        await addDoc(collection(db, 'users', uid, 'notes'), {
          title:      rest.title      ?? '',
          content:    rest.content    ?? '',
          created_at: rest.created_at ?? new Date().toLocaleDateString('id-ID'),
        });
        notesCount++;
      }

      for (const assess of (data.assessments ?? [])) {
        const { id, ...rest } = assess;
        await addDoc(collection(db, 'users', uid, 'assessments'), {
          result_category: rest.result_category ?? 'Sehat',
          score:           rest.score           ?? 0,
          created_at:      rest.created_at      ?? new Date().toLocaleDateString('id-ID'),
        });
        assessCount++;
      }

      setImportResult(
        `✅ Import berhasil!\n📝 ${notesCount} catatan\n🧠 ${assessCount} riwayat tes`
      );
    } catch {
      setImportResult('❌ Gagal import. Pastikan file JSON tidak rusak.');
    } finally {
      setImportLoading(false);
    }
  };

  // ── Push Notification settings ────────────────────────
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [pagiTime,  setPagiTime]  = useState('07:00');
  const [soreTime,  setSoreTime]  = useState('15:00');
  const [malamTime, setMalamTime] = useState('20:00');

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('notif_times');
      if (saved) {
        const { pagi, sore, malam } = JSON.parse(saved);
        if (pagi)  setPagiTime(pagi);
        if (sore)  setSoreTime(sore);
        if (malam) setMalamTime(malam);
      }
    })();
  }, []);

  const handleSaveNotif = async () => {
    const granted = await requestNotifPermission();
    if (!granted) {
      Alert.alert('Izin ditolak', 'Aktifkan izin notifikasi di pengaturan HP kamu.');
      return;
    }
    const [pH, pM] = parseTime(pagiTime);
    const [sH, sM] = parseTime(soreTime);
    const [mH, mM] = parseTime(malamTime);

    await scheduleNotifications(pH, pM, sH, sM, mH, mM);
    await AsyncStorage.setItem('notif_times', JSON.stringify({
      pagi: pagiTime, sore: soreTime, malam: malamTime,
    }));
    setShowNotifPanel(false);
    Alert.alert(
      'Berhasil! 🔔',
      `Notifikasi dijadwalkan:\nPagi: ${pagiTime}\nSore: ${soreTime}\nMalam: ${malamTime}`
    );
  };

  // ── Logout ────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert('Logout', 'Yakin mau keluar?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          setNavLoading(true);
          await signOut(auth);
          router.replace('/login');
        },
      },
    ]);
  };

  if (!fontsLoaded) return <View style={styles.bg} />;

  // ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { minHeight: DH }]}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.canvas, { width: DW, minHeight: DH }]}>

          <Text style={[styles.greeting, a(11, 19)]}>Haii, {username || 'User'}!</Text>
          <Text style={[styles.kimoriText, a(300, 10)]}>Kimori .My</Text>
          <Text style={[styles.subGreeting, a(11, 42)]}>Gimana kondisi pikiranmu hari ini?</Text>
          <View style={[styles.headerLine, a(11, 91), sz(251, 2)]} />

          <Text style={[styles.featureTitle, a(21, 190)]}>Cek Kesehatan Mental</Text>
          <Text style={[styles.featureDesc, a(22, 217), { width: 220 * S }]}>
            Coba cek kondisi hari ini lewat tes singkat yukk...
          </Text>
          <Pressable
            style={({ pressed }) => [styles.featureBtn, a(21, 266), sz(172, 55), pressed && { opacity: 0.75 }]}
            onPress={() => navigate('/tes_mental')}
            disabled={navLoading}
          >
            <Text style={styles.featureBtnText}>Mulai Tes !!</Text>
          </Pressable>

          <Text style={[styles.featureTitle, a(262, 413)]}>Cek Cuaca !!</Text>
          <Pressable
            style={({ pressed }) => [styles.featureBtn, a(262, 442), sz(124, 49), pressed && { opacity: 0.75 }]}
            onPress={() => navigate('/cuaca')}
            disabled={navLoading}
          >
            <Text style={styles.featureBtnText}>Cek...</Text>
          </Pressable>

          <Text style={[styles.featureTitle, a(272, 530)]}>Notepad</Text>
          <Pressable
            style={({ pressed }) => [styles.featureBtn, a(268, 560), sz(124, 51), pressed && { opacity: 0.75 }]}
            onPress={() => navigate('/notepad')}
            disabled={navLoading}
          >
            <Text style={styles.featureBtnText}>Ketik...</Text>
          </Pressable>

          <Text style={[styles.aturLabel, a(11, 650)]}>Atur Sapaan</Text>
          <Pressable
            style={[styles.setJamBtn, a(11, 672), sz(100, 36)]}
            onPress={() => setShowNotifPanel(true)}
          >
            <Text style={styles.setJamText}>Set Jam</Text>
          </Pressable>

          <Pressable
            style={[styles.transferIconBtn, a(349, 658), sz(44, 44)]}
            onPress={() => { setImportResult(''); setShowTransferPanel(true); }}
          >
            <Text style={styles.transferIconText}>⇅</Text>
          </Pressable>

          {navLoading && (
            <Text style={[styles.kelaText, a(187, 724)]}>kela{dots}</Text>
          )}

          <Text style={[styles.udahanTitle, a(274, 837)]}>Udahan dulu</Text>
          <Pressable style={[styles.logoutBtn, a(296, 864), sz(85, 23)]} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Logout</Text>
          </Pressable>

          {/* Ornamen gambar */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Image source={require('../../assets/icon/pohon4.png')} style={[{ position: 'absolute' }, a(310, 42),  sz(80, 72)]}  resizeMode="contain" />
            <Image source={require('../../assets/icon/pohon5.png')} style={[{ position: 'absolute' }, a(145, 266), sz(64, 55)]}  resizeMode="contain" />
            <Image source={require('../../assets/icon/Kucing2.png')} style={[{ position: 'absolute' }, a(314, 438), sz(106, 53)]} resizeMode="contain" />
            <Image source={require('../../assets/icon/Kucing1.png')} style={[{ position: 'absolute' }, a(333, 497), sz(93, 76)]}  resizeMode="contain" />
            <Image source={require('../../assets/icon/pohon3.png')} style={[{ position: 'absolute' }, a(191, 750), sz(113, 175)]} resizeMode="contain" />
            <Image source={require('../../assets/icon/pohon1.png')} style={[{ position: 'absolute' }, a(70, 781),  sz(162, 139)]} resizeMode="contain" />
            <Image source={require('../../assets/icon/pohon2.png')} style={[{ position: 'absolute' }, a(10, 808),  sz(68, 68)]}  resizeMode="contain" />
          </View>

          {/* PANEL TRANSFER DATA */}
          {showTransferPanel && (
            <View style={styles.overlay}>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>⇅ Transfer Data</Text>
                <Text style={styles.panelSub}>Backup dan pulihkan semua catatan{'\n'}dan riwayat tes kamu</Text>

                <Pressable style={styles.btnExport} onPress={() => { setShowTransferPanel(false); handleExport(); }}>
                  <Text style={styles.btnExportText}>↗  Export — Kirim ke WA / ZArchiver / Drive</Text>
                </Pressable>
                <Text style={styles.hint}>File JSON dibuka di share sheet Android.{'\n'}Pilih WA, ZArchiver, Drive, dll.</Text>

                <View style={styles.divider} />

                <Pressable style={[styles.btnImport, importLoading && { opacity: 0.6 }]} onPress={handleImport} disabled={importLoading}>
                  <Text style={styles.btnImportText}>{importLoading ? 'Mengimpor...' : '↙  Import — Pilih file JSON backup'}</Text>
                </Pressable>
                <Text style={styles.hint}>Pilih file .json backup dari storage HP.{'\n'}Data ditambahkan ke akun ini.</Text>

                {importResult ? (
                  <View style={styles.importResultBox}>
                    <Text style={styles.importResultText}>{importResult}</Text>
                  </View>
                ) : null}

                <Pressable style={styles.btnClose} onPress={() => { setShowTransferPanel(false); setImportResult(''); }}>
                  <Text style={styles.btnCloseText}>Tutup</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* PANEL NOTIFIKASI */}
          {showNotifPanel && (
            <View style={styles.overlay}>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>🔔 Atur Jam Sapaan</Text>
                <Text style={styles.panelSub}>Format HH:MM (contoh: 07:00, 15:30, 20:00)</Text>

                <Text style={styles.notifLabel}>🌤️ Pagi</Text>
                <TextInput value={pagiTime} onChangeText={setPagiTime} placeholder="07:00" placeholderTextColor="rgba(0,0,0,0.4)" keyboardType="numbers-and-punctuation" maxLength={5} style={styles.notifInput} />

                <Text style={styles.notifLabel}>🌅 Sore</Text>
                <TextInput value={soreTime} onChangeText={setSoreTime} placeholder="15:00" placeholderTextColor="rgba(0,0,0,0.4)" keyboardType="numbers-and-punctuation" maxLength={5} style={styles.notifInput} />

                <Text style={styles.notifLabel}>🌙 Malam</Text>
                <TextInput value={malamTime} onChangeText={setMalamTime} placeholder="20:00" placeholderTextColor="rgba(0,0,0,0.4)" keyboardType="numbers-and-punctuation" maxLength={5} style={styles.notifInput} />

                <View style={styles.btnRow}>
                  <Pressable style={styles.btnCancel} onPress={() => setShowNotifPanel(false)}><Text style={styles.btnCancelText}>Batal</Text></Pressable>
                  <Pressable style={styles.btnSave} onPress={handleSaveNotif}><Text style={styles.btnSaveText}>Simpan</Text></Pressable>
                </View>
              </View>
            </View>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const BG   = '#7D6B91';
const CARD = '#D9D9D9';
const FONT = 'PlusJakartaSans_400Regular';

const styles = StyleSheet.create({
  bg:            { flex: 1, backgroundColor: BG },
  scrollContent: { flexGrow: 1 },
  canvas:        { backgroundColor: BG, position: 'relative' },
  greeting:     { position: 'absolute', fontFamily: FONT, fontSize: 19 * S, color: '#000' },
  kimoriText:   { position: 'absolute', fontFamily: 'PlusJakartaSans_200ExtraLight', fontSize: 20 * S, color: '#000' },
  subGreeting:  { position: 'absolute', fontFamily: FONT, fontSize: 18 * S, color: '#000' },
  headerLine:   { position: 'absolute', backgroundColor: '#3D2E4C' },
  featureTitle: { position: 'absolute', fontFamily: FONT, fontSize: 19 * S, color: '#000' },
  featureDesc:  { position: 'absolute', fontFamily: FONT, fontSize: 16 * S, color: '#000', lineHeight: 22 * S },
  featureBtn:   { position: 'absolute', backgroundColor: CARD, borderRadius: 9 * S, justifyContent: 'center', alignItems: 'center' },
  featureBtnText:{ fontFamily: FONT, fontSize: 19 * S, color: '#000' },
  aturLabel:  { position: 'absolute', fontFamily: FONT, fontSize: 16 * S, color: '#000' },
  setJamBtn:  { position: 'absolute', backgroundColor: CARD, borderRadius: 8 * S, justifyContent: 'center', alignItems: 'center' },
  setJamText: { fontFamily: FONT, fontSize: 15 * S, color: '#000' },
  transferIconBtn:  { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 8 * S, justifyContent: 'center', alignItems: 'center' },
  transferIconText: { fontSize: 22 * S, color: '#000' },
  kelaText:     { position: 'absolute', fontFamily: 'Jaro_400Regular', fontSize: 18 * S, color: '#1E90FF' },
  udahanTitle:  { position: 'absolute', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 20 * S, color: '#000' },
  logoutBtn:    { position: 'absolute', backgroundColor: CARD, borderRadius: 5 * S, justifyContent: 'center', alignItems: 'center' },
  logoutBtnText:{ fontFamily: 'PlusJakartaSans_300Light', fontSize: 16 * S, color: '#000' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  panel:    { width: 320 * S, backgroundColor: '#fff', borderRadius: 16 * S, padding: 24 * S },
  panelTitle:{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 18 * S, color: '#000', marginBottom: 6 * S },
  panelSub:  { fontFamily: FONT, fontSize: 12 * S, color: '#555', marginBottom: 16 * S, lineHeight: 18 * S },
  btnExport:     { backgroundColor: '#7D6B91', borderRadius: 10 * S, padding: 12 * S, marginBottom: 6 * S },
  btnExportText: { fontFamily: FONT, fontSize: 13 * S, color: '#fff' },
  btnImport:     { backgroundColor: '#5F7D95', borderRadius: 10 * S, padding: 12 * S, marginBottom: 6 * S },
  btnImportText: { fontFamily: FONT, fontSize: 13 * S, color: '#fff' },
  hint:          { fontFamily: FONT, fontSize: 11 * S, color: '#888', lineHeight: 16 * S, marginBottom: 8 * S },
  divider:       { height: 1, backgroundColor: '#eee', marginVertical: 12 * S },
  importResultBox:  { backgroundColor: '#f0f7f0', borderRadius: 8 * S, padding: 10 * S, marginBottom: 10 * S },
  importResultText: { fontFamily: FONT, fontSize: 13 * S, color: '#2d6a2d', lineHeight: 20 * S },
  btnClose:      { alignSelf: 'flex-end', paddingHorizontal: 20 * S, paddingVertical: 10 * S, borderRadius: 8 * S, backgroundColor: '#ddd', marginTop: 8 * S },
  btnCloseText:  { fontFamily: FONT, fontSize: 14 * S, color: '#333' },
  notifLabel:  { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 * S, color: '#000', marginBottom: 4 * S, marginTop: 8 * S },
  notifInput:  { backgroundColor: '#F0EDE8', borderRadius: 8 * S, paddingHorizontal: 12 * S, paddingVertical: 10 * S, fontFamily: FONT, fontSize: 16 * S, color: '#000' },
  btnRow:      { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 * S, marginTop: 20 * S },
  btnCancel:   { paddingHorizontal: 20 * S, paddingVertical: 10 * S, borderRadius: 8 * S, backgroundColor: '#ddd' },
  btnCancelText:{ fontFamily: FONT, fontSize: 14 * S, color: '#333' },
  btnSave:     { paddingHorizontal: 20 * S, paddingVertical: 10 * S, borderRadius: 8 * S, backgroundColor: '#7D6B91' },
  btnSaveText: { fontFamily: FONT, fontSize: 14 * S, color: '#fff' },
});