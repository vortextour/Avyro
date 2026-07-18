import { auth, db } from './firebase.js';
import { doc, collection, onSnapshot, query, where, writeBatch, serverTimestamp, increment, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { showToast } from './validation.js';

let currentUser = null;
let userData = null;
let allWithdrawals = [];
let filteredWithdrawals = [];

// Pagination and Filter State
let currentFilterValue = 'all';
let currentPage = 1;
const itemsPerPage = 10;

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        currentUser = user;
        initWallet();
    }
});

// UI Elements
const els = {
    loader: document.getElementById('pageLoader'),
    walletContent: document.getElementById('walletContent'),
    
    avatar: document.getElementById('headerAvatar'),
    avatarSkeleton: document.getElementById('headerAvatarSkeleton'),
    sidebar: document.getElementById('sidebar'),
    openSidebar: document.getElementById('openSidebarBtn'),
    closeSidebar: document.getElementById('closeSidebarBtn'),
    overlay: document.getElementById('mobileOverlay'),
    supportBtn: document.getElementById('supportBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    
    stBalance: document.getElementById('statBalance'),
    stEarnings: document.getElementById('statEarnings'),
    stTotalWd: document.getElementById('statWithdrawTotal'),
    stPendingReq: document.getElementById('statPendingRequests'),
    
    btnOpenWithdraw: document.getElementById('btnOpenWithdraw'),
    lockedCard: document.getElementById('withdrawLockedCard'),
    
    listContainer: document.getElementById('histListContainer'),
    emptyState: document.getElementById('histEmptyState'),
    tableLoader: document.getElementById('tableLoader'),
    
    paginationWrapper: document.getElementById('paginationWrapper'),
    paginationContainer: document.getElementById('paginationContainer'),
    pageInfo: document.getElementById('pageInfo'),
    
    openFilterModalBtn: document.getElementById('openFilterModalBtn'),
    filterBtnText: document.getElementById('filterBtnText'),
    filterModal: document.getElementById('filterModal'),
    filterOptions: document.querySelectorAll('.filter-opt'),
    
    modal: document.getElementById('withdrawModalOverlay'),
    closeModal: document.getElementById('closeWithdrawBtn'),
    step1: document.getElementById('wdStep1'),
    step2: document.getElementById('wdStep2'),
    step3: document.getElementById('wdStep3'),
    methodsContainer: document.getElementById('wdMethodsContainer'),
    btnWdStep1: document.getElementById('btnWdStep1'),
    btnWdStep2: document.getElementById('btnWdStep2'),
    btnSubmitWd: document.getElementById('btnSubmitWithdraw'),
    
    formLevelError: document.getElementById('wdFormError'),
    formErrorMsg: document.getElementById('wdFormErrorMsg'),
    wdAmountContainer: document.getElementById('wdAmountContainer'),
    wdAccountNumContainer: document.getElementById('wdAccountNumContainer'),
    
    wdAmount: document.getElementById('wdAmount'),
    wdAccountNum: document.getElementById('wdAccountNum'),
    wdAmtError: document.getElementById('wdAmtError'),
    wdAccountNumError: document.getElementById('wdAccountNumError'),
    wdSelMethodName: document.getElementById('wdSelMethodName'),
    modalAvailBalance: document.getElementById('modalAvailBalance'),
    
    wdConfAmount: document.getElementById('wdConfAmount'),
    wdConfMethod: document.getElementById('wdConfMethod'),
    wdConfAccount: document.getElementById('wdConfAccount'),
    wdSpinner: document.getElementById('wdSpinner')
};

// ==========================================
// DYNAMIC FONT SIZER HELPER
// ==========================================
const updateDynamicText = (element, text, defaultClasses = 'text-2xl lg:text-3xl') => {
    if (!element) return;
    const str = String(text);
    element.textContent = str;
    element.title = str; // Tooltip on hover
    
    element.classList.remove('text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'sm:text-5xl', 'lg:text-xl', 'lg:text-2xl', 'lg:text-3xl', 'lg:text-4xl');
    
    const len = str.length;
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

els.openFilterModalBtn.addEventListener('click', () => {
    els.filterModal.classList.remove('hidden'); els.filterModal.classList.add('flex');
});

document.querySelectorAll('.close-filter').forEach(btn => {
    btn.addEventListener('click', () => {
        els.filterModal.classList.add('hidden'); els.filterModal.classList.remove('flex');
    });
});

els.filterOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        currentFilterValue = opt.dataset.value;
        els.filterBtnText.textContent = opt.textContent.trim();
        
        els.filterOptions.forEach(o => {
            o.classList.remove('bg-gray-800', 'text-[#6366F1]', 'border-[#6366F1]/30');
            o.classList.add('text-white', 'border-transparent');
            o.querySelector('.active-icon').classList.add('hidden');
        });
        
        opt.classList.remove('text-white', 'border-transparent');
        opt.classList.add('bg-gray-800', 'text-[#6366F1]', 'border-[#6366F1]/30');
        opt.querySelector('.active-icon').classList.remove('hidden');

        els.filterModal.classList.add('hidden'); els.filterModal.classList.remove('flex');
        
        currentPage = 1;
        applyFiltersAndSort();
    });
});

