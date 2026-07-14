import * as SQLite from 'expo-sqlite';

// Buka koneksi database
const db = SQLite.openDatabaseSync('kimori_final.db');

// Fungsi inisialisasi tabel (DIPERBAIKI)
export const initDB = () => {
  try {
    // Kita pecah jadi runSync satu-satu biar SQLite gak rewel
    db.runSync(`CREATE TABLE IF NOT EXISTS assessments (id INTEGER PRIMARY KEY AUTOINCREMENT, score INTEGER, result_category TEXT, created_at TEXT)`);
    db.runSync(`CREATE TABLE IF NOT EXISTS weather_favorites (id INTEGER PRIMARY KEY AUTOINCREMENT, city_name TEXT)`);
    db.runSync(`CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, created_at TEXT)`);
  } catch (error) {
    console.log("Aman, tabel sudah ada.");
  }
};

// ── FUNGSI TES MENTAL ──
export const addAssessment = (score, result_category, created_at) => {
  db.runSync('INSERT INTO assessments (score, result_category, created_at) VALUES (?, ?, ?)', [score, result_category, created_at]);
};
export const getAllAssessments = () => {
  return db.getAllSync('SELECT * FROM assessments ORDER BY id DESC');
};
export const deleteAssessment = (id) => {
  db.runSync('DELETE FROM assessments WHERE id = ?', [id]);
};

// ── FUNGSI CUACA ──
export const addWeatherCity = (city_name) => {
  db.runSync('INSERT INTO weather_favorites (city_name) VALUES (?)', [city_name]);
};
export const getAllWeatherCities = () => {
  return db.getAllSync('SELECT * FROM weather_favorites ORDER BY id DESC');
};
export const deleteWeatherCity = (id) => {
  db.runSync('DELETE FROM weather_favorites WHERE id = ?', [id]);
};
export const updateWeatherCity = (id, newName) => {
  db.runSync('UPDATE weather_favorites SET city_name = ? WHERE id = ?', [newName, id]);
};

// ── FUNGSI NOTEPAD ──
export const addNote = (title, content, created_at) => {
  db.runSync('INSERT INTO notes (title, content, created_at) VALUES (?, ?, ?)', [title, content, created_at]);
};
export const getAllNotes = () => {
  return db.getAllSync('SELECT * FROM notes ORDER BY id DESC');
};
export const deleteNote = (id) => {
  db.runSync('DELETE FROM notes WHERE id = ?', [id]);
};
export const updateNote = (id, title, content) => {
  db.runSync('UPDATE notes SET title = ?, content = ? WHERE id = ?', [title, content, id]);
};