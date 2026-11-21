// Connects the website to our Firebase project.
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
// Firestore Lite: a smaller, faster version for apps that read and save, like ours
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore-lite.js";
import { firebaseConfig } from "./firebase-config.js";

// False until the real values are pasted into firebase-config.js.
export const isConfigured = firebaseConfig.apiKey !== "PASTE_HERE";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
