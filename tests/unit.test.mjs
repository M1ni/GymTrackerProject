// Unit tests: the parts of GymTrack that do not need a browser.
// Run with: npm run test:unit   (from the tests folder)
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import * as format from "../js/format.js";
import * as plates from "../js/plates.js";
import { TrainingPlan } from "../js/plans.js";
import { WorkoutHistory } from "../js/history.js";
import { Workout, WorkoutSet } from "../js/workout.js";
import { Database } from "../js/database.js";
import { User, friendlyError } from "../js/user.js";

// A workout from a date and [name, reps, weight] lists
let nextId = 1;
const workout = (date, ...sets) => new Workout(`w${nextId++}`, date, sets.map(([n, r, w]) => new WorkoutSet(n, r, w)));

// The stand-in database, with one logged-in user "u1"
const fakeState = () => JSON.parse(localStorage.getItem("fakeFirebase"));
beforeEach(() => {
  localStorage.setItem("fakeFirebase", JSON.stringify({
    accounts: { "a@b.co": { uid: "u1", email: "a@b.co", password: "secret1" } },
    current: "u1", docs: {}, nextId: 1, calls: [], resetEmails: [], offline: false
  }));
});

// ---------- format.js ----------

test("dates are written the short and long way", () => {
  assert.equal(format.shortDate("2026-11-13"), "13 Nov");
  assert.equal(format.dayDate("2026-11-13"), "Fri 13 Nov");
  assert.equal(format.dayName("2026-11-13"), "Friday");
  assert.equal(format.shortDate("2026-01-01"), "1 Jan");
  assert.equal(format.dayName("2024-02-29"), "Thursday");
});

test("weekStart is the Monday, also across months, years and clock changes", () => {
  assert.equal(format.weekStart("2026-11-13"), "2026-11-09"); // Friday
  assert.equal(format.weekStart("2026-11-09"), "2026-11-09"); // Monday itself
  assert.equal(format.weekStart("2026-11-15"), "2026-11-09"); // Sunday
  assert.equal(format.weekStart("2026-11-01"), "2026-10-26"); // across a month
  assert.equal(format.weekStart("2027-01-02"), "2026-12-28"); // across a year
  assert.equal(format.weekStart("2026-03-29"), "2026-03-23"); // clocks go forward
  assert.equal(format.weekStart("2026-10-25"), "2026-10-19"); // clocks go back
  assert.equal(format.weekTitle("2026-11-09"), "Week of 9 November");
});

test("kg drops trailing zeros and rounds to 2 decimals", () => {
  assert.equal(format.kg(60), "60");
  assert.equal(format.kg(57.5), "57.5");
  assert.equal(format.kg(0.1 + 0.2), "0.3");
});

test("describeSets", () => {
  const sets = (...list) => list.map(([reps, weight]) => ({ reps, weight }));
  assert.equal(format.describeSets(sets([8, 57.5], [8, 57.5], [8, 57.5])), "3 × 8 at 57.5 kg");
  assert.equal(format.describeSets(sets([10, 50], [8, 55], [6, 60])), "10, 8, 6 reps at 50, 55, 60 kg");
  assert.equal(format.describeSets(sets([10, 50], [8, 50])), "10, 8 reps at 50 kg");
  assert.equal(format.describeSets(sets([5, 100])), "1 × 5 at 100 kg");
});

test("groupByExercise keeps the order the exercises were done in", () => {
  const groups = format.groupByExercise([{ exerciseName: "A" }, { exerciseName: "B" }, { exerciseName: "A" }]);
  assert.deepEqual(groups.map((g) => [g.name, g.sets.length]), [["A", 2], ["B", 1]]);
});

test("heaviest and volume (total weight lifted)", () => {
  assert.equal(format.heaviest([]), 0);
  assert.equal(format.heaviest([{ weight: 50 }, { weight: 82.5 }, { weight: 60 }]), 82.5);
  assert.equal(format.volume([]), "0");
  assert.equal(format.volume([{ reps: 5, weight: 100 }, { reps: 10, weight: 40 }]), "900");
  assert.equal(format.volume([{ reps: 3, weight: 62.5 }]), "188"); // 187.5 rounds up
  assert.equal(format.volume([{ reps: 10, weight: 435 }]), "4,350");
  assert.equal(format.volume([{ reps: 10, weight: 0 }]), "0"); // bodyweight exercises
});

test("escapeHtml makes names safe to show", () => {
  assert.equal(format.escapeHtml(`<img src=x onerror="a&b">`), "&lt;img src=x onerror=&quot;a&amp;b&quot;&gt;");
});

test("searchText has every way of writing the date, and the exercises", () => {
  const words = format.searchText(workout("2026-11-13", ["Bench press", 8, 60])).split(" ");
  for (const word of ["2026-11-13", "13", "nov", "friday", "november", "2026", "bench", "press"]) {
    assert.ok(words.includes(word), `"${word}" is missing`);
  }
});

// ---------- plates.js ----------

