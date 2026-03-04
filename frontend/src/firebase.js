import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC1ZTyTyMtm-WetW67WMxIu5Djjj3kqnDY",
  authDomain: "gen-web-484805.firebaseapp.com",
  projectId: "gen-web-484805",
  storageBucket: "gen-web-484805.firebasestorage.app",
  messagingSenderId: "719340208040",
  appId: "1:719340208040:web:518b533e567c41aec3679d",
  measurementId: "G-28P7PC36RH"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);