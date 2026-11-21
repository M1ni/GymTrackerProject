// The Workout and WorkoutSet classes from our class diagram (F3).
import { Database } from "./database.js";

export class WorkoutSet {
  // A timed exercise (like a plank) has seconds instead of reps: reps is null.
  // weight 0 means bodyweight.
  constructor(exerciseName, reps, weight, seconds = null) {
    this.exerciseName = exerciseName;
    this.reps = reps;
    this.weight = weight;
    this.seconds = seconds;
  }

  // The same set under a new exercise name (see Exercise.update)
  renamed(name) {
    return new WorkoutSet(name, this.reps, this.weight, this.seconds);
  }
}

// Firebase stores plain objects, not class objects. A timed set saves seconds instead of reps.
function toPlain(sets) {
  return sets.map((s) => (s.seconds !== null
    ? { exerciseName: s.exerciseName, seconds: s.seconds, weight: s.weight }
    : { exerciseName: s.exerciseName, reps: s.reps, weight: s.weight }));
}

// And back from Firebase to a WorkoutSet
export function fromPlain(s) {
  return new WorkoutSet(s.exerciseName, s.reps ?? null, s.weight ?? 0, s.seconds ?? null);
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

  // The database changes that save a new list of sets for this day: all of the day's sets
  // go into its first document, and its other documents are deleted.
  changesFor(uid, sets) {
    const [first, ...others] = this.ids;
    return {
      updates: [[`users/${uid}/workouts/${first}`, { sets: toPlain(sets) }]],
      deletes: others.map((id) => `users/${uid}/workouts/${id}`)
    };
  }

  // Call this once those changes are saved.
  changed(sets) {
    this.id = this.ids[0];
    this.ids = [this.id];
    this.sets = sets;
  }

  // Saves a changed list of sets, e.g. after fixing a wrong weight or removing a set.
  // Everything is saved in one go (see Database.saveAll).
  async saveChanges(uid, sets) {
    const { updates, deletes } = this.changesFor(uid, sets);
    await Database.saveAll(updates, deletes);
    this.changed(sets);
  }

  // Deletes the whole workout (every document saved for it), in one go.
  async delete(uid) {
    await Database.saveAll([], this.ids.map((id) => `users/${uid}/workouts/${id}`));
  }
}
