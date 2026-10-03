/* =====================================================================
   js/audio.js
   ---------------------------------------------------------------------
   ALL sound in this app is generated live with the Web Audio API.
   There are no audio files, so:
     - nothing can fail to load
     - there are no copyright or licensing questions
     - the music can react to what the visitor is doing

   Music: an original modal theme in D Dorian (an "ancient" sounding
   scale), built from a soft pad, a harp-like arpeggio, and a heartbeat
   drum. Its "mood" changes per screen.

   Voice: the browser's built-in Text-to-Speech (Web Speech API).

   SAFETY: every function is wrapped so that audio problems can never
   crash the app. If audio fails, the app simply runs silently.
   ===================================================================== */

window.HQ = window.HQ || {};

(function () {
  "use strict";

  const S = window.HQ_SETTINGS.audio;                 // audio settings from config/settings.js
  const enabled = { sfx: S.sfxOn, music: S.musicOn, voice: S.voiceOn };  // current toggle states

  // Web Audio objects (created on the first tap, because browsers block
  // audio until the user interacts with the page).
  let ctx = null;            // the AudioContext (the "sound engine")
  let master, musicBus, sfxBus, arpBus, padFilter, delay, reverb, noiseBuf;

  // Music scheduler state
  let musicRunning = false;  // has the music loop started?
  let timer = null;          // the setInterval handle for the scheduler
  let nextChordAt = 0, nextArpAt = 0, nextBeatAt = 0;
  let chordIndex = 0, arpStep = 0;
  let ducked = false;        // true while the Oracle is speaking (music gets quieter)

  // Convert a MIDI note number to a frequency in Hz (69 = A4 = 440 Hz).
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Four chords in D Dorian. First number = bass note, the rest = pad notes.
  // Dm9 -> C -> G (the bright Dorian chord) -> Am
  const CHORDS = [
    [38, 50, 53, 57, 64],
    [36, 48, 52, 55, 62],
    [43, 50, 55, 59, 62],
    [45, 48, 52, 57, 64]
  ];
  let currentChord = CHORDS[0];

  // How the music behaves on each screen.
  //   level    = loudness multiplier
  //   cutoff   = brightness (higher = brighter, more dramatic)
  //   arpProb  = chance each arpeggio note plays (0 = never, 1 = always)
  //   arpStep  = seconds between arpeggio notes (smaller = faster)
  //   chordLen = seconds each chord lasts
  //   heart    = play the heartbeat drum?
  const MOODS = {
    portal:   { level: 0.70, cutoff: 900,  arpProb: 0.25, arpStep: 0.40, chordLen: 7, heart: false },
    quest:    { level: 0.75, cutoff: 1300, arpProb: 0.80, arpStep: 0.30, chordLen: 6, heart: false },
    analysis: { level: 0.90, cutoff: 2400, arpProb: 0.95, arpStep: 0.15, chordLen: 3, heart: true  },
    reveal:   { level: 1.00, cutoff: 3400, arpProb: 0.15, arpStep: 0.30, chordLen: 6, heart: false },
    calm:     { level: 0.60, cutoff: 1000, arpProb: 0.30, arpStep: 0.40, chordLen: 7, heart: false }
  };
  let mood = MOODS.portal;

  /* ---------------- Setup ---------------- */

  // Call this on the first tap. Creates the sound engine safely.
  function unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;                                  // very old browser: no Web Audio
        ctx = new AC();
        build();
      }
      if (ctx.state === "suspended") ctx.resume();        // wake it up if the browser paused it
    } catch (e) {
      console.warn("Audio unavailable:", e);
      ctx = null;                                         // run silently
    }
  }

  // Wire up the mixing desk: buses, filter, echo, and reverb.
  function build() {
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();          // prevents sudden loud peaks
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ctx.destination);                        // destination = the speakers

    // Reverb: makes everything sound like it's in a stone hall.
    reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(3.2);
    const reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.35;
    reverb.connect(reverbOut);
    reverbOut.connect(master);

    // Music bus (volume knob for all music)
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;                              // starts silent, fades in later
    musicBus.connect(master);
    musicBus.connect(reverb);

    // Sound effects bus
    sfxBus = ctx.createGain();
    sfxBus.gain.value = enabled.sfx ? S.sfxVolume : 0;
    sfxBus.connect(master);
    sfxBus.connect(reverb);

    // The pad passes through a low-pass filter (lower cutoff = darker sound).
    padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = mood.cutoff;
    padFilter.Q.value = 0.7;
    padFilter.connect(musicBus);

    // Echo for the harp arpeggio
    delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.375;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;                           // how many times the echo repeats
    delay.connect(feedback);
    feedback.connect(delay);
    const delayOut = ctx.createGain();
    delayOut.gain.value = 0.5;
    delay.connect(delayOut);
    delayOut.connect(musicBus);

    arpBus = ctx.createGain();
    arpBus.connect(musicBus);
    arpBus.connect(delay);

    // Two seconds of random noise, reused for whooshes and booms.
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  // A fake "room echo" made of fading noise (used by the reverb).
  function makeImpulse(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }

  /* ---------------- Music ---------------- */

  // Play one sustained pad chord starting at time t for "dur" seconds.
  function playChord(notes, t, dur) {
    notes.forEach((m, i) => {
      const g = ctx.createGain();
      const peak = i === 0 ? 0.10 : 0.05;                 // bass slightly louder
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.35);   // slow swell in
      g.gain.setValueAtTime(peak, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.8);  // long fade out (overlaps next chord)
      g.connect(padFilter);
      // Bass = pure sine. Upper notes = two slightly detuned oscillators (lush, "choir-like").
      const voices = i === 0 ? [["sine", 0]] : [["sawtooth", 6], ["triangle", -6]];
      voices.forEach(([type, detune]) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = mtof(m);
        o.detune.value = detune;
        o.connect(g);
        o.start(t);
        o.stop(t + dur + 2);
      });
    });
  }

  // One harp-like plucked note.
  function pluck(freq, t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.085, t + 0.006);   // instant attack
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);    // ringing decay
    o.connect(g); g.connect(arpBus);
    o.start(t); o.stop(t + 1.2);
  }

  // One soft heartbeat drum hit.
  function thump(t, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.25);  // pitch drops = "thump"
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + 0.4);
  }

  // The scheduler runs every 100 ms and books notes slightly ahead of time.
  // (Booking ahead keeps the rhythm steady even if the page is busy.)
  function tick() {
    if (!ctx || !musicRunning) return;
    const ahead = ctx.currentTime + 0.25;
    while (nextChordAt < ahead) {                         // time for the next chord?
      currentChord = CHORDS[chordIndex % CHORDS.length];
      playChord(currentChord, nextChordAt, mood.chordLen);
      chordIndex++;
      nextChordAt += mood.chordLen;
    }
    const pattern = [1, 2, 3, 4, 3, 2];                   // up-and-down arpeggio shape
    while (nextArpAt < ahead) {
      if (Math.random() < mood.arpProb) {
        const note = currentChord[pattern[arpStep % pattern.length]] + 12;   // one octave up
        pluck(mtof(note), nextArpAt);
      }
      arpStep++;
      nextArpAt += mood.arpStep;
    }
    if (mood.heart) {
      while (nextBeatAt < ahead) {                        // "lub-dub" every 0.95 s
        thump(nextBeatAt, 0.32);
        thump(nextBeatAt + 0.22, 0.2);
        nextBeatAt += 0.95;
      }
    } else {
      nextBeatAt = ctx.currentTime + 0.1;
    }
  }

  // Start the background music loop (call after unlock()).
  function startMusic() {
    if (!ctx || musicRunning) return;
    musicRunning = true;
    nextChordAt = ctx.currentTime + 0.05;
    nextArpAt = ctx.currentTime + 1.5;
    nextBeatAt = ctx.currentTime + 0.1;
    timer = setInterval(() => { try { tick(); } catch (e) { /* never crash */ } }, 100);
    applyMusicLevel();
  }

  // Smoothly move the music volume to where it should be right now.
  function applyMusicLevel() {
    if (!ctx) return;
    const target = enabled.music && musicRunning ? S.musicVolume * mood.level * (ducked ? 0.4 : 1) : 0;
    musicBus.gain.setTargetAtTime(target, ctx.currentTime, 0.6);
  }

  // Change the music's mood ("portal", "quest", "analysis", "reveal", "calm").
  function setMood(name) {
    mood = MOODS[name] || MOODS.portal;
    if (!ctx) return;
    try {
      padFilter.frequency.cancelScheduledValues(ctx.currentTime);
      padFilter.frequency.setTargetAtTime(mood.cutoff, ctx.currentTime, 0.8);   // brighten or darken slowly
      applyMusicLevel();
    } catch (e) { /* ignore */ }
  }

  /* ---------------- Sound effects ---------------- */

  // A simple tone. f2 = optional pitch to slide to.
  function tone(f, t, dur, opt) {
    const o = opt || {};
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(sfxBus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  // A bell: a main tone plus higher "metallic" overtones.
  function bell(f, t, vol, dur) {
    vol = vol || 0.15; dur = dur || 2.2;
    tone(f, t, dur, { vol });
    tone(f * 2.76, t, dur * 0.5, { vol: vol * 0.35 });
    tone(f * 5.4, t, dur * 0.25, { vol: vol * 0.12 });
  }

  // Filtered noise: whooshes, swishes, booms, shutter clicks.
  function noise(t, dur, opt) {
    const o = opt || {};
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type || "bandpass";
    f.Q.value = o.q || 1.2;
    f.frequency.setValueAtTime(o.f1 || 800, t);
    f.frequency.exponentialRampToValueAtTime(o.f2 || o.f1 || 800, t + dur);   // sweep = "whoosh"
    const g = ctx.createGain();
    const attack = Math.min(o.attack || 0.05, dur * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t); src.stop(t + dur + 0.05);
  }

  // The library of named sound effects. "arg" is optional (e.g. trait number).
  const SFX = {
    click:   (t) => { tone(1500, t, 0.08, { vol: 0.07 }); tone(2250, t + 0.01, 0.06, { vol: 0.04 }); },
    select:  (t) => { bell(mtof(81), t, 0.12, 1.2); tone(mtof(69), t, 0.4, { type: "triangle", vol: 0.08 }); },
    whoosh:  (t) => noise(t, 0.55, { f1: 300, f2: 2600, vol: 0.12, attack: 0.2 }),
    portal:  (t) => {
      noise(t, 1.2, { f1: 200, f2: 3000, vol: 0.16, attack: 0.5 });
      [62, 69, 74, 77, 81, 86].forEach((m, i) => bell(mtof(m), t + 0.15 + i * 0.09, 0.09, 1.8));
    },
    hum:     (t) => {
      tone(110, t, 2.4, { vol: 0.12, attack: 0.6 });
      tone(164.8, t, 2.4, { vol: 0.07, attack: 0.8 });
      noise(t, 2, { type: "lowpass", f1: 400, f2: 1800, vol: 0.05, attack: 1 });
    },
    reveal:  (t) => {
      tone(95, t, 1.8, { vol: 0.5, f2: 32 });                              // deep boom
      noise(t, 1.6, { type: "lowpass", f1: 3000, f2: 200, vol: 0.18, attack: 0.01 });
      [62, 66, 69, 74].forEach((m) => tone(mtof(m), t + 0.2, 3.2, { type: "triangle", vol: 0.05, attack: 0.5 })); // D major: triumph!
      [74, 81, 79, 86].forEach((m, i) => bell(mtof(m), t + 0.5 + i * 0.38, 0.13, 2.8));   // bell fanfare
    },
    impact:  (t) => { tone(70, t, 0.9, { vol: 0.45, f2: 38 }); noise(t, 0.4, { type: "lowpass", f1: 1800, f2: 300, vol: 0.12, attack: 0.005 }); },
    virtue:  (t) => [74, 78, 81].forEach((m, i) => bell(mtof(m), t + i * 0.12, 0.1, 2)),
    chime:   (t, i) => bell(mtof([76, 79, 83, 86][(i || 0) % 4]), t, 0.11, 1.6),
    scroll:  (t) => noise(t, 0.7, { type: "highpass", f1: 2000, f2: 5000, vol: 0.05, attack: 0.3 }),
    secret:  (t) => [69, 74, 78, 81, 86].forEach((m, i) => bell(mtof(m), t + i * 0.18, 0.14, 2.4)),
    tick:    (t) => tone(880, t, 0.15, { vol: 0.1 }),
    shutter: (t) => {
      noise(t, 0.04, { type: "highpass", f1: 3000, vol: 0.3, attack: 0.002 });
      noise(t + 0.09, 0.05, { type: "highpass", f1: 2500, vol: 0.25, attack: 0.002 });
    }
  };

  // Play a sound effect by name. Silently does nothing if sound is off or broken.
  function sfx(name, arg) {
    if (!ctx || !enabled.sfx || !SFX[name]) return;
    try { SFX[name](ctx.currentTime + 0.01, arg); } catch (e) { /* never crash */ }
  }

  /* ---------------- Oracle voice (Text-to-Speech) ---------------- */
  const hasSpeech = "speechSynthesis" in window;
  let voice = null;

  // Choose the nicest available English voice.
  function pickVoice() {
    if (!hasSpeech) return;
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return;
    for (const pref of S.preferredVoices) {
      const v = voices.find((x) => x.name.toLowerCase().includes(pref.toLowerCase()) && /^en/i.test(x.lang));
      if (v) { voice = v; return; }
    }
    voice = voices.find((x) => /^en[-_](GB|US|AU|PH)/i.test(x.lang)) || voices.find((x) => /^en/i.test(x.lang)) || null;
  }
  if (hasSpeech) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;          // voices often load a moment later
  }

  // Lower or restore the music while the Oracle speaks.
  function duck(on) { ducked = on; applyMusicLevel(); }

  // Speak a line. Returns a Promise that ALWAYS finishes (even if speech fails),
  // so the app can safely "await" it.
  function speak(text) {
    return new Promise((resolve) => {
      if (!enabled.voice || !hasSpeech || !text) { resolve(); return; }
      let finished = false;
      const finish = () => { if (finished) return; finished = true; duck(false); resolve(); };
      try {
        const u = new SpeechSynthesisUtterance(text);
        if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = "en-US"; }
        u.rate = S.voiceRate;
        u.pitch = S.voicePitch;
        u.onend = finish;
        u.onerror = finish;
        duck(true);
        speechSynthesis.speak(u);
        setTimeout(finish, 2500 + text.length * 95);      // safety net: some browsers never fire "onend"
      } catch (e) { finish(); }
    });
  }

  // Stop any speech immediately (used when resetting for the next visitor).
  function stopVoice() {
    try { if (hasSpeech) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    duck(false);
  }

  /* ---------------- Toggles ---------------- */
  function toggle(kind) {
    enabled[kind] = !enabled[kind];
    if (ctx && kind === "sfx") sfxBus.gain.setTargetAtTime(enabled.sfx ? S.sfxVolume : 0, ctx.currentTime, 0.05);
    if (kind === "music") applyMusicLevel();
    if (kind === "voice" && !enabled.voice) stopVoice();
    return enabled[kind];
  }

  // Share these functions with the rest of the app.
  HQ.audio = {
    unlock, startMusic, setMood, sfx, speak, stopVoice, toggle,
    isOn: (kind) => enabled[kind],
    hasVoice: () => hasSpeech,
    voiceName: () => (voice ? voice.name : "(default)")
  };
})();
