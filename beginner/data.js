// Program data for the Beginner 8-Week Gym Plan (Lower Body + Glutes focus).
// Same block/item shapes as the original app's data.js, plus two optional fields:
//  - exercise.rpe:      string shown as a 4th meta chip, e.g. "6–7"
//  - exercise.priority:  true shows a small "Priority lift" tag under the exercise name

const PROGRAM = {
  title: "Beginner 8-Week Gym Plan",
  subtitle: "3 gym sessions/week + 1 optional cardio day",
  weeks: 8,
  phases: [
    { weeks: [1, 2], name: "Learn the Exercises", rpe: "RPE 6", notes: "2–3 sets · 10–12 reps. Don't worry about lifting heavy — learn the machines and proper technique." },
    { weeks: [3, 4], name: "Start Progressing", rpe: "RPE 6–7", notes: "Mostly 3 sets. When you can comfortably hit the top of the rep range, increase the weight slightly." },
    { weeks: [5, 6], name: "Build Strength", rpe: "RPE 7–8", notes: "3 sets. Gradually increase weights and keep reps controlled." },
    { weeks: [7, 7], name: "Strongest Week", rpe: "RPE 7–8", notes: "3 sets. Try to beat some of your previous weights or reps." },
    { weeks: [8, 8], name: "Consolidate", rpe: "RPE 6–7", notes: "Reduce weights slightly. Focus on excellent technique and mobility." },
  ],
  weeklyStructure: [
    { day: "Monday", session: "A", label: "Lower Body + Glutes" },
    { day: "Wednesday", session: "B", label: "Full Body" },
    { day: "Friday", session: "C", label: "Glutes + Legs" },
    { day: "Weekend", session: "D", label: "Fitness + Mobility (Optional)" },
  ],
  rule: {
    golden: "If you can complete all your reps comfortably with good form, add a small amount of weight next time.",
    priorityChain: ["Hip Thrust", "Leg Press", "Squat", "Hamstring Curl", "Hip Abduction"],
  },
  rpeGuide: [
    { num: "5", label: "Easy" },
    { num: "6", label: "Moderate" },
    { num: "7", label: "Challenging but comfortable" },
    { num: "8", label: "Hard — could still do ~2 more reps" },
    { num: "9–10", label: "Avoid for now", avoid: true },
  ],
  sessions: {
    A: {
      key: "A",
      title: "Lower Body + Glutes",
      blocks: [
        {
          type: "warmup",
          title: "Warm-up",
          cardio: "5 min treadmill walk (RPE 4–5)",
          items: [
            { type: "list", name: "Bodyweight squats", reps: "10" },
            { type: "list", name: "Glute bridges", reps: "10" },
            { type: "list", name: "Alternating reverse lunges", reps: "10" },
          ],
          note: "No need to make the warm-up complicated.",
        },
        { type: "exercise", title: "Leg Press", name: "Leg Press", sets: 3, reps: "10–12", rest: 90, rpe: "6–7", cue: "One of the easiest ways to train the legs without worrying about balancing a barbell." },
        { type: "exercise", title: "Hip Thrust Machine", name: "Hip Thrust Machine", sets: 3, reps: "10–12", rest: 90, rpe: "7", priority: true, cue: "Pause for 1 second at the top and squeeze the glutes. No machine? Use a glute bridge on the floor." },
        { type: "exercise", title: "Seated Hamstring Curl", name: "Seated Hamstring Curl", sets: 3, reps: "10–12", rest: 70, rpe: "7" },
        { type: "exercise", title: "Dumbbell Goblet Squat", name: "Dumbbell Goblet Squat", sets: 2, reps: "10", rest: 70, rpe: "6–7", cue: "Hold one dumbbell against the chest." },
        { type: "exercise", title: "Hip Abduction Machine", name: "Hip Abduction Machine", sets: 3, reps: "12–15", rest: 55, rpe: "7–8", cue: "Slowly open the legs and control them back in." },
        {
          type: "cooldown",
          title: "Cool-down",
          items: [
            { type: "timed", name: "Quad Stretch", duration: 30, perSide: true },
            { type: "timed", name: "Hamstring Stretch", duration: 30, perSide: true },
            { type: "timed", name: "Hip Flexor Stretch", duration: 30, perSide: true },
            { type: "timed", name: "Figure-4 Glute Stretch", duration: 30, perSide: true },
            { type: "timed", name: "Deep Squat Hold", duration: 30 },
          ],
        },
      ],
    },

    B: {
      key: "B",
      title: "Full Body",
      blocks: [
        {
          type: "warmup",
          title: "Warm-up",
          cardio: "5 min treadmill or bike (RPE 4–5)",
          items: [
            { type: "list", name: "Bodyweight squats", reps: "10" },
            { type: "list", name: "Arm circles", reps: "10" },
          ],
        },
        { type: "exercise", title: "Leg Press", name: "Leg Press", sets: 3, reps: "10", rest: 90, rpe: "6–7" },
        { type: "exercise", title: "Chest Press Machine", name: "Chest Press Machine", sets: 3, reps: "10", rest: 75, rpe: "6–7" },
        { type: "exercise", title: "Lat Pulldown", name: "Lat Pulldown", sets: 3, reps: "10", rest: 75, rpe: "6–7", cue: "Think about pulling the elbows down toward the sides of the body." },
        { type: "exercise", title: "Seated Cable Row / Row Machine", name: "Seated Cable Row / Row Machine", sets: 3, reps: "10", rest: 75, rpe: "6–7" },
        { type: "exercise", title: "Dumbbell Romanian Deadlift", name: "Dumbbell Romanian Deadlift", sets: 2, reps: "10", rest: 90, rpe: "6–7", cue: "Keep the dumbbells close to the legs and push the hips backwards." },
        { type: "exercise", title: "Hip Thrust Machine", name: "Hip Thrust Machine", sets: 3, reps: "10–12", rest: 90, rpe: "7", priority: true },
        {
          type: "core",
          title: "Core",
          items: [
            { type: "exercise", name: "Plank", sets: 2, reps: null, hold: 25, rest: 45, cue: "Don't worry about holding for minutes — good technique is more important (aim 20–30 sec)." },
          ],
        },
      ],
    },

    C: {
      key: "C",
      title: "Glutes + Legs",
      blocks: [
        {
          type: "warmup",
          title: "Warm-up",
          cardio: "5 min incline treadmill walk (RPE 4–5)",
          items: [
            { type: "list", name: "Bodyweight squats", reps: "10" },
            { type: "list", name: "Glute bridges", reps: "10" },
            { type: "list", name: "Reverse lunges", reps: "10" },
          ],
        },
        { type: "exercise", title: "Goblet Squat", name: "Goblet Squat", sets: 3, reps: "10", rest: 80, rpe: "7" },
        { type: "exercise", title: "Hip Thrust Machine", name: "Hip Thrust Machine", sets: 3, reps: "10–12", rest: 90, rpe: "7–8", priority: true },
        { type: "exercise", title: "Leg Press", name: "Leg Press", sets: 3, reps: "10–12", rest: 90, rpe: "7–8" },
        { type: "exercise", title: "Seated Hamstring Curl", name: "Seated Hamstring Curl", sets: 3, reps: "12", rest: 60, rpe: "7–8" },
        { type: "exercise", title: "Hip Abduction Machine", name: "Hip Abduction Machine", sets: 3, reps: "15", rest: 55, rpe: "8" },
        { type: "exercise", title: "Glute Bridge Burnout", name: "Glute Bridge Burnout", sets: 2, reps: "15–20", rest: 45, rpe: "8", cue: "Bodyweight. Slow reps with a 2-second squeeze at the top." },
      ],
    },

    D: {
      key: "D",
      title: "Fitness + Mobility (Optional)",
      isFlexible: true,
      blocks: [
        {
          type: "info",
          title: "Keep it enjoyable",
          items: [
            { name: "Cardio — 20–30 min", detail: "Treadmill, bike, cross trainer, or swimming. RPE 5–6 — breathing harder but still able to hold a conversation." },
          ],
        },
        { type: "exercise", title: "Cardio", name: "Cardio", isTimerOnly: true, duration: 25 * 60, cue: "RPE 5–6. Keep this enjoyable rather than turning it into another hard workout." },
        {
          type: "cooldown",
          title: "Mobility (10 min)",
          items: [
            { type: "timed", name: "Hip Flexor Stretch", duration: 45, perSide: true },
            { type: "timed", name: "Hamstring Stretch", duration: 45, perSide: true },
            { type: "timed", name: "Figure-4 Glute Stretch", duration: 45, perSide: true },
            { type: "timed", name: "Adductor Stretch", duration: 45, perSide: true },
            { type: "list", name: "90/90 Hip Rotations", reps: "8/side" },
            { type: "timed", name: "Deep Squat Hold", duration: 40 },
          ],
        },
      ],
    },
  },
};

if (typeof module !== "undefined") module.exports = { PROGRAM };
