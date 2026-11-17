"use strict";
/* FLURRY FRENZY — Lofi's Snowball Siege.
   Main engine: game loop, input, combat, juice (hit-stop, trauma shake,
   hit flash, knockback, squash & stretch), HUD, screens, and a scripted
   demo/attract mode (?demo=1&wave=N&seed=S) used for screenshots & video. */

const W = 960, H = 540;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const params = new URLSearchParams(location.search);
const DEMO = params.get("demo") === "1";
const STAGE = params.get("stage") === "1"; // director's frame: pre-populated arena for screenshots/video
const START_WAVE = Math.max(1, parseInt(params.get("wave") || "1", 10) || 1);
const SEED = parseInt(params.get("seed") || "20261117", 10) || 20261117;

const rng = makeRng(SEED);
const camRng = makeRng(777); // camera-only noise, kept off the gameplay stream
const fx = new Particles(rng);

/* ---------------- background (pre-rendered once) ---------------- */
const bg = document.createElement("canvas");
bg.width = W; bg.height = H;
(function paintBackground() {
  const c = bg.getContext("2d");
  const grad = c.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0a1a3d");
  grad.addColorStop(0.55, "#0d2450");
  grad.addColorStop(1, "#123058");
  c.fillStyle = grad; c.fillRect(0, 0, W, H);
  // aurora bands
  for (let i = 0; i < 3; i++) {
    const y = 26 + i * 26;
    const ag = c.createLinearGradient(0, y, 0, y + 34);
    ag.addColorStop(0, "rgba(95,242,200,0)");
    ag.addColorStop(0.5, "rgba(95,242,200," + (0.10 - i * 0.025) + ")");
    ag.addColorStop(1, "rgba(95,242,200,0)");
    c.fillStyle = ag;
    c.beginPath();
    c.moveTo(0, y + 14);
    for (let x = 0; x <= W; x += 32) c.lineTo(x, y + Math.sin(x * 0.012 + i * 1.7) * 13);
    for (let x = W; x >= 0; x -= 32) c.lineTo(x, y + 30 + Math.sin(x * 0.012 + i * 1.7) * 13);
    c.closePath(); c.fill();
  }
  // ice floor
  const floor = c.createRadialGradient(W / 2, H / 2 + 40, 80, W / 2, H / 2 + 40, 620);
  floor.addColorStop(0, "rgba(190,225,255,0.20)");
  floor.addColorStop(0.7, "rgba(140,190,240,0.10)");
  floor.addColorStop(1, "rgba(140,190,240,0.02)");
  c.fillStyle = floor;
  c.beginPath(); c.ellipse(W / 2, H / 2 + 36, 560, 250, 0, 0, 6.29); c.fill();
  // floor cracks
  c.strokeStyle = "rgba(190,225,255,0.07)"; c.lineWidth = 1.2;
  const cr = makeRng(42);
  for (let i = 0; i < 14; i++) {
    let x = cr.range(60, W - 60), y = cr.range(120, H - 50);
    c.beginPath(); c.moveTo(x, y);
    for (let s = 0; s < 4; s++) { x += cr.range(-38, 38); y += cr.range(-16, 22); c.lineTo(x, y); }
    c.stroke();
  }
  // snow drifts around the rim (pines live on their own parallax layer now)
  c.fillStyle = "rgba(230,244,255,0.85)";
  for (let i = 0; i < 9; i++) {
    const x = (i / 8) * W + cr.range(-16, 16);
    c.beginPath(); c.ellipse(x, H - 6, cr.range(50, 95), cr.range(12, 22), 0, Math.PI, 6.29); c.fill();
  }
  // scattered ice crystals
  c.fillStyle = "rgba(160,215,255,0.5)";
  for (let i = 0; i < 26; i++) {
    const x = cr.range(20, W - 20), y = cr.range(90, H - 24), s = cr.range(2, 5);
    c.beginPath();
    c.moveTo(x, y - s); c.lineTo(x + s * 0.6, y); c.lineTo(x, y + s); c.lineTo(x - s * 0.6, y);
    c.closePath(); c.fill();
  }
})();

/* Far ice-peak silhouette band (parallax layer 1) — Hades' stage-set rule:
   silhouettes layered against a dark sky read as depth for free. */
const peaksCv = document.createElement("canvas");
peaksCv.width = W + 80; peaksCv.height = H;
(function paintPeaks() {
  const c = peaksCv.getContext("2d");
  const cr = makeRng(1234);
  c.fillStyle = "rgba(13,34,72,0.92)";
  c.beginPath();
  c.moveTo(0, 168);
  let x = 0;
  while (x < W + 80) {
    const peakW = cr.range(70, 150), peakH = cr.range(52, 118);
    c.lineTo(x + peakW / 2, 168 - peakH);
    c.lineTo(x + peakW, 168);
    x += peakW;
  }
  c.lineTo(W + 80, 200); c.lineTo(0, 200); c.closePath(); c.fill();
  // snow caps
  c.fillStyle = "rgba(190,225,255,0.5)";
  x = 0;
  const cr2 = makeRng(1234);
  while (x < W + 80) {
    const peakW = cr2.range(70, 150), peakH = cr2.range(52, 118);
    const apexX = x + peakW / 2, apexY = 168 - peakH;
    c.beginPath();
    c.moveTo(apexX - 13, apexY + 15); c.lineTo(apexX, apexY); c.lineTo(apexX + 13, apexY + 15);
    c.lineTo(apexX + 5, apexY + 10); c.lineTo(apexX, apexY + 15); c.lineTo(apexX - 5, apexY + 10);
    c.closePath(); c.fill();
    x += peakW;
  }
  // fade the band's bottom edge so it melts into the sky, no hard horizon
  c.globalCompositeOperation = "destination-out";
  const fade = c.createLinearGradient(0, 148, 0, 200);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,1)");
  c.fillStyle = fade;
  c.fillRect(0, 148, W + 80, 52);
  c.globalCompositeOperation = "source-over";
})();

/* Mid pine-forest silhouette band (parallax layer 2). */
const pinesCv = document.createElement("canvas");
pinesCv.width = W + 40; pinesCv.height = H;
(function paintPines() {
  const c = pinesCv.getContext("2d");
  function pine(x, y, s) {
    c.fillStyle = "#0a2c33";
    c.fillRect(x - 2.4 * s, y, 4.8 * s, 10 * s);
    c.fillStyle = "#0e4040";
    for (let t = 0; t < 3; t++) {
      const wdt = (26 - t * 6) * s, yy = y - t * 9 * s;
      c.beginPath();
      c.moveTo(x - wdt / 2, yy); c.lineTo(x + wdt / 2, yy); c.lineTo(x, yy - 13 * s);
      c.closePath(); c.fill();
    }
    c.fillStyle = "rgba(255,255,255,0.75)";
    c.beginPath(); c.moveTo(x - 4 * s, y - 24 * s); c.lineTo(x + 4 * s, y - 24 * s); c.lineTo(x, y - 30 * s);
    c.closePath(); c.fill();
  }
  pine(38, 118, 1.15); pine(88, 92, 0.8); pine(W - 42, 112, 1.05); pine(W - 92, 88, 0.75);
  pine(24, H - 60, 0.9); pine(W - 26, H - 66, 0.95);
  pine(150, 104, 0.65); pine(W - 160, 98, 0.7); pine(210, H - 48, 0.6); pine(W - 215, H - 52, 0.62);
})();

/* Pre-rendered frost overlay for the combo vignette (drawn with rising
   alpha as the chain climbs — the blizzard leans in when you're hot). */
