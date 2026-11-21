# GymTrack

A simple gym workout tracker website, built for the ITC 2205 team project at Deree (Fall 2026).

**Team:** Andrew Apazidis, Bogdan Zhakun (X AE A-Xii, Group 4)

**Built with:** HTML, CSS, JavaScript and Firebase, hosted on GitHub Pages.

## Features

1. Register and log in
2. Add exercises
3. Log a workout
4. View workout history
5. Search workouts
6. See personal bests
7. Get a personalised training plan (ready-made plans chosen by goal, level and days per week)

Also:

- Getting started: a new account can add the common exercises in one click, and **+ New** adds an exercise without leaving the Log page
- Following a plan: **Use this plan** saves it, and the Log page then shows each day's exercises; tap one to fill in its sets with last time's weight
- Bodyweight exercises (like pull-ups) and timed ones (like a plank, in seconds), with bests in reps or seconds
- Renaming an exercise, which also renames it in your past workouts
- Fast pages: your data is kept in the browser, so a page you have opened before shows at once while Firebase is checked in the background (the copy is deleted when you log out)
- Forgot password, fixing a workout afterwards (change a weight or reps, or remove a set), a "Today so far" list while you log, a message when you beat your personal best, and the total weight lifted for each workout and week

## Files

- `index.html`: log in and register (F1)
- `log.html`, `history.html`, `exercises.html`, `bests.html`, `plan.html`: the pages you see after logging in
- `css/style.css`: the styling for every page
- `js/firebase-config.js`: the Firebase project settings
- `js/firebase.js`: connects the site to Firebase
- `js/user.js`: the `User` class from the class diagram (register, log in, log out)
- `js/login.js`: code for the log in page
- `js/page.js`: shared code for the other pages (shows the email, log out, sends logged-out users to the log in page)
- `js/database.js`: the `Database` class, the one place that reads and writes Firebase (with Firestore Lite), and keeps the copy of your data in the browser
- `js/exercise.js`, `js/workout.js`, `js/history.js`: the `Exercise`, `Workout`, `WorkoutSet` and `WorkoutHistory` classes from the class diagram
- `js/exercises-page.js`, `js/log.js`, `js/history-page.js`: code for the Exercises (F2), Log workout (F3) and History with search (F4, F5) pages
- `js/bests-page.js`: the Personal bests page (F6)
- `js/plans.js`, `js/plan-page.js`: the `TrainingPlan` class with the 8 ready-made plans (and saving the one you choose), and the Training plan page (F7)
- `js/format.js`: turns saved data into text, such as "3 × 8 at 57.5 kg"
- `js/plates.js`: draws a weight as the plates on a 20 kg bar
- `firestore.rules`: the database rules, also pasted into the Firebase console
- `firebase.json`: Firebase settings, used by the tests (and by `firebase deploy` if we ever use it)
- `tests/`: the automated tests (see Testing below)
- `.github/workflows/tests.yml`: runs the tests on GitHub after every push

## Running it on your computer

The pages use JavaScript modules, so open them through a local server instead of double-clicking the file. In VS Code, the Live Server extension works. Until `js/firebase-config.js` has the real values, the site runs in preview mode: you can see every page, but nothing is saved.

## Testing

The `tests` folder has three sets of automated tests. GitHub runs them after every push (see the Actions tab). To run them on your computer you need Node.js 22, and Java 21 for the rules tests:

```bash
cd tests
npm install
npx playwright install chromium
npm test
```

- `unit.test.mjs`: the code that does not need a browser, such as dates, plates, search, personal bests, and saving and changing workouts.
- `browser.test.mjs`: opens the site in Chromium and uses every page like a person would, on a computer and a phone-sized screen. Firebase is swapped for a stand-in (`tests/fake-firebase/`), so it never touches our real accounts or data. Screenshots are saved in `tests/screenshots/`.
- `rules.test.mjs`: checks `firestore.rules` in the Firebase emulator, so you can only see and change your own data.

You can also run one set at a time: `npm run test:unit`, `npm run test:browser` or `npm run test:rules`.