test("platesPerSide", () => {
  assert.deepEqual(plates.platesPerSide(20), []);
  assert.deepEqual(plates.platesPerSide(60), [20]);
  assert.deepEqual(plates.platesPerSide(100), [25, 15]);
  assert.deepEqual(plates.platesPerSide(57.5), [15, 2.5, 1.25]);
  assert.deepEqual(plates.platesPerSide(500), [...Array(9).fill(25), 15]);
});

test("the plates add up exactly for every weight from 20 to 500 kg (in 2.5 kg steps)", () => {
  for (let weight = 20; weight <= 500; weight += 2.5) {
    const side = plates.platesPerSide(weight).reduce((a, b) => a + b, 0);
    assert.equal(20 + 2 * side, weight, `${weight} kg`);
  }
});

test("platesText and drawBarbell", () => {
  assert.equal(plates.platesText(60), "20 each side");
  assert.equal(plates.platesText(20), "Just the bar");
  assert.equal(plates.platesText(15), "Less than the bar");
  assert.equal(plates.platesText(501), "Over 500 kg, please check");
  assert.match(plates.drawBarbell(0), /is-empty/);
  assert.match(plates.drawBarbell(600), /is-empty/);
  assert.match(plates.drawBarbell(57.5), /aria-label="15 \+ 2.5 \+ 1.25 kg each side"/);
});

// ---------- plans.js ----------

test("every choice on the Plan page has a plan with the right number of days", () => {
  for (const goal of ["Build muscle", "Get stronger"]) {
    for (const level of ["Beginner", "Intermediate"]) {
      for (const days of ["3", "4"]) {
        const plan = TrainingPlan.findPlan(goal, level, days);
        assert.ok(plan, `${goal} / ${level} / ${days}`);
        assert.equal(plan.schedule.length, Number(days));
        const dayNames = plan.schedule.map((d) => d.day);
        assert.equal(new Set(dayNames).size, dayNames.length, "no day is used twice");
      }
    }
  }
  assert.equal(TrainingPlan.findPlan("Lose weight", "Beginner", "3"), undefined);
});

// ---------- history.js: search, bests, one workout per day ----------

const sample = () => {
  const history = new WorkoutHistory([]);
  history.add(workout("2026-11-02", ["Bench press", 10, 60]));
  history.add(workout("2026-11-09", ["Bench press", 10, 50], ["Bench press", 6, 60], ["Squat", 8, 80]));
  history.add(workout("2026-11-11", ["Deadlift", 5, 100], ["Barbell row", 10, 40]));
  history.add(workout("2026-11-13", ["Bench press", 8, 57.5], ["Bench press", 8, 57.5]));
  history.add(workout("2026-11-13", ["Squat", 5, 85])); // saved later the same day
  return history;
};

test("add joins workouts from the same day and keeps the newest first", () => {
  const history = sample();
  assert.deepEqual(history.workouts.map((w) => w.date), ["2026-11-13", "2026-11-11", "2026-11-09", "2026-11-02"]);
  const friday = history.onDate("2026-11-13");
  assert.deepEqual(friday.sets.map((s) => s.exerciseName), ["Bench press", "Bench press", "Squat"]);
  assert.equal(friday.ids.length, 2);
  assert.equal(history.onDate("2026-11-14"), undefined);
  history.remove(friday);
  assert.equal(history.onDate("2026-11-13"), undefined);
});

test("setsFor is newest first", () => {
  assert.deepEqual(sample().setsFor("Bench press").map((s) => s.date),
    ["2026-11-13", "2026-11-13", "2026-11-09", "2026-11-09", "2026-11-02"]);
});

test("search by exercise, date, day, month, or several words", () => {
  const history = sample();
  const dates = (text) => history.search(text).map((w) => w.date);
  assert.deepEqual(dates("squat"), ["2026-11-13", "2026-11-09"]);
  assert.deepEqual(dates("dead"), ["2026-11-11"]);
  assert.deepEqual(dates("13 nov"), ["2026-11-13"]);
  assert.deepEqual(dates("Friday"), ["2026-11-13"]);
  assert.deepEqual(dates("bench squat"), ["2026-11-13", "2026-11-09"]); // both in one session
  assert.deepEqual(dates("11 nov"), ["2026-11-11"]); // not 2 Nov: numbers match whole words
  assert.deepEqual(dates("  squat   13 "), ["2026-11-13"]);
  assert.deepEqual(dates("13 nov"), ["2026-11-13"]); // a pasted non-breaking space
  assert.deepEqual(dates("yoga"), []);
});

test("getPersonalBests: heaviest for each exercise, the first day it was lifted, heaviest first", () => {
  assert.deepEqual(sample().getPersonalBests(), [
    { exerciseName: "Deadlift", weight: 100, date: "2026-11-11" },
    { exerciseName: "Squat", weight: 85, date: "2026-11-13" },
    { exerciseName: "Bench press", weight: 60, date: "2026-11-02" }, // not 9 Nov
    { exerciseName: "Barbell row", weight: 40, date: "2026-11-11" }
  ]);
  assert.deepEqual(new WorkoutHistory([]).getPersonalBests(), []);
});

