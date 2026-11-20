// Code for the log in / register page (index.html).
import { User, friendlyError } from "./user.js";
import { isConfigured } from "./firebase.js";

const form = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const title = document.getElementById("form-title");
const intro = document.getElementById("form-intro");
const submitButton = document.getElementById("submit-button");
const switchText = document.getElementById("switch-text");
const switchButton = document.getElementById("switch-button");
const errorBox = document.getElementById("error");
const notice = document.getElementById("notice");

let registering = false; // false = log in form, true = register form

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

// Switch between the log in form and the register form.
switchButton.addEventListener("click", () => {
  registering = !registering;
  title.textContent = registering ? "Create your account" : "Log in";
  intro.textContent = registering ? "Free, and your workouts stay with your account." : "Welcome back. Your workouts are waiting.";
  submitButton.textContent = registering ? "Create account" : "Log in";
  switchText.textContent = registering ? "Already have an account?" : "No account yet?";
  switchButton.textContent = registering ? "Log in" : "Register";
  passwordInput.autocomplete = registering ? "new-password" : "current-password";
  errorBox.hidden = true;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.hidden = true;

  if (!isConfigured) {
    showError("Firebase is not set up yet, so accounts cannot be created.");
    return;
  }

  submitButton.disabled = true;
  try {
    if (registering) {
      await User.register(emailInput.value.trim(), passwordInput.value);
    } else {
      await User.logIn(emailInput.value.trim(), passwordInput.value);
    }
    window.location.href = "log.html";
  } catch (error) {
    showError(friendlyError(error));
    submitButton.disabled = false;
  }
});

if (isConfigured) {
  // Someone who is already logged in goes straight to the Log workout page.
  User.watch((user) => {
    if (user) {
      window.location.href = "log.html";
    }
  });
} else {
  notice.innerHTML = 'Preview mode: Firebase is not set up yet, so log in does not work. <a href="log.html">See the other pages</a>';
  notice.hidden = false;
}
