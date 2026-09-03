// Program data for the 8-Week Training Plan.
// Structure: PROGRAM.sessions[key] -> { title, blocks: [ {type, title, items:[...] } ] }
// item shapes:
//  - exercise:   { type:'exercise', name, sets, reps, rest }         // rest in seconds, sets tracked with a rest timer after each
//  - superset:   { type:'superset', name, rounds, rest, moves:[{name,reps}] }
//  - timed:      { type:'timed', name, duration, perSide }           // duration in seconds; perSide doubles the rep count in UI
//  - list:       plain warm-up/cooldown moves without a per-item timer, shown as a checklist with an optional overall timer

const PROGRAM = {
  title: "8-Week Training Plan",
  subtitle: "3–4 sessions/week · 60 minutes each",
  weeks: 8,
  phases: [
    { weeks: [1, 2], name: "Foundation", rpe: "RPE 6/10", notes: "Learn the movements and keep everything controlled. Don't worry about lifting heavy." },
    { weeks: [3, 4], name: "Build", rpe: "RPE 6–7", notes: "Start adding weight. Work toward the top of each rep range." },
    { weeks: [5, 6], name: "Strength + Size", rpe: "RPE 7–8", notes: "Increase weights gradually. Finish sets with 2–3 good reps still available." },
    { weeks: [7, 8], name: "Progress", rpe: "RPE 7–8+", notes: "Continue increasing weight/reps while maintaining excellent technique. Optional: add very gentle skipping or low pogo hops to warm-ups." },
  ],
  weeklyStructure: [
    { day: "Monday", session: "A", label: "Lower Body + Core" },
    { day: "Wednesday", session: "B", label: "Upper Body + Posture" },
    { day: "Friday", session: "C", label: "Full Body + Surf Fitness" },
    { day: "Weekend", session: "D", label: "Conditioning / Surf / Hike" },
  ],
  rule: {
    before: "Dynamic, flowing movement",
    during: "Conventional progressive strength work",
    after: "Gentle mobility + stretching",
  },
  sessions: {
    A: {
      key: "A",
      title: "Lower Body + Core",
      blocks: [
        {
          type: "warmup",
          title: "Warm-up",
          duration: 600,
          cardio: "2 min incline treadmill walk",
          items: [
            { type: "list", name: "Cat-cow", reps: "6 slow reps" },
            { type: "list", name: "90/90 hip rotations", reps: "6/side" },
            { type: "list", name: "Standing hip circles", reps: "5/side" },
            { type: "list", name: "Glute bridges", reps: "10" },
            { type: "list", name: "Bird dogs", reps: "6/side" },
            { type: "list", name: "Bodyweight squats", reps: "10" },
            { type: "list", name: "Reverse lunges", reps: "5/side" },
            { type: "list", name: "Standing spinal waves", reps: "5 slow reps" },
          ],
          note: "The hip circles and spinal waves are the couple of more fascial/flowing movements to keep here. Don't force the range. Then do 1–2 light warm-up sets of your first exercise.",
        },
        {
          type: "exercise",
          title: "Goblet Squat",
          name: "Goblet Squat",
          sets: 3, reps: "8–10", rest: 90,
          cue: "Keep your core braced and spine comfortable.",
        },
        {
          type: "exercise",
          title: "Bulgarian Split Squat",
          name: "Bulgarian Split Squat",
          sets: 3, reps: "8 each leg", rest: 75,
          cue: "Eventually work up to holding dumbbells.",
        },
        {
          type: "exercise",
          title: "Hip Thrust",
          name: "Hip Thrust",
          sets: 3, reps: "10–12", rest: 70,
          cue: "Focus on squeezing the glutes rather than arching your back at the top.",
        },
        {
          type: "core",
          title: "Core",
          items: [
            { type: "exercise", name: "Dead Bug", sets: 3, reps: "6–8/side", rest: 30 },
            { type: "exercise", name: "Side Plank", sets: 3, reps: null, hold: 25, perSide: true, rest: 30 },
          ],
        },
        {
          type: "cooldown",
          title: "Cool-down",
          items: [
            { type: "timed", name: "Figure-4 / Glute Stretch", duration: 30, perSide: true },
            { type: "timed", name: "Hip Flexor Stretch", duration: 30, perSide: true },
            { type: "timed", name: "90/90 Hip Flow", duration: 45 },
            { type: "timed", name: "Child's Pose", duration: 45 },
            { type: "timed", name: "Slow Nasal Breathing", duration: 60 },
          ],
          note: "The 90/90 flow gives you a little dynamic/fascial movement without making it the focus.",
        },
      ],
    },

    B: {
      key: "B",
      title: "Upper Body + Posture",
      blocks: [
        {
          type: "warmup",
          title: "Warm-up",
          cardio: "2 min easy rower",
          items: [
            { type: "list", name: "Chin tucks", reps: "8" },
            { type: "list", name: "Arm circles", reps: "10 each direction" },
            { type: "list", name: "Wall slides", reps: "10" },
            { type: "list", name: "Band pull-aparts", reps: "15" },
            { type: "list", name: "Scapular push-ups", reps: "10" },
            { type: "list", name: "Thoracic rotations", reps: "6/side" },
            { type: "list", name: "Cross-body arm swings", reps: "30 sec" },
            { type: "list", name: "Band external rotations", reps: "10/side" },
          ],
          note: "The cross-body arm swings are your little dose of dynamic/fascial movement here.",
        },
        {
          type: "exercise",
          title: "Dumbbell Bench Press",
          name: "Dumbbell Bench Press",
          sets: 3, reps: "8–10", rest: 90,
        },
        {
          type: "exercise",
          title: "Chest-Supported Dumbbell Row",
          name: "Chest-Supported Dumbbell Row",
          sets: 3, reps: "10–12", rest: 80,
          cue: "This is a major priority for your posture and paddling strength.",
        },
        {
          type: "exercise",
          title: "Lat Pulldown",
          name: "Lat Pulldown",
          sets: 3, reps: "8–12", rest: 70,
        },
        {
          type: "superset",
          title: "Face Pull + External Rotation",
          rounds: 3, rest: 30,
          moves: [
            { name: "Face Pull", reps: "12–15" },
            { name: "Cable External Rotation", reps: "12/side" },
          ],
        },
        {
          type: "cooldown",
          title: "Cool-down",
          items: [
            { type: "timed", name: "Doorway Pec Stretch", duration: 30, perSide: true },
            { type: "list", name: "Thoracic Rotation", reps: "5/side" },
            { type: "timed", name: "Gentle Neck Stretch", duration: 20, perSide: true },
            { type: "list", name: "Wall Slides", reps: "6 slow reps" },
            { type: "timed", name: "Deep Breathing", duration: 60 },
          ],
        },
      ],
    },

    C: {
      key: "C",
      title: "Full Body + Surf Fitness",
      blocks: [
        {
          type: "warmup",
          title: "Warm-up",
          cardio: "2 min bike",
          items: [
            { type: "list", name: "World's Greatest Stretch", reps: "4/side" },
            { type: "list", name: "90/90 hip rotations", reps: "6/side" },
            { type: "list", name: "Glute bridges", reps: "10" },
            { type: "list", name: "Bird dogs", reps: "6/side" },
            { type: "list", name: "Band pull-aparts", reps: "15" },
            { type: "list", name: "Reverse lunges", reps: "5/side" },
            { type: "list", name: "Standing torso rotations", reps: "8/side" },
          ],
          note: "The World's Greatest Stretch + torso rotations give you some nice multidirectional movement without taking over the workout.",
        },
        {
          type: "exercise",
          title: "Dumbbell Romanian Deadlift",
          name: "Dumbbell Romanian Deadlift",
          sets: 3, reps: "8", rest: 90,
          cue: "Be conservative with the weight. If this causes back discomfort, substitute seated or lying hamstring curls.",
        },
        {
          type: "exercise",
          title: "Reverse Lunge",
          name: "Reverse Lunge",
          sets: 3, reps: "8 each leg", rest: 75,
        },
        {
          type: "superset",
          title: "Incline DB Press + Seated Cable Row",
          rounds: 3, rest: 60,
          moves: [
            { name: "Incline Dumbbell Press", reps: "8–10" },
            { name: "Seated Cable Row", reps: "10–12" },
          ],
        },
        {
          type: "exercise",
          title: "Cable Chop",
          name: "Cable Chop",
          sets: 3, reps: "8/side", rest: 45,
          cue: "Controlled rotation — don't crank through your lower back.",
        },
        {
          type: "exercise",
          title: "Suitcase Carry",
          name: "Suitcase Carry",
          sets: 3, reps: "30 m/side", rest: 50,
          cue: "Walk tall and resist leaning.",
        },
      ],
    },

    D: {
      key: "D",
      title: "Conditioning / Surf / Hike",
      isFlexible: true,
      blocks: [
        {
          type: "info",
          title: "Choose your session",
          items: [
            { name: "Surfing", detail: "Surf = Session D" },
            { name: "Hiking", detail: "Hike = Session D" },
            { name: "Neither", detail: "40–50 min Zone 2 cardio: incline treadmill, bike, rower, swimming, or elliptical. Keep it conversational." },
          ],
        },
        {
          type: "exercise",
          title: "Zone 2 Cardio (if not surfing/hiking)",
          name: "Zone 2 Cardio",
          isTimerOnly: true,
          duration: 45 * 60,
          cue: "Keep it conversational.",
        },
        {
          type: "cooldown",
          title: "Mobility (5–10 min)",
          items: [
            { type: "timed", name: "90/90 Flow", duration: 60 },
            { type: "timed", name: "Hip Flexor Stretch", duration: 30, perSide: true },
            { type: "list", name: "Thoracic Rotations", reps: "6/side" },
            { type: "timed", name: "Doorway Pec Stretch", duration: 30, perSide: true },
            { type: "list", name: "Gentle Neck Mobility", reps: "6/side" },
          ],
        },
      ],
    },
  },
};

if (typeof module !== "undefined") module.exports = { PROGRAM };
