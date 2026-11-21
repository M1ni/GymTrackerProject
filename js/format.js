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

// "2026-11-13" -> "Fri" (the short day names the training plans use)
export function weekday(text) {
  return DAYS[toDate(text).getDay()];
}

// A date some days later (or earlier, with a minus number), as "YYYY-MM-DD"
export function addDays(text, days) {
  const d = toDate(text);
  d.setDate(d.getDate() + days);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

// The Monday of that date's week, as "YYYY-MM-DD"
export function weekStart(text) {
  const back = (toDate(text).getDay() + 6) % 7; // Monday = 0 days back
  return addDays(text, -back);
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

// A weight as text. No weight (0) means the exercise was done with bodyweight.
// 57.5 -> "57.5 kg", 0 -> "bodyweight"
export function weightText(weight) {
  return weight ? `${kg(weight)} kg` : "bodyweight";
}

// One set as text: "8 reps at 57.5 kg", "10 reps at bodyweight", or "45 s" for a timed
// exercise like a plank (timed sets have seconds instead of reps).
export function setText(set) {
  if (set.seconds != null) {
    return set.weight ? `${set.seconds} s with ${kg(set.weight)} kg` : `${set.seconds} s`;
  }
  return `${set.reps} reps at ${weightText(set.weight)}`;
}

// Describes the sets of one exercise:
// all the same -> "3 × 8 at 57.5 kg", otherwise -> "10, 8, 6 reps at 50, 55, 60 kg".
// Bodyweight -> "3 × 12 at bodyweight", timed -> "3 × 45 s".
export function describeSets(sets) {
  const timed = sets[0].seconds != null;
  const amounts = sets.map((s) => (timed ? s.seconds ?? s.reps : s.reps ?? s.seconds));
  const sameAmount = amounts.every((a) => a === amounts[0]);
  const sameWeight = sets.every((s) => s.weight === sets[0].weight);

  if (timed) {
    const time = sameAmount ? `${sets.length} × ${amounts[0]} s` : `${amounts.join(", ")} s`;
    if (sets.every((s) => !s.weight)) {
      return time;
    }
    return `${time} with ${sameWeight ? kg(sets[0].weight) : sets.map((s) => kg(s.weight)).join(", ")} kg`;
  }

  if (sameAmount && sameWeight) {
    return `${sets.length} × ${amounts[0]} at ${weightText(sets[0].weight)}`;
  }
  let weights;
  if (sameWeight) {
    weights = weightText(sets[0].weight);
  } else if (sets.some((s) => !s.weight)) {
    weights = sets.map((s) => weightText(s.weight)).join(", ");
  } else {
    weights = `${sets.map((s) => kg(s.weight)).join(", ")} kg`;
  }
  return `${amounts.join(", ")} reps at ${weights}`;
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
// Timed sets have no reps, so they add nothing.
export function volume(sets) {
  const total = sets.reduce((sum, s) => sum + (s.reps || 0) * s.weight, 0);
  return Math.round(total).toLocaleString("en-GB");
}

// A personal best as text (see bestOf in history.js): "110 kg", "12 reps" or "60 s"
export function bestText(best) {
  if (best.seconds != null) return `${best.seconds} s`;
  if (best.reps != null) return `${best.reps} reps`;
  return `${kg(best.weight)} kg`;
}

// The same, as a big number with a small unit, e.g. 110<small>kg</small>
export function bestFigure(best) {
  const [number, unit] = bestText(best).split(" ");
  return `${number}<small>${unit}</small>`;
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
