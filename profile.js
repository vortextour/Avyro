import { auth, db } from './firebase.js'; 
import { doc, onSnapshot, updateDoc, getDocFromCache, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { showToast, isValidPassword } from './validation.js';

let currentUser = null;
let userData = null;

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = 'index.html';
    else { currentUser = user; initProfile(); }
});

const els = {
    loader: document.getElementById('pageLoader'),
    content: document.getElementById('profileContent'),
    avatar: document.getElementById('headerAvatar'),
    avatarSkeleton: document.getElementById('headerAvatarSkeleton'),
    sidebar: document.getElementById('sidebar'),
    openSidebar: document.getElementById('openSidebarBtn'),
    closeSidebar: document.getElementById('closeSidebarBtn'),
    overlay: document.getElementById('mobileOverlay'),
    supportBtn: document.getElementById('supportBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    
    mainAvatar: document.getElementById('mainAvatar'),
    profFullName: document.getElementById('profFullName'),
    profStatusContainer: document.getElementById('profStatusContainer'),
    profStatusDot: document.getElementById('profStatusDot'),
    profStatusText: document.getElementById('profStatusText'),
    profUsername: document.getElementById('profUsername'),
    profJoinDate: document.getElementById('profJoinDate'),
    
    profUplineName: document.getElementById('profUplineName'),
    profUplineCode: document.getElementById('profUplineCode'),
    
    personalInfoForm: document.getElementById('personalInfoForm'),
    profFormError: document.getElementById('profFormError'),
    profFormErrorMsg: document.getElementById('profFormErrorMsg'),
    inpFullName: document.getElementById('inpFullName'),
    inpPhone: document.getElementById('inpPhone'),
    inpEmail: document.getElementById('inpEmail'),
    btnSaveProfile: document.getElementById('btnSaveProfile'),
    spinProfile: document.getElementById('spinProfile'),
    
    passwordForm: document.getElementById('passwordForm'),
    passFormError: document.getElementById('passFormError'),
    passFormErrorMsg: document.getElementById('passFormErrorMsg'),
    curPass: document.getElementById('curPass'),
    newPass: document.getElementById('newPass'),
    confPass: document.getElementById('confPass'),
    btnUpdatePass: document.getElementById('btnUpdatePass'),
    spinPass: document.getElementById('spinPass'),
    
    strContainer: document.getElementById('passStrengthContainer'),
    bar1: document.getElementById('bar1'), bar2: document.getElementById('bar2'), bar3: document.getElementById('bar3'),
    strText: document.getElementById('strengthText')
};

const initProfile = () => {
    loadSupportLink();
    loadUserDataRealtime();
};

// 0 READ COST: Sponsor Data Fetcher with Cache
const loadSponsorInfo = async (uplineCode) => {
    if (!uplineCode || uplineCode.toUpperCase() === 'EARNPRO' || uplineCode.toUpperCase() === 'NONE') {
        els.profUplineName.textContent = 'System Admin';
        els.profUplineCode.textContent = 'EARNPRO';
        return;
    }
    
    const cacheKey = `sponsorCache_${uplineCode}`;
    const cachedSponsor = localStorage.getItem(cacheKey);
    
    if (cachedSponsor) {
        const data = JSON.parse(cachedSponsor);
        els.profUplineName.textContent = data.name;
        els.profUplineCode.textContent = data.code;
    }

    try {
        const q = query(collection(db, "users"), where("referralCode", "==", uplineCode));
        const snap = await getDocs(q); // Only 1 read per session, if not cached. 0 Reads subsequent times.
        if (!snap.empty) {
            const upData = snap.docs[0].data();
            const sData = { name: upData.fullName || 'Unknown', code: upData.referralCode };
            
            localStorage.setItem(cacheKey, JSON.stringify(sData));
            els.profUplineName.textContent = sData.name;
            els.profUplineCode.textContent = sData.code;
        } else if (!cachedSponsor) {
            els.profUplineName.textContent = 'Unknown User';
            els.profUplineCode.textContent = uplineCode;
        }
    } catch (e) {}
};

// 0 WAIT TIME: Instant UI load from Session Cache
const loadUserDataRealtime = () => {
    const cachedUser = sessionStorage.getItem('userDataCache');
    if (cachedUser) {
        userData = JSON.parse(cachedUser);
        populateProfileData(userData);
    }

    // 1 READ COST PER CHANGE ONLY: Listen to current user
    onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
            userData = docSnap.data();
            const cacheData = { ...userData };
            if (cacheData.createdAt && cacheData.createdAt.toDate) {
                cacheData.createdAt = cacheData.createdAt.toDate().toISOString();
            }
            sessionStorage.setItem('userDataCache', JSON.stringify(cacheData));
            populateProfileData(cacheData);
        } else {
            showToast('User profile missing!', 'error');
        }
    }, (error) => {
        document.getElementById('networkError').classList.remove('hidden');
        els.loader.classList.add('hidden');
    });
};

