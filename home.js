import { auth, db } from './firebase.js';
import { doc, collection, onSnapshot, getDocs, addDoc, serverTimestamp, getDoc, getDocFromCache, writeBatch, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { showToast, isValidTransactionId } from './validation.js';

let currentUser = null;
let userData = null;

// Dynamic Plans fetched from DB (or fallback)
let PLANS = [
    { level: 0, name: "Inactive", price: 0, color: "from-red-600 to-rose-900", icon: "ph-lock-key" },
    { level: 1, name: "Bronze", price: 50, color: "from-orange-500 to-orange-700", icon: "ph-medal" },
    { level: 2, name: "Silver", price: 100, color: "from-gray-400 to-gray-600", icon: "ph-coin" },
    { level: 3, name: "Gold", price: 200, color: "from-yellow-400 to-yellow-600", icon: "ph-crown" },
    { level: 4, name: "Platinum", price: 500, color: "from-cyan-500 to-blue-600", icon: "ph-diamond" },
    { level: 5, name: "Diamond", price: 1000, color: "from-purple-500 to-indigo-600", icon: "ph-sketch-logo" }
];

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        currentUser = user;
        initDashboard();
    }
});

// UI Elements
const els = {
    avatar: document.getElementById('headerAvatar'),
    avatarSkeleton: document.getElementById('headerAvatarSkeleton'),
    planBanner: document.getElementById('planBanner'),
    planIcon: document.getElementById('planIcon'),
    planSubTitle: document.getElementById('planSubTitle'),
    planTitle: document.getElementById('planTitle'),
    planDesc: document.getElementById('planDesc'),
    upgradeNowBtn: document.getElementById('upgradeNowBtn'),
    sWallet: document.getElementById('statWallet'),
    sRefBonus: document.getElementById('statRefBonus'),
    sTotalDep: document.getElementById('statTotalDeposit'),
    sTotalWith: document.getElementById('statTotalWithdraw'),
    sidebar: document.getElementById('sidebar'),
    openSidebar: document.getElementById('openSidebarBtn'),
    closeSidebar: document.getElementById('closeSidebarBtn'),
    overlay: document.getElementById('mobileOverlay'),
    logoutBtn: document.getElementById('logoutBtn')
};

// ==========================================
// DYNAMIC FONT SIZER HELPER
// ==========================================
// সংখ্যার লেংথ অনুযায়ী ফন্ট সাইজ কন্ট্রোল করার ফাংশন
const updateDynamicText = (element, text, defaultClasses = 'text-2xl lg:text-3xl') => {
    element.textContent = text;
    element.title = text; // Tooltip for full number hover
    const len = text.length;
    
    // Clean up previous size classes
    element.classList.remove('text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'lg:text-xl', 'lg:text-2xl', 'lg:text-3xl', 'lg:text-4xl');
    
    // Apply dynamic sizes based on string length to prevent layout breaks
    if (len > 15) {
        element.classList.add('text-lg', 'lg:text-lg');
    } else if (len > 12) {
        element.classList.add('text-xl', 'lg:text-xl');
    } else if (len > 9) {
        element.classList.add('text-2xl', 'lg:text-2xl');
    } else {
        defaultClasses.split(' ').forEach(cls => element.classList.add(cls));
    }
};

const initDashboard = async () => {
    await fetchGlobalPlans();
    loadUserProfile();
};

// 0 READ COST: Load plans from cache first
const fetchGlobalPlans = async () => {
    const cachedPlans = localStorage.getItem('globalPlansCache');
    if (cachedPlans) PLANS = JSON.parse(cachedPlans);

    try {
        let snap;
        try { snap = await getDocFromCache(doc(db, "settings", "referral")); } 
        catch (e) { snap = await getDoc(doc(db, "settings", "referral")); }

        if(snap.exists() && snap.data().plans) {
            const p = snap.data().plans;
            PLANS[1].price = p.bronze || 50; PLANS[2].price = p.silver || 100;
            PLANS[3].price = p.gold || 200; PLANS[4].price = p.platinum || 500;
            PLANS[5].price = p.diamond || 1000;
            localStorage.setItem('globalPlansCache', JSON.stringify(PLANS));
        }
    } catch(e) { console.warn("Could not load dynamic prices, using defaults."); }
};

// 0 WAIT TIME: Instant UI load from Cache
const loadUserProfile = () => {
    const cachedUser = sessionStorage.getItem('userDataCache');
    if (cachedUser) {
        userData = JSON.parse(cachedUser);
        updateDashboardUI(userData);
    }

    onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
            userData = docSnap.data();
            
            // Format timestamp for JSON caching
            const cacheData = { ...userData };
            if (cacheData.createdAt && cacheData.createdAt.toDate) {
                cacheData.createdAt = cacheData.createdAt.toDate().toISOString();
            }
            sessionStorage.setItem('userDataCache', JSON.stringify(cacheData));
            updateDashboardUI(cacheData);
        } else {
            showToast('User profile missing!', 'error');
        }
    }, (error) => {
        document.getElementById('networkError').classList.remove('hidden');
    });
};

