import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA1qHBDcZ1HzY6aYOaU7WwtRI28zA12q4Q",
  authDomain: "ventorio-dd52d.firebaseapp.com",
  projectId: "ventorio-dd52d",
  storageBucket: "ventorio-dd52d.firebasestorage.app",
  messagingSenderId: "437232132808",
  appId: "1:437232132808:web:a25e3eb0bd1d13b23bbbfd",
  measurementId: "G-TNMMSJYMC8"
};

const app = initializeApp(firebaseConfig);

export default app;
export const auth = getAuth(app);
export const storage = getStorage(app);
export const firestore = getFirestore()