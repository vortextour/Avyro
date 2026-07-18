import { auth, db } from './firebase.js';
import { doc, collection, onSnapshot, query, where, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;
let userData = null;
let treeDataMap = new Map(); 
let rootNode = null;

// Pagination and Filter State
let currentFilterValue = 'all';
let currentPage = 1;
const itemsPerPage = 10;

// Plan Configuration
const PLAN_INFO = {
    1: { name: 'Bronze', color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: 'ph-medal' },
    2: { name: 'Silver', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20', icon: 'ph-coin' },
    3: { name: 'Gold', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: 'ph-crown' },
    4: { name: 'Platinum', color: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: 'ph-diamond' },
    5: { name: 'Diamond', color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'ph-sketch-logo' }
};

const LEVEL_INFO = {
    1: { title: 'Level 1', bonus: '50% Bonus', icon: 'ph-user' },
    2: { title: 'Level 2', bonus: '10% Bonus', icon: 'ph-users' },
    3: { title: 'Level 3', bonus: '5% Bonus', icon: 'ph-users-three' }
};

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        currentUser = user;
        initReferralTree();
    }
});

// UI Elements
const els = {
    loader: document.getElementById('pageLoader'),
    lockedCard: document.getElementById('treeLockedCard'),
    activeContent: document.getElementById('treeActiveContent'),
    
    avatar: document.getElementById('headerAvatar'),
    avatarSkeleton: document.getElementById('headerAvatarSkeleton'),
    sidebar: document.getElementById('sidebar'),
    openSidebar: document.getElementById('openSidebarBtn'),
    closeSidebar: document.getElementById('closeSidebarBtn'),
    overlay: document.getElementById('mobileOverlay'),
    supportBtn: document.getElementById('supportBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    
    stTotal: document.getElementById('stTotal'),
    stL1: document.getElementById('stL1'),
    stL2: document.getElementById('stL2'),
    stL3: document.getElementById('stL3'),
    stActive: document.getElementById('stActive'),
    stInactive: document.getElementById('stInactive'),

    planStatsContainer: document.getElementById('planStatsContainer'),
    
    treeArea: document.getElementById('treeArea'),
    treeRoot: document.getElementById('treeRoot'),
    emptyState: document.getElementById('treeEmptyState'),
    scrollContainer: document.getElementById('treeScrollContainer'),
    
    paginationWrapper: document.getElementById('paginationWrapper'),
    paginationContainer: document.getElementById('paginationContainer'),
    pageInfo: document.getElementById('pageInfo'),
    
    openFilterModalBtn: document.getElementById('openFilterModalBtn'),
    filterBtnText: document.getElementById('filterBtnText'),
    filterModal: document.getElementById('filterModal'),
    filterOptions: document.querySelectorAll('.filter-opt'),
    
    modal: document.getElementById('nodeModal'),
    closeModal: document.getElementById('closeNodeModal'),
    mAvatar: document.getElementById('mAvatar'),
    mStatusDot: document.getElementById('mStatusDot'),
    mName: document.getElementById('mName'),
    mUsername: document.getElementById('mUsername'),
    mLevel: document.getElementById('mLevel'),
    mStatus: document.getElementById('mStatus'),
    mTotalRef: document.getElementById('mTotalRef'),
    mJoinDate: document.getElementById('mJoinDate')
};

// ==========================================
// DYNAMIC FONT SIZER HELPER
// ==========================================
const updateDynamicText = (element, text, defaultClasses = 'text-2xl') => {
    if (!element) return;
    const str = String(text);
    element.textContent = str;
    element.title = str; // Tooltip on hover
    
    element.classList.remove('text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl');
    
    const len = str.length;
    if (len > 8) {
        element.classList.add('text-sm');
    } else if (len > 6) {
        element.classList.add('text-base');
    } else if (len > 4) {
        element.classList.add('text-lg');
    } else {
        defaultClasses.split(' ').forEach(cls => element.classList.add(cls));
    }
};

// Filter Modal Logic
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
        applyFilterAndRender();
    });
});

const initReferralTree = () => {
    loadSupportLink();
    // এই onSnapshot অফলাইন পারসিস্টেন্স এর কারণে ক্যাশ থেকে লোড হবে (0 Read Cost)
    onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
            userData = docSnap.data();
            updateUI(userData);
        }
    });
};