const frostCv = document.createElement("canvas");
frostCv.width = W; frostCv.height = H;
(function paintFrost() {
  const c = frostCv.getContext("2d");
  const cr = makeRng(99);
  const vg = c.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.86);
  vg.addColorStop(0, "rgba(190,228,255,0)");
  vg.addColorStop(0.75, "rgba(190,228,255,0.13)");
  vg.addColorStop(1, "rgba(215,240,255,0.5)");
  c.fillStyle = vg; c.fillRect(0, 0, W, H);
  c.fillStyle = "rgba(225,245,255,0.75)";
  // crystal fingers growing from the edges
  for (let i = 0; i < 130; i++) {
    const edge = cr.int(0, 3);
    let x, y, a;
    if (edge === 0) { x = cr.range(0, W); y = 0; a = Math.PI / 2; }
    else if (edge === 1) { x = cr.range(0, W); y = H; a = -Math.PI / 2; }
    else if (edge === 2) { x = 0; y = cr.range(0, H); a = 0; }
    else { x = W; y = cr.range(0, H); a = Math.PI; }
    const len = cr.range(9, 42) * (0.5 + Math.abs(Math.sin((edge < 2 ? x : y) * 0.01)));
    const wdt = cr.range(1.6, 3.6);
    c.save();
    c.translate(x, y); c.rotate(a + cr.range(-0.35, 0.35));
    c.beginPath();
    c.moveTo(-wdt, 0); c.lineTo(0, len); c.lineTo(wdt, 0);
    c.closePath(); c.fill();
    c.restore();
  }
})();

/* Animated aurora curtains — a curtain hung from a wandering line,
   brightest at its lower edge, combed into vertical rays, green at the
   edge running to violet at the top (Weather FX aurora recipe, canvas
   edition). Brightness breathes with the combo: the sky reacts. */
function drawAurora(time) {
  const boost = 0.72 + Math.min(0.5, G.combo * 0.016) + Math.sin(time * 0.4) * 0.05;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const curtains = [
    { base: 96, h: 88, ph: 0.0, a: 0.16, drift: 0.30 },
    { base: 62, h: 60, ph: 2.4, a: 0.11, drift: 0.19 },
  ];
  for (const cu of curtains) {
    const grad = ctx.createLinearGradient(0, cu.base - cu.h, 0, cu.base);
    grad.addColorStop(0, "rgba(150,110,255,0)");
    grad.addColorStop(0.55, "rgba(95,242,200," + (0.35 * cu.a * boost * 2).toFixed(3) + ")");
    grad.addColorStop(1, "rgba(140,255,215," + (cu.a * boost).toFixed(3) + ")");
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) {
      const edge = cu.base + Math.sin(x * 0.008 + time * cu.drift + cu.ph) * 11 + Math.sin(x * 0.023 - time * cu.drift * 0.6 + cu.ph) * 5;
      if (x === 0) ctx.moveTo(x, edge); else ctx.lineTo(x, edge);
    }
    for (let x = W; x >= 0; x -= 16) {
      const edge = cu.base + Math.sin(x * 0.008 + time * cu.drift + cu.ph) * 11 + Math.sin(x * 0.023 - time * cu.drift * 0.6 + cu.ph) * 5;
      ctx.lineTo(x, edge - cu.h);
    }
    ctx.closePath(); ctx.fill();
    // rays: x-only shimmer, constant up the curtain
    for (let x = 6; x < W; x += 21) {
      const shimmer = 0.5 + 0.5 * Math.sin(x * 0.11 + time * 1.4 + cu.ph * 3);
      if (shimmer < 0.45) continue;
      const edge = cu.base + Math.sin(x * 0.008 + time * cu.drift + cu.ph) * 11;
      ctx.fillStyle = "rgba(160,255,220," + (0.05 * shimmer * boost).toFixed(3) + ")";
      ctx.fillRect(x, edge - cu.h * (0.5 + shimmer * 0.5), 5, cu.h * (0.5 + shimmer * 0.5));
    }
  }
  ctx.restore();
}

/* Ground sparkles: pre-placed ice glints that twinkle on a phase clock. */
const sparkles = [];
(function makeSparkles() {
  const sr = makeRng(4242);
  for (let i = 0; i < 60; i++) {
    sparkles.push({ x: sr.range(24, W - 24), y: sr.range(96, H - 18), ph: sr.range(0, 6.28), s: sr.range(1.6, 3.4) });
  }
})();
function drawSparkles(time) {
  ctx.save();
  ctx.fillStyle = "#dff3ff";
  for (const sp of sparkles) {
    const tw = Math.sin(time * 1.7 + sp.ph);
    if (tw < 0.55) continue;
    const a = (tw - 0.55) * 1.6;
    ctx.globalAlpha = a * 0.8;
    const s = sp.s * (0.7 + tw * 0.5);
    ctx.beginPath();
    ctx.moveTo(sp.x, sp.y - s * 1.8); ctx.lineTo(sp.x + s * 0.45, sp.y - s * 0.45);
    ctx.lineTo(sp.x + s * 1.8, sp.y); ctx.lineTo(sp.x + s * 0.45, sp.y + s * 0.45);
    ctx.lineTo(sp.x, sp.y + s * 1.8); ctx.lineTo(sp.x - s * 0.45, sp.y + s * 0.45);
    ctx.lineTo(sp.x - s * 1.8, sp.y); ctx.lineTo(sp.x - s * 0.45, sp.y - s * 0.45);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/* ---------------- state ---------------- */
const G = {
  mode: "title", // title | playing | gameover
  time: 0,
  score: 0, displayScore: 0, high: 0,
  kills: 0, maxCombo: 0,
  combo: 0, comboTimer: 0,
  wave: 0, waveName: "", remaining: 0, waveTotal: 0,
  lastKill: null, printAcc: 0, printSide: 1, titleFxAcc: 0,
  spawnQueue: [], spawnTimer: 0, bossPending: 0, intermission: 0,
  enemies: [], balls: [], shards: [], pickups: [],
  boss: null, boomQueue: [],
  trauma: 0, freeze: 0, hurtFlash: 0,
  banner: null, shakeX: 0, shakeY: 0,
  rapidTimer: 0, over: null, demoRestart: 0,
};
try { G.high = parseInt(localStorage.getItem("flurryHigh") || "0", 10) || 0; } catch (e) { G.high = 0; }

const player = {
  x: W / 2, y: H / 2 + 60, vx: 0, vy: 0, r: 20,
  hp: 5, maxHp: 5, speed: 238,
  fireCd: 0, invuln: 0, throwAnim: 0, animT: 0, moving: 0,
  aim: -Math.PI / 2,
};

const keys = {};
const mouse = { x: W / 2, y: H / 2 - 100, down: false };

addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === " ") { e.preventDefault(); tryStart(); }
  if (e.key.toLowerCase() === "p" && G.mode === "playing") togglePause();
  if (e.key.toLowerCase() === "m") Sfx.toggleMute();
  Sfx.unlock();
});
addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (W / r.width);
  mouse.y = (e.clientY - r.top) * (H / r.height);
});
canvas.addEventListener("mousedown", () => { mouse.down = true; Sfx.unlock(); tryStart(); });
addEventListener("mouseup", () => { mouse.down = false; });
canvas.addEventListener("touchstart", (e) => { e.preventDefault(); Sfx.unlock(); tryStart(); }, { passive: false });

let paused = false;
function togglePause() { paused = !paused; }

function tryStart() {
  if (G.mode === "title") startGame();
  else if (G.mode === "gameover" && G.time - (G.over ? G.over.at : 0) > 0.8) startGame();
}

