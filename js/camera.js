/* =====================================================================
   js/camera.js
   ---------------------------------------------------------------------
   "Capture your hero" selfie with an original fantasy frame.

   PRIVACY BY DESIGN:
     - Nothing is uploaded and nothing is saved to disk.
     - The finished picture is shown on screen for a few seconds so the
       visitor can photograph the SCREEN with their own phone.
     - Then the canvas is wiped and the camera is switched off.
   If the camera is missing or permission is denied, the app carries on.
   ===================================================================== */

window.HQ = window.HQ || {};

(function () {
  "use strict";

  const SET = window.HQ_SETTINGS.exhibit;
  const SOCIETY = window.HQ_SOCIETY;

  // Page elements
  const modal = document.getElementById("modalCamera");
  const video = document.getElementById("camVideo");
  const canvas = document.getElementById("camCanvas");
  const ctx = canvas.getContext("2d");
  const countdownEl = document.getElementById("camCountdown");
  const msg = document.getElementById("camMsg");
  const btnTake = document.getElementById("camTake");
  const btnRetry = document.getElementById("camRetry");

  let stream = null;      // the live camera stream
  let looping = false;    // are we drawing live frames?
  let hero = null;        // the visitor's hero (for the overlay text)
  let arch = null;        // the visitor's archetype (for colors and lights)
  let sigilImg = null;    // the sigil drawn as an image for the canvas
  let sparkles = [];      // fixed sparkle positions for the frame
  let timers = [];        // countdown timers, so we can cancel them
  let onClose = null;     // callback to the app when the window closes

  // Turn the sigil SVG text into an <img> we can draw on the canvas.
  function loadSigil(lights) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);                   // no sigil? no problem
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(HQ.visuals.sigil({ lit: lights }));
    });
  }

  // Draw one frame: mirrored camera image + fantasy overlay.
  function draw() {
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = "#020806";
    ctx.fillRect(0, 0, W, H);

    // Camera image, scaled to "cover" the canvas and mirrored like a real mirror
    if (video.videoWidth) {
      const scale = Math.max(W / video.videoWidth, H / video.videoHeight);
      const dw = video.videoWidth * scale, dh = video.videoHeight * scale;
      ctx.save();
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.restore();
    }

    // Dark magical vignette around the edges
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(3,14,10,0.88)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // Dark band at the bottom so the text is readable
    const band = ctx.createLinearGradient(0, H * 0.55, 0, H);
    band.addColorStop(0, "rgba(3,14,10,0)");
    band.addColorStop(1, "rgba(3,14,10,0.92)");
    ctx.fillStyle = band;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);

    // Floating sparkles
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    sparkles.forEach((s) => {
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, s.c);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    });
    ctx.restore();

    // Double gold frame
    ctx.strokeStyle = "#E9C46A";
    ctx.lineWidth = 5;
    ctx.strokeRect(20, 20, W - 40, H - 40);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(34, 34, W - 68, H - 68);

    // The glowing Honor Sigil in the top-right corner
    if (sigilImg) ctx.drawImage(sigilImg, W - 230, 46, 180, 180);

    // Text block (bottom-left)
    const x = 70;
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = (arch && arch.color) || "#E9C46A";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#7FE7C4";
    ctx.font = "italic 34px Spectral, Georgia, serif";
    ctx.fillText("⚔️ I am", x, H - 205);
    ctx.fillStyle = "#FFF1C4";
    ctx.font = "84px 'Uncial Antiqua', Georgia, serif";
    ctx.fillText(hero ? hero.hero : "", x, H - 120);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#E9C46A";
    ctx.font = "600 30px Spectral, Georgia, serif";
    const virtues = hero ? [hero.primaryVirtue, hero.secondaryVirtue, "Honor"].join("  •  ").toUpperCase() : "";
    ctx.fillText(virtues, x, H - 74);
    ctx.fillStyle = "#F3E7C8";
    ctx.font = "24px Spectral, Georgia, serif";
    ctx.fillText(SOCIETY.shortName + "  ·  " + SOCIETY.school, x, H - 42);
  }

  // Keep drawing live frames while the camera is on.
  function loop() {
    if (!looping) return;
    draw();
    requestAnimationFrame(loop);
  }

  // Clear any running countdowns.
  function clearTimers() { timers.forEach(clearTimeout); timers = []; countdownEl.textContent = ""; }

  // Switch the camera off and wipe the image (privacy).
  function stopStream() {
    looping = false;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Open the camera window for this hero.
  async function open(currentHero, closeCallback) {
    hero = currentHero;
    onClose = closeCallback || null;
    arch = window.HQ_ARCHETYPES.find((a) => a.id === hero.archetypeId) || null;
    sigilImg = await loadSigil(arch ? arch.lights : []);
    // Random sparkles (positions fixed for this session)
    sparkles = Array.from({ length: 26 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.6,
      r: 6 + Math.random() * 18,
      c: Math.random() < 0.5 ? "rgba(127,231,196,0.6)" : "rgba(233,196,106,0.6)"
    }));

    modal.classList.add("open");
    btnTake.hidden = false;
    btnRetry.hidden = true;
    msg.textContent = "Starting the camera…";

    // Camera API needs HTTPS (GitHub Pages is HTTPS) or localhost.
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      failed("This device can't open a camera here. Your hero still stands!");
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      video.srcObject = stream;
      await video.play();
      msg.textContent = "Strike a heroic pose!";
      looping = true;
      loop();
    } catch (e) {
      failed("The camera is unavailable or permission was denied. Your hero still stands!");
    }
  }

  // Camera failed: show the frame without a photo and hide "Take photo".
  function failed(text) {
    msg.textContent = text;
    btnTake.hidden = true;
    draw();                                                // still shows the hero frame
  }

  // 3-2-1 countdown, then freeze the frame.
  function take() {
    if (!looping) return;
    btnTake.hidden = true;
    clearTimers();
    [3, 2, 1].forEach((n, i) => {
      timers.push(setTimeout(() => { countdownEl.textContent = n; HQ.audio.sfx("tick"); }, i * 1000));
    });
    timers.push(setTimeout(() => {
      countdownEl.textContent = "";
      HQ.audio.sfx("shutter");
      looping = false;                                     // freeze on this frame
      draw();
      if (stream) stream.getTracks().forEach((t) => t.stop());   // camera light turns off
      stream = null;
      btnRetry.hidden = false;
      // Show the photo for a limited time, then erase it.
      let left = SET.photoDisplaySeconds;
      const tickMsg = () => {
        msg.textContent = `📱 Snap this screen with your own phone! Erasing in ${left}s. Nothing is saved.`;
        if (left-- <= 0) { close(); return; }
        timers.push(setTimeout(tickMsg, 1000));
      };
      tickMsg();
    }, 3000));
  }

  // Try again: restart the live camera.
  function retry() {
    clearTimers();
    stopStream();
    open(hero, onClose);
  }

  // Close the window and wipe everything.
  function close() {
    clearTimers();
    stopStream();
    msg.textContent = "";
    const wasOpen = modal.classList.contains("open");
    modal.classList.remove("open");
    if (wasOpen && onClose) onClose();
  }

  btnTake.addEventListener("click", take);
  btnRetry.addEventListener("click", retry);
  document.getElementById("camDone").addEventListener("click", close);

  HQ.camera = { open, close };
})();
