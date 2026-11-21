// Browser tests: clicks through every page of GymTrack in Chromium, like a user would.
// Run with: npm run test:browser   (from the tests folder)
//
// Firebase is swapped for the stand-in in fake-firebase/, so these tests never touch
// our real accounts or data. The date is fixed to Friday 20 November 2026 (Athens time),
// so the results are the same whatever day they run.
// The steps run in order and build on each other, like one person using the site.
// Screenshots are saved in tests/screenshots/ (not uploaded to GitHub).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FAKE = fileURLToPath(new URL("./fake-firebase/", import.meta.url));
const SCREENSHOTS = fileURLToPath(new URL("./screenshots/", import.meta.url));
const NOW = new Date("2026-11-20T10:00:00+02:00");
const TODAY = "2026-11-20";
const SAVE = '#workout-form button[type="submit"]';

let browser;
let server;
let base;
let page; // the main browser tab, used by most steps
const errors = []; // JavaScript errors seen on any page
const dialogs = []; // the questions asked with confirm()
let confirmAnswer = true; // what the "user" answers to them

// ---------- Setting up ----------

// A small web server for the website files (like Live Server)
function startServer() {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
  const web = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = normalize(join(ROOT, path === "/" ? "index.html" : path));
    if (!file.startsWith(ROOT)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" }).end(body);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  return new Promise((resolve) => web.listen(0, "127.0.0.1", () => resolve(web)));
}

// A fresh browser window (its own logins and data).
// options.preview: no Firebase settings. options.slow: the Firebase files take this many ms to download.
async function newWindow(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "Europe/Athens", ...options.size });
  await context.clock.setFixedTime(NOW);
  await context.route(/^https:\/\/www\.gstatic\.com\/firebasejs\/[^/]+\/[\w-]+\.js$/, async (route) => {
    if (options.slow) await new Promise((resolve) => setTimeout(resolve, options.slow));
    const file = route.request().url().split("/").pop();
    await route.fulfill({ path: join(FAKE, file), contentType: "text/javascript", headers: { "Access-Control-Allow-Origin": "*" } });
  });
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.fulfill({ body: "", contentType: "text/css", headers: { "Access-Control-Allow-Origin": "*" } })
  );
  if (options.preview) {
    await context.route(/\/js\/firebase-config\.js$/, (route) =>
      route.fulfill({ contentType: "text/javascript", body: 'export const firebaseConfig = { apiKey: "PASTE_HERE" };' })
    );
  }
  const tab = await context.newPage();
  tab.on("pageerror", (error) => errors.push(`${tab.url()}: ${error.message}`));
  tab.on("console", (message) => {
    if (message.type() === "error") errors.push(`${tab.url()}: ${message.text()}`);
  });
  tab.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    if (confirmAnswer) {
      dialog.accept();
    } else {
      dialog.dismiss();
    }
  });
  return tab;
}

before(async () => {
  await mkdir(SCREENSHOTS, { recursive: true });
  server = await startServer();
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
  page = await newWindow();
});

after(async () => {
  await browser?.close();
  server?.close();
});

// ---------- Helpers ----------

const clean = (text) => text.replace(/\s+/g, " ").trim();
const fakeData = (tab) => tab.evaluate(() => JSON.parse(localStorage.getItem("fakeFirebase")));
const workoutDocs = async (tab, date) => Object.entries((await fakeData(tab)).docs)
  .filter(([path, data]) => path.includes("/workouts/") && data.date === date);

async function setOffline(tab, offline) {
  await tab.evaluate((value) => {
    const state = JSON.parse(localStorage.getItem("fakeFirebase"));
    state.offline = value;
    localStorage.setItem("fakeFirebase", JSON.stringify(state));
  }, offline);
}

// Copies the logins and data of the main window into another window
async function copyDataTo(tab) {
  const data = await page.evaluate(() => localStorage.getItem("fakeFirebase"));
  await tab.goto(base + "css/style.css"); // any file on the site, so localStorage is the site's
  await tab.evaluate((value) => localStorage.setItem("fakeFirebase", value), data);
}

// Waits until the page has shown the user's real data
const waitForReady = (tab) => tab.waitForFunction(() => document.querySelector(".app")?.classList.contains("is-ready"));

async function open(tab, file) {
  await tab.goto(base + file);
  await waitForReady(tab);
}

