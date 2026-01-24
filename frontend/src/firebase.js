import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For this to work, you need to create a project in Firebase Console
// and add a web app to get these details.
const firebaseConfig = {
  apiKey: "AIzaSyC1ZTyTyMtm-WetW67WMxIu5Djjj3kqnDY",
  authDomain: "gen-web-484805.firebaseapp.com",
  projectId: "gen-web-484805",
  storageBucket: "gen-web-484805.firebasestorage.app",
  messagingSenderId: "719340208040",
  appId: "1:719340208040:web:518b533e567c41aec3679d",
  measurementId: "G-28P7PC36RH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
