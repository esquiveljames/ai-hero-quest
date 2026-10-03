/* =====================================================================
   js/app.js
   ---------------------------------------------------------------------
   The conductor. Controls the visitor journey:

     Portal -> Oracle -> 5 quest scenes -> Analysis -> Hero Reveal
            -> (Ask the Oracle / Capture your hero / Honor Society)

   Plus Exhibit Mode: idle resets, attract loop, restart button,
   keyboard shortcuts, and a secret Easter egg.

   KEY IDEA: every visitor gets a "session id" (state.sid). When the app
   resets, the id changes, and any slow leftover work from the previous
   visitor (like a late AI reply) is ignored. So one visitor's result
   can never appear for the next visitor.
   ===================================================================== */

window.HQ = window.HQ || {};

(function () {
  "use strict";

  const SET = window.HQ_SETTINGS;
  const QUESTIONS = window.HQ_QUESTIONS;
  const ARCHETYPES = window.HQ_ARCHETYPES;
  const SOCIETY = window.HQ_SOCIETY;
  const $ = (id) => document.getElementById(id);           // shortcut for getElementById

  // Everything about the CURRENT visitor lives here.
  const state = {
    sid: 0,              // session id (changes on every reset)
    screen: "portal",    // which screen is showing
    qIndex: 0,           // which quest scene (0-4)
    choices: [],         // the visitor's choice ids
    result: null,        // { hero, source } after the reveal
    locked: false,       // blocks double-taps during transitions
    askCount: 0,         // "Ask the Oracle" questions used
    modal: null,         // which pop-up window is open, if any
    attract: false,      // is the Honor screen showing as an idle "attract loop"?
    demoOpen: false,     // staff Demo Mode open? (pauses idle resets)
    lastActivity: Date.now()
  };

  const ABORT = "abort";   // special signal used to stop old animations

  // Wait "ms" milliseconds. If the visitor changed (reset) meanwhile, stop.
  function wait(ms, sid) {
    return new Promise((resolve, reject) => {
      setTimeout(() => (sid !== undefined && sid !== state.sid ? reject(ABORT) : resolve()), ms);
    });
  }

  // Typewriter effect: reveal text one letter at a time.
  async function typeText(el, text, speed, sid) {
    if (HQ.visuals.reduceMotion) { el.textContent = text; return; }
    el.textContent = "";
    for (let i = 0; i < text.length; i++) {
      el.textContent += text[i];
      await wait(speed, sid);
    }
  }

  // Show or hide a "reveal-able" element (.rv in the CSS).
  const show = (el) => el && el.classList.add("show");
  const hide = (el) => el && el.classList.remove("show");

  /* ===================================================================
     SCREENS
     =================================================================== */
  const MUSIC_FOR = { portal: "portal", honor: "portal", oracle: "quest", quest: "quest", analysis: "analysis", reveal: "reveal" };

  function go(name) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === "screen-" + name));
    state.screen = name;
    state.lastActivity = Date.now();
    HQ.audio.setMood(MUSIC_FOR[name] || "portal");
    HQ.visuals.setMode(name === "analysis" ? "converge" : "drift");
    if (name === "honor") $("btnBackHero").hidden = !state.result;
    if (name === "portal") refreshPortal();
  }

  // Update the "Heroes discovered today" line.
  function refreshPortal() {
    const n = HQ.wall.total();
    $("heroCount").textContent = n > 0
      ? `🏆 ${n} ${n === 1 ? "hero" : "heroes"} discovered today`
      : "🏆 Be the first hero discovered today";
  }

  /* ===================================================================
     SCREEN 1 -> 2: BEGIN, MEET THE ORACLE
     =================================================================== */
  async function begin() {
    if (state.screen !== "portal" && state.screen !== "honor") return;
    HQ.audio.unlock();                 // browsers only allow sound after a tap
    HQ.audio.startMusic();
    HQ.audio.sfx("portal");
    HQ.visuals.burst();
    freshVisitor();
    const sid = state.sid;
    hide($("btnAccept"));
    $("oracleLine").textContent = "";
    go("oracle");
    try {
      await wait(700, sid);
      HQ.audio.speak(SOCIETY.oracleGreeting);
      await typeText($("oracleLine"), SOCIETY.oracleGreeting, 40, sid);
      show($("btnAccept"));
    } catch (e) { /* visitor reset: stop quietly */ }
  }

  // Wipe everything about the previous visitor.
  function freshVisitor() {
    state.sid++;
    state.qIndex = 0;
    state.choices = [];
    state.result = null;
    state.locked = false;
    state.askCount = 0;
    state.attract = false;
  }

  /* ===================================================================
     SCREEN 3: THE MINI QUEST
     =================================================================== */
  function startQuest() {
    if (state.screen !== "oracle") return;
    HQ.audio.sfx("click");
    HQ.audio.stopVoice();
    state.qIndex = 0;
    state.choices = [];
    renderQuestion(0);
    go("quest");
  }

  // Progress diamonds at the top.
  function renderPips() {
    const pips = $("questPips");
    pips.innerHTML = "";
    QUESTIONS.forEach((q, i) => {
      const li = document.createElement("li");
      if (i < state.qIndex) li.className = "done";
      if (i === state.qIndex) li.className = "current";
      pips.appendChild(li);
    });
  }

  // Draw quest scene number i.
  function renderQuestion(i) {
    const q = QUESTIONS[i];
    renderPips();
    $("questNum").textContent = `Quest ${i + 1} of ${QUESTIONS.length}`;
    $("questTitle").textContent = q.title;
    $("questText").textContent = q.text;
    const box = $("questChoices");
    box.innerHTML = "";
    box.classList.toggle("six", q.options.length > 4);    // 3-column grid for the relic scene
    q.options.forEach((opt, n) => {
      const b = document.createElement("button");
      b.className = "choice";
      b.dataset.id = opt.id;
      b.setAttribute("aria-label", `${n + 1}. ${opt.label}`);
      b.innerHTML = `<span class="rune" aria-hidden="true">${opt.icon}</span><span></span>`;
      b.lastChild.textContent = opt.label;                 // safe text insert
      b.addEventListener("click", () => choose(b, opt));
      box.appendChild(b);
    });
    const card = $("questCard");
    card.classList.remove("leave", "enter");
    void card.offsetWidth;                                 // restart the CSS animation
    card.classList.add("enter");
  }

  // The visitor tapped a choice.
  async function choose(btn, opt) {
    if (state.locked || state.screen !== "quest") return;
    state.locked = true;                                   // ignore extra taps
    const sid = state.sid;
    btn.classList.add("chosen");
    document.querySelectorAll(".choice").forEach((b) => { if (b !== btn) b.classList.add("faded"); });
    HQ.audio.sfx("select");
    state.choices.push(opt.id);
    try {
      await wait(600, sid);
      if (state.qIndex < QUESTIONS.length - 1) {
        $("questCard").classList.add("leave");             // slide out
        HQ.audio.sfx("whoosh");
        await wait(380, sid);
        state.qIndex++;
        renderQuestion(state.qIndex);                      // slide in the next scene
        state.locked = false;
      } else {
        analyze();
      }
    } catch (e) { /* reset happened */ }
  }

  /* ===================================================================
     SCREEN 4: CONSULTING THE ORACLE (the AI call happens here)
     =================================================================== */
  const STATUS_LINES = [
    "Reading your choices…",
    "Mapping your virtues…",
    "Tracing your heroic path…",
    "The Oracle is awakening…"
  ];

  async function analyze() {
    const sid = state.sid;
    // Fresh, assembling sigil
    const slot = $("analysisSigil");
    slot.innerHTML = HQ.visuals.sigil();
    slot.firstElementChild.classList.add("assemble");
    const status = $("analysisStatus");
    status.textContent = STATUS_LINES[0];
    go("analysis");
    HQ.audio.sfx("hum");
    HQ.audio.speak("The Oracle is reading your quest.");

    // Rotate the status lines every 1.3 seconds
    let line = 0;
    const rotator = setInterval(() => {
      status.classList.add("fade");
      setTimeout(() => {
        line = (line + 1) % STATUS_LINES.length;
        status.textContent = STATUS_LINES[line];
        status.classList.remove("fade");
      }, 350);
    }, 1300);

    try {
      // Ask the AI AND wait the minimum suspense time, whichever is longer.
      const [result] = await Promise.all([
        HQ.ai.getHero(state.choices.slice()),
        wait(SET.ai.minAnalysisMs, sid)
      ]);
      clearInterval(rotator);
      if (sid !== state.sid) return;                       // visitor changed: ignore late reply
      state.result = result;
      HQ.wall.record(result.hero.archetypeId);
      await reveal(result, sid);
    } catch (e) {
      clearInterval(rotator);
      if (e !== ABORT) console.error(e);
    }
  }

  /* ===================================================================
     SCREEN 5: THE HERO REVEAL (the big WOW moment)
     =================================================================== */
  async function reveal(result, sid) {
    const h = result.hero;
    const arch = ARCHETYPES.find((a) => a.id === h.archetypeId) || ARCHETYPES[0];
    const screen = $("screen-reveal");

    // 1. Prepare all the content while it is still hidden
    document.documentElement.style.setProperty("--hero-color", arch.color);
    screen.querySelectorAll(".rv").forEach(hide);
    $("fallbackNote").hidden = result.source !== "fallback";
    $("revealSigil").innerHTML = HQ.visuals.sigil();
    $("heroIcon").textContent = arch.icon;
    $("heroNameText").textContent = h.hero;
    $("primaryVirtue").textContent = h.primaryVirtue.toUpperCase();
    $("secondaryVirtue").textContent = "with " + h.secondaryVirtue;
    $("heroDesc").textContent = "";
    $("heroProphecy").textContent = "“" + h.prophecy + "”";
    $("heroTraits").innerHTML = "";
    $("heroQuest").textContent = h.quest;
    screen.scrollTop = 0;

    // 2. Flash of light, boom, music swells
    go("reveal");
    HQ.audio.stopVoice();
    HQ.audio.sfx("reveal");
    HQ.visuals.burst();
    const flash = $("revealFlash");
    flash.classList.remove("go"); void flash.offsetWidth; flash.classList.add("go");

    const intro = HQ.audio.speak("The Oracle has studied your choices. Your path has been revealed.");
    await wait(500, sid);
    show($("revealKicker"));
    show($("fallbackNote"));
    await wait(700, sid);
    show($("revealSigil"));
    await wait(600, sid);
    HQ.visuals.lightUp($("revealSigil").querySelector("svg"), arch.lights);   // the hero's light blazes
    HQ.audio.sfx("virtue");
    await Promise.race([intro, wait(4500)]);               // wait for the voice (max 4.5 s)
    if (sid !== state.sid) return;

    // 3. "You are... THE GUARDIAN"
    show($("heroPre"));
    HQ.audio.speak("You are... " + h.hero.replace(/^The /, "the ") + ".");
    await wait(1100, sid);
    show($("heroName"));
    HQ.audio.sfx("impact");
    await wait(900, sid);
    show($("virtueBanner"));
    HQ.audio.sfx("virtue");

    // 4. The Oracle's reading types out
    await wait(800, sid);
    show($("blockReading"));
    await typeText($("heroDesc"), h.description, 18, sid);
    await wait(300, sid);
    show($("heroProphecy"));

    // 5. Traits pop in one by one with chimes
    await wait(700, sid);
    show($("blockTraits"));
    for (let i = 0; i < h.traits.length; i++) {
      await wait(420, sid);
      const span = document.createElement("span");
      span.className = "trait";
      span.textContent = h.traits[i];
      $("heroTraits").appendChild(span);
      HQ.audio.sfx("chime", i);
    }

    // 6. The quest scroll unrolls
    await wait(600, sid);
    show($("blockQuest"));
    HQ.audio.sfx("scroll");
    await wait(1000, sid);
    show($("revealActions"));
    state.lastActivity = Date.now();
    await wait(3500, sid);
    HQ.audio.setMood("calm");                              // music settles down
  }

  // Demo Mode: jump straight to any hero (optionally open the camera).
  function showDemoHero(archetypeId, openCamera) {
    HQ.audio.unlock();
    HQ.audio.startMusic();
    closeModals();
    freshVisitor();
    const sid = state.sid;
    const result = { hero: HQ.fallback.generate([], archetypeId), source: "demo" };
    state.result = result;
    if (openCamera) {
      // Show the reveal instantly, then open the camera
      reveal(result, sid).catch(() => {});
      openSelfie();
    } else {
      reveal(result, sid).catch(() => {});
    }
  }

  /* ===================================================================
     ASK THE ORACLE (optional second AI interaction)
     =================================================================== */
  function openAsk() {
    if (!state.result) return;
    HQ.audio.sfx("click");
    state.modal = "ask";
    $("askAnswer").textContent = "Choose a question, seeker.";
    $("askType").hidden = !SET.ai.allowTyping;
    $("askInput").value = "";
    const chips = $("askChips");
    chips.innerHTML = "";
    SOCIETY.oraclePresets.forEach((p) => {
      const b = document.createElement("button");
      b.className = "btn btn-stone";
      b.textContent = p.label;
      b.addEventListener("click", () => ask(p.label, p.id));
      chips.appendChild(b);
    });
    $("modalAsk").classList.add("open");
  }

  async function ask(question, presetId) {
    const answerEl = $("askAnswer");
    const sid = state.sid;
    if (!question.trim()) return;
    if (state.askCount >= SET.ai.maxOracleQuestions) {
      answerEl.textContent = "The Oracle has shared all it can for now. Our Honor Society members at this booth can tell you more!";
      return;
    }
    state.askCount++;
    HQ.audio.sfx("hum");
    answerEl.textContent = "🔮 The Oracle gazes into the mist…";
    const r = await HQ.ai.ask(question, presetId, state.result && state.result.hero);
    if (sid !== state.sid || state.modal !== "ask") return;
    HQ.audio.sfx("virtue");
    HQ.audio.speak(r.text);
    try { await typeText(answerEl, r.text, 16, sid); } catch (e) { /* reset */ }
  }

  /* ===================================================================
     CAMERA, HONOR SCREEN, MODALS
     =================================================================== */
  function openSelfie() {
    if (!state.result) return;
    HQ.audio.sfx("click");
    state.modal = "camera";
    HQ.camera.open(state.result.hero, () => { if (state.modal === "camera") state.modal = null; });
  }

  // Print / Save as PDF window (js/print.js)
  function openPrint() {
    if (!state.result) return;
    HQ.audio.sfx("click");
    state.modal = "print";
    HQ.print.open(state.result, () => { if (state.modal === "print") state.modal = null; });
  }

  // Fill the Honor Society screen from config/society.js
  function renderHonor() {
    $("crestName").textContent = SOCIETY.shortName;
    $("honorClosing1").textContent = SOCIETY.closing[0];
    $("honorClosing2").textContent = SOCIETY.closing[1];
    $("honorName").textContent = SOCIETY.name;
    $("honorYear").textContent = SOCIETY.academicYear;
    $("honorPurpose").textContent = SOCIETY.purpose;
    const fill = (id, items) => {
      const ul = $(id);
      ul.innerHTML = "";
      items.forEach((t) => { const li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
    };
    fill("honorActivities", SOCIETY.activities);
    fill("honorMembership", SOCIETY.membership);
    $("honorCtaScholar").textContent = SOCIETY.cta.scholar;
    $("honorCtaAll").textContent = SOCIETY.cta.everyone;
    $("honorContact").textContent = SOCIETY.contact.text;
    // QR code only if a link is configured AND the QR library loaded
    if (SOCIETY.contact.url && window.QRCode) {
      try {
        new QRCode($("honorQr"), { text: SOCIETY.contact.url, width: 240, height: 240 });
        $("honorQr").hidden = false;
      } catch (e) { /* skip QR */ }
    }
  }

  function closeModals() {
    $("modalAsk").classList.remove("open");
    $("modalSecret").classList.remove("open");
    HQ.camera.close();
    HQ.print.close();
    state.modal = null;
  }

  /* ===================================================================
     SECRET EASTER EGG: tap the portal sigil's lights in order
     book (lumen) -> flame (ember) -> star
     =================================================================== */
  const SECRET_ORDER = ["lumen", "ember", "star"];
  let secretProgress = [];

  function onSigilTap(e) {
    const g = e.target.closest(".light");
    if (!g || state.screen !== "portal") return;
    HQ.audio.unlock();
    const which = g.dataset.light;
    g.classList.remove("tap"); void g.getBoundingClientRect(); g.classList.add("tap");   // little pop
    HQ.audio.sfx("chime", secretProgress.length);
    secretProgress.push(which);
    // Wrong order? Start over (counting this tap if it is the first light).
    if (SECRET_ORDER[secretProgress.length - 1] !== which) {
      secretProgress = which === SECRET_ORDER[0] ? [which] : [];
    }
    if (secretProgress.length === SECRET_ORDER.length) {
      secretProgress = [];
      HQ.visuals.lightUp($("portalSigil").querySelector("svg"), SECRET_ORDER);
      HQ.visuals.burst();
      HQ.audio.sfx("secret");
      $("secretTitle").textContent = SOCIETY.secret.title;
      $("secretText").textContent = SOCIETY.secret.text;
      $("secretHint").textContent = SOCIETY.secret.hint;
      state.modal = "secret";
      $("modalSecret").classList.add("open");
      HQ.audio.speak(SOCIETY.secret.text);
    }
  }

  /* ===================================================================
     RESET (next visitor) and IDLE TIMER
     =================================================================== */
  async function reset(withVeil) {
    freshVisitor();                                        // new session id: old work is ignored
    closeModals();
    HQ.audio.stopVoice();
    const finish = () => {
      $("analysisSigil").innerHTML = "";
      $("revealSigil").innerHTML = "";
      $("heroDesc").textContent = "";
      HQ.visuals.lightUp($("portalSigil").querySelector("svg"), []);
      go("portal");
    };
    if (withVeil) {
      $("veil").classList.add("on");
      await new Promise((r) => setTimeout(r, 1400));
      finish();
      $("veil").classList.remove("on");
    } else {
      finish();
    }
  }

  // Every second, check whether the booth has been left alone.
  setInterval(() => {
    if (state.demoOpen) return;
    const idle = (Date.now() - state.lastActivity) / 1000;
    const ex = SET.exhibit;
    if (state.modal) {
      if (idle > ex.idleModalSeconds) reset(true);
      return;
    }
    switch (state.screen) {
      case "portal":
        if (idle > ex.attractAfterSeconds) { go("honor"); state.attract = true; }   // attract loop
        break;
      case "honor":
        if (state.attract && idle > ex.attractHoldSeconds) { state.attract = false; go("portal"); }
        else if (!state.attract && idle > ex.idleRevealSeconds) reset(true);
        break;
      case "oracle":
      case "quest":
        if (idle > ex.idleQuestSeconds) reset(true);
        break;
      case "reveal":
        if (idle > ex.idleRevealSeconds) reset(true);
        break;
      // "analysis" never times out: the AI call always finishes or falls back
    }
  }, 1000);

  // Any touch, click, or key counts as activity.
  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    document.addEventListener(ev, () => { state.lastActivity = Date.now(); }, { passive: true }));

  /* ===================================================================
     BUTTONS, KEYBOARD, AND EXHIBIT PROTECTIONS
     =================================================================== */
  $("btnBegin").addEventListener("click", begin);
  $("btnBeginHonor").addEventListener("click", begin);
  $("btnAccept").addEventListener("click", startQuest);
  $("btnAsk").addEventListener("click", openAsk);
  $("btnSelfie").addEventListener("click", openSelfie);
  $("btnPrint").addEventListener("click", openPrint);
  $("btnHonor").addEventListener("click", () => { HQ.audio.sfx("click"); state.attract = false; go("honor"); });
  $("btnBackHero").addEventListener("click", () => { HQ.audio.sfx("click"); go("reveal"); HQ.audio.setMood("calm"); });
  $("btnNew").addEventListener("click", () => { HQ.audio.sfx("whoosh"); reset(true); });
  $("btnRestart").addEventListener("click", () => { HQ.audio.sfx("click"); reset(state.screen !== "portal"); });
  $("askClose").addEventListener("click", () => { HQ.audio.stopVoice(); $("modalAsk").classList.remove("open"); state.modal = null; });
  $("askSend").addEventListener("click", () => ask($("askInput").value, null));
  $("askInput").addEventListener("keydown", (e) => { if (e.key === "Enter") ask($("askInput").value, null); });
  $("secretClose").addEventListener("click", () => { HQ.audio.stopVoice(); $("modalSecret").classList.remove("open"); state.modal = null; });

  // Sound / music / voice toggles
  [["btnSound", "sfx"], ["btnMusic", "music"], ["btnVoice", "voice"]].forEach(([id, kind]) => {
    const b = $(id);
    const paint = () => { const on = HQ.audio.isOn(kind); b.classList.toggle("off", !on); b.setAttribute("aria-pressed", on); };
    paint();
    b.addEventListener("click", () => { HQ.audio.unlock(); HQ.audio.toggle(kind); paint(); });
  });

  // Keyboard fallback: Enter to begin, 1-6 to choose, Escape to close windows.
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;              // typing a question: leave keys alone
    if (e.key === "Escape" && state.modal) { closeModals(); return; }
    if (e.key === "Enter" && state.screen === "portal" && !state.modal) { begin(); return; }
    if (e.key === "Enter" && state.screen === "oracle" && $("btnAccept").classList.contains("show")) { startQuest(); return; }
    if (state.screen === "quest" && /^[1-6]$/.test(e.key)) {
      const btn = document.querySelectorAll(".choice")[Number(e.key) - 1];
      if (btn) btn.click();
    }
  });

  // Exhibit protections: no right-click menu, no accidental "Back", confirm before closing.
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  history.pushState(null, "", location.href);
  window.addEventListener("popstate", () => history.pushState(null, "", location.href));
  if (SET.exhibit.confirmBeforeLeave) {
    window.addEventListener("beforeunload", (e) => { e.preventDefault(); e.returnValue = ""; });
  }

  /* ===================================================================
     START UP
     =================================================================== */
  $("portalSigil").innerHTML = HQ.visuals.sigil({ spin: true });
  $("portalSigil").addEventListener("click", onSigilTap);
  $("oracleFigure").innerHTML = HQ.visuals.oracle();
  renderHonor();
  refreshPortal();

  // Things Demo Mode needs
  HQ.app = {
    go, reset, refreshPortal, showDemoHero, openPrint,
    setDemoOpen: (open) => { state.demoOpen = open; state.lastActivity = Date.now(); },
    state
  };
})();
