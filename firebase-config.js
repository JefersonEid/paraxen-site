import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-analytics.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBPu-87T6jjKMKHdJJ_Av-r_Bsai8g75K8",
  authDomain: "paraxen-8d0a4.firebaseapp.com",
  projectId: "paraxen-8d0a4",
  storageBucket: "paraxen-8d0a4.firebasestorage.app",
  messagingSenderId: "276585729333",
  appId: "1:276585729333:web:905c4c2230f53ed9fe107c",
  measurementId: "G-8KEMS61VWZ"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account"
});

isSupported().then((supported) => {
  if (supported) {
    getAnalytics(app);
  }
});