const updateDashboardUI = (data) => {
    // শুধুমাত্র নামের প্রথম অক্ষর দিয়ে ইউআই এভাটার তৈরি
    const uName = data.fullName || 'User';
    els.avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(uName)}&background=6366F1&color=fff&bold=true`;
    els.avatar.classList.remove('hidden'); els.avatarSkeleton.classList.add('hidden');

    // ডাইনামিক ফন্ট সাইজার ফাংশনের মাধ্যমে স্ট্যাট আপডেট
    updateDynamicText(els.sWallet, `৳${(data.walletBalance || 0).toFixed(2)}`);
    updateDynamicText(els.sRefBonus, `৳${(data.totalReferralBonus || 0).toFixed(2)}`);
    updateDynamicText(els.sTotalDep, `৳${(data.totalDeposit || 0).toFixed(2)}`);
    updateDynamicText(els.sTotalWith, `৳${(data.totalWithdraw || 0).toFixed(2)}`);
    
    let currentLevel = data.planLevel !== undefined ? data.planLevel : (data.status === 'Active' ? 1 : 0);
    if(data.status !== 'Active') currentLevel = 0;
    if(currentLevel > 5) currentLevel = 5;
    
    const currentPlan = PLANS[currentLevel];
    els.planBanner.className = `w-full rounded-[2.5rem] p-8 lg:p-10 border border-white/10 shadow-2xl animate-slide-up relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 transition-all duration-500 group bg-gradient-to-r ${currentPlan.color}`;
    els.planTitle.textContent = currentPlan.name;
    els.planIcon.className = `ph ${currentPlan.icon} text-5xl drop-shadow-md`;
    
    if (currentLevel === 0) {
        els.planSubTitle.textContent = "Account Status"; 
        els.planTitle.textContent = "Inactive";
        els.planDesc.classList.remove('hidden');
        els.planDesc.textContent = "Activate your account to unlock full platform access, referrals, and withdrawals.";
        els.upgradeNowBtn.textContent = `Activate Account`; 
        els.upgradeNowBtn.classList.remove('hidden');
    } else if (currentLevel === 5) {
        els.planSubTitle.textContent = "Max Level Reached"; els.planDesc.classList.add('hidden');
        els.upgradeNowBtn.classList.add('hidden'); 
    } else {
        els.planSubTitle.textContent = "Current Plan"; els.planDesc.classList.add('hidden');
        const nextPlan = PLANS[currentLevel + 1];
        els.upgradeNowBtn.textContent = `Upgrade to ${nextPlan.name}`;
        els.upgradeNowBtn.classList.remove('hidden');
    }
    
    document.getElementById('pageLoader').classList.add('hidden');
    document.getElementById('dashboardContent').classList.remove('hidden');
    document.getElementById('dashboardContent').classList.add('flex');
};

// ==========================================
// UPGRADE MODAL WORKFLOW 
// ==========================================
const modal = document.getElementById('upgradeModalOverlay');
let selectedMethod = null;
let targetPlan = null;

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

document.getElementById('depTrxId').addEventListener('input', () => { setInputError('depTrxId', false); });

const renderPaymentMethods = (methods) => {
    const container = document.getElementById('paymentMethodsContainer');
    container.innerHTML = '';
    let validMethodsFound = false;
    
    methods.forEach(m => {
        if((m.type === 'Deposit Only' || m.type === 'Deposit & Withdraw') && m.status === 'Active') {
            validMethodsFound = true;
            
            // ডায়নামিক আইকন 
            const n = m.name.toLowerCase();
            let iconHtml = '<i class="ph ph-bank text-2xl"></i>';
            if (n.includes('bkash') || n.includes('nagad') || n.includes('rocket') || n.includes('pay')) iconHtml = '<i class="ph ph-device-mobile text-2xl"></i>';
            else if (n.includes('binance') || n.includes('usdt') || n.includes('trc') || n.includes('crypto')) iconHtml = '<i class="ph ph-currency-eth text-2xl"></i>';

            // নাম্বার হাইড করে শুধু সেন্ড পেমেন্ট টু সেকশনের জন্য রাখা হয়েছে 
            container.innerHTML += `
                <label class="relative flex items-center p-4 border-2 border-[#1E293B] rounded-2xl cursor-pointer hover:bg-[#1E293B]/50 transition-all duration-300 mb-3 group overflow-hidden bg-[#0B1120]/50">
                    <input type="radio" name="payMethod" value="${m.id}" class="peer sr-only" data-name="${m.name}" data-acc="${m.accountName}" data-num="${m.number}">
                    
                    <div class="w-6 h-6 rounded-full border-2 border-[#475569] peer-checked:border-[#6366F1] peer-checked:bg-[#6366F1] flex items-center justify-center mr-4 transition-all relative z-10 shadow-inner">
                        <i class="ph ph-check text-white text-xs opacity-0 peer-checked:opacity-100 transition-opacity"></i>
                    </div>
                    
                    <div class="flex-1 relative z-10">
                        <span class="block font-bold text-base text-white group-hover:text-[#818CF8] peer-checked:text-[#818CF8] transition-colors">${m.name}</span>
                        <span class="block text-xs font-medium text-[#9CA3AF] mt-0.5 opacity-80">${m.accountName}</span>
                    </div>
                    
                    <div class="relative z-10 w-12 h-12 rounded-xl bg-[#111827] border border-[#1E293B] flex items-center justify-center text-[#6366F1] shadow-inner group-hover:scale-110 peer-checked:scale-110 transition-transform">
                        ${iconHtml}
                    </div>
                    
                    <!-- Selected Highlight Options -->
                    <div class="absolute inset-0 border-2 border-transparent peer-checked:border-[#6366F1] rounded-2xl pointer-events-none transition-colors"></div>
                    <div class="absolute inset-0 bg-[#6366F1]/5 opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity"></div>
                </label>
            `;
        }
    });
    
    if(!validMethodsFound) {
        container.innerHTML = '<p class="text-sm font-bold text-warning bg-warning/10 p-4 rounded-xl text-center border border-warning/20">No active payment methods available.</p>';
        return;
    }

    document.querySelectorAll('input[name="payMethod"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            selectedMethod = e.target;
            const btn = document.getElementById('btnStep1');
            btn.disabled = false; btn.classList.remove('opacity-50', 'cursor-not-allowed');
            btn.classList.add('hover:bg-[#818CF8]', 'shadow-glow');
        });
    });
};

els.upgradeNowBtn.addEventListener('click', async () => {
    let currentLevel = userData.planLevel !== undefined ? userData.planLevel : (userData.status === 'Active' ? 1 : 0);
    if(userData.status !== 'Active') currentLevel = 0;
    if(currentLevel >= 5) return;
    targetPlan = PLANS[currentLevel + 1];
    
    document.getElementById('depAmount').value = targetPlan.price;
    document.getElementById('selAmountDisplay').textContent = `৳${targetPlan.price}`;
    
    if (currentLevel === 0) {
        document.getElementById('modalActionType').textContent = "Activating Account";
        document.getElementById('modalFeeText').innerHTML = `Activation Fee: <span id="modalNextPlanPrice" class="text-success font-black text-xl ml-1">৳${targetPlan.price}</span>`;
        document.getElementById('upgradeModalTitleText').textContent = "Activate Account";
        document.getElementById('upgradeModalIcon').className = "ph ph-power text-[#6366F1] text-xl";
        document.getElementById('modalNextPlanName').textContent = "Bronze Plan";
    } else {
        document.getElementById('modalActionType').textContent = "Upgrading To";
        document.getElementById('modalFeeText').innerHTML = `Upgrade Fee: <span id="modalNextPlanPrice" class="text-success font-black text-xl ml-1">৳${targetPlan.price}</span>`;
        document.getElementById('upgradeModalTitleText').textContent = "Plan Upgrade";
        document.getElementById('upgradeModalIcon').className = "ph ph-trend-up text-[#6366F1] text-xl";
        document.getElementById('modalNextPlanName').textContent = targetPlan.name;
    }
    
    modal.classList.remove('hidden'); modal.classList.add('flex');
    document.getElementById('upgradeFormError').classList.add('hidden');
    
    // 0 READ COST: Cache payment methods
    const cachedMethods = sessionStorage.getItem('paymentMethodsCache');
    if (cachedMethods) {
        renderPaymentMethods(JSON.parse(cachedMethods));
    } else {
        try {
            const querySnapshot = await getDocs(collection(db, "paymentMethods"));
            let methods = [];
            querySnapshot.forEach(doc => methods.push({id: doc.id, ...doc.data()}));
            sessionStorage.setItem('paymentMethodsCache', JSON.stringify(methods));
            renderPaymentMethods(methods);
        } catch(e) { document.getElementById('paymentMethodsContainer').innerHTML = '<p class="text-sm text-danger text-center">Error loading methods.</p>'; }
    }
});

const closeModal = () => { modal.classList.add('hidden'); modal.classList.remove('flex'); resetModal(); };
document.querySelectorAll('.close-modal, #closeUpgradeBtn').forEach(btn => btn.addEventListener('click', closeModal));

document.getElementById('btnStep1').addEventListener('click', () => {
    if(!selectedMethod) return;
    document.getElementById('upgradeStep1').classList.add('hidden'); document.getElementById('upgradeStep2').classList.remove('hidden');
    document.getElementById('selMethodName').textContent = selectedMethod.dataset.name; 
    document.getElementById('selNumber').textContent = selectedMethod.dataset.num; // এখানেই শুধু নাম্বার দেখাবে
});

document.querySelectorAll('.btnBack').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById('upgradeFormError').classList.add('hidden');
        document.getElementById('upgradeStep2').classList.add('hidden'); document.getElementById('upgradeStep1').classList.remove('hidden');
    });
});

document.querySelector('.copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('selNumber').textContent);
    showToast('Number copied successfully!', 'success');
});

// Final Submit
document.getElementById('btnStep2').addEventListener('click', async () => {
    const trx = document.getElementById('depTrxId').value.trim().toUpperCase();
    if(!isValidTransactionId(trx)) { setInputError('depTrxId', true, 'Minimum 4 characters required.'); applyShake('depTrxIdContainer'); return; }

    const btn = document.getElementById('btnStep2');
    btn.disabled = true; btn.classList.add('opacity-80'); btn.textContent = 'Submitting...';
    document.getElementById('upgradeFormError').classList.add('hidden');

    try {
        const uname = userData && userData.username ? userData.username : 'Unknown';
        
        // AddDoc এর বদলে writeBatch ব্যবহার করছি যাতে একসাথে রিকোয়েস্ট এবং মেটাডাটা আপডেট হয়
        const batch = writeBatch(db);
        const newDepositRef = doc(collection(db, "deposits"));
        
        batch.set(newDepositRef, {
            uid: currentUser.uid, username: uname, methodId: selectedMethod.value, methodName: selectedMethod.dataset.name,
            amount: Number(targetPlan.price), transactionId: trx, planUpgradeLevel: targetPlan.level, planUpgradeName: targetPlan.name,
            status: "Pending", timestamp: serverTimestamp()
        });
        
        // এই লাইনটিই মূল ফিক্স: অ্যাডমিন প্যানেলকে সিগন্যাল দেওয়ার জন্য depsVersion 1 বাড়ানো হলো
        batch.set(doc(db, "system", "metadata"), { depsVersion: increment(1) }, { merge: true });
        
        await batch.commit();
        
        document.getElementById('upgradeStep2').classList.add('hidden'); document.getElementById('upgradeStep3').classList.remove('hidden');
        showToast('Request submitted successfully!', 'success');
    } catch (e) {
        document.getElementById('upgradeFormErrorMsg').textContent = e.message || 'System Error: Failed to submit the request.';
        document.getElementById('upgradeFormError').classList.remove('hidden'); document.getElementById('upgradeFormError').classList.add('flex');
        applyShake('upgradeStep2'); 
        btn.disabled = false; btn.classList.remove('opacity-80'); btn.textContent = 'Submit Request';
    }
});

const resetModal = () => {
    document.getElementById('upgradeStep1').classList.remove('hidden'); document.getElementById('upgradeStep2').classList.add('hidden'); document.getElementById('upgradeStep3').classList.add('hidden');
    document.getElementById('depTrxId').value = ''; setInputError('depTrxId', false); document.getElementById('upgradeFormError').classList.add('hidden');
    selectedMethod = null; document.getElementById('btnStep1').disabled = true; document.getElementById('btnStep1').classList.add('opacity-50', 'cursor-not-allowed');
    document.getElementById('btnStep1').classList.remove('hover:bg-[#818CF8]', 'shadow-glow');
    const b = document.getElementById('btnStep2'); b.disabled = false; b.classList.remove('opacity-80'); b.textContent = 'Submit Request';
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