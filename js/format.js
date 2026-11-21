// Small helpers that turn saved data into text for the pages.
// They do not use Firebase, so they can be tested on their own.

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LONG_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "2026-11-13" -> a Date at midday (midday avoids time zone surprises)
function toDate(text) {
  return new Date(text + "T12:00:00");
}

// "2026-11-13" -> "13 Nov"
export function shortDate(text) {
  const d = toDate(text);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// "2026-11-13" -> "Fri 13 Nov"
export function dayDate(text) {
  return `${DAYS[toDate(text).getDay()]} ${shortDate(text)}`;
}

// "2026-11-13" -> "Friday"
export function dayName(text) {
  return LONG_DAYS[toDate(text).getDay()];
}

// The Monday of that date's week, as "YYYY-MM-DD"
export function weekStart(text) {
  const d = toDate(text);
  const back = (d.getDay() + 6) % 7; // Monday = 0 days back
  d.setDate(d.getDate() - back);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

// "2026-11-09" -> "Week of 9 November"
export function weekTitle(mondayText) {
  const d = toDate(mondayText);
  return `Week of ${d.getDate()} ${LONG_MONTHS[d.getMonth()]}`;
}

// 57.5 -> "57.5", 60 -> "60"
export function kg(number) {
  return String(Math.round(number * 100) / 100);
}

// Describes the sets of one exercise:
// all the same -> "3 × 8 at 57.5 kg", otherwise -> "10, 8, 6 reps at 50, 55, 60 kg"
export function describeSets(sets) {
  const sameReps = sets.every((s) => s.reps === sets[0].reps);
  const sameWeight = sets.every((s) => s.weight === sets[0].weight);
  if (sameReps && sameWeight) {
    return `${sets.length} × ${sets[0].reps} at ${kg(sets[0].weight)} kg`;
  }
  const reps = sets.map((s) => s.reps).join(", ");
  const weights = sameWeight ? kg(sets[0].weight) : sets.map((s) => kg(s.weight)).join(", ");
  return `${reps} reps at ${weights} kg`;
}

// Groups a workout's sets by exercise, keeping the order they were done in.
export function groupByExercise(sets) {
  const groups = [];
  sets.forEach((set) => {
    let group = groups.find((g) => g.name === set.exerciseName);
    if (!group) {
      group = { name: set.exerciseName, sets: [] };
      groups.push(group);
    }
    group.sets.push(set);
  });
  return groups;
}

// The heaviest weight in a list of sets (0 if the list is empty).
export function heaviest(sets) {
  return sets.reduce((max, s) => Math.max(max, s.weight), 0);
}

// The total weight lifted: reps × weight of every set, added up, e.g. "4,350".
export function volume(sets) {
  const total = sets.reduce((sum, s) => sum + s.reps * s.weight, 0);
  return Math.round(total).toLocaleString("en-GB");
}

// Makes text safe to put inside HTML (so a name like "<b>" shows as text).
export function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// All the words a workout can be found by: its date written in different ways and its exercises.
export function searchText(workout) {
  const d = toDate(workout.date);
  const exercises = workout.sets.map((s) => s.exerciseName).join(" ");
  return [
    workout.date,
    shortDate(workout.date),
    dayName(workout.date),
    LONG_MONTHS[d.getMonth()],
    String(d.getFullYear()),
    exercises
  ].join(" ").toLowerCase();
}
