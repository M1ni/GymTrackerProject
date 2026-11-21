// Code for the Log workout page (F3: log a workout).
import { whenLoggedIn, showNotice } from "./page.js";
import { isConfigured } from "./firebase.js";
import { Exercise, COMMON_EXERCISES, kindOf, tidyName } from "./exercise.js";
import { Workout, WorkoutSet } from "./workout.js";
import { WorkoutHistory, bestOf, bestField } from "./history.js";
import { TrainingPlan } from "./plans.js";
import { drawBarbell, platesText, MAX_WEIGHT } from "./plates.js";
import { kg, dayDate, heaviest, volume, describeSets, groupByExercise, escapeHtml, setText, bestText, bestFigure, weekStart } from "./format.js";

const MAX_REPS = 100;
const MAX_SECONDS = 3600;

const form = document.getElementById("workout-form");
const exerciseSelect = document.getElementById("workout-exercise");
const dateInput = document.getElementById("workout-date");
const setsBody = document.getElementById("sets-body");
const addSetButton = document.getElementById("add-set");
const summary = document.getElementById("set-summary");
const saveButton = form.querySelector('button[type="submit"]');
const weightHead = document.getElementById("weight-head");
const amountHead = document.getElementById("amount-head");
const platesHead = document.getElementById("plates-head");
const emptyStart = document.getElementById("empty-start");
const addCommonButton = document.getElementById("add-common");
const newButton = document.getElementById("new-exercise-button");
const newRow = document.getElementById("new-exercise");
const newName = document.getElementById("new-exercise-name");
const newKind = document.getElementById("new-exercise-kind");
const newAdd = document.getElementById("new-exercise-add");
const newCancel = document.getElementById("new-exercise-cancel");
const todayCard = document.getElementById("today-card");
const todayTitle = document.getElementById("today-title");
const todayList = document.getElementById("today-list");
const todayTotal = document.getElementById("today-total");
const todayEdit = document.getElementById("today-edit");
const planCard = document.getElementById("plan-today");
const planTitle = document.getElementById("plan-title");
const planNote = document.getElementById("plan-note");
const planList = document.getElementById("plan-list");
const planWeek = document.getElementById("plan-week");
const sidePanels = document.getElementById("side-panels");

let uid = null;
let exercises = []; // this user's exercises, A to Z
let history = new WorkoutHistory([]);
let plan = null; // the training plan the user chose, if any

// Today's date as "YYYY-MM-DD", using the computer's own time zone
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
dateInput.value = today();

// The chosen exercise, and its kind: "weights", "bodyweight" or "timed"
function chosenExercise() {
  return exercises.find((e) => e.name === exerciseSelect.value);
}

function chosenKind() {
  const exercise = chosenExercise();
  return exercise ? exercise.kind : "weights";
}

// ---------- The exercise list ----------

function fillExerciseList(choose) {
  if (exercises.length === 0) {
    exerciseSelect.innerHTML = '<option value="">No exercises yet</option>';
  } else {
    exerciseSelect.innerHTML = exercises
      // value= keeps the name exactly as saved (without it the browser squashes double spaces)
      .map((e) => `<option value="${escapeHtml(e.name)}">${escapeHtml(e.name)}</option>`)
      .join("");
    if (choose) {
      exerciseSelect.value = choose;
    }
  }
  emptyStart.hidden = exercises.length > 0;
}

function addToList(exercise) {
  exercises.push(exercise);
  exercises.sort((a, b) => a.name.localeCompare(b.name));
}

// When another exercise is chosen, the table and the side panels change with it
function exerciseChanged() {
  updateColumns();
  updateSidePanels();
}

exerciseSelect.addEventListener("change", () => {
  if (uid) exerciseChanged();
});

// ---------- The sets table ----------

// The table changes with the kind of exercise: timed ones (like a plank) count seconds,
// bodyweight ones only need a weight if you add some, and only weights show the plates.
function updateColumns() {
  const kind = chosenKind();
  weightHead.textContent = kind === "weights" ? "Weight (kg)" : "Extra kg";
  amountHead.textContent = kind === "timed" ? "Seconds" : "Reps";
  platesHead.textContent = kind === "weights" ? "Plates" : "";
  setsBody.querySelectorAll("tr").forEach((row, i) => {
    labelRow(row, i + 1);
    updateRow(row);
  });
  updateSummary();
}

// The labels screen readers read, and the highest number allowed, for one row
function labelRow(row, number) {
  const kind = chosenKind();
  const weight = row.querySelector(".weight");
  const amount = row.querySelector(".reps");
  weight.setAttribute("aria-label", `${kind === "weights" ? "Weight in kg" : "Extra kg"} for set ${number}`);
  weight.placeholder = kind === "weights" ? "" : "0";
  amount.setAttribute("aria-label", `${kind === "timed" ? "Seconds" : "Reps"} for set ${number}`);
  amount.max = kind === "timed" ? MAX_SECONDS : MAX_REPS;
}

