import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';

// Import Fonts
import {
  useFonts,
  PlusJakartaSans_200ExtraLight,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Jaro_400Regular } from '@expo-google-fonts/jaro';

// Import Firebase
import { auth } from '../../firebase';

// ─── RUMUS SKALA RESPONSIVE (Biar layarnya gak kepotong!) ───
const CANVAS_W = 390;
const { width: DEVICE_W, height: DEVICE_H } = Dimensions.get('window');
const S = DEVICE_W / CANVAS_W; // Faktor skala ngikutin lebar HP

const a = (x: number, y: number) => ({ position: 'absolute' as const, left: x * S, top: y * S });
const sz = (w: number, h: number) => ({ width: w * S, height: h * S });

export default function LoginScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_200ExtraLight,
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    Jaro_400Regular,
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  const [dotIndex, setDotIndex] = useState(0);
  const DOTS = ['kela', 'kela.', 'kela..', 'kela...'];

  useEffect(() => {
    if (!loading) {
      setDotIndex(0);
      return;
    }
    const interval = setInterval(() => setDotIndex((p) => (p + 1) % 4), 400);
    return () => clearInterval(interval);
  }, [loading]);

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Kayaknya ada yang salah deh, coba cek lagi username dan passwornya dong');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/');
    } catch (error: any) {
      setErrorMsg('Kayaknya ada yang salah deh, coba cek lagi username dan passwornya dong');
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded) return <View style={styles.background} />;

  return (
    // Wadah Utama: Tingginya bakal dipotong sama keyboard biar viewable areanya pas
    <View style={[styles.background, { paddingBottom: keyboardHeight }]}>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled" // Biar pas ngetik kursor gak lari kalau layar disentuh
      >
        {/* Kertas Canvas (MinHeight dipake biar bisa digulir ke bawah) */}
        <View style={styles.canvas}>

          {/* ORNAMEN GAMBAR DI BELAKANG (WATERMARK) */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 0 }]}>
            <Image source={require('../../assets/icon/pohon3.png')} style={[styles.img, a(335, 55), sz(59, 109)]} resizeMode="contain" />
            <Image source={require('../../assets/icon/Kucing1.png')} style={[styles.img, a(290, 431), sz(123, 101)]} resizeMode="contain" />
            <Image source={require('../../assets/icon/pohon1.png')} style={[styles.img, a(326, 596), sz(79, 74)]} resizeMode="contain" />
            <Image source={require('../../assets/icon/pohon2.png')} style={[styles.img, a(1, 696), sz(80, 125)]} resizeMode="contain" />
          </View>

          {/* KONTEN UTAMA */}
          <Text style={[styles.kimoriText, a(20, 101)]}>Kimori.My</Text>
          <View style={[styles.kimoriLine, a(20, 133), sz(110, 4)]} />

          <View style={[styles.greetingBox, a(27, 157), sz(336, 65)]}>
            <Text style={styles.greetingText}>Gimana Kabarmu Hari Ini?</Text>
          </View>

          <Text style={[styles.subtitleText, a(37, 237)]}>Ayoo, ambil waktu sejenak untuk memahami pikiranmu.</Text>
          <View style={[styles.subtitleLine, a(39, 286), sz(288, 1.5)]} />

          <Text style={[styles.okaeriText, a(159, 356)]}>Okaeri</Text>
          <View style={[styles.okaeriLine, a(159, 382), sz(59, 1)]} />
          <View style={[styles.okaeriLine, a(221, 382), sz(2, 1)]} />
          <View style={[styles.okaeriLine, a(225, 382), sz(2, 1)]} />
          <View style={[styles.okaeriLine, a(229, 382), sz(2, 1)]} />

          <Text style={[styles.inputLabel, a(18, 482)]}>Masukkan Email</Text>
          <TextInput
            style={[styles.inputBox, a(18, 512), sz(354, 55)]}
            placeholder="Email"
            placeholderTextColor="rgba(0,0,0,0.5)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={[styles.inputLabel, a(18, 586)]}>Masukkan Password</Text>
          <View style={[styles.inputBoxPassword, a(18, 615), sz(354, 55)]}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="rgba(0,0,0,0.5)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 5 * S }}>
              <Text style={{ fontSize: 20 * S }}>{showPassword ? '🙈' : '👁️'}</Text>
            </Pressable>
          </View>

          {errorMsg ? (
            <Text style={[styles.errorText, a(70, 683), sz(250, 40)]}>{errorMsg}</Text>
          ) : null}

          {loading ? (
            <Text style={[styles.loadingText, a(182, 689)]}>{DOTS[dotIndex]}</Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.loginBtnBox, a(133, 734), sz(123, 39), pressed && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginBtnText}>Login Yukk.</Text>
          </Pressable>

          <Text style={[styles.registerTextContainer, a(8, 808), { width: 374 * S }]}>
            Yahh kamu belum ada akun yahh, bikin dulu yuu,{' '}
            <Text style={styles.registerLink} onPress={() => router.push('/register')}>
              Register
            </Text>
          </Text>

        </View>
      </ScrollView>
    </View>
  );
}

