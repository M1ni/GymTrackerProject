// The User class from our class diagram (F1: register, log in, log out).
// Firebase Authentication checks and stores the passwords, so we never store them (NFR4).
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { auth } from "./firebase.js";
import { Database } from "./database.js";

export class User {
  constructor(uid, email) {
    this.uid = uid;
    this.email = email;
  }

  // FR1: create a new account.
  static async register(email, password) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return new User(result.user.uid, result.user.email);
  }

  // FR2: log in to an existing account.
  static async logIn(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return new User(result.user.uid, result.user.email);
  }

  // FR2: log out. The copy of your data in this browser is deleted too.
  static async logOut() {
    await signOut(auth);
    Database.forgetCopy();
  }

  // Forgot password: Firebase emails a link where you choose a new password.
  // Firebase does not say if the email has an account, so nobody can use this
  // to find out who uses GymTrack.
  static async resetPassword(email) {
    await sendPasswordResetEmail(auth, email);
  }

  // Calls whenChecked with the logged-in User, or null if nobody is logged in.
  static watch(whenChecked) {
    onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        whenChecked(new User(firebaseUser.uid, firebaseUser.email));
      } else {
        // Nobody is logged in (logged out, maybe in another tab): no copy of anyone's data stays
        Database.forgetCopy();
        whenChecked(null);
      }
    });
  }
}

// Turns Firebase error codes into messages a user can understand.
export function friendlyError(error) {
  const messages = {
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "Wrong email or password.",
    "auth/email-already-in-use": "An account with this email already exists. Try logging in.",
    "auth/weak-password": "The password must be at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/missing-password": "Please enter your password.",
    "auth/missing-email": "Please enter your email address.",
    "auth/user-disabled": "This account has been turned off. Please contact us.",
    "auth/too-many-requests": "Too many attempts. Please wait a minute and try again.",
    "auth/network-request-failed": "No internet connection. Please try again."
  };
  return messages[error.code] || "Something went wrong. Please try again.";
}
