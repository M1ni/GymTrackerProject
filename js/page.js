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

drawAllBarbells();

if (isConfigured) {
  // Only logged-in users can see these pages (FR3).
  User.watch((user) => {
    if (user) {
      emailText.textContent = user.email;
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
  notice.textContent = "Preview mode: Firebase is not set up yet, so you are seeing sample workouts and nothing is saved.";
  notice.hidden = false;
  emailText.textContent = "Preview mode";
  logoutButtons.forEach((button) => {
    button.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  });
}
