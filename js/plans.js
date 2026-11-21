// The TrainingPlan class from our class diagram (F7).
// The plans are written here in the code. Firebase only saves which one you chose.
// 8 plans: 2 goals x 2 levels x 3 or 4 days a week.
import { Database } from "./database.js";
import { weekday, addDays } from "./format.js";

export class TrainingPlan {
  constructor(name, goal, level, daysPerWeek, tip, schedule) {
    this.name = name;
    this.goal = goal;
    this.level = level;
    this.daysPerWeek = daysPerWeek;
    this.tip = tip;
    // schedule: one entry per training day, e.g. { day: "Mon", title: "Push", exercises: [["Bench press", "3 × 10"], ...] }
    this.schedule = schedule;
  }

  // Finds the plan that matches the user's choices (FR9).
  static findPlan(goal, level, days) {
    return PLANS.find((plan) =>
      plan.goal === goal && plan.level === level && plan.daysPerWeek === Number(days)
    );
  }

  // The plan this user chose with "Use this plan", or null if they have not chosen one.
  static async load(uid) {
    const saved = await Database.get(`users/${uid}/settings/plan`);
    return saved ? TrainingPlan.findPlan(saved.goal, saved.level, saved.days) || null : null;
  }

  // Remembers this plan for the user. The Log page then shows each day's exercises.
  async use(uid) {
    await Database.set(`users/${uid}/settings/plan`, { goal: this.goal, level: this.level, days: this.daysPerWeek });
  }

  // Forgets the user's plan.
  static async stop(uid) {
    await Database.delete(`users/${uid}/settings/plan`);
  }

  // The training day on a date ("YYYY-MM-DD"), e.g. { number: 2, day: "Wed", title: "Legs", exercises },
  // or null if it is a rest day.
  dayOn(date) {
    const index = this.schedule.findIndex((d) => d.day === weekday(date));
    return index === -1 ? null : { number: index + 1, date, ...this.schedule[index] };
  }

  // The first training day after a date (for rest days: "Next: Wed, Day 2")
  nextDay(date) {
    for (let i = 1; i <= 7; i++) {
      const day = this.dayOn(addDays(date, i));
      if (day) {
        return day;
      }
    }
    return null;
  }

  // Every exercise in the plan, once each
  exerciseNames() {
    return [...new Set(this.schedule.flatMap((d) => d.exercises.map(([name]) => name)))];
  }
}

const MUSCLE_TIP = "Pick a weight you can lift for every rep with good form. When every set feels easy, add 2.5 kg next time.";
const STRENGTH_TIP = "Rest 2 to 3 minutes between sets. When you finish every rep, add 2.5 kg next time (5 kg on squat and deadlift).";

