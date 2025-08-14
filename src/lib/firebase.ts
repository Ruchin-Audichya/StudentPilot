// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
<<<<<<< HEAD
  apiKey: "AIzaSyB5hUYhKZM4qBCRi5Q9lTgrb_RQF21QEiQ",
  authDomain: "copilot-cfb61.firebaseapp.com",
  projectId: "copilot-cfb61",
  storageBucket: "copilot-cfb61.firebasestorage.app",
  messagingSenderId: "734822895413",
  appId: "1:734822895413:web:5da872d97710aa83c3067c"
=======
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
>>>>>>> 46569f9994336f70253926cfabea35d32c6aff47
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth for use in AuthPage
export const auth = getAuth(app);

<<<<<<< HEAD
export default app;
=======
export default app;
>>>>>>> 46569f9994336f70253926cfabea35d32c6aff47