const initWallet = () => {
    loadSupportLink();
    // 0 READ COST: Local Cached User Data
    onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
            userData = docSnap.data();
            updateWalletUI(userData);
        }
    });
    // 0 READ COST (after 1st load): Cached Withdrawals
    loadWithdrawalHistory();
};

const updateWalletUI = (data) => {
    const uName = data.fullName || 'User';
    els.avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(uName)}&background=6366F1&color=fff&bold=true`;
    els.avatar.classList.remove('hidden'); els.avatarSkeleton.classList.add('hidden');

    updateDynamicText(els.stBalance, `৳${(data.walletBalance || 0).toFixed(2)}`, 'text-4xl sm:text-5xl font-black');
    updateDynamicText(els.stEarnings, `৳${(data.totalReferralBonus || 0).toFixed(2)}`, 'text-4xl font-black');
    updateDynamicText(els.stTotalWd, `৳${(data.totalWithdraw || 0).toFixed(2)}`, 'text-2xl font-black');
    
    if (data.status === 'Active') {
        els.btnOpenWithdraw.classList.remove('hidden'); els.lockedCard.classList.add('hidden');
    } else {
        els.btnOpenWithdraw.classList.add('hidden'); els.lockedCard.classList.remove('hidden'); els.lockedCard.classList.add('flex');
    }

    els.loader.classList.add('hidden'); els.walletContent.classList.remove('hidden'); els.walletContent.classList.add('flex');
};

const loadWithdrawalHistory = () => {
    const q = query(collection(db, "withdrawals"), where("uid", "==", currentUser.uid));
    onSnapshot(q, (snapshot) => {
        allWithdrawals = []; let pendingCount = 0;
        snapshot.forEach(doc => {
            const wd = { id: doc.id, ...doc.data() };
            allWithdrawals.push(wd);
            if (wd.status === 'Pending') pendingCount++;
        });
        updateDynamicText(els.stPendingReq, pendingCount, 'text-2xl font-black');
        applyFiltersAndSort();
    });
};

const applyFiltersAndSort = () => {
    els.tableLoader.classList.remove('hidden');
    const filter = currentFilterValue;
    
    filteredWithdrawals = allWithdrawals.filter(wd => filter === 'all' || wd.status === filter);
    filteredWithdrawals.sort((a, b) => {
        const dateA = a.timestamp ? a.timestamp.toMillis() : 0;
        const dateB = b.timestamp ? b.timestamp.toMillis() : 0;
        return dateB - dateA;
    });
    
    renderList();
};

const renderPagination = (totalItems) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalItems <= itemsPerPage) {
        els.paginationWrapper.classList.add('hidden'); els.paginationWrapper.classList.remove('flex'); return;
    }
    
    els.paginationWrapper.classList.remove('hidden'); els.paginationWrapper.classList.add('flex');
    els.pageInfo.textContent = `Showing ${(currentPage - 1) * itemsPerPage + 1} to ${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems}`;
    
    let html = `<button data-page="${currentPage - 1}" class="page-btn w-9 h-9 flex items-center justify-center rounded-xl border border-[#334155] bg-[#111827] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors" ${currentPage === 1 ? 'disabled' : ''}><i class="ph ph-caret-left"></i></button>`;
    
    for(let i=1; i<=totalPages; i++) {
        if(i === currentPage) html += `<button class="w-9 h-9 flex items-center justify-center rounded-xl bg-[#6366F1] text-white font-black shadow-glow">${i}</button>`;
        else html += `<button data-page="${i}" class="page-btn w-9 h-9 flex items-center justify-center rounded-xl border border-[#334155] bg-[#111827] text-[#9CA3AF] hover:text-white hover:bg-gray-800 transition-colors font-bold">${i}</button>`;
    }
    
    html += `<button data-page="${currentPage + 1}" class="page-btn w-9 h-9 flex items-center justify-center rounded-xl border border-[#334155] bg-[#111827] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors" ${currentPage === totalPages ? 'disabled' : ''}><i class="ph ph-caret-right"></i></button>`;
    
    els.paginationContainer.innerHTML = html;
    
    els.paginationContainer.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const p = parseInt(btn.getAttribute('data-page'));
            if(p && p !== currentPage && p >= 1 && p <= totalPages) { currentPage = p; applyFiltersAndSort(); }
        });
    });
};

const renderList = () => {
    els.listContainer.innerHTML = '';
    const total = filteredWithdrawals.length;
    
    if (total === 0) {
        els.listContainer.classList.add('hidden');
        els.emptyState.classList.remove('hidden'); els.emptyState.classList.add('flex');
        els.tableLoader.classList.add('hidden');
        els.paginationWrapper.classList.add('hidden'); els.paginationWrapper.classList.remove('flex');
        return;
    }
    
    els.listContainer.classList.remove('hidden');
    els.emptyState.classList.add('hidden'); els.emptyState.classList.remove('flex');
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, total);
    const paginatedItems = filteredWithdrawals.slice(start, end);
    
    paginatedItems.forEach(wd => {
        const dateStr = wd.timestamp ? wd.timestamp.toDate().toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}) : 'N/A';
        let badgeClass = 'bg-gray-800 text-gray-500'; let amtColor = 'text-white'; let iconHtml = '<i class="ph ph-bank text-xl"></i>';

        if (wd.status === 'Pending') { badgeClass = 'bg-warning/10 text-warning border border-warning/20'; amtColor = 'text-warning'; } 
        else if (wd.status === 'Approved') { badgeClass = 'bg-success/10 text-success border border-success/20'; amtColor = 'text-success'; } 
        else if (wd.status === 'Rejected') { badgeClass = 'bg-danger/10 text-danger border border-danger/20'; amtColor = 'text-danger line-through opacity-70'; }

        const methodNameLower = (wd.methodName || '').toLowerCase();
        if(methodNameLower.includes('bkash') || methodNameLower.includes('nagad') || methodNameLower.includes('rocket')) iconHtml = '<i class="ph ph-device-mobile text-xl"></i>';
        else if(methodNameLower.includes('binance') || methodNameLower.includes('crypto') || methodNameLower.includes('usdt')) iconHtml = '<i class="ph ph-currency-eth text-xl"></i>';

        // Account Number Displayed directly on list
        els.listContainer.innerHTML += `
            <div class="flex items-center justify-between p-4 sm:p-5 hover:bg-gray-800/50 transition-colors group">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700 group-hover:scale-105 transition-transform text-[#9CA3AF]">${iconHtml}</div>
                    <div><p class="font-bold text-sm sm:text-base text-white mb-0.5">${wd.methodName}</p><p class="text-[10px] sm:text-xs text-[#9CA3AF] font-medium">${dateStr} &bull; A/C: <span class="uppercase tracking-wider font-mono">${wd.accountNumber}</span></p></div>
                </div>
                <div class="text-right">
                    <p class="font-black text-base sm:text-lg ${amtColor}">৳${(wd.amount || 0).toFixed(2)}</p>
                    <span class="inline-block mt-1 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md ${badgeClass}">${wd.status}</span>
                </div>
            </div>`;
    });
    
    renderPagination(total);
    setTimeout(() => els.tableLoader.classList.add('hidden'), 200);
};

// ==========================================
// 0 READ COST: WITHDRAWAL MODAL LOGIC 
// ==========================================
let selectedMethod = null;

const applyShake = (containerId) => {
    const container = document.getElementById(containerId) || containerId;
    if (container) { container.classList.add('animate-shake'); setTimeout(() => container.classList.remove('animate-shake'), 450); }
};

const setInputError = (inputId, isError, msg = "") => {
    const input = document.getElementById(inputId); const errorText = document.getElementById(inputId + 'Error');
    if (isError) {
        input.classList.add('border-danger', 'focus:ring-danger/15'); input.classList.remove('border-[#1E293B]', 'focus:ring-[#6366F1]');
        if (errorText) {
            if(inputId === 'wdAmount') { errorText.textContent = msg; errorText.classList.remove('hidden'); } 
            else { errorText.innerHTML = `<i class="ph ph-warning-circle"></i> ${msg}`; errorText.classList.remove('hidden'); }
        }
    } else {
        input.classList.remove('border-danger', 'focus:ring-danger/15'); input.classList.add('border-[#1E293B]', 'focus:ring-[#6366F1]');
        if (errorText) errorText.classList.add('hidden');
    }
};

els.btnOpenWithdraw.addEventListener('click', async () => {
    els.modal.classList.remove('hidden'); els.modal.classList.add('flex'); els.formLevelError.classList.add('hidden');
    els.modalAvailBalance.textContent = `৳${(userData.walletBalance || 0).toFixed(2)}`;
    
    const cachedMethods = JSON.parse(sessionStorage.getItem('paymentMethodsCache'));
    if (cachedMethods) {
        renderWithdrawMethods(cachedMethods);
    } else {
        try {
            const querySnapshot = await getDocs(collection(db, "paymentMethods"));
            let methods = [];
            querySnapshot.forEach(doc => methods.push({id: doc.id, ...doc.data()}));
            sessionStorage.setItem('paymentMethodsCache', JSON.stringify(methods));
            renderWithdrawMethods(methods);
        } catch(e) { els.methodsContainer.innerHTML = '<p class="text-sm text-danger text-center">Error loading methods.</p>'; }
    }
});

const renderWithdrawMethods = (methods) => {
    els.methodsContainer.innerHTML = '';
    let validMethodsFound = false;
    
    methods.forEach(m => {
        if((m.type === 'Withdraw Only' || m.type === 'Deposit & Withdraw') && m.status === 'Active') {
            validMethodsFound = true;
            
            const n = m.name.toLowerCase();
            let iconHtml = '<i class="ph ph-bank text-2xl"></i>';
            if (n.includes('bkash') || n.includes('nagad') || n.includes('rocket') || n.includes('pay')) iconHtml = '<i class="ph ph-device-mobile text-2xl"></i>';
            else if (n.includes('binance') || n.includes('usdt') || n.includes('trc') || n.includes('crypto')) iconHtml = '<i class="ph ph-currency-eth text-2xl"></i>';

            els.methodsContainer.innerHTML += `
                <label class="relative flex items-center p-4 border-2 border-[#1E293B] rounded-2xl cursor-pointer hover:bg-[#1E293B]/50 transition-all duration-300 mb-3 group overflow-hidden bg-[#0B1120]/50">
                    <input type="radio" name="wdMethod" value="${m.id}" class="peer sr-only" data-name="${m.name}">
                    
                    <div class="w-6 h-6 rounded-full border-2 border-[#475569] peer-checked:border-[#6366F1] peer-checked:bg-[#6366F1] flex items-center justify-center mr-4 transition-all relative z-10 shadow-inner">
                        <i class="ph ph-check text-white text-xs opacity-0 peer-checked:opacity-100 transition-opacity"></i>
                    </div>
                    
                    <div class="flex-1 relative z-10">
                        <span class="block font-bold text-base text-white group-hover:text-[#818CF8] peer-checked:text-[#818CF8] transition-colors">${m.name}</span>
                        <span class="block text-xs font-medium text-[#9CA3AF] mt-0.5 opacity-80">${m.accountName || 'Receiving Gateway'}</span>
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
        els.methodsContainer.innerHTML = '<p class="text-sm font-bold text-warning bg-warning/10 p-4 rounded-xl text-center border border-warning/20">No active withdrawal methods available.</p>'; return;
    }

    document.querySelectorAll('input[name="wdMethod"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            selectedMethod = e.target; 
            els.btnWdStep1.disabled = false; 
            els.btnWdStep1.classList.remove('opacity-50', 'cursor-not-allowed');
            els.btnWdStep1.classList.add('hover:bg-[#818CF8]', 'shadow-glow');
        });
    });
}