// Waits until the browser is on this page. Some actions move page twice, which cancels the first move.
async function arriveAt(tab, file) {
  for (let tries = 0; tries < 5; tries++) {
    try {
      await tab.waitForURL((url) => url.pathname.endsWith("/" + file), { timeout: 5000 });
      await tab.waitForLoadState("load");
      return;
    } catch (error) {
      if (!/ERR_ABORTED|detached|interrupted/.test(String(error))) throw error;
    }
  }
}

// Does something, then waits for the message at the top of the page
async function noticeAfter(tab, action) {
  await tab.evaluate(() => {
    const notice = document.getElementById("notice");
    notice.hidden = true;
    notice.textContent = "";
  });
  await action();
  await tab.waitForFunction(() => {
    const notice = document.getElementById("notice");
    return !notice.hidden && notice.textContent !== "";
  });
  return {
    text: await tab.locator("#notice").innerText(),
    good: (await tab.locator("#notice.good").count()) === 1
  };
}

// True if the action saved nothing to the database
async function nothingSavedAfter(tab, action) {
  const before = (await fakeData(tab)).calls.length;
  await action();
  await tab.waitForTimeout(300);
  return (await fakeData(tab)).calls.length === before;
}

// Answers Cancel to the next question (confirm)
async function cancelling(action) {
  confirmAnswer = false;
  try {
    await action();
    await page.waitForTimeout(200);
  } finally {
    confirmAnswer = true;
  }
}

// Log workout page
async function fillSet(tab, row, weight, reps) {
  const cells = tab.locator("#sets-body tr").nth(row);
  if (weight !== null) await cells.locator(".weight").fill(String(weight));
  if (reps !== null) await cells.locator(".reps").fill(String(reps));
}

// Logs one exercise. sets is a list of [weight, reps]. Returns the message shown.
async function logSets(tab, exercise, sets) {
  await tab.selectOption("#workout-exercise", exercise);
  for (let i = 0; i < sets.length; i++) {
    if (i > 0) await tab.click("#add-set");
    await fillSet(tab, i, sets[i][0], sets[i][1]);
  }
  return noticeAfter(tab, () => tab.click(SAVE));
}

async function setDate(tab, date) {
  await tab.fill("#workout-date", date);
  await tab.locator("#workout-date").dispatchEvent("change");
}

const todayNames = (tab) => tab.locator("#today-list li > span:first-child").allInnerTexts();
const todayTotal = (tab) => tab.locator("#today-total").innerText();

// History page: the card for one date, e.g. "2 Nov"
const card = (tab, date) => tab.locator("#workout-list .workout")
  .filter({ has: tab.locator(".workout-date strong", { hasText: new RegExp(`^${date}$`) }) });
const lifts = async (tab, date) => clean(await card(tab, date).locator(".workout-lifts").innerText());
const shownDates = (tab) => tab.locator(".workout-date strong").allInnerTexts();

// ---------- The steps ----------

test("1. preview mode (no Firebase settings) shows the sample pages", async () => {
  const preview = await newWindow({ preview: true });
  await preview.goto(base + "index.html");
  assert.match(await preview.locator("#notice").innerText(), /Preview mode/);
  await preview.fill("#email", "someone@example.com");
  await preview.click("#forgot-button");
  assert.match(await preview.locator("#notice").innerText(), /no email was sent/);

  await preview.fill("#password", "anything");
  await preview.click("#submit-button");
  await arriveAt(preview, "log.html");
  await waitForReady(preview);
  assert.equal(await preview.locator("#user-email").innerText(), "Preview mode");
  assert.equal(await preview.locator("#sets-body tr").count(), 3, "three example sets");
  assert.equal(await preview.locator("#today-list li").count(), 2, "the sample Today so far");

  await open(preview, "history.html");
  await preview.fill("#search-box", "squat");
  assert.equal(await preview.locator(".workout:not([hidden])").count(), 3);
  await preview.context().close();
});