// Redraws the plates for one row of the table.
function updateRow(row) {
  const weight = Number(row.querySelector(".weight").value);
  const showPlates = chosenKind() === "weights";
  row.querySelector(".plates").innerHTML = showPlates ? drawBarbell(weight) : "";
  row.querySelector(".plates-text").textContent = showPlates && weight ? platesText(weight) : "";
}

// Shows "3 sets · 22 reps" (or "3 sets · 90 s") under the table.
function updateSummary() {
  const rows = setsBody.querySelectorAll("tr");
  let total = 0;
  rows.forEach((row) => {
    total = total + Number(row.querySelector(".reps").value || 0);
  });
  summary.textContent = `${rows.length} ${rows.length === 1 ? "set" : "sets"} · ${total} ${chosenKind() === "timed" ? "s" : "reps"}`;
}

// Adds a row, copying the weight from the row above.
function addSet() {
  const last = setsBody.lastElementChild;
  const row = last.cloneNode(true);
  const number = setsBody.children.length + 1;
  row.querySelector(".set-number").textContent = number;
  row.querySelector(".weight").value = last.querySelector(".weight").value;
  row.querySelector(".reps").value = "";
  labelRow(row, number);
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

// True if something has been typed in the table and not saved yet
function hasTypedSets() {
  return [...setsBody.querySelectorAll("input")].some((input) => input.value !== "");
}

addSetButton.addEventListener("click", () => {
  addSet().querySelector(".reps").focus();
});

setsBody.addEventListener("input", (event) => {
  updateRow(event.target.closest("tr"));
  updateSummary();
});

// ---------- Adding an exercise without leaving the page ----------

let kindPicked = false; // true once the user picks the kind themselves

newButton.addEventListener("click", () => {
  newRow.hidden = !newRow.hidden;
  if (!newRow.hidden) {
    newName.value = "";
    newKind.value = "weights";
    kindPicked = false;
    newName.focus();
  }
});

newCancel.addEventListener("click", () => {
  newRow.hidden = true;
});

// Suggests the kind from the name, e.g. "Plank" is timed (until you pick one yourself)
newName.addEventListener("input", () => {
  if (!kindPicked) newKind.value = kindOf(newName.value);
});

newKind.addEventListener("change", () => {
  kindPicked = true;
});

// Enter in the name box adds the exercise (it does not save the workout)
newName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addNewExercise();
  }
});

newAdd.addEventListener("click", addNewExercise);

async function addNewExercise() {
  const name = tidyName(newName.value);
  if (!name) {
    newName.focus();
    return;
  }
  if (!uid) {
    showNotice("Preview mode: Firebase is not set up yet, so nothing is saved.");
    return;
  }
  const same = exercises.find((e) => e.name.toLowerCase() === name.toLowerCase());
  if (same) {
    fillExerciseList(same.name);
    exerciseChanged();
    newRow.hidden = true;
    showNotice(`${same.name} is already in your list, so it is picked.`);
    return;
  }

  newAdd.disabled = true;
  try {
    const exercise = await Exercise.add(uid, name, newKind.value);
    addToList(exercise);
    fillExerciseList(exercise.name);
    exerciseChanged();
    newRow.hidden = true;
    showNotice(`Added ${name}. Fill in your sets below.`, "good");
  } catch (error) {
    showNotice("Could not add the exercise. Check your internet connection and try again.");
  }
  newAdd.disabled = false;
}