// ---------- Saving, loading and changing workouts (with the stand-in database) ----------

const saveDoc = (date, savedAt, name, weight) => Database.save("users/u1/workouts", {
  date, ...(savedAt ? { savedAt } : {}), sets: [{ exerciseName: name, reps: 5, weight }]
});

test("load joins a day's saves into one workout, in the order they were saved", async () => {
  await saveDoc("2026-11-13", 300, "Squat", 100);         // saved 3rd
  await saveDoc("2026-11-13", 100, "Bench press", 60);    // saved 1st
  await saveDoc("2026-11-13", null, "Barbell row", 40);   // saved before savedAt existed
  await saveDoc("2026-11-13", 200, "Shoulder press", 40); // saved 2nd
  await saveDoc("2026-11-11", 50, "Deadlift", 140);
  const history = await WorkoutHistory.load("u1");
  assert.deepEqual(history.workouts.map((w) => w.date), ["2026-11-13", "2026-11-11"]);
  assert.deepEqual(history.workouts[0].sets.map((s) => s.exerciseName), ["Barbell row", "Bench press", "Shoulder press", "Squat"]);
  assert.equal(history.workouts[0].ids.length, 4);
});

test("a new workout is saved with savedAt, as plain data", async () => {
  const w = new Workout(null, "2026-11-20", [new WorkoutSet("Squat", 5, 60)]);
  await w.save("u1");
  assert.deepEqual(w.ids, [w.id]);
  const saved = fakeState().docs[`users/u1/workouts/${w.id}`];
  assert.deepEqual(Object.keys(saved).sort(), ["date", "savedAt", "sets"]);
  assert.deepEqual(saved.sets, [{ exerciseName: "Squat", reps: 5, weight: 60 }]);
});

test("saveChanges puts the day into its first document and deletes the others, in one go", async () => {
  await saveDoc("2026-11-13", 100, "Bench press", 60);
  await saveDoc("2026-11-13", 200, "Squat", 100);
  const day = (await WorkoutHistory.load("u1")).onDate("2026-11-13");
  const [first, second] = day.ids;

  // Fix the squat weight and remove the bench press
  await day.saveChanges("u1", [new WorkoutSet("Squat", 5, 102.5)]);
  assert.deepEqual(day.ids, [first]);
  const docs = fakeState().docs;
  assert.deepEqual(docs[`users/u1/workouts/${first}`].sets, [{ exerciseName: "Squat", reps: 5, weight: 102.5 }]);
  assert.equal(docs[`users/u1/workouts/${first}`].savedAt, 100, "keeps its place in the day");
  assert.equal(docs[`users/u1/workouts/${second}`], undefined);

  const again = (await WorkoutHistory.load("u1")).onDate("2026-11-13");
  assert.deepEqual(again.sets, [new WorkoutSet("Squat", 5, 102.5)]);
});

test("saveChanges saves nothing at all if the connection is lost", async () => {
  await saveDoc("2026-11-13", 100, "Bench press", 60);
  await saveDoc("2026-11-13", 200, "Squat", 100);
  const day = (await WorkoutHistory.load("u1")).onDate("2026-11-13");
  const before = JSON.stringify(fakeState().docs);

  const state = fakeState();
  state.offline = true;
  localStorage.setItem("fakeFirebase", JSON.stringify(state));
  await assert.rejects(day.saveChanges("u1", [new WorkoutSet("Squat", 5, 1)]));
  assert.equal(JSON.stringify(fakeState().docs), before, "no document changed");
  assert.equal(day.sets.length, 2, "the page still shows the old sets");
});

test("delete removes every document of the day", async () => {
  await saveDoc("2026-11-13", 100, "Bench press", 60);
  await saveDoc("2026-11-13", 200, "Squat", 100);
  await saveDoc("2026-11-11", 50, "Deadlift", 140);
  const history = await WorkoutHistory.load("u1");
  await history.onDate("2026-11-13").delete("u1");
  assert.deepEqual((await WorkoutHistory.load("u1")).workouts.map((w) => w.date), ["2026-11-11"]);
});

// ---------- user.js ----------

test("forgot password asks Firebase to send the reset email", async () => {
  await User.resetPassword("andrew@example.com");
  assert.deepEqual(fakeState().resetEmails, ["andrew@example.com"]);
  await assert.rejects(User.resetPassword("not-an-email"), { code: "auth/invalid-email" });
});

test("friendlyError turns Firebase codes into plain messages", () => {
  assert.equal(friendlyError({ code: "auth/invalid-credential" }), "Wrong email or password.");
  assert.equal(friendlyError({ code: "auth/missing-email" }), "Please enter your email address.");
  assert.equal(friendlyError({ code: "auth/something-new" }), "Something went wrong. Please try again.");
});
