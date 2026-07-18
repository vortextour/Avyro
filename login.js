import { auth, db } from './firebase.js';
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { isValidEmail, isValidUsername, showToast } from './validation.js';
import { loginUser } from './auth.js';

// DOM Elements
const form = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const togglePasswordBtn = document.getElementById('togglePassword');
const loginBtn = document.getElementById('loginBtn');
const btnText = document.getElementById('btnText');
const btnSpinner = document.getElementById('btnSpinner');
const rememberMe = document.getElementById('rememberMe');

// Inline Error Elements
const formLevelError = document.getElementById('formLevelError');
const formErrorMsg = document.getElementById('formErrorMsg');

let currentUser = null;
let isLoggingIn = false; // লগইন চলাকালীন যেন অটো-রিডাইরেক্ট না হয় তার জন্য ফ্ল্যাগ

// ==========================================
// AUTO LOGIN & SMART ROLE ROUTING
// ==========================================
onAuthStateChanged(auth, async (user) => {
  // যদি ইউজার নিজে ফর্ম পূরণ করে লগইন না করে থাকে, শুধু তখনই অটো লগইন কাজ করবে
  if (user && !isLoggingIn) {
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const role = userDoc.data().role;
        
        if (role === 'Admin') {
          window.location.replace('admin-dashboard.html');
        } else {
          window.location.replace('home.html');
        }
      }
    } catch (err) {
      console.error("Routing error:", err);
    }
  }
});

// Show/Hide Password
togglePasswordBtn.addEventListener('click', () => {
  const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
  passwordInput.setAttribute('type', type);
  
  const icon = togglePasswordBtn.querySelector('i');
  if (type === 'text') {
    icon.classList.remove('ph-eye');
    icon.classList.add('ph-eye-slash');
  } else {
    icon.classList.remove('ph-eye-slash');
    icon.classList.add('ph-eye');
  }
});

// Real-time error clearing on input
emailInput.addEventListener('input', () => {
  emailError.classList.add('hidden');
  emailInput.classList.remove('border-danger', 'focus:ring-danger/15');
  formLevelError.classList.add('hidden');
});

passwordInput.addEventListener('input', () => {
  passwordError.classList.add('hidden');
  passwordInput.classList.remove('border-danger', 'focus:ring-danger/15');
  formLevelError.classList.add('hidden');
});

// Shake animation helper
const applyShakeAnimation = (elementContainer) => {
  elementContainer.classList.add('animate-shake');
  setTimeout(() => {
    elementContainer.classList.remove('animate-shake');
  }, 400);
};

// Form Submit Handling
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const emailOrUser = emailInput.value.trim();
  const password = passwordInput.value.trim();
  let hasError = false;
  
  // Reset Form Level Error
  formLevelError.classList.add('hidden');
  
  // Validation (Check if it is a valid email OR a valid username)
  if (!emailOrUser || (!isValidEmail(emailOrUser) && !isValidUsername(emailOrUser.toLowerCase()))) {
    emailError.classList.remove('hidden');
    emailInput.classList.add('border-danger', 'focus:ring-danger/15');
    applyShakeAnimation(document.getElementById('emailFieldContainer'));
    hasError = true;
  }
  
  if (!password) {
    passwordError.classList.remove('hidden');
    passwordInput.classList.add('border-danger', 'focus:ring-danger/15');
    applyShakeAnimation(document.getElementById('passwordFieldContainer'));
    hasError = true;
  }
  
  if (hasError) return;
  
  // Loading State
  setLoading(true);
  isLoggingIn = true; // ফ্ল্যাগ অন করা হলো
  
  let loginEmail = emailOrUser;
  
  // USERNAME RESOLVER: If input doesn't look like an email, assume it's a username and fetch the associated email
  if (!emailOrUser.includes('@')) {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", emailOrUser.toLowerCase()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        formErrorMsg.textContent = 'No account found with this username.';
        formLevelError.classList.remove('hidden');
        applyShakeAnimation(form);
        setLoading(false);
        isLoggingIn = false;
        return;
      }
      
      // Replace the username with the actual email from Firestore to login
      loginEmail = snap.docs[0].data().email;
    } catch (err) {
      formErrorMsg.textContent = 'System error while checking username.';
      formLevelError.classList.remove('hidden');
      applyShakeAnimation(form);
      setLoading(false);
      isLoggingIn = false;
      return;
    }
  }
  
  // Attempt Login (Now using the resolved email)
  const { user, error } = await loginUser(loginEmail, password, rememberMe.checked);
  
  if (error) {
    formErrorMsg.textContent = error;
    formLevelError.classList.remove('hidden');
    applyShakeAnimation(form);
    setLoading(false);
    isLoggingIn = false;
    return;
  }
  
  // Check Role logic if an Admin logs in through the User form
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists() && userDoc.data().role === 'Admin') {
      showToast('Admin account detected. Redirecting to Admin Portal...', 'success');
      setTimeout(() => { window.location.replace('admin-dashboard.html'); }, 1500);
      return;
    }
  } catch (e) {}
  
  currentUser = user;
  
  // Success Redirect directly without email verification check
  showToast('Login successful! Redirecting...', 'success');
  setTimeout(() => {
    window.location.replace('home.html');
  }, 1500); // 1.5 সেকেন্ড সময় দেওয়া হলো যাতে টোস্ট মেসেজটি সুন্দরভাবে দেখা যায়
});

// Loading State Controller
const setLoading = (isLoading) => {
  loginBtn.disabled = isLoading;
  if (isLoading) {
    btnText.textContent = 'Authenticating...';
    btnSpinner.classList.remove('hidden');
    loginBtn.classList.add('opacity-80', 'cursor-not-allowed');
  } else {
    btnText.textContent = 'Log In';
    btnSpinner.classList.add('hidden');
    loginBtn.classList.remove('opacity-80', 'cursor-not-allowed');
  }
};