'use strict';

// ── GoalTrack Firebase Configuration ─────────────────────────────────
// Project: goaltrack-portal  |  SDK: v12.13.0 (compat mode)
const firebaseConfig = {
  apiKey:            "AIzaSyBCYY7t3bnamT3xbblhopH6nihQVjI_C8w",
  authDomain:        "goaltrack-portal.firebaseapp.com",
  projectId:         "goaltrack-portal",
  storageBucket:     "goaltrack-portal.firebasestorage.app",
  messagingSenderId: "564680676209",
  appId:             "1:564680676209:web:4c0e0ef570c96a9323dcd0",
  measurementId:     "G-Z4R4WEW2P5"
};

// Initialize Firebase (compat mode — works with auth.js)
firebase.initializeApp(firebaseConfig);

// Analytics (optional — fires only in browser)
if (typeof firebase.analytics === 'function') {
  firebase.analytics();
}

// Auth + Google Provider
const firebaseAuth   = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

// NOTE: Do NOT pass client_id here — Firebase Auth manages its own OAuth
// client internally. Only pass UI-level hints like `prompt`.
googleProvider.setCustomParameters({
  prompt: 'select_account'   // always show the Google account picker
});
