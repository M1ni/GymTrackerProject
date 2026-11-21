// Code for the Exercises page (F2: add, change and delete exercises).
import { whenLoggedIn, showNotice } from "./page.js";
import { Exercise, KIND_NAMES, COMMON_EXERCISES, kindOf, tidyName } from "./exercise.js";
import { WorkoutHistory, bestOf, bestField } from "./history.js";
import { drawBarbell } from "./plates.js";
import { shortDate, escapeHtml, bestText } from "./format.js";

const form = document.getElementById("exercise-form");
const nameInput = document.getElementById("exercise-name");
const kindSelect = document.getElementById("exercise-kind");
const addButton = form.querySelector('button[type="submit"]');
const list = document.getElementById("exercise-list");
const subtitle = document.getElementById("subtitle");

let uid = null;
let exercises = [];
let history = new WorkoutHistory([]);
let editing = null; // the exercise being changed, if any
let kindPicked = false; // true once the user picks the kind themselves

const kindOptions = (chosen) => Object.entries(KIND_NAMES)
  .map(([value, text]) => `<option value="${value}"${value === chosen ? " selected" : ""}>${text}</option>`)
  .join("");

// The Best column: the heaviest weight with its barbell, or the most reps or longest time
function bestCell(sets) {
  if (sets.length === 0) {
    return '<td class="right muted">–</td>';
  }
  const best = bestOf(sets);
  const barbell = bestField(best) === "weight" ? drawBarbell(best.weight) : "";
  return `<td class="right best-cell">${barbell}<span class="num">${bestText(best)}</span></td>`;
}

function rowHtml(row, index) {
  const exercise = row.exercise;
  const kind = exercise.kind === "weights" ? "" : `<span class="kind">${KIND_NAMES[exercise.kind]}</span>`;
  const last = row.sets.length ? shortDate(row.sets[0].date) : "–";
  return `<tr>
      <td><span class="exercise-name">${escapeHtml(exercise.name)}</span>${kind}</td>
      <td class="right">${row.workouts}</td>
      ${bestCell(row.sets)}
      <td class="right">${last}</td>
      <td class="right"><span class="row-actions">
        <button class="text-button" data-edit="${index}">Edit</button>
        <button class="text-button" data-delete="${index}">Delete</button>
      </span></td>
    </tr>`;
}

// Changing the name or kind of an exercise
function editRowHtml(row, index) {
  const exercise = row.exercise;
  return `<tr class="editing-row"><td colspan="5">
      <form class="exercise-edit" data-index="${index}">
        <input type="text" class="edit-name-box" value="${escapeHtml(exercise.name)}" aria-label="New name for ${escapeHtml(exercise.name)}" required>
        <select class="edit-kind" aria-label="Kind of exercise">${kindOptions(exercise.kind)}</select>
        <button type="submit">Save</button>
        <button type="button" class="secondary" data-cancel>Cancel</button>
      </form>
      <p class="muted edit-hint">A new name changes in your past workouts too.</p>
    </td></tr>`;
}

// Draws the table of exercises.
function render() {
  // How many workouts used each exercise, so the list goes from most to least logged
  const rows = exercises.map((exercise) => {
    const sets = history.setsFor(exercise.name);
    const workouts = new Set(sets.map((s) => s.date)).size;
    return { exercise, sets, workouts };
  });
  rows.sort((a, b) => b.workouts - a.workouts || a.exercise.name.localeCompare(b.exercise.name));

  if (exercises.length === 0) {
    subtitle.textContent = "No exercises yet";
  } else if (exercises.length === 1) {
    subtitle.textContent = "1 exercise";
  } else {
    subtitle.textContent = `${exercises.length} exercises, from your most to least logged`;
  }

  if (rows.length === 0) {
    list.innerHTML = `<tr><td colspan="5" class="muted">No exercises yet. Add your own above, or
      <button type="button" class="text-button" id="add-common">add the ${COMMON_EXERCISES.length} common ones</button>
      (squat, bench press, deadlift and more).</td></tr>`;
    document.getElementById("add-common").addEventListener("click", addCommon);
    return;
  }

  list.innerHTML = rows.map((row, index) => (row.exercise === editing ? editRowHtml(row, index) : rowHtml(row, index))).join("");

  list.querySelectorAll("button[data-delete]").forEach((button) => {
    const exercise = rows[Number(button.dataset.delete)].exercise;
    button.addEventListener("click", () => deleteExercise(exercise));
  });
  list.querySelectorAll("button[data-edit]").forEach((button) => {
    const exercise = rows[Number(button.dataset.edit)].exercise;
    button.addEventListener("click", () => {
      editing = exercise;
      render();
      list.querySelector(".edit-name-box").focus();
    });
  });
  list.querySelectorAll(".exercise-edit").forEach((editForm) => {
    const exercise = rows[Number(editForm.dataset.index)].exercise;
    editForm.addEventListener("submit", (event) => {
      event.preventDefault();
      saveEdit(editForm, exercise);
    });
    editForm.querySelector("button[data-cancel]").addEventListener("click", () => {
      editing = null;
      render();
    });
  });
}

