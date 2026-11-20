// Code for the Log workout page: today's date, adding sets, and the plates drawing.
// Saving the workout to Firebase is added in week 4 (F3).
import { drawBarbell, platesText } from "./plates.js";
import { isConfigured } from "./firebase.js";

const dateInput = document.getElementById("workout-date");
const setsBody = document.getElementById("sets-body");
const addSetButton = document.getElementById("add-set");
const summary = document.getElementById("set-summary");

// Start with today's date.
dateInput.value = new Date().toISOString().slice(0, 10);

// Redraws the plates for one row of the table.
function updateRow(row) {
  const kg = Number(row.querySelector(".weight").value);
  row.querySelector(".plates").innerHTML = drawBarbell(kg);
  row.querySelector(".plates-text").textContent = kg ? platesText(kg) : "";
}

// Shows "3 sets · 22 reps" under the table.
function updateSummary() {
  const rows = setsBody.querySelectorAll("tr");
  let reps = 0;
  rows.forEach((row) => {
    reps = reps + Number(row.querySelector(".reps").value || 0);
  });
  summary.textContent = `${rows.length} ${rows.length === 1 ? "set" : "sets"} · ${reps} reps`;
}

// Copies the last row, so the new set starts with the same weight.
addSetButton.addEventListener("click", () => {
  const last = setsBody.lastElementChild;
  const row = last.cloneNode(true);
  const number = setsBody.children.length + 1;
  row.querySelector(".set-number").textContent = number;
  row.querySelector(".weight").value = last.querySelector(".weight").value;
  row.querySelector(".weight").setAttribute("aria-label", `Weight in kg for set ${number}`);
  row.querySelector(".reps").value = "";
  row.querySelector(".reps").setAttribute("aria-label", `Reps for set ${number}`);
  setsBody.appendChild(row);
  updateRow(row);
  updateSummary();
  row.querySelector(".reps").focus();
});

// Typing a weight or reps updates the drawing and the summary straight away.
setsBody.addEventListener("input", (event) => {
  updateRow(event.target.closest("tr"));
  updateSummary();
});

// In preview mode, fill in three example sets so the page can be seen working.
if (!isConfigured) {
  const first = setsBody.querySelector("tr");
  first.querySelector(".weight").value = 60;
  first.querySelector(".reps").value = 8;
  addSetButton.click();
  setsBody.lastElementChild.querySelector(".reps").value = 8;
  addSetButton.click();
  setsBody.lastElementChild.querySelector(".reps").value = 6;
  document.activeElement.blur();
}

setsBody.querySelectorAll("tr").forEach(updateRow);
updateSummary();
