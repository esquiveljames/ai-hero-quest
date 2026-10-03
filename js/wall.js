/* =====================================================================
   js/wall.js
   ---------------------------------------------------------------------
   "Heroes discovered today" counter.
   Stored ONLY in this browser (localStorage) on the booth computer.
   It stores counts per hero type, nothing about the visitor.
   A new key is used each day, so the count restarts daily.
   ===================================================================== */

window.HQ = window.HQ || {};

(function () {
  "use strict";

  // Today's storage key, e.g. "hq-wall-2026-10-15" (uses the booth's local date).
  function todayKey() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `hq-wall-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // Read today's counts, e.g. { guardian: 4, sage: 2 }.
  // try/catch: storage can be blocked (private mode), so we never crash.
  function counts() {
    try { return JSON.parse(localStorage.getItem(todayKey())) || {}; }
    catch (e) { return {}; }
  }

  // Add one hero of a given type.
  function record(archetypeId) {
    try {
      const c = counts();
      c[archetypeId] = (c[archetypeId] || 0) + 1;
      localStorage.setItem(todayKey(), JSON.stringify(c));
    } catch (e) { /* storage unavailable: just skip counting */ }
  }

  // Total heroes discovered today.
  function total() {
    return Object.values(counts()).reduce((sum, n) => sum + n, 0);
  }

  // Erase today's counts (Demo Mode button).
  function reset() {
    try { localStorage.removeItem(todayKey()); } catch (e) { /* ignore */ }
  }

  HQ.wall = { counts, record, total, reset };
})();