test("2. log in page: wrong password, and forgot password", async () => {
  await page.goto(base + "index.html");
  await page.waitForTimeout(200);
  assert.equal(await page.locator("#notice").isVisible(), false, "no preview message");

  await page.fill("#email", "andrew@example.com");
  await page.fill("#password", "secret123");
  await page.click("#submit-button");
  await page.locator("#error").waitFor();
  assert.equal(await page.locator("#error").innerText(), "Wrong email or password.");

  // Forgot password needs the email first
  await page.fill("#email", "");
  await page.click("#forgot-button");
  assert.equal(await page.locator("#error").innerText(), "Type your email above first, then press Forgot password again.");

  await page.fill("#email", "andrew@example.com");
  await page.click("#forgot-button");
  await page.locator("#notice.good").waitFor();
  assert.match(await page.locator("#notice").innerText(), /^If there is an account for andrew@example.com, we have sent it an email/);
  assert.deepEqual((await fakeData(page)).resetEmails, ["andrew@example.com"]);
  assert.equal(await page.locator("#error").isVisible(), false);
  await page.screenshot({ path: join(SCREENSHOTS, "login-forgot-password.png") });
});

test("3. register a new account", async () => {
  await page.click("#switch-button");
  assert.equal(await page.locator("#form-title").innerText(), "Create your account");
  assert.equal(await page.locator("#forgot").isVisible(), false, "no Forgot password when registering");

  await page.fill("#password", "123");
  assert.equal(await page.$eval("#login-form", (form) => form.checkValidity()), false, "a 3-letter password is refused");
  await page.fill("#password", "secret123");
  await page.click("#submit-button");
  await arriveAt(page, "log.html");
  await waitForReady(page);
  assert.equal(await page.locator("#user-email").innerText(), "andrew@example.com");

  // Already logged in: the log in page goes straight to Log workout
  await page.goto(base + "index.html");
  await arriveAt(page, "log.html");
  await waitForReady(page);
});

test("4. a new account is asked to add exercises first", async () => {
  assert.deepEqual(await page.$eval("#workout-exercise", (select) => [...select.options].map((o) => o.text)), ["No exercises yet"]);
  assert.match(await page.locator("#notice").innerText(), /Exercises page/);
  assert.match((await page.locator("#today-list").innerText()), /Nothing logged yet/);
  assert.equal(await page.locator("#today-edit").isVisible(), false);

  await fillSet(page, 0, 60, 5);
  const message = await noticeAfter(page, () => page.click(SAVE));
  assert.equal(message.text, "Add an exercise on the Exercises page first.");
});

test("5. exercises: add, refuse doubles, tidy spaces, delete", async () => {
  await open(page, "exercises.html");
  assert.equal(await page.locator("#subtitle").innerText(), "No exercises yet");
  for (const name of ["Squat", "Bench press", "Deadlift", "Dumbbell curl", "Lat   pulldown", "Leg press"]) {
    await page.fill("#exercise-name", name);
    await page.click("#exercise-form button");
    await page.waitForFunction(() => document.getElementById("exercise-name").value === "");
  }
  const names = () => page.locator("#exercise-list tr td:first-child").allInnerTexts();
  assert.deepEqual(await names(), ["Bench press", "Deadlift", "Dumbbell curl", "Lat pulldown", "Leg press", "Squat"]);
  const savedNames = Object.values((await fakeData(page)).docs).map((d) => d.name);
  assert.ok(savedNames.includes("Lat pulldown"), "extra spaces are taken out before saving");

  // The same name again, in other capitals
  await page.fill("#exercise-name", "  squat ");
  assert.equal((await noticeAfter(page, () => page.click("#exercise-form button"))).text, "squat is already in your list.");

  // Pressing Enter twice quickly adds it once
  await page.fill("#exercise-name", "Hip thrust");
  await page.evaluate(() => {
    const form = document.getElementById("exercise-form");
    form.requestSubmit();
    form.requestSubmit();
  });
  await page.waitForFunction(() => document.getElementById("exercise-name").value === "");
  await page.waitForTimeout(200);
  const row = (name) => page.locator("#exercise-list tr", { hasText: name });
  assert.equal(await row("Hip thrust").count(), 1);

  // Delete: Cancel keeps it, OK deletes it
  await cancelling(() => row("Hip thrust").getByRole("button").click());
  assert.equal(await row("Hip thrust").count(), 1);
  for (const name of ["Hip thrust", "Leg press"]) {
    await row(name).getByRole("button").click();
    await row(name).waitFor({ state: "detached" });
  }
  await page.reload();
  await waitForReady(page);
  assert.deepEqual(await names(), ["Bench press", "Deadlift", "Dumbbell curl", "Lat pulldown", "Squat"]);
});