const FONT_REG = 'PlusJakartaSans_400Regular';
const FONT_EXTRA = 'PlusJakartaSans_200ExtraLight';
const FONT_SEMI = 'PlusJakartaSans_600SemiBold';
const FONT_LOADING = 'Jaro_400Regular';

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#FFB37C' },
  scrollContainer: { flexGrow: 1 },
  canvas: { position: 'relative', minHeight: 900 * S, width: DEVICE_W },
  img: { position: 'absolute' },

  kimoriText: { fontFamily: FONT_EXTRA, fontSize: 20 * S, color: '#000000' },
  kimoriLine: { backgroundColor: '#000000' },

  greetingBox: { borderRadius: 12 * S, backgroundColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center' },
  greetingText: { fontFamily: FONT_SEMI, fontSize: 24 * S, color: '#000000', fontWeight: 'bold', textAlign: 'center' }, // Font dikecilin dikit biar gak nabrak

  subtitleText: { fontFamily: FONT_REG, fontSize: 16 * S, color: '#000000', width: 310 * S }, // Dikasih width biar rapi
  subtitleLine: { backgroundColor: '#E2E8F0' },

  okaeriText: { fontFamily: FONT_REG, fontSize: 19 * S, color: '#000000' },
  okaeriLine: { backgroundColor: '#D86262' },

  inputLabel: { fontFamily: FONT_REG, fontSize: 20 * S, color: '#000000' },
  inputBox: {
    borderRadius: 15 * S, backgroundColor: '#FFFFFF', paddingHorizontal: 15 * S,
    fontFamily: FONT_REG, fontSize: 18 * S, color: '#000000'
  },

  inputBoxPassword: {
    borderRadius: 15 * S, backgroundColor: '#FFFFFF', paddingHorizontal: 15 * S,
    flexDirection: 'row', alignItems: 'center'
  },
  passwordInput: { flex: 1, fontFamily: FONT_REG, fontSize: 18 * S, color: '#000000' },

  errorText: { fontFamily: FONT_REG, fontSize: 11 * S, color: '#FF0000', textAlign: 'center' },
  loadingText: { fontFamily: FONT_LOADING, fontSize: 18 * S, color: '#1E90FF' },

  loginBtnBox: { borderRadius: 15 * S, backgroundColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center' },
  loginBtnText: { fontFamily: FONT_REG, fontSize: 19 * S, color: '#000000' },

  registerTextContainer: { fontFamily: FONT_SEMI, fontSize: 15 * S, color: '#000000', textAlign: 'center' }, // Dibuat center biar seimbang
  registerLink: { fontFamily: FONT_SEMI, fontSize: 15 * S, color: '#1E90FF', textDecorationLine: 'underline' },
});