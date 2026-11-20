// The Exercise class from our class diagram (F2).
import { Database } from "./database.js";

export class Exercise {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }

  // Adds a new exercise to this user's list.
  static async add(uid, name) {
    const id = await Database.save(`users/${uid}/exercises`, { name: name });
    return new Exercise(id, name);
  }

  // Loads all of this user's exercises, sorted A to Z.
  static async getAll(uid) {
    const rows = await Database.getAll(`users/${uid}/exercises`);
    return rows
      .map((row) => new Exercise(row.id, row.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Deletes this exercise. Old workouts keep the name, because each set stores it as text.
  async delete(uid) {
    await Database.delete(`users/${uid}/exercises/${this.id}`);
  }
}
