// Code for the History page (F4: view, fix and delete past workouts, F5: search).
import { whenLoggedIn, showNotice } from "./page.js";
import { isConfigured } from "./firebase.js";
import { WorkoutHistory } from "./history.js";
import { WorkoutSet } from "./workout.js";
import { drawBarbell, MAX_WEIGHT } from "./plates.js";
import { kg, shortDate, dayName, weekStart, weekTitle, describeSets, groupByExercise, heaviest, volume, escapeHtml } from "./format.js";

const list = document.getElementById("workout-list");
const subtitle = document.getElementById("subtitle");
const searchBox = document.getElementById("search-box");

let uid = null;
let history = new WorkoutHistory([]);
let editing = null; // the workout being changed, if any

const plural = (count, word) => `${count} ${count === 1 ? word : word + "s"}`;

// The HTML for one workout
function workoutHtml(workout, index) {
  if (workout === editing) {
    return editHtml(workout, index);
  }
  const lifts = groupByExercise(workout.sets)
    .map((g) => `<li>${escapeHtml(g.name)} <span>${describeSets(g.sets)}</span></li>`)
    .join("");
  const top = heaviest(workout.sets);
  const topHtml = top
    ? `${drawBarbell(top)}<span class="num">Heaviest set <strong>${kg(top)} kg</strong></span>`
    : '<span class="num">No weights</span>';
  return `<article class="workout">
    <div class="workout-date"><strong>${shortDate(workout.date)}</strong><span>${dayName(workout.date)}</span></div>
    <ul class="workout-lifts">${lifts}</ul>
    <div class="workout-top">${topHtml}</div>
    <div class="workout-side">
      <span class="num">${plural(workout.sets.length, "set")}<br>${volume(workout.sets)} kg total</span>
      <span class="workout-actions">
        <button class="text-button" data-edit="${index}">Edit</button>
        <button class="text-button" data-delete="${index}">Delete</button>
      </span>
    </div>
  </article>`;
}

// The HTML for a workout being changed: every set gets its own weight and reps box
// (or seconds, for timed exercises like a plank).
function editHtml(workout, index) {
  const anyTimed = workout.sets.some((s) => s.seconds !== null);
  const rows = groupByExercise(workout.sets).map((group) => group.sets.map((set, i) => {
    const label = `${escapeHtml(group.name)} set ${i + 1}`;
    const timed = set.seconds !== null;
    const amountBox = timed
      ? `<input type="number" class="amount seconds" min="1" max="3600" value="${set.seconds}" required aria-label="Seconds for ${label}">`
      : `<input type="number" class="amount reps" min="1" max="100" value="${set.reps}" required aria-label="Reps for ${label}">`;
    return `<tr data-set="${workout.sets.indexOf(set)}">
      <td class="edit-name">${i === 0 ? `<strong>${escapeHtml(group.name)}</strong>` : ""}<span>Set ${i + 1}</span></td>
      <td><input type="number" class="weight" min="0" max="${MAX_WEIGHT}" step="any" value="${set.weight}" required aria-label="Weight in kg for ${label}"></td>
      <td>${amountBox}</td>
      <td class="right"><button type="button" class="text-button" data-remove-set data-label="${label}" aria-label="Remove ${label}">Remove</button></td>
    </tr>`;
  }).join("")).join("");

  return `<article class="workout editing">
    <div class="workout-date"><strong>${shortDate(workout.date)}</strong><span>${dayName(workout.date)}</span></div>
    <form class="edit-form" data-index="${index}">
      <table class="sets edit-sets">
        <thead><tr><th>Exercise</th><th>Weight (kg)</th><th>${anyTimed ? "Reps or seconds" : "Reps"}</th><th><span class="visually-hidden">Remove</span></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="edit-foot">
        <button type="button" class="secondary" data-cancel>Cancel</button>
        <button type="submit">Save changes</button>
      </div>
    </form>
  </article>`;
}

function render() {
  const query = searchBox.value.trim();
  const workouts = query ? history.search(query) : history.workouts;
  const total = history.workouts.length;

  if (query) {
    subtitle.textContent = `${workouts.length} of ${total} workouts match "${query}"`;
  } else {
    subtitle.textContent = plural(total, "workout");
  }

  if (total === 0) {
    list.innerHTML = '<section class="card"><p class="muted">No workouts yet. <a href="log.html">Log your first workout</a> and it will show here.</p></section>';
    return;
  }
  if (workouts.length === 0) {
    list.innerHTML = '<section class="card"><p class="muted">No workouts match your search. Try an exercise name, a day such as "friday", or a date such as "13 nov".</p></section>';
    return;
  }

  // Group the workouts by week (newest week first)
  const weeks = [];
  workouts.forEach((workout, index) => {
    const monday = weekStart(workout.date);
    let week = weeks.find((w) => w.monday === monday);
    if (!week) {
      week = { monday: monday, workouts: [], html: [] };
      weeks.push(week);
    }
    week.workouts.push(workout);
    week.html.push(workoutHtml(workout, index));
  });

  list.innerHTML = weeks.map((week) => `<section class="card week">
    <div class="week-head">
      <h2>${weekTitle(week.monday)}</h2>
      <span class="num">${plural(week.workouts.length, "workout")} · ${volume(week.workouts.flatMap((w) => w.sets))} kg</span>
    </div>
    ${week.html.join("")}
  </section>`).join("");

  list.querySelectorAll("button[data-delete]").forEach((button) => {
    const workout = workouts[Number(button.dataset.delete)];
    button.addEventListener("click", () => deleteWorkout(workout));
  });
  list.querySelectorAll("button[data-edit]").forEach((button) => {
    const workout = workouts[Number(button.dataset.edit)];
    button.addEventListener("click", () => startEditing(workout));
  });
  list.querySelectorAll(".edit-form").forEach((editForm) => {
    setUpEditForm(editForm, workouts[Number(editForm.dataset.index)]);
  });
}