function startGame() {
  G.mode = "playing";
  G.score = 0; G.displayScore = 0; G.kills = 0; G.maxCombo = 0;
  G.combo = 0; G.comboTimer = 0;
  G.enemies = []; G.balls = []; G.shards = []; G.pickups = []; G.boomQueue = [];
  G.boss = null; G.trauma = 0; G.freeze = 0; G.hurtFlash = 0; G.rapidTimer = 0;
  player.x = W / 2; player.y = H / 2 + 60; player.hp = player.maxHp;
  player.invuln = 0; player.vx = 0; player.vy = 0;
  fx.list = []; fx.texts = []; fx.decals = []; fx.arcs = [];
  G.lastKill = null;
  beginWave(START_WAVE);
  if (STAGE) {
    // Pre-populate so the very first frames already show a battle in progress:
    // most of the wave on the field, a live combo, rapid fire, battle decals.
    const pre = Math.floor(G.spawnQueue.length * 1.0);
    for (let i = 0; i < pre; i++) spawnEnemy(G.spawnQueue.pop());
    if (G.bossPending) G.bossTimer = 0.4;
    G.combo = 14; G.comboTimer = 2.5; G.maxCombo = 14;
    G.score = START_WAVE * 1800 + 450; G.displayScore = G.score;
    G.rapidTimer = 7;
    for (let i = 0; i < 14; i++) {
      fx.decal(rng.range(70, W - 70), rng.range(90, H - 50), rng.range(10, 26), rng.chance(0.4) ? "ring" : "splat");
    }
    G.pickups.push(makePickup("chili", player.x - 120, player.y + 70));
    G.pickups.push(makePickup("star", player.x + 300, player.y - 150));
  }
}

function showBanner(title, sub, dur, color) {
  G.banner = { title, sub: sub || "", t: 0, dur: dur || 2.2, color: color || "#ffffff" };
  // banner flourishes: sparkle bursts at both banner shoulders
  fx.burst(W / 2 - 250, 118, { n: 14, color: "#6FBCF0", speed: 130, life: 0.6, size: 2.6, glow: true });
  fx.burst(W / 2 + 250, 118, { n: 14, color: "#ffd166", speed: 130, life: 0.6, size: 2.6, glow: true });
}

function beginWave(n) {
  G.wave = n;
  const built = buildSpawnQueue(n, rng);
  G.spawnQueue = built.queue;
  G.waveName = built.name;
  G.bossPending = built.bossLevel;
  G.remaining = built.total;
  G.waveTotal = built.total;
  G.spawnTimer = 0.9;
  G.intermission = 0;
  showBanner("WAVE " + n, built.name, 2.3, "#9fd8ff");
  if (built.bossLevel) {
    setTimeout(() => {}, 0); // boss spawns via spawn logic after 1.4s
    G.bossTimer = 1.4;
  }
}

function spawnPoint() {
  // random rim point, kept away from the player
  for (let tries = 0; tries < 12; tries++) {
    const side = rng.int(0, 3);
    let x, y;
    if (side === 0) { x = rng.range(30, W - 30); y = 64; }
    else if (side === 1) { x = rng.range(30, W - 30); y = H - 26; }
    else if (side === 2) { x = 26; y = rng.range(70, H - 30); }
    else { x = W - 26; y = rng.range(70, H - 30); }
    const d = Math.hypot(x - player.x, y - player.y);
    if (d > 200 || tries === 11) return { x, y };
  }
  return { x: 40, y: 80 };
}

function spawnEnemy(type, atPos) {
  const p = atPos || spawnPoint();
  const e = makeEnemy(type, p.x, p.y, waveHpScale(G.wave));
  G.enemies.push(e);
  fx.burst(p.x, p.y, { n: 10, color: "#9fd8ff", speed: 120, life: 0.4, size: 2.6, glow: true });
}

function spawnBoss(level) {
  const b = makeBoss(W / 2, 96, level);
  if (STAGE) { b.x = W * 0.6; b.y = H * 0.36; b.speed = 10; } // staged: mid-arena, slow drift, for the camera
  G.boss = b;
  G.enemies.push(b);
  G.trauma = Math.min(1, G.trauma + 0.55);
  G.freeze = Math.max(G.freeze, 0.09);
  Sfx.bossRoar();
  showBanner("⚠ " + b.name + " ⚠", level === 1 ? "The mountain itself has come for the Flurry" : "It thawed. It remembers. It is angry.", 2.8, "#ffd166");
  fx.explosion(b.x, b.y, true);
}

function addTrauma(n) { G.trauma = Math.min(1, G.trauma + n); }

function comboMult() { return Math.min(9, 1 + Math.floor(G.combo / 5)); }

function killEnemy(e, awardScore) {
  e.dead = true;
  G.kills++;
  G.remaining = Math.max(0, G.remaining - 1);
  if (e.type === "boss") {
    G.boss = null;
    fx.explosion(e.x, e.y, true);
    fx.explosion(e.x - 24, e.y + 10, false);
    fx.explosion(e.x + 26, e.y - 8, false);
    addTrauma(0.85); G.freeze = Math.max(G.freeze, 0.16);
    Sfx.bomb();
    showBanner("GENERAL BLIZZARD POPPED!", "+2500 — the Flurry holds!", 2.4, "#ffd166");
  } else {
    fx.snowPop(e.x, e.y, e.color);
    if (e.type === "brute") { addTrauma(0.4); G.freeze = Math.max(G.freeze, 0.07); }
    else if (e.type === "splitter") addTrauma(0.16);
    else addTrauma(0.07);
  }
  Sfx.pop(G.combo);
  if (awardScore !== false) {
    G.combo++;
    G.comboTimer = 2.5;
    G.maxCombo = Math.max(G.maxCombo, G.combo);
    const mult = comboMult();
    const pts = e.score * mult;
    G.score += pts;
    fx.floatText(e.x, e.y - e.r - 6, "+" + pts, {
      color: mult >= 5 ? "#ffd166" : mult >= 3 ? "#5ff2c8" : "#ffffff",
      size: (e.type === "boss" ? 30 : e.type === "brute" ? 20 : 15) * (1 + Math.min(0.5, G.combo * 0.012)),
    });
    // chained kills crackle: a frost arc jumps between quick successive pops
    if (G.lastKill && G.time - G.lastKill.t < 0.28 && G.combo >= 4) {
      fx.arc(G.lastKill.x, G.lastKill.y, e.x, e.y);
    }
    G.lastKill = { x: e.x, y: e.y, t: G.time };
    if (G.combo > 0 && G.combo % 10 === 0) {
      fx.floatText(player.x, player.y - 52, "×" + mult + " COMBO — " + G.combo + " CHAIN!", { color: "#ffd166", size: 19 });
    }
  }
  if (e.type === "splitter") {
    for (let i = 0; i < 2; i++) {
      const m = makeEnemy("mini", e.x + rng.range(-14, 14), e.y + rng.range(-14, 14), 1);
      m.vx = rng.range(-90, 90); m.vy = rng.range(-90, 90);
      G.enemies.push(m);
      G.remaining++; // minis count toward the wave's remaining total
    }
  }
  // drops
  if (e.type !== "mini" && e.type !== "boss" && rng.chance(0.11)) {
    const roll = rng.next();
    const type = roll < 0.42 ? "cocoa" : roll < 0.78 ? "chili" : "star";
    if (!(type === "cocoa" && player.hp >= player.maxHp)) {
      G.pickups.push(makePickup(type, e.x, e.y));
    }
  }
}

function hurtPlayer(fromX, fromY) {
  if (player.invuln > 0 || G.mode !== "playing") return;
  player.hp -= 1;
  player.invuln = 0.95;
  G.hurtFlash = 0.55;
  addTrauma(0.5);
  G.freeze = Math.max(G.freeze, 0.05);
  const a = Math.atan2(player.y - fromY, player.x - fromX);
  player.vx += Math.cos(a) * 320; player.vy += Math.sin(a) * 320;
  fx.burst(player.x, player.y, { n: 18, color: "#ff7b7b", speed: 220, life: 0.5, size: 3, glow: true });
  Sfx.hurt();
  if (player.hp <= 0) gameOver();
}

