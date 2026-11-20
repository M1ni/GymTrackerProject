// Code for the History page (F4: view and delete past workouts, F5: search).
import { whenLoggedIn, showNotice } from "./page.js";
import { isConfigured } from "./firebase.js";
import { WorkoutHistory } from "./history.js";
import { drawBarbell } from "./plates.js";
import { kg, shortDate, dayName, weekStart, weekTitle, describeSets, groupByExercise, heaviest, escapeHtml } from "./format.js";

const list = document.getElementById("workout-list");
const subtitle = document.getElementById("subtitle");
const searchBox = document.getElementById("search-box");

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
  const query = searchBox.value.trim();
  const workouts = query ? history.search(query) : history.workouts;
  const total = history.workouts.length;

  if (query) {
    subtitle.textContent = `${workouts.length} of ${total} workouts match "${query}"`;
  } else {
    subtitle.textContent = total === 1 ? "1 workout" : `${total} workouts`;
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
  const words = searchBox.value.toLowerCase().split(" ").filter((w) => w !== "");
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
    render();
  } catch (error) {
    list.innerHTML = '<section class="card"><p class="muted">Could not load your workouts. Refresh the page to try again.</p></section>';
  }
});
