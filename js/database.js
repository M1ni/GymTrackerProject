// The Database class from our class diagram.
// It is the one place in our code that reads from and writes to Firebase.
//
// It also keeps a copy of what it reads in this browser (localStorage). Then the next page
// can show your data at once, and checks Firebase for changes in the background
// (for example from your phone). The copy is deleted when you log out.
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  doc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore-lite.js";
import { db } from "./firebase.js";

// ---------- The copy in this browser ----------

const PREFIX = "gymtrack-copy:";
const checked = new Set(); // what has been checked with Firebase since this page opened
const checking = []; // checks still running
let saves = 0; // changes saved since this page opened
let onNewData = () => {};
let onNoConnection = () => {};

// Requests to Firebase wait until the page has checked who is logged in (see loggedIn).
// That lets a page show the copy straight away, without waiting for the login check.
let openGate;
let loginChecked = new Promise((resolve) => {
  openGate = resolve;
});

// The copy of a collection (a list of documents) or of one document.
// undefined means there is no copy yet; null means the document does not exist.
function readCopy(path) {
  try {
    const text = localStorage.getItem(PREFIX + path);
    return text === null ? undefined : JSON.parse(text);
  } catch (error) {
    return undefined;
  }
}

function saveCopy(path, value) {
  try {
    localStorage.setItem(PREFIX + path, JSON.stringify(value));
  } catch (error) {
    // The browser's storage is full or turned off. The copy is only a help, so carry on.
  }
}

// True if two copies hold the same data, whatever order the documents or fields are in
function sameData(a, b) {
  const sortKeys = (value) => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
    }
    return value;
  };
  const tidy = (data) => JSON.stringify(sortKeys(Array.isArray(data) ? [...data].sort((x, y) => x.id.localeCompare(y.id)) : data));
  return tidy(a) === tidy(b);
}

// Asks Firebase for the real data in the background. If it is different from the copy
// the page showed, the copy is updated and the page is told to show the new data.
function checkLater(path, fetchFresh, copy) {
  if (checked.has(path)) {
    return;
  }
  checked.add(path);
  const savesBefore = saves;
  checking.push(fetchFresh()
    .then((fresh) => {
      // If something was saved meanwhile, the copy already has it: keep the copy
      if (saves !== savesBefore || sameData(fresh, copy)) {
        return;
      }
      saveCopy(path, fresh);
      onNewData(path);
    })
    .catch(() => onNoConnection()));
}

// Keeps the copy up to date after a change has been saved to Firebase.
// change is { set: data }, { update: data } or { remove: true }
function changeCopy(path, change) {
  saves++;
  const parts = path.split("/");
  const id = parts.pop();
  const parent = parts.join("/");

  // The copy of the collection the document is in
  const rows = readCopy(parent);
  if (rows) {
    const old = rows.find((row) => row.id === id);
    const others = rows.filter((row) => row.id !== id);
    if (change.set) {
      saveCopy(parent, [...others, { id, ...change.set }]);
    } else if (change.update && old) {
      saveCopy(parent, [...others, { ...old, ...change.update }]);
    } else if (change.remove) {
      saveCopy(parent, others);
    }
  }

  // The copy of the document itself
  if (change.set) {
    saveCopy(path, change.set);
  } else if (change.remove) {
    saveCopy(path, null);
  } else if (change.update && readCopy(path)) {
    saveCopy(path, { ...readCopy(path), ...change.update });
  }
}

async function fetchAll(path) {
  await loginChecked;
  const snapshot = await getDocs(collection(db, path));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function fetchOne(path) {
  await loginChecked;
  const snapshot = await getDoc(doc(db, path));
  return snapshot.exists() ? snapshot.data() : null;
}

export class Database {
  // Saves a new document in a collection, e.g. "users/abc/exercises". Returns its new ID.
  static async save(path, data) {
    await loginChecked;
    const result = await addDoc(collection(db, path), data);
    changeCopy(`${path}/${result.id}`, { set: data });
    return result.id;
  }

  // Saves several new documents in a collection in one go. Returns their new IDs.
  static async saveMany(path, list) {
    await loginChecked;
    const batch = writeBatch(db);
    const refs = list.map((data) => {
      const ref = doc(collection(db, path)); // a new document, with a new ID
      batch.set(ref, data);
      return ref;
    });
    await batch.commit();
    refs.forEach((ref, i) => changeCopy(`${path}/${ref.id}`, { set: list[i] }));
    return refs.map((ref) => ref.id);
  }

  // Returns every document in a collection, each with its ID added.
  // If this browser has a copy, that comes back at once and Firebase is checked in the background.
  static async getAll(path) {
    const copy = readCopy(path);
    if (copy !== undefined) {
      checkLater(path, () => fetchAll(path), copy);
      return copy;
    }
    const rows = await fetchAll(path);
    saveCopy(path, rows);
    checked.add(path);
    return rows;
  }

  // Returns one document, e.g. "users/abc/settings/plan", or null if it does not exist.
  // Uses the copy in this browser the same way as getAll.
  static async get(path) {
    const copy = readCopy(path);
    if (copy !== undefined) {
      checkLater(path, () => fetchOne(path), copy);
      return copy;
    }
    const data = await fetchOne(path);
    saveCopy(path, data);
    checked.add(path);
    return data;
  }

  // Saves one document at a fixed place, e.g. "users/abc/settings/plan".
  static async set(path, data) {
    await loginChecked;
    await setDoc(doc(db, path), data);
    changeCopy(path, { set: data });
  }

  // Deletes one document, e.g. "users/abc/exercises/xyz".
  static async delete(path) {
    await loginChecked;
    await deleteDoc(doc(db, path));
    changeCopy(path, { remove: true });
  }

  // Changes and deletes several documents in one go: either every change is saved
  // or none is, so a lost connection halfway cannot leave things half changed.
  // updates is a list of [path, data]. (Firestore allows up to 500 changes at once.)
  static async saveAll(updates, deletes = []) {
    await loginChecked;
    const batch = writeBatch(db);
    updates.forEach(([path, data]) => batch.update(doc(db, path), data));
    deletes.forEach((path) => batch.delete(doc(db, path)));
    await batch.commit();
    updates.forEach(([path, data]) => changeCopy(path, { update: data }));
    deletes.forEach((path) => changeCopy(path, { remove: true }));
  }

  // Called once Firebase has confirmed who is logged in: requests can go out now.
  static loggedIn() {
    openGate();
  }

  // Who the copy in this browser belongs to ({ uid, email }), or null if there is no copy.
  static copyOwner() {
    return readCopy("owner") ?? null;
  }

  static setCopyOwner(user) {
    saveCopy("owner", { uid: user.uid, email: user.email });
  }

  // Runs callback when the background check finds newer data than the copy that was shown.
  static whenNewData(callback) {
    onNewData = callback;
  }

  // Runs callback when the background check cannot reach Firebase.
  static whenNoConnection(callback) {
    onNoConnection = callback;
  }

  // Deletes the copy in this browser (when you log out).
  static forgetCopy() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key.startsWith(PREFIX)) localStorage.removeItem(key);
      }
    } catch (error) {
      // Storage turned off: there is no copy to delete
    }
  }

  // Waits for the background checks to finish (used by the tests).
  static async settled() {
    await Promise.all(checking);
  }

  // Starts again as if a new page had opened (used by the tests, which act like many pages).
  static async reset() {
    await Promise.all(checking);
    checking.length = 0;
    checked.clear();
    saves = 0;
    onNewData = () => {};
    onNoConnection = () => {};
    loginChecked = Promise.resolve();
  }
}
