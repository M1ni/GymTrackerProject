// The Database class from our class diagram.
// It is the one place in our code that reads from and writes to Firebase.
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { db } from "./firebase.js";

export class Database {
  // Saves a new document in a collection, e.g. "users/abc/exercises". Returns its new ID.
  static async save(path, data) {
    const result = await addDoc(collection(db, path), data);
    return result.id;
  }

  // Returns every document in a collection, each with its ID added.
  static async getAll(path) {
    const snapshot = await getDocs(collection(db, path));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // Deletes one document, e.g. "users/abc/exercises/xyz".
  static async delete(path) {
    await deleteDoc(doc(db, path));
  }
}