const updateUI = async (data) => {
    const uName = data.fullName || 'User';
    els.avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(uName)}&background=6366F1&color=fff&bold=true`;
    els.avatar.classList.remove('hidden'); els.avatarSkeleton.classList.add('hidden');

    if (data.status === 'Active') {
        els.lockedCard.classList.add('hidden');
        els.activeContent.classList.remove('hidden'); els.activeContent.classList.add('flex');
        
        await fetchTreeData(data); // Call the optimized function
        els.loader.classList.add('hidden');
    } else {
        els.loader.classList.add('hidden');
        els.activeContent.classList.add('hidden'); els.activeContent.classList.remove('flex');
        els.lockedCard.classList.remove('hidden');
    }
};

// ==========================================
// 0 READ COST: MLM TREE LOGIC WITH CACHING
// ==========================================
const fetchTreeData = async (rootData) => {
    const currentRefAmount = rootData.successfulReferrals || 0;
    
    // Check if we have cached tree data for this user
    let cachedData = JSON.parse(sessionStorage.getItem(`treeCache_${rootData.uid}`));
    
    // 0 READ COST LOGIC: 
    if (cachedData && cachedData.totalRefs === currentRefAmount) {
        console.log("Loading MLM Tree from SessionStorage Cache (0 Reads)");
        rootNode = cachedData.tree;
        
        // Rebuild the map for O(1) modal access
        treeDataMap.clear();
        const rebuildMap = (node) => {
            treeDataMap.set(node.uid, node);
            node.children.forEach(child => rebuildMap(child));
        };
        rebuildMap(rootNode);

        updateStats(); 
        renderPlanStats(); 
        renderTree();
        applyFilterAndRender();
        return;
    }

    console.log("Fetching Fresh Tree Data from Firestore");
    treeDataMap.clear();
    
    // Normalize date to string to prevent cache parsing errors later
    const rootJoinDate = rootData.createdAt ? (rootData.createdAt.toDate ? rootData.createdAt.toDate().toISOString() : rootData.createdAt) : null;
    
    rootNode = {
        uid: rootData.uid, fullName: rootData.fullName, username: rootData.username, referralCode: rootData.referralCode,
        profilePhoto: `https://ui-avatars.com/api/?name=${encodeURIComponent(rootData.fullName || 'User')}&background=6366F1&color=fff&bold=true`,
        status: rootData.status, level: 0, joinDate: rootJoinDate, totalReferrals: currentRefAmount, children: [],
        planLevel: rootData.planLevel !== undefined ? rootData.planLevel : (rootData.status === 'Active' ? 1 : 0)
    };
    treeDataMap.set(rootNode.uid, rootNode);

    try {
        // Query L1
        const q1 = query(collection(db, "users"), where("uplineReferralCode", "==", rootData.referralCode));
        const snap1 = await getDocs(q1);
        let l1Uids = [], l1Codes = [];
        snap1.forEach(doc => {
            const data = doc.data(); const node = formatNode(data, 1);
            treeDataMap.set(node.uid, node); rootNode.children.push(node);
            l1Uids.push(node.uid); if(data.referralCode) l1Codes.push(data.referralCode);
        });

        // Query L2
        let l2Codes = [];
        if (l1Codes.length > 0) {
            const chunks = chunkArray(l1Codes, 10);
            for (const chunk of chunks) {
                const q2 = query(collection(db, "users"), where("uplineReferralCode", "in", chunk));
                const snap2 = await getDocs(q2);
                snap2.forEach(doc => {
                    const data = doc.data(); const node = formatNode(data, 2);
                    treeDataMap.set(node.uid, node);
                    const parent = Array.from(treeDataMap.values()).find(p => p.level === 1 && p.referralCode === data.uplineReferralCode);
                    if(parent) parent.children.push(node);
                    if(data.referralCode) l2Codes.push(data.referralCode);
                });
            }
        }

        // Query L3
        if (l2Codes.length > 0) {
            const chunks = chunkArray(l2Codes, 10);
            for (const chunk of chunks) {
                const q3 = query(collection(db, "users"), where("uplineReferralCode", "in", chunk));
                const snap3 = await getDocs(q3);
                snap3.forEach(doc => {
                    const data = doc.data(); const node = formatNode(data, 3);
                    treeDataMap.set(node.uid, node);
                    const parent = Array.from(treeDataMap.values()).find(p => p.level === 2 && p.referralCode === data.uplineReferralCode);
                    if(parent) parent.children.push(node);
                });
            }
        }

        // Save fresh data to Session Storage to prevent future reads
        sessionStorage.setItem(`treeCache_${rootData.uid}`, JSON.stringify({
            totalRefs: currentRefAmount,
            tree: rootNode
        }));

        updateStats(); 
        renderPlanStats(); 
        renderTree();
        applyFilterAndRender();
    } catch (error) { console.error('Error loading referral tree.', error); }
};

