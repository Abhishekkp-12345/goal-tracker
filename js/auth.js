'use strict';

// ── Auth Module ──────────────────────────────────────────────────────
// Employees  → self-register freely (email/password or Google)
// Managers   → need the Manager Access Code to register or login
// Admins     → need the Admin Access Code to register or login

// ── 🔐 SECRET ACCESS CODES ────────────────────────────────────────────
// Change these to your own secret codes before deployment!
const ACCESS_CODES = {
  admin:   'ADMIN@TRACK26',
  manager: 'MGR@TRACK26',
};


const Auth = {

  // ── Access Code Validation ─────────────────────────────────────────
  validateCode(role, code) {
    if (role === 'employee') return true;               // employees don't need a code
    const expected = ACCESS_CODES[role];
    if (!expected) return false;
    return code && code.trim() === expected;
  },

  // ── Privileged Login (Admin / Manager) ────────────────────────────
  async loginWithCode(email, password, role, code) {
    if (!Auth.validateCode(role, code)) {
      return { ok: false, error: 'Invalid access code. Please check and try again.' };
    }
    const res = await Auth.login(email, password);
    if (!res.ok) return res;
    // Confirm the Firebase account actually has this role
    if (res.user.role !== role) {
      Auth.logout();
      return { ok: false, error: `This account is not registered as ${role}.` };
    }
    return res;
  },

  // ── Privileged Register (Admin / Manager) ─────────────────────────
  async registerWithCode(name, email, password, role, code) {
    if (!Auth.validateCode(role, code)) {
      return { ok: false, error: 'Invalid access code. Contact your administrator.' };
    }
    return Auth.register(name, email, password, role);
  },

  // ── Email / Password Registration ─────────────────────────────────

  async register(name, email, password, role) {
    try {
      const cred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });

      // Build the local user record
      const user = {
        id: cred.user.uid,
        name: name,
        email: email,
        role: role || 'employee',
        department: '',
        designation: '',
        managerId: null,
        photoURL: cred.user.photoURL || null,
        provider: 'email'
      };
      DB.saveUser(user);
      DB.setSession(user);
      return { ok: true, user };
    } catch (err) {
      return { ok: false, error: Auth._fbError(err) };
    }
  },

  // ── Email / Password Login ─────────────────────────────────────────
  async login(email, password) {
    // ── Step 1: Check local DB first (handles seeded demo accounts) ──
    const localUser = DB.getUserByEmail(email);
    if (localUser && localUser.password && localUser.password === password) {
      // Local match — no Firebase needed for demo/seeded accounts
      DB.setSession(localUser);
      return { ok: true, user: localUser };
    }

    // ── Step 2: Try Firebase (for real registered accounts) ──
    try {
      const cred = await firebaseAuth.signInWithEmailAndPassword(email, password);
      let user = DB.getUserByEmail(email);
      if (!user) {
        // First login after manual DB reset — re-create from Firebase
        user = {
          id: cred.user.uid,
          name: cred.user.displayName || email.split('@')[0],
          email: email,
          role: 'employee',
          department: '',
          designation: '',
          managerId: null,
          photoURL: cred.user.photoURL || null,
          provider: 'email'
        };
        DB.saveUser(user);
      }
      DB.setSession(user);
      return { ok: true, user };
    } catch (err) {
      // If Firebase says user not found but local user exists with wrong password
      if (localUser && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials')) {
        return { ok: false, error: 'Incorrect password. Please try again.' };
      }
      return { ok: false, error: Auth._fbError(err) };
    }
  },

  // ── Google Sign-In (popup → redirect fallback) ─────────────────────
  async loginWithGoogle() {
    try {
      // Try popup first (works on most browsers)
      const result = await firebaseAuth.signInWithPopup(googleProvider);
      return Auth._handleGoogleUser(result.user);
    } catch (err) {
      // Domain not whitelisted in Firebase Console
      if (err.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        return { ok: false, error: `This domain (${domain}) is not authorised for Google Sign-In. Add it in Firebase Console → Authentication → Settings → Authorized Domains.` };
      }
      // If popup blocked, fall back to redirect
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-cancelled-by-user') {
        try {
          await firebaseAuth.signInWithRedirect(googleProvider);
          return { ok: false, error: '' }; // page will redirect
        } catch (redirErr) {
          return { ok: false, error: Auth._fbError(redirErr) };
        }
      }
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return { ok: false, error: 'Sign-in cancelled. Please try again.' };
      }
      return { ok: false, error: Auth._fbError(err) };
    }
  },

  // Called on page load to handle redirect result
  async handleRedirectResult() {
    try {
      const result = await firebaseAuth.getRedirectResult();
      if (result && result.user) {
        return Auth._handleGoogleUser(result.user);
      }
      return null;
    } catch (err) {
      console.warn('Redirect result error:', err.code);
      return null;
    }
  },

  _handleGoogleUser(fbUser) {
    let existing = DB.getUserByEmail(fbUser.email);
    if (!existing) {
      existing = {
        id: fbUser.uid,
        name: fbUser.displayName || fbUser.email.split('@')[0],
        email: fbUser.email,
        role: 'employee',
        department: '',
        designation: '',
        managerId: null,
        photoURL: fbUser.photoURL || null,
        provider: 'google'
      };
      DB.saveUser(existing);
    } else {
      if (!existing.photoURL && fbUser.photoURL) {
        existing.photoURL = fbUser.photoURL;
        DB.saveUser(existing);
      }
    }
    DB.setSession(existing);
    return { ok: true, user: existing };
  },

  // ── Logout ─────────────────────────────────────────────────────────
  async logout() {
    try { await firebaseAuth.signOut(); } catch (_) {}
    DB.clearSession();
    window.location.hash = '#/login';
  },

  // ── Helpers ────────────────────────────────────────────────────────
  getUser() {
    return DB.getSession();
  },

  require(roles) {
    const u = this.getUser();
    if (!u) { window.location.hash = '#/login'; return null; }
    if (roles && !roles.includes(u.role)) { window.location.hash = '#/login'; return null; }
    return u;
  },

  _fbError(err) {
    // Always log full error to console for debugging
    console.error('[Firebase Auth Error]', err.code, err.message);
    const map = {
      'auth/email-already-in-use':    'An account with this email already exists.',
      'auth/invalid-email':            'Please enter a valid email address.',
      'auth/weak-password':            'Password must be at least 6 characters.',
      'auth/user-not-found':           'No account found with this email.',
      'auth/wrong-password':           'Incorrect password. Please try again.',
      'auth/invalid-credential':       'Incorrect email or password. Please try again.',
      'auth/too-many-requests':        'Too many failed attempts. Try again later.',
      'auth/network-request-failed':   'Network error. Check your connection.',
      'auth/popup-blocked':            'Popup blocked by browser. Allow popups and try again.',
      'auth/user-disabled':            'This account has been disabled.',
      'auth/operation-not-allowed':    'This sign-in method is not enabled.',
      'auth/email-already-exists':     'An account with this email already exists.',
      'auth/invalid-login-credentials':'Incorrect email or password. Please try again.',
      'auth/unauthorized-domain':      'This domain is not authorised for Google Sign-In. Contact the administrator.',
      'auth/internal-error':           'An internal error occurred. Please try again.',
    };
    return map[err.code] || `${err.message} (${err.code})`;
  }
};
