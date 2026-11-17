"use strict";
/* Tiny WebAudio synth — no audio files. Every meaningful action gets a blip;
   pitch climbs with the combo streak (the Balatro ladder, but for snowballs). */
const Sfx = (() => {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    gain.gain.setValueAtTime(vol || 0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, low) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = low || 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t);
  }

  return {
    unlock: ensure,
    toggleMute() { muted = !muted; return muted; },
    isMuted: () => muted,
    throwBall(combo) { tone(620 + combo * 24, 0.07, "square", 0.028, 240); },
    hit() { noise(0.05, 0.05, 2400); },
    pop(combo) { tone(300 + combo * 45, 0.11, "triangle", 0.075, 880 + combo * 60); noise(0.06, 0.05, 1600); },
    hurt() { tone(190, 0.22, "sawtooth", 0.09, 60); noise(0.18, 0.1, 500); },
    pickup() { tone(660, 0.09, "sine", 0.07); setTimeout(() => tone(990, 0.13, "sine", 0.07), 55); },
    bomb() { noise(0.5, 0.22, 320); tone(120, 0.5, "sine", 0.16, 34); },
    bossRoar() { tone(82, 0.7, "sawtooth", 0.13, 46); noise(0.6, 0.1, 260); },
    waveClear() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, "triangle", 0.07), i * 85)); },
    gameOver() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, "triangle", 0.08), i * 170)); },
  };
})();
