# 8-Week Trainer (iOS-compatible fitness app)

A self-contained web app that walks you through the full 8-week Lower
Body/Upper Body/Full Body/Conditioning program, step by step, with a
built-in workout timer. It's built as an installable Progressive Web App
(PWA) rather than a native Xcode project, so it runs straight from Safari
on iPhone and can be added to your Home Screen to behave like a regular
iOS app — full screen, its own icon, and offline-capable — with no App
Store submission or Mac/Xcode required.

## What it includes

- **All 4 sessions (A–D)** from the program — Lower Body + Core, Upper
  Body + Posture, Full Body + Surf Fitness, and Conditioning — each
  broken into warm-up, main lifts, supersets/core work, and cool-down,
  exactly as written.
- **8-week progression** — a week stepper (1–8) shows the correct phase
  (Foundation / Build / Strength + Size / Progress), its RPE target, and
  coaching notes for that phase.
- **Step-by-step session player** — one block at a time (warm-up →
  exercise → exercise → core/superset → cool-down), with Back/Next
  controls and a progress bar, so you always know where you are in the
  60-minute session.
- **Timer feature**:
  - A rest timer that auto-starts after you tap a completed set (uses
    each exercise's prescribed rest time), with a circular countdown,
    pause/restart/skip, a triple-beep + vibration alert, and the screen
    kept awake while it runs.
  - Timed holds (e.g. Side Plank, stretches) run their own countdown,
    automatically chaining "Side 1 of 2" → "Side 2 of 2" for per-side
    moves.
  - Superset "Complete Round" button starts the rest timer between
    rounds automatically.
  - A full-length Zone 2 cardio timer for Session D.
- **Progress log** — every finished session is saved locally (date,
  week, session, duration) and shown on the Progress tab.
- Today's recommended session (based on the Mon/Wed/Fri/weekend
  structure) is highlighted on the Home screen.

## Running it

No build step — it's plain HTML/CSS/JS. Serve the folder over HTTP(S)
(a plain `file://` open works too, except the offline service worker
requires a real origin) and open it in Safari:

```bash
cd ios-fitness-app
python3 -m http.server 8080
# then visit http://localhost:8080 on your Mac/iPhone (same network)
```

For real iPhone use, host the folder anywhere that serves static files
over HTTPS (GitHub Pages, Netlify, Vercel, S3, etc.) and open that URL
in Safari on the phone.

## Installing on iPhone (Add to Home Screen)

1. Open the hosted URL in **Safari** on the iPhone.
2. Tap the **Share** icon → **Add to Home Screen**.
3. Launch it from the Home Screen icon — it opens full-screen with no
   Safari chrome, keeps working offline (service worker caches the app
   shell), and remembers your current week and session history between
   launches (stored locally on-device via `localStorage`).

## Wanting a native App Store app instead?

This repo builds a PWA because it can be fully implemented, tested, and
run here without Xcode/Swift or a Mac. If you eventually want a real
native build (App Store distribution, native notifications, HealthKit,
etc.), the cleanest path is wrapping this same HTML/CSS/JS in
[Capacitor](https://capacitorjs.com/) from a Mac with Xcode installed —
the program data (`data.js`) and UI logic (`app.js`) can be reused
as-is.

## File overview

- `index.html` — screen markup (Home, Session Player, Timer, Complete,
  Progress)
- `styles.css` — dark, iOS-native-feeling styling with safe-area insets
- `data.js` — the full 8-week program as structured data
- `app.js` — navigation, session player, timer engine, and
  `localStorage` persistence
- `manifest.json` / `sw.js` — PWA install + offline support
- `icons/` — home-screen icons
