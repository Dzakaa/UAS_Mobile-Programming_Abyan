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
  ScrollView,
  Image,
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
      setErrorMessage('error');
    } finally {
      setLoading(false);
    }
  };

  const goToRegister = () => router.replace('/register');

  if (!fontsLoaded) {
    return <View style={styles.loadingScreen} />;
  }

  // ─────────────────────────────────────────────────────
  // RENDER — Diubah pakai ScrollView agar fleksibel di device
  // ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView
        contentContainerStyle={[styles.canvas, { width: deviceWidth, height: CANVAS_H * scale }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.kimoriText, pos(20, 101, scale)]}>Kimori .My</Text>
        <View style={[styles.kimoriLine, pos(20, 133, scale), sizeStyle(110, 4, scale)]} />

        <View style={[styles.titleBox, pos(27, 157, scale), sizeStyle(362, 65, scale)]}>
          <Text style={[styles.titleText, { fontSize: 28 * scale }]}>Gimana Kabarmu Hari ini?</Text>
        </View>

        <Text style={[styles.subtitleText, pos(37, 237, scale), { fontSize: 17 * scale, width: 320 * scale }]}>
          Ayoo, ambil waktu sejenak untuk memahami pikiranmu.
        </Text>
        <View style={[styles.subtitleLine, pos(39, 286, scale), sizeStyle(288, 1.5, scale)]} />

        <Text style={[styles.okaeriText, pos(159, 356, scale), { fontSize: 19 * scale }]}>Okaeri</Text>
        <View style={[styles.okaeriLine, pos(159, 382, scale), sizeStyle(59, 1, scale)]} />
        <View style={[styles.okaeriLine, pos(221, 382, scale), sizeStyle(59, 1, scale)]} />
        <View style={[styles.okaeriLine, pos(225, 382, scale), sizeStyle(2, 1, scale)]} />
        <View style={[styles.okaeriLine, pos(229, 382, scale), sizeStyle(59, 1, scale)]} />

        {/* ════════════ ASET GAMBAR DIMASUKKAN DI SINI ════════════ */}
        <Image
          source={require('../../assets/images/pohon3.png')}
          style={[pos(335, 55, scale), sizeStyle(59, 109, scale), {position: 'absolute', resizeMode: 'contain'}]}
        />
        <Image
          source={require('../../assets/images/Kucing1.png')}
          style={[pos(290, 431, scale), sizeStyle(123, 101, scale), {position: 'absolute', resizeMode: 'contain'}]}
        />
        <Image
          source={require('../../assets/images/pohon1.png')}
          style={[pos(326, 596, scale), sizeStyle(79, 74, scale), {position: 'absolute', resizeMode: 'contain'}]}
        />
        <Image
          source={require('../../assets/images/pohon2.png')}
          style={[pos(1, 896, scale), sizeStyle(80, 125, scale), {position: 'absolute', resizeMode: 'contain'}]}
        />
        {/* ═══════════════════════════════════════════════════════ */}

        <Text style={[styles.fieldLabel, pos(18, 482, scale), { fontSize: 20 * scale }]}>Masukkan Username</Text>
        <View style={[styles.inputBox, pos(18, 512, scale), sizeStyle(371, 55, scale)]}>
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

        <Text style={[styles.fieldLabel, pos(18, 586, scale), { fontSize: 20 * scale }]}>Masukkan Password</Text>
        <View style={[styles.inputBox, pos(18, 615, scale), sizeStyle(371, 55, scale)]}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="rgba(0,0,0,0.5)"
            style={[styles.inputText, { fontSize: 20 * scale }]}
          />
        </View>

        {errorMessage ? (
          <Text style={[styles.errorText, pos(81, 693, scale), { fontSize: 11 * scale, width: 228 * scale }]}>
            Kayaknya ada yang salah deh, coba cek lagi username dan passwornya dong
          </Text>
        ) : null}

        {loading && (
          <Text style={[styles.kelaText, pos(182, 699, scale), { fontSize: 18 * scale }]}>kela{dots}</Text>
        )}

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
          <Text style={[styles.loginButtonText, { fontSize: 19 * scale }]}>Login Yukk.</Text>
        </Pressable>

        <Text style={[styles.registerText, pos(8, 790, scale), { fontSize: 17 * scale, width: 374 * scale }]}>
        Yahh kamu belum ada akun yahh, bikin dulu yuu,{' '}
        <Text style={styles.registerLink} onPress={goToRegister}>Register</Text>
        </Text>

      </ScrollView>
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
  canvas: { backgroundColor: BG, position: 'relative', overflow: 'hidden' },
  kimoriText: { position: 'absolute', fontFamily: 'PlusJakartaSans_200ExtraLight', fontSize: 20, color: '#000000' },
  kimoriLine: { position: 'absolute', backgroundColor: '#000000' },
  titleBox: { position: 'absolute', backgroundColor: '#EAF1F0', borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },
  titleText: { fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', textAlign: 'center' },
  subtitleText: { position: 'absolute', fontFamily: 'PlusJakartaSans_400Regular', color: '#000000', lineHeight: 22 },
  subtitleLine: { position: 'absolute', backgroundColor: '#E2E8F0' },
  okaeriText: { position: 'absolute', fontFamily: 'PlusJakartaSans_400Regular', color: '#000000' },
  okaeriLine: { position: 'absolute', backgroundColor: '#D86262' },
  fieldLabel: { position: 'absolute', fontFamily: 'PlusJakartaSans_400Regular', color: '#000000' },
  inputBox: { position: 'absolute', backgroundColor: '#EAF1F0', borderRadius: 15, justifyContent: 'center', paddingHorizontal: 16 },
  inputText: { fontFamily: 'PlusJakartaSans_400Regular', color: '#000000', padding: 0 },
  errorText: { position: 'absolute', fontFamily: 'PlusJakartaSans_400Regular', color: '#FF0000', textAlign: 'center' },
  kelaText: { position: 'absolute', fontFamily: 'Jaro_400Regular', color: '#1E90FF' },
  loginButton: { position: 'absolute', backgroundColor: '#EAF1F0', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  loginButtonText: { fontFamily: 'PlusJakartaSans_400Regular', color: '#000000' },
  registerText: { position: 'absolute', fontFamily: 'PlusJakartaSans_500Medium', color: '#000000', textAlign: 'left', lineHeight: 22 },
  registerLink: { fontFamily: 'PlusJakartaSans_500Medium', color: '#000000', textDecorationLine: 'underline' },
});