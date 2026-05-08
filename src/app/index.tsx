import { HiMelody_400Regular, useFonts } from '@expo-google-fonts/hi-melody';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { auth, db } from '../../firebase';

export default function HomeScreen() {
  const router = useRouter();

  // ── Load Font ─────────────────────────────────────────
  const [fontsLoaded] = useFonts({ HiMelody: HiMelody_400Regular });

  // ── State ─────────────────────────────────────────────
  const [username, setUsername] = useState<string>('');
  const [loading, setLoading]   = useState(false);
  const [dotIndex, setDotIndex] = useState(0);
  const DOTS = ['Kela', 'Kela.', 'Kela..', 'Kela...'];

  // ── Auth Guard + Fetch Username ───────────────────────
  const isReady = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => { isReady.current = true; }, 300);
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user && isReady.current) { router.replace('/login'); return; }
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (snap.exists()) setUsername(snap.data().username ?? 'User');
        } catch {
          setUsername('User');
        }
      }
    });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, [router]);

  // ── Animasi Kela... ───────────────────────────────────
  useEffect(() => {
    if (!loading) { setDotIndex(0); return; }
    const interval = setInterval(() => setDotIndex((p) => (p + 1) % 4), 400);
    return () => clearInterval(interval);
  }, [loading]);

  // ── Handler: Cek Cuaca → /cuaca ───────────────────────
  const onCekCuaca = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    router.push('/cuaca');
    setLoading(false);
  };

  // ── Handler: Logout ───────────────────────────────────
  const onLogout = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 900));
    await signOut(auth);
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
        showsVerticalScrollIndicator={false}
      >

        {/* ── Sapaan username ───────────────────────────── */}
        {username ? (
          <Text style={styles.greeting}>Haii, {username}</Text>
        ) : null}

        {/* ── "Inilah My Aplikasi" + garis ────────────── */}
        <View style={styles.topSection}>
          <Text style={styles.appLabel}>Inilah My Aplikasi</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ── Card Utama D9D9D9 ────────────────────────── */}
        <View style={styles.mainCard}>
          <Text style={styles.appTitle}>Cek Kesehatan Mental</Text>
          <Text style={styles.appSubtitle}>
            Kamu mau tau kamu sehat gak?,{'\n'}coba cek dulu yuuu
          </Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ── "Halaman Utama" border kotak ungu ─────────── */}
        <View style={styles.pageLabelRow}>
          <View style={styles.pageLabelBox}>
            <Text style={styles.pageLabelText}>Halaman Utama</Text>
          </View>
        </View>

        {/* ── Menu: Cek Mental (disabled) ───────────────── */}
        <View style={styles.menuSection}>
          <Text style={styles.menuDesc}>Mau langsung cek ahh!!</Text>
          <Pressable style={[styles.menuButton, styles.menuButtonDisabled]} disabled>
            <Text style={[styles.menuButtonText, { color: '#555' }]}>Cek mental</Text>
          </Pressable>
        </View>

        {/* ── Menu: Cek Cuaca (aktif) ───────────────────── */}
        <View style={[styles.menuSection, { marginTop: 10 }]}>
          <Text style={styles.menuDesc}>Ehh liat cuaca dulu deng!!</Text>
          <Pressable
            style={({ pressed }) => [
              styles.menuButton,
              pressed && !loading && { opacity: 0.75 },
            ]}
            onPress={onCekCuaca}
            disabled={loading}
          >
            <Text style={styles.menuButtonText}>Cek cuaca</Text>
          </Pressable>
        </View>

        {/* ── Indikator Loading Kela... ─────────────────── */}
        {loading && (
          <View style={styles.kelaRow}>
            <Text style={styles.kelaText}>{DOTS[dotIndex]}</Text>
          </View>
        )}

        {/* spacer */}
        <View style={{ flex: 1, minHeight: 100 }} />

        {/* ── Logout pojok kanan bawah ──────────────────── */}
        <View style={styles.logoutSection}>
          <Text style={styles.logoutLabel}>Udahan ahh..</Text>
          <Pressable
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && !loading && { opacity: 0.75 },
            ]}
            onPress={onLogout}
            disabled={loading}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </Pressable>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const FONT = 'HiMelody';
const BG   = '#87CEEB';
const CARD = '#D9D9D9';
const LINE = { width: 290, height: 4, color: '#000000' };

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: BG },
  background:    { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 24, paddingTop: 54, paddingBottom: 40, flexGrow: 1 },

  greeting:    { fontFamily: FONT, fontSize: 18, color: '#000', marginBottom: 18 },

  topSection:  { marginBottom: 22 },
  appLabel:    { fontFamily: FONT, fontSize: 16, color: '#000', marginBottom: 8 },
  dividerLine: { width: LINE.width, height: LINE.height, backgroundColor: LINE.color },

  mainCard: {
    backgroundColor: CARD, borderRadius: 12,
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20, marginBottom: 28,
  },
  appTitle:    { fontFamily: FONT, fontSize: 26, color: '#000', marginBottom: 10, lineHeight: 34 },
  appSubtitle: { fontFamily: FONT, fontSize: 14, color: '#000', lineHeight: 22, marginBottom: 18 },

  pageLabelRow:  { alignItems: 'center', marginBottom: 30 },
  pageLabelBox:  { borderWidth: 1.5, borderColor: '#A717E5', borderRadius: 4, paddingHorizontal: 16, paddingVertical: 6 },
  pageLabelText: { fontFamily: FONT, fontSize: 16, color: '#A717E5' },

  menuSection:          { marginBottom: 20 },
  menuDesc:             { fontFamily: FONT, fontSize: 14, color: '#000', marginBottom: 10 },
  menuButton:           { backgroundColor: CARD, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 12, alignSelf: 'flex-start' },
  menuButtonDisabled:   { opacity: 0.45 },
  menuButtonText:       { fontFamily: FONT, fontSize: 14, color: '#000' },

  kelaRow:  { alignItems: 'center', marginTop: 30, marginBottom: 6 },
  kelaText: { fontFamily: FONT, fontSize: 13, color: '#1E90FF', width: 35, height: 16, textAlign: 'center', lineHeight: 16 },

  logoutSection:    { alignItems: 'flex-end', marginTop: 20 },
  logoutLabel:      { fontFamily: FONT, fontSize: 13, color: '#000', marginBottom: 6 },
  logoutButton:     { backgroundColor: CARD, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10, minWidth: 90, alignItems: 'center' },
  logoutButtonText: { fontFamily: FONT, fontSize: 14, color: '#000' },
});