const populateProfileData = (data) => {
    try {
        const uName = data.fullName || 'User';
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(uName)}&background=6366F1&color=fff&bold=true`;
        
        els.avatar.src = avatarUrl;
        els.avatar.classList.remove('hidden'); els.avatarSkeleton.classList.add('hidden');
        els.mainAvatar.src = avatarUrl;
        
        // Beautiful Status Badge Logic
        if (data.status === 'Active') {
            els.profStatusContainer.className = "mx-auto md:mx-0 flex items-center gap-2.5 px-5 py-2.5 rounded-2xl border border-success/30 bg-success/10 shadow-inner w-max transition-colors duration-300";
            els.profStatusDot.className = "w-3 h-3 rounded-full bg-success animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]";
            els.profStatusText.className = "text-xs font-black uppercase tracking-widest text-success";
            els.profStatusText.textContent = "Active";
        } else {
            els.profStatusContainer.className = "mx-auto md:mx-0 flex items-center gap-2.5 px-5 py-2.5 rounded-2xl border border-danger/30 bg-danger/10 shadow-inner w-max transition-colors duration-300";
            els.profStatusDot.className = "w-3 h-3 rounded-full bg-danger animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]";
            els.profStatusText.className = "text-xs font-black uppercase tracking-widest text-danger";
            els.profStatusText.textContent = "Inactive";
        }

        els.profFullName.textContent = data.fullName || 'User';
        const usernameStr = data.username || 'unknown';
        els.profUsername.textContent = usernameStr;
        
        let joinDateObj = data.createdAt ? new Date(data.createdAt) : null;
        els.profJoinDate.textContent = joinDateObj && !isNaN(joinDateObj) ? joinDateObj.toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'}) : 'N/A';
        
        // Fetch Sponsor Info efficiently
        loadSponsorInfo(data.uplineReferralCode);

        els.inpFullName.value = data.fullName || ''; 
        els.inpPhone.value = data.phoneNumber || ''; 
        els.inpEmail.value = data.email || '';

        els.loader.classList.add('hidden'); els.content.classList.remove('hidden'); els.content.classList.add('flex');
    } catch (e) { console.error("Error populating data: ", e); }
};

const applyShake = (containerId) => {
    const container = document.getElementById(containerId) || containerId;
    if (container) { container.classList.add('animate-shake'); setTimeout(() => container.classList.remove('animate-shake'), 450); }
};

const setInputError = (inputId, isError, msg = "") => {
    const input = document.getElementById(inputId); const errorText = document.getElementById(inputId + 'Error');
    if (isError) {
        input.classList.add('border-danger', 'focus:ring-danger/15'); input.classList.remove('border-[#1E293B]', 'focus:ring-[#6366F1]');
        if (errorText) { errorText.innerHTML = `<i class="ph ph-warning-circle"></i> ${msg}`; errorText.classList.remove('hidden'); }
    } else {
        input.classList.remove('border-danger', 'focus:ring-danger/15'); input.classList.add('border-[#1E293B]', 'focus:ring-[#6366F1]');
        if (errorText) errorText.classList.add('hidden');
    }
};

els.inpFullName.addEventListener('input', () => { setInputError('inpFullName', false); els.profFormError.classList.add('hidden'); });
els.curPass.addEventListener('input', () => { setInputError('curPass', false); els.passFormError.classList.add('hidden'); });
els.newPass.addEventListener('input', () => { setInputError('newPass', false); els.passFormError.classList.add('hidden'); });
els.confPass.addEventListener('input', () => { setInputError('confPass', false); els.passFormError.classList.add('hidden'); });

// Optimistic Write UI
els.personalInfoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = els.inpFullName.value.trim();
    let hasError = false; els.profFormError.classList.add('hidden');

    if (!name) { setInputError('inpFullName', true, 'Full Name is required.'); applyShake('fullNameContainer'); hasError = true; }
    if(hasError) return;

    els.btnSaveProfile.disabled = true; els.btnSaveProfile.classList.add('opacity-80', 'cursor-not-allowed'); els.spinProfile.classList.remove('hidden');
    
    try {
        await updateDoc(doc(db, "users", currentUser.uid), { fullName: name });
        
        // Optimistically update session cache immediately (0 Read to fetch new data)
        userData.fullName = name;
        sessionStorage.setItem('userDataCache', JSON.stringify(userData));
        els.profFullName.textContent = name;
        
        // Update avatar instantly
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366F1&color=fff&bold=true`;
        els.avatar.src = avatarUrl;
        els.mainAvatar.src = avatarUrl;

        showToast('Personal information updated successfully.', 'success');
    } catch (error) {
        els.profFormErrorMsg.textContent = typeof error === 'string' ? error : 'Failed to update info.';
        els.profFormError.classList.remove('hidden'); els.profFormError.classList.add('flex'); applyShake(els.personalInfoForm);
    } finally {
        els.btnSaveProfile.disabled = false; els.btnSaveProfile.classList.remove('opacity-80', 'cursor-not-allowed'); els.spinProfile.classList.add('hidden');
    }
});