function gameOver() {
  G.mode = "gameover";
  G.over = {
    at: G.time, score: G.score, wave: G.wave,
    kills: G.kills, maxCombo: G.maxCombo,
  };
  fx.explosion(player.x, player.y, true);
  addTrauma(1);
  Sfx.gameOver();
  if (G.score > G.high) {
    G.high = G.score;
    try { localStorage.setItem("flurryHigh", String(G.high)); } catch (e) {}
  }
}

function fireBomb() {
  const targets = G.enemies.filter((e) => e.type !== "boss");
  targets.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
  G.boomQueue = targets.map((e, i) => ({ e, t: i * 0.035 }));
  if (G.boss) {
    G.boss.hp -= 15; G.boss.flash = 0.12;
    fx.explosion(G.boss.x, G.boss.y, false);
    if (G.boss.hp <= 0) killEnemy(G.boss);
  }
  addTrauma(0.8); G.freeze = Math.max(G.freeze, 0.1);
  Sfx.bomb();
  showBanner("SNOWSTAR BOMB!", "The whole blizzard pops at once", 1.6, "#ffd166");
}

/* ---------------- demo / attract AI ---------------- */
function demoControl(dt) {
  let tx = W / 2, ty = H / 2 + 40, target = null, best = 1e9;
  for (const e of G.enemies) {
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < best) { best = d; target = e; }
  }
  let mx = 0, my = 0;
  if (target) {
    const dx = target.x - player.x, dy = target.y - player.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    const want = target.type === "boss" ? 265 : 225;
    const radial = (d - want) / 90;
    const strafe = Math.sin(G.time * 0.9) * 0.8;
    mx = (dx / d) * radial + (-dy / d) * strafe;
    my = (dy / d) * radial + (dx / d) * strafe;
    // lead the target slightly
    const lead = Math.min(0.35, d / 560);
    player.aim = Math.atan2(target.y + target.vy * lead - player.y, target.x + target.vx * lead - player.x);
    mouse.down = d < 520;
  } else {
    mx = Math.sin(G.time * 0.6) * 0.5; my = Math.cos(G.time * 0.45) * 0.4;
    mouse.down = false;
  }
  // dodge shards crudely: perpendicular hop when one is close
  for (const s of G.shards) {
    const d = Math.hypot(s.x - player.x, s.y - player.y);
    if (d < 74) { mx += -(s.vy) * 0.004; my += s.vx * 0.004; }
  }
  const len = Math.hypot(mx, my) || 1;
  player.vx += (mx / len * player.speed - player.vx) * Math.min(1, dt * 8);
  player.vy += (my / len * player.speed - player.vy) * Math.min(1, dt * 8);
  mouse.x = player.x + Math.cos(player.aim) * 120;
  mouse.y = player.y + Math.sin(player.aim) * 120;
  if (G.mode === "gameover") {
    G.demoRestart += dt;
    if (G.demoRestart > 2.2) { G.demoRestart = 0; startGame(); }
  }
}

