import { HiMelody_400Regular, useFonts } from '@expo-google-fonts/hi-melody';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
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

import { auth, db } from '../../firebase';

// ─── Helper: username → internal email ───────────────────
const toInternalEmail = (username: string) =>
  `${username.toLowerCase().trim()}@cekmental.app`;

// ─── Tipe stage ───────────────────────────────────────────
type Stage = 'form' | 'success';

export default function RegisterScreen() {
  const router = useRouter();

  // ── Load Font ─────────────────────────────────────────
  const [fontsLoaded] = useFonts({ HiMelody: HiMelody_400Regular });

  // ── State ─────────────────────────────────────────────
  const [stage, setStage]               = useState<Stage>('form');
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [email, setEmail]               = useState('');    // dekoratif
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading]           = useState(false);
  const [dotIndex, setDotIndex]         = useState(0);
  const DOTS = ['Kela', 'Kela.', 'Kela..', 'Kela...'];

  // ── Animasi Kela... ───────────────────────────────────
  useEffect(() => {
    if (!loading) { setDotIndex(0); return; }
    const interval = setInterval(() => setDotIndex((p) => (p + 1) % 4), 400);
    return () => clearInterval(interval);
  }, [loading]);

  // ── Validasi username ─────────────────────────────────
  const validateUsername = (u: string): string | null => {
    if (u.length < 3)  return 'Username minimal 3 karakter.';
    if (u.length > 15) return 'Username maksimal 15 karakter.';
    if (!/^[a-zA-Z0-9_]+$/.test(u))
      return 'Username hanya boleh huruf, angka, dan underscore.';
    return null;
  };

  // ── Handler: Daftar (Form → Success) ─────────────────
  const onRegister = async () => {
    setErrorMessage('');
    const trimUser = username.trim();
    const usernameError = validateUsername(trimUser);
    if (usernameError) { setErrorMessage(usernameError); return; }
    if (!password)     { setErrorMessage('Password wajib diisi.'); return; }
    if (password.length < 6) { setErrorMessage('Password minimal 6 karakter.'); return; }

    setLoading(true);
    try {
      const internalEmail = toInternalEmail(trimUser);
      const userCredential = await createUserWithEmailAndPassword(
        auth, internalEmail, password,
      );

      // Simpan username + email dekoratif ke Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        username:  trimUser,
        email:     email.trim(),   // dekoratif, tidak dipakai auth
        createdAt: serverTimestamp(),
      });

      await signOut(auth);
      setStage('success');
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

  // ── Handler: Login Ulang (Success → Login) ────────────
  const onLoginUlang = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    router.replace('/login');
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

        {/* ── Bagian atas (tampil di kedua stage) ─────── */}
        <View style={styles.topSection}>
          <Text style={styles.appLabel}>Inilah My Aplikasi</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.appTitle}>Cek Kesehatan Mental</Text>
          <Text style={styles.appSubtitle}>
            Kamu mau tau kamu sehat gak?,{'\n'}coba cek dulu yuuu
          </Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.registerLabelRow}>
          <View style={styles.registerLabelBox}>
            <Text style={styles.registerLabelText}>Bikin akun duluu yuu</Text>
          </View>
        </View>

        {/* ── STAGE 1: FORM ───────────────────────────── */}
        {stage === 'form' && (
          <>
            <View style={styles.formSection}>

              {/* Username */}
              <Text style={styles.fieldLabel}>Masukkan Username</Text>
              <TextInput
                value={username}
                onChangeText={(t) => setUsername(t.replace(/\s/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Username"
                placeholderTextColor="rgba(0,0,0,0.5)"
                maxLength={15}
                style={styles.input}
              />
              <Text style={styles.hintText}>3–15 karakter, boleh huruf/angka/underscore</Text>

              {/* Password */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Masukkan Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Password"
                placeholderTextColor="rgba(0,0,0,0.5)"
                style={styles.input}
              />

              {/* Email (dekoratif) */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Masukkan Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="Email"
                placeholderTextColor="rgba(0,0,0,0.5)"
                style={styles.input}
              />

              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}

            </View>

            {loading && (
              <View style={styles.kelaRow}>
                <Text style={styles.kelaText}>{DOTS[dotIndex]}</Text>
              </View>
            )}

            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.75 }]}
                onPress={onRegister}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>Daftar</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* ── STAGE 2: BERHASIL ───────────────────────── */}
        {stage === 'success' && (
          <>
            <View style={styles.successSection}>
              <Text style={styles.successTitle}>Horeee Berhasil!!!</Text>
              <Text style={styles.successSubtitle}>Kamu sekarang dahh ada akun</Text>
            </View>

            {loading && (
              <View style={styles.kelaRow}>
                <Text style={styles.kelaText}>{DOTS[dotIndex]}</Text>
              </View>
            )}

            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.75 }]}
                onPress={onLoginUlang}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>login ulang</Text>
              </Pressable>
            </View>
          </>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const FONT = 'HiMelody';
const BG   = '#FFD500';
const CARD = '#D9D9D9';
const LINE = { width: 290, height: 4, color: '#000000' };

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: BG },
  background:    { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 24, paddingTop: 54, paddingBottom: 60 },

  topSection:  { marginBottom: 22 },
  appLabel:    { fontFamily: FONT, fontSize: 16, color: '#000', marginBottom: 8 },
  dividerLine: { width: LINE.width, height: LINE.height, backgroundColor: LINE.color },

  mainCard: {
    backgroundColor: CARD, borderRadius: 12,
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20, marginBottom: 36,
  },
  appTitle:    { fontFamily: FONT, fontSize: 26, color: '#000', marginBottom: 10, lineHeight: 34 },
  appSubtitle: { fontFamily: FONT, fontSize: 14, color: '#000', lineHeight: 22, marginBottom: 18 },

  registerLabelRow: { alignItems: 'center', marginBottom: 36 },
  registerLabelBox: { borderWidth: 1.5, borderColor: '#A717E5', borderRadius: 4, paddingHorizontal: 16, paddingVertical: 6 },
  registerLabelText:{ fontFamily: FONT, fontSize: 16, color: '#A717E5' },

  formSection: { marginBottom: 36 },
  fieldLabel:  { fontFamily: FONT, fontSize: 14, color: '#000', marginBottom: 8 },
  input: {
    backgroundColor: CARD, borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 16,
    fontFamily: FONT, fontSize: 14, color: '#000',
  },
  hintText: { fontFamily: FONT, fontSize: 11, color: '#555', marginTop: 4, marginBottom: 4 },
  errorText: { fontFamily: FONT, fontSize: 12, color: '#CC0000', marginTop: 14, textAlign: 'center', lineHeight: 20 },

  successSection: { alignItems: 'center', paddingVertical: 40, marginBottom: 60 },
  successTitle:   { fontFamily: FONT, fontSize: 20, color: '#000', marginBottom: 14, textAlign: 'center' },
  successSubtitle:{ fontFamily: FONT, fontSize: 16, color: '#000', textAlign: 'center' },

  kelaRow: { alignItems: 'center', marginBottom: 6 },
  kelaText: { fontFamily: FONT, fontSize: 13, color: '#1E90FF', width: 35, height: 16, textAlign: 'center', lineHeight: 16 },

  buttonRow:        { alignItems: 'center' },
  actionButton:     { backgroundColor: CARD, borderRadius: 12, paddingHorizontal: 40, paddingVertical: 14, minWidth: 160, alignItems: 'center' },
  actionButtonText: { fontFamily: FONT, fontSize: 16, color: '#000' },
});
