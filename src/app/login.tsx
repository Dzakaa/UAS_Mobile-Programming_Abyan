import { HiMelody_400Regular, useFonts } from '@expo-google-fonts/hi-melody';
import { Link, useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { auth } from '../../firebase';

// ─── Helper: username → internal email ───────────────────
// Firebase Auth butuh email, user hanya tahu username mereka
const toInternalEmail = (username: string) =>
  `${username.toLowerCase().trim()}@cekmental.app`;

export default function LoginScreen() {
  const router = useRouter();

  // ── Load Font ─────────────────────────────────────────
  const [fontsLoaded] = useFonts({ HiMelody: HiMelody_400Regular });

  // ── State ─────────────────────────────────────────────
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading]           = useState(false);
  const [dotIndex, setDotIndex]         = useState(0);
  const DOTS = ['Kela', 'Kela.', 'Kela..', 'Kela...'];

  const trimmedUsername = useMemo(() => username.trim(), [username]);

  // ── Race condition fix ────────────────────────────────
  const isReady = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => { isReady.current = true; }, 300);
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && isReady.current) router.replace('/');
    });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, [router]);

  // ── Animasi Kela... ───────────────────────────────────
  useEffect(() => {
    if (!loading) { setDotIndex(0); return; }
    const interval = setInterval(() => setDotIndex((p) => (p + 1) % 4), 400);
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
    } catch (error: unknown) {
      const e = error as { code?: string };
      if (
        e.code === 'auth/user-not-found' ||
        e.code === 'auth/invalid-credential' ||
        e.code === 'auth/invalid-email'
      ) {
        setErrorMessage('error');
      } else if (e.code === 'auth/wrong-password') {
        setErrorMessage('error');
      } else {
        setErrorMessage('error');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded) return <View style={styles.loadingScreen} />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView
        style={styles.background}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* "Inilah My Aplikasi" + garis */}
        <View style={styles.topSection}>
          <Text style={styles.appLabel}>Inilah My Aplikasi</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Card Utama */}
        <View style={styles.mainCard}>
          <Text style={styles.appTitle}>Cek Kesehatan Mental</Text>
          <Text style={styles.appSubtitle}>
            Kamu mau tau kamu sehat gak?,{'\n'}coba cek dulu yuuu
          </Text>
          <View style={styles.dividerLine} />
        </View>

        {/* "Login Dulu yuu" */}
        <Text style={styles.loginLabel}>Login Dulu yuu</Text>

        {/* Form */}
        <View style={styles.formSection}>

          <Text style={styles.fieldLabel}>Masukkan Username</Text>
          <TextInput
            value={username}
            onChangeText={(t) => setUsername(t.replace(/\s/g, ''))} // no spaces
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Username"
            placeholderTextColor="rgba(0,0,0,0.5)"
            maxLength={15}
            style={styles.input}
          />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Masukkan Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="rgba(0,0,0,0.5)"
            style={styles.input}
          />

          {/* Error */}
          {errorMessage ? (
            <Text style={styles.errorText}>
              Kayaknya ada yang salah deh,{' '}
              <Text style={styles.errorTextItalic}>
                coba cek{'\n'}lagi username dan password dong
              </Text>
            </Text>
          ) : null}

        </View>

        {/* Kela... loading */}
        {loading && (
          <View style={styles.kelaRow}>
            <Text style={styles.kelaText}>{DOTS[dotIndex]}</Text>
          </View>
        )}

        {/* Tombol Login */}
        <View style={styles.buttonRow}>
          <Pressable
            style={({ pressed }) => [styles.loginButton, pressed && { opacity: 0.75 }]}
            onPress={onLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>Login Ahh..</Text>
          </Pressable>
        </View>

        {/* Link Register */}
        <View style={styles.registerRow}>
          <Text style={styles.registerText}>
            Yahh kamu belum ada akun yahh,{'\n'}bikin dulu yuu,{' '}
            <Link href="/register" asChild>
              <Text style={styles.registerLink}>Register</Text>
            </Link>
          </Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const FONT = 'HiMelody';
const BG   = '#98FF98';
const CARD = '#D9D9D9';
const LINE = { width: 290, height: 4, color: '#000000' };

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: BG },
  background:    { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 24, paddingTop: 54, paddingBottom: 40 },

  topSection:  { marginBottom: 22 },
  appLabel:    { fontFamily: FONT, fontSize: 16, color: '#000', marginBottom: 8 },
  dividerLine: { width: LINE.width, height: LINE.height, backgroundColor: LINE.color },

  mainCard: {
    backgroundColor: CARD, borderRadius: 12,
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20, marginBottom: 36,
  },
  appTitle:    { fontFamily: FONT, fontSize: 26, color: '#000', marginBottom: 10, lineHeight: 34 },
  appSubtitle: { fontFamily: FONT, fontSize: 14, color: '#000', lineHeight: 22, marginBottom: 18 },

  loginLabel: { fontFamily: FONT, fontSize: 18, color: '#A717E5', textAlign: 'center', marginBottom: 36 },

  formSection: { marginBottom: 36 },
  fieldLabel:  { fontFamily: FONT, fontSize: 14, color: '#000', marginBottom: 8 },
  input: {
    backgroundColor: CARD, borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 16,
    fontFamily: FONT, fontSize: 14, color: '#000',
  },

  errorText: {
    fontFamily: FONT, fontSize: 13, color: '#CC0000',
    marginTop: 14, marginBottom: 4, textAlign: 'center', lineHeight: 22,
  },
  errorTextItalic: {
    fontFamily: FONT, fontSize: 13, color: '#CC0000',
    fontStyle: 'italic', textAlign: 'center',
  },

  kelaRow: { alignItems: 'center', marginBottom: 6 },
  kelaText: {
    fontFamily: FONT, fontSize: 13, color: '#1E90FF',
    width: 35, height: 16, textAlign: 'center', lineHeight: 16,
  },

  buttonRow:       { alignItems: 'center', marginBottom: 28 },
  loginButton:     { backgroundColor: CARD, borderRadius: 12, paddingHorizontal: 40, paddingVertical: 14, minWidth: 160, alignItems: 'center' },
  loginButtonText: { fontFamily: FONT, fontSize: 16, color: '#000' },

  registerRow:  { paddingBottom: 10 },
  registerText: { fontFamily: FONT, fontSize: 13, color: '#000', lineHeight: 22 },
  registerLink: { fontFamily: FONT, fontSize: 13, color: '#000', textDecorationLine: 'underline' },
});
