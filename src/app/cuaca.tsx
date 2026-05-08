import { HiMelody_400Regular, useFonts } from '@expo-google-fonts/hi-melody';
import { useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { auth, db } from '../../firebase';

const API_KEY = '289bd9bd4013ff528a68dea82cecbe22';

type WeatherData = {
  temp: number; feelsLike: number; humidity: number;
  description: string; icon: string;
  cityName: string; country: string; windSpeed: number;
};
type SavedCity  = { id: string; name: string };
type PendingRow = { kind: 'pending'; tempId: string };
type ListRow    = { kind: 'saved' } & SavedCity;
type Row        = ListRow | PendingRow;

function wEmoji(icon: string) {
  if (icon.startsWith('01')) return '☀️';
  if (icon.startsWith('02') || icon.startsWith('03') || icon.startsWith('04')) return '⛅';
  if (icon.startsWith('09') || icon.startsWith('10')) return '🌧️';
  if (icon.startsWith('11')) return '⛈️';
  if (icon.startsWith('13')) return '❄️';
  if (icon.startsWith('50')) return '🌫️';
  return '🌤️';
}

export default function CuacaScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({ HiMelody: HiMelody_400Regular });

  // ── Auth + Username ───────────────────────────────────
  const [uid, setUid]           = useState<string | null>(null);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) { router.replace('/login'); return; }
      setUid(user.uid);
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) setUsername(snap.data().username ?? '');
      } catch { /* ignore */ }
    });
    return unsub;
  }, [router]);

  // ── Weather ───────────────────────────────────────────
  const [cityInput, setCityInput] = useState('');
  const [weather, setWeather]     = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState('');

  // ── Loading states ────────────────────────────────────
  // weatherLoading : saat fetch cuaca berlangsung
  // addLoading     : saat menyimpan kota ke Firestore
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [addLoading, setAddLoading]         = useState(false);

  // Kela... animation — aktif jika salah satu loading true
  const anyLoading = weatherLoading || addLoading;
  const [dotIndex, setDotIndex] = useState(0);
  const DOTS = ['Kela', 'Kela.', 'Kela..', 'Kela...'];
  useEffect(() => {
    if (!anyLoading) { setDotIndex(0); return; }
    const i = setInterval(() => setDotIndex((p) => (p + 1) % 4), 400);
    return () => clearInterval(i);
  }, [anyLoading]);

  // ── Toast Notification ────────────────────────────────
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [toastMsg, setToastMsg] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    // Cancel timer sebelumnya jika ada (rapid fire)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMsg(msg);
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  // ── CRUD + Realtime Snapshot ───────────────────────────
  const [rows, setRows]           = useState<Row[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [pendingName, setPendingName] = useState('');

  // Ref untuk deteksi kota baru dari perangkat lain (realtime notif)
  const knownIdsRef    = useRef<Set<string>>(new Set());
  const isInitialRef   = useRef(true);   // skip notif saat pertama load

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'cities'),
      orderBy('addedAt', 'asc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetched: SavedCity[] = snap.docs.map((d) => ({
        id: d.id, name: d.data().name ?? '',
      }));

      // ── Deteksi kota baru → tampilkan notifikasi ──
      if (!isInitialRef.current) {
        fetched.forEach((city) => {
          if (!knownIdsRef.current.has(city.id)) {
            // Kota ini belum dikenal → baru ditambahkan
            // (bisa dari HP ini atau HP lain dengan akun sama)
            showToast(`XD. "${city.name}" berhasil ditambahkan ke favorit!`);
          }
        });
      }

      // Update set ID yang dikenal
      knownIdsRef.current = new Set(fetched.map((c) => c.id));
      isInitialRef.current = false;

      // Gabungkan dengan pending rows yang mungkin ada
      setRows((prev) => {
        const pending = prev.filter((r) => r.kind === 'pending');
        return [
          ...fetched.map((c) => ({ kind: 'saved' as const, ...c })),
          ...pending,
        ];
      });
    });
    return unsub;
  }, [uid]);

  // ── Fetch cuaca (top "Tambah" / "Cek Cuaca dulu") ─────
  const fetchWeather = async (city: string) => {
    const t = city.trim();
    if (!t) return;
    setWeatherLoading(true);
    setWeatherError('');
    setWeather(null);
    try {
      const res  = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(t)}&appid=${API_KEY}&units=metric&lang=id`
      );
      const data = await res.json();
      if (data.cod !== 200) { setWeatherError('Kota tidak ditemukan 😢'); return; }
      setWeather({
        temp: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        cityName: data.name,
        country: data.sys.country,
        windSpeed: data.wind.speed,
      });
    } catch {
      setWeatherError('Gagal konek ke API 😢');
    } finally {
      setWeatherLoading(false);
    }
  };

  // ── Top "Tambah" → CEK CUACA (bukan tambah favorit) ──
  const handleTopTambah = () => {
    fetchWeather(cityInput);
  };

  // ── Green "Tambah" → buat baris pending di list ───────
  const handleGreenTambah = () => {
    const hasPending = rows.some((r) => r.kind === 'pending');
    if (hasPending) return;
    setPendingName('');
    setRows((prev) => [...prev, { kind: 'pending', tempId: Date.now().toString() }]);
  };

  // ── Simpan pending → Firestore ────────────────────────
  const handleSavePending = async () => {
    const name = pendingName.trim();
    setRows((prev) => prev.filter((r) => r.kind !== 'pending'));
    if (!name || !uid) return;
    setAddLoading(true);
    try {
      await addDoc(collection(db, 'users', uid, 'cities'), {
        name, addedAt: serverTimestamp(),
      });
      // Notif akan muncul otomatis dari onSnapshot
    } finally {
      setAddLoading(false);
    }
  };

  // ── DELETE ────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'cities', id));
  };

  // ── UPDATE ────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!uid || !editingId || !editingName.trim()) return;
    setAddLoading(true);
    try {
      await updateDoc(doc(db, 'users', uid, 'cities', editingId), {
        name: editingName.trim(),
      });
      setEditingId(null);
    } finally {
      setAddLoading(false);
    }
  };

  // ── Nav loading ───────────────────────────────────────
  const [navLoading, setNavLoading] = useState(false);
  const [navDot, setNavDot]         = useState(0);
  useEffect(() => {
    if (!navLoading) { setNavDot(0); return; }
    const i = setInterval(() => setNavDot((p) => (p + 1) % 4), 400);
    return () => clearInterval(i);
  }, [navLoading]);

  const onHalamanUtama = async () => {
    setNavLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    router.replace('/');
  };

  if (!fontsLoaded) return <View style={styles.loadingScreen} />;

  // ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <View style={styles.outerContainer}>

        {/* ── Toast Notification ─────────────────────── */}
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </Animated.View>

        {/* ════════════════════════════════════════════
            TOP — sky blue, scrollable
        ════════════════════════════════════════════ */}
        <ScrollView
          style={styles.topScroll}
          contentContainerStyle={styles.topContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Row: "Cek Cuaca dulu" kiri + "Haii Username" kanan */}
          <View style={styles.topRow}>
            <Pressable
              style={({ pressed }) => [styles.cekBtn, pressed && { opacity: 0.75 }]}
              onPress={() => fetchWeather(cityInput)}
              disabled={weatherLoading}
            >
              <Text style={styles.cekBtnText}>Cek Cuaca dulu</Text>
            </Pressable>
            {username ? (
              <Text style={styles.greetingText}>Haii, {username}</Text>
            ) : null}
          </View>

          {/* "Inilah My Aplikasi" + garis */}
          <View style={styles.appLabelWrap}>
            <Text style={styles.appLabel}>Inilah My Aplikasi</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Input kota */}
          <Text style={styles.inputLabel}>Masukkan Kota mu</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={cityInput}
              onChangeText={setCityInput}
              placeholder="- - - - - - - -"
              placeholderTextColor="rgba(0,0,0,0.35)"
              style={styles.cityInput}
              onSubmitEditing={handleTopTambah}
              returnKeyType="search"
            />
            {/* ⬇️ Top Tambah = CEK CUACA */}
            <Pressable
              style={({ pressed }) => [styles.tambahTopBtn, pressed && { opacity: 0.75 }]}
              onPress={handleTopTambah}
              disabled={weatherLoading}
            >
              <Text style={styles.tambahTopBtnText}>Tambah</Text>
            </Pressable>
          </View>

          {/* Kela... loading (cuaca / tambah favorit) */}
          {anyLoading && (
            <View style={styles.kelaRow}>
              <Text style={styles.kelaText}>{DOTS[dotIndex]}</Text>
            </View>
          )}

          {/* Error cuaca */}
          {weatherError ? (
            <Text style={styles.weatherError}>{weatherError}</Text>
          ) : null}

          {/* Hasil cuaca */}
          {weather && (
            <View style={styles.weatherCard}>
              <Text style={styles.weatherEmoji}>{wEmoji(weather.icon)}</Text>
              <Text style={styles.weatherCity}>{weather.cityName}, {weather.country}</Text>
              <Text style={styles.weatherTemp}>{weather.temp}°C</Text>
              <Text style={styles.weatherDesc}>{weather.description}</Text>
              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>🌡️ Terasa</Text>
                  <Text style={styles.detailValue}>{weather.feelsLike}°C</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>💧 Lembab</Text>
                  <Text style={styles.detailValue}>{weather.humidity}%</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>💨 Angin</Text>
                  <Text style={styles.detailValue}>{weather.windSpeed} m/s</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── "List Kota Favorit" — tepat di atas green ── */}
        <Text style={styles.listLabel}>List Kota Favorit</Text>

        {/* ════════════════════════════════════════════
            GREEN SECTION — list kota favorit
        ════════════════════════════════════════════ */}
        <View style={styles.greenSection}>

          {/* Header: Tambah button kanan */}
          <View style={styles.greenHeader}>
            {/* ⬇️ Green Tambah = TAMBAH KE FAVORIT */}
            <Pressable
              style={({ pressed }) => [styles.tambahGreenBtn, pressed && { opacity: 0.75 }]}
              onPress={handleGreenTambah}
            >
              <Text style={styles.tambahGreenBtnText}>Tambah</Text>
            </Pressable>
          </View>

          {/* List scrollable */}
          <ScrollView
            style={styles.cityListScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {rows.map((row, index) => {

              /* ── Pending row (input kosong baru) ── */
              if (row.kind === 'pending') {
                return (
                  <View key={row.tempId} style={styles.cityRow}>
                    <Text style={styles.cityNum}>{index + 1}.</Text>
                    <TextInput
                      value={pendingName}
                      onChangeText={setPendingName}
                      placeholder="Masukkan Kota"
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      style={styles.inlineInput}
                      autoFocus
                      onSubmitEditing={handleSavePending}
                      returnKeyType="done"
                    />
                    <Pressable style={styles.simpanBtn} onPress={handleSavePending}>
                      <Text style={styles.simpanBtnText}>Simpan</Text>
                    </Pressable>
                    <Pressable
                      style={styles.hapusBtn}
                      onPress={() => setRows((p) => p.filter((r) => r.kind !== 'pending'))}
                    >
                      <Text style={styles.hapusBtnText}>✕</Text>
                    </Pressable>
                  </View>
                );
              }

              /* ── Saved row ── */
              return (
                <View key={row.id} style={styles.cityRow}>
                  {editingId === row.id ? (
                    <>
                      <Text style={styles.cityNum}>{index + 1}.</Text>
                      <TextInput
                        value={editingName}
                        onChangeText={setEditingName}
                        placeholder="Masukkan Kota"
                        placeholderTextColor="rgba(255,255,255,0.6)"
                        style={styles.inlineInput}
                        autoFocus
                        onSubmitEditing={handleSaveEdit}
                        returnKeyType="done"
                      />
                      <Pressable style={styles.simpanBtn} onPress={handleSaveEdit}>
                        <Text style={styles.simpanBtnText}>Simpan</Text>
                      </Pressable>
                      <Pressable style={styles.hapusBtn} onPress={() => handleDelete(row.id)}>
                        <Text style={styles.hapusBtnText}>Hapus</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text style={styles.cityNum}>{index + 1}.</Text>
                      <Pressable
                        style={{ flex: 1 }}
                        onPress={() => { setCityInput(row.name); fetchWeather(row.name); }}
                      >
                        <Text style={styles.cityName}>{row.name}</Text>
                      </Pressable>
                      <Pressable
                        style={styles.editBtn}
                        onPress={() => { setEditingId(row.id); setEditingName(row.name); }}
                      >
                        <Text style={styles.editBtnText}>Edit</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Footer: Kela... (nav) + Halaman utama */}
          <View style={styles.greenFooter}>
            {navLoading && (
              <Text style={styles.navKelaText}>{DOTS[navDot]}</Text>
            )}
            <View style={styles.footerRight}>
              <Text style={styles.udahanText}>Udahan ahh..</Text>
              <Pressable
                style={({ pressed }) => [styles.halamanBtn, pressed && { opacity: 0.75 }]}
                onPress={onHalamanUtama}
                disabled={navLoading}
              >
                <Text style={styles.halamanBtnText}>Halaman utama</Text>
              </Pressable>
            </View>
          </View>

        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const FONT  = 'HiMelody';
const BG    = '#87CEEB';
const GREEN = '#27AE60';
const CARD  = '#D9D9D9';

const styles = StyleSheet.create({
  loadingScreen:  { flex: 1, backgroundColor: BG },
  outerContainer: { flex: 1, backgroundColor: BG },

  // ── Toast ─────────────────────────────────────────────
  toast: {
    position: 'absolute', top: 55, left: 16, right: 16, zIndex: 999,
    backgroundColor: 'rgba(39,174,96,0.96)', borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 10,
  },
  toastText: { fontFamily: FONT, fontSize: 14, color: '#fff', textAlign: 'center' },

  // ── Top Scroll ────────────────────────────────────────
  topScroll:  { flex: 1 },
  topContent: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 6 },

  topRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  cekBtn:     { backgroundColor: CARD, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  cekBtnText: { fontFamily: FONT, fontSize: 13, color: '#000' },
  greetingText: { fontFamily: FONT, fontSize: 14, color: '#000' },

  appLabelWrap: { marginBottom: 14 },
  appLabel:     { fontFamily: FONT, fontSize: 15, color: '#000', marginBottom: 6 },
  dividerLine:  { width: 200, height: 3, backgroundColor: '#000' },

  inputLabel: { fontFamily: FONT, fontSize: 14, color: '#000', marginBottom: 8 },
  inputRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  cityInput: {
    flex: 1, backgroundColor: CARD, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: FONT, fontSize: 14, color: '#000',
  },
  tambahTopBtn:     { backgroundColor: CARD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  tambahTopBtnText: { fontFamily: FONT, fontSize: 13, color: '#000' },

  // Kela... loading bar (cuaca/tambah)
  kelaRow: { alignItems: 'center', marginVertical: 4 },
  kelaText: { fontFamily: FONT, fontSize: 13, color: '#1E90FF', width: 40, height: 16, textAlign: 'center', lineHeight: 16 },

  weatherError: { fontFamily: FONT, fontSize: 12, color: '#CC0000', textAlign: 'center', marginTop: 4 },

  weatherCard: {
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 12,
    padding: 14, marginTop: 8, alignItems: 'center',
  },
  weatherEmoji:  { fontSize: 42, marginBottom: 4 },
  weatherCity:   { fontFamily: FONT, fontSize: 15, color: '#000', marginBottom: 2 },
  weatherTemp:   { fontFamily: FONT, fontSize: 42, color: '#000', marginBottom: 2 },
  weatherDesc:   { fontFamily: FONT, fontSize: 13, color: '#555', textTransform: 'capitalize', marginBottom: 10 },
  detailRow:     { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  detailItem:    { alignItems: 'center', flex: 1 },
  detailLabel:   { fontFamily: FONT, fontSize: 10, color: '#666', marginBottom: 2 },
  detailValue:   { fontFamily: FONT, fontSize: 13, color: '#000' },

  // "List Kota Favorit" — fixed tepat di atas green
  listLabel: {
    fontFamily: FONT, fontSize: 13, color: '#000',
    textAlign: 'right',
    paddingHorizontal: 16,
    paddingBottom: 4,   // jarak minimal ke green section
    backgroundColor: BG,
  },

  // ── Green Section ─────────────────────────────────────
  greenSection: {
    backgroundColor: GREEN,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12,
    minHeight: 200, maxHeight: 320,
  },
  greenHeader:          { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  tambahGreenBtn:       { backgroundColor: CARD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  tambahGreenBtnText:   { fontFamily: FONT, fontSize: 13, color: '#000' },

  cityListScroll: { flex: 1 },

  cityRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 6, paddingVertical: 6,
    marginBottom: 4, gap: 6,
  },
  cityNum:  { fontFamily: FONT, fontSize: 14, color: '#fff', width: 24 },
  cityName: { fontFamily: FONT, fontSize: 14, color: '#fff' },

  inlineInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    fontFamily: FONT, fontSize: 13, color: '#fff',
  },
  editBtn:       { backgroundColor: CARD, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  editBtnText:   { fontFamily: FONT, fontSize: 12, color: '#000' },
  simpanBtn:     { backgroundColor: CARD, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  simpanBtnText: { fontFamily: FONT, fontSize: 11, color: '#000' },
  hapusBtn:      { backgroundColor: '#e74c3c', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  hapusBtnText:  { fontFamily: FONT, fontSize: 11, color: '#fff' },

  // Footer green
  greenFooter: {
    flexDirection: 'row', justifyContent: 'flex-end',
    alignItems: 'flex-end', paddingTop: 8, gap: 12,
  },
  navKelaText:    { fontFamily: FONT, fontSize: 13, color: '#1E90FF', width: 40, height: 16, textAlign: 'center', lineHeight: 16 },
  footerRight:    { alignItems: 'flex-end' },
  udahanText:     { fontFamily: FONT, fontSize: 12, color: '#fff', marginBottom: 4 },
  halamanBtn:     { backgroundColor: CARD, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  halamanBtnText: { fontFamily: FONT, fontSize: 13, color: '#000' },
});