/* ---------------- update ---------------- */
function update(dt) {
  G.time += dt;
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
  fx.update(dt);
  G.trauma = Math.max(0, G.trauma - dt * 1.7);
  G.hurtFlash = Math.max(0, G.hurtFlash - dt * 1.4);
  const sh = G.trauma * G.trauma * 15;
  G.shakeX = (camRng.next() * 2 - 1) * sh;
  G.shakeY = (camRng.next() * 2 - 1) * sh;

  if (G.mode !== "playing") {
    if (DEMO && G.mode === "title") startGame();
    if (DEMO && G.mode === "gameover") demoControl(dt);
    if (G.mode === "title") {
      // the logo breathes sparkles while the living scene runs behind it
      G.titleFxAcc += dt;
      if (G.titleFxAcc > 1.5) {
        G.titleFxAcc = 0;
        fx.burst(W / 2 + rng.range(-200, 200), 106 + rng.range(-18, 18), { n: 12, color: rng.chance(0.5) ? "#6FBCF0" : "#ffd166", speed: 90, life: 0.7, size: 2.4, glow: true });
      }
    }
    updateAmbient(dt);
    return;
  }
  if (paused) return;
  if (G.freeze > 0) { G.freeze -= dt; updateAmbient(dt); return; }

  /* player */
  if (DEMO) demoControl(dt);
  else {
    let mx = 0, my = 0;
    if (keys["a"] || keys["arrowleft"]) mx -= 1;
    if (keys["d"] || keys["arrowright"]) mx += 1;
    if (keys["w"] || keys["arrowup"]) my -= 1;
    if (keys["s"] || keys["arrowdown"]) my += 1;
    const len = Math.hypot(mx, my);
    const tx = len ? (mx / len) * player.speed : 0;
    const ty = len ? (my / len) * player.speed : 0;
    player.vx += (tx - player.vx) * Math.min(1, dt * 11);
    player.vy += (ty - player.vy) * Math.min(1, dt * 11);
    player.aim = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  }
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.x = Math.max(26, Math.min(W - 26, player.x));
  player.y = Math.max(64, Math.min(H - 28, player.y));
  player.moving = Math.min(1, Math.hypot(player.vx, player.vy) / 120);
  /* footprints: Lofi's trail pressed into the snow (permanence) */
  if (player.moving > 0.4) {
    G.printAcc += dt;
    if (G.printAcc > 0.09) {
      G.printAcc = 0;
      G.printSide = -G.printSide;
      const sp = Math.hypot(player.vx, player.vy) || 1;
      const ox = (-player.vy / sp) * 7 * G.printSide;
      const oy = (player.vx / sp) * 7 * G.printSide;
      fx.decal(player.x + ox, player.y + 15 + oy * 0.3, 4.6, "print", 6);
    }
  }
  player.animT += dt * (0.4 + player.moving);
  player.invuln = Math.max(0, player.invuln - dt);
  player.throwAnim = Math.max(0, player.throwAnim - dt * 5);
  G.rapidTimer = Math.max(0, G.rapidTimer - dt);

  /* firing */
  player.fireCd -= dt;
  const wantsFire = mouse.down || keys[" "];
  if (wantsFire && player.fireCd <= 0) {
    const rapid = G.rapidTimer > 0;
    player.fireCd = rapid ? 0.055 : 0.16;
    player.throwAnim = 1;
    const spread = rapid ? 0.055 : 0.028;
    const a = player.aim + rng.range(-spread, spread);
    const sx = player.x + Math.cos(player.aim) * 30;
    const sy = player.y + Math.sin(player.aim) * 30;
    G.balls.push(makeSnowball(sx, sy, a, rapid ? 610 : 545));
    fx.burst(sx, sy, { n: 3, color: "#ffffff", speed: 60, life: 0.25, size: 2, glow: true });
    Sfx.throwBall(G.combo);
  }

  /* combo decay */
  if (G.comboTimer > 0) {
    G.comboTimer -= dt;
    if (G.comboTimer <= 0) G.combo = 0;
  }

  /* spawning — v2 density: faster trickle, clustered packs of mixed
     types, and a hard alive-cap (Brotato rule: overflow waits in queue) */
  if (G.spawnQueue.length > 0) {
    G.spawnTimer -= dt;
    if (G.spawnTimer <= 0) {
      G.spawnTimer = Math.max(0.16, 0.5 - G.wave * 0.022);
      const batch = G.wave >= 8 ? 3 : G.wave >= 3 ? 2 : 1;
      let base = null;
      for (let i = 0; i < batch && G.spawnQueue.length > 0; i++) {
        if (G.enemies.length >= 46) break;
        if (!base) { spawnEnemy(G.spawnQueue.pop()); base = G.enemies[G.enemies.length - 1]; }
        else {
          const px = Math.max(24, Math.min(W - 24, base.x + rng.range(-64, 64)));
          const py = Math.max(58, Math.min(H - 24, base.y + rng.range(-52, 52)));
          spawnEnemy(G.spawnQueue.pop(), { x: px, y: py });
        }
      }
    }
  }
  if (G.bossPending) {
    G.bossTimer -= dt;
    if (G.bossTimer <= 0) { spawnBoss(G.bossPending); G.bossPending = 0; }
  }

  /* bomb queue */
  for (let i = G.boomQueue.length - 1; i >= 0; i--) {
    const b = G.boomQueue[i];
    b.t -= dt;
    if (b.t <= 0) {
      G.boomQueue.splice(i, 1);
      if (!b.e.dead) { fx.explosion(b.e.x, b.e.y, false); killEnemy(b.e); }
    }
  }

  /* snowballs */
  for (const ball of G.balls) {
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    ball.life -= dt;
    ball.trailAcc += dt;
    if (ball.trailAcc > 0.016) { ball.trailAcc = 0; fx.trailDot(ball.x, ball.y, "#cfeaff", 2.6); }
    if (ball.life <= 0 || ball.x < -12 || ball.x > W + 12 || ball.y < 40 || ball.y > H + 12) ball.dead = true;
  }

  /* enemy motion + boss behaviour */
  for (const e of G.enemies) {
    e.flash = Math.max(0, e.flash - dt);
    e.touchCd = Math.max(0, e.touchCd - dt);
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    let sp = e.speed;
    let px = 0, py = 0;
    if (e.type === "speeder") {
      const zigA = Math.sin(G.time * 5.2 + e.zig) * 0.75;
      const ca = Math.cos(zigA), sa = Math.sin(zigA);
      px = (dx / d) * ca - (dy / d) * sa; py = (dx / d) * sa + (dy / d) * ca;
    } else { px = dx / d; py = dy / d; }
    e.vx += (px * sp - e.vx) * Math.min(1, dt * 3.2);
    e.vy += (py * sp - e.vy) * Math.min(1, dt * 3.2);
    e.x += e.vx * dt; e.y += e.vy * dt;

    if (e.type === "boss") {
      e.burstTimer -= dt;
      e.summonTimer -= dt;
      if (e.burstTimer <= 0) {
        e.burstTimer = Math.max(1.7, 2.9 - e.level * 0.4);
        const n = 10 + e.level * 2;
        const off = rng.range(0, 6.28);
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * 6.283;
          G.shards.push(makeShard(e.x, e.y, a, 148));
        }
        fx.burst(e.x, e.y, { n: 22, color: "#9fd8ff", speed: 200, life: 0.5, size: 3, glow: true });
        addTrauma(0.22);
        Sfx.hit();
      }
      if (e.summonTimer <= 0) {
        e.summonTimer = 6.5;
        for (let i = 0; i < 2; i++) {
          const m = makeEnemy("chiller", e.x + rng.range(-56, 56), e.y + rng.range(-40, 40), waveHpScale(G.wave));
          G.enemies.push(m); G.remaining++;
          fx.snowPop(m.x, m.y, "#9fd8ff");
        }
      }
    }
    // touch damage
    if (d < e.r + player.r - 4 && e.touchCd <= 0) {
      e.touchCd = 0.7;
      hurtPlayer(e.x, e.y);
      e.vx -= (dx / d) * 150; e.vy -= (dy / d) * 150;
    }
  }
  /* gentle separation so swarms read as individuals */
  const es = G.enemies;
  for (let i = 0; i < es.length; i++) {
    for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy, min = (a.r + b.r) * 0.82;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2), push = (min - d) * 0.5;
        const ux = dx / d, uy = dy / d;
        a.x -= ux * push * 0.5; a.y -= uy * push * 0.5;
        b.x += ux * push * 0.5; b.y += uy * push * 0.5;
      }
    }
  }

  /* shards */
  for (const s of G.shards) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.rot += dt * 6; s.life -= dt;
    if (s.life <= 0 || s.x < -14 || s.x > W + 14 || s.y < 40 || s.y > H + 14) s.dead = true;
    if (!s.dead && Math.hypot(s.x - player.x, s.y - player.y) < s.r + player.r - 5) {
      s.dead = true;
      hurtPlayer(s.x - s.vx * 0.1, s.y - s.vy * 0.1);
    }
  }

  /* ball vs enemy */
  for (const ball of G.balls) {
    if (ball.dead) continue;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const dx = e.x - ball.x, dy = e.y - ball.y;
      if (dx * dx + dy * dy < (e.r + ball.r) * (e.r + ball.r)) {
        ball.dead = true;
        e.hp -= 1;
        e.flash = 0.09;
        const kb = e.type === "boss" ? 3 : e.type === "brute" ? 26 : 120;
        e.vx += (ball.vx / 545) * kb; e.vy += (ball.vy / 545) * kb;
        fx.burst(ball.x, ball.y, { n: 5, color: "#ffffff", speed: 130, life: 0.3, size: 2.2, glow: true });
        Sfx.hit();
        if (e.hp <= 0) killEnemy(e);
        break;
      }
    }
  }

  /* pickups */
  for (const pk of G.pickups) {
    pk.life -= dt;
    if (pk.life <= 0) { pk.dead = true; continue; }
    // sparkle trail: drops must advertise themselves (Geoms lesson)
    const pkColor = pk.type === "cocoa" ? "#ff9d5c" : pk.type === "chili" ? "#ff5252" : "#ffd166";
    pk.trailAcc = (pk.trailAcc || 0) + dt;
    if (pk.trailAcc > 0.12) { pk.trailAcc = 0; fx.trailDot(pk.x + rng.range(-7, 7), pk.y + rng.range(-7, 7), pkColor, 2); }
    const dx = player.x - pk.x, dy = player.y - pk.y;
    const d = Math.hypot(dx, dy);
    if (d < 84) { pk.x += (dx / d) * 150 * dt; pk.y += (dy / d) * 150 * dt; fx.trailDot(pk.x, pk.y, pkColor, 2.4); }
    if (d < player.r + pk.r + 4) {
      pk.dead = true;
      Sfx.pickup();
      if (pk.type === "cocoa") {
        player.hp = Math.min(player.maxHp, player.hp + 1);
        fx.floatText(player.x, player.y - 44, "+1 HP — HOT COCOA!", { color: "#ff9d5c", size: 16 });
        fx.burst(pk.x, pk.y, { n: 12, color: "#ff9d5c", speed: 120, life: 0.5, size: 2.6, glow: true });
      } else if (pk.type === "chili") {
        G.rapidTimer = 8;
        fx.floatText(player.x, player.y - 44, "CHILI RAPID FIRE — 8s!", { color: "#ff5252", size: 16 });
        fx.burst(pk.x, pk.y, { n: 12, color: "#ff5252", speed: 120, life: 0.5, size: 2.6, glow: true });
      } else if (pk.type === "star") {
        fireBomb();
      }
    }
  }

  G.enemies = G.enemies.filter((e) => !e.dead);
  G.balls = G.balls.filter((b) => !b.dead);
  G.shards = G.shards.filter((s) => !s.dead);
  G.pickups = G.pickups.filter((p) => !p.dead);

  /* wave clear? */
  if (G.spawnQueue.length === 0 && !G.bossPending && G.enemies.length === 0 && G.mode === "playing") {
    const bonus = 100 * G.wave;
    G.score += bonus;
    fx.floatText(W / 2, H / 2 - 90, "WAVE " + G.wave + " CLEAR — BONUS +" + bonus, { color: "#5ff2c8", size: 22 });
    Sfx.waveClear();
    beginWave(G.wave + 1);
  }

  /* score ticker */
  const diff = G.score - G.displayScore;
  G.displayScore += Math.abs(diff) < 3 ? diff : diff * Math.min(1, dt * 7);

  updateAmbient(dt);
}