const closeWithdrawModal = () => { els.modal.classList.add('hidden'); els.modal.classList.remove('flex'); resetWithdrawModal(); };
els.closeModal.addEventListener('click', closeWithdrawModal);

els.wdAmount.addEventListener('input', () => { setInputError('wdAmount', false); els.formLevelError.classList.add('hidden'); });
els.wdAccountNum.addEventListener('input', () => { setInputError('wdAccountNum', false); els.formLevelError.classList.add('hidden'); });

// Step 1 to Step 2 Transition with 0-Read Day Check
els.btnWdStep1.addEventListener('click', () => {
    if(!selectedMethod) return;

    // 0 READ COST: লোকাল ক্যাশ থেকে চেক করা হচ্ছে আজকে উইথড্র হয়েছে কিনা
    const today = new Date();
    today.setHours(0, 0, 0, 0); // আজকের দিনের শুরু

    const hasWithdrawnToday = allWithdrawals.some(wd => {
        // রিজেক্টেড রিকোয়েস্ট কাউন্ট হবে না
        if (!wd.timestamp || wd.status === 'Rejected') return false; 
        
        // ফায়ারবেস টাইমস্ট্যাম্প বা ক্যাশড স্ট্রিং ডেট যেটাই হোক
        const wdDate = wd.timestamp.toDate ? wd.timestamp.toDate() : new Date(wd.timestamp);
        wdDate.setHours(0, 0, 0, 0); // শুধু তারিখ মেলাবো, সময় নয়
        
        return wdDate.getTime() === today.getTime();
    });

    // যদি আজকে উইথড্র করে থাকে, লাল মেসেজ দিয়ে ব্লক করবে
    if (hasWithdrawnToday) {
        els.formErrorMsg.textContent = 'আপনি আজ ইতিমধ্যে একবার উইথড্র করেছেন। আগামীকাল আবার চেষ্টা করুন।';
        els.formLevelError.classList.remove('hidden');
        els.formLevelError.classList.add('flex');
        applyShake('wdStep1');
        return; // পরের স্টেপে যেতে দিবে না
    }

    // সব ঠিক থাকলে এরর হাইড করে পরের স্টেপে যাবে
    els.formLevelError.classList.add('hidden'); 
    els.step1.classList.add('hidden'); 
    els.step2.classList.remove('hidden');
    els.wdSelMethodName.textContent = selectedMethod.dataset.name;
});

