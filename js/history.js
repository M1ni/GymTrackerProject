// The WorkoutHistory class from our class diagram (F4).
// Searching (F5) and personal bests (F6) are added in week 5.
import { Database } from "./database.js";
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
}
