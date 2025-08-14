// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB5hUYhKZM4qBCRi5Q9lTgrb_RQF21QEiQ",
  authDomain: "copilot-cfb61.firebaseapp.com",
  projectId: "copilot-cfb61",
  storageBucket: "copilot-cfb61.firebasestorage.app",
  messagingSenderId: "734822895413",
  appId: "1:734822895413:web:5da872d97710aa83c3067c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth for use in AuthPage
export const auth = getAuth(app);

export default app;