import { auth, db } from './firebase.js';
import { doc, onSnapshot, getDoc, getDocFromCache } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { copyToClipboard } from './validation.js';

let currentUser = null;
let userData = null;

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = 'index.html';
    else { currentUser = user; initReferralCenter(); }
});

const els = {
    loader: document.getElementById('pageLoader'),
    lockedCard: document.getElementById('referralLockedCard'),
    activeContent: document.getElementById('referralActiveContent'),
    avatar: document.getElementById('headerAvatar'),
    avatarSkeleton: document.getElementById('headerAvatarSkeleton'),
    sidebar: document.getElementById('sidebar'),
    openSidebar: document.getElementById('openSidebarBtn'),
    closeSidebar: document.getElementById('closeSidebarBtn'),
    overlay: document.getElementById('mobileOverlay'),
    supportBtn: document.getElementById('supportBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    refLinkInput: document.getElementById('refLinkInput'),
    refCodeInput: document.getElementById('refCodeInput'),
    btnCopyLink: document.getElementById('btnCopyLink'),
    btnQrCode: document.getElementById('btnQrCode'),
    btnCopyCode: document.getElementById('btnCopyCode'),
    qrModal: document.getElementById('qrModal'),
    qrImage: document.getElementById('qrImage'),
    closeQrBtn: document.getElementById('closeQrBtn'),
    btnDownloadQr: document.getElementById('btnDownloadQr'),
};

const initReferralCenter = () => {
    loadSupportLink();
    
    // 0 WAIT TIME: Instant UI load from Cache
    const cachedUser = sessionStorage.getItem('userDataCache');
    if (cachedUser) {
        userData = JSON.parse(cachedUser);
        updateUI(userData);
    }

    onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
            userData = docSnap.data();
            const cacheData = { ...userData };
            if (cacheData.createdAt && cacheData.createdAt.toDate) {
                cacheData.createdAt = cacheData.createdAt.toDate().toISOString();
            }
            sessionStorage.setItem('userDataCache', JSON.stringify(cacheData));
            updateUI(cacheData);
        }
    });
};

const updateUI = (data) => {
    // ডাইনামিক প্রোফাইল আইকন (ইমেজ ছাড়াই শুধু নামের প্রথম অক্ষর)
    const uName = data.fullName || 'User';
    els.avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(uName)}&background=6366F1&color=fff&bold=true`;
    els.avatar.classList.remove('hidden'); els.avatarSkeleton.classList.add('hidden');
    els.loader.classList.add('hidden');

    if (data.status === 'Active') {
        els.lockedCard.classList.add('hidden');
        els.activeContent.classList.remove('hidden'); els.activeContent.classList.add('flex');
        setupReferralTools(data);
    } else {
        els.activeContent.classList.add('hidden'); els.activeContent.classList.remove('flex');
        els.lockedCard.classList.remove('hidden');
    }
};

// ==========================================
// DYNAMIC FONT SIZER FOR REFERRAL CODE
// ==========================================
const adjustRefCodeSize = (code, element) => {
    const len = code.length;
    // আগের ক্লাসগুলো রিমুভ করা
    element.classList.remove('text-2xl', 'lg:text-3xl', 'tracking-[0.25em]', 'text-xl', 'lg:text-2xl', 'tracking-widest', 'text-base', 'lg:text-lg', 'tracking-wider', 'text-sm', 'tracking-normal');
    
    // লেংথ অনুযায়ী ডায়নামিক ফন্ট সাইজ
    if (len > 25) {
        element.classList.add('text-sm', 'tracking-normal');
    } else if (len > 15) {
        element.classList.add('text-base', 'lg:text-lg', 'tracking-wider');
    } else if (len > 10) {
        element.classList.add('text-xl', 'lg:text-2xl', 'tracking-widest');
    } else {
        element.classList.add('text-2xl', 'lg:text-3xl', 'tracking-[0.25em]');
    }
};

const setupReferralTools = (data) => {
    const refCode = data.referralCode || 'N/A';
    const refLink = `${window.location.origin}/register.html?ref=${refCode}`;
    
    // Set value and adjust size dynamically
    els.refCodeInput.value = refCode; 
    adjustRefCodeSize(refCode, els.refCodeInput);
    
    els.refLinkInput.value = refLink;

    els.btnCopyLink.onclick = () => copyToClipboard(refLink, 'Referral link copied successfully!');
    els.btnCopyCode.onclick = () => copyToClipboard(refCode, 'Referral code copied successfully!');

    els.btnQrCode.onclick = () => {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(refLink)}&margin=10`;
        els.qrImage.src = qrUrl; els.qrImage.onload = () => els.qrImage.classList.remove('skeleton-text');
        els.qrModal.classList.remove('hidden'); els.qrModal.classList.add('flex');
    };
    
    els.closeQrBtn.onclick = () => { els.qrModal.classList.add('hidden'); els.qrModal.classList.remove('flex'); };

    els.btnDownloadQr.onclick = async () => {
        try {
            const response = await fetch(els.qrImage.src); const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.style.display = 'none'; a.href = url;
            a.download = `EarnPro-QR-${refCode}.png`; document.body.appendChild(a); a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) { console.error('Failed to download QR'); }
    };
};

// 0 READ COST: Settings Cache
const loadSupportLink = async () => {
    let cachedSupport = localStorage.getItem('supportLinkCache');
    if (cachedSupport) {
        els.supportBtn.href = cachedSupport;
        return;
    }
    try {
        let docSnap;
        try { docSnap = await getDocFromCache(doc(db, "settings", "general")); } 
        catch (e) { docSnap = await getDoc(doc(db, "settings", "general")); }
        
        if (docSnap.exists() && docSnap.data().telegramSupportLink) {
            els.supportBtn.href = docSnap.data().telegramSupportLink;
            localStorage.setItem('supportLinkCache', docSnap.data().telegramSupportLink);
        }
    } catch (e) {}
};

const toggleSidebar = () => {
    els.sidebar.classList.toggle('-translate-x-full'); els.overlay.classList.toggle('hidden');
    setTimeout(() => els.overlay.classList.toggle('opacity-0'), 10);
};
els.openSidebar.addEventListener('click', toggleSidebar); els.closeSidebar.addEventListener('click', toggleSidebar); els.overlay.addEventListener('click', toggleSidebar);

els.logoutBtn.addEventListener('click', async () => {
    sessionStorage.clear();
    await signOut(auth);
});