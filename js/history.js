// The WorkoutHistory class from our class diagram (F4).
import { Database } from "./database.js";
import { searchText } from "./format.js";
import { Workout, WorkoutSet } from "./workout.js";

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
      const sets = row.sets.map((s) => new WorkoutSet(s.exerciseName, s.reps, s.weight));
      history.add(new Workout(row.id, row.date, sets));
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
          result.push({ date: workout.date, reps: set.reps, weight: set.weight });
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

  // F6: the heaviest weight for each exercise, heaviest first,
  // with the date it was first lifted.
  getPersonalBests() {
    const bests = [];
    // Go from oldest to newest, so a later equal weight does not replace the first date
    [...this.workouts].reverse().forEach((workout) => {
      workout.sets.forEach((set) => {
        const best = bests.find((b) => b.exerciseName === set.exerciseName);
        if (!best) {
          bests.push({ exerciseName: set.exerciseName, weight: set.weight, date: workout.date });
        } else if (set.weight > best.weight) {
          best.weight = set.weight;
          best.date = workout.date;
        }
      });
    });
    return bests.sort((a, b) => b.weight - a.weight || a.exerciseName.localeCompare(b.exerciseName));
  }
}
