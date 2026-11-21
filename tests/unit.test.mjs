// Unit tests: the parts of GymTrack that do not need a browser.
// Run with: npm run test:unit   (from the tests folder)
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import * as format from "../js/format.js";
import * as plates from "../js/plates.js";
import { TrainingPlan } from "../js/plans.js";
import { WorkoutHistory, bestOf, bestField } from "../js/history.js";
import { Workout, WorkoutSet, fromPlain } from "../js/workout.js";
import { Exercise, kindOf, tidyName, COMMON_EXERCISES } from "../js/exercise.js";
import { Database } from "../js/database.js";
import { User, friendlyError } from "../js/user.js";

// A workout from a date and [name, reps, weight] lists
let nextId = 1;
const workout = (date, ...sets) => new Workout(`w${nextId++}`, date, sets.map(([n, r, w]) => new WorkoutSet(n, r, w)));

// The stand-in database, with one logged-in user "u1"
const fakeState = () => JSON.parse(localStorage.getItem("fakeFirebase"));
beforeEach(async () => {
  await Database.reset(); // like opening a new page
  localStorage.clear(); // including the copy of the data kept in the "browser"
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

// ---------- Dates for the plan, bodyweight and timed exercises ----------

test("weekday and addDays", () => {
  assert.equal(format.weekday("2026-11-20"), "Fri");
  assert.equal(format.weekday("2026-11-23"), "Mon");
  assert.equal(format.addDays("2026-11-20", 3), "2026-11-23");
  assert.equal(format.addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(format.addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(format.addDays("2026-03-28", 2), "2026-03-30"); // over the clock change
});

test("bodyweight and timed sets as text", () => {
  assert.equal(format.weightText(57.5), "57.5 kg");
  assert.equal(format.weightText(0), "bodyweight");
  assert.equal(format.setText({ reps: 8, weight: 57.5, seconds: null }), "8 reps at 57.5 kg");
  assert.equal(format.setText({ reps: 12, weight: 0, seconds: null }), "12 reps at bodyweight");
  assert.equal(format.setText({ reps: null, weight: 0, seconds: 45 }), "45 s");
  assert.equal(format.setText({ reps: null, weight: 10, seconds: 30 }), "30 s with 10 kg");
  const sets = (...list) => list.map(([reps, weight, seconds = null]) => ({ reps, weight, seconds }));
  assert.equal(format.describeSets(sets([12, 0], [12, 0], [12, 0])), "3 × 12 at bodyweight");
  assert.equal(format.describeSets(sets([15, 0], [12, 0])), "15, 12 reps at bodyweight");
  assert.equal(format.describeSets(sets([10, 0], [8, 10])), "10, 8 reps at bodyweight, 10 kg");
  assert.equal(format.describeSets(sets([null, 0, 45], [null, 0, 45], [null, 0, 45])), "3 × 45 s");
  assert.equal(format.describeSets(sets([null, 0, 45], [null, 0, 60])), "45, 60 s");
  assert.equal(format.describeSets(sets([null, 10, 30], [null, 10, 30])), "2 × 30 s with 10 kg");
  assert.equal(format.volume(sets([null, 0, 45], [10, 50])), "500", "timed sets add no kg");
});

test("bestOf: the heaviest weight, most reps or longest time, and the first day it was done", () => {
  assert.deepEqual(bestOf([
    { date: "2026-11-09", reps: 5, weight: 100 }, { date: "2026-11-02", reps: 3, weight: 100 }, { date: "2026-11-13", reps: 8, weight: 90 }
  ]), { weight: 100, date: "2026-11-02" });
  assert.deepEqual(bestOf([
    { date: "2026-11-09", reps: 12, weight: 0 }, { date: "2026-11-13", reps: 15, weight: 0 }
  ]), { reps: 15, date: "2026-11-13" });
  assert.deepEqual(bestOf([
    { date: "2026-11-09", reps: null, weight: 0, seconds: 60 }, { date: "2026-11-13", reps: null, weight: 0, seconds: 45 }
  ]), { seconds: 60, date: "2026-11-09" });
  assert.deepEqual([bestField({ weight: 1 }), bestField({ reps: 1 }), bestField({ seconds: 1 })], ["weight", "reps", "seconds"]);
  assert.equal(format.bestText({ weight: 102.5 }), "102.5 kg");
  assert.equal(format.bestText({ reps: 15 }), "15 reps");
  assert.equal(format.bestFigure({ seconds: 60 }), "60<small>s</small>");
});

test("getPersonalBests: weights first, then the most reps, then the longest times", () => {
  const history = new WorkoutHistory([]);
  history.add(workout("2026-11-13", ["Squat", 5, 100], ["Pull-ups", 12, 0], ["Bench press", 5, 80]));
  history.add(new Workout("p1", "2026-11-13", [new WorkoutSet("Plank", null, 0, 60)]));
  history.add(workout("2026-11-11", ["Push-ups", 20, 0]));
  assert.deepEqual(history.getPersonalBests().map((b) => [b.exerciseName, format.bestText(b)]), [
    ["Squat", "100 kg"], ["Bench press", "80 kg"], ["Push-ups", "20 reps"], ["Pull-ups", "12 reps"], ["Plank", "60 s"]
  ]);
});

test("a timed set is saved with seconds instead of reps, and read back", async () => {
  const plank = new Workout(null, "2026-11-20", [new WorkoutSet("Plank", null, 0, 45)]);
  await plank.save("u1");
  assert.deepEqual(fakeState().docs[`users/u1/workouts/${plank.id}`].sets, [{ exerciseName: "Plank", seconds: 45, weight: 0 }]);
  assert.deepEqual((await WorkoutHistory.load("u1")).onDate("2026-11-20").sets, [new WorkoutSet("Plank", null, 0, 45)]);
  assert.deepEqual(fromPlain({ exerciseName: "Squat", reps: 5, weight: 100 }), new WorkoutSet("Squat", 5, 100));
});

// ---------- exercise.js ----------

test("kindOf and tidyName", () => {
  assert.equal(kindOf("Plank"), "timed");
  assert.equal(kindOf("  pull-ups "), "bodyweight");
  assert.equal(kindOf("Squat"), "weights");
  assert.equal(tidyName("  Lat   pulldown "), "Lat pulldown");
});

test("exercises are saved with their kind; old ones without a kind count as weights", async () => {
  await Exercise.add("u1", "Plank", "timed");
  await Database.save("users/u1/exercises", { name: "Squat" }); // saved before kinds existed
  assert.deepEqual((await Exercise.getAll("u1")).map((e) => [e.name, e.kind]), [["Plank", "timed"], ["Squat", "weights"]]);
});

test("addMissing adds only the exercises you do not have, in one go, with their kinds", async () => {
  const have = [await Exercise.add("u1", "squat")];
  const added = await Exercise.addMissing("u1", COMMON_EXERCISES, have);
  assert.equal(added.length, COMMON_EXERCISES.length - 1, "squat was already there");
  const saved = await Exercise.getAll("u1");
  assert.equal(saved.length, COMMON_EXERCISES.length);
  assert.equal(saved.find((e) => e.name === "Pull-ups").kind, "bodyweight");
  assert.equal(saved.find((e) => e.name === "Plank").kind, "timed");
  assert.deepEqual(await Exercise.addMissing("u1", ["Squat", "Plank"], saved), [], "nothing new to add");
});

test("update renames the exercise in every past workout, in one go", async () => {
  const curl = await Exercise.add("u1", "Dumbbell curl");
  await saveDoc("2026-11-13", 100, "Dumbbell curl", 12);
  await saveDoc("2026-11-13", 200, "Squat", 100);
  await saveDoc("2026-11-11", 50, "Dumbbell curl", 10);
  await saveDoc("2026-11-09", 40, "Squat", 90);
  const history = await WorkoutHistory.load("u1");
  const callsBefore = fakeState().calls.length;

  await curl.update("u1", "Dumbbell curls", "weights", history.workouts);
  assert.equal(curl.name, "Dumbbell curls");
  assert.deepEqual(history.setsFor("Dumbbell curls").map((s) => s.date), ["2026-11-13", "2026-11-11"], "the page's copy changed too");
  const again = await WorkoutHistory.load("u1");
  assert.deepEqual(again.setsFor("Dumbbell curls").map((s) => s.date), ["2026-11-13", "2026-11-11"]);
  assert.deepEqual(again.setsFor("Dumbbell curl"), []);
  assert.equal(again.onDate("2026-11-13").ids.length, 1, "13 Nov is one document now");
  assert.deepEqual(again.onDate("2026-11-13").sets.map((s) => s.exerciseName), ["Dumbbell curls", "Squat"]);
  const changes = fakeState().calls.slice(callsBefore).map(([op]) => op).sort();
  assert.deepEqual(changes, ["delete", "update", "update", "update"], "the exercise, 13 Nov and 11 Nov; 9 Nov is not touched");
  assert.equal((await Exercise.getAll("u1"))[0].name, "Dumbbell curls");
});

test("update saves nothing if the connection is lost; changing only the kind leaves workouts alone", async () => {
  const curl = await Exercise.add("u1", "Curl");
  await saveDoc("2026-11-13", 100, "Curl", 12);
  const history = await WorkoutHistory.load("u1");
  const before = JSON.stringify(fakeState().docs);
  const offline = fakeState();
  offline.offline = true;
  localStorage.setItem("fakeFirebase", JSON.stringify(offline));
  await assert.rejects(curl.update("u1", "Curls", "weights", history.workouts));
  assert.equal(curl.name, "Curl");
  assert.equal(JSON.stringify(fakeState().docs), before, "no document changed");

  const online = fakeState();
  online.offline = false;
  localStorage.setItem("fakeFirebase", JSON.stringify(online));
  const callsBefore = fakeState().calls.length;
  await curl.update("u1", "Curl", "bodyweight", history.workouts);
  assert.deepEqual(fakeState().calls.slice(callsBefore), [["update", `users/u1/exercises/${curl.id}`]]);
});

// ---------- plans.js: following a plan ----------

test("dayOn and nextDay follow the plan's week", () => {
  const plan = TrainingPlan.findPlan("Build muscle", "Beginner", "3"); // Mon, Wed, Fri
  const friday = plan.dayOn("2026-11-20");
  assert.deepEqual([friday.number, friday.title], [3, "Pull"]);
  assert.equal(plan.dayOn("2026-11-21"), null, "Saturday is a rest day");
  const next = plan.nextDay("2026-11-21");
  assert.deepEqual([next.date, next.number, next.title], ["2026-11-23", 1, "Push"]);
  const afterMonday = plan.nextDay("2026-11-23");
  assert.deepEqual([afterMonday.date, afterMonday.title], ["2026-11-25", "Legs"]);
});

test("exerciseNames lists each exercise of a plan once", () => {
  const names = TrainingPlan.findPlan("Get stronger", "Beginner", "3").exerciseNames(); // squats every day
  assert.deepEqual(names, ["Squat", "Bench press", "Barbell row", "Shoulder press", "Deadlift"]);
});

test("a chosen plan is saved, loaded back and forgotten", async () => {
  assert.equal(await TrainingPlan.load("u1"), null);
  const plan = TrainingPlan.findPlan("Get stronger", "Intermediate", "4");
  await plan.use("u1");
  assert.deepEqual(fakeState().docs["users/u1/settings/plan"], { goal: "Get stronger", level: "Intermediate", days: 4 });
  assert.equal(await TrainingPlan.load("u1"), plan);
  await TrainingPlan.stop("u1");
  assert.equal(await TrainingPlan.load("u1"), null);
});

// ---------- The copy of your data in the browser (so pages open at once) ----------

const setFake = (change) => {
  const state = fakeState();
  change(state);
  localStorage.setItem("fakeFirebase", JSON.stringify(state));
};
const timed = async (work) => {
  const start = Date.now();
  const result = await work();
  return [result, Date.now() - start];
};

test("a page opened again gets the copy at once, even on a slow connection", async () => {
  await saveDoc("2026-11-13", 1, "Squat", 100);
  await Database.reset(); // a new page: the first load asks Firebase
  setFake((s) => { s.delay = 300; });
  const [first, slow] = await timed(() => Database.getAll("users/u1/workouts"));
  assert.ok(slow >= 280, `the first time waits for Firebase (${slow} ms)`);

  await Database.reset(); // the next page
  const [second, fast] = await timed(() => Database.getAll("users/u1/workouts"));
  assert.ok(fast < 50, `the next time uses the copy (${fast} ms)`);
  assert.deepEqual(second, first);
});

test("the background check updates the copy, and only says so when something really changed", async () => {
  await saveDoc("2026-11-13", 1, "Squat", 100);
  await Exercise.add("u1", "Squat", "weights");
  await Database.getAll("users/u1/workouts");
  await Database.getAll("users/u1/exercises");

  // Same data from Firebase (even if fields come back in another order): nothing to do
  await Database.reset();
  const told = [];
  Database.whenNewData((path) => told.push(path));
  setFake((s) => {
    for (const path of Object.keys(s.docs)) {
      s.docs[path] = Object.fromEntries(Object.entries(s.docs[path]).reverse());
    }
  });
  await Database.getAll("users/u1/workouts");
  await Database.getAll("users/u1/exercises");
  await Database.settled();
  assert.deepEqual(told, []);

  // Something saved on another device: the page is told, and the copy is updated
  await Database.reset();
  Database.whenNewData((path) => told.push(path));
  setFake((s) => { s.docs["users/u1/workouts/phone1"] = { date: "2026-11-14", savedAt: 9, sets: [{ exerciseName: "Squat", reps: 3, weight: 110 }] }; });
  const shown = await Database.getAll("users/u1/workouts");
  assert.equal(shown.length, 1, "the copy is shown first");
  await Database.settled();
  assert.deepEqual(told, ["users/u1/workouts"]);
  await Database.reset();
  assert.equal((await Database.getAll("users/u1/workouts")).length, 2, "the copy now has it");
});

test("saving keeps the copy up to date", async () => {
  const exercise = await Exercise.add("u1", "Squat");
  await Database.getAll("users/u1/exercises");
  await Database.getAll("users/u1/workouts");
  await TrainingPlan.load("u1");
  await Exercise.add("u1", "Plank", "timed");
  await Exercise.addMissing("u1", ["Pull-ups"], []);
  await exercise.update("u1", "Back squat", "weights", []);
  await new Workout(null, "2026-11-13", [new WorkoutSet("Back squat", 5, 100)]).save("u1");
  await TrainingPlan.findPlan("Build muscle", "Beginner", "3").use("u1");

  // Read again from the copy only: Firebase is switched off
  await Database.reset();
  setFake((s) => { s.offline = true; });
  assert.deepEqual((await Exercise.getAll("u1")).map((e) => e.name), ["Back squat", "Plank", "Pull-ups"]);
  assert.equal((await WorkoutHistory.load("u1")).workouts.length, 1);
  assert.equal((await TrainingPlan.load("u1")).name, "Push, legs, pull");

  setFake((s) => { s.offline = false; });
  const history = await WorkoutHistory.load("u1");
  await history.workouts[0].delete("u1");
  await TrainingPlan.stop("u1");
  await Database.reset();
  setFake((s) => { s.offline = true; });
  assert.equal((await WorkoutHistory.load("u1")).workouts.length, 0, "deleted from the copy too");
  assert.equal(await TrainingPlan.load("u1"), null);
});

test("a check that finishes after something was saved does not undo it", async () => {
  await Database.getAll("users/u1/exercises");
  await Database.reset();
  setFake((s) => { s.delay = 200; });
  const told = [];
  Database.whenNewData((path) => told.push(path));
  await Database.getAll("users/u1/exercises"); // from the copy; the check is still running
  setFake((s) => { s.delay = 0; });
  await Exercise.add("u1", "Squat"); // saved while the check runs
  await Database.settled();
  assert.deepEqual(told, []);
  await Database.reset();
  setFake((s) => { s.offline = true; });
  assert.deepEqual((await Exercise.getAll("u1")).map((e) => e.name), ["Squat"]);
});

test("with no connection, the copy is shown and the page is told", async () => {
  await Database.getAll("users/u1/exercises");
  await Database.reset();
  let noConnection = false;
  Database.whenNoConnection(() => { noConnection = true; });
  setFake((s) => { s.offline = true; });
  assert.deepEqual(await Database.getAll("users/u1/exercises"), []);
  await Database.settled();
  assert.ok(noConnection);
});

test("logging out deletes the copy", async () => {
  await Exercise.add("u1", "Squat");
  await Database.getAll("users/u1/exercises");
  const copies = () => [...Array(localStorage.length).keys()].map((i) => localStorage.key(i)).filter((k) => k.startsWith("gymtrack-copy:"));
  assert.ok(copies().length > 0);
  await User.logOut();
  assert.deepEqual(copies(), []);
});