async function deleteWorkout(workout) {
  if (!confirm(`Delete your workout from ${shortDate(workout.date)}? This cannot be undone.`)) {
    return false;
  }
  try {
    await workout.delete(uid);
    history.remove(workout);
    if (editing === workout) editing = null;
    render();
    return true;
  } catch (error) {
    showNotice("Could not delete the workout. Check your internet connection and try again.");
    return false;
  }
}

// ---------- Fixing a mistake ----------

function startEditing(workout) {
  editing = workout;
  render();
  const firstBox = list.querySelector(".editing input");
  if (firstBox) firstBox.focus();
}

function setUpEditForm(editForm, workout) {
  // Remove marks a set to be taken out when you save. Press Undo to keep it after all.
  editForm.querySelectorAll("button[data-remove-set]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest("tr");
      const removed = row.classList.toggle("removed");
      row.querySelectorAll("input").forEach((input) => { input.disabled = removed; });
      button.textContent = removed ? "Undo" : "Remove";
      // Screen readers read the label, so it changes too
      button.setAttribute("aria-label", `${removed ? "Undo removing" : "Remove"} ${button.dataset.label}`);
    });
  });

  editForm.querySelector("button[data-cancel]").addEventListener("click", () => {
    editing = null;
    render();
  });

  // The browser checks the boxes first (weight 0 to 500, reps 1 to 100), like on the Log page
  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const sets = [...editForm.querySelectorAll("tbody tr:not(.removed)")].map((row) => {
      const original = workout.sets[Number(row.dataset.set)];
      const weight = Number(row.querySelector(".weight").value);
      const amount = Number(row.querySelector(".amount").value);
      return original.seconds !== null
        ? new WorkoutSet(original.exerciseName, null, weight, amount)
        : new WorkoutSet(original.exerciseName, amount, weight);
    });

    // Every set removed: that is the same as deleting the workout
    if (sets.length === 0) {
      await deleteWorkout(workout);
      return;
    }

    const saveButton = editForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    try {
      await workout.saveChanges(uid, sets);
      editing = null;
      render();
      showNotice(`Saved your changes to ${shortDate(workout.date)}.`, "good");
    } catch (error) {
      saveButton.disabled = false;
      showNotice("Could not save your changes. Check your internet connection and try again.");
    }
  });
}

// F5: search as you type
searchBox.addEventListener("input", () => {
  if (isConfigured) {
    render();
  } else {
    filterSample();
  }
});

// Preview mode: search the sample workouts already on the page
function filterSample() {
  const words = searchBox.value.toLowerCase().split(/\s+/).filter((w) => w !== "");
  let shown = 0;
  list.querySelectorAll(".week").forEach((week) => {
    let shownInWeek = 0;
    week.querySelectorAll(".workout").forEach((article) => {
      const match = words.every((word) => article.textContent.toLowerCase().includes(word));
      article.hidden = !match;
      if (match) shownInWeek++;
    });
    week.hidden = shownInWeek === 0;
    shown = shown + shownInWeek;
  });
  subtitle.textContent = words.length ? `${shown} of 5 sample workouts match "${searchBox.value.trim()}"` : "5 workouts in the last two weeks";
}

whenLoggedIn(async (user) => {
  uid = user.uid;
  list.innerHTML = '<section class="card"><p class="muted">Loading your workouts…</p></section>';
  try {
    history = await WorkoutHistory.load(uid);
    // The Edit link on the Log page opens a workout ready to change, e.g. history.html#edit-2026-11-13
    const link = location.hash.match(/^#edit-(\d{4}-\d{2}-\d{2})$/);
    if (link) {
      editing = history.onDate(link[1]) || null;
      window.history.replaceState(null, "", "history.html");
    }
    render();
    if (editing) {
      list.querySelector(".editing").scrollIntoView({ block: "center" });
    }
  } catch (error) {
    list.innerHTML = '<section class="card"><p class="muted">Could not load your workouts. Refresh the page to try again.</p></section>';
  }
});
