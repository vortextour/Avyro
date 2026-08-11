import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDueSd6RK1By2GgC8VUjhHwEpbm_W8WF2w",
  authDomain: "avyro-c693d.firebaseapp.com",
  projectId: "avyro-c693d",
  storageBucket: "avyro-c693d.firebasestorage.app",
  messagingSenderId: "690658560324",
  appId: "1:690658560324:web:8c870ebb419f13783d6f11"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
const auth = getAuth(app);

// Initialize Firestore with Offline Persistence & Cache Enabled
// এই অংশটিই আপনার রিড/রাইট কস্ট একদম জিরোতে নিয়ে আসবে!
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export { app, auth, db };