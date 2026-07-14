import {
  PlusJakartaSans_200ExtraLight,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_700Bold,
  useFonts as useJakartaFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Jaro_400Regular, useFonts as useJaroFonts } from '@expo-google-fonts/jaro';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { auth } from '../../firebase';

// ─── Canvas referensi Figma ───────────────────────────────
const CANVAS_W = 390;
const CANVAS_H = 844;

// ─── Helper: username → internal email (Firebase Auth) ──
const toInternalEmail = (username: string) =>
  `${username.toLowerCase().trim()}@kimorimy.app`;

export default function LoginScreen() {
  const router = useRouter();

  // ── Scale factor: canvas Figma → lebar device aktual ──
  const { width: deviceWidth } = Dimensions.get('window');
  const scale = deviceWidth / CANVAS_W;

  // ── Load Fonts ────────────────────────────────────────
  const [jakartaLoaded] = useJakartaFonts({
    PlusJakartaSans_200ExtraLight,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
  });
  const [jaroLoaded] = useJaroFonts({ Jaro_400Regular });
  const fontsLoaded = jakartaLoaded && jaroLoaded;

  // ── State ─────────────────────────────────────────────
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading]           = useState(false);
  const [dots, setDots]                 = useState('.');

  const trimmedUsername = useMemo(() => username.trim(), [username]);

  // ── Race condition fix (auth listener) ────────────────
  const isReady = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => { isReady.current = true; }, 300);
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && isReady.current) router.replace('/');
    });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, [router]);

  // ── Animasi loading "kela..." → titik bertambah ───────
  useEffect(() => {
    if (!loading) { setDots('.'); return; }
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '.' : prev + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, [loading]);

  // ── Login Handler ─────────────────────────────────────
  const onLogin = async () => {
    setErrorMessage('');
    if (!trimmedUsername || !password) {
      setErrorMessage('Username dan password wajib diisi.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, toInternalEmail(trimmedUsername), password);
      router.replace('/');
    } catch {
      // Semua error auth diseragamkan jadi satu pesan sesuai desain
      setErrorMessage('error');
    } finally {
      setLoading(false);
    }
  };

  // ── Navigasi ke Register (replace agar listener mati) ─
  const goToRegister = () => router.replace('/register');

  if (!fontsLoaded) {
    return <View style={styles.loadingScreen} />;
  }

  // ─────────────────────────────────────────────────────
  // RENDER — semua posisi dihitung dari koordinat Figma
  // dikali `scale` supaya proporsional di semua device
  // ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <View style={[styles.canvas, { width: deviceWidth, height: CANVAS_H * scale }]}>

        {/* ── "Kimori .My" — X:20 Y:101 ─────────────────── */}
        <Text
          style={[
            styles.kimoriText,
            pos(20, 101, scale),
          ]}
        >
          Kimori .My
        </Text>

        {/* Garis bawah "Kimori .My" — X:20 Y:133 W:110 H:4 */}
        <View
          style={[
            styles.kimoriLine,
            pos(20, 133, scale),
            sizeStyle(110, 4, scale),
          ]}
        />

        {/* ── Kotak "Gimana Kabarmu Hari ini?" ──────────── */}
        {/* X:27 Y:157 W:362 H:65, radius 12 */}
        <View
          style={[
            styles.titleBox,
            pos(27, 157, scale),
            sizeStyle(362, 65, scale),
          ]}
        >
          <Text style={[styles.titleText, { fontSize: 28 * scale }]}>
            Gimana Kabarmu Hari ini?
          </Text>
        </View>

        {/* ── Subtitle — X:37 Y:237 ─────────────────────── */}
        <Text
          style={[
            styles.subtitleText,
            pos(37, 237, scale),
            { fontSize: 17 * scale, width: 320 * scale },
          ]}
        >
          Ayoo, ambil waktu sejenak untuk memahami pikiranmu.
        </Text>

        {/* Garis bawah subtitle — X:39 Y:286 W:288 H:1.5 */}
        <View
          style={[
            styles.subtitleLine,
            pos(39, 286, scale),
            sizeStyle(288, 1.5, scale),
          ]}
        />

        {/* ── "Okaeri" — X:159 Y:356 ─────────────────────── */}
        <Text
          style={[
            styles.okaeriText,
            pos(159, 356, scale),
            { fontSize: 19 * scale },
          ]}
        >
          Okaeri
        </Text>

        {/* 4 garis dekoratif bawah "Okaeri" — Y:382, W:59 H:1 */}
        <View style={[styles.okaeriLine, pos(159, 382, scale), sizeStyle(59, 1, scale)]} />
        <View style={[styles.okaeriLine, pos(221, 382, scale), sizeStyle(59, 1, scale)]} />
        <View style={[styles.okaeriLine, pos(225, 382, scale), sizeStyle(2, 1, scale)]} />
        <View style={[styles.okaeriLine, pos(229, 382, scale), sizeStyle(59, 1, scale)]} />

        {/* ════════════ ASET GAMBAR (pasang manual) ════════════ */}
        {/* pohon_3_05.png → X:335 Y:55 W:59 H:109 */}
        <View style={[styles.imagePlaceholder, pos(335, 55, scale), sizeStyle(59, 109, scale)]} />

        {/* Kucing_1_01.png → X:290 Y:431 W:123 H:101 */}
        <View style={[styles.imagePlaceholder, pos(290, 431, scale), sizeStyle(123, 101, scale)]} />

        {/* pohon_1_03.png → X:326 Y:596 W:79 H:74 */}
        <View style={[styles.imagePlaceholder, pos(326, 596, scale), sizeStyle(79, 74, scale)]} />

        {/* pohon_2_04.png → X:1 Y:896 W:80 H:125 */}
        <View style={[styles.imagePlaceholder, pos(1, 896, scale), sizeStyle(80, 125, scale)]} />
        {/* ═══════════════════════════════════════════════════ */}

        {/* ── "Masukkan Username" — X:18 Y:482 ───────────── */}
        <Text style={[styles.fieldLabel, pos(18, 482, scale), { fontSize: 20 * scale }]}>
          Masukkan Username
        </Text>

        {/* Input Username — X:18 Y:512 W:371 H:55 radius:15 */}
        <View
          style={[
            styles.inputBox,
            pos(18, 512, scale),
            sizeStyle(371, 55, scale),
          ]}
        >
          <TextInput
            value={username}
            onChangeText={(t) => setUsername(t.replace(/\s/g, ''))}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Username"
            placeholderTextColor="rgba(0,0,0,0.5)"
            maxLength={15}
            style={[styles.inputText, { fontSize: 20 * scale }]}
          />
        </View>

        {/* ── "Masukkan Password" — X:18 Y:586 ───────────── */}
        <Text style={[styles.fieldLabel, pos(18, 586, scale), { fontSize: 20 * scale }]}>
          Masukkan Password
        </Text>

        {/* Input Password — X:18 Y:615 W:371 H:55 radius:15 */}
        <View
          style={[
            styles.inputBox,
            pos(18, 615, scale),
            sizeStyle(371, 55, scale),
          ]}
        >
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="rgba(0,0,0,0.5)"
            style={[styles.inputText, { fontSize: 20 * scale }]}
          />
        </View>

        {/* ── Error message — X:81 Y:693 ─────────────────── */}
        {errorMessage ? (
          <Text
            style={[
              styles.errorText,
              pos(81, 693, scale),
              { fontSize: 11 * scale, width: 228 * scale },
            ]}
          >
            Kayaknya ada yang salah deh, coba cek lagi username dan passwornya dong
          </Text>
        ) : null}

        {/* ── Loading "kela..." — X:182 Y:699, font Jaro ─── */}
        {loading && (
          <Text
            style={[
              styles.kelaText,
              pos(182, 699, scale),
              { fontSize: 18 * scale },
            ]}
          >
            kela{dots}
          </Text>
        )}

        {/* ── Tombol "Login Yukk." — X:137 Y:744 W:123 H:39 */}
        <Pressable
          style={({ pressed }) => [
            styles.loginButton,
            pos(137, 744, scale),
            sizeStyle(123, 39, scale),
            pressed && { opacity: 0.75 },
          ]}
          onPress={onLogin}
          disabled={loading}
        >
          <Text style={[styles.loginButtonText, { fontSize: 19 * scale }]}>
            Login Yukk.
          </Text>
        </Pressable>

        {/* ── Footer register — X:8 Y:818 ────────────────── */}
        <Text
          style={[
            styles.registerText,
            pos(8, 818, scale),
            { fontSize: 17 * scale, width: 374 * scale },
          ]}
        >
          Yahh kamu belum ada akun yahh, bikin dulu yuu,{' '}
          <Text style={styles.registerLink} onPress={goToRegister}>
            Register
          </Text>
        </Text>

      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Helper untuk posisi & ukuran absolut ─────────────────
function pos(x: number, y: number, scale: number) {
  return { left: x * scale, top: y * scale };
}
function sizeStyle(w: number, h: number, scale: number) {
  return { width: w * scale, height: h * scale };
}

// ─── Styles ───────────────────────────────────────────────
const BG = '#FFB37C';

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: BG },

  canvas: {
    backgroundColor: BG,
    position: 'relative',
    overflow: 'hidden',
  },

  // "Kimori .My"
  kimoriText: {
    position: 'absolute',
    fontFamily: 'PlusJakartaSans_200ExtraLight',
    fontSize: 20,
    color: '#000000',
  },
  kimoriLine: {
    position: 'absolute',
    backgroundColor: '#000000',
  },

  // Kotak judul
  titleBox: {
    position: 'absolute',
    backgroundColor: '#EAF1F0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  titleText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    textAlign: 'center',
  },

  // Subtitle
  subtitleText: {
    position: 'absolute',
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#000000',
    lineHeight: 22,
  },
  subtitleLine: {
    position: 'absolute',
    backgroundColor: '#E2E8F0',
  },

  // Okaeri
  okaeriText: {
    position: 'absolute',
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#000000',
  },
  okaeriLine: {
    position: 'absolute',
    backgroundColor: '#D86262',
  },

  // Placeholder gambar (pasang manual nanti)
  imagePlaceholder: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },

  // Field label
  fieldLabel: {
    position: 'absolute',
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#000000',
  },

  // Input box
  inputBox: {
    position: 'absolute',
    backgroundColor: '#EAF1F0',
    borderRadius: 15,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  inputText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#000000',
    padding: 0,
  },

  // Error
  errorText: {
    position: 'absolute',
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#FF0000',
    textAlign: 'center',
  },

  // Loading "kela..."
  kelaText: {
    position: 'absolute',
    fontFamily: 'Jaro_400Regular',
    color: '#1E90FF',
  },

  // Tombol Login
  loginButton: {
    position: 'absolute',
    backgroundColor: '#EAF1F0',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#000000',
  },

  // Footer register
  registerText: {
    position: 'absolute',
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#000000',
    textAlign: 'left',
    lineHeight: 22,
  },
  registerLink: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#000000',
    textDecorationLine: 'underline',
  },
});