const PLANS = [
  new TrainingPlan("Push, legs, pull", "Build muscle", "Beginner", 3, MUSCLE_TIP, [
    { day: "Mon", title: "Push", exercises: [["Bench press", "3 × 10"], ["Shoulder press", "3 × 10"], ["Triceps dips", "3 × 12"]] },
    { day: "Wed", title: "Legs", exercises: [["Squat", "3 × 10"], ["Lunges", "3 × 10 each leg"], ["Calf raises", "3 × 15"]] },
    { day: "Fri", title: "Pull", exercises: [["Deadlift", "3 × 8"], ["Barbell row", "3 × 10"], ["Biceps curls", "3 × 12"]] }
  ]),
  new TrainingPlan("Upper and lower", "Build muscle", "Beginner", 4, MUSCLE_TIP, [
    { day: "Mon", title: "Upper", exercises: [["Bench press", "3 × 10"], ["Barbell row", "3 × 10"], ["Shoulder press", "3 × 10"], ["Biceps curls", "3 × 12"]] },
    { day: "Tue", title: "Lower", exercises: [["Squat", "3 × 10"], ["Romanian deadlift", "3 × 10"], ["Lunges", "3 × 10 each leg"], ["Calf raises", "3 × 15"]] },
    { day: "Thu", title: "Upper", exercises: [["Incline dumbbell press", "3 × 10"], ["Lat pulldown", "3 × 10"], ["Lateral raises", "3 × 12"], ["Triceps pushdowns", "3 × 12"]] },
    { day: "Fri", title: "Lower", exercises: [["Deadlift", "3 × 8"], ["Leg press", "3 × 12"], ["Leg curls", "3 × 12"], ["Plank", "3 × 30 seconds"]] }
  ]),
  new TrainingPlan("Push, legs, pull", "Build muscle", "Intermediate", 3, MUSCLE_TIP, [
    { day: "Mon", title: "Push", exercises: [["Bench press", "4 × 8"], ["Incline dumbbell press", "3 × 10"], ["Shoulder press", "3 × 10"], ["Triceps dips", "3 × 12"]] },
    { day: "Wed", title: "Legs", exercises: [["Squat", "4 × 8"], ["Romanian deadlift", "3 × 10"], ["Leg press", "3 × 12"], ["Calf raises", "4 × 15"]] },
    { day: "Fri", title: "Pull", exercises: [["Deadlift", "3 × 6"], ["Barbell row", "4 × 8"], ["Lat pulldown", "3 × 10"], ["Biceps curls", "3 × 12"]] }
  ]),
  new TrainingPlan("Upper and lower", "Build muscle", "Intermediate", 4, MUSCLE_TIP, [
    { day: "Mon", title: "Upper", exercises: [["Bench press", "4 × 8"], ["Barbell row", "4 × 8"], ["Shoulder press", "3 × 10"], ["Biceps curls", "3 × 12"]] },
    { day: "Tue", title: "Lower", exercises: [["Squat", "4 × 8"], ["Romanian deadlift", "3 × 10"], ["Leg press", "3 × 12"], ["Calf raises", "4 × 15"]] },
    { day: "Thu", title: "Upper", exercises: [["Incline dumbbell press", "4 × 10"], ["Lat pulldown", "4 × 10"], ["Lateral raises", "3 × 15"], ["Triceps pushdowns", "3 × 12"]] },
    { day: "Fri", title: "Lower", exercises: [["Deadlift", "3 × 6"], ["Front squat", "3 × 8"], ["Leg curls", "3 × 12"], ["Plank", "3 × 45 seconds"]] }
  ]),
  new TrainingPlan("Full body", "Get stronger", "Beginner", 3, STRENGTH_TIP, [
    { day: "Mon", title: "Full body A", exercises: [["Squat", "3 × 5"], ["Bench press", "3 × 5"], ["Barbell row", "3 × 5"]] },
    { day: "Wed", title: "Full body B", exercises: [["Squat", "3 × 5"], ["Shoulder press", "3 × 5"], ["Deadlift", "1 × 5"]] },
    { day: "Fri", title: "Full body A", exercises: [["Squat", "3 × 5"], ["Bench press", "3 × 5"], ["Barbell row", "3 × 5"]] }
  ]),
  new TrainingPlan("Upper and lower", "Get stronger", "Beginner", 4, STRENGTH_TIP, [
    { day: "Mon", title: "Upper", exercises: [["Bench press", "3 × 5"], ["Barbell row", "3 × 5"], ["Shoulder press", "3 × 8"]] },
    { day: "Tue", title: "Lower", exercises: [["Squat", "3 × 5"], ["Romanian deadlift", "3 × 8"], ["Calf raises", "3 × 12"]] },
    { day: "Thu", title: "Upper", exercises: [["Shoulder press", "3 × 5"], ["Pull-ups", "3 × as many as you can"], ["Bench press", "3 × 8"]] },
    { day: "Fri", title: "Lower", exercises: [["Deadlift", "3 × 5"], ["Front squat", "3 × 5"], ["Plank", "3 × 30 seconds"]] }
  ]),
  new TrainingPlan("Five by five", "Get stronger", "Intermediate", 3, STRENGTH_TIP, [
    { day: "Mon", title: "Heavy", exercises: [["Squat", "5 × 5"], ["Bench press", "5 × 5"], ["Barbell row", "5 × 5"]] },
    { day: "Wed", title: "Light", exercises: [["Deadlift", "3 × 3"], ["Shoulder press", "5 × 5"], ["Pull-ups", "3 × 8"]] },
    { day: "Fri", title: "Medium", exercises: [["Front squat", "3 × 5"], ["Bench press", "3 × 3"], ["Barbell row", "3 × 8"]] }
  ]),
  new TrainingPlan("One lift a day", "Get stronger", "Intermediate", 4, STRENGTH_TIP, [
    { day: "Mon", title: "Squat", exercises: [["Squat", "5 × 3"], ["Romanian deadlift", "3 × 6"], ["Plank", "3 × 45 seconds"]] },
    { day: "Tue", title: "Bench", exercises: [["Bench press", "5 × 3"], ["Barbell row", "4 × 6"], ["Triceps dips", "3 × 8"]] },
    { day: "Thu", title: "Deadlift", exercises: [["Deadlift", "4 × 3"], ["Front squat", "3 × 5"], ["Calf raises", "3 × 12"]] },
    { day: "Fri", title: "Press", exercises: [["Shoulder press", "5 × 3"], ["Pull-ups", "4 × 6"], ["Bench press", "3 × 8"]] }
  ])
];
