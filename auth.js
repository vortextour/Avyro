import { auth } from './firebase.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendEmailVerification, 
    sendPasswordResetEmail, // New Import for Forgot Password
    signOut, 
    setPersistence, 
    browserLocalPersistence, 
    browserSessionPersistence 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================
// LOGIN FUNCTIONS
// ==========================================
export const loginUser = async (email, password, rememberMe) => {
    try {
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { user: userCredential.user, error: null };
    } catch (error) {
        return { user: null, error: handleAuthError(error.code) };
    }
};

// ==========================================
// REGISTER FUNCTIONS
// ==========================================
export const createAuthUser = async (email, password) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return { user: userCredential.user, error: null };
    } catch (error) {
        return { user: null, error: handleAuthError(error.code) };
    }
};

// ==========================================
// FORGOT PASSWORD / RESET FUNCTIONS
// ==========================================
export const resetPassword = async (email) => {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true, error: null };
    } catch (error) {
        return { success: false, error: handleAuthError(error.code) };
    }
};

// ==========================================
// COMMON AUTH FUNCTIONS
// ==========================================
export const sendVerification = async (user) => {
    try {
        await sendEmailVerification(user);
        return { success: true, error: null };
    } catch (error) {
        return { success: false, error: handleAuthError(error.code) };
    }
};

export const resendVerification = sendVerification;

export const logoutUser = async () => {
    try {
        await signOut(auth);
        return { success: true, error: null };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// ==========================================
// CENTRALIZED ERROR HANDLING
// ==========================================
const handleAuthError = (errorCode) => {
    switch (errorCode) {
        // Login Specific Errors
        case 'auth/user-not-found': return 'No account found with this email.';
        case 'auth/wrong-password': return 'Incorrect password.';
        case 'auth/invalid-credential': return 'Invalid credentials provided.';
        
        // Registration Specific Errors
        case 'auth/email-already-in-use': return 'Email is already registered. Please login.';
        case 'auth/weak-password': return 'Password is too weak. Must be at least 8 characters.';
        
        // Reset Password Specific Errors
        case 'auth/missing-email': return 'Please provide an email address.';
        
        // Shared / Common Errors
        case 'auth/invalid-email': return 'Invalid email format.';
        case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
        case 'auth/network-request-failed': return 'Network error. Please check your internet connection.';
        
        default: return 'An unexpected error occurred. Please try again.';
    }
};