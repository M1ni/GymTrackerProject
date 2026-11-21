// Stand-in for Cloud Firestore, used only by the tests.
// Like our firestore.rules, it only lets you use your own users/{uid}/... documents.
// It is a little stricter than the real one: it also refuses NaN, which is always a bug here.
import { load, save, fbError } from "./store.js";

const wait = () => new Promise((resolve) => setTimeout(resolve, 20));
const copy = (data) => JSON.parse(JSON.stringify(data));

export function getFirestore(app) {
  return { app };
}

function cleanPath(path, isDocument) {
  const parts = path.split("/").filter((p) => p !== "");
  if ((parts.length % 2 === 0) !== isDocument) {
    throw new Error(`Not a ${isDocument ? "document" : "collection"} path: ${path}`);
  }
  if (parts.includes("undefined") || parts.includes("null")) {
    throw new Error(`Broken path: ${path}`);
  }
  return parts.join("/");
}

export function collection(_db, path) {
  return { path: cleanPath(path, false) };
}

// doc(db, "users/abc/settings/plan"), or doc(collectionRef) for a new document with a new ID
export function doc(parent, path) {
  if (path === undefined) {
    const state = load();
    const id = "doc" + String(state.nextId++).padStart(4, "0");
    save(state);
    return { path: `${parent.path}/${id}`, id };
  }
  const clean = cleanPath(path, true);
  return { path: clean, id: clean.split("/").pop() };
}

// The same rule as firestore.rules, plus the "offline" switch
function check(state, path) {
  if (state.offline) {
    throw fbError("unavailable", "Failed to get document because the client is offline.");
  }
  const [users, uid] = path.split("/");
  if (!state.current || users !== "users" || uid !== state.current) {
    throw fbError("permission-denied", "Missing or insufficient permissions.");
  }
}

// Firestore refuses undefined and class objects (they must be turned into plain objects)
function checkData(value, where = "data") {
  if (value === undefined) {
    throw fbError("invalid-argument", `Unsupported field value: undefined (in ${where})`);
  }
  if (typeof value === "number" && Number.isNaN(value)) {
    throw fbError("invalid-argument", `NaN (in ${where})`);
  }
  if (value !== null && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) {
      throw fbError("invalid-argument", `Unsupported field value: a custom ${value.constructor.name} object (in ${where})`);
    }
    Object.entries(value).forEach(([key, inner]) => checkData(inner, `${where}.${key}`));
  }
}

export async function addDoc(colRef, data) {
  await wait();
  const state = load();
  check(state, colRef.path);
  checkData(data);
  const id = "doc" + String(state.nextId++).padStart(4, "0");
  state.docs[`${colRef.path}/${id}`] = copy(data);
  state.calls.push(["add", colRef.path]);
  save(state);
  return { id };
}

export async function getDocs(colRef) {
  await wait();
  const state = load();
  check(state, colRef.path);
  const prefix = colRef.path + "/";
  const docs = Object.keys(state.docs)
    .filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
    .map((path) => ({ id: path.slice(prefix.length), data: () => copy(state.docs[path]) }));
  return { docs };
}

export async function getDoc(docRef) {
  await wait();
  const state = load();
  check(state, docRef.path);
  const data = state.docs[docRef.path];
  return { id: docRef.id, exists: () => data !== undefined, data: () => (data === undefined ? undefined : copy(data)) };
}

export async function setDoc(docRef, data) {
  await wait();
  const state = load();
  check(state, docRef.path);
  checkData(data);
  state.docs[docRef.path] = copy(data);
  state.calls.push(["set", docRef.path]);
  save(state);
}

export async function deleteDoc(docRef) {
  await wait();
  const state = load();
  check(state, docRef.path);
  delete state.docs[docRef.path];
  state.calls.push(["delete", docRef.path]);
  save(state);
}

// A batch saves all of its changes at once, or none of them
export function writeBatch() {
  const changes = [];
  return {
    set(docRef, data) {
      changes.push({ type: "set", path: docRef.path, data });
      return this;
    },
    update(docRef, data) {
      changes.push({ type: "update", path: docRef.path, data });
      return this;
    },
    delete(docRef) {
      changes.push({ type: "delete", path: docRef.path });
      return this;
    },
    async commit() {
      await wait();
      const state = load();
      // Check every change first, so nothing is saved if one of them is not allowed
      changes.forEach((change) => {
        check(state, change.path);
        if (change.type === "update" && !state.docs[change.path]) {
          throw fbError("not-found", `No document to update: ${change.path}`);
        }
        if (change.type !== "delete") {
          checkData(change.data);
        }
      });
      changes.forEach((change) => {
        if (change.type === "set") {
          state.docs[change.path] = copy(change.data);
        } else if (change.type === "update") {
          state.docs[change.path] = { ...state.docs[change.path], ...copy(change.data) };
        } else {
          delete state.docs[change.path];
        }
        state.calls.push([change.type, change.path]);
      });
      save(state);
    }
  };
}