test("6. log a workout: sets, plates, and the Today so far card", async () => {
  await open(page, "log.html");
  assert.equal(await page.inputValue("#workout-date"), TODAY);
  assert.equal(await page.locator("#sets-body tr").count(), 1);

  await page.selectOption("#workout-exercise", "Squat");
  await fillSet(page, 0, 60, 5);
  assert.equal(await page.locator("#sets-body .plates-text").first().innerText(), "20 each side");
  await page.click("#add-set");
  const second = page.locator("#sets-body tr").nth(1);
  assert.equal(await second.locator(".weight").inputValue(), "60", "Add set copies the weight");
  assert.equal(await second.locator(".reps").inputValue(), "");
  assert.ok(await second.locator(".reps").evaluate((box) => box === document.activeElement), "and puts the cursor in Reps");
  await fillSet(page, 1, null, 5);
  await page.click("#add-set");
  await fillSet(page, 2, 62.5, 3);
  assert.equal(await page.locator("#set-summary").innerText(), "3 sets · 13 reps");

  const message = await noticeAfter(page, () => page.click(SAVE));
  assert.equal(message.text, "Saved: 3 sets of Squat. Pick another exercise to keep going.", "no 'personal best' the first time");
  assert.ok(message.good, "shown in green");
  assert.equal(await page.locator("#sets-body tr").count(), 1, "the form starts again");
  assert.equal(await page.locator("#last-time-list li").count(), 3);
  assert.match(await page.locator("#best-figure").innerText(), /^62.5/);

  assert.equal(await page.locator("#today-title").innerText(), "Today so far");
  assert.equal(clean(await page.locator("#today-list").innerText()), "Squat 5, 5, 3 reps at 60, 60, 62.5 kg Remove");
  assert.equal(await todayTotal(page), "3 sets · 788 kg lifted");
  assert.equal(await page.locator("#today-edit").isVisible(), true);
});

test("7. a heavier set gets a personal best message", async () => {
  assert.equal((await logSets(page, "Squat", [[70, 3]])).text, "Saved: 1 set of Squat. New personal best: 70 kg, up from 62.5 kg!");
  await page.screenshot({ path: join(SCREENSHOTS, "log-personal-best.png") });
  assert.equal((await logSets(page, "Squat", [[50, 5]])).text, "Saved: 1 set of Squat. Pick another exercise to keep going.");
  assert.match(await page.locator("#best-figure").innerText(), /^70/);
  assert.equal(await todayTotal(page), "5 sets · 1,248 kg lifted");
  assert.deepEqual(await todayNames(page), ["Squat"], "all of today's squats in one line");
});

test("8. typing mistakes are refused, dumbbell weights are fine", async () => {
  await page.selectOption("#workout-exercise", "Deadlift");
  assert.ok(await nothingSavedAfter(page, async () => {
    await fillSet(page, 0, 600, 5);
    await page.click(SAVE);
  }), "600 kg is refused");
  assert.ok(await nothingSavedAfter(page, async () => {
    await fillSet(page, 0, 100, 150);
    await page.click(SAVE);
  }), "150 reps is refused");

  for (const weight of [7, 12, 14, 16, 22, 24, 61]) {
    await fillSet(page, 0, weight, 10);
    assert.ok(await page.locator("#sets-body .weight").evaluate((box) => box.checkValidity()), `${weight} kg can be typed`);
  }
  assert.equal((await logSets(page, "Dumbbell curl", [[12, 10]])).text, "Saved: 1 set of Dumbbell curl. Pick another exercise to keep going.");

  // A set with no reps is not saved
  await page.selectOption("#workout-exercise", "Bench press");
  await fillSet(page, 0, 50, 8);
  await page.click("#add-set");
  assert.equal((await noticeAfter(page, () => page.click(SAVE))).text, "Saved: 1 set of Bench press. Pick another exercise to keep going.");
});

test("9. Today so far: Remove takes out an exercise saved by mistake", async () => {
  assert.deepEqual(await todayNames(page), ["Squat", "Dumbbell curl", "Bench press"]);
  assert.equal((await workoutDocs(page, TODAY)).length, 5, "five saves today");
  const removeBench = () => page.locator("#today-list li", { hasText: "Bench press" }).getByRole("button", { name: "Remove" }).click();

  await cancelling(removeBench);
  assert.deepEqual(await todayNames(page), ["Squat", "Dumbbell curl", "Bench press"], "Cancel keeps it");

  assert.equal((await noticeAfter(page, removeBench)).text, "Removed Bench press from the workout.");
  assert.deepEqual(await todayNames(page), ["Squat", "Dumbbell curl"]);
  assert.equal(await todayTotal(page), "6 sets · 1,368 kg lifted");
  assert.equal((await workoutDocs(page, TODAY)).length, 1, "the day is now saved as one document");

  await page.reload();
  await waitForReady(page);
  assert.deepEqual(await todayNames(page), ["Squat", "Dumbbell curl"], "still removed after a reload");
});

