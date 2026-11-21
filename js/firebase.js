// Connects the website to our Firebase project.
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
// Firestore Lite: a smaller, faster version for apps that read and save, like ours
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore-lite.js";
import { firebaseConfig } from "./firebase-config.js";

// False until the real values are pasted into firebase-config.js.
export const isConfigured = firebaseConfig.apiKey !== "PASTE_HERE";

const app = initializeApp(firebaseConfig);
// initializeAuth instead of getAuth: we only log in with email and password, and getAuth
// also loads Google's sign-in scripts on phones (about 0.3 s on every page).
// The login is kept in the same places as before, so nobody is logged out by this.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
});
export const db = getFirestore(app);
