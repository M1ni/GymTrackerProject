// Code for the Training plan page (F7: personalised training plan).
// It needs no database, so it also works in preview mode.
import "./page.js";
import { TrainingPlan } from "./plans.js";
import { escapeHtml } from "./format.js";

const form = document.getElementById("plan-form");
const goal = document.getElementById("plan-goal");
const level = document.getElementById("plan-level");
const days = document.getElementById("plan-days");
const result = document.getElementById("plan-result");

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

  result.innerHTML = `
    <h2>${plan.goal}, ${plan.level.toLowerCase()}, ${plan.daysPerWeek} days a week</h2>
    <p class="muted" style="margin-top:4px">${plan.name}. ${plan.tip}</p>
    <div class="week-strip">${strip}</div>
    <div class="plan-days">${dayBoxes}</div>
    <p class="muted" style="margin-top:16px;font-size:13px">Start light and learn each exercise with good form. If you have an injury or a health condition, check with a doctor first.</p>`;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  showPlan();
});

showPlan();