test("10. logging other dates, and the side panels", async () => {
  await setDate(page, "2026-11-02");
  assert.equal(await page.locator("#today-title").innerText(), "Workout on Mon 2 Nov");
  assert.match(await page.locator("#today-list").innerText(), /Nothing logged yet/);
  assert.equal((await logSets(page, "Deadlift", [[100, 5]])).text, "Saved: 1 set of Deadlift. Pick another exercise to keep going.");
  assert.equal((await logSets(page, "Squat", [[80, 5]])).text, "Saved: 1 set of Squat. New personal best: 80 kg, up from 70 kg!");
  assert.deepEqual(await todayNames(page), ["Deadlift", "Squat"]);

  await setDate(page, "2026-11-09");
  assert.equal((await logSets(page, "Deadlift", [[110, 3]])).text, "Saved: 1 set of Deadlift. New personal best: 110 kg, up from 100 kg!");
  await setDate(page, "2026-10-30");
  await logSets(page, "Bench press", [[55, 8]]);

  await setDate(page, TODAY);
  assert.equal(await page.locator("#today-title").innerText(), "Today so far");
  assert.deepEqual(await todayNames(page), ["Squat", "Dumbbell curl"]);

  await page.selectOption("#workout-exercise", "Deadlift");
  assert.equal(await page.locator("#last-time-title").innerText(), "Deadlift on Mon 9 Nov", "the newest date, not the newest save");
  assert.match(await page.locator("#best-figure").innerText(), /^110/);
  assert.match(await page.locator("#best-date").innerText(), /^Lifted on Mon 9 Nov/);
  await page.screenshot({ path: join(SCREENSHOTS, "log.png"), fullPage: true });
});

test("11. the Edit link on Today so far opens that workout in History", async () => {
  await page.click("#today-edit");
  await arriveAt(page, "history.html");
  await waitForReady(page);
  const editing = page.locator(".workout.editing");
  assert.equal(await editing.count(), 1);
  assert.match(await editing.locator(".workout-date").innerText(), /20 Nov/);
  assert.equal(new URL(page.url()).hash, "", "the #edit-... is taken off the address");
  await page.screenshot({ path: join(SCREENSHOTS, "history-edit.png"), fullPage: true });
  await editing.getByRole("button", { name: "Cancel" }).click();
  assert.equal(await page.locator(".workout.editing").count(), 0);
});

test("12. History: one card per day, with sets and total weight", async () => {
  assert.equal(await page.locator("#subtitle").innerText(), "4 workouts");
  assert.deepEqual(await shownDates(page), ["20 Nov", "9 Nov", "2 Nov", "30 Oct"]);
  assert.deepEqual((await page.locator(".week-head").allInnerTexts()).map(clean), [
    "Week of 16 November 1 workout · 1,368 kg",
    "Week of 9 November 1 workout · 330 kg",
    "Week of 2 November 1 workout · 900 kg",
    "Week of 26 October 1 workout · 440 kg"
  ]);
  assert.deepEqual((await page.locator(".workout-side .num").allInnerTexts()).map(clean), [
    "6 sets 1,368 kg total", "1 set 330 kg total", "2 sets 900 kg total", "1 set 440 kg total"
  ]);
  assert.equal(await lifts(page, "20 Nov"), "Squat 5, 5, 3, 3, 5 reps at 60, 60, 62.5, 70, 50 kg Dumbbell curl 1 × 10 at 12 kg");
  assert.equal(await lifts(page, "2 Nov"), "Deadlift 1 × 5 at 100 kg Squat 1 × 5 at 80 kg");
  await page.screenshot({ path: join(SCREENSHOTS, "history.png"), fullPage: true });
});