els.btnWdStep2.addEventListener('click', () => {
    const amt = Number(els.wdAmount.value); const acc = els.wdAccountNum.value.trim();
    let hasError = false;
    
    if(!amt || amt <= 0) { setInputError('wdAmount', true, 'Enter a valid amount'); applyShake('wdAmountContainer'); hasError = true; } 
    // Client side check using Cached User Data (0 Read)
    else if(amt > userData.walletBalance) { setInputError('wdAmount', true, 'Amount exceeds available balance'); applyShake('wdAmountContainer'); hasError = true; }

    if(!acc) { setInputError('wdAccountNum', true, 'Account number is required'); applyShake('wdAccountNumContainer'); hasError = true; }
    if (hasError) return;

    els.formLevelError.classList.add('hidden'); els.step2.classList.add('hidden'); els.step3.classList.remove('hidden');
    els.wdConfAmount.textContent = '৳' + amt.toFixed(2); els.wdConfMethod.textContent = selectedMethod.dataset.name; els.wdConfAccount.textContent = acc;
});

document.querySelectorAll('.wdBtnBack').forEach(btn => {
    btn.addEventListener('click', () => {
        els.formLevelError.classList.add('hidden');
        if(!els.step3.classList.contains('hidden')){ els.step3.classList.add('hidden'); els.step2.classList.remove('hidden'); } 
        else if(!els.step2.classList.contains('hidden')){ els.step2.classList.add('hidden'); els.step1.classList.remove('hidden'); } 
        else { closeWithdrawModal(); }
    });
});

