import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, BackHandler, Dimensions, Image,
  KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  addDoc, collection, deleteDoc,
  doc, getDoc, onSnapshot, orderBy, query,
} from 'firebase/firestore';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, runOnJS,
} from 'react-native-reanimated';
import {
  useFonts,
  PlusJakartaSans_200ExtraLight,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Jaro_400Regular } from '@expo-google-fonts/jaro';
import LottieView from 'lottie-react-native';
import { auth, db } from '../../firebase';

// ─── Canvas & scale ───────────────────────────────────────
const CANVAS_W = 390;
const { width: DW } = Dimensions.get('window');
const S = DW / CANVAS_W;
const a  = (x: number, y: number) => ({ position: 'absolute' as const, left: x * S, top: y * S });
const sz = (w: number, h: number) => ({ width: w * S, height: h * S });

// ─── Soal ─────────────────────────────────────────────────
const QUESTIONS = [
  { id: 1,  text: 'Bagaimana kualitas tidurmu akhir-akhir ini?' },
  { id: 2,  text: 'Seberapa sering kamu merasa gelisah tanpa alasan?' },
  { id: 3,  text: 'Apakah kamu mudah merasa lelah meskipun tidak banyak beraktivitas?' },
  { id: 4,  text: 'Bagaimana selera makanmu dalam seminggu terakhir?' },
  { id: 5,  text: 'Seberapa sering kamu merasa kehilangan minat pada hal yang kamu sukai?' },
  { id: 6,  text: 'Apakah kamu sering merasa sulit berkonsentrasi?' },
  { id: 7,  text: 'Seberapa sering kamu merasa tegang atau kaku di area leher/bahu?' },
  { id: 8,  text: 'Apakah kamu sering merasa sedih tanpa sebab yang jelas?' },
  { id: 9,  text: 'Bagaimana perasaanmu saat memikirkan masa depan?' },
  { id: 10, text: 'Seberapa sering kamu ingin menyendiri dan menjauhi orang lain?' },
];

const OPTIONS = ['A. Iya', 'B. Bisa Jadi', 'C. Mungkin', 'D. Gimana Lu aja dah'];
const OPT_KEYS = ['A', 'B', 'C', 'D'];

type Panel = 'history' | 'test' | 'result';

