import { db, auth } from './firebase.js';
import { doc, serverTimestamp, collection, query, where, getDocs, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { isValidEmail, isValidPassword, isValidPhone, isValidUsername } from './validation.js';
import { createAuthUser } from './auth.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// DOM Elements
const form = document.getElementById('registerForm');
const fields = {
  fullName: document.getElementById('fullName'),
  username: document.getElementById('username'),
  email: document.getElementById('email'),
  phone: document.getElementById('phone'),
  password: document.getElementById('password'),
  confirmPassword: document.getElementById('confirmPassword'),
  referralCode: document.getElementById('referralCode')
};
const registerBtn = document.getElementById('registerBtn');
const btnText = document.getElementById('btnText');
const btnSpinner = document.getElementById('btnSpinner');
const modal = document.getElementById('successModal');

const formLevelError = document.getElementById('formLevelError');
const formErrorMsg = document.getElementById('formErrorMsg');

const strengthContainer = document.getElementById('passwordStrengthContainer');
const strengthText = document.getElementById('strengthText');
const bar1 = document.getElementById('bar1');
const bar2 = document.getElementById('bar2');
const bar3 = document.getElementById('bar3');

const referralSuggestion = document.getElementById('referralSuggestion');
const applyDefaultCodeBtn = document.getElementById('applyDefaultCode');

// ==========================================
// MASTER CODE SETTINGS 
// ==========================================
const MASTER_CODE = "EARNPRO"; 

const localCheckUniqueField = async (field, value) => {
    try {
        const q = query(collection(db, "users"), where(field, "==", value));
        const snap = await getDocs(q);
        return snap.empty;
    } catch (error) { return true; }
};

const localVerifyReferralCode = async (code) => {
    if (!code) return false; 
    const upperCode = code.toUpperCase();
    if (upperCode === MASTER_CODE) return true; 
    
    try {
        const q = query(collection(db, "users"), where("referralCode", "==", upperCode));
        const snap = await getDocs(q);
        return !snap.empty;
    } catch (error) { return false; }
};

// Show / Hide Password
document.querySelectorAll('.togglePassword').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const input = e.currentTarget.previousElementSibling;
    const icon = e.currentTarget.querySelector('i');
    const type = input.type === 'password' ? 'text' : 'password';
    input.type = type; icon.className = type === 'text' ? 'ph ph-eye-slash text-lg' : 'ph ph-eye text-lg';
  });
});

// OPTIMIZED DEBOUNCING (Delay set to 800ms to reduce unneeded reads while typing fast)
let timeoutId;
const debounceCheck = (callback, delay = 800) => {
  clearTimeout(timeoutId);
  timeoutId = setTimeout(callback, delay);
};

const setStatus = (inputId, status, msg = "") => {
  const errorEl = document.getElementById(`${inputId}Error`);
  const statusIcon = document.getElementById(`${inputId}Status`);
  const inputEl = fields[inputId];
  
  if (status === 'error') {
    if (errorEl) { errorEl.innerHTML = `<i class="ph ph-warning-circle"></i> ${msg}`; errorEl.classList.remove('hidden'); }
    if (inputEl) { inputEl.classList.add('border-danger', 'focus:ring-danger/15'); inputEl.classList.remove('border-[#1E293B]', 'focus:ring-[#6366F1]'); }
    if (statusIcon) { statusIcon.className = "ph ph-x-circle absolute right-4 top-1/2 -translate-y-1/2 text-lg text-danger block"; }
    if (inputId === 'referralCode') { referralSuggestion.classList.remove('hidden'); referralSuggestion.classList.add('flex'); }
  } else if (status === 'success') {
    if (errorEl) errorEl.classList.add('hidden');
    if (inputEl) { inputEl.classList.add('border-success', 'focus:ring-success/15'); inputEl.classList.remove('border-danger', 'focus:ring-danger/15', 'border-[#1E293B]'); }
    if (statusIcon) { statusIcon.className = "ph ph-check-circle absolute right-4 top-1/2 -translate-y-1/2 text-lg text-success block"; }
    if (inputId === 'referralCode') { referralSuggestion.classList.add('hidden'); referralSuggestion.classList.remove('flex'); }
  } else if (status === 'clear') {
    if (errorEl) errorEl.classList.add('hidden');
    if (inputEl) { inputEl.classList.remove('border-danger', 'focus:ring-danger/15', 'border-success', 'focus:ring-success/15'); inputEl.classList.add('border-[#1E293B]', 'focus:ring-[#6366F1]'); }
    if (statusIcon) statusIcon.classList.add('hidden');
    if (inputId === 'referralCode') { referralSuggestion.classList.add('hidden'); referralSuggestion.classList.remove('flex'); }
  }
};

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('ref')) {
  const refVal = urlParams.get('ref').toUpperCase();
  fields.referralCode.value = refVal; fields.referralCode.setAttribute('readonly', 'true');
  fields.referralCode.classList.add('cursor-not-allowed', 'opacity-80', 'bg-gray-800/50');
  
  debounceCheck(async () => {
    const exists = await localVerifyReferralCode(refVal);
    exists ? setStatus('referralCode', 'success') : setStatus('referralCode', 'error', 'Referral code not found.');
  }, 100);
}

