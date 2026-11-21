// The WorkoutHistory class from our class diagram (F4).
import { Database } from "./database.js";
import { searchText } from "./format.js";
import { Workout, fromPlain } from "./workout.js";

// The best set of an exercise. sets can be in any order, each with its date.
// Usually it is the heaviest weight. For exercises done without weights it is the
// most reps, and for timed ones (like a plank) the longest time.
// Returns e.g. { weight: 110, date: "2026-11-09" }, with the first date it was done.
export function bestOf(sets) {
  let field = "weight";
  if (sets.some((s) => s.seconds != null)) {
    field = "seconds";
  } else if (sets.every((s) => !s.weight)) {
    field = "reps";
  }
  const counted = sets.filter((s) => s[field] != null);
  const top = Math.max(...counted.map((s) => s[field]));
  const date = counted.filter((s) => s[field] === top).map((s) => s.date).sort()[0];
  return { [field]: top, date };
}

// What a best is measured in: "weight", "reps" or "seconds"
export function bestField(best) {
  return ["seconds", "reps", "weight"].find((field) => best[field] != null);
}

export class WorkoutHistory {
  constructor(workouts) {
    this.workouts = workouts; // newest first
  }

  // Loads all of this user's workouts from Firebase, newest first.
  static async load(uid) {
    const rows = await Database.getAll(`users/${uid}/workouts`);
    // In the order they were saved (older saves have no savedAt, so they go first)
    rows.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
    const history = new WorkoutHistory([]);
    rows.forEach((row) => {
      history.add(new Workout(row.id, row.date, row.sets.map(fromPlain)));
    });
    return history;
  }

  // Adds a saved workout, keeping the list newest first.
  // "Save workout" saves each exercise as its own document, so a workout on a date
  // that is already here is joined to it: one Workout per date (one gym session).
  add(workout) {
    const sameDay = this.onDate(workout.date);
    if (sameDay) {
      sameDay.sets.push(...workout.sets);
      sameDay.ids.push(...workout.ids);
    } else {
      this.workouts.push(workout);
      this.workouts.sort((a, b) => b.date.localeCompare(a.date));
    }
  }

  // The workout on one date, e.g. "2026-11-13", or undefined if there is none.
  onDate(date) {
    return this.workouts.find((w) => w.date === date);
  }

  // Takes a deleted workout out of the list.
  remove(workout) {
    this.workouts = this.workouts.filter((w) => w !== workout);
  }

  // All the sets done for one exercise, with the date of each, newest first.
  setsFor(exerciseName) {
    const result = [];
    this.workouts.forEach((workout) => {
      workout.sets.forEach((set) => {
        if (set.exerciseName === exerciseName) {
          result.push({ date: workout.date, reps: set.reps, weight: set.weight, seconds: set.seconds });
        }
      });
    });
    return result;
  }

  // F5: the workouts that match every word typed, e.g. "squat", "13 nov", "friday" or "bench nov".
  search(text) {
    // Split on any space, so a non-breaking space (e.g. pasted text) also works
    const words = text.toLowerCase().split(/\s+/).filter((w) => w !== "");
    return this.workouts.filter((workout) => {
      const haystack = searchText(workout).split(" ");
      // A number must match a whole word (so "11" finds 11 Nov, not the "11" inside 2026-11-02).
      // Other words only need to match the start of a word, so "dead" finds Deadlift.
      return words.every((word) => haystack.some((h) =>
        /^\d+$/.test(word) ? h === word : h.startsWith(word)
      ));
    });
  }

  // F6: the best set for each exercise (see bestOf), with the date it was first done.
  // Heaviest weights first, then the most reps, then the longest times.
  getPersonalBests() {
    const byExercise = new Map();
    this.workouts.forEach((workout) => {
      workout.sets.forEach((set) => {
        if (!byExercise.has(set.exerciseName)) {
          byExercise.set(set.exerciseName, []);
        }
        byExercise.get(set.exerciseName).push({ ...set, date: workout.date });
      });
    });
    const bests = [...byExercise].map(([exerciseName, sets]) => ({ exerciseName, ...bestOf(sets) }));
    const order = ["weight", "reps", "seconds"];
    return bests.sort((a, b) => {
      const fieldA = bestField(a);
      const fieldB = bestField(b);
      return order.indexOf(fieldA) - order.indexOf(fieldB) ||
        b[fieldB] - a[fieldA] ||
        a.exerciseName.localeCompare(b.exerciseName);
    });
  }
}