// 0 READ COST: WITHDRAWAL SUBMIT USING FieldValue.increment
els.btnSubmitWd.addEventListener('click', async () => {
    const amt = Number(els.wdAmount.value);
    const acc = els.wdAccountNum.value.trim();
    const reqId = 'WD-' + Math.floor(100000 + Math.random() * 900000);

    els.btnSubmitWd.disabled = true; els.wdSpinner.classList.remove('hidden'); els.btnSubmitWd.classList.add('opacity-80');
    els.formLevelError.classList.add('hidden');

    try {
        const userRef = doc(db, "users", currentUser.uid);
        const withdrawRef = doc(collection(db, "withdrawals"));
        
        // Batch Write with increment (No getDoc required!)
        const batch = writeBatch(db);
        
        // Deduct from User Wallet directly via increment
        batch.update(userRef, { walletBalance: increment(-amt) });
        
        // Create Request
        batch.set(withdrawRef, {
            uid: currentUser.uid,
            username: userData.username,
            requestId: reqId,
            amount: amt,
            methodId: selectedMethod.value,
            methodName: selectedMethod.dataset.name,
            accountNumber: acc,
            status: 'Pending',
            timestamp: serverTimestamp()
        });

        // এই লাইনটিই মূল ফিক্স: অ্যাডমিন প্যানেলকে সিগন্যাল দেওয়ার জন্য wdsVersion 1 বাড়ানো হলো
        batch.set(doc(db, "system", "metadata"), { wdsVersion: increment(1) }, { merge: true });

        await batch.commit();

        showToast('Withdrawal request submitted successfully!', 'success');
        els.step3.innerHTML = `
            <div class="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-5 border-[4px] border-success/20">
                <i class="ph ph-check-circle text-4xl text-success"></i>
            </div>
            <h3 class="text-2xl font-bold mb-2 text-white">Request Submitted!</h3>
            <p class="text-sm text-[#9CA3AF] mb-8 leading-relaxed max-w-xs mx-auto">Your withdrawal request is pending admin approval. You will receive funds shortly.</p>
            <button id="btnReturnToWallet" class="w-full py-4 rounded-2xl bg-gray-800 hover:bg-gray-700 text-white font-bold transition-colors text-base">Return to Wallet</button>
        `;
        
        // Add the event listener securely
        document.getElementById('btnReturnToWallet').addEventListener('click', closeWithdrawModal);
    } catch (e) {
        els.formErrorMsg.textContent = 'Error submitting request. Try again.';
        els.formLevelError.classList.remove('hidden'); els.formLevelError.classList.add('flex');
        applyShake('wdStep3');
        els.btnSubmitWd.disabled = false; els.wdSpinner.classList.add('hidden'); els.btnSubmitWd.classList.remove('opacity-80');
    }
});