applyDefaultCodeBtn.addEventListener('click', () => {
    fields.referralCode.value = "SM1";
    fields.referralCode.dispatchEvent(new Event('input'));
});

const applyShake = (containerId) => {
  const container = document.getElementById(containerId) || containerId;
  if (container) { container.classList.add('animate-shake'); setTimeout(() => { container.classList.remove('animate-shake'); }, 450); }
};

const checkPasswordStrength = (password) => {
  let strengthScore = 0;
  if (password.length >= 8) strengthScore += 1;
  if (password.match(/(?=.*[a-zA-Z])/)) strengthScore += 1;
  if (password.match(/(?=.*[0-9])/)) strengthScore += 1;
  if (password.match(/(?=.*[!@#$%^&*()_+={}\[\]:;"'<>,.?/\\])/)) strengthScore += 1;
  if (password.length >= 12) strengthScore += 1;
  
  const defaultClasses = "h-full w-1/3 rounded-full bg-gray-800 transition-colors duration-300";
  bar1.className = defaultClasses; bar2.className = defaultClasses; bar3.className = defaultClasses;
  
  if (password.length < 8) {
    strengthText.textContent = 'Too Short'; strengthText.className = 'text-[10px] font-bold text-danger uppercase tracking-wider'; bar1.classList.replace('bg-gray-800', 'bg-danger');
  } else if (strengthScore <= 2) {
    strengthText.textContent = 'Poor'; strengthText.className = 'text-[10px] font-bold text-danger uppercase tracking-wider'; bar1.classList.replace('bg-gray-800', 'bg-danger');
  } else if (strengthScore === 3 || strengthScore === 4) {
    strengthText.textContent = 'Fair'; strengthText.className = 'text-[10px] font-bold text-warning uppercase tracking-wider'; bar1.classList.replace('bg-gray-800', 'bg-warning'); bar2.classList.replace('bg-gray-800', 'bg-warning');
  } else {
    strengthText.textContent = 'Strong'; strengthText.className = 'text-[10px] font-bold text-success uppercase tracking-wider'; bar1.classList.replace('bg-gray-800', 'bg-success'); bar2.classList.replace('bg-gray-800', 'bg-success'); bar3.classList.replace('bg-gray-800', 'bg-success');
  }
};

Object.values(fields).forEach(inputEl => {
    if (!inputEl) return;
    inputEl.addEventListener('input', () => { setStatus(inputEl.id, 'clear'); formLevelError.classList.add('hidden'); });
});

fields.username.addEventListener('input', (e) => {
  const val = e.target.value.toLowerCase().trim(); e.target.value = val;
  if (!isValidUsername(val)) return setStatus('username', 'error', 'Min 4 alphanumeric characters.');
  
  setStatus('username', 'loading');
  debounceCheck(async () => {
    const isUnique = await localCheckUniqueField('username', val);
    isUnique ? setStatus('username', 'success') : setStatus('username', 'error', 'Username is already taken.');
  });
});

fields.email.addEventListener('input', (e) => {
  const val = e.target.value.trim();
  if (!isValidEmail(val)) return setStatus('email', 'error', 'Invalid email format.');
  
  debounceCheck(async () => {
    const isUnique = await localCheckUniqueField('email', val);
    isUnique ? setStatus('email', 'success') : setStatus('email', 'error', 'Email is already registered.');
  });
});

fields.phone.addEventListener('input', (e) => {
  const val = e.target.value.trim();
  if (!isValidPhone(val)) return setStatus('phone', 'error', 'Invalid phone format (+123...).');
  
  debounceCheck(async () => {
    const isUnique = await localCheckUniqueField('phoneNumber', val);
    isUnique ? setStatus('phone', 'success') : setStatus('phone', 'error', 'Phone number is already in use.');
  });
});

fields.password.addEventListener('input', (e) => {
  const val = e.target.value;
  if (val.length > 0) { strengthContainer.classList.remove('hidden'); checkPasswordStrength(val); } else { strengthContainer.classList.add('hidden'); }
  if (fields.confirmPassword.value) {
    if (val !== fields.confirmPassword.value) setStatus('confirmPassword', 'error', 'Passwords do not match.');
    else setStatus('confirmPassword', 'success');
  }
});

fields.confirmPassword.addEventListener('input', (e) => {
  if (e.target.value !== fields.password.value) setStatus('confirmPassword', 'error', 'Passwords do not match.');
  else setStatus('confirmPassword', 'success');
});

fields.referralCode.addEventListener('input', (e) => {
  const val = e.target.value.toUpperCase().trim(); e.target.value = val;
  if (!val) { setStatus('referralCode', 'error', 'Referral Code is required.'); return; }
  
  debounceCheck(async () => {
    const exists = await localVerifyReferralCode(val);
    exists ? setStatus('referralCode', 'success') : setStatus('referralCode', 'error', 'Invalid Referral Code.');
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = fields.fullName.value.trim();
  const user = fields.username.value.trim();
  const mail = fields.email.value.trim();
  const phone = fields.phone.value.trim();
  const pass = fields.password.value;
  const confirm = fields.confirmPassword.value;
  const ref = fields.referralCode.value.trim().toUpperCase(); 
  
  let hasValidationError = false;
  formLevelError.classList.add('hidden');

  if (!name) { setStatus('fullName', 'error', 'Full Name is required.'); applyShake('fullNameFieldContainer'); hasValidationError = true; }
  if (!isValidUsername(user)) { setStatus('username', 'error', 'Valid Username is required.'); applyShake('usernameFieldContainer'); hasValidationError = true; }
  if (!isValidEmail(mail)) { setStatus('email', 'error', 'Valid Email is required.'); applyShake('emailFieldContainer'); hasValidationError = true; }
  if (!isValidPhone(phone)) { setStatus('phone', 'error', 'Valid Phone number is required.'); applyShake('phoneFieldContainer'); hasValidationError = true; }
  if (!isValidPassword(pass)) { setStatus('password', 'error', 'Password must be at least 8 characters.'); applyShake('passwordFieldContainer'); hasValidationError = true; }
  if (pass !== confirm) { setStatus('confirmPassword', 'error', 'Passwords do not match.'); applyShake('confirmPasswordFieldContainer'); hasValidationError = true; }
  if (!ref) { setStatus('referralCode', 'error', 'Referral Code is strictly required.'); applyShake('referralCodeFieldContainer'); hasValidationError = true; }

  if (hasValidationError) {
    formErrorMsg.textContent = "Please correct the highlighted errors below.";
    formLevelError.classList.remove('hidden'); formLevelError.classList.add('flex'); applyShake(form); return;
  }
  
  setLoading(true);
  
  try {
    // Final DB Checks
    const uniqueChecks = await Promise.all([
      localCheckUniqueField('username', user),
      localCheckUniqueField('email', mail),
      localCheckUniqueField('phoneNumber', phone),
      localVerifyReferralCode(ref) 
    ]);
    
    if (!uniqueChecks[0]) { setStatus('username', 'error', 'Username is already taken.'); applyShake('usernameFieldContainer'); throw new Error('Username is already taken.'); }
    if (!uniqueChecks[1]) { setStatus('email', 'error', 'Email is already in use.'); applyShake('emailFieldContainer'); throw new Error('Email is already in use.'); }
    if (!uniqueChecks[2]) { setStatus('phone', 'error', 'Phone number is already in use.'); applyShake('phoneFieldContainer'); throw new Error('Phone number is already in use.'); }
    if (!uniqueChecks[3]) { setStatus('referralCode', 'error', 'Invalid or Non-existent Referral Code.'); applyShake('referralCodeFieldContainer'); throw new Error('Invalid or Non-existent Referral Code.'); }
    
    const { user: authUser, error: authErr } = await createAuthUser(mail, pass);
    if (authErr) throw new Error(authErr);
    
    const counterRef = doc(db, "counters", "global");
    const userRef = doc(db, "users", authUser.uid);

    // Sequential ID generation inside transaction to prevent duplicates 
    // This is the safest way to guarantee unique "SM1", "SM2" strings on the web client
    await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let nextSeq = 1;
        
        if (counterDoc.exists() && counterDoc.data().userSequence) {
            nextSeq = counterDoc.data().userSequence + 1;
        }

        const generatedRefCode = "SM" + nextSeq;
        transaction.set(counterRef, { userSequence: nextSeq }, { merge: true });

        transaction.set(userRef, {
            uid: authUser.uid,
            fullName: name,
            username: user,
            email: mail,
            phoneNumber: phone,
            referralCode: generatedRefCode,
            uplineReferralCode: ref, 
            status: "Inactive",
            walletBalance: 0,
            totalReferralBonus: 0,
            successfulReferrals: 0,
            profilePhoto: "https://ui-avatars.com/api/?name=" + encodeURIComponent(name) + "&background=6366F1&color=fff",
            createdAt: serverTimestamp(),
            lastLogin: null,
            role: "User"
        });
    });
    
    await signOut(auth);
    setLoading(false);
    modal.classList.remove('hidden'); modal.classList.add('flex');
    
  } catch (error) {
    setLoading(false);
    formErrorMsg.textContent = error.message;
    formLevelError.classList.remove('hidden'); formLevelError.classList.add('flex'); applyShake(form);
  }
});

const setLoading = (isLoading) => {
  registerBtn.disabled = isLoading;
  if (isLoading) {
    btnText.textContent = 'Creating Account...'; btnSpinner.classList.remove('hidden'); registerBtn.classList.add('opacity-80', 'cursor-not-allowed');
  } else {
    btnText.textContent = 'Create Account'; btnSpinner.classList.add('hidden'); registerBtn.classList.remove('opacity-80', 'cursor-not-allowed');
  }
};