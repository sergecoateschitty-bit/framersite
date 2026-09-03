(() => {
  "use strict";

  // ---------- Persistence ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
    },
  };

  let currentWeek = clamp(store.get("fw_week", 1), 1, PROGRAM.weeks);
  let history = store.get("fw_history", []);

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function fmtTime(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }
  function phaseForWeek(week) {
    return PROGRAM.phases.find(p => week >= p.weeks[0] && week <= p.weeks[1]) || PROGRAM.phases[0];
  }
  function todaySessionKey() {
    const d = new Date().getDay(); // 0 Sun .. 6 Sat
    if (d === 1) return "A";
    if (d === 3) return "B";
    if (d === 5) return "C";
    if (d === 0 || d === 6) return "D";
    return null;
  }

  // ---------- Screen routing ----------
  const screens = {};
  document.querySelectorAll(".screen").forEach(el => { screens[el.id] = el; });
  const bottomNav = document.getElementById("bottom-nav");
  const TAB_SCREENS = new Set(["screen-home", "screen-progress"]);

  function showScreen(id) {
    Object.values(screens).forEach(el => el.classList.remove("active"));
    screens[id].classList.add("active");
    bottomNav.classList.toggle("hidden", !TAB_SCREENS.has(id));
    if (TAB_SCREENS.has(id)) {
      document.querySelectorAll(".nav-btn").forEach(b => {
        b.classList.toggle("active", (id === "screen-home" && b.dataset.nav === "home") || (id === "screen-progress" && b.dataset.nav === "progress"));
      });
    }
  }

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.nav === "home") { renderHome(); showScreen("screen-home"); }
      if (btn.dataset.nav === "progress") { renderProgress(); showScreen("screen-progress"); }
    });
  });

  // ---------- Sound / feedback ----------
  let audioCtx = null;
  function beep(times = 1) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      for (let i = 0; i < times; i++) {
        const t0 = audioCtx.currentTime + i * 0.22;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.2);
      }
    } catch (e) { /* audio not available */ }
  }
  function vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  }

  let wakeLock = null;
  async function requestWakeLock() {
    try { if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { /* ignore */ }
  }
  function releaseWakeLock() {
    try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) { /* ignore */ }
  }

  // ---------- Timer overlay ----------
  const timerEls = {
    label: document.getElementById("timer-label"),
    sublabel: document.getElementById("timer-sublabel"),
    display: document.getElementById("timer-display"),
    ring: document.getElementById("timer-ring-progress"),
    toggle: document.getElementById("timer-toggle"),
    restart: document.getElementById("timer-restart"),
    skip: document.getElementById("timer-skip"),
    overlay: document.getElementById("screen-timer"),
  };
  const RING_CIRC = 2 * Math.PI * 108;
  timerEls.ring.style.strokeDasharray = String(RING_CIRC);

  let timerState = null; // { totalMs, endAt, paused, remainingAtPause, raf, onDone }

  function openTimer({ seconds, label, sublabel, onDone, autostart = true }) {
    stopTimerLoop();
    timerState = {
      totalMs: seconds * 1000,
      remaining: seconds * 1000,
      endAt: null,
      paused: !autostart,
      onDone: onDone || null,
    };
    timerEls.label.textContent = label || "Timer";
    timerEls.sublabel.textContent = sublabel || "";
    timerEls.toggle.textContent = autostart ? "Pause" : "Start";
    showScreen("screen-timer");
    requestWakeLock();
    if (autostart) startTimerLoop();
    else renderTimerFrame(timerState.remaining);
  }

  function startTimerLoop() {
    timerState.paused = false;
    timerState.endAt = Date.now() + timerState.remaining;
    timerEls.toggle.textContent = "Pause";
    tickTimer();
  }
  function pauseTimerLoop() {
    timerState.paused = true;
    timerState.remaining = Math.max(0, timerState.endAt - Date.now());
    timerEls.toggle.textContent = "Start";
    if (timerState.raf) cancelAnimationFrame(timerState.raf);
  }
  function stopTimerLoop() {
    if (timerState && timerState.raf) cancelAnimationFrame(timerState.raf);
    releaseWakeLock();
  }
  function tickTimer() {
    if (!timerState || timerState.paused) return;
    const remaining = Math.max(0, timerState.endAt - Date.now());
    renderTimerFrame(remaining);
    if (remaining <= 0) {
      completeTimer();
      return;
    }
    timerState.raf = requestAnimationFrame(tickTimer);
  }
  function renderTimerFrame(remainingMs) {
    const secs = remainingMs / 1000;
    timerEls.display.textContent = fmtTime(secs);
    const frac = timerState.totalMs > 0 ? remainingMs / timerState.totalMs : 0;
    timerEls.ring.style.strokeDashoffset = String(RING_CIRC * (1 - frac));
  }
  function completeTimer() {
    stopTimerLoop();
    beep(3);
    vibrate([200, 100, 200]);
    timerEls.overlay.classList.add("timer-flash");
    setTimeout(() => timerEls.overlay.classList.remove("timer-flash"), 900);
    const cb = timerState && timerState.onDone;
    timerState = null;
    if (cb) setTimeout(cb, 550);
  }

  timerEls.toggle.addEventListener("click", () => {
    if (!timerState) return;
    if (timerState.paused) startTimerLoop(); else pauseTimerLoop();
  });
  timerEls.restart.addEventListener("click", () => {
    if (!timerState) return;
    timerState.remaining = timerState.totalMs;
    if (!timerState.paused) { timerState.endAt = Date.now() + timerState.remaining; tickTimer(); }
    else renderTimerFrame(timerState.remaining);
  });
  timerEls.skip.addEventListener("click", () => {
    if (!timerState) return;
    const cb = timerState.onDone;
    stopTimerLoop();
    timerState = null;
    if (cb) cb();
  });

  // ---------- Home screen ----------
  function renderHome() {
    document.getElementById("current-week-num").textContent = currentWeek;
    const phase = phaseForWeek(currentWeek);
    document.getElementById("phase-info").innerHTML = `
      <div><span class="phase-name">${phase.name}</span><span class="phase-rpe">${phase.rpe}</span></div>
      <div class="phase-notes">${phase.notes}</div>
    `;

    const today = todaySessionKey();
    const weeklyEl = document.getElementById("weekly-structure");
    weeklyEl.innerHTML = "";
    PROGRAM.weeklyStructure.forEach(row => {
      weeklyEl.appendChild(sessionRow(row.session, `${row.day}`, PROGRAM.sessions[row.session].title, row.session === today));
    });

    const allEl = document.getElementById("all-sessions");
    allEl.innerHTML = "";
    Object.keys(PROGRAM.sessions).forEach(key => {
      const s = PROGRAM.sessions[key];
      allEl.appendChild(sessionRow(key, `Session ${key}`, s.title, false));
    });
  }

  function sessionRow(key, kicker, title, isToday) {
    const btn = document.createElement("button");
    btn.className = "session-row" + (isToday ? " today" : "");
    btn.innerHTML = `
      <div class="session-badge">${key}</div>
      <div class="session-row-text">
        <div class="session-row-title">${title}</div>
        <div class="session-row-sub">${kicker}${isToday ? " · Today" : ""}</div>
      </div>
      <div class="session-row-chevron">›</div>
    `;
    btn.addEventListener("click", () => startSession(key));
    return btn;
  }

  document.getElementById("week-dec").addEventListener("click", () => {
    currentWeek = clamp(currentWeek - 1, 1, PROGRAM.weeks);
    store.set("fw_week", currentWeek);
    renderHome();
  });
  document.getElementById("week-inc").addEventListener("click", () => {
    currentWeek = clamp(currentWeek + 1, 1, PROGRAM.weeks);
    store.set("fw_week", currentWeek);
    renderHome();
  });

  // ---------- Player ----------
  let player = null; // { sessionKey, blocks, stepIndex, startedAt, elapsedTimer }

  function startSession(key) {
    const session = PROGRAM.sessions[key];
    player = {
      sessionKey: key,
      session,
      blocks: session.blocks,
      stepIndex: 0,
      startedAt: Date.now(),
    };
    document.getElementById("player-session-label").textContent = `Session ${key} · ${session.title}`;
    startElapsedClock();
    renderPlayerStep();
    showScreen("screen-player");
  }

  let elapsedInterval = null;
  function startElapsedClock() {
    stopElapsedClock();
    elapsedInterval = setInterval(() => {
      const s = Math.floor((Date.now() - player.startedAt) / 1000);
      document.getElementById("player-elapsed").textContent = fmtTime(s);
    }, 1000);
  }
  function stopElapsedClock() {
    if (elapsedInterval) clearInterval(elapsedInterval);
    elapsedInterval = null;
  }

  document.getElementById("player-close").addEventListener("click", () => {
    if (confirm("End this session early?")) {
      stopElapsedClock();
      renderHome();
      showScreen("screen-home");
    }
  });

  document.getElementById("player-prev").addEventListener("click", () => {
    if (!player) return;
    player.stepIndex = clamp(player.stepIndex - 1, 0, player.blocks.length - 1);
    renderPlayerStep();
  });
  document.getElementById("player-next").addEventListener("click", () => {
    if (!player) return;
    if (player.stepIndex >= player.blocks.length - 1) {
      finishSession();
      return;
    }
    player.stepIndex++;
    renderPlayerStep();
  });

  function renderPlayerStep() {
    const { blocks, stepIndex } = player;
    const block = blocks[stepIndex];
    const body = document.getElementById("player-body");
    body.scrollTop = 0;
    body.innerHTML = "";
    body.appendChild(renderBlock(block));

    const pct = ((stepIndex + 1) / blocks.length) * 100;
    document.getElementById("player-progress-fill").style.width = pct + "%";
    document.getElementById("player-prev").disabled = stepIndex === 0;
    document.getElementById("player-next").textContent = stepIndex === blocks.length - 1 ? "Finish Session" : "Next";
  }

  function renderBlock(block) {
    const wrap = document.createElement("div");

    if (block.type === "warmup" || block.type === "cooldown") {
      wrap.appendChild(h(block.title));
      if (block.cardio) {
        const p = document.createElement("div");
        p.className = "block-cardio";
        p.textContent = "🏃 " + block.cardio;
        wrap.appendChild(p);
      }
      block.items.forEach(item => wrap.appendChild(renderChecklistItem(item)));
      if (block.note) {
        const n = document.createElement("div");
        n.className = "block-cue";
        n.textContent = block.note;
        wrap.appendChild(n);
      }
      return wrap;
    }

    if (block.type === "exercise" && block.isTimerOnly) {
      wrap.appendChild(h(block.title));
      const card = document.createElement("div");
      card.className = "exercise-card";
      card.innerHTML = `
        <div class="exercise-name">${block.name}</div>
        ${block.cue ? `<div class="exercise-cue">${block.cue}</div>` : ""}
      `;
      const startBtn = document.createElement("button");
      startBtn.className = "footer-btn primary";
      startBtn.style.marginTop = "16px";
      startBtn.textContent = `Start ${Math.round(block.duration / 60)}-min Timer`;
      startBtn.addEventListener("click", () => {
        openTimer({
          seconds: block.duration,
          label: block.name,
          sublabel: "Keep it conversational",
          onDone: () => showScreen("screen-player"),
        });
      });
      card.appendChild(startBtn);
      wrap.appendChild(card);
      return wrap;
    }

    if (block.type === "exercise") {
      wrap.appendChild(h(block.title));
      wrap.appendChild(renderExerciseCard(block));
      return wrap;
    }

    if (block.type === "core") {
      wrap.appendChild(h(block.title));
      block.items.forEach(ex => wrap.appendChild(renderExerciseCard(ex)));
      return wrap;
    }

    if (block.type === "superset") {
      wrap.appendChild(h(block.title));
      wrap.appendChild(renderSuperset(block));
      return wrap;
    }

    if (block.type === "info") {
      wrap.appendChild(h(block.title));
      block.items.forEach(it => {
        const row = document.createElement("div");
        row.className = "info-item";
        row.innerHTML = `<div class="info-item-name">${it.name}</div><div class="info-item-detail">${it.detail}</div>`;
        wrap.appendChild(row);
      });
      return wrap;
    }

    return wrap;
  }

  function h(title) {
    const el = document.createElement("div");
    el.className = "block-title";
    el.textContent = title;
    return el;
  }

  function renderChecklistItem(item) {
    const row = document.createElement("button");
    row.className = "checklist-item";
    row.type = "button";
    const isTimed = item.type === "timed";
    row.innerHTML = `
      <span class="checklist-check">✓</span>
      <span class="checklist-text">${item.name}${item.reps ? `<div class="checklist-reps">${item.reps}</div>` : ""}</span>
      ${isTimed ? `<span class="checklist-play">▶</span>` : ""}
    `;
    const toggleDone = () => row.classList.toggle("done");
    if (isTimed) {
      const playBtn = row.querySelector(".checklist-play");
      playBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        runTimedItem(item, () => {
          row.classList.add("done");
          showScreen("screen-player");
        });
      });
      row.addEventListener("click", toggleDone);
    } else {
      row.addEventListener("click", toggleDone);
    }
    return row;
  }

  function runTimedItem(item, onAllDone) {
    if (item.perSide) {
      openTimer({
        seconds: item.duration,
        label: item.name,
        sublabel: "Side 1 of 2",
        onDone: () => {
          openTimer({
            seconds: item.duration,
            label: item.name,
            sublabel: "Side 2 of 2",
            onDone: onAllDone,
          });
        },
      });
    } else {
      openTimer({ seconds: item.duration, label: item.name, sublabel: "", onDone: onAllDone });
    }
  }

  function renderExerciseCard(ex) {
    const card = document.createElement("div");
    card.className = "exercise-card";

    const repsLabel = ex.hold
      ? `${ex.hold}s${ex.perSide ? "/side" : ""}`
      : (ex.reps || "—");

    card.innerHTML = `
      <div class="exercise-name">${ex.name}</div>
      <div class="exercise-meta">
        <div class="exercise-meta-item"><div class="exercise-meta-num">${ex.sets}</div><div class="exercise-meta-label">Sets</div></div>
        <div class="exercise-meta-item"><div class="exercise-meta-num">${repsLabel}</div><div class="exercise-meta-label">${ex.hold ? "Hold" : "Reps"}</div></div>
        <div class="exercise-meta-item"><div class="exercise-meta-num">${ex.rest}s</div><div class="exercise-meta-label">Rest</div></div>
      </div>
      ${ex.cue ? `<div class="exercise-cue">${ex.cue}</div>` : ""}
    `;

    const setRow = document.createElement("div");
    setRow.className = "set-row";
    const setBtns = [];
    for (let i = 0; i < ex.sets; i++) {
      const b = document.createElement("button");
      b.className = "set-btn" + (i === 0 ? " current" : "");
      b.textContent = `Set ${i + 1}`;
      b.addEventListener("click", () => handleSetTap(ex, i, b, setBtns));
      setBtns.push(b);
      setRow.appendChild(b);
    }
    card.appendChild(setRow);
    return card;
  }

  function handleSetTap(ex, index, btn, allBtns) {
    if (btn.classList.contains("done")) return;

    const markDoneAndMaybeRest = () => {
      btn.classList.remove("current");
      btn.classList.add("done");
      const next = allBtns[index + 1];
      if (next) next.classList.add("current");
      showScreen("screen-player");
    };

    const finishWithRest = () => {
      const isLast = index === allBtns.length - 1;
      if (isLast) { markDoneAndMaybeRest(); return; }
      openTimer({
        seconds: ex.rest,
        label: "Rest",
        sublabel: `${ex.name} · Set ${index + 1} of ${allBtns.length} done`,
        onDone: markDoneAndMaybeRest,
      });
    };

    if (ex.hold) {
      if (ex.perSide) {
        openTimer({
          seconds: ex.hold, label: ex.name, sublabel: "Side 1 of 2",
          onDone: () => openTimer({
            seconds: ex.hold, label: ex.name, sublabel: "Side 2 of 2",
            onDone: finishWithRest,
          }),
        });
      } else {
        openTimer({ seconds: ex.hold, label: ex.name, sublabel: `Set ${index + 1}`, onDone: finishWithRest });
      }
    } else {
      finishWithRest();
    }
  }

  function renderSuperset(block) {
    const card = document.createElement("div");
    card.className = "superset-card";
    const movesHtml = block.moves.map(m => `
      <div class="superset-move"><span>${m.name}</span><span class="superset-move-reps">${m.reps}</span></div>
    `).join("");
    card.innerHTML = movesHtml;

    const roundRow = document.createElement("div");
    roundRow.className = "round-row";
    let completedRounds = 0;
    const label = document.createElement("div");
    label.className = "exercise-cue";
    label.style.marginTop = "12px";
    label.textContent = `Round 1 of ${block.rounds}`;

    const btn = document.createElement("button");
    btn.className = "footer-btn primary";
    btn.textContent = "Complete Round";
    btn.addEventListener("click", () => {
      completedRounds++;
      if (completedRounds >= block.rounds) {
        btn.disabled = true;
        btn.textContent = "All Rounds Complete";
        label.textContent = `${block.rounds} of ${block.rounds} rounds complete`;
        return;
      }
      label.textContent = `Round ${completedRounds + 1} of ${block.rounds}`;
      openTimer({
        seconds: block.rest,
        label: "Rest",
        sublabel: `Round ${completedRounds} of ${block.rounds} done`,
        onDone: () => showScreen("screen-player"),
      });
    });

    roundRow.appendChild(btn);
    card.appendChild(label);
    card.appendChild(roundRow);
    return card;
  }

  function finishSession() {
    stopElapsedClock();
    const elapsedSec = Math.floor((Date.now() - player.startedAt) / 1000);
    history.unshift({
      date: new Date().toISOString(),
      week: currentWeek,
      sessionKey: player.sessionKey,
      sessionTitle: player.session.title,
      elapsedSec,
    });
    store.set("fw_history", history);

    document.getElementById("complete-summary").textContent =
      `Session ${player.sessionKey} · ${player.session.title} — ${fmtTime(elapsedSec)} · Week ${currentWeek}`;
    showScreen("screen-complete");
  }

  document.getElementById("complete-done").addEventListener("click", () => {
    player = null;
    renderHome();
    showScreen("screen-home");
  });

  // ---------- Progress ----------
  function renderProgress() {
    const list = document.getElementById("progress-list");
    const sub = document.getElementById("progress-subtitle");
    list.innerHTML = "";
    if (history.length === 0) {
      sub.textContent = "No sessions logged yet";
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Complete a session and it will show up here.";
      list.appendChild(empty);
      return;
    }
    sub.textContent = `${history.length} session${history.length === 1 ? "" : "s"} logged`;
    history.forEach(entry => {
      const row = document.createElement("div");
      row.className = "progress-row";
      const d = new Date(entry.date);
      const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      row.innerHTML = `
        <div>
          <div class="progress-row-title">Session ${entry.sessionKey} · ${entry.sessionTitle}</div>
          <div class="progress-row-sub">Week ${entry.week} · ${fmtTime(entry.elapsedSec)}</div>
        </div>
        <div class="progress-row-date">${dateStr}</div>
      `;
      list.appendChild(row);
    });
  }

  document.getElementById("progress-clear").addEventListener("click", () => {
    if (confirm("Clear all logged sessions?")) {
      history = [];
      store.set("fw_history", history);
      renderProgress();
    }
  });

  // ---------- Service worker ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => { /* offline install optional */ });
    });
  }

  // ---------- Init ----------
  renderHome();
  showScreen("screen-home");
})();