// A new account can add the common exercises in one click
addCommonButton.addEventListener("click", async () => {
  if (!uid) {
    showNotice("Preview mode: Firebase is not set up yet, so nothing is saved.");
    return;
  }
  addCommonButton.disabled = true;
  try {
    const added = await Exercise.addMissing(uid, COMMON_EXERCISES, exercises);
    added.forEach(addToList);
    fillExerciseList();
    exerciseChanged();
    showNotice(`Added ${added.length} common exercises. Pick one and log your first set.`, "good");
  } catch (error) {
    showNotice("Could not add the exercises. Check your internet connection and try again.");
  }
  addCommonButton.disabled = false;
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
    .map((s, i) => `<li><span>Set ${i + 1}</span><span>${setText(s)}</span></li>`)
    .join("");

  // Best: the best set ever (the heaviest, or the most reps or longest time
  // for exercises without weights), and the best of each of the last 3 workouts
  const best = bestOf(sets);
  const lifted = bestField(best) === "weight";
  document.getElementById("best-title").textContent = `Best ${name.toLowerCase()}`;
  document.getElementById("best-figure").innerHTML = bestFigure(best);
  document.getElementById("best-barbell").innerHTML = lifted ? drawBarbell(best.weight) : "";
  document.getElementById("best-date").textContent =
    `${lifted ? "Lifted" : "Done"} on ${dayDate(best.date)}. ${lifted ? "Heaviest" : "Best"} set of each recent workout:`;
  const dates = [...new Set(sets.map((s) => s.date))].slice(0, 3);
  document.getElementById("best-history").innerHTML = dates
    .map((date) => `<li><span>${dayDate(date)}</span><span>${bestText(bestOf(sets.filter((s) => s.date === date)))}</span></li>`)
    .join("");
}

// ---------- Your plan for the day ----------

function updatePlanCard() {
  planCard.hidden = !plan;
  if (!plan) {
    return;
  }
  const date = dateInput.value || today();
  let day = plan.dayOn(date);
  if (day) {
    planTitle.textContent = `${date === today() ? "Today" : dayDate(date)}: Day ${day.number} · ${day.title}`;
    planNote.textContent = "Tap an exercise to fill in its sets.";
  } else {
    day = plan.nextDay(date);
    planTitle.textContent = date === today() ? "Rest day today" : `${dayDate(date)} is a rest day`;
    planNote.textContent = `Next: ${dayDate(day.date)}, Day ${day.number} · ${day.title}. Training anyway? Tap an exercise.`;
  }

  // A tick on the exercises already logged that day
  const workout = history.onDate(date);
  const isDone = (name) => Boolean(workout && workout.sets.some((s) => s.exerciseName.toLowerCase() === name.toLowerCase()));
  planList.innerHTML = day.exercises
    .map(([name, target], i) => `<li class="${isDone(name) ? "done" : ""}">
        <button type="button" class="text-button" data-pick="${i}">${escapeHtml(name)}</button>
        <span>${escapeHtml(target)}${isDone(name) ? " · done ✓" : ""}</span>
      </li>`)
    .join("");
  planList.querySelectorAll("button[data-pick]").forEach((button) => {
    const [name, target] = day.exercises[Number(button.dataset.pick)];
    button.addEventListener("click", () => pickFromPlan(name, target));
  });

  // Workouts this week, out of the plan's days per week
  const monday = weekStart(date);
  const count = history.workouts.filter((w) => weekStart(w.date) === monday).length;
  planWeek.textContent = `This week: ${count} of ${plan.daysPerWeek} workouts`;
}

// Picks an exercise from the plan and fills in its sets: "3 × 10" makes 3 rows of 10 reps,
// with the weight you lifted last time.
async function pickFromPlan(name, target) {
  if (hasTypedSets() && !confirm(`Start ${name}? The sets you typed are not saved yet.`)) {
    return;
  }
  let exercise = exercises.find((e) => e.name.toLowerCase() === name.toLowerCase());
  if (!exercise) {
    try {
      exercise = await Exercise.add(uid, name, kindOf(name));
      addToList(exercise);
    } catch (error) {
      showNotice("Could not add the exercise. Check your internet connection and try again.");
      return;
    }
  }
  fillExerciseList(exercise.name);
  exerciseChanged();

  const match = target.match(/^(\d+) × (\d+)?/);
  const count = match ? Number(match[1]) : 1;
  const amount = match && match[2] ? match[2] : "";
  const sets = history.setsFor(exercise.name);
  const lastWeight = sets.length ? heaviest(sets.filter((s) => s.date === sets[0].date)) : 0;

  resetSets();
  const first = setsBody.firstElementChild;
  first.querySelector(".weight").value = lastWeight ? kg(lastWeight) : "";
  first.querySelector(".reps").value = amount;
  for (let i = 1; i < count; i++) {
    addSet().querySelector(".reps").value = amount;
  }
  setsBody.querySelectorAll("tr").forEach(updateRow);
  updateSummary();
  const needsWeight = exercise.kind === "weights" && !lastWeight;
  first.querySelector(needsWeight ? ".weight" : ".reps").focus();
}

// ---------- Today so far ----------

// Shows everything logged on the chosen date, so you can see the whole session.
function updateToday() {
  const date = dateInput.value;
  const workout = date ? history.onDate(date) : undefined;
  todayTitle.textContent = !date || date === today() ? "Today so far" : `Workout on ${dayDate(date)}`;
  todayEdit.hidden = !workout;
  if (!workout) {
    todayList.innerHTML = '<li class="muted">Nothing logged yet. Each exercise you save shows here.</li>';
    todayTotal.textContent = "";
    return;
  }

  // The Edit link opens this workout in History, ready to fix a set
  todayEdit.href = `history.html#edit-${date}`;
  const groups = groupByExercise(workout.sets);
  todayList.innerHTML = groups
    .map((g, i) => `<li>
        <span>${escapeHtml(g.name)}</span>
        <span>${describeSets(g.sets)} <button type="button" class="text-button" data-remove="${i}">Remove</button></span>
      </li>`)
    .join("");
  const count = workout.sets.length;
  todayTotal.textContent = `${count} ${count === 1 ? "set" : "sets"} · ${volume(workout.sets)} kg lifted`;

  todayList.querySelectorAll("button[data-remove]").forEach((button) => {
    const name = groups[Number(button.dataset.remove)].name;
    button.addEventListener("click", () => removeExercise(workout, name));
  });
}

// Takes one exercise out of the workout, e.g. when it was saved by mistake.
async function removeExercise(workout, name) {
  if (!confirm(`Remove ${name} from this workout? This cannot be undone.`)) {
    return;
  }
  const left = workout.sets.filter((s) => s.exerciseName !== name);
  try {
    if (left.length === 0) {
      await workout.delete(uid);
      history.remove(workout);
    } else {
      await workout.saveChanges(uid, left);
    }
    showNotice(`Removed ${name} from the workout.`);
    updateToday();
    updateSidePanels();
    updatePlanCard();
  } catch (error) {
    showNotice("Could not remove it. Check your internet connection and try again.");
  }
}

dateInput.addEventListener("change", () => {
  if (uid) {
    updateToday();
    updatePlanCard();
  }
});

// ---------- Saving ----------

// "Saved: 3 sets of Squat." and, when it beats your best, "New personal best: 100 kg, up from 97.5 kg!"
function savedMessage(name, sets, before) {
  const saved = `Saved: ${sets.length} ${sets.length === 1 ? "set" : "sets"} of ${name}.`;
  if (before.length > 0) {
    const oldBest = bestOf(before);
    const newBest = bestOf([...before, ...sets.map((s) => ({ ...s, date: dateInput.value }))]);
    const field = bestField(newBest);
    if (field === bestField(oldBest) && newBest[field] > oldBest[field]) {
      return `${saved} New personal best: ${bestText(newBest)}, up from ${bestText(oldBest)}!`;
    }
  }
  return `${saved} Pick another exercise to keep going.`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!uid) {
    showNotice("Preview mode: Firebase is not set up yet, so this workout was not saved.");
    return;
  }
  if (!exerciseSelect.value) {
    showNotice("Add an exercise first: press + New, or add the common exercises.");
    return;
  }

  // Stop typing mistakes such as 9085 kg or 600 reps from being saved
  const kind = chosenKind();
  const maxAmount = kind === "timed" ? MAX_SECONDS : MAX_REPS;
  const rows = [...setsBody.querySelectorAll("tr")];
  const tooBig = rows.some((row) =>
    Number(row.querySelector(".weight").value) > MAX_WEIGHT || Number(row.querySelector(".reps").value) > maxAmount
  );
  if (tooBig) {
    showNotice(`Please check your sets: the weight must be ${MAX_WEIGHT} kg or less, and ${kind === "timed" ? `the time ${MAX_SECONDS} seconds` : `reps ${MAX_REPS}`} or less.`);
    return;
  }

  // A set needs reps (or seconds). For exercises with weights it also needs a weight;
  // for bodyweight and timed ones an empty weight means no extra weight.
  const name = exerciseSelect.value;
  const sets = [];
  rows.forEach((row) => {
    const weightText = row.querySelector(".weight").value;
    const weight = Number(weightText);
    const amount = Number(row.querySelector(".reps").value);
    if (amount > 0 && weight >= 0 && (weightText !== "" || kind !== "weights")) {
      sets.push(kind === "timed" ? new WorkoutSet(name, null, weight, amount) : new WorkoutSet(name, amount, weight));
    }
  });
  if (sets.length === 0) {
    showNotice(kind === "weights"
      ? "Fill in the weight and reps for at least one set."
      : `Fill in the ${kind === "timed" ? "seconds" : "reps"} for at least one set.`);
    return;
  }

  // The sets before this workout, to see if it is a new personal best
  const before = history.setsFor(name);

  saveButton.disabled = true;
  try {
    const workout = new Workout(null, dateInput.value, sets);
    await workout.save(uid);
    history.add(workout);
    showNotice(savedMessage(name, sets, before), "good");
    resetSets();
    updateSidePanels();
    updateToday();
    updatePlanCard();
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
    [exercises, history, plan] = await Promise.all([
      Exercise.getAll(uid),
      WorkoutHistory.load(uid),
      TrainingPlan.load(uid)
    ]);
    fillExerciseList();
    exerciseChanged();
    updateToday();
    updatePlanCard();
  } catch (error) {
    // Hide the sample data in the page, and say what happened
    planCard.hidden = true;
    todayCard.hidden = true;
    sidePanels.hidden = true;
    exerciseSelect.innerHTML = '<option value="">Could not load your exercises</option>';
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
