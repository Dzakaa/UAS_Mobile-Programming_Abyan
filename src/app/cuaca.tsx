import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, BackHandler, Dimensions, Image,
  Keyboard, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  addDoc, collection, deleteDoc, doc,
  getDoc, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc,
} from 'firebase/firestore';
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
const { width: DW } = Dimensions.get('window');
const S = DW / CANVAS_W;

const a  = (x: number, y: number) => ({ position: 'absolute' as const, left: x * S, top: y * S });
const sz = (w: number, h: number) => ({ width: w * S, height: h * S });

// ─── API ──────────────────────────────────────────────────
const API_KEY = '289bd9bd4013ff528a68dea82cecbe22';

type WeatherData = {
  temp: number; feelsLike: number; humidity: number;
  description: string; icon: string;
  cityName: string; country: string; windSpeed: number;
};
type SavedCity = { id: string; name: string };

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

  // ── STATE KEYBOARD (Biar layar nyusut pas keyboard naik) ──
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) { router.replace('/login'); return; }
      setUid(user.uid);
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) setUsername(snap.data().username ?? 'User');
      } catch { setUsername('User'); }
    });
    return unsub;
  }, [router]);

  // ── Weather ───────────────────────────────────────────
  const [cityInput, setCityInput]     = useState('');
  const [weather, setWeather]         = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState('');

  // ── Favorites ─────────────────────────────────────────
  const [favorites, setFavorites]     = useState<SavedCity[]>([]);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // ── Loading ───────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [dots, setDots]       = useState('.');
  useEffect(() => {
    if (!loading) { setDots('.'); return; }
    const i = setInterval(() => setDots((p) => p.length >= 3 ? '.' : p + '.'), 400);
    return () => clearInterval(i);
  }, [loading]);

  // ── Toast ─────────────────────────────────────────────
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg: string) => {
    setToastMsg(msg);
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  // ── Realtime Firestore ────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'cities'),
      orderBy('addedAt', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      setFavorites(snap.docs.map((d) => ({ id: d.id, name: d.data().name ?? '' })));
    });
  }, [uid]);

  // ── Hardware back → home ──────────────────────────────
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/'); return true;
    });
    return () => h.remove();
  }, []);

  // ── Fetch cuaca ───────────────────────────────────────
  const fetchWeather = async (city: string) => {
    const t = city.trim();
    if (!t) return;
    setLoading(true); setWeatherError(''); setWeather(null);
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
    } catch { setWeatherError('Gagal konek ke API 😢'); }
    finally  { setLoading(false); }
  };

  // ── Tambah favorit ────────────────────────────────────
  const handleAddFavorite = async () => {
    if (!weather || !uid) { showToast('Cari kotanya dulu yuk!'); return; }
    if (favorites.some((f) => f.name.toLowerCase() === weather.cityName.toLowerCase())) {
      showToast(`${weather.cityName} udah ada di favorit!`); return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'users', uid, 'cities'), {
        name: weather.cityName, addedAt: serverTimestamp(),
      });
      showToast(`🎉 ${weather.cityName} masuk kota favorit!`);
    } catch { showToast('Gagal menyimpan ke favorit.'); }
    finally  { setLoading(false); }
  };

  // ── Hapus favorit ─────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!uid) return;
    try { await deleteDoc(doc(db, 'users', uid, 'cities', id)); }
    catch { showToast('Gagal menghapus kota.'); }
  };

  // ── Simpan edit ───────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!uid || !editingId || !editingName.trim()) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', uid, 'cities', editingId), { name: editingName.trim() });
      setEditingId(null);
      showToast('Nama kota berhasil diubah!');
    } catch { showToast('Gagal mengubah nama kota.'); }
    finally  { setLoading(false); }
  };

  if (!fontsLoaded) return <View style={styles.bg} />;

  // ─────────────────────────────────────────────────────
  return (
    // WADAH UTAMA KITA: Tingginya dipotong sebesar keyboard biar canvas bisa discroll enak
    <View style={[styles.bg, { paddingBottom: keyboardHeight }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { minHeight: 950 * S }]}
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.canvas, { width: DW }]}>

          {/* ── Toast — X:20 top:50 ───────────────────── */}
          <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
            <Text style={styles.toastText}>{toastMsg}</Text>
          </Animated.View>

          {/* ── "Haii, Username" — X:11 Y:19 ─────────── */}
          <Text style={[styles.greeting, a(11, 19)]}>
            Haii, {username || 'User'}!
          </Text>

          {/* ── "Kimori .My" — X:300 Y:10 ────────────── */}
          <Text style={[styles.kimoriText, a(300, 10)]}>Kimori .My</Text>

          {/* ── Indikator "Cek Cuaca..." — X:12 Y:44 W:133 H:20 ── */}
          <View style={[styles.indicatorBox, a(12, 44), sz(133, 20)]}>
            <Text style={styles.indicatorText}>Cek Cuaca...</Text>
          </View>

          {/* ── "Masukkan Kotamu!" — X:13 Y:102 ─────── */}
          <Text style={[styles.inputLabel, a(13, 102)]}>Masukkan Kotamu!</Text>

          {/* ── Input kota — X:15 Y:132 W:284 H:24 ──── */}
          <View style={[styles.inputBox, a(15, 132), sz(284, 24)]}>
            <TextInput
              value={cityInput}
              onChangeText={setCityInput}
              placeholder="Your City..."
              placeholderTextColor="rgba(0,0,0,0.5)"
              style={styles.inputText}
              onSubmitEditing={() => fetchWeather(cityInput)}
              returnKeyType="search"
            />
          </View>

          {/* ── Tombol "tambah" (cari) — X:330 Y:132 W:68 H:23 ── */}
          <Pressable
            style={({ pressed }) => [
              styles.btnTambah, a(330, 132), sz(68, 23),
              pressed && { opacity: 0.75 },
            ]}
            onPress={() => fetchWeather(cityInput)}
            disabled={loading}
          >
            <Text style={styles.btnTambahText}>tambah</Text>
          </Pressable>

          {/* ── Area cuaca tengah — X:20 Y:180 ──────── */}
          {weatherError ? (
            <Text style={[styles.errorText, a(20, 200), { width: 280 * S }]}>
              {weatherError}
            </Text>
          ) : null}

          {weather && (
            <View style={[styles.weatherCard, a(20, 165), { width: 260 * S }]}>
              <Text style={styles.weatherEmoji}>{wEmoji(weather.icon)}</Text>
              <Text style={styles.weatherTemp}>{weather.temp}°C</Text>
              <Text style={styles.weatherCity}>{weather.cityName}, {weather.country}</Text>
              <Text style={styles.weatherDesc}>{weather.description}</Text>
              {/* Detail row */}
              <View style={styles.weatherDetailRow}>
                <View style={styles.weatherDetailItem}>
                  <Text style={styles.weatherDetailLabel}>Terasa</Text>
                  <Text style={styles.weatherDetailVal}>{weather.feelsLike}°C</Text>
                </View>
                <View style={styles.weatherDetailItem}>
                  <Text style={styles.weatherDetailLabel}>Lembab</Text>
                  <Text style={styles.weatherDetailVal}>{weather.humidity}%</Text>
                </View>
                <View style={styles.weatherDetailItem}>
                  <Text style={styles.weatherDetailLabel}>Angin</Text>
                  <Text style={styles.weatherDetailVal}>{weather.windSpeed} m/s</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── "Tambah Favorit" — X:19 Y:529 W:114 H:23 ── */}
          <Pressable
            style={({ pressed }) => [
              styles.btnFav, a(19, 529), sz(114, 23),
              pressed && { opacity: 0.75 },
            ]}
            onPress={handleAddFavorite}
          >
            <Text style={styles.btnFavText}>Tambah Favorit</Text>
          </Pressable>

          {/* ── Kotak besar daftar favorit — X:11 Y:561 W:370 H:247 ── */}
          <View style={[styles.favoritesBox, a(11, 561), sz(370, 247)]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {favorites.map((city, index) => (
                <View key={city.id} style={styles.favItem}>
                  {editingId === city.id ? (
                    /* Mode edit — TextInput ikut naik bersama keyboard */
                    <>
                      <Text style={styles.favNum}>{index + 1}. </Text>
                      <TextInput
                        value={editingName}
                        onChangeText={setEditingName}
                        autoFocus
                        style={styles.favEditInput}
                        onSubmitEditing={handleSaveEdit}
                        returnKeyType="done"
                      />
                      <Pressable style={styles.favSaveBtn} onPress={handleSaveEdit}>
                        <Text style={styles.favSaveBtnText}>✓</Text>
                      </Pressable>
                    </>
                  ) : (
                    /* Mode normal */
                    <>
                      {/* LOGIKA BARU: Sekali tekan = ngecek cuaca, Tahan lama = Edit nama kota */}
                      <Pressable
                        style={{ flex: 1 }}
                        onPress={() => fetchWeather(city.name)}
                        onLongPress={() => { setEditingId(city.id); setEditingName(city.name); }}
                      >
                        <Text style={styles.favName}>{index + 1}.  {city.name}</Text>
                      </Pressable>
                      {/* Icon silang */}
                      <Pressable onPress={() => handleDelete(city.id)} style={styles.favDeleteBtn}>
                        <Text style={styles.favDeleteText}>✕</Text>
                      </Pressable>
                    </>
                  )}
                  {/* Garis pemisah — hanya tampil jika ada item */}
                  <View style={styles.favDivider} />
                </View>
              ))}
            </ScrollView>
          </View>

          {/* ── Kela... loading — X:187 Y:724 ────────── */}
          {loading && (
            <Text style={[styles.kelaText, a(187, 724)]}>kela{dots}</Text>
          )}

          {/* ── "Udahan dulu" + "Home" — X:274 Y:837 ── */}
          <Text style={[styles.udahanTitle, a(274, 837)]}>Udahan dulu</Text>
          <Pressable
            style={[styles.homeBtn, a(296, 864), sz(85, 23)]}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.homeBtnText}>Home</Text>
          </Pressable>

          {/* ── ORNAMEN GAMBAR ─────────────────────────── */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Image source={require('../../assets/icon/pohon4.png')}
              style={[{ position: 'absolute' }, a(310, 42), sz(80, 72)]} resizeMode="contain" />
            <Image source={require('../../assets/icon/pohon5.png')}
              style={[{ position: 'absolute' }, a(256, 78), sz(64, 55)]} resizeMode="contain" />
            <Image source={require('../../assets/icon/Kucing1.png')}
              style={[{ position: 'absolute' }, a(330, 496), sz(93, 76)]} resizeMode="contain" />
            <Image source={require('../../assets/icon/pohon1.png')}
              style={[{ position: 'absolute' }, a(274, 670), sz(162, 139)]} resizeMode="contain" />
            <Image source={require('../../assets/icon/pohon3.png')}
              style={[{ position: 'absolute' }, a(261, 706), sz(71, 103)]} resizeMode="contain" />
            <Image source={require('../../assets/icon/pohon2.png')}
              style={[{ position: 'absolute' }, a(10, 808), sz(68, 109)]} resizeMode="contain" />
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────
const BG   = '#5F7D95';
const CARD = '#D9D9D9';
const FONT = 'PlusJakartaSans_400Regular';

const styles = StyleSheet.create({
  bg:           { flex: 1, backgroundColor: BG },
  scrollContent:{ flexGrow: 1 },
  canvas:       { backgroundColor: 'transparent', position: 'relative', minHeight: 950 * S },

  // Toast
  toast: {
    position: 'absolute', top: 50 * S, left: 20 * S, right: 20 * S,
    zIndex: 999, backgroundColor: 'rgba(0,0,0,0.82)',
    borderRadius: 10 * S, padding: 12 * S, alignItems: 'center',
  },
  toastText: { fontFamily: FONT, fontSize: 13 * S, color: '#fff' },

  // Header
  greeting:    { position: 'absolute', fontFamily: FONT, fontSize: 19 * S, color: '#000' },
  kimoriText:  { position: 'absolute', fontFamily: 'PlusJakartaSans_200ExtraLight', fontSize: 20 * S, color: '#000' },
  indicatorBox:{ position: 'absolute', backgroundColor: CARD, borderRadius: 5 * S, justifyContent: 'flex-end', paddingBottom: 2 * S, borderBottomWidth: 2, borderBottomColor: '#D9D9D9' },
  indicatorText:{ fontFamily: FONT, fontSize: 14 * S, color: '#000' },

  // Input kota
  inputLabel:  { position: 'absolute', fontFamily: FONT, fontSize: 19 * S, color: '#000' },
  inputBox:    { position: 'absolute', backgroundColor: CARD, borderRadius: 4 * S, justifyContent: 'center', paddingHorizontal: 6 * S },
  inputText:   { fontFamily: FONT, fontSize: 17 * S, color: '#000', padding: 0 },

  // Tombol tambah (cari)
  btnTambah:     { position: 'absolute', backgroundColor: CARD, borderRadius: 4 * S, justifyContent: 'center', alignItems: 'center' },
  btnTambahText: { fontFamily: FONT, fontSize: 13 * S, color: '#000' },

  // Weather display
  errorText:   { position: 'absolute', fontFamily: FONT, fontSize: 14 * S, color: '#FFD2D2' },
  weatherCard: {
    position: 'absolute',
    alignItems: 'center',
  },
  weatherEmoji:{ fontSize: 70 * S },
  weatherTemp: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 44 * S, color: '#000', marginTop: -4 * S },
  weatherCity: { fontFamily: FONT, fontSize: 18 * S, color: '#000' },
  weatherDesc: { fontFamily: 'PlusJakartaSans_300Light', fontSize: 14 * S, color: '#000', textTransform: 'capitalize', marginBottom: 8 * S },
  weatherDetailRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 4 * S },
  weatherDetailItem:{ alignItems: 'center' },
  weatherDetailLabel:{ fontFamily: FONT, fontSize: 10 * S, color: '#222' },
  weatherDetailVal:  { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 * S, color: '#000' },

  // Tambah favorit
  btnFav:     { position: 'absolute', backgroundColor: CARD, borderRadius: 4 * S, justifyContent: 'center', alignItems: 'center' },
  btnFavText: { fontFamily: FONT, fontSize: 13 * S, color: '#000' },

  // Kotak favorit
  favoritesBox: {
    position: 'absolute',
    backgroundColor: 'rgba(217,217,217,0.3)',
    borderRadius: 15 * S,
    padding: 10 * S,
  },
  favItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8 * S, position: 'relative',
  },
  favNum:   { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12 * S, color: '#000' },
  favName:  { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12 * S, color: '#000' },
  favDivider:{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  favDeleteBtn: { paddingHorizontal: 6 * S },
  favDeleteText:{ fontFamily: FONT, fontSize: 13 * S, color: '#000' },
  favEditInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 4 * S,
    paddingHorizontal: 6 * S, fontSize: 12 * S,
    fontFamily: 'PlusJakartaSans_600SemiBold', color: '#000', height: 20 * S,
  },
  favSaveBtn:    { backgroundColor: '#4CAF50', width: 22 * S, height: 20 * S, borderRadius: 4 * S, justifyContent: 'center', alignItems: 'center', marginLeft: 6 * S },
  favSaveBtnText:{ fontSize: 10 * S, color: '#fff', fontWeight: 'bold' },

  // Kela...
  kelaText:     { position: 'absolute', fontFamily: 'Jaro_400Regular', fontSize: 18 * S, color: '#1E90FF' },

  // Footer
  udahanTitle:  { position: 'absolute', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 20 * S, color: '#000' },
  homeBtn:      { position: 'absolute', backgroundColor: CARD, borderRadius: 5 * S, justifyContent: 'center', alignItems: 'center' },
  homeBtnText:  { fontFamily: 'PlusJakartaSans_300Light', fontSize: 16 * S, color: '#000' },
});