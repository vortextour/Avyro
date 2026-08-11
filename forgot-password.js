import { isValidEmail, showToast } from './validation.js';
import { resetPassword } from './auth.js';

// DOM Elements
const form = document.getElementById('resetForm');
const emailInput = document.getElementById('email');
const emailError = document.getElementById('emailError');
const resetBtn = document.getElementById('resetBtn');
const btnText = document.getElementById('btnText');
const btnSpinner = document.getElementById('btnSpinner');
const modal = document.getElementById('successModal');

// Inline Error Elements
const formLevelError = document.getElementById('formLevelError');
const formErrorMsg = document.getElementById('formErrorMsg');

// Clear error real-time on input
emailInput.addEventListener('input', () => {
  emailError.classList.add('hidden');
  emailInput.classList.remove('border-danger', 'focus:ring-danger/15');
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
  
  const email = emailInput.value.trim();
  
  // Reset Form Level Error
  formLevelError.classList.add('hidden');
  
  // Validation
  if (!email || !isValidEmail(email)) {
    emailError.classList.remove('hidden');
    emailInput.classList.add('border-danger', 'focus:ring-danger/15');
    applyShakeAnimation(document.getElementById('emailFieldContainer'));
    return;
  }
  
  // Processing State
  setLoading(true);
  
  // Call Firebase Auth to send reset email
  const { success, error } = await resetPassword(email);
  
  setLoading(false);
  
  if (error) {
    // Show Firebase / Auth error inside inline alert card instead of Toast
    formErrorMsg.textContent = error;
    formLevelError.classList.remove('hidden');
    formLevelError.classList.add('flex');
    applyShakeAnimation(form); // Shakes entire form container on failure
  } else {
    // Show Success Modal on successful request
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    form.reset();
  }
});

// Loading UI Controller
const setLoading = (isLoading) => {
  resetBtn.disabled = isLoading;
  if (isLoading) {
    btnText.textContent = 'Sending...';
    btnSpinner.classList.remove('hidden');
    resetBtn.classList.add('opacity-80', 'cursor-not-allowed');
  } else {
    btnText.textContent = 'Send Reset Link';
    btnSpinner.classList.add('hidden');
    resetBtn.classList.remove('opacity-80', 'cursor-not-allowed');
  }
};