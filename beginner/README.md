# Beginner Glute Plan (iOS-compatible fitness app)

A self-contained web app that walks a beginner through the 8-week
Lower Body + Glutes / Full Body / Glutes + Legs gym program, step by
step, with a built-in workout timer. Same engine as the `ios-fitness-app`
sibling folder in this repo, with a beginner-specific program, an RPE
guide, and a "priority lift" callout on hip thrusts. It's an installable
Progressive Web App (PWA) — runs straight from Safari on iPhone and can
be added to the Home Screen for a full-screen, offline-capable, app-like
experience, no App Store submission or Xcode required.

## What it includes

- **3 gym sessions (A–C) + 1 optional cardio day (D)** — Lower Body +
  Glutes, Full Body, Glutes + Legs, and an optional Fitness + Mobility
  day, each broken into warm-up, main lifts, and cool-down, exactly as
  written.
- **8-week progression** — a week stepper (1–8) shows the correct phase
  (Learn the Exercises / Start Progressing / Build Strength / Strongest
  Week / Consolidate), its RPE target, and coaching notes for that phase.
- **RPE guide card** on the Home screen (5 Easy → 9–10 Avoid for now) and
  a per-exercise RPE chip on every exercise card.
- **The Golden Rule card** — "If you can complete all your reps
  comfortably with good form, add a small amount of weight next time" —
  plus the priority lift chain (Hip Thrust → Leg Press → Squat →
  Hamstring Curl → Hip Abduction). Hip Thrust Machine entries carry a
  "★ Priority lift" tag.
- **Step-by-step session player** with Back/Next controls and a progress
  bar.
- **Timer feature**: auto-starting rest timers after each set, timed
  cool-down stretches (including per-side chaining), and a cardio timer
  for the optional day — with a circular countdown, pause/restart/skip,
  sound + vibration alert, and the screen kept awake while it runs.
- **Progress log** — every finished session is saved locally (separately
  from the other program in this repo) and shown on the Progress tab.

## Running it

```bash
cd ios-fitness-app-beginner
python3 -m http.server 8080
# then visit http://localhost:8080 on your Mac/iPhone (same network)
```

## Installing on iPhone (Add to Home Screen)

1. Open the hosted URL in **Safari** on the iPhone.
2. Tap the **Share** icon → **Add to Home Screen**.
3. Launch it from the Home Screen icon — full-screen, works offline, and
   remembers your week and session history between launches.

Its icon is pink/magenta so it's easy to tell apart from the other
8-week program in this repo on the Home Screen.

## File overview

Same structure as `../ios-fitness-app/`: `index.html`, `styles.css`,
`data.js` (this program's content), `app.js` (adds an RPE chip and
priority-lift tag on top of the shared engine), `manifest.json` / `sw.js`
for PWA install + offline support, and `icons/`.