/* ============================================================
   Weather & ambient life — three snow depths bent by one wind,
   drifting ice crystals, edge wisps, and bird flocks. Layers at
   different speeds hide the loop; the far layer barely moves.
   ============================================================ */
const snowLayers = [
  { n: 140, rMin: 0.7, rMax: 1.4, vMin: 12, vMax: 30, alpha: 0.4, flakes: [] },
  { n: 100, rMin: 1.3, rMax: 2.3, vMin: 30, vMax: 55, alpha: 0.65, flakes: [] },
  { n: 60, rMin: 2.2, rMax: 3.6, vMin: 55, vMax: 95, alpha: 0.9, flakes: [] },
];
(function seedSnow() {
  const sr = makeRng(777);
  for (const L of snowLayers) {
    for (let i = 0; i < L.n; i++) {
      L.flakes.push({ x: sr.range(0, W), y: sr.range(0, H), r: sr.range(L.rMin, L.rMax), s: sr.range(L.vMin, L.vMax), ph: sr.range(0, 6.28) });
    }
  }
})();
const crystals = [];
(function seedCrystals() {
  const sr = makeRng(31337);
  for (let i = 0; i < 26; i++) {
    crystals.push({ x: sr.range(0, W), y: sr.range(40, H - 40), s: sr.range(2.5, 5.5), ph: sr.range(0, 6.28), sp: sr.range(4, 11) });
  }
})();
/* Wisps: snow sprites wandering the edges + flurry spirits orbiting
   the corners. Pure decoration — the arena breathes between kills. */
const wisps = [];
(function seedWisps() {
  const sr = makeRng(2024);
  const anchors = [
    { x: 52, y: 84 }, { x: W - 52, y: 84 }, { x: 52, y: H - 70 }, { x: W - 52, y: H - 70 },
    { x: W / 2, y: 66 }, { x: 34, y: H / 2 }, { x: W - 34, y: H / 2 },
    { x: 120, y: H - 44 }, { x: W - 120, y: H - 44 }, { x: 150, y: 120 }, { x: W - 150, y: 120 },
  ];
  anchors.forEach((a, i) => {
    wisps.push({ ax: a.x, ay: a.y, rad: sr.range(16, 40), sp: sr.range(0.5, 1.1) * (i % 2 ? 1 : -1), ph: sr.range(0, 6.28), trailAcc: 0 });
  });
})();
let birdFlock = null;
let birdTimer = 6;

function windAt(t) {
  // slow gust clock: layered sines so gusts never feel metronomic
  return Math.sin(t * 0.23) + Math.sin(t * 0.11 + 1.7) * 0.8;
}

function updateAmbient(dt) {
  const t = G.time;
  const wind = windAt(t);
  snowLayers.forEach((L, li) => {
    const depthWind = wind * (6 + li * 9);
    for (const f of L.flakes) {
      f.y += f.s * dt;
      f.x += (Math.sin(t * 1.3 + f.ph) * 9 + depthWind) * dt;
      if (f.y > H + 4) { f.y = -4; f.x = rng.range(0, W); }
      if (f.x > W + 4) f.x = -4; else if (f.x < -4) f.x = W + 4;
    }
  });
  for (const cr of crystals) {
    cr.x += (Math.sin(t * 0.4 + cr.ph) * 4 + wind * 5 + cr.sp * 0.4) * dt;
    cr.y += (Math.cos(t * 0.3 + cr.ph) * 3 + 3.5) * dt;
    if (cr.y > H + 8) { cr.y = -8; cr.x = rng.range(0, W); }
    if (cr.x > W + 8) cr.x = -8; else if (cr.x < -8) cr.x = W + 8;
  }
  for (const wp of wisps) {
    wp.ph += wp.sp * dt;
    wp.trailAcc += dt;
    if (wp.trailAcc > 0.14) {
      wp.trailAcc = 0;
      fx.trailDot(wp.ax + Math.cos(wp.ph) * wp.rad, wp.ay + Math.sin(wp.ph * 1.3) * wp.rad * 0.55, "#9fe8ff", 1.7);
    }
  }
  birdTimer -= dt;
  if (!birdFlock && birdTimer <= 0) {
    const n = 3 + Math.floor(rng.range(0, 3));
    const dir = rng.chance(0.5) ? 1 : -1;
    birdFlock = { x: dir > 0 ? -50 : W + 50, y: rng.range(56, 120), dir, n, sp: rng.range(48, 66), ph: rng.range(0, 6.28) };
    birdTimer = rng.range(11, 19);
  }
  if (birdFlock) {
    birdFlock.x += birdFlock.dir * birdFlock.sp * dt;
    if (birdFlock.x < -90 || birdFlock.x > W + 90) birdFlock = null;
  }
}

