// The Exercise class from our class diagram (F2).
import { Database } from "./database.js";

// The kinds of exercise. They change what you type on the Log page:
// "weights" (kg and reps), "bodyweight" (reps, and extra kg if you add any)
// and "timed" (seconds, like a plank).
export const KIND_NAMES = {
  weights: "With weights",
  bodyweight: "Bodyweight",
  timed: "Timed (seconds)"
};

// Exercises we know are not done with weights
const KNOWN_KINDS = {
  "pull-ups": "bodyweight",
  "chin-ups": "bodyweight",
  "push-ups": "bodyweight",
  "triceps dips": "bodyweight",
  "dips": "bodyweight",
  "sit-ups": "bodyweight",
  "plank": "timed",
  "side plank": "timed",
  "wall sit": "timed",
  "dead hang": "timed"
};

// The kind of an exercise from its name, e.g. "Plank" -> "timed". Anything else -> "weights".
export function kindOf(name) {
  return KNOWN_KINDS[name.trim().toLowerCase()] || "weights";
}

// A typed name without extra spaces, e.g. "  Lat   pulldown " -> "Lat pulldown"
export function tidyName(name) {
  return name.trim().replace(/\s+/g, " ");
}

// The common exercises a new account can add in one click (the main ones in our plans)
export const COMMON_EXERCISES = [
  "Squat", "Bench press", "Deadlift", "Shoulder press", "Barbell row",
  "Lat pulldown", "Biceps curls", "Pull-ups", "Triceps dips", "Plank"
];

export class Exercise {
  constructor(id, name, kind = "weights") {
    this.id = id;
    this.name = name;
    this.kind = kind;
  }

  // Adds a new exercise to this user's list.
  static async add(uid, name, kind = "weights") {
    const id = await Database.save(`users/${uid}/exercises`, { name, kind });
    return new Exercise(id, name, kind);
  }

  // Adds the exercises in names that are not in the list yet (have), all in one go.
  // Used for the common exercises, and for the exercises of a training plan.
  static async addMissing(uid, names, have) {
    const missing = names.filter((name) => !have.some((e) => e.name.toLowerCase() === name.toLowerCase()));
    if (missing.length === 0) {
      return [];
    }
    const ids = await Database.saveMany(`users/${uid}/exercises`, missing.map((name) => ({ name, kind: kindOf(name) })));
    return missing.map((name, i) => new Exercise(ids[i], name, kindOf(name)));
  }

  // Loads all of this user's exercises, sorted A to Z.
  static async getAll(uid) {
    const rows = await Database.getAll(`users/${uid}/exercises`);
    return rows
      .map((row) => new Exercise(row.id, row.name, row.kind || "weights"))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Changes the name and the kind. A new name is also changed in every past workout,
  // all in one go, so your history and bests stay together.
  async update(uid, name, kind, workouts) {
    const updates = [[`users/${uid}/exercises/${this.id}`, { name, kind }]];
    const deletes = [];
    const changedWorkouts = [];
    if (name !== this.name) {
      workouts.forEach((workout) => {
        if (!workout.sets.some((s) => s.exerciseName === this.name)) {
          return;
        }
        const sets = workout.sets.map((s) => (s.exerciseName === this.name ? s.renamed(name) : s));
        const changes = workout.changesFor(uid, sets);
        updates.push(...changes.updates);
        deletes.push(...changes.deletes);
        changedWorkouts.push([workout, sets]);
      });
    }
    await Database.saveAll(updates, deletes);
    this.name = name;
    this.kind = kind;
    changedWorkouts.forEach(([workout, sets]) => workout.changed(sets));
  }

  // Deletes this exercise. Old workouts keep the name, because each set stores it as text.
  async delete(uid) {
    await Database.delete(`users/${uid}/exercises/${this.id}`);
  }
}
