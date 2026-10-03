/* =====================================================================
   js/ai.js
   ---------------------------------------------------------------------
   Talks to YOUR serverless function (server/worker.js), never directly
   to the AI company. The secret API key lives only on the server.

   What the browser sends:
     /hero    { choices: ["q1_help", "q2_ask", ...] }   <- choice codes only
     /oracle  { question: "...", hero: "The Guardian" }  <- only if the visitor asks

   No names, photos, or personal details are ever sent.

   Golden rule: these functions NEVER throw errors. If anything goes
   wrong, they quietly return an offline (fallback) answer instead.
   ===================================================================== */

window.HQ = window.HQ || {};

(function () {
  "use strict";

  const S = window.HQ_SETTINGS.ai;
  const ARCHETYPES = window.HQ_ARCHETYPES;
  const SOCIETY = window.HQ_SOCIETY;

  const AI = {
    forceFallback: false,   // Demo Mode can switch this on to test offline mode
    lastLatency: null,      // how long the last AI call took (ms)
    lastError: null         // the last error message, for Demo Mode
  };

  // Is an AI server configured at all?
  const hasEndpoint = () => !!(S.endpoint && S.endpoint.trim());

  // POST some JSON to the worker, giving up after "timeoutMs".
  async function post(path, body, timeoutMs) {
    const controller = new AbortController();              // lets us cancel the request
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(S.endpoint.trim().replace(/\/$/, "") + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!res.ok) throw new Error("Server replied " + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);                                  // always stop the timeout clock
    }
  }

  // Tidy a piece of AI text: collapse spaces and cap its length.
  const clean = (s, max) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);

  // Check the AI's answer and convert it into the app's hero format.
  // If anything looks wrong, throw so we fall back safely.
  function normalize(data) {
    const name = clean(data && data.hero, 40).toLowerCase();
    const arch = ARCHETYPES.find((a) => a.name.toLowerCase() === name)
      || ARCHETYPES.find((a) => name.includes(a.id));
    if (!arch) throw new Error("Unknown hero: " + name);

    const traits = (Array.isArray(data.traits) ? data.traits : [])
      .map((t) => clean(t, 24)).filter(Boolean).slice(0, 4);
    const description = clean(data.description, 420);
    const prophecy = clean(data.prophecy, 220);
    const quest = clean(data.quest, 220);
    if (traits.length < 3 || !description || !prophecy || !quest) throw new Error("Incomplete AI answer");

    return {
      archetypeId: arch.id,
      hero: arch.name,
      primaryVirtue: clean(data.primaryVirtue, 24) || arch.primaryVirtue,
      secondaryVirtue: clean(data.secondaryVirtue, 24) || "Character",
      traits, description, prophecy, quest
    };
  }

  // MAIN CALL: turn the visitor's choices into a hero.
  // Returns { hero, source: "ai" | "fallback", reason? }
  AI.getHero = async function (choices) {
    if (AI.forceFallback || !hasEndpoint()) {
      return { hero: HQ.fallback.generate(choices), source: "fallback", reason: AI.forceFallback ? "forced" : "no endpoint" };
    }
    const t0 = performance.now();
    try {
      const data = await post("/hero", { choices }, S.timeoutMs);
      const hero = normalize(data);
      AI.lastLatency = Math.round(performance.now() - t0);
      AI.lastError = null;
      return { hero, source: "ai" };
    } catch (e) {
      AI.lastError = e.name === "AbortError" ? "Timed out" : String(e.message || e);
      console.warn("AI unavailable, using fallback:", AI.lastError);
      return { hero: HQ.fallback.generate(choices), source: "fallback", reason: AI.lastError };
    }
  };

  // Fill in {hero}, {values}, {meaning}, {quest} placeholders for offline answers.
  function localAnswer(presetId, hero) {
    const preset = SOCIETY.oraclePresets.find((p) => p.id === presetId);
    if (!preset) {
      return "The mists are thick right now, and my sight is clouded. Ask the guardians of this booth, our Honor Society members. They will gladly answer you.";
    }
    const arch = ARCHETYPES.find((a) => a.id === (hero && hero.archetypeId)) || ARCHETYPES[0];
    return preset.local
      .replace("{hero}", arch.name)
      .replace("{values}", arch.values.join(", "))
      .replace("{meaning}", arch.meaning)
      .replace("{quest}", hero ? hero.quest : arch.fallback.quests[0]);
  }

  // OPTIONAL SECOND CALL: "Ask the Oracle".
  // Returns { text, source: "ai" | "fallback" }
  AI.ask = async function (question, presetId, hero) {
    if (AI.forceFallback || !hasEndpoint()) return { text: localAnswer(presetId, hero), source: "fallback" };
    try {
      const data = await post("/oracle", { question: clean(question, 160), hero: hero ? hero.hero : null }, S.timeoutMs);
      const text = clean(data && data.answer, 600);
      if (!text) throw new Error("Empty answer");
      return { text, source: "ai" };
    } catch (e) {
      AI.lastError = String(e.message || e);
      return { text: localAnswer(presetId, hero), source: "fallback" };
    }
  };

  // Demo Mode: quick health check of the worker.
  AI.ping = async function () {
    if (!hasEndpoint()) return "No endpoint set in config/settings.js (offline mode).";
    const t0 = performance.now();
    try {
      const res = await fetch(S.endpoint.trim().replace(/\/$/, "") + "/health");
      return `Worker replied ${res.status} in ${Math.round(performance.now() - t0)} ms`;
    } catch (e) {
      return "Worker unreachable: " + (e.message || e);
    }
  };

  AI.hasEndpoint = hasEndpoint;
  HQ.ai = AI;
})();
