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
    const workouts = rows.map((row) => new Workout(
      row.id,
      row.date,
      row.sets.map((s) => new WorkoutSet(s.exerciseName, s.reps, s.weight))
    ));
    workouts.sort((a, b) => b.date.localeCompare(a.date));
    return new WorkoutHistory(workouts);
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
    const words = text.toLowerCase().split(" ").filter((w) => w !== "");
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