function drawSnowLayer(li) {
  const L = snowLayers[li];
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = L.alpha;
  ctx.beginPath();
  for (const f of L.flakes) { ctx.moveTo(f.x + f.r, f.y); ctx.arc(f.x, f.y, f.r, 0, 6.29); }
  ctx.fill();
  ctx.restore();
}
function drawCrystals(time) {
  ctx.save();
  ctx.fillStyle = "rgba(170,225,255,0.55)";
  for (const cr of crystals) {
    ctx.save();
    ctx.translate(cr.x, cr.y);
    ctx.rotate(time * 0.5 + cr.ph);
    ctx.beginPath();
    ctx.moveTo(0, -cr.s); ctx.lineTo(cr.s * 0.55, 0); ctx.lineTo(0, cr.s); ctx.lineTo(-cr.s * 0.55, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function drawWisps(time) {
  ctx.save();
  for (const wp of wisps) {
    const x = wp.ax + Math.cos(wp.ph) * wp.rad;
    const y = wp.ay + Math.sin(wp.ph * 1.3) * wp.rad * 0.55;
    const pulse = 0.7 + 0.3 * Math.sin(time * 3 + wp.ph * 4);
    const gs = 15 * pulse;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.5 * pulse;
    ctx.drawImage(fx.glowSprite("#7fe0ff"), x - gs / 2, y - gs / 2, gs, gs);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#eafcff";
    ctx.beginPath(); ctx.arc(x, y, 1.9 * pulse, 0, 6.29); ctx.fill();
  }
  ctx.restore();
}
function drawBirds(time) {
  if (!birdFlock) return;
  ctx.save();
  ctx.strokeStyle = "rgba(10,26,52,0.85)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = 0; i < birdFlock.n; i++) {
    const bx = birdFlock.x - birdFlock.dir * i * 26;
    const by = birdFlock.y + Math.sin(i * 1.7) * 10 + i * 5;
    const flap = Math.sin(time * 9 + birdFlock.ph + i) * 4.5;
    ctx.beginPath();
    ctx.moveTo(bx - 7, by - flap * 0.4);
    ctx.quadraticCurveTo(bx - 2.5, by - 3.5 - flap, bx, by);
    ctx.quadraticCurveTo(bx + 2.5, by - 3.5 - flap, bx + 7, by - flap * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------------- draw ---------------- */
function drawHeart(x, y, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = filled ? "#ff5c7a" : "rgba(255,92,122,0.22)";
  if (filled) { ctx.shadowColor = "#ff5c7a"; ctx.shadowBlur = 8; }
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-11, -4, -6, -13, 0, -6);
  ctx.bezierCurveTo(6, -13, 11, -4, 0, 6);
  ctx.fill();
  ctx.restore();
}

function draw() {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.translate(G.shakeX, G.shakeY);
  ctx.drawImage(bg, 0, 0);
  drawAurora(G.time);
  // parallax silhouettes: far peaks barely answer the shake, pines more
  ctx.drawImage(peaksCv, -40 - G.shakeX * 0.25 + Math.sin(G.time * 0.05) * 3, 0);
  drawBirds(G.time);
  ctx.drawImage(pinesCv, -20 - G.shakeX * 0.5, 0);
  fx.drawDecals(ctx);
  drawSnowLayer(0);
  drawCrystals(G.time);
  drawSparkles(G.time);
  drawWisps(G.time);

  for (const pk of G.pickups) drawPickup(ctx, pk, G.time);

  // snowballs
  for (const b of G.balls) {
    ctx.save();
    ctx.shadowColor = "#bfe6ff"; ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.29); ctx.fill();
    ctx.restore();
  }
  // boss shards
  for (const s of G.shards) {
    ctx.save();
    ctx.translate(s.x, s.y); ctx.rotate(s.rot);
    ctx.shadowColor = "#6fbdff"; ctx.shadowBlur = 9;
    ctx.fillStyle = "#a8d4f5";
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(5, 4); ctx.lineTo(0, 8); ctx.lineTo(-5, 4);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  for (const e of G.enemies) {
    if (e.type === "boss") drawBoss(ctx, e, G.time);
    else drawGremlin(ctx, e, G.time);
  }

  if (G.mode !== "gameover") drawYeti(ctx, player, player.aim, G.time);

  fx.draw(ctx);
  fx.drawTexts(ctx);

  // mid + near snowfall in front of the action
  drawSnowLayer(1);
  drawSnowLayer(2);
  ctx.restore();

  // hurt vignette
  if (G.hurtFlash > 0 || (G.mode === "playing" && player.hp === 1)) {
    const pulse = player.hp === 1 && G.mode === "playing" ? 0.16 + Math.sin(G.time * 5) * 0.07 : 0;
    const a = Math.max(G.hurtFlash * 0.5, pulse);
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, H * 0.78);
    vg.addColorStop(0, "rgba(255,40,60,0)");
    vg.addColorStop(1, "rgba(255,40,60," + a.toFixed(3) + ")");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  // combo frost vignette: at high chains the blizzard leans in
  if (G.mode === "playing" && G.combo >= 15) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.85, 0.25 + (G.combo - 15) / 45);
    ctx.drawImage(frostCv, 0, 0);
    ctx.restore();
  }

  if (G.mode === "playing") drawHud();
  if (G.banner && G.mode === "playing") drawBanner();
  if (paused && G.mode === "playing") drawCenterMessage("PAUSED", "Press P to keep throwing snow");
  if (G.mode === "title") drawTitle();
  if (G.mode === "gameover") drawGameOver();
}

function drawHud() {
  ctx.save();
  // score block
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(160,210,255,0.85)";
  ctx.font = "700 11px 'Trebuchet MS', sans-serif";
  ctx.fillText("S C O R E", 20, 30);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 30px 'Trebuchet MS', sans-serif";
  ctx.shadowColor = "#4da2ff"; ctx.shadowBlur = 12;
  ctx.fillText(String(Math.round(G.displayScore)).padStart(6, "0"), 18, 62);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(160,210,255,0.65)";
  ctx.font = "600 12px 'Trebuchet MS', sans-serif";
  ctx.fillText("BEST " + G.high, 20, 80);

  // combo meter
  const mult = comboMult();
  if (G.combo >= 2) {
    const pop = 1 + Math.max(0, G.comboTimer - 2.2) * 1.4;
    ctx.save();
    ctx.translate(58, 108); ctx.scale(pop, pop);
    ctx.font = "800 21px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = mult >= 5 ? "#ffd166" : mult >= 3 ? "#5ff2c8" : "#bfe6ff";
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
    ctx.textAlign = "center";
    ctx.fillText("×" + mult, 0, 0);
    ctx.restore();
    ctx.fillStyle = "rgba(10,26,54,0.8)";
    ctx.fillRect(20, 116, 76, 6);
    const cgrad = ctx.createLinearGradient(20, 0, 96, 0);
    cgrad.addColorStop(0, "#bfe6ff"); cgrad.addColorStop(0.6, "#6FBCF0"); cgrad.addColorStop(1, mult >= 5 ? "#ffd166" : "#5ff2c8");
    ctx.fillStyle = cgrad;
    ctx.fillRect(20, 116, 76 * Math.max(0, G.comboTimer / 2.5), 6);
    // tick marks: one per multiplier step (every 5 chain)
    ctx.fillStyle = "rgba(4,14,34,0.85)";
    for (let k = 1; k < 5; k++) ctx.fillRect(20 + (76 / 5) * k - 0.5, 116, 1.4, 6);
    ctx.fillStyle = "rgba(220,238,255,0.75)";
    ctx.font = "600 11px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(G.combo + " CHAIN", 20, 136);
  }

  // wave block (top center)
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 19px 'Trebuchet MS', sans-serif";
  ctx.shadowColor = "#4da2ff"; ctx.shadowBlur = 9;
  ctx.fillText("WAVE " + G.wave, W / 2, 34);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(190,225,255,0.85)";
  ctx.font = "600 12px 'Trebuchet MS', sans-serif";
  const left = G.remaining;
  ctx.fillText(G.waveName + "  ·  " + left + " GREMLIN" + (left === 1 ? "" : "S") + " LEFT", W / 2, 54);
  // wave progress bar: how much of this wave has been popped
  if (G.waveTotal > 0) {
    const frac = Math.max(0, Math.min(1, (G.waveTotal - G.remaining) / G.waveTotal));
    ctx.fillStyle = "rgba(10,26,54,0.8)";
    ctx.fillRect(W / 2 - 100, 60, 200, 4);
    ctx.fillStyle = "#6FBCF0";
    ctx.fillRect(W / 2 - 100, 60, 200 * frac, 4);
  }

  // hearts (top right)
  for (let i = 0; i < player.maxHp; i++) drawHeart(W - 30 - i * 27, 34, i < player.hp);
  if (Sfx.isMuted()) {
    ctx.fillStyle = "rgba(220,238,255,0.6)";
    ctx.font = "600 11px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("MUTED (M)", W - 18, 62);
  }

  // chili timer
  if (G.rapidTimer > 0) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#ff5252";
    ctx.font = "800 13px 'Trebuchet MS', sans-serif";
    ctx.fillText("🌶 RAPID " + G.rapidTimer.toFixed(1) + "s", W - 18, 84);
    ctx.fillStyle = "rgba(10,26,54,0.8)";
    ctx.fillRect(W - 118, 90, 100, 5);
    ctx.fillStyle = "#ff5252";
    ctx.fillRect(W - 118, 90, 100 * (G.rapidTimer / 8), 5);
  }

  // boss bar (bottom center)
  if (G.boss) {
    const bw = 430, bx = W / 2 - bw / 2, by = H - 30;
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd166";
    ctx.font = "800 12px 'Trebuchet MS', sans-serif";
    ctx.fillText(G.boss.name, W / 2, by - 7);
    ctx.fillStyle = "rgba(6,16,36,0.85)";
    ctx.fillRect(bx - 2, by - 2, bw + 4, 13);
    const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, "#4d7dff"); grad.addColorStop(1, "#b28dff");
    ctx.fillStyle = grad;
    ctx.fillRect(bx, by, bw * Math.max(0, G.boss.hp / G.boss.maxHp), 9);
  }

  // aim ring
  if (!DEMO) {
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 9, 0, 6.29); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 1.8, 0, 6.29); ctx.fill();
  }
  ctx.restore();
}

