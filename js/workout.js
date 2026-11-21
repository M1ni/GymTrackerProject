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
    // Every "Save workout" saves one document, so one gym session with 3 exercises
    // is 3 documents. ids lists all of them (see WorkoutHistory.load).
    this.ids = id ? [id] : [];
  }

  // Saves the workout to Firebase and remembers its new ID.
  async save(uid) {
    this.id = await Database.save(`users/${uid}/workouts`, {
      date: this.date,
      // So the exercises of one day are shown in the order they were done
      savedAt: Date.now(),
      // Firebase stores plain objects, not class objects
      sets: this.sets.map((s) => ({ exerciseName: s.exerciseName, reps: s.reps, weight: s.weight }))
    });
    this.ids = [this.id];
  }

  // Deletes the whole workout (every document saved for it).
  async delete(uid) {
    for (const id of this.ids) {
      await Database.delete(`users/${uid}/workouts/${id}`);
    }
  }
}
