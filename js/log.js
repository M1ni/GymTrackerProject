// Code for the Log workout page (F3: log a workout).
import { whenLoggedIn, showNotice } from "./page.js";
import { isConfigured } from "./firebase.js";
import { Exercise } from "./exercise.js";
import { Workout, WorkoutSet } from "./workout.js";
import { WorkoutHistory } from "./history.js";
import { drawBarbell, platesText } from "./plates.js";
import { kg, dayDate, heaviest, escapeHtml } from "./format.js";

const form = document.getElementById("workout-form");
const exerciseSelect = document.getElementById("workout-exercise");
const dateInput = document.getElementById("workout-date");
const setsBody = document.getElementById("sets-body");
const addSetButton = document.getElementById("add-set");
const summary = document.getElementById("set-summary");
const saveButton = form.querySelector('button[type="submit"]');

let uid = null;
let history = new WorkoutHistory([]);

// Today's date as "YYYY-MM-DD", using the computer's own time zone
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
dateInput.value = today();

// ---------- The sets table ----------

// Redraws the plates for one row of the table.
function updateRow(row) {
  const weight = Number(row.querySelector(".weight").value);
  row.querySelector(".plates").innerHTML = drawBarbell(weight);
  row.querySelector(".plates-text").textContent = weight ? platesText(weight) : "";
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

// Adds a row, copying the weight from the row above.
function addSet() {
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
  return row;
}

// Goes back to one empty set (after saving).
function resetSets() {
  while (setsBody.children.length > 1) {
    setsBody.lastElementChild.remove();
  }
  const row = setsBody.firstElementChild;
  row.querySelector(".weight").value = "";
  row.querySelector(".reps").value = "";
  updateRow(row);
  updateSummary();
}

addSetButton.addEventListener("click", () => {
  addSet().querySelector(".reps").focus();
});

setsBody.addEventListener("input", (event) => {
  updateRow(event.target.closest("tr"));
  updateSummary();
});

// ---------- The side panels: last time and best ----------

function updateSidePanels() {
  const name = exerciseSelect.value;
  const lastTitle = document.getElementById("last-time-title");
  const lastList = document.getElementById("last-time-list");
  const sets = history.setsFor(name); // newest first

  if (sets.length === 0) {
    lastTitle.textContent = `You have not logged ${name || "this exercise"} yet.`;
    lastList.innerHTML = "";
    document.getElementById("best-title").textContent = "Best";
    document.getElementById("best-figure").innerHTML = '–';
    document.getElementById("best-barbell").innerHTML = drawBarbell(0);
    document.getElementById("best-date").textContent = "Your best shows here after your first workout.";
    document.getElementById("best-history").innerHTML = "";
    return;
  }

  // Last time: the sets from the most recent workout with this exercise
  const lastDate = sets[0].date;
  const lastSets = sets.filter((s) => s.date === lastDate);
  lastTitle.textContent = `${name} on ${dayDate(lastDate)}`;
  lastList.innerHTML = lastSets
    .map((s, i) => `<li><span>Set ${i + 1}</span><span>${s.reps} reps at ${kg(s.weight)} kg</span></li>`)
    .join("");

  // Best: the heaviest weight, and the top weight of the last 3 workouts
  const best = heaviest(sets);
  const bestSet = sets.filter((s) => s.weight === best).pop(); // the first time it was lifted
  document.getElementById("best-title").textContent = `Best ${name.toLowerCase()}`;
  document.getElementById("best-figure").innerHTML = `${kg(best)}<small>kg</small>`;
  document.getElementById("best-barbell").innerHTML = drawBarbell(best);
  document.getElementById("best-date").textContent = `Lifted on ${dayDate(bestSet.date)}. Heaviest set of each recent workout:`;
  const dates = [...new Set(sets.map((s) => s.date))].slice(0, 3);
  document.getElementById("best-history").innerHTML = dates
    .map((date) => `<li><span>${dayDate(date)}</span><span>${kg(heaviest(sets.filter((s) => s.date === date)))} kg</span></li>`)
    .join("");
}

exerciseSelect.addEventListener("change", () => {
  if (uid) updateSidePanels();
});

// ---------- Saving ----------

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!uid) {
    showNotice("Preview mode: Firebase is not set up yet, so this workout was not saved.");
    return;
  }
  if (!exerciseSelect.value) {
    showNotice("Add an exercise on the Exercises page first.");
    return;
  }

  // Only rows with both a weight and reps are saved
  const sets = [];
  setsBody.querySelectorAll("tr").forEach((row) => {
    const weight = Number(row.querySelector(".weight").value);
    const reps = Number(row.querySelector(".reps").value);
    if (weight >= 0 && reps > 0 && row.querySelector(".weight").value !== "") {
      sets.push(new WorkoutSet(exerciseSelect.value, reps, weight));
    }
  });
  if (sets.length === 0) {
    showNotice("Fill in the weight and reps for at least one set.");
    return;
  }

  saveButton.disabled = true;
  try {
    const workout = new Workout(null, dateInput.value, sets);
    await workout.save(uid);
    history.workouts.unshift(workout);
    history.workouts.sort((a, b) => b.date.localeCompare(a.date));
    showNotice(`Saved: ${sets.length} ${sets.length === 1 ? "set" : "sets"} of ${exerciseSelect.value}. Pick another exercise to keep going.`);
    resetSets();
    updateSidePanels();
  } catch (error) {
    showNotice("Could not save the workout. Check your internet connection and try again.");
  }
  saveButton.disabled = false;
});

// ---------- Start ----------

whenLoggedIn(async (user) => {
  uid = user.uid;
  resetSets();
  try {
    const [exercises, loadedHistory] = await Promise.all([Exercise.getAll(uid), WorkoutHistory.load(uid)]);
    history = loadedHistory;
    if (exercises.length === 0) {
      exerciseSelect.innerHTML = '<option value="">No exercises yet</option>';
      showNotice("Start by adding the exercises you do on the Exercises page.");
    } else {
      exerciseSelect.innerHTML = exercises
        .map((e) => `<option>${escapeHtml(e.name)}</option>`)
        .join("");
    }
    updateSidePanels();
  } catch (error) {
    showNotice("Could not load your exercises. Refresh the page to try again.");
  }
});

// In preview mode, fill in three example sets so the page can be seen working.
if (!isConfigured) {
  const first = setsBody.querySelector("tr");
  first.querySelector(".weight").value = 60;
  first.querySelector(".reps").value = 8;
  addSet().querySelector(".reps").value = 8;
  addSet().querySelector(".reps").value = 6;
}

setsBody.querySelectorAll("tr").forEach(updateRow);
updateSummary();
