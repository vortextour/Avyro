import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBPmaG_iH0kTIZNLKrkmID2klkmLSXeufw",
  authDomain: "referral-8ae6d.firebaseapp.com",
  projectId: "referral-8ae6d",
  storageBucket: "referral-8ae6d.firebasestorage.app",
  messagingSenderId: "266832580018",
  appId: "1:266832580018:web:4b58674cb2635711fde8ab"
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