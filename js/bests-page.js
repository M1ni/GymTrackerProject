// Code for the Personal bests page (F6).
import { whenLoggedIn } from "./page.js";
import { WorkoutHistory } from "./history.js";
import { drawBarbell, platesText } from "./plates.js";
import { kg, shortDate, dayDate, escapeHtml } from "./format.js";

const top = document.getElementById("top-best");
const list = document.getElementById("bests-body");
const listCard = document.getElementById("other-bests");
const subtitle = document.getElementById("subtitle");

function render(history) {
  const bests = history.getPersonalBests();
  const count = history.workouts.length;
  subtitle.textContent = `Your heaviest weight for each exercise, from ${count} ${count === 1 ? "workout" : "workouts"}`;

  if (bests.length === 0) {
    top.innerHTML = '<div><h2>No personal bests yet</h2><p class="muted" style="margin-top:4px"><a href="log.html">Log a workout</a> and your heaviest lift for each exercise will show here.</p></div>';
    listCard.hidden = true;
    return;
  }

  // The heaviest lift of all gets the big card
  const first = bests[0];
  top.innerHTML = `<div>
      <h2>Heaviest lift</h2>
      <p class="muted" style="margin:4px 0 16px">${escapeHtml(first.exerciseName)} on ${dayDate(first.date)}</p>
      <span class="figure">${kg(first.weight)}<small>kg</small></span>
      <p class="muted" style="margin-top:8px">${platesText(first.weight)} on a 20 kg bar</p>
    </div>
    ${drawBarbell(first.weight)}`;

  // Every other exercise goes in the list below
  const others = bests.slice(1);
  listCard.hidden = others.length === 0;
  list.innerHTML = others.map((b) => `<tr class="best">
      <td class="exercise"><strong>${escapeHtml(b.exerciseName)}</strong><span>${shortDate(b.date)}</span></td>
      <td class="barbell-cell">${drawBarbell(b.weight)}</td>
      <td class="right"><span class="figure">${kg(b.weight)}<small>kg</small></span><span class="plates-text">${platesText(b.weight)}</span></td>
    </tr>`).join("");
}

whenLoggedIn(async (user) => {
  top.innerHTML = '<p class="muted">Loading your personal bests…</p>';
  listCard.hidden = true;
  try {
    render(await WorkoutHistory.load(user.uid));
  } catch (error) {
    top.innerHTML = '<p class="muted">Could not load your personal bests. Refresh the page to try again.</p>';
  }
});
