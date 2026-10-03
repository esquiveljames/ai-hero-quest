/* =====================================================================
   js/demo.js
   ---------------------------------------------------------------------
   Hidden DEMO MODE for booth staff.
   Open it with:  Ctrl + Shift + D
            or :  tap the crest (top-left) 5 times quickly (touchscreens)
   ===================================================================== */

window.HQ = window.HQ || {};

(function () {
  "use strict";

  let panel = null;       // the panel element (built the first time it opens)
  let logBox = null;      // where test results are printed

  // Write a line to the panel's log box.
  function log(text) {
    if (!logBox) return;
    const time = new Date().toLocaleTimeString();
    logBox.textContent = `[${time}] ${text}\n` + logBox.textContent;
  }

  // Helper: make a button that runs "fn" when clicked.
  function button(label, fn) {
    const b = document.createElement("button");
    b.textContent = label;
    b.addEventListener("click", () => { try { fn(); } catch (e) { log("Error: " + e.message); } });
    return b;
  }

  // Helper: a titled row of buttons.
  function section(title, buttons) {
    const h = document.createElement("h3");
    h.textContent = title;
    const row = document.createElement("div");
    row.className = "row";
    buttons.forEach((b) => row.appendChild(b));
    panel.append(h, row);
  }

  // Build the panel once.
  function build() {
    panel = document.createElement("aside");
    panel.className = "demo";
    panel.hidden = true;
    panel.innerHTML = "<h2>🛠️ Demo Mode (staff)</h2><p>Visitors never see this. Ctrl+Shift+D to close.</p>";
    document.body.appendChild(panel);

    // Show any hero instantly
    section("Show a hero", window.HQ_ARCHETYPES.map((a) =>
      button(`${a.icon} ${a.name.replace("The ", "")}`, () => { HQ.app.showDemoHero(a.id); log("Showing " + a.name); })
    ));

    // AI tests
    const fbBtn = button("Force fallback: OFF", () => {
      HQ.ai.forceFallback = !HQ.ai.forceFallback;
      fbBtn.textContent = "Force fallback: " + (HQ.ai.forceFallback ? "ON" : "OFF");
      log("Force fallback " + (HQ.ai.forceFallback ? "ON (AI skipped)" : "OFF"));
    });
    section("AI", [
      button("Ping worker", async () => log(await HQ.ai.ping())),
      button("Test AI hero", async () => {
        log("Asking the AI…");
        const sample = window.HQ_QUESTIONS.map((q) => q.options[Math.floor(Math.random() * q.options.length)].id);
        const r = await HQ.ai.getHero(sample);
        log(`${r.source.toUpperCase()}${r.reason ? " (" + r.reason + ")" : ""}${HQ.ai.lastLatency && r.source === "ai" ? ", " + HQ.ai.lastLatency + " ms" : ""}\n${JSON.stringify(r.hero, null, 1)}`);
      }),
      fbBtn
    ]);

    // Audio tests
    section("Audio", [
      button("Test sounds", () => {
        HQ.audio.unlock();
        ["click", "select", "whoosh", "virtue", "secret"].forEach((n, i) => setTimeout(() => HQ.audio.sfx(n), i * 700));
        log("Playing sound effects (sound toggle must be ON)");
      }),
      button("Test music", () => { HQ.audio.unlock(); HQ.audio.startMusic(); HQ.audio.setMood("quest"); log("Music started (music toggle must be ON)"); }),
      button("Test voice", () => {
        HQ.audio.unlock();
        if (!HQ.audio.hasVoice()) { log("This browser has no speech support."); return; }
        HQ.audio.speak("The Oracle has studied your choices. You are... the Guardian.");
        log("Voice: " + HQ.audio.voiceName());
      })
    ]);

    // Other tests
    section("Booth", [
      button("Test camera", () => { HQ.app.showDemoHero("guardian", true); log("Opening camera with a demo hero"); }),
      button("Test print / PDF", () => {
        if (!HQ.app.state.result) HQ.app.showDemoHero("vanguard");
        setTimeout(() => HQ.app.openPrint(), 300);
        log("Opening the print window" + (window.jspdf ? "" : " (PDF library not loaded: Save as PDF will use the print dialog)"));
      }),
      button("Show Honor screen", () => HQ.app.go("honor")),
      button("Reset statistics", () => { HQ.wall.reset(); HQ.app.refreshPortal(); log("Today's hero count reset"); }),
      button("Return to Exhibit Mode", () => { toggle(false); HQ.app.reset(false); })
    ]);

    // Live status line
    const status = document.createElement("pre");
    status.textContent =
      `AI endpoint: ${HQ.ai.hasEndpoint() ? window.HQ_SETTINGS.ai.endpoint : "(none: offline mode)"}\n` +
      `Heroes today: ${HQ.wall.total()}\nVR: not included (see README, Phase 6).`;
    panel.appendChild(status);

    logBox = document.createElement("pre");
    logBox.textContent = "";
    panel.appendChild(logBox);
  }

  // Open or close the panel.
  function toggle(force) {
    if (!panel) build();
    panel.hidden = typeof force === "boolean" ? !force : !panel.hidden;
    if (HQ.app) HQ.app.setDemoOpen(!panel.hidden);    // pause idle resets while staff use it
  }

  // Keyboard shortcut: Ctrl + Shift + D
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
      e.preventDefault();
      toggle();
    }
  });

  // Touch shortcut: 5 quick taps on the crest
  let taps = [];
  document.getElementById("crest").addEventListener("click", () => {
    const now = Date.now();
    taps = taps.filter((t) => now - t < 2500);
    taps.push(now);
    if (taps.length >= 5) { taps = []; toggle(); }
  });

  HQ.demo = { toggle, log };
})();
