// src/firebase/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { getDatabase } from "firebase/database";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredConfig = [
  "apiKey",
  "authDomain",
  "databaseURL",
  "projectId",
  "messagingSenderId",
  "appId",
];
const missingConfig = requiredConfig.filter((key) => !firebaseConfig[key]);

if (missingConfig.length > 0) {
  throw new Error(
    `Missing Firebase configuration: ${missingConfig.join(", ")}. ` +
      "Set the VITE_FIREBASE_* values in .env or the deployment environment.",
  );
}

export const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const rtdb = getDatabase(app);

// Single unified export to avoid duplicates:
export { 
  auth, 
  googleProvider, 
  rtdb, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  signOut 
};
