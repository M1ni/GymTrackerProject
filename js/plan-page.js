// Code for the Training plan page (F7: personalised training plan).
// Showing a plan needs no database, so that also works in preview mode.
// "Use this plan" saves your choice, and the Log page then shows each day's exercises.
import { whenLoggedIn, showNotice } from "./page.js";
import { TrainingPlan } from "./plans.js";
import { Exercise } from "./exercise.js";
import { escapeHtml } from "./format.js";

const form = document.getElementById("plan-form");
const goal = document.getElementById("plan-goal");
const level = document.getElementById("plan-level");
const days = document.getElementById("plan-days");
const result = document.getElementById("plan-result");

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

let uid = null;
let savedPlan = null; // the plan this user chose, if any

function showPlan() {
  const plan = TrainingPlan.findPlan(goal.value, level.value, days.value);
  if (!plan) {
    result.innerHTML = '<p class="muted">No plan matches these choices.</p>';
    return;
  }

  // The week strip: training days in black, rest days in grey
  const strip = WEEK.map((day) => {
    const index = plan.schedule.findIndex((d) => d.day === day);
    if (index === -1) {
      return `<div class="day"><strong>${day}</strong>Rest</div>`;
    }
    return `<div class="day train"><strong>${day}</strong>Day ${index + 1} · ${plan.schedule[index].title}</div>`;
  }).join("");

  // One box per training day with its exercises
  const dayBoxes = plan.schedule.map((d, i) => {
    const items = d.exercises
      .map(([name, sets]) => `<li><span>${escapeHtml(name)}</span><span>${sets}</span></li>`)
      .join("");
    return `<div class="plan-day"><h3>Day ${i + 1} · ${d.title}</h3><ul class="mini-list">${items}</ul></div>`;
  }).join("");

  // Use this plan, or (if it is already yours) stop using it
  const useBox = plan === savedPlan
    ? `<div class="plan-use"><p class="plan-saved">✓ This is your plan. The Log page shows what to do each day.</p>
        <button type="button" id="stop-plan" class="text-button">Stop using it</button></div>`
    : `<div class="plan-use"><button type="button" id="use-plan">Use this plan</button>
        <p class="muted">Adds its exercises to your list, and the Log page shows each day's exercises.</p></div>`;

  result.innerHTML = `
    <h2>${plan.goal}, ${plan.level.toLowerCase()}, ${plan.daysPerWeek} days a week</h2>
    <p class="muted" style="margin-top:4px">${plan.name}. ${plan.tip}</p>
    <div class="week-strip">${strip}</div>
    <div class="plan-days">${dayBoxes}</div>
    ${useBox}
    <p class="muted" style="margin-top:16px;font-size:13px">Start light and learn each exercise with good form. If you have an injury or a health condition, check with a doctor first.</p>`;

  const useButton = document.getElementById("use-plan");
  if (useButton) useButton.addEventListener("click", () => usePlan(plan, useButton));
  const stopButton = document.getElementById("stop-plan");
  if (stopButton) stopButton.addEventListener("click", stopPlan);
}

async function usePlan(plan, button) {
  if (!uid) {
    showNotice("Preview mode: Firebase is not set up yet, so nothing is saved.");
    return;
  }
  button.disabled = true;
  try {
    const have = await Exercise.getAll(uid);
    const added = await Exercise.addMissing(uid, plan.exerciseNames(), have);
    await plan.use(uid);
    savedPlan = plan;
    showPlan();
    const addedText = added.length ? ` ${added.length} of its exercises were added to your list.` : "";
    showNotice(`This is now your plan.${addedText} The Log page shows what to do each day.`, "good");
  } catch (error) {
    button.disabled = false;
    showNotice("Could not save your plan. Check your internet connection and try again.");
  }
}

async function stopPlan() {
  if (!confirm("Stop using this plan? Your workouts and exercises stay.")) {
    return;
  }
  try {
    await TrainingPlan.stop(uid);
    savedPlan = null;
    showPlan();
    showNotice("You are not following a plan now.");
  } catch (error) {
    showNotice("Could not change your plan. Check your internet connection and try again.");
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  showPlan();
});

showPlan();

// Once we know who is logged in, show their plan if they chose one
// again is true when the page is shown again with newer data: keep the user's choices
whenLoggedIn(async (user, again) => {
  uid = user.uid;
  try {
    savedPlan = await TrainingPlan.load(uid);
    if (savedPlan && !again) {
      goal.value = savedPlan.goal;
      level.value = savedPlan.level;
      days.value = String(savedPlan.daysPerWeek);
    }
  } catch (error) {
    showNotice("Could not load your plan. Refresh the page to try again.");
  }
  showPlan();
});
