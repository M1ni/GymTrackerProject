// Code for the Personal bests page (F6).
import { whenLoggedIn } from "./page.js";
import { WorkoutHistory } from "./history.js";
import { drawBarbell, platesText, BAR } from "./plates.js";
import { shortDate, dayDate, escapeHtml, bestFigure } from "./format.js";

const top = document.getElementById("top-best");
const list = document.getElementById("bests-body");
const listCard = document.getElementById("other-bests");
const subtitle = document.getElementById("subtitle");

// The plates text, or nothing for lighter lifts such as dumbbells (12 kg is not "less than the bar")
// and for exercises without weights (their best is reps or seconds)
function platesFor(best) {
  return best.weight >= BAR ? platesText(best.weight) : "";
}

function render(history) {
  const bests = history.getPersonalBests();
  const count = history.workouts.length;
  subtitle.textContent = `Your best set for each exercise, from ${count} ${count === 1 ? "workout" : "workouts"}`;

  if (bests.length === 0) {
    top.innerHTML = '<div><h2>No personal bests yet</h2><p class="muted" style="margin-top:4px"><a href="log.html">Log a workout</a> and your heaviest lift for each exercise will show here.</p></div>';
    listCard.hidden = true;
    return;
  }

  // The heaviest lift of all gets the big card (or the first best, if nothing used weights)
  const first = bests.find((b) => b.weight) || bests[0];
  top.innerHTML = `<div>
      <h2>${first.weight ? "Heaviest lift" : "Best set"}</h2>
      <p class="muted" style="margin:4px 0 16px">${escapeHtml(first.exerciseName)} on ${dayDate(first.date)}</p>
      <span class="figure">${bestFigure(first)}</span>
      ${platesFor(first) ? `<p class="muted" style="margin-top:8px">${platesFor(first)} on a 20 kg bar</p>` : ""}
    </div>
    ${first.weight ? drawBarbell(first.weight) : ""}`;

  // Every other exercise goes in the list below
  const others = bests.filter((b) => b !== first);
  listCard.hidden = others.length === 0;
  list.innerHTML = others.map((b) => `<tr class="best">
      <td class="exercise"><strong>${escapeHtml(b.exerciseName)}</strong><span>${shortDate(b.date)}</span></td>
      <td class="barbell-cell">${b.weight ? drawBarbell(b.weight) : ""}</td>
      <td class="right"><span class="figure">${bestFigure(b)}</span><span class="plates-text">${platesFor(b)}</span></td>
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
