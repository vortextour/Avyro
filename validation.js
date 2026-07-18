import { db } from './firebase.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// REGEX VALIDATIONS (Used in Login & Register)
// ==========================================
export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const isValidPassword = (password) => password.trim().length >= 8;
export const isValidPhone = (phone) => /^\+?[0-9\s\-]{7,15}$/.test(phone);
export const isValidUsername = (username) => /^[a-zA-Z0-9_]{4,20}$/.test(username);

// ==========================================
// FIRESTORE DATABASE CHECKS (Used in Register)
// ==========================================
// Check if a field (email/username/phone) already exists
export const checkUniqueField = async (field, value) => {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where(field, "==", value));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty; // Returns true if unique (not found)
  } catch (error) {
    console.error("DB Check Error:", error);
    return false;
  }
};

// Verify if the provided Referral Code exists in the database
export const verifyReferralCode = async (code) => {
  if (!code) return true; // Optional field
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("referralCode", "==", code.toUpperCase()));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty; // Returns true if code exists
  } catch (error) {
    return false;
  }
};

// ==========================================
// GLOBAL UI COMPONENTS
// ==========================================
// Show Premium Toast Notification (Top Center positioned)
export const showToast = (message, type = 'success') => {
  const container = document.getElementById('toastContainer');
  if (!container) return; // Guard if container is missing
  
  const toast = document.createElement('div');
  
  const colors = {
    success: 'bg-success text-white',
    error: 'bg-danger text-white',
    warning: 'bg-warning text-white'
  };
  
  const icons = {
    success: 'ph-check-circle',
    error: 'ph-warning-octagon',
    warning: 'ph-warning'
  };
  
  // Set class for top-center animation and full width limit
  toast.className = `flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] transform transition-all duration-500 -translate-y-20 opacity-0 w-full ${colors[type]}`;
  toast.innerHTML = `<i class="ph ${icons[type]} text-xl"></i><span class="font-bold text-sm text-center">${message}</span>`;
  
  container.appendChild(toast);
  
  // Animate In (Slides down from top)
  setTimeout(() => toast.classList.remove('-translate-y-20', 'opacity-0'), 10);
  
  // Remove after 4 seconds (Slides back up)
  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-10');
    setTimeout(() => toast.remove(), 500);
  }, 4000);
};

// ==========================================
// DEPOSIT VALIDATIONS
// ==========================================
export const isValidTransactionId = (trxId) => {
  // Transaction ID must be at least 4 characters long and alphanumeric
  const trxRegex = /^[a-zA-Z0-9]{4,30}$/;
  return trxRegex.test(trxId.trim());
};

// ==========================================
// UTILITIES (Used for Referral Center)
// ==========================================
export const copyToClipboard = async (text, successMessage = "Copied to clipboard!") => {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage, 'success');
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast(successMessage, 'success');
    } catch (ex) {
      showToast('Failed to copy. Please copy manually.', 'error');
    }
    document.body.removeChild(textArea);
  }
};