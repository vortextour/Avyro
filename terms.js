import { auth, db } from './firebase.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        currentUser = user;
        initTermsPage();
    }
});

// UI Elements
const els = {
    loader: document.getElementById('pageLoader'),
    content: document.getElementById('termsContainer'),
    
    // Header & Nav
    avatar: document.getElementById('headerAvatar'),
    avatarSkeleton: document.getElementById('headerAvatarSkeleton'),
    sidebar: document.getElementById('sidebar'),
    openSidebar: document.getElementById('openSidebarBtn'),
    closeSidebar: document.getElementById('closeSidebarBtn'),
    overlay: document.getElementById('mobileOverlay'),
    logoutBtn: document.getElementById('logoutBtn'),
    
    // Scroll tracking
    scrollArea: document.getElementById('scrollArea')
};

const initTermsPage = () => {
    loadUserProfile();
    
    // As the content is static now, just hide loader and show content
    setTimeout(() => {
        els.loader.classList.add('hidden');
        els.content.classList.remove('hidden');
        els.content.classList.add('flex');
        initScrollSpy();
    }, 500);
};

// 1. Load User Profile
const loadUserProfile = () => {
    onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
            const uName = docSnap.data().fullName || 'User';
            els.avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(uName)}&background=6366F1&color=fff&bold=true`;
            els.avatar.classList.remove('hidden');
            els.avatarSkeleton.classList.add('hidden');
        }
    });
};

// 2. ScrollSpy Logic (Highlights active TOC item)
const initScrollSpy = () => {
    const sections = document.querySelectorAll('.terms-section');
    const tocLinks = document.querySelectorAll('.toc-link');
    
    if (!sections.length) return;
    
    const observerOptions = {
        root: els.scrollArea,
        rootMargin: '0px 0px -60% 0px',
        threshold: 0
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                tocLinks.forEach(link => {
                    link.classList.remove('bg-[#6366F1]/10', 'text-[#818CF8]', 'border-[#6366F1]', 'font-bold');
                    link.classList.add('border-transparent');
                });
                
                const activeLink = document.querySelector(`.toc-link[href="#${id}"]`);
                if (activeLink) {
                    activeLink.classList.remove('border-transparent');
                    activeLink.classList.add('bg-[#6366F1]/10', 'text-[#818CF8]', 'border-[#6366F1]', 'font-bold');
                }
            }
        });
    }, observerOptions);
    
    sections.forEach(sec => observer.observe(sec));
    
    // Smooth scroll for TOC links
    tocLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                const topPos = targetElement.offsetTop - els.scrollArea.offsetTop;
                els.scrollArea.scrollTo({ top: topPos - 40, behavior: 'smooth' });
            }
        });
    });
};

// Sidebar Controls
const toggleSidebar = () => {
    els.sidebar.classList.toggle('-translate-x-full');
    els.overlay.classList.toggle('hidden');
    setTimeout(() => els.overlay.classList.toggle('opacity-0'), 10);
};
els.openSidebar.addEventListener('click', toggleSidebar);
els.closeSidebar.addEventListener('click', toggleSidebar);
els.overlay.addEventListener('click', toggleSidebar);

// Logout
els.logoutBtn.addEventListener('click', async () => await signOut(auth));