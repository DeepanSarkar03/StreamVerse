// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB-0SHkf1K4sXfBQvFwQIR7_zR8roks3Ac",
  authDomain: "studio-4918145946-c0025.firebaseapp.com",
  projectId: "studio-4918145946-c0025",
  storageBucket: "studio-4918145946-c0025.firebasestorage.app",
  messagingSenderId: "202374459914",
  appId: "1:202374459914:web:1bef99e640835eb83c25f3",
  measurementId: "G-4GH1R4Z1Z4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics (only in browser environment)
let analytics;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { app, analytics };
