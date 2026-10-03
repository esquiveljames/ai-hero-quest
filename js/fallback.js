/* =====================================================================
   js/fallback.js
   ---------------------------------------------------------------------
   The OFFLINE Oracle. Used when:
     - no AI endpoint is configured,
     - the internet or the AI service is down,
     - the AI takes too long, or
     - staff turn on "Force fallback" in Demo Mode.

   How it works:
     1. Add up the virtue points of the visitor's five choices.
     2. The highest virtue picks the hero; the second picks the secondary virtue.
     3. Pick hand-written text at random from the hero's pools.
     4. Weave in two of the visitor's actual choices ("You stayed beside...")
        so the reading still feels personal.
   The result has EXACTLY the same shape as the AI result.
   ===================================================================== */

window.HQ = window.HQ || {};

(function () {
  "use strict";

  const QUESTIONS = window.HQ_QUESTIONS;
  const ARCHETYPES = window.HQ_ARCHETYPES;
  const VIRTUES = ["Service", "Scholarship", "Leadership", "Excellence", "Integrity", "Community"];

  // Find the option object for a choice id like "q1_help".
  function findOption(id) {
    for (const q of QUESTIONS) {
      const o = q.options.find((opt) => opt.id === id);
      if (o) return o;
    }
    return null;
  }

  // Pick one random item from a list.
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  // Return a shuffled copy of a list (Fisher-Yates shuffle).
  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Build a hero profile.
  //   choiceIds       = the visitor's choices, e.g. ["q1_help", "q2_ask", ...]
  //   forceArchetype  = (optional) an archetype id, used by Demo Mode
  function generate(choiceIds, forceArchetype) {
    const chosen = (choiceIds || []).map(findOption).filter(Boolean);

    // 1. Total points per virtue
    const score = {};
    VIRTUES.forEach((v) => (score[v] = 0));
    chosen.forEach((opt) => {
      for (const v in opt.weights) score[v] = (score[v] || 0) + opt.weights[v];
    });

    // 2. Rank virtues. Ties are broken by the final relic, then randomly.
    const relic = chosen[chosen.length - 1];
    const relicPts = (v) => (relic && relic.weights[v]) || 0;
    const ranked = VIRTUES.slice().sort((a, b) =>
      (score[b] - score[a]) || (relicPts(b) - relicPts(a)) || (Math.random() - 0.5));

    const arch = (forceArchetype && ARCHETYPES.find((a) => a.id === forceArchetype))
      || ARCHETYPES.find((a) => a.primaryVirtue === ranked[0])
      || ARCHETYPES[0];
    const primary = arch.primaryVirtue;
    const secondary = ranked.find((v) => v !== primary) || "Character";

    // 3. Traits: two from the hero's pool + one from the secondary virtue's hero
    const secondaryArch = ARCHETYPES.find((a) => a.primaryVirtue === secondary);
    let traits = shuffle(arch.traitsPool).slice(0, 2);
    const extra = secondaryArch ? shuffle(secondaryArch.traitsPool).find((t) => !traits.includes(t)) : null;
    if (extra) traits.push(extra);
    while (traits.length < 3) {                            // safety: always 3 traits
      const t = arch.traitsPool.find((x) => !traits.includes(x));
      if (!t) break;
      traits.push(t);
    }

    // 4. Personal touch: mention two choices that support the hero's virtue
    let description = pick(arch.fallback.descriptions);
    const supporting = chosen.filter((o) => o.weights[primary]).map((o) => o.echo);
    const echoes = shuffle(supporting.length >= 2 ? supporting : chosen.map((o) => o.echo)).slice(0, 2);
    if (echoes.length === 2) description += ` You ${echoes[0]}, and you ${echoes[1]}.`;

    return {
      archetypeId: arch.id,
      hero: arch.name,
      primaryVirtue: primary,
      secondaryVirtue: secondary,
      traits,
      description,
      prophecy: pick(arch.fallback.prophecies),
      quest: pick(arch.fallback.quests)
    };
  }

  HQ.fallback = { generate };
})();