async function saveEdit(editForm, exercise) {
  const name = tidyName(editForm.querySelector(".edit-name-box").value);
  const kind = editForm.querySelector(".edit-kind").value;
  if (!name) {
    return;
  }
  if (exercises.some((e) => e !== exercise && e.name.toLowerCase() === name.toLowerCase())) {
    showNotice(`${name} is already in your list.`);
    return;
  }
  if (name === exercise.name && kind === exercise.kind) {
    editing = null;
    render();
    return;
  }

  const oldName = exercise.name;
  const saveButton = editForm.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  try {
    await exercise.update(uid, name, kind, history.workouts);
    editing = null;
    render();
    showNotice(name === oldName ? `Saved ${name}.` : `Renamed ${oldName} to ${name}, in your past workouts too.`, "good");
  } catch (error) {
    saveButton.disabled = false;
    showNotice("Could not save the change. Check your internet connection and try again.");
  }
}

async function deleteExercise(exercise) {
  if (!confirm(`Delete ${exercise.name}? Your past workouts will keep it.`)) {
    return;
  }
  try {
    await exercise.delete(uid);
    exercises = exercises.filter((e) => e !== exercise);
    if (editing === exercise) editing = null;
    render();
  } catch (error) {
    showNotice("Could not delete the exercise. Check your internet connection and try again.");
  }
}

// A new account can add the common exercises in one click
async function addCommon() {
  try {
    const added = await Exercise.addMissing(uid, COMMON_EXERCISES, exercises);
    exercises.push(...added);
    render();
    showNotice(`Added ${added.length} common exercises.`, "good");
  } catch (error) {
    showNotice("Could not add the exercises. Check your internet connection and try again.");
  }
}

// Suggests the kind from the name, e.g. "Plank" is timed (until you pick one yourself)
nameInput.addEventListener("input", () => {
  if (!kindPicked) kindSelect.value = kindOf(nameInput.value);
});

kindSelect.addEventListener("change", () => {
  kindPicked = true;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!uid) return; // preview mode: nothing to save
  if (addButton.disabled) return; // still saving the last one (Enter pressed twice)
  // Remove extra spaces, so "Lat  pulldown" is saved as "Lat pulldown"
  const name = tidyName(nameInput.value);
  if (!name) return;

  // Do not add the same exercise twice (ignoring capital letters)
  if (exercises.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
    showNotice(`${name} is already in your list.`);
    return;
  }

  addButton.disabled = true;
  try {
    const exercise = await Exercise.add(uid, name, kindSelect.value);
    exercises.push(exercise);
    nameInput.value = "";
    kindSelect.value = "weights";
    kindPicked = false;
    render();
  } catch (error) {
    showNotice("Could not add the exercise. Check your internet connection and try again.");
  }
  addButton.disabled = false;
});

// again is true when the page is shown again with newer data
whenLoggedIn(async (user, again) => {
  uid = user.uid;
  if (!again) {
    list.innerHTML = '<tr><td colspan="5" class="muted">Loading your exercises…</td></tr>';
  }
  try {
    [exercises, history] = await Promise.all([Exercise.getAll(uid), WorkoutHistory.load(uid)]);
    if (editing) {
      editing = exercises.find((e) => e.id === editing.id) || null; // keep the same one open
    }
    render();
  } catch (error) {
    list.innerHTML = '<tr><td colspan="5" class="muted">Could not load your exercises. Refresh the page to try again.</td></tr>';
  }
});
