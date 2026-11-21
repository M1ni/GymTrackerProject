// The data behind the stand-in Firebase. It is kept in the browser's localStorage,
// so logins and workouts survive moving from page to page, and the tests can
// read it (and switch on "offline") from outside the page.
const KEY = "fakeFirebase";

export function load() {
  const saved = localStorage.getItem(KEY);
  if (saved) {
    return JSON.parse(saved);
  }
  return {
    accounts: {},     // email -> { uid, email, password }
    current: null,    // uid of the logged-in user
    docs: {},         // "users/uid/workouts/doc0001" -> data
    nextId: 1,
    calls: [],        // every database change, e.g. ["add", "users/uid/workouts"]
    resetEmails: [],  // emails asked for a password reset
    offline: false,   // true makes every database call fail, like a lost connection
    delay: 20         // ms each database call takes (bigger = a slow connection)
  };
}

export function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

// An error that looks like the ones Firebase throws (they have a code).
export function fbError(code, message) {
  const error = new Error(message || code);
  error.code = code;
  error.name = "FirebaseError";
  return error;
}
