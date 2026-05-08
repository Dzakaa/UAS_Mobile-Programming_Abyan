/**
 * HALAMAN CEK CUACA — sesuai desain Figma (final)
 *
 * Layout:
 *  - Top-left : "Cek Cuaca dulu" pill button  → fetch weather
 *  - Top-right: "Haii, (Username)"
 *  - "Inilah My Aplikasi" + divider
 *  - Input kota + "Tambah" button (top)
 *  - Area cuaca (hasil fetch)
 *  - "List Kota Favorit" label kanan
 *  - Green section: list kota + Tambah + Edit per item
 *  - Footer: "Udahan ahh.." + "Halaman utama"
 *
 * Font  : Hi Melody
 * Notif : Custom toast popup saat kota berhasil ditambahkan
 */

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

// ─── Konstanta ────────────────────────────────────────────
const API_KEY = '289bd9bd4013ff528a68dea82cecbe22';

// ─── Tipe ─────────────────────────────────────────────────
type WeatherData = {
  temp: number; feelsLike: number; humidity: number;
  description: string; icon: string;
  cityName: string; country: string; windSpeed: number;
};
// Item di list: bisa "saved" (id ada) atau "pending" (sedang diisi inline)
type CityItem =
  | { kind: 'saved';   id: string; name: string }
  | { kind: 'pending'; tempId: string };

// ─── Helper emoji cuaca ───────────────────────────────────
function wEmoji(icon: string) {
  if (icon.startsWith('01')) return '☀️';
  if (icon.startsWith('02') || icon.startsWith('03') || icon.startsWith('04')) return '⛅';
  if (icon.startsWith('09') || icon.startsWith('10')) return '🌧️';
  if (icon.startsWith('11')) return '⛈️';
  if (icon.startsWith('13')) return '❄️';
  if (icon.startsWith('50')) return '🌫️';
  return '🌤️';
}

