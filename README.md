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

## Files

- `index.html`: log in and register (F1)
- `log.html`, `history.html`, `exercises.html`, `bests.html`, `plan.html`: the pages you see after logging in
- `css/style.css`: the styling for every page
- `js/firebase-config.js`: the Firebase project settings
- `js/firebase.js`: connects the site to Firebase
- `js/user.js`: the `User` class from the class diagram (register, log in, log out)
- `js/login.js`: code for the log in page
- `js/page.js`: shared code for the other pages (shows the email, log out, sends logged-out users to the log in page)
- `firestore.rules`: the database rules, also pasted into the Firebase console

## Running it on your computer

The pages use JavaScript modules, so open them through a local server instead of double-clicking the file. In VS Code, the Live Server extension works. Until `js/firebase-config.js` has the real values, the site runs in preview mode: you can see every page, but nothing is saved.
