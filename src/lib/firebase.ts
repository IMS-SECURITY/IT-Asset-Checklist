import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCco783WaNbrg5hmwwaMsZ5YCK7rd3K5nI",
  authDomain: "it-checklist-675b6.firebaseapp.com",
  projectId: "it-checklist-675b6",
  storageBucket: "it-checklist-675b6.firebasestorage.app",
  messagingSenderId: "754957894018",
  appId: "1:754957894018:web:b3daa29414490ef9830f9b",
  measurementId: "G-6PXXK8H1J1",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