// ─────────────────────────────────────────────────────────
export default function CuacaScreen() {
  const router = useRouter();

  // ── Font ──────────────────────────────────────────────
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
  const [cityInput, setCityInput]           = useState('');
  const [weather, setWeather]               = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError]     = useState('');

  // ── CRUD State ────────────────────────────────────────
  const [savedCities, setSavedCities] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems]             = useState<CityItem[]>([]);    // gabungan saved + pending
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [pendingName, setPendingName] = useState('');  // nilai input untuk item pending

  // ── Nav loading ───────────────────────────────────────
  const [navLoading, setNavLoading] = useState(false);
  const [dotIndex, setDotIndex]     = useState(0);
  const DOTS = ['Kela', 'Kela.', 'Kela..', 'Kela...'];

  useEffect(() => {
    if (!navLoading) { setDotIndex(0); return; }
    const i = setInterval(() => setDotIndex((p) => (p + 1) % 4), 400);
    return () => clearInterval(i);
  }, [navLoading]);

  // ── Toast Notification ────────────────────────────────
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  // ── Realtime Firestore listener ───────────────────────
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'cities'),
      orderBy('addedAt', 'asc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((d) => ({ id: d.id, name: d.data().name ?? '' }));
      setSavedCities(fetched);
      // Pertahankan item pending, gabungkan dengan saved
      setItems((prev) => {
        const pending = prev.filter((i) => i.kind === 'pending');
        return [
          ...fetched.map((c) => ({ kind: 'saved' as const, id: c.id, name: c.name })),
          ...pending,
        ];
      });
    });
    return unsub;
  }, [uid]);

  // ── Fetch cuaca ───────────────────────────────────────
  const fetchWeather = async (city: string) => {
    const t = city.trim();
    if (!t) return;
    setWeatherLoading(true); setWeatherError(''); setWeather(null);
    try {
      const res  = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(t)}&appid=${API_KEY}&units=metric&lang=id`
      );
      const data = await res.json();
      if (data.cod !== 200) { setWeatherError('Kota tidak ditemukan 😢'); return; }
      setWeather({
        temp: Math.round(data.main.temp), feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity, description: data.weather[0].description,
        icon: data.weather[0].icon, cityName: data.name,
        country: data.sys.country, windSpeed: data.wind.speed,
      });
    } catch { setWeatherError('Gagal konek ke API 😢'); }
    finally  { setWeatherLoading(false); }
  };

  // ── CREATE: Tambah dari input atas ───────────────────
  const handleTambahFromInput = async () => {
    const name = cityInput.trim();
    if (!name || !uid) return;
    await addDoc(collection(db, 'users', uid, 'cities'), { name, addedAt: serverTimestamp() });
    setCityInput('');
    showToast(`🎉 "${name}" ditambahkan ke favorit!`);
  };

  // ── CREATE: Tambah baris pending di green section ────
  const handleTambahGreen = () => {
    // Hanya boleh satu pending sekaligus
    const hasPending = items.some((i) => i.kind === 'pending');
    if (hasPending) return;
    setPendingName('');
    setItems((prev) => [...prev, { kind: 'pending', tempId: Date.now().toString() }]);
  };

  // ── CREATE: Simpan baris pending ─────────────────────
  const handleSavePending = async () => {
    const name = pendingName.trim();
    // Hapus item pending dari local state
    setItems((prev) => prev.filter((i) => i.kind !== 'pending'));
    if (!name || !uid) return;
    await addDoc(collection(db, 'users', uid, 'cities'), { name, addedAt: serverTimestamp() });
    showToast(`🎉 "${name}" ditambahkan ke favorit!`);
  };

  // ── DELETE ────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'cities', id));
  };

  // ── UPDATE ────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!uid || !editingId || !editingName.trim()) return;
    await updateDoc(doc(db, 'users', uid, 'cities', editingId), { name: editingName.trim() });
    setEditingId(null);
  };

  // ── Nav: Halaman Utama ────────────────────────────────
  const onHalamanUtama = async () => {
    setNavLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    router.replace('/');
  };

  if (!fontsLoaded) return <View style={styles.loadingScreen} />;

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <View style={styles.outerContainer}>

        {/* ── Toast Notification (overlay) ─────────────── */}
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </Animated.View>

        {/* ════════════════════════════════════════════════
            TOP SECTION — sky blue
        ════════════════════════════════════════════════ */}
        <ScrollView
          style={styles.topScroll}
          contentContainerStyle={styles.topContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Row 1: "Cek Cuaca dulu" (kiri) + "Haii, Username" (kanan) */}
          <View style={styles.topRow}>
            <Pressable
              style={({ pressed }) => [styles.cekCuacaBtn, pressed && { opacity: 0.75 }]}
              onPress={() => fetchWeather(cityInput)}
              disabled={weatherLoading}
            >
              <Text style={styles.cekCuacaBtnText}>
                {weatherLoading ? 'Loading...' : 'Cek Cuaca dulu'}
              </Text>
            </Pressable>
            {username ? (
              <Text style={styles.greetingText}>Haii, {username}</Text>
            ) : null}
          </View>

          {/* "Inilah My Aplikasi" + divider */}
          <View style={styles.appLabelRow}>
            <Text style={styles.appLabel}>Inilah My Aplikasi</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* "Masukkan Kota mu" + input + Tambah */}
          <Text style={styles.inputLabel}>Masukkan Kota mu</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={cityInput}
              onChangeText={setCityInput}
              placeholder="- - - - - - - -"
              placeholderTextColor="rgba(0,0,0,0.35)"
              style={styles.cityInput}
              onSubmitEditing={() => fetchWeather(cityInput)}
              returnKeyType="search"
            />
            <Pressable
              style={({ pressed }) => [styles.tambahTopBtn, pressed && { opacity: 0.75 }]}
              onPress={handleTambahFromInput}
            >
              <Text style={styles.tambahTopBtnText}>Tambah</Text>
            </Pressable>
          </View>

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

          {/* "List Kota Favorit" label kanan */}
          <Text style={styles.listLabel}>List Kota Favorit</Text>

        </ScrollView>

        {/* ════════════════════════════════════════════════
            GREEN SECTION — daftar kota favorit
        ════════════════════════════════════════════════ */}
        <View style={styles.greenSection}>

          {/* Header green: "Tambah" button kanan */}
          <View style={styles.greenHeader}>
            <Pressable
              style={({ pressed }) => [styles.tambahGreenBtn, pressed && { opacity: 0.75 }]}
              onPress={handleTambahGreen}
            >
              <Text style={styles.tambahGreenBtnText}>Tambah</Text>
            </Pressable>
          </View>

          {/* List kota scrollable */}
          <ScrollView
            style={styles.cityListScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {items.map((item, index) => {

              /* ── Item Pending (input kosong baru) ── */
              if (item.kind === 'pending') {
                return (
                  <View key={item.tempId} style={styles.cityItemRow}>
                    <Text style={styles.cityNumber}>{index + 1}.</Text>
                    <TextInput
                      value={pendingName}
                      onChangeText={setPendingName}
                      placeholder="Masukkan Kota"
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      style={styles.pendingInput}
                      autoFocus
                      onSubmitEditing={handleSavePending}
                      returnKeyType="done"
                    />
                    <Pressable style={styles.simpanBtn} onPress={handleSavePending}>
                      <Text style={styles.simpanBtnText}>Simpan</Text>
                    </Pressable>
                    <Pressable
                      style={styles.hapusBtn}
                      onPress={() => setItems((prev) => prev.filter((i) => i.kind !== 'pending'))}
                    >
                      <Text style={styles.hapusBtnText}>✕</Text>
                    </Pressable>
                  </View>
                );
              }

              /* ── Item Tersimpan ── */
              return (
                <View key={item.id} style={styles.cityItemRow}>

                  {editingId === item.id ? (
                    /* Mode Edit */
                    <>
                      <Text style={styles.cityNumber}>{index + 1}.</Text>
                      <TextInput
                        value={editingName}
                        onChangeText={setEditingName}
                        placeholder="Masukkan Kota"
                        placeholderTextColor="rgba(255,255,255,0.6)"
                        style={styles.pendingInput}
                        autoFocus
                        onSubmitEditing={handleSaveEdit}
                        returnKeyType="done"
                      />
                      <Pressable style={styles.simpanBtn} onPress={handleSaveEdit}>
                        <Text style={styles.simpanBtnText}>Simpan</Text>
                      </Pressable>
                      <Pressable style={styles.hapusBtn} onPress={() => handleDelete(item.id)}>
                        <Text style={styles.hapusBtnText}>Hapus</Text>
                      </Pressable>
                    </>
                  ) : (
                    /* Mode Normal */
                    <>
                      <Text style={styles.cityNumber}>{index + 1}.</Text>
                      <Pressable
                        style={{ flex: 1 }}
                        onPress={() => { setCityInput(item.name); fetchWeather(item.name); }}
                      >
                        <Text style={styles.cityName}>{item.name}</Text>
                      </Pressable>
                      <Pressable
                        style={styles.editBtn}
                        onPress={() => { setEditingId(item.id); setEditingName(item.name); }}
                      >
                        <Text style={styles.editBtnText}>Edit</Text>
                      </Pressable>
                    </>
                  )}

                </View>
              );
            })}
          </ScrollView>

          {/* Footer: Kela... + Udahan ahh + Halaman utama */}
          <View style={styles.greenFooter}>
            {navLoading && (
              <Text style={styles.kelaText}>{DOTS[dotIndex]}</Text>
            )}
            <View style={styles.footerRight}>
              <Text style={styles.udahanText}>Udahan ahh..</Text>
              <Pressable
                style={({ pressed }) => [styles.halamanUtamaBtn, pressed && { opacity: 0.75 }]}
                onPress={onHalamanUtama}
                disabled={navLoading}
              >
                <Text style={styles.halamanUtamaBtnText}>Halaman utama</Text>
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

  // ── Toast ──────────────────────────────────────────────
  toast: {
    position: 'absolute', top: 60, left: 20, right: 20, zIndex: 999,
    backgroundColor: 'rgba(39,174,96,0.95)',
    borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
  toastText: { fontFamily: FONT, fontSize: 14, color: '#fff', textAlign: 'center' },

  // ── Top Section ────────────────────────────────────────
  topScroll:  { flex: 1 },
  topContent: { paddingHorizontal: 16, paddingTop: 50, paddingBottom: 8 },

  topRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  cekCuacaBtn: {
    backgroundColor: CARD, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  cekCuacaBtnText: { fontFamily: FONT, fontSize: 13, color: '#000' },
  greetingText:    { fontFamily: FONT, fontSize: 14, color: '#000' },

  appLabelRow:  { marginBottom: 16 },
  appLabel:     { fontFamily: FONT, fontSize: 15, color: '#000', marginBottom: 6 },
  dividerLine:  { width: 200, height: 3, backgroundColor: '#000' },

  inputLabel: { fontFamily: FONT, fontSize: 14, color: '#000', marginBottom: 8 },
  inputRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cityInput: {
    flex: 1, backgroundColor: CARD, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: FONT, fontSize: 14, color: '#000',
  },
  tambahTopBtn: {
    backgroundColor: CARD, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  tambahTopBtnText: { fontFamily: FONT, fontSize: 13, color: '#000' },

  weatherError: { fontFamily: FONT, fontSize: 12, color: '#CC0000', marginBottom: 8, textAlign: 'center' },

  weatherCard: {
    backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 12,
    padding: 14, marginBottom: 10, alignItems: 'center',
  },
  weatherEmoji:  { fontSize: 42, marginBottom: 4 },
  weatherCity:   { fontFamily: FONT, fontSize: 15, color: '#000', marginBottom: 2 },
  weatherTemp:   { fontFamily: FONT, fontSize: 42, color: '#000', marginBottom: 2 },
  weatherDesc:   { fontFamily: FONT, fontSize: 13, color: '#555', textTransform: 'capitalize', marginBottom: 10 },
  detailRow:     { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  detailItem:    { alignItems: 'center', flex: 1 },
  detailLabel:   { fontFamily: FONT, fontSize: 10, color: '#666', marginBottom: 2 },
  detailValue:   { fontFamily: FONT, fontSize: 13, color: '#000' },

  listLabel: { fontFamily: FONT, fontSize: 13, color: '#000', textAlign: 'right', marginTop: 12 },

  // ── Green Section ──────────────────────────────────────
  greenSection: {
    backgroundColor: GREEN,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12,
    minHeight: 200, maxHeight: 300,
  },

  greenHeader: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  tambahGreenBtn: {
    backgroundColor: CARD, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  tambahGreenBtnText: { fontFamily: FONT, fontSize: 13, color: '#000' },

  cityListScroll: { flex: 1 },

  cityItemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 6,
    marginBottom: 4, gap: 6,
  },
  cityNumber: { fontFamily: FONT, fontSize: 14, color: '#fff', width: 24 },
  cityName:   { fontFamily: FONT, fontSize: 14, color: '#fff' },

  pendingInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    fontFamily: FONT, fontSize: 13, color: '#fff',
  },

  editBtn:     { backgroundColor: CARD, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  editBtnText: { fontFamily: FONT, fontSize: 12, color: '#000' },
  simpanBtn:     { backgroundColor: CARD, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  simpanBtnText: { fontFamily: FONT, fontSize: 11, color: '#000' },
  hapusBtn:      { backgroundColor: '#e74c3c', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  hapusBtnText:  { fontFamily: FONT, fontSize: 11, color: '#fff' },

  // ── Footer ─────────────────────────────────────────────
  greenFooter: {
    flexDirection: 'row', justifyContent: 'flex-end',
    alignItems: 'flex-end', paddingTop: 8, gap: 12,
  },
  kelaText:    { fontFamily: FONT, fontSize: 13, color: '#1E90FF', width: 35, height: 16, textAlign: 'center', lineHeight: 16 },
  footerRight: { alignItems: 'flex-end' },
  udahanText:  { fontFamily: FONT, fontSize: 12, color: '#fff', marginBottom: 4 },
  halamanUtamaBtn:     { backgroundColor: CARD, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  halamanUtamaBtnText: { fontFamily: FONT, fontSize: 13, color: '#000' },
});
