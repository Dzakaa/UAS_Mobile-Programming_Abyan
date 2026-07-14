import React, { useEffect, useRef, useState } from 'react';
import {
  BackHandler, Keyboard, Dimensions, Image, KeyboardAvoidingView,
  Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View, Animated
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  addDoc, collection, deleteDoc, doc,
  getDoc, onSnapshot, orderBy, query, updateDoc,
} from 'firebase/firestore';
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

const CANVAS_W = 390;
const { width: DEVICE_W, height: DEVICE_H } = Dimensions.get('window');
const S = DEVICE_W / CANVAS_W;

const a = (x: number, y: number) => ({ position: 'absolute' as const, left: x * S, top: y * S });
const sz = (w: number, h: number) => ({ width: w * S, height: h * S });

function getGreetingByTime(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Selamat Pagii 🌤️\nKamu harus semangat yahh hari ini, soalnya ada mimpi yang harus kamu kejar hehe :)';
  if (hour >= 12 && hour < 18) return 'Selamat Soree!! 🌅\nKamu pasti lelah yahh sekarang, ayoo tetap semangat dan janga lupa istirahat yahh...';
  return 'Selamat Malam!! 🌙\nGimana kamu hari ini, kamu pasti capek yahh :(\napakah ada yang mau kamu ceritakan atau ungkapkan tentang hari ini';
}

const LINE_COUNT = 30;
type Note = { id: string; title: string; content: string; created_at: string };

