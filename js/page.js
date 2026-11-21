// Code shared by every page you see after logging in.
import { User } from "./user.js";
import { isConfigured } from "./firebase.js";
import { drawAllBarbells } from "./plates.js";

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
export function whenLoggedIn(callback) {
  whenReady = callback;
}

// Shows a message at the top of the page, e.g. when saving fails.
export function showNotice(message) {
  notice.textContent = message;
  notice.hidden = false;
}

// Shows the page. Until then the CSS hides it (and says "Loading…"),
// so the sample workouts in the HTML never show to a logged-in user.
function showPage() {
  document.querySelector(".app").classList.add("is-ready");
}

drawAllBarbells();

if (isConfigured) {
  // Only logged-in users can see these pages (FR3).
  User.watch(async (user) => {
    if (user) {
      emailText.textContent = user.email;
      try {
        if (whenReady) {
          await whenReady(user); // wait until the page has loaded the user's data
        }
      } finally {
        showPage();
      }
    } else {
      window.location.href = "index.html";
    }
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
