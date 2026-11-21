// The Database class from our class diagram.
// It is the one place in our code that reads from and writes to Firebase.
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  doc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { db } from "./firebase.js";

export class Database {
  // Saves a new document in a collection, e.g. "users/abc/exercises". Returns its new ID.
  static async save(path, data) {
    const result = await addDoc(collection(db, path), data);
    return result.id;
  }

  // Saves several new documents in a collection in one go. Returns their new IDs.
  static async saveMany(path, list) {
    const batch = writeBatch(db);
    const refs = list.map((data) => {
      const ref = doc(collection(db, path)); // a new document, with a new ID
      batch.set(ref, data);
      return ref;
    });
    await batch.commit();
    return refs.map((ref) => ref.id);
  }

  // Returns every document in a collection, each with its ID added.
  static async getAll(path) {
    const snapshot = await getDocs(collection(db, path));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // Returns one document, e.g. "users/abc/settings/plan", or null if it does not exist.
  static async get(path) {
    const snapshot = await getDoc(doc(db, path));
    return snapshot.exists() ? snapshot.data() : null;
  }

  // Saves one document at a fixed place, e.g. "users/abc/settings/plan".
  static async set(path, data) {
    await setDoc(doc(db, path), data);
  }

  // Deletes one document, e.g. "users/abc/exercises/xyz".
  static async delete(path) {
    await deleteDoc(doc(db, path));
  }

  // Changes and deletes several documents in one go: either every change is saved
  // or none is, so a lost connection halfway cannot leave things half changed.
  // updates is a list of [path, data]. (Firestore allows up to 500 changes at once.)
  static async saveAll(updates, deletes = []) {
    const batch = writeBatch(db);
    updates.forEach(([path, data]) => batch.update(doc(db, path), data));
    deletes.forEach((path) => batch.delete(doc(db, path)));
    await batch.commit();
  }
}