const formatNode = (data, level) => {
    return {
        uid: data.uid, fullName: data.fullName, username: data.username, referralCode: data.referralCode,
        profilePhoto: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.fullName || 'User')}&background=6366F1&color=fff&bold=true`,
        status: data.status || 'Inactive', level: level, 
        joinDate: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null,
        totalReferrals: data.successfulReferrals || 0, children: [], uplineCode: data.uplineReferralCode,
        planLevel: data.planLevel !== undefined ? data.planLevel : (data.status === 'Active' ? 1 : 0)
    };
};

const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

const updateStats = () => {
    let stats = { total: 0, l1: 0, l2: 0, l3: 0, active: 0, inactive: 0 };
    Array.from(treeDataMap.values()).forEach(n => {
        if (n.level === 0) return;
        stats.total++;
        if (n.level === 1) stats.l1++; 
        if (n.level === 2) stats.l2++; 
        if (n.level === 3) stats.l3++;
        if (n.status === 'Active') stats.active++; 
        if (n.status === 'Inactive') stats.inactive++;
    });

    updateDynamicText(els.stTotal, stats.total);
    updateDynamicText(els.stL1, stats.l1);
    updateDynamicText(els.stL2, stats.l2);
    updateDynamicText(els.stL3, stats.l3);
    updateDynamicText(els.stActive, stats.active);
    updateDynamicText(els.stInactive, stats.inactive);
};

const renderPlanStats = () => {
    const planCounts = {
        1: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        2: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        3: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };

    Array.from(treeDataMap.values()).forEach(n => {
        if (n.level >= 1 && n.level <= 3 && n.status === 'Active') {
            let pLvl = n.planLevel;
            if (pLvl >= 1 && pLvl <= 5) {
                planCounts[n.level][pLvl]++;
            }
        }
    });

    els.planStatsContainer.innerHTML = '';

    [1, 2, 3].forEach(lvl => {
        const info = LEVEL_INFO[lvl];
        const counts = planCounts[lvl];
        
        let cardsHtml = '';
        [1, 2, 3, 4, 5].forEach(p => {
            const plan = PLAN_INFO[p];
            const count = counts[p];
            const countStr = String(count);
            const colSpan = p === 5 ? 'col-span-2' : 'col-span-1';
            
            let sizeClass = 'text-xl lg:text-2xl';
            if (countStr.length > 8) sizeClass = 'text-sm lg:text-base';
            else if (countStr.length > 6) sizeClass = 'text-base lg:text-lg';
            else if (countStr.length > 4) sizeClass = 'text-lg lg:text-xl';
            
            cardsHtml += `
                <div class="${colSpan} p-3 lg:p-4 rounded-xl border border-gray-700 bg-gray-800/50 flex items-center justify-between hover:shadow-soft transition-all group overflow-hidden gap-2">
                    <div class="flex-1 min-w-0">
                        <p class="text-[9px] lg:text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-1 truncate">${plan.name}</p>
                        <h4 class="${sizeClass} font-black ${plan.color} truncate w-full transition-all duration-300" title="${countStr}">${countStr}</h4>
                    </div>
                    <div class="w-8 h-8 lg:w-10 lg:h-10 rounded-full ${plan.bg} flex items-center justify-center border ${plan.border} group-hover:scale-110 transition-transform shrink-0">
                        <i class="ph ${plan.icon} text-lg lg:text-xl ${plan.color}"></i>
                    </div>
                </div>
            `;
        });

        const blockHtml = `
            <div class="bg-[#111827] rounded-[2rem] p-5 lg:p-6 border border-[#1E293B] shadow-soft flex flex-col h-full hover:border-[#6366F1]/30 transition-colors">
                <div class="flex justify-between items-center mb-5 pb-4 border-b border-[#1E293B]">
                    <h3 class="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2 text-white">
                        <i class="ph ${info.icon} text-[#6366F1] text-xl"></i> ${info.title}
                    </h3>
                    <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/20 shrink-0">${info.bonus}</span>
                </div>
                <div class="grid grid-cols-2 gap-3 flex-1">
                    ${cardsHtml}
                </div>
            </div>
        `;
        els.planStatsContainer.innerHTML += blockHtml;
    });
};

const renderTree = () => {
    els.treeRoot.innerHTML = `<ul>${generateHTML(rootNode)}</ul>`;
    
    document.querySelectorAll('.tree-node').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation(); const uid = el.getAttribute('data-uid'); openNodeModal(uid);
        });
    });
};

const generateHTML = (node) => {
    const isRoot = node.level === 0;
    const badgeColor = node.status === 'Active' ? 'bg-success' : 'bg-danger';
    const borderColor = node.status === 'Active' ? 'border-success' : 'border-danger';
    
    let lvlColor = 'bg-[#6366F1]';
    if(node.level === 1) lvlColor = 'bg-success';
    else if(node.level === 2) lvlColor = 'bg-info';
    else if(node.level === 3) lvlColor = 'bg-purple';

    const levelBadge = isRoot ? 'YOU' : `LVL ${node.level}`;
    
    let html = `<li>
        <div class="tree-node bg-[#1E293B] border border-[#334155] rounded-[1.5rem] p-4 w-44 sm:w-52 text-center relative mx-1 sm:mx-2 group hover:shadow-lg hover:border-[#6366F1]/50 transition-all duration-300 cursor-pointer" data-uid="${node.uid}">
            <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black tracking-widest text-white ${lvlColor} shadow-sm z-10">${levelBadge}</div>
            
            <div class="w-14 h-14 mx-auto rounded-full border-[3px] ${borderColor} p-0.5 mb-3 relative group-hover:scale-105 transition-transform duration-300">
                <img src="${node.profilePhoto}" class="w-full h-full rounded-full object-cover">
                <span class="absolute bottom-0 right-0 w-3.5 h-3.5 ${badgeColor} border-2 border-[#1E293B] rounded-full"></span>
            </div>
            
            <h4 class="font-bold text-sm text-white truncate" title="${node.fullName}">${node.fullName}</h4>
            <p class="text-xs text-[#9CA3AF] font-medium truncate">@${node.username}</p>
            
            ${!isRoot && node.children.length > 0 ? `<div class="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#6366F1] bg-[#6366F1]/10 rounded-lg px-3 py-1.5 inline-flex items-center justify-center gap-1"><i class="ph ph-users-three text-sm"></i> ${node.children.length} Team</div>` : ''}
        </div>`;

    if (node.children.length > 0) html += `<ul>${node.children.map(child => generateHTML(child)).join('')}</ul>`;
    html += `</li>`; return html;
};

const applyFilterAndRender = () => {
    const filter = currentFilterValue;
    
    document.querySelectorAll('.tree-node').forEach(el => {
        const uid = el.getAttribute('data-uid'); const node = treeDataMap.get(uid);
        let matchFilter = true;
        if(filter === 'Active') matchFilter = node.status === 'Active'; 
        else if(filter === 'Inactive') matchFilter = node.status === 'Inactive'; 
        else if(['1','2','3'].includes(filter)) matchFilter = node.level == parseInt(filter);
        
        el.classList.remove('highlight', 'dimmed');
        if (filter !== 'all') { if (matchFilter) el.classList.add('highlight'); else el.classList.add('dimmed'); }
    });

    const branches = document.querySelectorAll('#treeRoot > ul > li > ul > li');
    const totalBranches = rootNode.children ? rootNode.children.length : 0; 

    if (totalBranches === 0) {
        els.treeArea.classList.add('hidden'); els.treeArea.classList.remove('flex'); 
        els.emptyState.classList.remove('hidden'); els.emptyState.classList.add('flex');
        els.paginationWrapper.classList.add('hidden'); els.paginationWrapper.classList.remove('flex');
        return;
    }
    
    els.treeArea.classList.remove('hidden'); els.treeArea.classList.add('flex');
    els.emptyState.classList.add('hidden'); els.emptyState.classList.remove('flex');

    if (totalBranches <= itemsPerPage) {
        els.paginationWrapper.classList.add('hidden'); els.paginationWrapper.classList.remove('flex');
        branches.forEach(b => b.style.display = 'flex');
        
        setTimeout(() => { els.scrollContainer.scrollLeft = (els.scrollContainer.scrollWidth - els.scrollContainer.clientWidth) / 2; }, 100);
        return;
    }

    els.paginationWrapper.classList.remove('hidden'); els.paginationWrapper.classList.add('flex');
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = currentPage * itemsPerPage;

    branches.forEach((b, index) => {
        if (index >= start && index < end) b.style.display = 'flex';
        else b.style.display = 'none';
    });

    renderPagination(totalBranches);
    setTimeout(() => { els.scrollContainer.scrollLeft = (els.scrollContainer.scrollWidth - els.scrollContainer.clientWidth) / 2; }, 100);
};

const renderPagination = (totalItems) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    els.pageInfo.textContent = `Showing Level 1 Branches: ${(currentPage - 1) * itemsPerPage + 1} to ${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems}`;
    
    let html = `<button data-page="${currentPage - 1}" class="page-btn w-9 h-9 flex items-center justify-center rounded-xl border border-[#334155] bg-[#111827] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors" ${currentPage === 1 ? 'disabled' : ''}><i class="ph ph-caret-left"></i></button>`;
    
    for(let i=1; i<=totalPages; i++) {
        if(i === currentPage) {
            html += `<button class="w-9 h-9 flex items-center justify-center rounded-xl bg-[#6366F1] text-white font-black shadow-glow">${i}</button>`;
        } else {
            html += `<button data-page="${i}" class="page-btn w-9 h-9 flex items-center justify-center rounded-xl border border-[#334155] bg-[#111827] text-[#9CA3AF] hover:text-white hover:bg-gray-800 transition-colors font-bold">${i}</button>`;
        }
    }
    
    html += `<button data-page="${currentPage + 1}" class="page-btn w-9 h-9 flex items-center justify-center rounded-xl border border-[#334155] bg-[#111827] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors" ${currentPage === totalPages ? 'disabled' : ''}><i class="ph ph-caret-right"></i></button>`;
    
    els.paginationContainer.innerHTML = html;
    
    els.paginationContainer.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const p = parseInt(btn.getAttribute('data-page'));
            if(p && p !== currentPage && p >= 1 && p <= totalPages) {
                currentPage = p;
                applyFilterAndRender();
            }
        });
    });
};

const openNodeModal = (uid) => {
    const node = treeDataMap.get(uid); if(!node) return;
    els.mAvatar.src = node.profilePhoto;
    els.mStatusDot.className = `absolute bottom-1 right-1 w-5 h-5 rounded-full border-[2px] border-gray-800 ${node.status === 'Active' ? 'bg-success' : 'bg-danger'}`;
    els.mName.textContent = node.fullName; els.mUsername.textContent = `@${node.username}`;
    els.mLevel.textContent = node.level === 0 ? "You (Root)" : `Level ${node.level}`;
    
    els.mStatus.textContent = node.status;
    els.mStatus.className = `font-bold px-3 py-1 rounded-lg text-xs uppercase tracking-wider ${node.status === 'Active' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`;
    
    els.mTotalRef.textContent = node.children ? node.children.length : 0;
    els.mJoinDate.textContent = node.joinDate ? new Date(node.joinDate).toLocaleDateString() : 'N/A'; // Fixed Date parsing for Cache

    els.modal.classList.remove('hidden'); els.modal.classList.add('flex');
};

els.closeModal.addEventListener('click', () => {
    els.modal.classList.add('hidden'); els.modal.classList.remove('flex');
});

const loadSupportLink = async () => {
    try {
        const docSnap = await getDoc(doc(db, "settings", "general"));
        if (docSnap.exists() && docSnap.data().telegramSupportLink) els.supportBtn.href = docSnap.data().telegramSupportLink;
    } catch (e) {}
};

const toggleSidebar = () => {
    els.sidebar.classList.toggle('-translate-x-full'); els.overlay.classList.toggle('hidden');
    setTimeout(() => els.overlay.classList.toggle('opacity-0'), 10);
};
els.openSidebar.addEventListener('click', toggleSidebar);
els.closeSidebar.addEventListener('click', toggleSidebar);
els.overlay.addEventListener('click', toggleSidebar);

// Clear Session on Logout
els.logoutBtn.addEventListener('click', async () => {
    sessionStorage.removeItem(`treeCache_${currentUser.uid}`);
    await signOut(auth);
});