test("13. History: search", async () => {
  const search = async (text) => {
    await page.fill("#search-box", text);
    return shownDates(page);
  };
  assert.deepEqual(await search("deadlift"), ["9 Nov", "2 Nov"]);
  assert.deepEqual(await search("dead"), ["9 Nov", "2 Nov"]);
  assert.deepEqual(await search("2 nov"), ["2 Nov"]);
  assert.deepEqual(await search("deadlift squat"), ["2 Nov"]);
  assert.deepEqual(await search("friday"), ["20 Nov", "30 Oct"]);
  assert.deepEqual(await search("squat nov"), ["20 Nov", "2 Nov"]);
  assert.deepEqual(await search("zumba"), []);
  assert.match(await page.locator("#workout-list").innerText(), /No workouts match/);
  assert.equal(await page.locator("#subtitle").innerText(), '0 of 4 workouts match "zumba"');
  await page.fill("#search-box", "");
});

test("14. History: Edit fixes a weight, Cancel changes nothing", async () => {
  await page.fill("#search-box", "2 nov");
  await card(page, "2 Nov").getByRole("button", { name: "Edit" }).click();
  assert.equal(await page.locator(".workout.editing tbody tr").count(), 2);
  assert.ok(await nothingSavedAfter(page, async () => {
    await page.getByLabel("Weight in kg for Squat set 1").fill("999");
    await page.getByRole("button", { name: "Cancel" }).click();
  }), "Cancel saves nothing");
  assert.equal(await lifts(page, "2 Nov"), "Deadlift 1 × 5 at 100 kg Squat 1 × 5 at 80 kg");

  await card(page, "2 Nov").getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Weight in kg for Squat set 1").fill("85");
  const message = await noticeAfter(page, () => page.getByRole("button", { name: "Save changes" }).click());
  assert.equal(message.text, "Saved your changes to 2 Nov.");
  assert.ok(message.good);
  assert.equal(await lifts(page, "2 Nov"), "Deadlift 1 × 5 at 100 kg Squat 1 × 5 at 85 kg");
  assert.equal((await workoutDocs(page, "2026-11-02")).length, 1, "the two saves are now one document");

  await page.reload();
  await waitForReady(page);
  await page.fill("#search-box", "2 nov");
  assert.equal(await lifts(page, "2 Nov"), "Deadlift 1 × 5 at 100 kg Squat 1 × 5 at 85 kg", "still changed after a reload");
});

test("15. History: Edit refuses impossible numbers; Remove and Undo", async () => {
  await card(page, "2 Nov").getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Reps for Squat set 1").fill("0");
  assert.ok(await nothingSavedAfter(page, () => page.getByRole("button", { name: "Save changes" }).click()), "0 reps is refused");
  await page.getByLabel("Reps for Squat set 1").fill("5");

  const deadliftRow = page.locator(".edit-sets tbody tr").first();
  await page.getByRole("button", { name: "Remove Deadlift set 1" }).click();
  assert.ok(await deadliftRow.evaluate((row) => row.classList.contains("removed")));
  assert.ok(await deadliftRow.locator(".weight").isDisabled());
  await page.getByRole("button", { name: "Undo removing Deadlift set 1" }).click();
  assert.ok(!(await deadliftRow.evaluate((row) => row.classList.contains("removed"))), "Undo keeps it");

  await page.getByRole("button", { name: "Remove Deadlift set 1" }).click();
  assert.equal((await noticeAfter(page, () => page.getByRole("button", { name: "Save changes" }).click())).text, "Saved your changes to 2 Nov.");
  assert.equal(await lifts(page, "2 Nov"), "Squat 1 × 5 at 85 kg");
  assert.equal(clean(await card(page, "2 Nov").locator(".workout-side .num").innerText()), "1 set 425 kg total");
});

