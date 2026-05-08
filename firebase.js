// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAyRd3wGUSVB4tf6d_aY3i9swRtNHmYC-g",
  authDomain: "fir-project-f2523.firebaseapp.com",
  projectId: "fir-project-f2523",
  storageBucket: "fir-project-f2523.firebasestorage.app",
  messagingSenderId: "1092422901050",
  appId: "1:1092422901050:web:06f80cd735e7fed8fac4n03",
};

// Initialize Firebase
const app = getApps().length === 0 
  ? initializeApp(firebaseConfig)
  : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;