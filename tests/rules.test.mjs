// Tests for firestore.rules, run against the real Firestore emulator.
// Run with: npm run test:rules   (from the tests folder; needs Java 21)
// The project id starts with "demo-", so the emulator never touches our real Firebase project.
import { test, before, after } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { collection, addDoc, getDocs, getDoc, deleteDoc, doc, setDoc, writeBatch } from "firebase/firestore";

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-gymtrack",
    firestore: {
      rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"),
      host: "127.0.0.1",
      port: 8085
    }
  });
});

after(() => env.cleanup());

const andrew = () => env.authenticatedContext("andrew").firestore();
const bogdan = () => env.authenticatedContext("bogdan").firestore();
const loggedOut = () => env.unauthenticatedContext().firestore();

// Puts a workout in the database without checking the rules (to set up a test)
const addWorkoutForAndrew = (id) => env.withSecurityRulesDisabled((context) =>
  setDoc(doc(context.firestore(), `users/andrew/workouts/${id}`), { date: "2026-11-13", savedAt: 1, sets: [] })
);

test("you can add, read and delete your own exercises and workouts", async () => {
  const db = andrew();
  const exercise = await assertSucceeds(addDoc(collection(db, "users/andrew/exercises"), { name: "Squat" }));
  const workout = await assertSucceeds(addDoc(collection(db, "users/andrew/workouts"), {
    date: "2026-11-13", savedAt: 1, sets: [{ exerciseName: "Squat", reps: 5, weight: 85 }]
  }));
  await assertSucceeds(getDocs(collection(db, "users/andrew/exercises")));
  await assertSucceeds(getDocs(collection(db, "users/andrew/workouts")));
  await assertSucceeds(deleteDoc(doc(db, `users/andrew/exercises/${exercise.id}`)));
  await assertSucceeds(deleteDoc(doc(db, `users/andrew/workouts/${workout.id}`)));
});

test("you can change your own workout in one go (what Edit and Remove do)", async () => {
  await addWorkoutForAndrew("first");
  await addWorkoutForAndrew("second");
  const db = andrew();
  const batch = writeBatch(db);
  batch.update(doc(db, "users/andrew/workouts/first"), { sets: [{ exerciseName: "Squat", reps: 5, weight: 90 }] });
  batch.delete(doc(db, "users/andrew/workouts/second"));
  await assertSucceeds(batch.commit());
});

test("another user cannot read, add, change or delete your data", async () => {
  await addWorkoutForAndrew("w1");
  const db = bogdan();
  await assertFails(getDocs(collection(db, "users/andrew/workouts")));
  await assertFails(getDoc(doc(db, "users/andrew/workouts/w1")));
  await assertFails(addDoc(collection(db, "users/andrew/workouts"), { date: "2026-11-13", sets: [] }));
  await assertFails(deleteDoc(doc(db, "users/andrew/workouts/w1")));
  const batch = writeBatch(db);
  batch.update(doc(db, "users/andrew/workouts/w1"), { sets: [] });
  await assertFails(batch.commit());
});

test("logged-out visitors cannot read or write anything", async () => {
  await assertFails(getDocs(collection(loggedOut(), "users/andrew/workouts")));
  await assertFails(addDoc(collection(loggedOut(), "users/andrew/workouts"), { date: "2026-11-13", sets: [] }));
});

test("nothing outside users/{your id} can be read or written", async () => {
  await assertFails(getDocs(collection(andrew(), "users")));
  await assertFails(addDoc(collection(andrew(), "public"), { hello: "world" }));
});
