// The Workout and WorkoutSet classes from our class diagram (F3).
import { Database } from "./database.js";

export class WorkoutSet {
  constructor(exerciseName, reps, weight) {
    this.exerciseName = exerciseName;
    this.reps = reps;
    this.weight = weight;
  }
}

export class Workout {
  // date is a "YYYY-MM-DD" string, sets is a list of WorkoutSet
  constructor(id, date, sets) {
    this.id = id;
    this.date = date;
    this.sets = sets;
  }

  // Saves the workout to Firebase and remembers its new ID.
  async save(uid) {
    this.id = await Database.save(`users/${uid}/workouts`, {
      date: this.date,
      // Firebase stores plain objects, not class objects
      sets: this.sets.map((s) => ({ exerciseName: s.exerciseName, reps: s.reps, weight: s.weight }))
    });
  }

  async delete(uid) {
    await Database.delete(`users/${uid}/workouts/${this.id}`);
  }
}