// ─────────────────────────────────────────────────────────
export default function TesMentalScreen() {
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

  // ── Panel State ───────────────────────────────────────
  const [panel, setPanel]             = useState<Panel>('history');
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [answers, setAnswers]         = useState<Record<number, string>>({});
  const [result, setResult]           = useState({ sehat: 0, cemas: 0, depresi: 0, status: '' });

  // ── Firestore realtime ────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'assessments'),
      orderBy('created_at', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      setHistoryData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [uid]);

  // ── Hardware back ─────────────────────────────────────
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (panel !== 'history') { setPanel('history'); return true; }
      router.replace('/');
      return true;
    });
    return () => h.remove();
  }, [panel]);

  // ── Lottie state ──────────────────────────────────────
  const [playFire, setPlayFire]   = useState(false);
  const [playTrash, setPlayTrash] = useState(false);

  // ── Reanimated untuk hapus item ───────────────────────
  const animScale   = useSharedValue(1);
  const animRotate  = useSharedValue(0);
  const animOpacity = useSharedValue(1);
  const animStyle   = useAnimatedStyle(() => ({
    transform: [{ scale: animScale.value }, { rotate: `${animRotate.value}deg` }],
    opacity:   animOpacity.value,
  }));

  const executeDelete = async () => {
    if (uid && selectedId) {
      await deleteDoc(doc(db, 'users', uid, 'assessments', selectedId));
    }
    setSelectedId(null);
    animScale.value = 1; animRotate.value = 0; animOpacity.value = 1;
  };

  const handleDelete = (type: 'trash' | 'fire') => {
    if (!selectedId) {
      Alert.alert('Pilih Data', 'Ketuk salah satu riwayat tes dulu.');
      return;
    }
    if (type === 'trash') {
      setPlayTrash(true);
      // Animasi Reanimated jalan barengan sama Lottie
      setTimeout(() => {
        setPlayTrash(false);
        animScale.value   = withTiming(0.1, { duration: 600 });
        animRotate.value  = withTiming(360, { duration: 600 });
        animOpacity.value = withTiming(0,   { duration: 600 },
          () => runOnJS(executeDelete)());
      }, 500);
    } else {
      setPlayFire(true);
      setTimeout(() => {
        setPlayFire(false);
        animOpacity.value = withTiming(0, { duration: 800 },
          () => runOnJS(executeDelete)());
      }, 900); // Tunggu apinya membesar dulu baru hilangin datanya
    }
  };

  // ── Hitung skor ───────────────────────────────────────
  const calculateResult = async () => {
    if (Object.keys(answers).length < 10) {
      Alert.alert('Belum Selesai', 'Isi semua 10 pertanyaan dulu ya!');
      return;
    }
    let sehat = 0, cemas = 0, depresi = 0;
    Object.values(answers).forEach((ans) => {
      if (ans === 'A') sehat   += 10;
      if (ans === 'B' || ans === 'C') cemas += 10;
      if (ans === 'D') depresi += 10;
    });
    let status = 'Sehat';
    if (cemas > sehat && cemas >= depresi)  status = 'Cemas';
    if (depresi > sehat && depresi > cemas) status = 'Depresi';

    setResult({ sehat, cemas, depresi, status });
    setPanel('result');

    if (uid) {
      const dateStr = new Date().toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
      await addDoc(collection(db, 'users', uid, 'assessments'), {
        score:           Math.max(sehat, cemas, depresi),
        result_category: status,
        created_at:      dateStr,
      });
    }
  };

  const getResultMsg = () => {
    if (result.status === 'Sehat')
      return `"Yeyyy ${username} sehaatt !!, Selamat yahh Tetap pertahankan kondisi ini yahh. Semaangattt"`;
    if (result.status === 'Cemas')
      return '"Kamu lagi ngerasa cemas, ya? Tarik napas dalam-dalam dulu yuk."';
    return '"Hari ini kerasa berat banget ya? Kimori siap nemenin kamu cerita kok."';
  };

  if (!fontsLoaded) return <View style={styles.bg} />;

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Canvas ─────────────────────────────────── */}
        <View style={[styles.canvas, { width: DW }]}>

          {/* ── Header (selalu tampil) ─────────────────── */}
          <Text style={[styles.greeting, a(11, 19)]}>Haii, {username || 'User'}!</Text>
          <Text style={[styles.kimoriText, a(300, 10)]}>Kimori .My</Text>

          {/* Indikator "Test..." — X:12 Y:44 W:133 H:25 */}
          <View style={[styles.indicatorBox, a(12, 44), sz(133, 25)]}>
            <Text style={styles.indicatorText}>Test...</Text>
          </View>

          {/* Intro — X:8 Y:77 W:220 */}
          <Text style={[styles.introText, a(8, 77), { width: 220 * S }]}>
            Aku tau kamu kuat, tapi kita cek dulu yukk kondisi kamu saat ini dengan mengisi kuesioner ini. Semaangatt!!
          </Text>

          {/* ════════════════════════════════════════════
              PANEL 1 — RIWAYAT TEST
          ════════════════════════════════════════════ */}
          {panel === 'history' && (
            <>
              {/* "Riwayat Test" — X:14 Y:143 W:133 H:23 */}
              <View style={[styles.riwayatBox, a(14, 143), sz(133, 23)]}>
                <Text style={styles.riwayatText}>Riwayat Test</Text>
              </View>

              {/* List riwayat */}
              <View style={{ marginTop: 170 * S, paddingHorizontal: 12 * S }}>
                {historyData.map((item, index) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedId(item.id === selectedId ? null : item.id)}
                  >
                    <Animated.View style={[
                      styles.historyItem,
                      { marginBottom: 12 * S, overflow: 'hidden' }, // overflow hidden biar lottie rapi
                      selectedId === item.id && animStyle,
                      selectedId === item.id && styles.historyItemSelected,
                    ]}>

                      {/* Animasi Api & Sampah dirender di sini, numpuk di atas kartu list */}
                      {selectedId === item.id && playFire && (
                        <LottieView source={require('../../assets/animasi/fire.json')} style={[StyleSheet.absoluteFillObject, { transform: [{ scale: 1.6 }] }]} autoPlay loop={false} zIndex={10} />
                      )}
                      {selectedId === item.id && playTrash && (
                        <LottieView source={require('../../assets/animasi/trash.json')} style={StyleSheet.absoluteFillObject} autoPlay loop={false} zIndex={10} />
                      )}

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.historyTitle}>{index + 1}. {item.result_category}</Text>
                        <Text style={styles.historyDate}>{item.created_at}</Text>
                      </View>

                      {/* Chart box */}
                      <View style={[styles.chartBox, { marginTop: 8 * S }]}>
                        <View style={styles.chartRow}>
                          <View style={[styles.miniBar, {
                            width: (item.result_category === 'Sehat' ? '75%' : '25%') as any,
                            backgroundColor: '#2DD4BF',
                          }]} />
                          <Text style={styles.chartLabel}>Sehat</Text>
                        </View>
                        <View style={styles.chartRow}>
                          <View style={[styles.miniBar, {
                            width: (item.result_category === 'Cemas' ? '75%' : '25%') as any,
                            backgroundColor: '#F59E0B',
                          }]} />
                          <Text style={styles.chartLabel}>Cemas</Text>
                        </View>
                        <View style={styles.chartRow}>
                          <View style={[styles.miniBar, {
                            width: (item.result_category === 'Depresi' ? '75%' : '25%') as any,
                            backgroundColor: '#EF4444',
                          }]} />
                          <Text style={styles.chartLabel}>Depresi</Text>
                        </View>
                      </View>
                    </Animated.View>
                  </Pressable>
                ))}
              </View>

              {/* Spacer biar icon tidak nempel konten */}
              <View style={{ height: 160 * S }} />

              {/* Action Bar Bawah (Icon diubah relative biar flex natural) */}
              <View style={[styles.iconRow]}>
                <Pressable style={[styles.iconBtn, { width: 46 * S, height: 45 * S, position: 'relative' }]} onPress={() => handleDelete('fire')}>
                  <Image source={require('../../assets/icon/api.png')} style={{ width: '80%', height: '80%' }} resizeMode="contain" />
                </Pressable>

                <Pressable style={[styles.iconBtn, { width: 46 * S, height: 45 * S, position: 'relative' }]} onPress={() => handleDelete('trash')}>
                  <Image source={require('../../assets/icon/tongsampah.png')} style={{ width: '80%', height: '80%' }} resizeMode="contain" />
                </Pressable>

                <View style={{ flex: 1 }} />

                <Pressable style={[styles.iconBtn, { width: 46 * S, height: 45 * S, position: 'relative' }]} onPress={() => { setAnswers({}); setPanel('test'); }}>
                  <Image source={require('../../assets/icon/tambah.png')} style={{ width: '80%', height: '80%' }} resizeMode="contain" />
                </Pressable>
              </View>
            </>
          )}

          {/* ════════════════════════════════════════════
              PANEL 2 — KUESIONER
          ════════════════════════════════════════════ */}
          {panel === 'test' && (
            <View style={{ marginTop: 143 * S, paddingHorizontal: 14 * S }}>
              {QUESTIONS.map((q, idx) => (
                <View key={q.id} style={{ marginBottom: 22 * S }}>
                  <Text style={styles.questionText}>
                    {idx + 1}. {q.text}
                  </Text>
                  {OPTIONS.map((opt, oIdx) => {
                    const key      = OPT_KEYS[oIdx];
                    const selected = answers[q.id] === key;
                    return (
                      <Pressable
                        key={key}
                        style={[styles.optionBox, selected && styles.optionBoxSelected]}
                        onPress={() => setAnswers((p) => ({ ...p, [q.id]: key }))}
                      >
                        <Text style={styles.optionText}>{opt}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}

              {/* Tombol Lihat Hasil — rata kanan sesuai X:271 */}
              <View style={{ alignItems: 'flex-end', marginTop: 16 * S, marginBottom: 20 * S, paddingRight: 8 * S }}>
                <Pressable style={styles.lihatHasilBtn} onPress={calculateResult}>
                  <Text style={styles.lihatHasilText}>Lihat Hasil..</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ════════════════════════════════════════════
              PANEL 3 — HASIL TES
          ════════════════════════════════════════════ */}
          {panel === 'result' && (
            <View style={{ marginTop: 143 * S, paddingHorizontal: 14 * S, paddingBottom: 40 * S }}>

              {/* Status besar */}
              <Text style={styles.resultStatusText}>
                {result.status === 'Sehat' ? 'SEHAAATTT!!!'
                  : result.status === 'Cemas' ? 'CEMAAASS...'
                  : 'DEPRESII...'}
              </Text>

              {/* Diagram batang vertikal */}
              <View style={styles.barChartContainer}>
                <View style={styles.barColumn}>
                  <View style={[styles.barVertical, {
                    height: Math.max(20, result.depresi) * 2 * S,
                    backgroundColor: '#EF4444',
                  }]} />
                  <Text style={styles.barLabel}>Depresi</Text>
                </View>
                <View style={styles.barColumn}>
                  <View style={[styles.barVertical, {
                    height: Math.max(20, result.cemas) * 2 * S,
                    backgroundColor: '#F59E0B',
                  }]} />
                  <Text style={styles.barLabel}>Cemas</Text>
                </View>
                <View style={styles.barColumn}>
                  <View style={[styles.barVertical, {
                    height: Math.max(20, result.sehat) * 2 * S,
                    backgroundColor: '#2DD4BF',
                  }]} />
                  <Text style={styles.barLabel}>Sehat</Text>
                </View>
                <View style={styles.barBaseline} />
              </View>

              {/* Pesan hasil */}
              <Text style={styles.resultMsg}>{getResultMsg()}</Text>

              {/* Tombol baris bawah */}
              <View style={styles.resultBtnRow}>
                <Pressable style={styles.actionBtn} onPress={() => router.push('/notepad')}>
                  <Text style={styles.actionBtnText}>Ketik...</Text>
                </Pressable>
                <Pressable style={styles.actionBtn}
                  onPress={() => { setAnswers({}); setPanel('test'); }}>
                  <Text style={styles.actionBtnText}>Test Ulang..</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── "Udahan dulu" + "Home"
               Muncul di panel history dan result
               Saat panel test → HIDDEN agar user fokus isi soal dulu
               Tombol Lihat Hasil yang jadi pintu keluar dari panel test ── */}
          {panel !== 'test' && (
            <View style={styles.footerRow}>
              <View style={{ flex: 1 }} />
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.udahanTitle}>Udahan dulu</Text>
                <Pressable style={styles.homeBtn} onPress={() => router.replace('/')}>
                  <Text style={styles.homeBtnText}>Home</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── Ornamen gambar (pointerEvents none, tidak ganggu scroll) ── */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Image source={require('../../assets/icon/pohon4.png')}
              style={[{ position: 'absolute' }, a(310, 42), sz(80, 72)]} resizeMode="contain" />
            <Image source={require('../../assets/icon/pohon5.png')}
              style={[{ position: 'absolute' }, a(240, 107), sz(64, 55)]} resizeMode="contain" />
            <Image source={require('../../assets/icon/Kucing1.png')}
              style={[{ position: 'absolute' }, a(318, 245), sz(93, 76),
                { transform: [{ rotate: '-169.25deg' }] }]} resizeMode="contain" />
            <Image source={require('../../assets/icon/Kucing2.png')}
              style={[{ position: 'absolute' }, a(328, 461), sz(93, 76),
                { transform: [{ rotate: '-11deg' }] }]} resizeMode="contain" />
            <Image source={require('../../assets/icon/pohon3.png')}
              style={[{ position: 'absolute' }, a(341, 701), sz(71, 103)]} resizeMode="contain" />
            <Image source={require('../../assets/icon/pohon1.png')}
              style={[{ position: 'absolute' }, a(-28, 801), sz(142, 115)]} resizeMode="contain" />
            <Image source={require('../../assets/icon/pohon2.png')}
              style={[{ position: 'absolute' }, a(116, 808), sz(68, 109)]} resizeMode="contain" />
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}


// ─── Styles ───────────────────────────────────────────────
const BG   = '#D9A0A0';
const CARD = '#D9D9D9';
const FONT = 'PlusJakartaSans_400Regular';

const styles = StyleSheet.create({
  bg:            { flex: 1, backgroundColor: BG },
  scrollContent: { flexGrow: 1, backgroundColor: BG },
  canvas:        { backgroundColor: BG, position: 'relative', paddingBottom: 20 * S },

  // Header
  greeting:      { position: 'absolute', fontFamily: FONT, fontSize: 19 * S, color: '#000' },
  kimoriText:    { position: 'absolute', fontFamily: 'PlusJakartaSans_200ExtraLight', fontSize: 20 * S, color: '#000' },
  indicatorBox:  { position: 'absolute', backgroundColor: CARD, borderRadius: 5 * S, justifyContent: 'center', paddingHorizontal: 8 * S },
  indicatorText: { fontFamily: FONT, fontSize: 14 * S, color: '#000' },
  introText:     { position: 'absolute', fontFamily: FONT, fontSize: 12 * S, color: '#000', lineHeight: 17 * S },

  // History panel
  riwayatBox:    { position: 'absolute', backgroundColor: CARD, borderRadius: 5 * S, justifyContent: 'center', paddingHorizontal: 8 * S },
  riwayatText:   { fontFamily: FONT, fontSize: 19 * S, color: '#000' },
  historyItem:   { borderRadius: 8 * S, padding: 8 * S, backgroundColor: 'transparent' },
  historyItemSelected: { backgroundColor: 'rgba(255,255,255,0.3)' },
  historyTitle:  { fontFamily: FONT, fontSize: 19 * S, color: '#000' },
  historyDate:   { position: 'absolute', right: 8 * S, top: 8 * S, fontFamily: FONT, fontSize: 13 * S, color: '#000' },
  chartBox:      { backgroundColor: CARD, borderRadius: 6 * S, padding: 8 * S, justifyContent: 'space-evenly' },
  chartRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 4 * S },
  miniBar:       { height: 12 * S, borderRadius: 3 * S },
  chartLabel:    { fontFamily: FONT, fontSize: 11 * S, color: '#000', marginLeft: 8 * S },

  // Icons
  iconBtn:       { position: 'absolute', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 25 * S },

  // Test panel — soal
  questionText:  { fontFamily: FONT, fontSize: 17 * S, color: '#000', marginBottom: 10 * S, lineHeight: 24 * S },
  optionBox: {
    marginHorizontal: 4 * S,
    paddingVertical: 10 * S,
    paddingHorizontal: 14 * S,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 8 * S,
    marginBottom: 8 * S,
  },
  optionBoxSelected: { backgroundColor: '#B7E4C7' },
  optionText:    { fontFamily: FONT, fontSize: 15 * S, color: '#000' },

  // Lihat Hasil button
  lihatHasilBtn: {
    backgroundColor: CARD,
    borderRadius: 5 * S,
    paddingHorizontal: 16 * S,
    paddingVertical: 8 * S,
    width: 130 * S,
    alignItems: 'center',
  },
  lihatHasilText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16 * S, color: '#000' },

  // Result panel
  resultStatusText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 28 * S, color: '#000',
    textAlign: 'center', marginTop: 16 * S, marginBottom: 20 * S,
    paddingHorizontal: 20 * S,
  },
  barChartContainer: {
    width: '100%', height: 220 * S,
    flexDirection: 'row', justifyContent: 'space-evenly',
    alignItems: 'flex-end', paddingHorizontal: 30 * S,
    marginBottom: 20 * S, position: 'relative',
  },
  barColumn:  { alignItems: 'center', justifyContent: 'flex-end', width: 60 * S },
  barVertical:{ width: 50 * S, borderTopLeftRadius: 5 * S, borderTopRightRadius: 5 * S },
  barLabel:   { fontFamily: FONT, fontSize: 13 * S, color: '#000', marginTop: 6 * S },
  barBaseline:{ position: 'absolute', bottom: 26 * S, left: 20 * S, right: 20 * S, height: 2, backgroundColor: '#000' },
  resultBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24 * S,
    paddingHorizontal: 4 * S,
  },
  resultMsg:  { fontFamily: FONT, fontSize: 17 * S, color: '#000', textAlign: 'center', paddingHorizontal: 24 * S, lineHeight: 26 * S, marginBottom: 60 * S },

  // Action buttons
  actionBtn:    { backgroundColor: CARD, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 * S, paddingVertical: 10 * S, borderRadius: 5 * S },
  actionBtnText:{ fontFamily: 'PlusJakartaSans_300Light', fontSize: 16 * S, color: '#000' },

  // Icon row (panel history)
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16 * S,
    paddingVertical: 12 * S,
    gap: 12 * S,
  },

  // Footer
  footerRow: {
    flexDirection: 'row',
    paddingHorizontal: 16 * S,
    paddingVertical: 16 * S,
    marginTop: 8 * S,
  },
  udahanTitle:  { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 20 * S, color: '#000', marginBottom: 4 * S },
  homeBtn:      { backgroundColor: CARD, borderRadius: 5 * S, paddingHorizontal: 16 * S, paddingVertical: 6 * S, alignItems: 'center' },
  homeBtnText:  { fontFamily: 'PlusJakartaSans_300Light', fontSize: 16 * S, color: '#000' },
});