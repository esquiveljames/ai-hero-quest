/* =====================================================================
   config/settings.js
   ---------------------------------------------------------------------
   Booth-wide settings. This is the FIRST file to edit before the event.
   Everything here is plain data, so you can change values safely
   without touching the app logic.
   ===================================================================== */

// We attach the settings to "window" so every other script can read them.
window.HQ_SETTINGS = {

  /* ---------------- AI (the Oracle) ---------------- */
  ai: {
    // The web address of your Cloudflare Worker (README, Step 3).
    // Example: "https://ai-hero-quest-oracle.yourname.workers.dev"
    // Leave it EMPTY ("") and the app runs entirely in offline mode,
    // using the local fallback Oracle. Handy for testing!
    endpoint: "",

    // If the AI has not answered after this many milliseconds,
    // the app gives up and uses the offline fallback (8000 ms = 8 s).
    timeoutMs: 8000,

    // The "Consulting the Oracle" animation always lasts at least this
    // long, even when the AI is fast. The suspense is part of the show.
    minAnalysisMs: 4200,

    // How many "Ask the Oracle" questions one visitor may ask.
    // This keeps API costs predictable.
    maxOracleQuestions: 3,

    // Allow visitors to type their own question to the Oracle.
    // Preset question buttons are always shown either way.
    allowTyping: true
  },

  /* ---------------- AUDIO ---------------- */
  audio: {
    sfxOn: true,          // sound effects start ON
    musicOn: true,        // background music starts ON
    voiceOn: true,        // Oracle voice starts ON
    musicVolume: 0.55,    // 0.0 (silent) to 1.0 (full)
    sfxVolume: 0.8,       // 0.0 to 1.0
    voiceRate: 0.86,      // speaking speed (1.0 = normal; lower = slower, more mystical)
    voicePitch: 0.92,     // voice pitch (1.0 = normal; lower = deeper)

    // The app picks the first installed voice whose name contains one of these.
    // Natural voices sound best (Microsoft Edge on Windows has great ones).
    preferredVoices: [
      "Natural",            // e.g. "Microsoft Sonia Online (Natural)"
      "Google UK English Female",
      "Microsoft Libby",
      "Microsoft Sonia",
      "Microsoft Aria",
      "Samantha",
      "Karen"
    ]
  },

  /* ---------------- EXHIBIT MODE ---------------- */
  exhibit: {
    idleQuestSeconds: 30,     // no taps during the quest for 30 s  -> reset
    idleRevealSeconds: 60,    // no taps on the result screen for 60 s -> reset
    idleModalSeconds: 90,     // no taps inside Ask/Camera windows for 90 s -> reset
    attractAfterSeconds: 45,  // idle on the opening screen -> show the Honor Society screen
    attractHoldSeconds: 20,   // ...for 20 s, then return to the opening screen
    photoDisplaySeconds: 20,  // a hero photo stays on screen for 20 s, then is erased
    confirmBeforeLeave: true  // ask before the browser tab is closed or reloaded
  }
};
