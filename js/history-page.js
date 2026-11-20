// Code for the History page (F4: view and delete past workouts).
// Searching (F5) is added in week 5.
import { whenLoggedIn, showNotice } from "./page.js";
import { WorkoutHistory } from "./history.js";
import { drawBarbell } from "./plates.js";
import { kg, shortDate, dayName, weekStart, weekTitle, describeSets, groupByExercise, heaviest, escapeHtml } from "./format.js";

const list = document.getElementById("workout-list");
const subtitle = document.getElementById("subtitle");

let uid = null;
let history = new WorkoutHistory([]);

// The HTML for one workout
function workoutHtml(workout, index) {
  const lifts = groupByExercise(workout.sets)
    .map((g) => `<li>${escapeHtml(g.name)} <span>${describeSets(g.sets)}</span></li>`)
    .join("");
  const top = heaviest(workout.sets);
  return `<article class="workout">
    <div class="workout-date"><strong>${shortDate(workout.date)}</strong><span>${dayName(workout.date)}</span></div>
    <ul class="workout-lifts">${lifts}</ul>
    <div class="workout-top">${drawBarbell(top)}<span class="num">Heaviest set <strong>${kg(top)} kg</strong></span></div>
    <div class="workout-side"><span class="num">${workout.sets.length} sets</span><button class="text-button" data-index="${index}">Delete</button></div>
  </article>`;
}

function render() {
  const workouts = history.workouts;
  subtitle.textContent = workouts.length === 1 ? "1 workout" : `${workouts.length} workouts`;

  if (workouts.length === 0) {
    list.innerHTML = '<section class="card"><p class="muted">No workouts yet. <a href="log.html">Log your first workout</a> and it will show here.</p></section>';
    return;
  }

  // Group the workouts by week (newest week first)
  const weeks = [];
  workouts.forEach((workout, index) => {
    const monday = weekStart(workout.date);
    let week = weeks.find((w) => w.monday === monday);
    if (!week) {
      week = { monday: monday, html: [] };
      weeks.push(week);
    }
    week.html.push(workoutHtml(workout, index));
  });

  list.innerHTML = weeks.map((week) => `<section class="card week">
    <h2>${weekTitle(week.monday)}</h2>
    ${week.html.join("")}
  </section>`).join("");

  list.querySelectorAll("button[data-index]").forEach((button) => {
    const workout = workouts[Number(button.dataset.index)];
    button.addEventListener("click", () => deleteWorkout(workout));
  });
}

async function deleteWorkout(workout) {
  if (!confirm(`Delete your workout from ${shortDate(workout.date)}? This cannot be undone.`)) {
    return;
  }
  try {
    await workout.delete(uid);
    history.workouts = history.workouts.filter((w) => w !== workout);
    render();
  } catch (error) {
    showNotice("Could not delete the workout. Check your internet connection and try again.");
  }
}

whenLoggedIn(async (user) => {
  uid = user.uid;
  list.innerHTML = '<section class="card"><p class="muted">Loading your workouts…</p></section>';
  try {
    history = await WorkoutHistory.load(uid);
    render();
  } catch (error) {
    list.innerHTML = '<section class="card"><p class="muted">Could not load your workouts. Refresh the page to try again.</p></section>';
  }
});
