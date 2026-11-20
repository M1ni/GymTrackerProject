// Code for the Exercises page (F2: add and delete exercises).
import { whenLoggedIn, showNotice } from "./page.js";
import { Exercise } from "./exercise.js";
import { WorkoutHistory } from "./history.js";
import { drawBarbell } from "./plates.js";
import { kg, shortDate, heaviest, escapeHtml } from "./format.js";

const form = document.getElementById("exercise-form");
const nameInput = document.getElementById("exercise-name");
const list = document.getElementById("exercise-list");
const subtitle = document.getElementById("subtitle");

let uid = null;
let exercises = [];
let history = new WorkoutHistory([]);

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
    list.innerHTML = '<tr><td colspan="5" class="muted">No exercises yet. Add your first one above, for example Squat.</td></tr>';
    return;
  }

  list.innerHTML = rows.map((row, index) => {
    const best = heaviest(row.sets);
    const bestCell = best
      ? `<td class="right best-cell">${drawBarbell(best)}<span class="num">${kg(best)} kg</span></td>`
      : '<td class="right muted">–</td>';
    const last = row.sets.length ? shortDate(row.sets[0].date) : "–";
    return `<tr>
      <td>${escapeHtml(row.exercise.name)}</td>
      <td class="right">${row.workouts}</td>
      ${bestCell}
      <td class="right">${last}</td>
      <td class="right"><button class="text-button" data-index="${index}">Delete</button></td>
    </tr>`;
  }).join("");

  // Each Delete button deletes the exercise on its row
  list.querySelectorAll("button[data-index]").forEach((button) => {
    const exercise = rows[Number(button.dataset.index)].exercise;
    button.addEventListener("click", () => deleteExercise(exercise));
  });
}

async function deleteExercise(exercise) {
  if (!confirm(`Delete ${exercise.name}? Your past workouts will keep it.`)) {
    return;
  }
  try {
    await exercise.delete(uid);
    exercises = exercises.filter((e) => e !== exercise);
    render();
  } catch (error) {
    showNotice("Could not delete the exercise. Check your internet connection and try again.");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!uid) return; // preview mode: nothing to save
  const name = nameInput.value.trim();
  if (!name) return;

  // Do not add the same exercise twice (ignoring capital letters)
  if (exercises.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
    showNotice(`${name} is already in your list.`);
    return;
  }

  try {
    const exercise = await Exercise.add(uid, name);
    exercises.push(exercise);
    nameInput.value = "";
    render();
  } catch (error) {
    showNotice("Could not add the exercise. Check your internet connection and try again.");
  }
});

whenLoggedIn(async (user) => {
  uid = user.uid;
  list.innerHTML = '<tr><td colspan="5" class="muted">Loading your exercises…</td></tr>';
  try {
    [exercises, history] = await Promise.all([Exercise.getAll(uid), WorkoutHistory.load(uid)]);
    render();
  } catch (error) {
    list.innerHTML = '<tr><td colspan="5" class="muted">Could not load your exercises. Refresh the page to try again.</td></tr>';
  }
});
