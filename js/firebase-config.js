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

// Use the custom OAuth 2.0 client created for this project
googleProvider.setCustomParameters({
  client_id: '564680676209-2799t2evgvrd1a9td068vl316r7h24m1.apps.googleusercontent.com',
  prompt: 'select_account'   // always show account picker
});
