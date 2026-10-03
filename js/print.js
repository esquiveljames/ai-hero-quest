/* =====================================================================
   js/print.js
   ---------------------------------------------------------------------
   PRINT / SAVE AS PDF: the "Hero Charter"

   After the reveal, the visitor taps "🖨️ Print / Save PDF" and chooses:
     🖨️ Print to printer -> opens the browser's print dialog
     📄 Save as PDF      -> downloads a real .pdf file

   HOW IT WORKS
   The whole A4 page is built as ONE vector SVG drawing (the "sheet"):
   an original armored warrior illustration in the hero's colors, plus
   the AI-written reading, traits, quest, and the Honor Society details.

   - Print: the SVG is placed in #printArea and a print-only stylesheet
     hides everything else. Because the hero art is drawn shapes (not a
     CSS background image), it prints even when the browser's
     "Background graphics" option is switched off.
   - PDF: the same SVG is painted onto a high-resolution canvas
     (about 254 dpi) and placed on an A4 page with the jsPDF library.
     If jsPDF can't load (offline), we open the print dialog instead and
     tell the visitor to pick "Save as PDF" as the printer.

   Nothing is uploaded. The PDF is created inside the browser.
   ===================================================================== */

window.HQ = window.HQ || {};

(function () {
  "use strict";

  const SOCIETY = window.HQ_SOCIETY;
  const ARCHETYPES = window.HQ_ARCHETYPES;
  const $ = (id) => document.getElementById(id);

  // Font stacks. PAGE = the app's fantasy fonts; SAFE = always-available fonts.
  const FONTS_PAGE = {
    display: "'Uncial Antiqua', 'Palatino Linotype', Georgia, serif",
    body: "Spectral, Georgia, 'Times New Roman', serif"
  };
  const FONTS_SAFE = {
    display: "Georgia, 'Times New Roman', serif",
    body: "Georgia, 'Times New Roman', serif"
  };

  // Print colors (dark inks on warm paper, so it prints well)
  const C = { green: "#1F4A3C", brown: "#7A4E0E", gold: "#B8892E", goldLight: "#E9C46A", ink: "#2B1D0E", crimson: "#A50E26" };

  let current = null;     // the visitor's result { hero, source }
  let onClose = null;     // callback to the app when the window closes
  let busy = false;       // true while a PDF is being made

  /* ===================================================================
     SMALL HELPERS
     =================================================================== */

  // Make text safe to put inside SVG (no stray < or & characters).
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // A hidden canvas used only to MEASURE text width for line wrapping.
  const measureCtx = document.createElement("canvas").getContext("2d");
  function measure(text, size, family, style, weight) {
    measureCtx.font = `${style || "normal"} ${weight || "normal"} ${size}px ${family}`;
    return measureCtx.measureText(text).width;
  }

  // Split text into lines that fit within maxWidth.
  function wrap(text, maxWidth, size, family, style, weight) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (!line || measure(test, size, family, style, weight) <= maxWidth) line = test;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines;
  }

  // One line of SVG text.
  function txt(x, y, content, o) {
    return `<text x="${x}" y="${y}" font-family="${esc(o.family)}" font-size="${o.size}" fill="${o.fill || C.ink}"` +
      (o.anchor ? ` text-anchor="${o.anchor}"` : "") +
      (o.style ? ` font-style="${o.style}"` : "") +
      (o.weight ? ` font-weight="${o.weight}"` : "") +
      (o.ls ? ` letter-spacing="${o.ls}"` : "") +
      `>${esc(content)}</text>`;
  }

  // Points of an n-pointed star (for SVG <polygon>).
  function starPts(cx, cy, outer, inner, n) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + (i * Math.PI) / n;
      pts.push((cx + r * Math.cos(a)).toFixed(1) + "," + (cy + r * Math.sin(a)).toFixed(1));
    }
    return pts.join(" ");
  }

  // Small glyphs of the three Sigil lights (same shapes as the Honor Sigil).
  const GLYPH = {
    star: () => `<polygon points="${starPts(0, 0, 16, 6.5, 8)}" fill="#E9C46A"/>`,
    lumen: () => `<path d="M-13,-3 Q-6.5,-7 0,-3 Q6.5,-7 13,-3 L13,10 Q6.5,6 0,10 Q-6.5,6 -13,10 Z" fill="#8FD3FF"/>` +
      `<path d="M0,-3 L0,10" stroke="#0B241D" stroke-width="1.3"/>` +
      `<path d="M0,-8 L0,-16 M-6,-9 L-9,-14 M6,-9 L9,-14" stroke="#8FD3FF" stroke-width="1.6" stroke-linecap="round"/>`,
    ember: () => `<path d="M0,-15 C5,-8 9,-3 7,3 C5.5,8 -5.5,8 -7,3 C-9,-3 -4,-7 0,-15 Z" fill="#FF8A3D"/>` +
      `<path d="M0,-6 C2.5,-2 3.5,1 2.5,3.5 C1.5,5.5 -1.5,5.5 -2.5,3.5 C-3.5,1 -2,-2 0,-6 Z" fill="#FFE2A8"/>`
  };

  // Draw the hero's light(s) as an emblem centered at (cx, cy).
  function emblem(lights, cx, cy, scale) {
    if (lights.length === 1) return `<g transform="translate(${cx} ${cy}) scale(${scale})">${GLYPH[lights[0]]()}</g>`;
    return lights.map((l, i) =>
      `<g transform="translate(${cx + (i ? 1 : -1) * 11 * scale} ${cy}) scale(${scale * 0.62})">${GLYPH[l]()}</g>`).join("");
  }

  /* ===================================================================
     THE WARRIOR HERO ILLUSTRATION (original artwork, drawn in SVG)
     A helmeted knight in plate armor and a crimson cape, hands resting
     on a planted sword. Each hero type gets its own colors, chest
     emblem, and signature item:
       Guardian = shield, Vanguard = banner, Sage = crystal staff + tome,
       Paragon = glowing star-forged blade, Oathkeeper = great key,
       Hearthbuilder = hearth lantern.
     Drawn in a 400 x 520 box; "p" makes the ids unique.
     =================================================================== */
  function heroArt(arch, p, x, y, w, h) {
    const c = arch.color;                 // the hero's signature color
    const id = (n) => `${p}-${n}`;        // unique id helper
    const SL = "#2E3B42";                 // steel outline color
    const steel = `url(#${id("steel")})`, side = `url(#${id("side")})`;

    // Light rays behind the hero
    let rays = "";
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 * Math.PI) / 180, d = (4 * Math.PI) / 180;
      rays += `<polygon points="200,190 ${(200 + 420 * Math.cos(a - d)).toFixed(0)},${(190 + 420 * Math.sin(a - d)).toFixed(0)} ${(200 + 420 * Math.cos(a + d)).toFixed(0)},${(190 + 420 * Math.sin(a + d)).toFixed(0)}" fill="${c}" opacity="0.10"/>`;
    }

    // Signature items: "back" is drawn behind the hero, "front" in front.
    let back = "", front = "", bladeGlow = "";
    switch (arch.id) {
      case "vanguard":
        back = `<line x1="334" y1="58" x2="334" y2="500" stroke="#6B4A1B" stroke-width="7" stroke-linecap="round"/>` +
          `<circle cx="334" cy="54" r="7" fill="#E9C46A"/>` +
          `<path d="M337,66 L394,66 L394,196 L366,176 L337,196 Z" fill="${c}" stroke="#E9C46A" stroke-width="2"/>` +
          `<polygon points="${starPts(365, 118, 18, 7, 8)}" fill="#7A4E0E"/>`;
        break;
      case "sage":
        back = `<line x1="62" y1="70" x2="62" y2="500" stroke="#6B4A1B" stroke-width="7" stroke-linecap="round"/>` +
          `<circle cx="62" cy="52" r="30" fill="${c}" opacity="0.35"/>` +
          `<polygon points="62,24 76,52 62,80 48,52" fill="${c}" stroke="#E9C46A" stroke-width="2"/>`;
        front = `<g transform="translate(240 340) rotate(-8)"><rect width="40" height="50" rx="3" fill="#24476B" stroke="#E9C46A" stroke-width="2"/>` +
          `<rect x="34" y="4" width="4" height="42" fill="#F3E7C8"/>` + emblem(["lumen"], 18, 25, 0.8) + `</g>`;
        break;
      case "guardian":
        front = `<path d="M44,286 L132,286 L132,352 Q132,420 88,452 Q44,420 44,352 Z" fill="${steel}" stroke="#E9C46A" stroke-width="4"/>` +
          `<path d="M56,298 L120,298 L120,352 Q120,410 88,436 Q56,410 56,352 Z" fill="#7A2412"/>` + emblem(["ember"], 88, 356, 1.7);
        break;
      case "paragon":
        bladeGlow = ` filter="url(#${id("gl")})"`;
        front = [[160, 360], [240, 420], [180, 470], [226, 352]].map(([sx, sy]) =>
          `<polygon points="${starPts(sx, sy, 9, 2.5, 4)}" fill="#FFF6D6"/>`).join("");
        break;
      case "oathkeeper":
        front = `<g transform="translate(246 334)"><circle cx="8" cy="10" r="11" fill="none" stroke="#E9C46A" stroke-width="5"/>` +
          `<rect x="5" y="20" width="6" height="66" fill="#E9C46A"/><rect x="11" y="70" width="14" height="6" fill="#E9C46A"/>` +
          `<rect x="11" y="80" width="10" height="6" fill="#E9C46A"/></g>`;
        break;
      case "hearthbuilder":
        front = `<g transform="translate(118 340)"><circle cx="0" cy="42" r="36" fill="#FFB347" opacity="0.28"/>` +
          `<line x1="0" y1="0" x2="0" y2="14" stroke="#6B4A1B" stroke-width="3"/>` +
          `<path d="M-14,14 L14,14 L18,24 L-18,24 Z" fill="#E9C46A"/>` +
          `<rect x="-14" y="24" width="28" height="34" rx="4" fill="#FFD27A" stroke="#E9C46A" stroke-width="3"/>` +
          `<path d="M0,30 C4,36 6,40 4,46 C2,50 -2,50 -4,46 C-6,40 -3,36 0,30 Z" fill="#FF8A3D"/>` +
          `<path d="M-18,58 L18,58 L14,66 L-14,66 Z" fill="#E9C46A"/></g>`;
        break;
    }

    // One arm + shoulder armor (the right side is drawn as a mirror image).
    const arm = `<path d="M110,234 L144,236 L152,272 L186,288 L186,314 L142,308 Q120,298 114,266 Z" fill="${side}" stroke="${SL}" stroke-width="1.5"/>`;
    const pauldron = `<path d="M98,216 C92,184 116,164 152,168 C164,184 162,206 152,222 C134,230 112,228 98,216 Z" fill="${steel}" stroke="${SL}" stroke-width="2"/>` +
      `<path d="M104,212 C120,222 140,222 154,214" stroke="#E9C46A" stroke-width="3" fill="none"/>` +
      `<path d="M100,232 C116,244 138,244 152,236 L150,224 C134,232 116,232 102,222 Z" fill="${steel}" stroke="${SL}" stroke-width="1.5"/>`;

    // Little sparkles in the hero's color
    const sparkles = [[70, 120, 9], [330, 250, 7], [92, 236, 6], [316, 112, 10], [352, 330, 6], [56, 400, 7]]
      .map(([sx, sy, r]) => `<polygon points="${starPts(sx, sy, r, r * 0.28, 4)}" fill="${c}" opacity="0.85"/>`).join("");

    return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 400 520" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="${id("bg")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E4A3C"/><stop offset="1" stop-color="#06140F"/></linearGradient>
    <radialGradient id="${id("glow")}" cx="0.5" cy="0.38" r="0.5"><stop offset="0" stop-color="${c}" stop-opacity="0.55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id("steel")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F1F5F7"/><stop offset="0.45" stop-color="#AEBBC3"/><stop offset="1" stop-color="#5E6E78"/></linearGradient>
    <linearGradient id="${id("side")}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5E6E78"/><stop offset="0.45" stop-color="#DDE5E9"/><stop offset="1" stop-color="#7D8D96"/></linearGradient>
    <linearGradient id="${id("blade")}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C9D3D9"/><stop offset="0.5" stop-color="#FFFFFF"/><stop offset="1" stop-color="#9AA8B0"/></linearGradient>
    <linearGradient id="${id("cape")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A3152E"/><stop offset="1" stop-color="#4E0814"/></linearGradient>
    <filter id="${id("gl")}" x="-200%" y="-10%" width="500%" height="120%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="400" height="520" fill="url(#${id("bg")})"/>
  ${rays}
  <circle cx="200" cy="190" r="190" fill="url(#${id("glow")})"/>
  <ellipse cx="200" cy="502" rx="160" ry="16" fill="#000" opacity="0.35"/>
  ${back}
  <path d="M128,182 C100,260 80,380 62,500 L338,500 C320,380 300,260 272,182 Z" fill="url(#${id("cape")})"/>
  <path d="M150,230 C135,330 120,420 108,500 M250,230 C265,330 280,420 292,500" stroke="#3A0610" stroke-width="2" fill="none" opacity="0.6"/>
  <path d="M166,398 L162,486 L196,486 L195,398 Z" fill="${side}" stroke="${SL}" stroke-width="1.5"/>
  <path d="M234,398 L238,486 L204,486 L205,398 Z" fill="${side}" stroke="${SL}" stroke-width="1.5"/>
  <path d="M156,484 L198,484 L200,500 L148,500 Z" fill="#4A5860" stroke="${SL}"/>
  <path d="M244,484 L202,484 L200,500 L252,500 Z" fill="#4A5860" stroke="${SL}"/>
  <path d="M140,330 L260,330 L272,372 L128,372 Z" fill="${steel}" stroke="${SL}" stroke-width="1.5"/>
  <path d="M132,368 L268,368 L278,410 L122,410 Z" fill="${steel}" stroke="${SL}" stroke-width="1.5"/>
  <path d="M176,322 L224,322 L230,452 L200,466 L170,452 Z" fill="${c}" stroke="#E9C46A" stroke-width="2"/>
  <path d="M138,178 Q200,160 262,178 L268,250 Q266,300 252,326 L148,326 Q134,300 132,250 Z" fill="${steel}" stroke="${SL}" stroke-width="2"/>
  <path d="M200,170 L200,320" stroke="#FFFFFF" stroke-width="2" opacity="0.35"/>
  <path d="M146,288 Q200,304 254,288" stroke="${SL}" stroke-width="1.5" fill="none" opacity="0.5"/>
  <circle cx="200" cy="226" r="27" fill="#0B241D" stroke="#E9C46A" stroke-width="3"/>
  ${emblem(arch.lights, 200, 226, 1.15)}
  <rect x="142" y="318" width="116" height="16" rx="3" fill="#5A3A12" stroke="#E9C46A" stroke-width="1.5"/>
  <path d="M168,148 L232,148 L242,182 L158,182 Z" fill="${steel}" stroke="${SL}" stroke-width="1.5"/>
  <path d="M204,48 C196,22 220,6 246,12 C234,20 240,32 256,36 C238,44 220,46 204,48 Z" fill="${c}" stroke="#7A4E0E" stroke-width="1"/>
  <path d="M158,118 C158,72 176,46 200,44 C224,46 242,72 242,118 L242,150 Q200,166 158,150 Z" fill="${steel}" stroke="${SL}" stroke-width="2"/>
  <path d="M200,46 L200,100" stroke="#E9C46A" stroke-width="3"/>
  <path d="M160,98 Q200,86 240,98" stroke="#E9C46A" stroke-width="3" fill="none"/>
  <path d="M170,106 L230,106 L230,116 L207,116 L207,142 L193,142 L193,116 L170,116 Z" fill="#06100C"/>
  <rect x="174" y="109" width="52" height="4" rx="2" fill="${c}" opacity="0.95"/>
  <circle cx="166" cy="134" r="3" fill="#E9C46A"/><circle cx="234" cy="134" r="3" fill="#E9C46A"/>
  ${arm}${pauldron}
  <g transform="translate(400 0) scale(-1 1)">${arm}${pauldron}</g>
  <path d="M193,334 L207,334 L207,486 L200,504 L193,486 Z" fill="url(#${id("blade")})" stroke="${SL}" stroke-width="1"${bladeGlow}/>
  <path d="M200,340 L200,480" stroke="#8796A0" stroke-width="2"/>
  <path d="M146,318 L254,318 L262,326 L254,334 L146,334 L138,326 Z" fill="#E9C46A" stroke="#7A4E0E" stroke-width="2"/>
  <rect x="178" y="284" width="44" height="32" rx="9" fill="#4A5860" stroke="#E9C46A" stroke-width="2"/>
  <path d="M186,292 L214,292 M186,300 L214,300 M186,308 L214,308" stroke="${SL}" stroke-width="1.5"/>
  <circle cx="200" cy="276" r="10" fill="#E9C46A" stroke="#7A4E0E" stroke-width="2"/>
  <circle cx="200" cy="276" r="4" fill="${c}"/>
  ${front}
  ${sparkles}
</svg>`;
  }

  /* ===================================================================
     THE A4 "HERO CHARTER" SHEET
     Coordinates are in tenths of a millimeter: 2100 x 2970 = A4 portrait.
     =================================================================== */
  function buildSheet(result, prefix, fonts, extraCss, sizeAttrs) {
    const h = result.hero;
    const arch = ARCHETYPES.find((a) => a.id === h.archetypeId) || ARCHETYPES[0];
    const D = fonts.display, B = fonts.body;
    const id = (n) => `${prefix}-${n}`;
    const out = [];

    // ---- Paper and border ----
    out.push(`<rect width="2100" height="2970" fill="#FCF8EE"/>`);
    out.push(`<rect width="2100" height="2970" fill="url(#${id("paper")})"/>`);
    out.push(`<rect x="70" y="70" width="1960" height="2830" fill="none" stroke="${C.green}" stroke-width="10"/>`);
    out.push(`<rect x="95" y="95" width="1910" height="2780" fill="none" stroke="${C.gold}" stroke-width="4"/>`);
    [[95, 95], [2005, 95], [95, 2875], [2005, 2875]].forEach(([cx, cy]) =>
      out.push(`<polygon points="${cx},${cy - 26} ${cx + 26},${cy} ${cx},${cy + 26} ${cx - 26},${cy}" fill="${C.gold}"/><circle cx="${cx}" cy="${cy}" r="8" fill="#FCF8EE"/>`));

    // ---- Header ----
    out.push(txt(1050, 195, "ANGELES UNIVERSITY FOUNDATION  ·  COLLEGE OF COMPUTER STUDIES", { family: B, size: 30, fill: C.green, anchor: "middle", weight: 600, ls: 3 }));
    out.push(txt(1050, 255, SOCIETY.shortName, { family: B, size: 40, fill: C.brown, anchor: "middle", style: "italic" }));
    out.push(txt(1050, 375, "Hero Charter", { family: D, size: 120, fill: C.green, anchor: "middle" }));
    out.push(txt(1050, 435, `The AI Hero's Quest  ·  Realm of Honor  ·  ${SOCIETY.academicYear}`, { family: B, size: 34, fill: C.ink, anchor: "middle", style: "italic" }));
    out.push(`<line x1="560" y1="480" x2="990" y2="480" stroke="${C.gold}" stroke-width="3"/><line x1="1110" y1="480" x2="1540" y2="480" stroke="${C.gold}" stroke-width="3"/>`);
    out.push(`<polygon points="${starPts(1050, 480, 26, 9, 8)}" fill="${C.gold}"/>`);

    // ---- Hero illustration in a framed, round-topped window ----
    const fx = 640, fy = 520, fw = 820, fh = 1066, r = 200;
    const frame = `M${fx},${fy + fh} L${fx},${fy + r} A${r},${r} 0 0 1 ${fx + r},${fy} L${fx + fw - r},${fy} A${r},${r} 0 0 1 ${fx + fw},${fy + r} L${fx + fw},${fy + fh} Z`;
    out.push(`<g clip-path="url(#${id("frame")})">${heroArt(arch, id("art"), fx, fy, fw, fh)}</g>`);
    out.push(`<path d="${frame}" fill="none" stroke="${C.green}" stroke-width="18"/>`);
    out.push(`<path d="${frame}" fill="none" stroke="${C.goldLight}" stroke-width="5"/>`);

    // ---- Sigil seal on the frame's corner ----
    out.push(`<circle cx="1470" cy="1560" r="112" fill="#0F2A22" stroke="${C.gold}" stroke-width="6"/>`);
    out.push(HQ.visuals.sigil({ lit: arch.lights }).replace("<svg ", `<svg x="1370" y="1460" width="200" height="200" `));

    // ---- Name block ----
    out.push(txt(1050, 1660, "This charter recognizes the bearer as", { family: B, size: 40, fill: C.ink, anchor: "middle", style: "italic" }));
    let nameSize = 160;
    while (nameSize > 90 && measure(h.hero, nameSize, D) > 1700) nameSize -= 6;
    out.push(txt(1050, 1810, h.hero, { family: D, size: nameSize, fill: C.green, anchor: "middle" }));

    // Crimson ribbon with the primary virtue
    const virtue = String(h.primaryVirtue).toUpperCase();
    const rw = Math.max(700, measure(virtue, 62, D) + 280), rx0 = 1050 - rw / 2, rx1 = 1050 + rw / 2;
    out.push(`<polygon points="${rx0},1850 ${rx1},1850 ${rx1 - 44},1905 ${rx1},1960 ${rx0},1960 ${rx0 + 44},1905" fill="${C.crimson}"/>`);
    out.push(`<polygon points="${rx0 + 18},1862 ${rx1 - 18},1862 ${rx1 - 56},1905 ${rx1 - 18},1948 ${rx0 + 18},1948 ${rx0 + 56},1905" fill="none" stroke="${C.goldLight}" stroke-width="3"/>`);
    out.push(txt(1050, 1928, virtue, { family: D, size: 62, fill: "#FFF1C4", anchor: "middle" }));
    out.push(txt(1050, 2020, "with " + h.secondaryVirtue, { family: B, size: 38, fill: C.brown, anchor: "middle", style: "italic" }));

    // ---- Two columns (shrink the text size until everything fits) ----
    const top = 2085, bottom = 2600, colW = 820, LX = 200, RX = 1080;
    let cols = null;
    for (let fs = 36; fs >= 24; fs -= 2) {
      cols = columns(h, fs, top, colW, LX, RX, D, B);
      if (cols.bottom <= bottom) break;
    }
    out.push(cols.svg);

    // ---- Closing message and footer ----
    out.push(txt(1050, 2668, SOCIETY.closing[0], { family: D, size: 44, fill: C.green, anchor: "middle" }));
    wrap(SOCIETY.closing[1], 1500, 30, B, "italic").forEach((line, i) =>
      out.push(txt(1050, 2716 + i * 40, line, { family: B, size: 30, fill: C.ink, anchor: "middle", style: "italic" })));
    const when = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const by = result.source === "ai" ? "Revealed by the AI Oracle" : result.source === "fallback" ? "Revealed by the Oracle (offline mode)" : "Revealed by the Oracle";
    out.push(txt(200, 2838, "Quest completed " + when, { family: B, size: 28, fill: C.brown }));
    out.push(txt(1900, 2838, by, { family: B, size: 28, fill: C.brown, anchor: "end" }));

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2100 2970" ${sizeAttrs} role="img" aria-label="Hero Charter for ${esc(h.hero)}">
<defs>
  ${extraCss ? `<style>${extraCss}</style>` : ""}
  <radialGradient id="${id("paper")}" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="#EADFC3" stop-opacity="0"/><stop offset="1" stop-color="#EADFC3" stop-opacity="0.7"/></radialGradient>
  <clipPath id="${id("frame")}"><path d="${frame}"/></clipPath>
</defs>
${out.join("\n")}
</svg>`;
  }

  // The reading (left) and traits + quest (right) at font size fs.
  function columns(h, fs, top, colW, LX, RX, D, B) {
    const lh = Math.round(fs * 1.45);
    const s = [];
    const heading = (x, y, label) => {
      s.push(txt(x, y, label, { family: D, size: 46, fill: C.brown }));
      s.push(`<line x1="${x}" y1="${y + 20}" x2="${x + colW}" y2="${y + 20}" stroke="${C.gold}" stroke-width="2"/>`);
    };

    // LEFT: The Oracle's reading + prophecy
    heading(LX, top + 40, "The Oracle's Reading");
    let y = top + 60 + lh;
    wrap(h.description, colW, fs, B).forEach((line) => { s.push(txt(LX, y, line, { family: B, size: fs, fill: C.ink })); y += lh; });
    y += Math.round(fs * 0.6);
    const pLines = wrap("“" + h.prophecy + "”", colW - 34, fs, B, "italic");
    s.push(`<rect x="${LX}" y="${y - fs}" width="6" height="${pLines.length * lh}" fill="${C.gold}"/>`);
    pLines.forEach((line) => { s.push(txt(LX + 30, y, line, { family: B, size: fs, fill: C.brown, style: "italic" })); y += lh; });
    const leftBottom = y;

    // RIGHT: traits as outlined pills
    heading(RX, top + 40, "Hero Traits");
    const ps = Math.round(fs * 0.95), ph = Math.round(fs * 1.8), pad = 28, gap = 18;
    let px = RX, py = top + 80;
    h.traits.forEach((t) => {
      const pw = measure(t, ps, B, "", 600) + pad * 2;
      if (px + pw > RX + colW) { px = RX; py += ph + gap; }
      s.push(`<rect x="${px}" y="${py}" width="${pw.toFixed(0)}" height="${ph}" rx="${ph / 2}" fill="#EEF7F2" stroke="${C.green}" stroke-width="3"/>`);
      s.push(txt(px + pw / 2, py + ph / 2 + ps * 0.35, t, { family: B, size: ps, fill: C.green, anchor: "middle", weight: 600 }));
      px += pw + gap;
    });

    // RIGHT: the quest in a parchment box
    const qTop = py + ph + 90;
    heading(RX, qTop, "Your Quest");
    const qLines = wrap(h.quest, colW - 72, fs, B, "italic");
    const boxY = qTop + 44, boxH = qLines.length * lh + 56;
    s.push(`<rect x="${RX}" y="${boxY}" width="${colW}" height="${boxH}" rx="10" fill="#F3E7C8" stroke="${C.gold}" stroke-width="3"/>`);
    qLines.forEach((line, i) => s.push(txt(RX + 36, boxY + 28 + fs + i * lh, line, { family: B, size: fs, fill: C.ink, style: "italic" })));
    const rightBottom = boxY + boxH;

    return { svg: s.join("\n"), bottom: Math.max(leftBottom, rightBottom) };
  }

  /* ===================================================================
     FONTS
     =================================================================== */

  // Wait (max 2.5 s) for the page's fantasy fonts so text measures correctly.
  function ensureFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const loads = ["120px 'Uncial Antiqua'", "36px Spectral", "italic 36px Spectral", "600 36px Spectral"].map((f) => document.fonts.load(f).catch(() => {}));
    return Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 2500))]);
  }

  // For the PDF picture, fonts must be EMBEDDED inside the SVG (an SVG
  // painted as an image cannot download fonts). We fetch the Google Fonts
  // files once and embed them as base64. Returns "" if that fails.
  let fontCssPromise = null;
  function embeddedFontCss() {
    if (fontCssPromise) return fontCssPromise;
    fontCssPromise = (async () => {
      try {
        const link = document.querySelector('link[href*="fonts.googleapis.com/css"]');
        if (!link) return "";
        const css = await (await fetch(link.href)).text();
        const blocks = css.match(/@font-face\s*{[^}]*}/g) || [];
        const latin = blocks.filter((b) => /U\+0000-00FF/i.test(b));        // only the Latin character set
        const out = [];
        for (const block of latin) {
          const url = (block.match(/url\((https:[^)]+)\)/) || [])[1];
          if (!url) continue;
          const buf = await (await fetch(url)).arrayBuffer();
          const bytes = new Uint8Array(buf);
          let bin = "";
          for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
          out.push(block.replace(/src:[^;]+;/, `src: url(data:font/woff2;base64,${btoa(bin)}) format('woff2');`));
        }
        return out.join("\n");
      } catch (e) {
        return "";
      }
    })();
    // Never wait more than 6 seconds for fonts
    return Promise.race([fontCssPromise, new Promise((r) => setTimeout(() => r(""), 6000))]);
  }

  /* ===================================================================
     PRINT TO PRINTER
     =================================================================== */
  async function printNow() {
    if (!current || busy) return;
    HQ.audio.sfx("click");
    status("Opening the print dialog…");
    await ensureFonts();
    $("printArea").innerHTML = buildSheet(current, "pa", FONTS_PAGE, "", 'width="210mm" height="296mm"');
    document.body.classList.add("printing");
    // Give the browser two frames to lay out the sheet before printing
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try { window.print(); } catch (e) { status("Printing isn't available on this device."); }
    status("Choose your printer and paper size A4, then print.");
  }

  // Clean up after the print dialog closes.
  window.addEventListener("afterprint", () => {
    document.body.classList.remove("printing");
    $("printArea").innerHTML = "";
  });

  /* ===================================================================
     SAVE AS PDF
     =================================================================== */
  async function savePdf() {
    if (!current || busy) return;
    HQ.audio.sfx("click");

    // No PDF library (e.g. offline)? Use the print dialog's own "Save as PDF".
    if (!window.jspdf || !window.jspdf.jsPDF) {
      status("Opening the print dialog. Choose “Save as PDF” as the printer.");
      await printNow();
      status("In the dialog, choose “Save as PDF” as the printer, then Save.");
      return;
    }

    busy = true;
    setButtons(false);
    status("📜 Inscribing your Hero Charter…");
    try {
      await ensureFonts();
      const fontCss = await embeddedFontCss();
      const fonts = fontCss ? FONTS_PAGE : FONTS_SAFE;     // match measurement to the fonts the picture will use
      const svg = buildSheet(current, "px", fonts, fontCss, 'width="2100" height="2970"');

      // Paint the SVG onto a canvas (2100 x 2970 px = about 254 dpi on A4)
      const canvas = document.createElement("canvas");
      canvas.width = 2100;
      canvas.height = 2970;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url); resolve(); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not draw the charter")); };
        img.src = url;
      });

      // Place the picture on a full A4 page and download it
      const doc = new window.jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      doc.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, 210, 297, undefined, "FAST");
      doc.setProperties({ title: "Hero Charter: " + current.hero.hero, subject: "The AI Hero's Quest", creator: SOCIETY.shortName });
      const slug = current.hero.hero.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
      doc.save(`hero-charter-${slug}.pdf`);
      HQ.audio.sfx("virtue");
      status("✅ Saved! Look for “hero-charter-" + slug + ".pdf” in your Downloads.");
    } catch (e) {
      console.warn("PDF failed:", e);
      status("The PDF couldn't be made here. Opening the print dialog: choose “Save as PDF”.");
      busy = false;
      setButtons(true);
      await printNow();
      return;
    }
    busy = false;
    setButtons(true);
  }

  /* ===================================================================
     THE WINDOW (modal)
     =================================================================== */
  function status(text) { $("printStatus").textContent = text; }
  function setButtons(on) { ["printBtnPrinter", "printBtnPdf"].forEach((b) => ($(b).disabled = !on)); }

  async function open(result, closeCallback) {
    current = result;
    onClose = closeCallback || null;
    status("");
    setButtons(true);
    $("modalPrint").classList.add("open");
    $("printPreview").innerHTML = "";
    await ensureFonts();
    if (current !== result) return;                         // closed or reset meanwhile
    $("printPreview").innerHTML = buildSheet(result, "pv", FONTS_PAGE, "", 'width="100%"');
  }

  function close() {
    const wasOpen = $("modalPrint").classList.contains("open");
    $("modalPrint").classList.remove("open");
    $("printPreview").innerHTML = "";
    current = null;
    if (wasOpen && onClose) onClose();
  }

  $("printBtnPrinter").addEventListener("click", printNow);
  $("printBtnPdf").addEventListener("click", savePdf);
  $("printClose").addEventListener("click", close);

  HQ.print = { open, close, buildSheet, heroArt };
})();
