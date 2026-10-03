/* =====================================================================
   js/visuals.js
   ---------------------------------------------------------------------
   1. Particles  - floating fireflies on a full-screen canvas
   2. Sigil      - the original Honor Sigil (book, flame, star in a ring)
   3. Oracle     - the hooded starlight Oracle figure
   All art is drawn with code, so there are no image files to load.
   ===================================================================== */

// Create the shared "HQ" namespace if it doesn't exist yet.
window.HQ = window.HQ || {};

(function () {
  "use strict";

  // Does the visitor's device ask for reduced motion? (accessibility setting)
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ===================================================================
     1. PARTICLES
     =================================================================== */
  const canvas = document.getElementById("particles");   // the <canvas> in index.html
  const ctx = canvas.getContext("2d");                    // 2D drawing tool for the canvas
  let W = 0, H = 0, DPR = 1;                              // canvas size and pixel density
  let particles = [];                                     // list of all particles
  let mode = "drift";                                     // "drift" or "converge"
  const sprites = {};                                     // pre-drawn glow images (faster than drawing glows each frame)

  // Pre-draw one soft glowing dot for a color, so each frame only copies it.
  function makeSprite(color) {
    const s = document.createElement("canvas");           // a small off-screen canvas
    s.width = s.height = 64;
    const g = s.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);  // glow from center outward
    grad.addColorStop(0, "rgba(255,255,240,1)");          // bright white-hot center
    grad.addColorStop(0.2, color);                        // colored middle
    grad.addColorStop(1, "rgba(0,0,0,0)");                // fades to transparent
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return s;
  }
  sprites.spirit = makeSprite("rgba(127,231,196,0.85)");  // teal
  sprites.gold = makeSprite("rgba(233,196,106,0.9)");     // gold
  sprites.ember = makeSprite("rgba(255,138,61,0.85)");    // orange

  // Match the canvas to the window size (sharp on high-DPI screens).
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);      // cap at 2 for performance
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);               // draw in normal CSS pixels
    // Choose how many particles based on screen area.
    const target = reduceMotion ? 25 : Math.round(Math.min(110, (W * H) / 15000));
    while (particles.length < target) particles.push(spawn({}, true));
    particles.length = target;                            // trim if the window got smaller
  }

  // Give a particle a fresh position and speed.
  // "anywhere" = place it randomly; otherwise start below the screen.
  function spawn(p, anywhere) {
    p.x = Math.random() * W;
    p.y = anywhere ? Math.random() * H : H + 20;
    p.vx = (Math.random() - 0.5) * 0.2;                   // slight sideways drift
    p.vy = -(0.15 + Math.random() * 0.45);                // floats upward
    p.size = 6 + Math.random() * 16;                      // glow size in pixels
    p.phase = Math.random() * Math.PI * 2;                // random twinkle timing
    const r = Math.random();
    p.sprite = r < 0.55 ? "spirit" : r < 0.9 ? "gold" : "ember";
    return p;
  }

  // The animation loop: runs ~60 times per second.
  function frame(t) {
    ctx.clearRect(0, 0, W, H);                            // erase the last frame
    ctx.globalCompositeOperation = "lighter";             // overlapping glows add up (magical look)
    const cx = W / 2, cy = H * 0.45;                      // center point for "converge"

    for (const p of particles) {
      if (mode === "converge") {
        // Spiral inward toward the center (used while the Oracle thinks).
        const dx = cx - p.x, dy = cy - p.y;
        const d = Math.hypot(dx, dy) || 1;                // distance to center
        p.vx += (dx / d) * 0.10 + (-dy / d) * 0.07;       // pull in + swirl sideways
        p.vy += (dy / d) * 0.10 + (dx / d) * 0.07;
        p.vx *= 0.96; p.vy *= 0.96;                       // friction so it doesn't explode
        p.x += p.vx; p.y += p.vy;
        if (d < 28) {                                     // reached the center: restart at the edge
          const a = Math.random() * Math.PI * 2, R = Math.max(W, H) * 0.6;
          p.x = cx + Math.cos(a) * R; p.y = cy + Math.sin(a) * R; p.vx = p.vy = 0;
        }
      } else {
        // Normal gentle floating.
        p.vx *= 0.985;                                    // slowly lose burst speed
        p.vy += (-0.3 - p.vy) * 0.01;                     // ease back to a slow upward float
        p.x += p.vx + Math.sin(t / 1600 + p.phase) * 0.25;   // sway left and right
        p.y += p.vy;
        if (p.y < -30 || p.x < -40 || p.x > W + 40 || p.y > H + 60) spawn(p, false);
      }
      // Twinkle by changing transparency over time.
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t / 700 + p.phase);
      ctx.drawImage(sprites[p.sprite], p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);                         // ask the browser for the next frame
  }

  // Explosion of particles from the center (portal opening, hero reveal).
  function burst() {
    if (reduceMotion) return;
    const cx = W / 2, cy = H * 0.42;
    for (const p of particles) {
      const a = Math.random() * Math.PI * 2;              // random direction
      const speed = 4 + Math.random() * 9;                // random speed
      p.x = cx + (Math.random() - 0.5) * 30;
      p.y = cy + (Math.random() - 0.5) * 30;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
    }
    mode = "drift";
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);

  /* ===================================================================
     2. THE HONOR SIGIL (original symbol)
     Three lights in a ring:
       Lumen       (open book)  = Wisdom, Scholarship   (bottom-left)
       Ember       (flame)      = Service, Character    (bottom-right)
       Crown Star  (8-pt star)  = Excellence, Leadership (top)
     =================================================================== */
  let sigilCount = 0;   // gives each sigil its own unique glow-filter id

  // Points for an n-pointed star, as an SVG "points" string.
  function starPoints(cx, cy, outer, inner, n) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;              // alternate tip and valley
      const a = -Math.PI / 2 + (i * Math.PI) / n;         // start pointing straight up
      pts.push((cx + r * Math.cos(a)).toFixed(2) + "," + (cy + r * Math.sin(a)).toFixed(2));
    }
    return pts.join(" ");
  }

  // Build the sigil SVG as a text string.
  // options.lit = array of lights to glow, e.g. ["ember"]
  // options.spin = slowly rotate the outer ring
  function sigil(options) {
    const o = options || {};
    const id = "sg" + (++sigilCount);                     // unique id for this copy
    const lit = o.lit || [];
    const glowAttr = (name) => (lit.includes(name) ? ` filter="url(#${id}-glow)"` : "");
    const litClass = (name) => (lit.includes(name) ? " lit" : "");

    // 36 small tick marks around the ring (every 10 degrees; longer every 30)
    let ticks = "";
    for (let i = 0; i < 36; i++) {
      const a = (i * 10 * Math.PI) / 180;
      const r1 = i % 3 === 0 ? 84 : 87, r2 = 91;
      ticks += `<line x1="${(100 + r1 * Math.cos(a)).toFixed(1)}" y1="${(100 + r1 * Math.sin(a)).toFixed(1)}" x2="${(100 + r2 * Math.cos(a)).toFixed(1)}" y2="${(100 + r2 * Math.sin(a)).toFixed(1)}"/>`;
    }

    return `
<svg class="sigil${o.spin ? " spin" : ""}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The Honor Sigil">
  <defs>
    <filter id="${id}-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="${id}-halo">
      <stop offset="0" stop-color="#FFF6D6" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#E9C46A" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="100" cy="100" r="78" fill="url(#${id}-halo)" opacity="${lit.length ? 0.35 : 0.12}"/>
  <g class="ring" fill="none" stroke="#E9C46A">
    <circle cx="100" cy="100" r="93" stroke-width="2.5" pathLength="1"/>
    <circle cx="100" cy="100" r="82" stroke-width="1" stroke-opacity="0.6" pathLength="1"/>
    <g class="ticks" stroke-width="1.4">${ticks}</g>
    <circle cx="100" cy="100" r="46" stroke-width="1.2" stroke-opacity="0.7" stroke-dasharray="2 4"/>
  </g>
  <g class="light light-star${litClass("star")}" data-light="star" transform="translate(100 54)"${glowAttr("star")}>
    <g class="light-inner">
      <circle r="22" fill="#0B241D" stroke="#E9C46A" stroke-width="1.5"/>
      <polygon points="${starPoints(0, 0, 16, 6.5, 8)}" fill="#E9C46A"/>
      <circle r="3" fill="#FFF1C4"/>
    </g>
  </g>
  <g class="light light-lumen${litClass("lumen")}" data-light="lumen" transform="translate(60.16 123)"${glowAttr("lumen")}>
    <g class="light-inner">
      <circle r="22" fill="#0B241D" stroke="#8FD3FF" stroke-width="1.5"/>
      <path d="M-13,-3 Q-6.5,-7 0,-3 Q6.5,-7 13,-3 L13,10 Q6.5,6 0,10 Q-6.5,6 -13,10 Z" fill="#8FD3FF"/>
      <path d="M0,-3 L0,10" stroke="#0B241D" stroke-width="1.3"/>
      <path d="M0,-8 L0,-16 M-6,-9 L-9,-14 M6,-9 L9,-14" stroke="#8FD3FF" stroke-width="1.6" stroke-linecap="round"/>
    </g>
  </g>
  <g class="light light-ember${litClass("ember")}" data-light="ember" transform="translate(139.84 123)"${glowAttr("ember")}>
    <g class="light-inner">
      <circle r="22" fill="#0B241D" stroke="#FF8A3D" stroke-width="1.5"/>
      <path d="M0,-15 C5,-8 9,-3 7,3 C5.5,8 -5.5,8 -7,3 C-9,-3 -4,-7 0,-15 Z" fill="#FF8A3D"/>
      <path d="M0,-6 C2.5,-2 3.5,1 2.5,3.5 C1.5,5.5 -1.5,5.5 -2.5,3.5 C-3.5,1 -2,-2 0,-6 Z" fill="#FFE2A8"/>
      <path d="M-12,6 Q-11,14 0,14 Q11,14 12,6" fill="none" stroke="#FF8A3D" stroke-width="1.8" stroke-linecap="round"/>
    </g>
  </g>
  <g class="core"><polygon points="100,91 106,100 100,109 94,100" fill="#FFF1C4"/></g>
</svg>`;
  }

  // Turn on the glow for chosen lights inside an existing sigil element.
  function lightUp(svgEl, lights) {
    if (!svgEl) return;
    const filterId = svgEl.querySelector("filter").id;    // this sigil's own glow filter
    svgEl.querySelectorAll(".light").forEach((g) => {
      const on = lights.includes(g.dataset.light);
      g.classList.toggle("lit", on);
      if (on) g.setAttribute("filter", `url(#${filterId})`);
      else g.removeAttribute("filter");
    });
  }

  /* ===================================================================
     3. THE ORACLE (original hooded figure made of starlight)
     =================================================================== */
  function oracle() {
    // A few random "stars" inside the hood
    let specks = "";
    for (let i = 0; i < 14; i++) {
      const x = 80 + Math.random() * 80, y = 85 + Math.random() * 100, r = 0.6 + Math.random() * 1.4;
      specks += `<circle class="speck" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#DFFFF4" style="animation-delay:${(Math.random() * 3).toFixed(2)}s"/>`;
    }
    return `
<svg viewBox="0 0 240 280" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The Oracle">
  <defs>
    <linearGradient id="orRobe" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1F4A3C"/><stop offset="1" stop-color="#06140F"/>
    </linearGradient>
    <radialGradient id="orAura" cx="0.5" cy="0.45" r="0.55">
      <stop offset="0" stop-color="#7FE7C4" stop-opacity="0.45"/><stop offset="1" stop-color="#7FE7C4" stop-opacity="0"/>
    </radialGradient>
    <filter id="orGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <ellipse cx="120" cy="130" rx="120" ry="135" fill="url(#orAura)"/>
  <!-- hooded robe -->
  <path d="M120,18 C68,18 40,70 38,130 C36,190 20,238 8,272 L232,272 C220,238 204,190 202,130 C200,70 172,18 120,18 Z"
        fill="url(#orRobe)" stroke="#E9C46A" stroke-width="2"/>
  <!-- gold trim down the front -->
  <path d="M120,200 L120,272 M96,206 L84,272 M144,206 L156,272" stroke="#B8892E" stroke-width="1.5" opacity="0.7"/>
  <!-- the dark void of the hood's face -->
  <ellipse cx="120" cy="128" rx="50" ry="64" fill="#020A08"/>
  ${specks}
  <!-- small sigil star on the brow -->
  <polygon points="${starPoints(120, 92, 8, 3.2, 8)}" fill="#E9C46A" filter="url(#orGlow)"/>
  <!-- glowing eyes (they blink via CSS) -->
  <ellipse class="eye" cx="102" cy="128" rx="7" ry="4.5" fill="#BFFFE9" filter="url(#orGlow)"/>
  <ellipse class="eye" cx="138" cy="128" rx="7" ry="4.5" fill="#BFFFE9" filter="url(#orGlow)"/>
</svg>`;
  }

  // Share these tools with the rest of the app.
  HQ.visuals = {
    burst,
    setMode: (m) => { mode = m; },
    sigil,
    lightUp,
    oracle,
    reduceMotion
  };
})();
