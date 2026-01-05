import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For this to work, you need to create a project in Firebase Console
// and add a web app to get these details.
const firebaseConfig = {
  apiKey: "AIzaSyD1Si12JehULktT02Q1tAcR9NrRbdImlpA",
  authDomain: "sgp-1-a8b1a.firebaseapp.com",
  projectId: "sgp-1-a8b1a",
  storageBucket: "sgp-1-a8b1a.firebasestorage.app",
  messagingSenderId: "759966508100",
  appId: "1:759966508100:web:9f9480c622b182b2250811"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
