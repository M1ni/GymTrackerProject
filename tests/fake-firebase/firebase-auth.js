// Stand-in for Firebase Authentication, used only by the tests.
import { load, save, fbError } from "./store.js";

const listeners = [];
const auth = { currentUser: null };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const validEmail = (email) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

function loggedInUser() {
  const state = load();
  const account = Object.values(state.accounts).find((a) => a.uid === state.current);
  return account ? { uid: account.uid, email: account.email } : null;
}

function tellListeners() {
  auth.currentUser = loggedInUser();
  listeners.forEach((callback) => callback(auth.currentUser));
}

export function getAuth() {
  auth.currentUser = loggedInUser();
  return auth;
}

export async function createUserWithEmailAndPassword(_auth, email, password) {
  await wait(30);
  if (!validEmail(email)) throw fbError("auth/invalid-email");
  if (!password) throw fbError("auth/missing-password");
  if (password.length < 6) throw fbError("auth/weak-password");
  const state = load();
  if (state.accounts[email.toLowerCase()]) throw fbError("auth/email-already-in-use");
  const uid = "user-" + Math.random().toString(36).slice(2, 10);
  state.accounts[email.toLowerCase()] = { uid, email, password };
  state.current = uid;
  save(state);
  setTimeout(tellListeners, 0);
  return { user: { uid, email } };
}

export async function signInWithEmailAndPassword(_auth, email, password) {
  await wait(30);
  if (!validEmail(email)) throw fbError("auth/invalid-email");
  if (!password) throw fbError("auth/missing-password");
  const state = load();
  const account = state.accounts[email.toLowerCase()];
  // Like the real one: the same error for a wrong password and an unknown email
  if (!account || account.password !== password) throw fbError("auth/invalid-credential");
  state.current = account.uid;
  save(state);
  setTimeout(tellListeners, 0);
  return { user: { uid: account.uid, email: account.email } };
}

export async function signOut() {
  await wait(30);
  const state = load();
  state.current = null;
  save(state);
  setTimeout(tellListeners, 0);
}

// Like the real one, it does not say whether the email has an account.
export async function sendPasswordResetEmail(_auth, email) {
  await wait(30);
  if (!email) throw fbError("auth/missing-email");
  if (!validEmail(email)) throw fbError("auth/invalid-email");
  const state = load();
  state.resetEmails.push(email);
  save(state);
}

export function onAuthStateChanged(_auth, callback) {
  listeners.push(callback);
  // Like the real one, the first call comes a moment later, once the saved login is checked
  setTimeout(() => callback(loggedInUser()), 50);
  return () => listeners.splice(listeners.indexOf(callback), 1);
}
