import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyA1qHBDcZ1HzY6aYOaU7WwtRI28zA12q4Q",
  authDomain: "ventorio-dd52d.firebaseapp.com",
  projectId: "ventorio-dd52d",
  storageBucket: "ventorio-dd52d.firebasestorage.app",
  messagingSenderId: "437232132808",
  appId: "1:437232132808:web:a25e3eb0bd1d13b23bbbfd",
  measurementId: "G-TNMMSJYMC8"
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);