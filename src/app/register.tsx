import {
  PlusJakartaSans_200ExtraLight,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts as useJakartaFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Jaro_400Regular, useFonts as useJaroFonts } from '@expo-google-fonts/jaro';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { TextInput as RNTextInput } from 'react-native';
import {
  Dimensions,
  Image,
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

// ─── Canvas & scale ───────────────────────────────────────
const CANVAS_W = 390;
const { width: DW } = Dimensions.get('window');
const S = DW / CANVAS_W;

const a  = (x: number, y: number) => ({ position: 'absolute' as const, left: x * S, top: y * S });
const sz = (w: number, h: number) => ({ width: w * S, height: h * S });

// ─── Helper: username → internal email ───────────────────
const toInternalEmail = (u: string) => `${u.toLowerCase().trim()}@kimorimy.app`;

type Stage = 'form' | 'success';

// ─────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const router = useRouter();

  // ── Load Fonts ────────────────────────────────────────
  const [jakartaLoaded] = useJakartaFonts({
    PlusJakartaSans_200ExtraLight,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const [jaroLoaded] = useJaroFonts({ Jaro_400Regular });
  const fontsLoaded = jakartaLoaded && jaroLoaded;

  // ── State ─────────────────────────────────────────────
  const [stage, setStage]               = useState<Stage>('form');
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [email, setEmail]               = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading]           = useState(false);
  const [dots, setDots]                 = useState('.');

  // Refs untuk navigasi antar input (keyboard UX)
  const passwordRef = useRef<RNTextInput>(null);
  const emailRef    = useRef<RNTextInput>(null);

  // ── Animasi Kela... ───────────────────────────────────
  useEffect(() => {
    if (!loading) { setDots('.'); return; }
    const i = setInterval(() => setDots((p) => p.length >= 3 ? '.' : p + '.'), 400);
    return () => clearInterval(i);
  }, [loading]);

  // ── Validasi username ─────────────────────────────────
  const validateUsername = (u: string): string | null => {
    if (u.length < 3)  return 'Username minimal 3 karakter.';
    if (u.length > 15) return 'Username maksimal 15 karakter.';
    if (!/^[a-zA-Z0-9_]+$/.test(u))
      return 'Username hanya huruf, angka, dan underscore.';
    return null;
  };

  // ── Handler: Daftar ───────────────────────────────────
  const onRegister = async () => {
    setErrorMessage('');
    const trimUser = username.trim();
    const userErr  = validateUsername(trimUser);
    if (userErr) { setErrorMessage(userErr); return; }
    if (!password) { setErrorMessage('Password wajib diisi.'); return; }
    if (password.length < 6) { setErrorMessage('Password minimal 6 karakter.'); return; }

    setLoading(true);
    try {
      const internalEmail  = toInternalEmail(trimUser);
      const userCredential = await createUserWithEmailAndPassword(auth, internalEmail, password);

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        username:  trimUser,
        email:     email.trim(),
        createdAt: serverTimestamp(),
      });

      // Tampilkan success screen SEBELUM signOut
      // untuk cegah race condition dengan auth listener di login
      setStage('success');
      await signOut(auth);
    } catch (error: unknown) {
      const e = error as { code?: string };
      if (e.code === 'auth/email-already-in-use') {
        setErrorMessage('Username sudah dipakai, coba yang lain yaa.');
      } else if (e.code === 'auth/weak-password') {
        setErrorMessage('Password terlalu lemah, minimal 6 karakter.');
      } else {
        setErrorMessage('Gagal bikin akun, coba lagi yaa.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Handler: Login Ulang ──────────────────────────────
  const onLoginUlang = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    router.replace('/login');
  };

  if (!fontsLoaded) return <View style={styles.loadingScreen} />;

  // ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
    >
      <ScrollView
        style={styles.background}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={true}
      >

        {/* ── "Kimori .My" — X:20 Y:101 ─────────────── */}
        <Text style={[styles.kimoriText, a(20, 101)]}>Kimori .My</Text>
        <View style={[styles.kimoriLine, a(20, 133), sz(110, 4)]} />

        {/* ── Kotak judul — X:27 Y:157 W:362 H:65 ───── */}
        <View style={[styles.titleBox, a(27, 157), sz(362, 65)]}>
          <Text style={[styles.titleText, { fontSize: 28 * S }]}>
            Gimana Kabarmu Hari ini?
          </Text>
        </View>

        {/* ── Subtitle — X:37 Y:237 ───────────────────── */}
        <Text style={[styles.subtitleText, a(37, 237), { fontSize: 17 * S, width: 320 * S }]}>
          Ayoo, ambil waktu sejenak untuk memahami pikiranmu.
        </Text>
        <View style={[styles.subtitleLine, a(39, 286), sz(288, 1.5)]} />

        {/* ── Label tengah ────────────────────────────── */}
        <Text style={[styles.centerLabel, { fontSize: 19 * S }]}>
          {stage === 'form' ? 'Okaeri' : 'Berhasil!'}
        </Text>

        {/* ════════════════════════════════════════════
            STAGE 1 — FORM
        ════════════════════════════════════════════ */}
        {stage === 'form' && (
          <View style={styles.formSection}>

            {/* Username */}
            <Text style={[styles.fieldLabel, { fontSize: 20 * S }]}>Masukkan Username</Text>
            <Text style={styles.fieldHint}>3–15 karakter, huruf/angka/underscore</Text>
            <View style={[styles.inputBox, sz(371, 55)]}>
              <TextInput
                value={username}
                onChangeText={(t) => setUsername(t.replace(/\s/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Username"
                placeholderTextColor="rgba(0,0,0,0.5)"
                maxLength={15}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()}
                style={[styles.inputText, { fontSize: 20 * S }]}
              />
            </View>

            {/* Password */}
            <Text style={[styles.fieldLabel, { fontSize: 20 * S, marginTop: 14 * S }]}>
              Masukkan Password
            </Text>
            <View style={[styles.inputBox, sz(371, 55)]}>
              <TextInput
                ref={passwordRef}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Password"
                placeholderTextColor="rgba(0,0,0,0.5)"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => emailRef.current?.focus()}
                style={[styles.inputText, { fontSize: 20 * S }]}
              />
            </View>

            {/* Email (dekoratif) */}
            <Text style={[styles.fieldLabel, { fontSize: 20 * S, marginTop: 14 * S }]}>
              Masukkan Email
            </Text>
            <View style={[styles.inputBox, sz(371, 55)]}>
              <TextInput
                ref={emailRef}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="Email"
                placeholderTextColor="rgba(0,0,0,0.5)"
                returnKeyType="done"
                onSubmitEditing={onRegister}
                style={[styles.inputText, { fontSize: 20 * S }]}
              />
            </View>

            {/* Error */}
            {errorMessage ? (
              <Text style={[styles.errorText, { fontSize: 11 * S }]}>
                {errorMessage}
              </Text>
            ) : null}

            {/* Kela... loading */}
            {loading && (
              <Text style={[styles.kelaText, { fontSize: 18 * S }]}>kela{dots}</Text>
            )}

            {/* Tombol Done */}
            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [styles.actionButton, sz(123, 39), pressed && { opacity: 0.75 }]}
                onPress={onRegister}
                disabled={loading}
              >
                <Text style={[styles.actionButtonText, { fontSize: 19 * S }]}>Done</Text>
              </Pressable>
            </View>

            {/* Link ke Login */}
            <Text style={[styles.loginText, { fontSize: 17 * S }]}>
              Sudah punya akun?{' '}
              <Text style={styles.loginLink} onPress={() => router.replace('/login')}>
                Masuk di sini
              </Text>
            </Text>

          </View>
        )}

        {/* ════════════════════════════════════════════
            STAGE 2 — SUCCESS
        ════════════════════════════════════════════ */}
        {stage === 'success' && (
          <View style={styles.successSection}>
            <Text style={[styles.successTitle, { fontSize: 24 * S }]}>
              Horeee Berhasil!!!
            </Text>
            <Text style={[styles.successSub, { fontSize: 18 * S }]}>
              Kamu sekarang dahh ada akun
            </Text>

            {/* Kela... loading */}
            {loading && (
              <Text style={[styles.kelaText, { fontSize: 18 * S, textAlign: 'center' }]}>
                kela{dots}
              </Text>
            )}

            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [styles.actionButton, sz(150, 39), pressed && { opacity: 0.75 }]}
                onPress={onLoginUlang}
                disabled={loading}
              >
                <Text style={[styles.actionButtonText, { fontSize: 19 * S }]}>login ulang</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Ornamen gambar ────────────────────────── */}
        {/* pohon_3_05.png → X:335 Y:55  W:59  H:109 */}
        {/* Kucing1.png    → X:290 Y:431 W:123 H:101 */}
        {/* pohon_1_03.png → X:326 Y:596 W:79  H:74  */}
        {/* pohon_2_04.png → X:1   Y:896 W:80  H:125 */}
        {/* Pasang Image di sini setelah aset siap */}

        <View style={{ height: 60 * S }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const BG   = '#87A987';
const CARD = '#EAF1F0';
const FONT = 'PlusJakartaSans_400Regular';

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: BG },
  background:    { flex: 1, backgroundColor: BG },
  scroll:        { paddingHorizontal: 16 * S, paddingTop: 54 * S, paddingBottom: 40 * S, flexGrow: 1 },

  kimoriText:   { position: 'absolute', fontFamily: 'PlusJakartaSans_200ExtraLight', fontSize: 20 * S, color: '#000' },
  kimoriLine:   { position: 'absolute', backgroundColor: '#000' },

  titleBox:     { position: 'absolute', backgroundColor: CARD, borderRadius: 12 * S, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 * S },
  titleText:    { fontFamily: 'PlusJakartaSans_700Bold', color: '#000', textAlign: 'center' },

  subtitleText: { position: 'absolute', fontFamily: FONT, color: '#000', lineHeight: 22 * S },
  subtitleLine: { position: 'absolute', backgroundColor: '#E2E8F0' },

  centerLabel:  { fontFamily: FONT, color: '#000', textAlign: 'center', marginTop: 300 * S, marginBottom: 24 * S },

  formSection:  { paddingTop: 8 * S },
  fieldLabel:   { fontFamily: FONT, color: '#000', marginBottom: 4 * S },
  fieldHint:    { fontFamily: FONT, fontSize: 11 * S, color: '#555', marginBottom: 8 * S },
  inputBox:     { backgroundColor: CARD, borderRadius: 15 * S, justifyContent: 'center', paddingHorizontal: 16 * S, marginBottom: 8 * S },
  inputText:    { fontFamily: FONT, color: '#000', padding: 0 },

  errorText:    { fontFamily: FONT, color: '#FF0000', textAlign: 'center', marginTop: 10 * S, marginBottom: 6 * S },
  kelaText:     { fontFamily: 'Jaro_400Regular', color: '#1E90FF', textAlign: 'center', marginVertical: 8 * S },

  buttonRow:    { alignItems: 'center', marginTop: 24 * S, marginBottom: 16 * S },
  actionButton: { backgroundColor: CARD, borderRadius: 15 * S, justifyContent: 'center', alignItems: 'center' },
  actionButtonText: { fontFamily: FONT, color: '#000' },

  loginText:    { fontFamily: 'PlusJakartaSans_500Medium', color: '#000', textAlign: 'left', lineHeight: 22 * S },
  loginLink:    { fontFamily: 'PlusJakartaSans_500Medium', color: '#000', textDecorationLine: 'underline' },

  successSection:{ paddingTop: 8 * S, alignItems: 'center' },
  successTitle:  { fontFamily: 'PlusJakartaSans_700Bold', color: '#000', marginBottom: 12 * S, textAlign: 'center' },
  successSub:    { fontFamily: FONT, color: '#000', textAlign: 'center', marginBottom: 30 * S },
});