export default function NotepadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets(); // Buat deteksi safe area (kamera depan/bawah layar)

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_200ExtraLight, PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, Jaro_400Regular,
  });

  const [uid, setUid] = useState<string | null>(null);
  const [username, setUsername] = useState('');

  // ── State untuk dinamisasi ukuran layar vs Keyboard ──
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

  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'notes'), orderBy('created_at', 'desc'));
    return onSnapshot(q, (snap) => {
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Note)));
    });
  }, [uid]);

  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [playFire, setPlayFire] = useState(false);
  const [playTrash, setPlayTrash] = useState(false);
  const squeezeAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const [navLoading, setNavLoading] = useState(false);
  const [dots, setDots] = useState('.');
  useEffect(() => {
    if (!navLoading) { setDots('.'); return; }
    const i = setInterval(() => setDots((p) => p.length >= 3 ? '.' : p + '.'), 400);
    return () => clearInterval(i);
  }, [navLoading]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isEditing) { handleSave(); return true; }
      router.replace('/');
      return true;
    });
    return () => handler.remove();
  }, [isEditing, title, content, selectedId, uid]);

  const openEditor = (note?: Note) => {
    squeezeAnim.setValue(1); opacityAnim.setValue(1);
    if (note) {
      setSelectedId(note.id); setTitle(note.title ?? ''); setContent(note.content ?? '');
    } else {
      setSelectedId(null); setTitle(''); setContent('');
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!uid) return;
    if (!title.trim() && !content.trim()) { setIsEditing(false); return; }
    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    if (selectedId) await updateDoc(doc(db, 'users', uid, 'notes', selectedId), { title, content, created_at: dateStr });
    else await addDoc(collection(db, 'users', uid, 'notes'), { title, content, created_at: dateStr });
    setIsEditing(false);
  };

  const handleDeleteList = async (type: 'trash' | 'fire') => {
    if (!selectedId || !uid) return;
    const doDelete = async () => { await deleteDoc(doc(db, 'users', uid, 'notes', selectedId)); setSelectedId(null); };

    if (type === 'fire') {
      setPlayFire(true); setTimeout(async () => { setPlayFire(false); await doDelete(); }, 1200);
    } else {
      setPlayTrash(true); setTimeout(async () => { setPlayTrash(false); await doDelete(); }, 800);
    }
  };

  const handleClearContent = (type: 'trash' | 'fire') => {
    if (type === 'fire') {
      setPlayFire(true);
      Animated.timing(opacityAnim, { toValue: 0, duration: 900, useNativeDriver: true }).start();
      setTimeout(() => { setPlayFire(false); setContent(''); opacityAnim.setValue(1); }, 1000);
    } else {
      setPlayTrash(true);
      Animated.parallel([
        Animated.timing(squeezeAnim, { toValue: 0.1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 700, useNativeDriver: true })
      ]).start();
      setTimeout(() => { setPlayTrash(false); setContent(''); squeezeAnim.setValue(1); opacityAnim.setValue(1); }, 800);
    }
  };

  const filteredNotes = notes.filter((n) => n.title?.toLowerCase().includes(searchQuery.toLowerCase()));
  const greetingTime = getGreetingByTime();

  if (!fontsLoaded) return <View style={styles.bg} />;

  return (
    <View style={styles.bg}>
      {/* BACKGROUND WATERMARK (FIXED) */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: 0.15, zIndex: 0 }]}>
        <Image source={require('../../assets/icon/pohon4.png')} style={[{ position: 'absolute' }, a(310, 42), sz(80, 72)]} resizeMode="contain" />
        <Image source={require('../../assets/icon/pohon5.png')} style={[{ position: 'absolute' }, a(350, 118), sz(64, 55)]} resizeMode="contain" />
        <Image source={require('../../assets/icon/Kucing1.png')} style={[{ position: 'absolute' }, a(324, 253), sz(93, 76)]} resizeMode="contain" />
        <Image source={require('../../assets/icon/pohon1.png')} style={[{ position: 'absolute' }, a(-36, 564), sz(142, 115)]} resizeMode="contain" />
        <Image source={require('../../assets/icon/pohon3.png')} style={[{ position: 'absolute' }, a(311, 706), sz(71, 103)]} resizeMode="contain" />
        <Image source={require('../../assets/icon/pohon2.png')} style={[{ position: 'absolute' }, a(116, 808), sz(68, 109)]} resizeMode="contain" />
      </View>

      {/* Dimatikan behaviornya karena kita udah handle ukuran secara manual via height/marginBottom */}
      <KeyboardAvoidingView style={{ flex: 1, zIndex: 1 }} behavior={undefined}>
        {!isEditing ? (
          // =========================================================
          // PANEL 1: TAMPILAN LIST
          // =========================================================
          <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={[styles.canvas, { width: DEVICE_W }]}>
              <Text style={[styles.greeting, a(11, 19)]}>Haii, {username || 'User'}!</Text>
              <Text style={[styles.kimoriText, a(300, 10)]}>Kimori .My</Text>
              <View style={[styles.indicatorBox, a(12, 44), sz(133, 25)]}><Text style={styles.indicatorText}>Notepad</Text></View>
              <Text style={[styles.timeGreeting, a(12, 71), { width: 200 * S }]}>{greetingTime}</Text>

              <View style={[styles.searchBox, a(12, 140), sz(289, 23)]}>
                <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="cari..." placeholderTextColor="rgba(0,0,0,0.5)" style={styles.searchInput} />
              </View>

              <View style={[a(0, 163), { width: DEVICE_W, paddingHorizontal: 16 * S, paddingBottom: 100 * S }]}>
                {filteredNotes.map((item, index) => (
                  <Pressable key={item.id} onPress={() => setSelectedId(item.id === selectedId ? null : item.id)} onLongPress={() => openEditor(item)}>
                    <View style={[styles.noteItemWrapper, { marginBottom: 16 * S }, selectedId === item.id && styles.noteItemSelected]}>

                      {/* ANIMASI API DIBESARKAN (transform: scale 1.6) */}
                      {selectedId === item.id && playFire && (
                        <LottieView
                          source={require('../../assets/animasi/fire.json')}
                          style={[StyleSheet.absoluteFillObject, { transform: [{ scale: 1.6 }] }]}
                          autoPlay
                          loop={false}
                          zIndex={10}
                        />
                      )}

                      {selectedId === item.id && playTrash && <LottieView source={require('../../assets/animasi/trash.json')} style={StyleSheet.absoluteFillObject} autoPlay loop={false} zIndex={10} />}

                      <View style={styles.noteTitleRow}>
                        <Text style={styles.noteTitle}>{index + 1}.{'  '}{item.title || 'Tanpa Judul'}</Text>
                        <Text style={styles.noteDate}>{item.created_at}</Text>
                      </View>

                      <View style={[styles.noteContentBox, sz(349, 72)]}>
                        {[0, 1, 2].map((lineIdx) => (
                          <View key={lineIdx} style={styles.noteContentLine}>
                            <Text style={styles.noteContentText} numberOfLines={1}>{lineIdx === 0 ? item.content?.split('\n')[0] ?? '' : item.content?.split('\n')[lineIdx] ?? ''}</Text>
                          </View>
                        ))}
                      </View>
                      {selectedId === item.id && <Pressable onPress={() => openEditor(item)} style={styles.editHintBtn}><Text style={styles.editHintText}>Ketuk untuk edit →</Text></Pressable>}
                    </View>
                  </Pressable>
                ))}

                {/* ACTION BAR LIST */}
                <View style={[styles.actionRow, { marginTop: 30 * S, marginBottom: 50 * S }]}>
                  <View style={styles.actionLeft}>
                    <Pressable style={styles.relativeIconBtn} onPress={() => handleDeleteList('fire')}><Image source={require('../../assets/icon/api.png')} style={{ width: '80%', height: '80%' }} resizeMode="contain" /></Pressable>
                    <Pressable style={styles.relativeIconBtn} onPress={() => handleDeleteList('trash')}><Image source={require('../../assets/icon/tongsampah.png')} style={{ width: '80%', height: '80%' }} resizeMode="contain" /></Pressable>
                    <Pressable style={styles.relativeIconBtn} onPress={() => openEditor()}><Image source={require('../../assets/icon/tambah.png')} style={{ width: '80%', height: '80%' }} resizeMode="contain" /></Pressable>
                  </View>
                  <View style={styles.actionRight}>
                    <Text style={styles.udahanTitleRelative}>Udahan dulu</Text>
                    <Pressable style={styles.homeBtnRelative} onPress={async () => { setNavLoading(true); await new Promise((r) => setTimeout(r, 900)); router.replace('/'); }}>
                      <Text style={styles.homeBtnText}>Home</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        ) : (
          // =========================================================
          // PANEL 2: TAMPILAN EDITOR
          // =========================================================
          <View style={[styles.canvas, { flex: 1, width: DEVICE_W }]}>
            <Text style={[styles.greeting, a(11, 19)]}>Haii, {username || 'User'}!</Text>
            <Text style={[styles.kimoriText, a(300, 10)]}>Kimori .My</Text>
            <View style={[styles.indicatorBox, a(12, 44), sz(133, 25)]}><Text style={styles.indicatorText}>Notepad</Text></View>
            <Text style={[styles.timeGreeting, a(12, 71), { width: 200 * S }]}>{greetingTime}</Text>

            {/* KONTEN EDITOR: Kunci Tingginya. Fisik kotak ini mengecil persis sebesar keyboard! */}
            <View style={{
              height: DEVICE_H - (140 * S) - (keyboardHeight > 0 ? keyboardHeight : insets.bottom),
              marginTop: 140 * S,
              paddingBottom: 15 * S,
              width: DEVICE_W
            }}>

              {playFire && (
                <View style={{position: 'absolute', top: -30, right: 30, width: 80, height: 80, zIndex: 99}}>
                  <LottieView source={require('../../assets/animasi/fire.json')} style={{width: '100%', height: '100%'}} autoPlay loop={false} />
                </View>
              )}

              <View style={styles.titleInputWrapper}>
                <TextInput value={title} onChangeText={setTitle} placeholder="Judul...." placeholderTextColor="rgba(0,0,0,0.35)" style={styles.titleInput} />
              </View>

              {/* Kertas Catatan yang akan mengecil karena dipaksa sama View induknya */}
              <Animated.View style={[styles.notebookWrapper, { flex: 1, transform: [{ scale: squeezeAnim }], opacity: opacityAnim }]}>
                <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                  {Array.from({ length: LINE_COUNT }).map((_, i) => <View key={i} style={styles.notebookLine} />)}
                </View>

                {/* TEMPAT NGETIK */}
                <TextInput
                  value={content}
                  onChangeText={setContent}
                  multiline
                  textAlignVertical="top"
                  placeholder="Ketik ceritamu di sini..."
                  style={[styles.notebookInput, { flex: 1 }]}
                />

                {playTrash && <LottieView source={require('../../assets/animasi/trash.json')} style={StyleSheet.absoluteFillObject} autoPlay loop={false} zIndex={10} />}
              </Animated.View>

              <Pressable style={styles.simpanBtn} onPress={handleSave}>
                <Text style={styles.simpanBtnText}>Simpan</Text>
              </Pressable>

              <View style={[styles.actionRow, { marginTop: 15 * S }]}>
                <View style={styles.actionLeft}>
                  <Pressable style={styles.relativeIconBtn} onPress={() => handleClearContent('fire')}><Image source={require('../../assets/icon/api.png')} style={{ width: '80%', height: '80%' }} resizeMode="contain" /></Pressable>
                  <Pressable style={styles.relativeIconBtn} onPress={() => handleClearContent('trash')}><Image source={require('../../assets/icon/tongsampah.png')} style={{ width: '80%', height: '80%' }} resizeMode="contain" /></Pressable>
                </View>
                <View style={styles.actionRight}>
                  <Text style={styles.udahanTitleRelative}>Udahan dulu</Text>
                  <Pressable style={styles.homeBtnRelative} onPress={async () => { if (isEditing) await handleSave(); setNavLoading(true); await new Promise((r) => setTimeout(r, 900)); router.replace('/'); }}>
                    <Text style={styles.homeBtnText}>Home</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {navLoading && <Text style={styles.kelaText}>kela{dots}</Text>}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────
const BG   = '#EAE3D2';
const CARD = '#D9D9D9';
const FONT = 'PlusJakartaSans_400Regular';
const LINE_H = 32 * S;
const LINE_COLOR = '#C8C0B0';

const styles = StyleSheet.create({
  bg:           { flex: 1, backgroundColor: BG },
  scrollContent:{ flexGrow: 1, minHeight: 1200 * S },
  canvas:       { backgroundColor: 'transparent', position: 'relative' },

  greeting:     { position: 'absolute', fontFamily: FONT, fontSize: 19 * S, color: '#000' },
  kimoriText:   { position: 'absolute', fontFamily: 'PlusJakartaSans_200ExtraLight', fontSize: 20 * S, color: '#000' },
  indicatorBox: { position: 'absolute', backgroundColor: CARD, borderRadius: 5 * S, justifyContent: 'center', paddingHorizontal: 8 * S },
  indicatorText:{ fontFamily: FONT, fontSize: 14 * S, color: '#000' },
  timeGreeting: { position: 'absolute', fontFamily: FONT, fontSize: 12 * S, color: '#000', lineHeight: 18 * S },

  searchBox:    { position: 'absolute', backgroundColor: CARD, borderRadius: 6 * S, justifyContent: 'center', paddingHorizontal: 8 * S },
  searchInput:  { fontFamily: FONT, fontSize: 14 * S, color: '#000', padding: 0 },

  noteItemWrapper: { marginBottom: 4 * S, overflow: 'hidden' },
  noteItemSelected:{ backgroundColor: 'rgba(200,192,176,0.4)', borderRadius: 8 * S, padding: 4 * S },
  noteTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 * S },
  noteTitle:    { fontFamily: FONT, fontSize: 19 * S, color: '#000', flex: 1 },
  noteDate:     { fontFamily: 'PlusJakartaSans_300Light', fontSize: 13 * S, color: '#000', marginLeft: 8 * S },
  noteContentBox:   { backgroundColor: CARD, borderRadius: 6 * S, paddingHorizontal: 10 * S, paddingVertical: 6 * S, justifyContent: 'space-evenly' },
  noteContentLine:  { borderBottomWidth: 1, borderBottomColor: LINE_COLOR, paddingBottom: 4 * S, marginBottom: 6 * S },
  noteContentText:  { fontFamily: FONT, fontSize: 12 * S, color: '#555' },
  editHintBtn:  { marginTop: 6 * S, alignSelf: 'flex-end' },
  editHintText: { fontFamily: FONT, fontSize: 11 * S, color: '#888' },

  titleInputWrapper:{ marginHorizontal: 16 * S, marginBottom: 16 * S },
  titleInput:   {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 22 * S, color: '#000',
    borderBottomWidth: 1.5, borderBottomColor: LINE_COLOR,
    paddingBottom: 6 * S, paddingHorizontal: 4 * S,
  },

  notebookWrapper: {
    marginHorizontal: 16 * S,
    position: 'relative',
    overflow: 'hidden',
  },
  notebookLine: { height: LINE_H, borderBottomWidth: 1, borderBottomColor: LINE_COLOR },
  notebookInput: {
    fontFamily: FONT, fontSize: 16 * S, color: '#000', lineHeight: LINE_H,
    backgroundColor: 'transparent', padding: 0, paddingHorizontal: 4 * S, paddingTop: 0,
  },
  simpanBtn: {
    marginHorizontal: 16 * S, marginTop: 12 * S, backgroundColor: '#5F7D95',
    borderRadius: 8 * S, paddingVertical: 14 * S, alignItems: 'center', zIndex: 10,
  },
  simpanBtnText:{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16 * S, color: '#fff' },

  actionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 16 * S,
  },
  actionLeft: { flexDirection: 'row', alignItems: 'center' },
  relativeIconBtn: {
    width: 46 * S, height: 45 * S, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 25 * S, marginRight: 15 * S,
  },
  actionRight: { alignItems: 'center' },
  udahanTitleRelative: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 18 * S, color: '#000', marginBottom: 6 * S },
  homeBtnRelative: {
    backgroundColor: CARD, borderRadius: 5 * S, paddingHorizontal: 20 * S, paddingVertical: 6 * S,
    justifyContent: 'center', alignItems: 'center',
  },
  homeBtnText:  { fontFamily: 'PlusJakartaSans_300Light', fontSize: 16 * S, color: '#000' },

  kelaText: { position: 'absolute', fontFamily: 'Jaro_400Regular', fontSize: 24 * S, color: '#1E90FF', alignSelf: 'center', top: '50%', zIndex: 100 },
});