const resetWithdrawModal = () => {
    els.step1.classList.remove('hidden'); els.step2.classList.add('hidden'); els.step3.classList.add('hidden');
    els.wdAmount.value = ''; els.wdAccountNum.value = '';
    setInputError('wdAmount', false); setInputError('wdAccountNum', false); els.formLevelError.classList.add('hidden');
    selectedMethod = null; els.btnWdStep1.disabled = true; els.btnWdStep1.classList.add('opacity-50', 'cursor-not-allowed');
    els.btnWdStep1.classList.remove('hover:bg-[#818CF8]', 'shadow-glow');
    els.btnSubmitWd.disabled = false; els.btnSubmitWd.classList.remove('opacity-80'); els.wdSpinner.classList.add('hidden');
    
    // Restore Step 3 content if it was changed to success message
    els.step3.innerHTML = `
        <button class="wdBtnBack absolute top-6 left-6 text-xs font-bold text-[#9CA3AF] hover:text-white bg-gray-800 w-8 h-8 rounded-full flex items-center justify-center transition-colors"><i class="ph ph-arrow-left text-base"></i></button>
        
        <div class="w-20 h-20 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-5 mt-2 border-[4px] border-warning/20">
            <i class="ph ph-warning-circle text-4xl text-warning"></i>
        </div>
        <h3 class="text-2xl font-bold tracking-tight mb-2 text-white">Confirm Withdrawal</h3>
        <p class="text-sm text-[#9CA3AF] mb-6">Verify your details before submitting.</p>
        
        <div class="bg-gray-800/50 p-5 rounded-2xl text-left space-y-4 mb-8 border border-gray-700">
            <div class="flex justify-between items-center border-b border-gray-700/50 pb-3">
                <span class="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Total Amount</span> 
                <span id="wdConfAmount" class="text-xl font-black text-success drop-shadow-sm"></span>
            </div>
            <div class="flex justify-between items-center text-sm pt-1 pb-3 border-b border-gray-700/50">
                <span class="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Method</span> 
                <span id="wdConfMethod" class="font-bold text-[#818CF8]"></span>
            </div>
            <div class="flex justify-between items-center text-sm pt-1">
                <span class="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Account No.</span> 
                <span id="wdConfAccount" class="font-bold tracking-wider text-white"></span>
            </div>
        </div>

        <div class="flex gap-3">
            <button class="wdBtnBack flex-1 py-4 rounded-2xl bg-gray-800 hover:bg-gray-700 text-white font-bold transition-all text-base">Back</button>
            <button id="btnSubmitWithdraw" class="flex-[2] py-4 rounded-2xl bg-success hover:bg-green-600 text-white font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 text-base">
                <span>Confirm & Submit</span>
                <i id="wdSpinner" class="ph ph-spinner-gap animate-spin hidden text-lg"></i>
            </button>
        </div>
    `;
    
    // Re-attach listeners after restoring step 3 HTML
    document.querySelectorAll('.wdBtnBack').forEach(btn => {
        btn.addEventListener('click', () => {
            els.formLevelError.classList.add('hidden');
            if(!els.step3.classList.contains('hidden')){ els.step3.classList.add('hidden'); els.step2.classList.remove('hidden'); } 
            else if(!els.step2.classList.contains('hidden')){ els.step2.classList.add('hidden'); els.step1.classList.remove('hidden'); } 
            else { closeWithdrawModal(); }
        });
    });
    
    document.getElementById('btnSubmitWithdraw').addEventListener('click', els.btnSubmitWd.onclick);
};

// ... Rest of sidebar logic ...
const loadSupportLink = async () => {}; // Appears from Local Config
const toggleSidebar = () => { els.sidebar.classList.toggle('-translate-x-full'); els.overlay.classList.toggle('hidden'); setTimeout(() => els.overlay.classList.toggle('opacity-0'), 10); };
els.openSidebar.addEventListener('click', toggleSidebar); els.closeSidebar.addEventListener('click', toggleSidebar); els.overlay.addEventListener('click', toggleSidebar);

els.logoutBtn.addEventListener('click', async () => await signOut(auth));