document.querySelectorAll('.togglePassword').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const input = e.currentTarget.previousElementSibling; const icon = e.currentTarget.querySelector('i');
        const type = input.type === 'password' ? 'text' : 'password';
        input.type = type; icon.className = type === 'text' ? 'ph ph-eye-slash text-lg' : 'ph ph-eye text-lg';
    });
});

els.newPass.addEventListener('input', (e) => {
    const val = e.target.value;
    if(val.length > 0) { els.strContainer.classList.remove('hidden'); checkPasswordStrength(val); } 
    else { els.strContainer.classList.add('hidden'); }
    if (els.confPass.value) {
        if (val !== els.confPass.value) setInputError('confPass', true, 'Passwords do not match.');
        else setInputError('confPass', false);
    }
});

els.confPass.addEventListener('input', (e) => {
    if (e.target.value !== els.newPass.value) setInputError('confPass', true, 'Passwords do not match.');
    else setInputError('confPass', false);
});

const checkPasswordStrength = (password) => {
    let score = 0;
    if (password.length >= 8) score++; if (password.match(/(?=.*[a-zA-Z])/)) score++;
    if (password.match(/(?=.*[0-9])/)) score++; if (password.match(/(?=.*[!@#$%^&*])/)) score++;
    
    const def = "h-full w-1/3 rounded-full transition-colors duration-300 bg-gray-700";
    els.bar1.className = def; els.bar2.className = def; els.bar3.className = def;
    
    if (password.length < 8) {
        els.strText.textContent = 'Too Short'; els.strText.className = 'text-[9px] font-extrabold uppercase tracking-wider text-danger';
        els.bar1.classList.replace('bg-gray-700', 'bg-danger');
    } else if (score <= 2) {
        els.strText.textContent = 'Weak'; els.strText.className = 'text-[9px] font-extrabold uppercase tracking-wider text-danger';
        els.bar1.classList.replace('bg-gray-700', 'bg-danger');
    } else if (score === 3) {
        els.strText.textContent = 'Fair'; els.strText.className = 'text-[9px] font-extrabold uppercase tracking-wider text-warning';
        els.bar1.classList.replace('bg-gray-700', 'bg-warning'); els.bar2.classList.replace('bg-gray-700', 'bg-warning');
    } else {
        els.strText.textContent = 'Strong'; els.strText.className = 'text-[9px] font-extrabold uppercase tracking-wider text-success';
        els.bar1.classList.replace('bg-gray-700', 'bg-success'); els.bar2.classList.replace('bg-gray-700', 'bg-success'); els.bar3.classList.replace('bg-gray-700', 'bg-success');
    }
};

els.passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const curP = els.curPass.value; const newP = els.newPass.value; const confP = els.confPass.value;
    let hasError = false; els.passFormError.classList.add('hidden');

    if (!curP) { setInputError('curPass', true, 'Current password required.'); applyShake('curPassContainer'); hasError = true; }
    if (!isValidPassword(newP)) { setInputError('newPass', true, 'Min 8 characters required.'); applyShake('newPassContainer'); hasError = true; }
    if (newP !== confP) { setInputError('confPass', true, 'Passwords do not match.'); applyShake('confPassContainer'); hasError = true; }
    if (hasError) return;

    els.btnUpdatePass.disabled = true; els.btnUpdatePass.classList.add('opacity-80', 'cursor-not-allowed'); els.spinPass.classList.remove('hidden');

    try {
        const credential = EmailAuthProvider.credential(currentUser.email, curP);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newP);
        
        showToast('Account password changed securely!', 'success');
        els.passwordForm.reset(); els.strContainer.classList.add('hidden');
    } catch (error) {
        els.passFormErrorMsg.textContent = error.code === 'auth/invalid-credential' ? 'Your current password is incorrect.' : 'Failed to update security credentials.';
        els.passFormError.classList.remove('hidden'); els.passFormError.classList.add('flex'); applyShake(els.passwordForm);
    } finally {
        els.btnUpdatePass.disabled = false; els.btnUpdatePass.classList.remove('opacity-80', 'cursor-not-allowed'); els.spinPass.classList.add('hidden');
    }
});

const loadSupportLink = async () => {};

const toggleSidebar = () => {
    els.sidebar.classList.toggle('-translate-x-full'); els.overlay.classList.toggle('hidden');
    setTimeout(() => els.overlay.classList.toggle('opacity-0'), 10);
};
els.openSidebar.addEventListener('click', toggleSidebar); els.closeSidebar.addEventListener('click', toggleSidebar); els.overlay.addEventListener('click', toggleSidebar);

els.logoutBtn.addEventListener('click', async () => {
    sessionStorage.clear();
    await signOut(auth);
});