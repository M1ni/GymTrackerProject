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
const forgot = document.getElementById("forgot");
const forgotButton = document.getElementById("forgot-button");

let registering = false; // false = log in form, true = register form

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

// A message at the top of the box, in green when it is good news.
function showMessage(message, kind) {
  notice.textContent = message;
  notice.className = kind ? `notice ${kind}` : "notice";
  notice.hidden = false;
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
  forgot.hidden = registering;
  errorBox.hidden = true;
});

// Forgot password: send an email with a link to choose a new password.
forgotButton.addEventListener("click", async () => {
  errorBox.hidden = true;
  const email = emailInput.value.trim();
  if (!email) {
    showError("Type your email above first, then press Forgot password again.");
    emailInput.focus();
    return;
  }
  if (!isConfigured) {
    showMessage("Preview mode: Firebase is not set up yet, so no email was sent.");
    return;
  }

  forgotButton.disabled = true;
  try {
    await User.resetPassword(email);
    showMessage(`If there is an account for ${email}, we have sent it an email with a link to choose a new password. Check your spam folder if it does not arrive.`, "good");
  } catch (error) {
    showError(friendlyError(error));
  }
  forgotButton.disabled = false;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.hidden = true;

  if (!isConfigured) {
    // Preview mode: no Firebase yet, so any email and password opens the site.
    // This stops working by itself once firebase-config.js has the real values.
    window.location.href = "log.html";
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
  notice.innerHTML = 'Preview mode: Firebase is not set up yet, so any email and password will let you in. Nothing is saved.';
  notice.hidden = false;
}
