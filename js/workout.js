// The Workout and WorkoutSet classes from our class diagram (F3).
import { Database } from "./database.js";

export class WorkoutSet {
  constructor(exerciseName, reps, weight) {
    this.exerciseName = exerciseName;
    this.reps = reps;
    this.weight = weight;
  }
}

// Firebase stores plain objects, not class objects
function toPlain(sets) {
  return sets.map((s) => ({ exerciseName: s.exerciseName, reps: s.reps, weight: s.weight }));
}

export class Workout {
  // date is a "YYYY-MM-DD" string, sets is a list of WorkoutSet
  constructor(id, date, sets) {
    this.id = id;
    this.date = date;
    this.sets = sets;
    // Every "Save workout" saves one document, so one gym session with 3 exercises
    // is 3 documents. ids lists all of them (see WorkoutHistory.add).
    this.ids = id ? [id] : [];
  }

  // Saves the workout to Firebase and remembers its new ID.
  async save(uid) {
    this.id = await Database.save(`users/${uid}/workouts`, {
      date: this.date,
      // So the exercises of one day are shown in the order they were done
      savedAt: Date.now(),
      sets: toPlain(this.sets)
    });
    this.ids = [this.id];
  }

  // Saves a changed list of sets, e.g. after fixing a wrong weight or removing a set.
  // All of the day's sets go into its first document and the other documents
  // are deleted, in one go (see Database.replace).
  async saveChanges(uid, sets) {
    const [first, ...others] = this.ids;
    await Database.replace(
      `users/${uid}/workouts/${first}`,
      { sets: toPlain(sets) },
      others.map((id) => `users/${uid}/workouts/${id}`)
    );
    this.id = first;
    this.ids = [first];
    this.sets = sets;
  }

  // Deletes the whole workout (every document saved for it).
  async delete(uid) {
    for (const id of this.ids) {
      await Database.delete(`users/${uid}/workouts/${id}`);
    }
  }
}
