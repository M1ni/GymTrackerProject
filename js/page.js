// Code shared by every page you see after logging in.
import { User } from "./user.js";
import { isConfigured } from "./firebase.js";
import { drawAllBarbells } from "./plates.js";
import { Database } from "./database.js";

const emailText = document.getElementById("user-email");
const notice = document.getElementById("notice");
// There are two log out buttons: one in the menu, one in the phone's top bar.
const logoutButtons = [
  document.getElementById("logout-button"),
  document.getElementById("logout-button-phone")
];

let whenReady = null;

// Each page calls this with the code that loads its real data.
// It runs once we know who is logged in. In preview mode it never runs,
// so the sample data in the HTML stays on the page.
// It can run a second time (with again = true) if Firebase has newer data than
// the copy in this browser that the page showed first.
export function whenLoggedIn(callback) {
  whenReady = callback;
}

// Shows a message at the top of the page, e.g. when saving fails.
// With kind "good" it is green, for good news such as "Saved".
export function showNotice(message, kind) {
  notice.textContent = message;
  notice.className = kind ? `notice ${kind}` : "notice";
  notice.hidden = false;
}

// Shows the page. Until then the CSS hides it (and says "Loading…"),
// so the sample workouts in the HTML never show to a logged-in user.
function showPage() {
  document.querySelector(".app").classList.add("is-ready");
}

drawAllBarbells();

// Loads the page's data (from the copy in this browser if there is one) and shows the page.
let started = null;
function startPage(user) {
  if (started) return started;
  emailText.textContent = user.email;

  // Newer data than the copy shown (e.g. saved on your phone): show the page again with it
  let showAgain = null;
  Database.whenNewData(() => {
    clearTimeout(showAgain);
    showAgain = setTimeout(() => whenReady && whenReady(user, true), 50);
  });
  Database.whenNoConnection(() => {
    showNotice("No connection right now, so this shows your data from your last visit. New changes may not save.");
  });

  started = (async () => {
    try {
      if (whenReady) {
        await whenReady(user, false); // wait until the page has the user's data
      }
    } finally {
      showPage();
    }
  })();
  return started;
}

if (isConfigured) {
  // If this browser has a copy of someone's data, show the page from it straight away,
  // while Firebase checks the login (requests to Firebase wait for that check).
  const owner = Database.copyOwner();
  if (owner) {
    // After this page's own script has run (it imports this file first) and set its loader
    setTimeout(() => startPage(owner), 0);
  }

  // Only logged-in users can see these pages (FR3).
  User.watch((user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    if (owner && owner.uid !== user.uid) {
      // Someone else is logged in now: forget the old copy and start again
      Database.forgetCopy();
      window.location.reload();
      return;
    }
    Database.setCopyOwner(user);
    Database.loggedIn();
    startPage(user);
  });

  logoutButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      await User.logOut();
      window.location.href = "index.html";
    });
  });
} else {
  showNotice("Preview mode: Firebase is not set up yet, so you are seeing sample workouts and nothing is saved.");
  emailText.textContent = "Preview mode";
  showPage();
  logoutButtons.forEach((button) => {
    button.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  });
}