function drawBanner() {
  const b = G.banner;
  const inT = Math.min(1, b.t / 0.32);
  const outT = Math.min(1, (b.dur - b.t) / 0.4);
  const a = Math.max(0, Math.min(inT, outT));
  const ease = 1 - Math.pow(1 - inT, 3);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(W / 2, 128 - (1 - ease) * 26);
  ctx.textAlign = "center";
  ctx.font = "900 37px 'Trebuchet MS', sans-serif";
  ctx.lineWidth = 8; ctx.strokeStyle = "rgba(4,14,34,0.9)";
  ctx.strokeText(b.title, 0, 0);
  ctx.fillStyle = b.color;
  ctx.shadowColor = b.color; ctx.shadowBlur = 18;
  ctx.fillText(b.title, 0, 0);
  ctx.shadowBlur = 0;
  if (b.sub) {
    ctx.font = "600 15px 'Trebuchet MS', sans-serif";
    ctx.lineWidth = 5;
    ctx.strokeText(b.sub, 0, 26);
    ctx.fillStyle = "#dceeff";
    ctx.fillText(b.sub, 0, 26);
  }
  ctx.restore();
}

function drawCenterMessage(title, sub) {
  ctx.save();
  ctx.fillStyle = "rgba(3,8,22,0.55)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 44px 'Trebuchet MS', sans-serif";
  ctx.fillText(title, W / 2, H / 2);
  ctx.font = "600 16px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "#bfe6ff";
  ctx.fillText(sub, W / 2, H / 2 + 34);
  ctx.restore();
}

const marchers = [];
function drawTitle() {
  ctx.save();
  ctx.fillStyle = "rgba(3,8,22,0.25)";
  ctx.fillRect(0, 0, W, H);
  // a gremlin patrol marches along the bottom edge — the threat, on parade
  if (!marchers.length) {
    const types = ["chiller", "speeder", "chiller", "brute", "splitter", "chiller", "speeder", "mini"];
    for (let i = 0; i < types.length; i++) marchers.push(makeEnemy(types[i], 0, 0, 1));
  }
  ctx.save();
  ctx.globalAlpha = 0.92;
  marchers.forEach((m, i) => {
    m.x = ((G.time * 26 + i * 128) % (W + 90)) - 45;
    m.y = H - 40 + Math.sin(i * 2.1) * 4;
    m.flash = 0;
    ctx.save();
    ctx.translate(m.x, m.y); ctx.scale(0.6, 0.6); ctx.translate(-m.x, -m.y);
    drawGremlin(ctx, m, G.time);
    ctx.restore();
  });
  ctx.restore();
  // idle Lofi, front and center — bigger, bouncing, scarf flying
  const idle = { x: W / 2, y: H / 2 + 66, animT: G.time * 0.5, moving: 0.25, invuln: 0, throwAnim: 0, vx: Math.sin(G.time * 0.9) * 30 };
  drawYeti(ctx, idle, -Math.PI / 2 + Math.sin(G.time * 0.7) * 0.35, G.time, 1.4);

  ctx.textAlign = "center";
  ctx.font = "900 64px 'Trebuchet MS', sans-serif";
  ctx.lineWidth = 12; ctx.strokeStyle = "rgba(4,14,34,0.92)";
  ctx.strokeText("FLURRY FRENZY", W / 2, 118);
  const grad = ctx.createLinearGradient(0, 66, 0, 122);
  grad.addColorStop(0, "#ffffff"); grad.addColorStop(0.6, "#bfe6ff"); grad.addColorStop(1, "#4da2ff");
  ctx.fillStyle = grad;
  ctx.shadowColor = "#4da2ff"; ctx.shadowBlur = 20 + Math.sin(G.time * 2.2) * 7;
  ctx.fillText("FLURRY FRENZY", W / 2, 118);
  ctx.shadowBlur = 0;
  ctx.font = "800 21px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "#ffd166";
  ctx.fillText("— LOFI'S SNOWBALL SIEGE —", W / 2, 152);

  ctx.font = "600 15.5px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "#dceeff";
  ctx.fillText("Frost Gremlins are storming the Flurry. Lofi has a scarf, a strong arm,", W / 2, H - 118);
  ctx.fillText("and an unlimited supply of snow. Hold the village through 12 blizzard waves.", W / 2, H - 96);

  const pulse = 1 + Math.sin(G.time * 4.2) * 0.045;
  ctx.save();
  ctx.translate(W / 2, H - 52); ctx.scale(pulse, pulse);
  ctx.font = "900 23px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "#5ff2c8";
  ctx.shadowColor = "#5ff2c8"; ctx.shadowBlur = 14;
  ctx.fillText("CLICK OR PRESS SPACE TO PLAY", 0, 0);
  ctx.restore();

  ctx.font = "600 12.5px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "rgba(170,205,240,0.8)";
  ctx.fillText("5 gremlin types · combo chains to ×9 · chili rapid fire · snowstar bombs · General Blizzard boss at waves 5 & 10", W / 2, H - 22);
  if (G.high > 0) ctx.fillText("BEST SCORE: " + G.high, W / 2, 178);
  ctx.restore();
}

function drawGameOver() {
  const o = G.over;
  if (!o) return;
  ctx.save();
  ctx.fillStyle = "rgba(3,8,22,0.62)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.font = "900 46px 'Trebuchet MS', sans-serif";
  ctx.lineWidth = 10; ctx.strokeStyle = "rgba(4,14,34,0.92)";
  ctx.strokeText("THE FLURRY FALLS", W / 2, 138);
  ctx.fillStyle = "#ff8fa3";
  ctx.shadowColor = "#ff5c7a"; ctx.shadowBlur = 18;
  ctx.fillText("THE FLURRY FALLS", W / 2, 138);
  ctx.shadowBlur = 0;
  ctx.font = "600 15px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "#bfe6ff";
  ctx.fillText("...but only until Lofi's next snowball.", W / 2, 168);

  const stats = [
    ["FINAL SCORE", o.score],
    ["WAVES SURVIVED", o.wave],
    ["GREMLINS POPPED", o.kills],
    ["BEST CHAIN", o.maxCombo + " (×" + Math.min(9, 1 + Math.floor(o.maxCombo / 5)) + ")"],
  ];
  ctx.font = "700 14px 'Trebuchet MS', sans-serif";
  stats.forEach((s, i) => {
    const y = 224 + i * 42;
    ctx.fillStyle = "rgba(160,210,255,0.85)";
    ctx.textAlign = "right";
    ctx.fillText(s[0], W / 2 - 18, y);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 21px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(String(s[1]), W / 2 + 18, y + 2);
    ctx.font = "700 14px 'Trebuchet MS', sans-serif";
  });

  const pulse = 1 + Math.sin(G.time * 4.2) * 0.04;
  ctx.save();
  ctx.translate(W / 2, 428); ctx.scale(pulse, pulse);
  ctx.textAlign = "center";
  ctx.font = "900 20px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "#5ff2c8";
  ctx.shadowColor = "#5ff2c8"; ctx.shadowBlur = 12;
  ctx.fillText("CLICK OR PRESS SPACE TO PLAY AGAIN", 0, 0);
  ctx.restore();
  ctx.restore();
}

/* ---------------- main loop ---------------- */
let last = performance.now();
let fpsEma = 60;
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 0.033);
  if (dt > 0) {
    fpsEma = fpsEma * 0.95 + (1 / Math.max(dt, 0.0001)) * 0.05;
    update(dt);
  }
  draw();
  // verification hook: live density + frame rate, read by the CDP checks
  window.__ff = {
    fps: Math.round(fpsEma * 10) / 10,
    mode: G.mode, wave: G.wave,
    enemies: G.enemies.length, particles: fx.list.length,
    decals: fx.decals.length, arcs: fx.arcs.length,
    kills: G.kills, score: G.score, combo: G.combo,
  };
  requestAnimationFrame(frame);
}
if (DEMO) { /* auto-start happens in update */ }
requestAnimationFrame(frame);