test("16. History: removing every set deletes the workout; Delete asks first", async () => {
  await card(page, "2 Nov").getByRole("button", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Remove Squat set 1" }).click();
  await cancelling(() => page.getByRole("button", { name: "Save changes" }).click());
  assert.match(dialogs.at(-1), /^Delete your workout from 2 Nov\?/);
  assert.equal(await page.locator(".workout.editing").count(), 1, "Cancel keeps it");
  await page.getByRole("button", { name: "Save changes" }).click();
  await card(page, "2 Nov").waitFor({ state: "detached" });
  assert.equal((await workoutDocs(page, "2026-11-02")).length, 0);

  // The Delete button
  await page.fill("#search-box", "30 oct");
  await cancelling(() => card(page, "30 Oct").getByRole("button", { name: "Delete" }).click());
  assert.equal(await card(page, "30 Oct").count(), 1, "Cancel keeps it");
  await card(page, "30 Oct").getByRole("button", { name: "Delete" }).click();
  await card(page, "30 Oct").waitFor({ state: "detached" });
  await page.fill("#search-box", "");
  assert.equal(await page.locator("#subtitle").innerText(), "2 workouts");

  await page.reload();
  await waitForReady(page);
  assert.deepEqual(await shownDates(page), ["20 Nov", "9 Nov"], "still deleted after a reload");
});

test("17. Personal bests", async () => {
  await open(page, "bests.html");
  assert.equal(await page.locator("#subtitle").innerText(), "Your heaviest weight for each exercise, from 2 workouts");
  const top = clean(await page.locator("#top-best").innerText());
  assert.match(top, /Deadlift on Mon 9 Nov/);
  assert.match(top, /110 ?kg/);
  assert.match(top, /25 \+ 20 each side on a 20 kg bar/);
  assert.deepEqual(await page.locator("#bests-body .exercise strong").allInnerTexts(), ["Squat", "Dumbbell curl"]);
  const curl = clean(await page.locator("#bests-body tr", { hasText: "Dumbbell curl" }).innerText());
  assert.doesNotMatch(curl, /Less than the bar/, "no plates text for a dumbbell");
  await page.screenshot({ path: join(SCREENSHOTS, "bests.png"), fullPage: true });
});

test("18. Exercises page: how often and how heavy", async () => {
  await open(page, "exercises.html");
  const rows = (await page.locator("#exercise-list tr").allInnerTexts()).map(clean);
  assert.match(rows[0], /^Deadlift 1 110 kg 9 Nov/);
  assert.match(rows[1], /^Dumbbell curl 1 12 kg 20 Nov/);
  assert.match(rows[2], /^Squat 1 70 kg 20 Nov/);
  assert.match(rows[3], /^Bench press 0 – –/);
});

test("19. Training plan: every choice shows the right plan", async () => {
  await open(page, "plan.html");
  for (const goal of ["Build muscle", "Get stronger"]) {
    for (const level of ["Beginner", "Intermediate"]) {
      for (const days of ["3", "4"]) {
        await page.selectOption("#plan-goal", goal);
        await page.selectOption("#plan-level", level);
        await page.selectOption("#plan-days", days);
        await page.click("#plan-form button");
        assert.equal(await page.locator("#plan-result h2").innerText(), `${goal}, ${level.toLowerCase()}, ${days} days a week`);
        assert.equal(await page.locator(".plan-day").count(), Number(days));
        assert.equal(await page.locator(".week-strip .day.train").count(), Number(days));
      }
    }
  }
});

test("20. friendly messages when the connection is lost", async () => {
  await setOffline(page, true);
  for (const [file, where, message] of [
    ["history.html", "#workout-list", /Could not load your workouts/],
    ["bests.html", "#top-best", /Could not load your personal bests/],
    ["exercises.html", "#exercise-list", /Could not load your exercises/],
    ["log.html", "#notice", /Could not load your exercises/]
  ]) {
    await open(page, file);
    assert.match(await page.locator(where).innerText(), message, file);
  }
  await setOffline(page, false);

  // While changing a workout in History
  await open(page, "history.html");
  await card(page, "20 Nov").getByRole("button", { name: "Edit" }).click();
  await setOffline(page, true);
  const failed = await noticeAfter(page, () => page.getByRole("button", { name: "Save changes" }).click());
  assert.equal(failed.text, "Could not save your changes. Check your internet connection and try again.");
  assert.equal(await page.locator(".workout.editing").count(), 1, "the changes stay on screen to try again");
  assert.ok(await page.getByRole("button", { name: "Save changes" }).isEnabled());
  await setOffline(page, false);

  // While removing or saving on the Log page
  await open(page, "log.html");
  await setOffline(page, true);
  const removeCurl = () => page.locator("#today-list li", { hasText: "Dumbbell curl" }).getByRole("button", { name: "Remove" }).click();
  assert.equal((await noticeAfter(page, removeCurl)).text, "Could not remove it. Check your internet connection and try again.");
  assert.deepEqual(await todayNames(page), ["Squat", "Dumbbell curl"]);
  assert.equal((await logSets(page, "Squat", [[60, 5]])).text, "Could not save the workout. Check your internet connection and try again.");
  await setOffline(page, false);
});

test("21. while a page loads, nobody sees the made-up sample workouts", async () => {
  const slow = await newWindow({ slow: 1000 });
  await copyDataTo(slow);
  for (const [file, sample] of [["history.html", /13 Nov/], ["bests.html", /Wed 11 Nov/], ["log.html", /Bench press on Fri 13 Nov/]]) {
    await slow.goto(base + file, { waitUntil: "commit" });
    await slow.waitForTimeout(500);
    const visibleText = await slow.evaluate(() => [...document.querySelectorAll("main *")]
      .filter((el) => el.children.length === 0 && getComputedStyle(el).visibility === "visible")
      .map((el) => el.textContent).join(" "));
    assert.doesNotMatch(visibleText, sample, `${file} shows sample data while loading`);
    assert.match(await slow.locator("main").evaluate((el) => getComputedStyle(el, "::before").content), /Loading/);
    await waitForReady(slow);
    assert.equal(await slow.locator("h1").evaluate((el) => getComputedStyle(el).visibility), "visible", `${file} appears once loaded`);
  }
  await slow.context().close();
});

test("22. phone size: nothing sticks out sideways, including Edit", async () => {
  const phone = await newWindow({ size: { viewport: { width: 375, height: 812 } } });
  await copyDataTo(phone);
  const tooWide = () => phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  for (const file of ["log.html", "history.html", "exercises.html", "bests.html", "plan.html"]) {
    await open(phone, file);
    assert.ok(await tooWide() <= 0, `${file} is ${await tooWide()}px too wide`);
    await phone.screenshot({ path: join(SCREENSHOTS, `phone-${file.replace(".html", "")}.png`), fullPage: true });
  }
  await open(phone, "history.html");
  await card(phone, "20 Nov").getByRole("button", { name: "Edit" }).click();
  assert.ok(await tooWide() <= 0, `History in Edit is ${await tooWide()}px too wide`);
  await phone.screenshot({ path: join(SCREENSHOTS, "phone-history-edit.png"), fullPage: true });

  await phone.click("#logout-button-phone");
  await arriveAt(phone, "index.html");
  assert.ok(await tooWide() <= 0, "the log in page fits");
  await phone.context().close();
});

test("23. log out, and every page then needs you to log in", async () => {
  await open(page, "log.html");
  await page.click("#logout-button");
  await arriveAt(page, "index.html");
  for (const file of ["log.html", "history.html", "exercises.html", "bests.html", "plan.html"]) {
    await page.goto(base + file);
    await arriveAt(page, "index.html");
  }
});

test("24. a second user sees none of the first user's data, and names are never run as code", async () => {
  await page.click("#switch-button");
  await page.fill("#email", "ANDREW@example.com");
  await page.fill("#password", "another1");
  await page.click("#submit-button");
  await page.locator("#error").waitFor();
  assert.equal(await page.locator("#error").innerText(), "An account with this email already exists. Try logging in.");

  await page.fill("#email", "bogdan@example.com");
  await page.click("#submit-button");
  await arriveAt(page, "log.html");
  await open(page, "history.html");
  assert.equal(await page.locator("#subtitle").innerText(), "0 workouts");

  // An exercise name with HTML in it must show as text
  const trick = '<img src=x onerror="window.hacked=1">';
  await open(page, "exercises.html");
  await page.fill("#exercise-name", trick);
  await page.click("#exercise-form button");
  await page.waitForFunction(() => document.getElementById("exercise-name").value === "");
  await open(page, "log.html");
  await logSets(page, trick, [[20, 1]]);
  for (const file of ["log.html", "history.html", "bests.html", "exercises.html"]) {
    await open(page, file);
    if (file === "history.html") {
      await card(page, "20 Nov").getByRole("button", { name: "Edit" }).click();
    }
    assert.ok((await page.locator("main").innerText()).includes(trick), `${file} shows the name as text`);
    assert.equal(await page.evaluate(() => window.hacked), undefined, `${file} did not run it`);
  }

  // Back to the first user (email typed in capitals): their data is still there
  await page.click("#logout-button");
  await arriveAt(page, "index.html");
  await page.fill("#email", "ANDREW@Example.com");
  await page.fill("#password", "secret123");
  await page.click("#submit-button");
  await arriveAt(page, "log.html");
  await open(page, "history.html");
  assert.equal(await page.locator("#subtitle").innerText(), "2 workouts");
});

test("25. no JavaScript errors on any page", () => {
  assert.deepEqual(errors, []);
});
