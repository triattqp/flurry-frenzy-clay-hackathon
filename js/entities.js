"use strict";
/* Entities: Lofi the Yeti (hero), snowballs, five Frost Gremlin types,
   the General Blizzard boss, and pickups. All art is procedural canvas —
   no image assets — so the whole game ships as a handful of text files. */

const ENEMY_TYPES = {
  chiller:  { hp: 2, speed: 62,  r: 17, score: 50,  color: "#7fd0ff", dmg: 1 },
  speeder:  { hp: 1, speed: 138, r: 12, score: 75,  color: "#b28dff", dmg: 1 },
  brute:    { hp: 9, speed: 34,  r: 27, score: 200, color: "#4d7dff", dmg: 1 },
  splitter: { hp: 3, speed: 55,  r: 19, score: 120, color: "#5ff2c8", dmg: 1 },
  mini:     { hp: 1, speed: 105, r: 9,  score: 30,  color: "#a9ecff", dmg: 1 },
};

function makeEnemy(type, x, y, waveScale) {
  const base = ENEMY_TYPES[type];
  return {
    kind: "enemy", type,
    x, y, vx: 0, vy: 0,
    hp: Math.round(base.hp * waveScale), maxHp: Math.round(base.hp * waveScale),
    speed: base.speed, r: base.r, score: base.score,
    color: base.color, dmg: base.dmg,
    flash: 0, wobble: Math.random() * 6.28, zig: Math.random() * 6.28,
    touchCd: 0, dead: false,
  };
}

function makeBoss(x, y, level) {
  return {
    kind: "boss", type: "boss",
    x, y, vx: 0, vy: 0,
    hp: level === 1 ? 60 : 130, maxHp: level === 1 ? 60 : 130,
    speed: 26, r: 52, score: 2500, color: "#dceeff", dmg: 1,
    flash: 0, wobble: 0, touchCd: 0, dead: false,
    burstTimer: 2.2, summonTimer: 4.5, level,
    name: level === 1 ? "GENERAL BLIZZARD" : "GENERAL BLIZZARD, UNTHAWED",
  };
}

const PICKUP_TYPES = {
  cocoa: { color: "#ff9d5c", label: "☕" },
  chili: { color: "#ff5252", label: "🌶" },
  star:  { color: "#ffd166", label: "★" },
};

function makePickup(type, x, y) {
  return { kind: "pickup", type, x, y, r: 13, bob: Math.random() * 6.28, life: 11, dead: false };
}

function makeSnowball(x, y, angle, speed) {
  return {
    kind: "ball", x, y,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    r: 6, life: 1.15, dead: false, trailAcc: 0,
  };
}

function makeShard(x, y, angle, speed) {
  return {
    kind: "shard", x, y,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    r: 7, life: 2.6, dead: false, rot: Math.random() * 6.28,
  };
}

/* ---------- Drawing: Lofi the Yeti ---------- */
function drawYeti(ctx, p, aimAngle, time, scale) {
  const S = scale || 1.18; // v2: Lofi owns the frame — bigger than his hitbox
  const squash = 1 + Math.sin(p.animT * 14) * 0.045 * p.moving;
  const idleBob = Math.sin(time * 2.3 + (p.bobPh || 0)) * (1 - Math.min(1, p.moving)) * 2.2;
  const throwPulse = p.throwAnim > 0 ? Math.sin(p.throwAnim * Math.PI) * 0.07 : 0;
  ctx.save();
  ctx.translate(p.x, p.y + idleBob);
  // soft shadow (stays on the ground while the body bounces)
  ctx.fillStyle = "rgba(2,8,24,0.45)";
  ctx.beginPath(); ctx.ellipse(0, 26 - idleBob, 24 * S, 8, 0, 0, 6.29); ctx.fill();
  if (p.invuln > 0 && Math.floor(time * 16) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.scale(S * (2 - squash) * (1 + throwPulse), S * squash * (1 - throwPulse * 0.5)); // squash & stretch, volume-preserving-ish
  // feet
  ctx.fillStyle = "#dfeaf5";
  ctx.beginPath(); ctx.ellipse(-11, 24, 9, 5.5, 0, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.ellipse(11, 24, 9, 5.5, 0, 0, 6.29); ctx.fill();
  // furry body
  const bodyGrad = ctx.createRadialGradient(-6, -8, 6, 0, 4, 34);
  bodyGrad.addColorStop(0, "#ffffff");
  bodyGrad.addColorStop(0.75, "#e8f1fa");
  bodyGrad.addColorStop(1, "#b9cfe2");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath(); ctx.ellipse(0, 4, 23, 26, 0, 0, 6.29); ctx.fill();
  // fur spikes
  ctx.fillStyle = "#eef6fd";
  for (let i = 0; i < 7; i++) {
    const a = -2.6 + i * 0.42;
    const fx = Math.sin(a) * 21, fy = -Math.cos(a) * 22 + 2;
    ctx.beginPath();
    ctx.moveTo(fx - 4, fy + 4); ctx.lineTo(fx, fy - 6); ctx.lineTo(fx + 4, fy + 4);
    ctx.closePath(); ctx.fill();
  }
  // horns
  ctx.fillStyle = "#ffd9a0";
  ctx.beginPath(); ctx.moveTo(-19, -16); ctx.quadraticCurveTo(-27, -26, -21, -31); ctx.quadraticCurveTo(-15, -24, -13, -17); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(19, -16); ctx.quadraticCurveTo(27, -26, 21, -31); ctx.quadraticCurveTo(15, -24, 13, -17); ctx.closePath(); ctx.fill();
  // face
  const faceGrad = ctx.createRadialGradient(0, -8, 3, 0, -6, 15);
  faceGrad.addColorStop(0, "#bfe3ff");
  faceGrad.addColorStop(1, "#7fb8e8");
  ctx.fillStyle = faceGrad;
  ctx.beginPath(); ctx.ellipse(0, -7, 13.5, 11.5, 0, 0, 6.29); ctx.fill();
  // eyes look toward aim
  const ex = Math.cos(aimAngle) * 2.4, ey = Math.sin(aimAngle) * 1.8;
  ctx.fillStyle = "#0b2038";
  ctx.beginPath(); ctx.arc(-5 + ex, -9 + ey, 2.3, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.arc(5 + ex, -9 + ey, 2.3, 0, 6.29); ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(-4.2 + ex, -9.8 + ey, 0.8, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.arc(5.8 + ex, -9.8 + ey, 0.8, 0, 6.29); ctx.fill();
  // mouth
  ctx.strokeStyle = "#0b2038"; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(0, -3.4, 3.6, 0.25, Math.PI - 0.25); ctx.stroke();
  // Sui-blue scarf — #6FBCF0 is his colour now, and the tail flutters
  // in three segments against his movement (Hades colour-ownership rule)
  ctx.fillStyle = "#6FBCF0";
  ctx.beginPath(); ctx.ellipse(0, 6.5, 14.5, 5.4, 0, 0, 6.29); ctx.fill();
  const bend = -(p.vx || 0) * 0.018;
  let sxp = 9, syp = 8;
  for (let seg = 0; seg < 3; seg++) {
    const fl = Math.sin(time * 9 - seg * 1.1) * (2 + seg * 0.9) + bend * (seg + 1);
    const nx = sxp + 4.6 - seg * 0.5, ny = syp + 5.2 + fl * 0.4;
    ctx.fillStyle = seg % 2 ? "#8fd0ff" : "#6FBCF0";
    ctx.beginPath(); ctx.ellipse((sxp + nx) / 2 + fl * 0.3, (syp + ny) / 2, 4.6, 3.1, 0.5 + fl * 0.05, 0, 6.29); ctx.fill();
    sxp = nx; syp = ny;
  }
  ctx.restore();

  // throwing arm + held snowball, aimed (scaled with the body)
  ctx.save();
  ctx.translate(p.x, p.y + idleBob);
  ctx.scale(S, S);
  ctx.rotate(aimAngle);
  const wind = p.throwAnim > 0 ? Math.sin(p.throwAnim * Math.PI) * 5 : 0;
  ctx.strokeStyle = "#e8f1fa"; ctx.lineWidth = 7; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(10, 6); ctx.lineTo(24, 3 - wind * 0.3); ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#bfe6ff"; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(27, 2 - wind * 0.3, 5.4, 0, 6.29); ctx.fill();
  ctx.restore();
}

/* ---------- Drawing: gremlins & boss ---------- */
function drawGremlin(ctx, e, time) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = "rgba(2,8,24,0.4)";
  ctx.beginPath(); ctx.ellipse(0, e.r * 0.92, e.r * 0.95, e.r * 0.3, 0, 0, 6.29); ctx.fill();
  const wob = Math.sin(time * 9 + e.wobble) * 0.08;
  ctx.rotate(wob);
  const flash = e.flash > 0;
  const body = flash ? "#ffffff" : e.color;
  // spiky ice body — long crystal spikes, deep valleys, dark rim
  ctx.fillStyle = body;
  ctx.shadowColor = e.color; ctx.shadowBlur = flash ? 0 : 10;
  ctx.beginPath();
  const spikes = 8;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * 6.29 + e.wobble;
    const rr = e.r * (i % 2 === 0 ? 1.3 : 0.66);
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(4,16,38,0.55)"; ctx.lineWidth = 1.6;
  ctx.stroke();
  // inner core
  ctx.fillStyle = flash ? "#ffffff" : "rgba(6,20,44,0.55)";
  ctx.beginPath(); ctx.arc(0, 0, e.r * 0.52, 0, 6.29); ctx.fill();
  // angry eyes
  ctx.fillStyle = "#ffe066";
  const er = Math.max(1.8, e.r * 0.13);
  ctx.beginPath(); ctx.arc(-e.r * 0.22, -e.r * 0.08, er, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.arc(e.r * 0.22, -e.r * 0.08, er, 0, 6.29); ctx.fill();
  ctx.strokeStyle = "#ffe066"; ctx.lineWidth = Math.max(1.4, e.r * 0.07);
  ctx.beginPath();
  ctx.moveTo(-e.r * 0.34, e.r * 0.3); ctx.lineTo(-e.r * 0.1, e.r * 0.16);
  ctx.lineTo(e.r * 0.12, e.r * 0.32); ctx.lineTo(e.r * 0.34, e.r * 0.14);
  ctx.stroke();
  ctx.restore();
  // mini HP bar when damaged
  if (e.hp < e.maxHp && e.type !== "mini") {
    ctx.save();
    ctx.fillStyle = "rgba(3,10,26,0.7)";
    ctx.fillRect(e.x - e.r, e.y - e.r - 11, e.r * 2, 4.5);
    ctx.fillStyle = "#5ff2c8";
    ctx.fillRect(e.x - e.r, e.y - e.r - 11, e.r * 2 * Math.max(0, e.hp / e.maxHp), 4.5);
    ctx.restore();
  }
}

function drawBoss(ctx, b, time) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = "rgba(2,8,24,0.5)";
  ctx.beginPath(); ctx.ellipse(0, b.r * 0.95, b.r * 1.05, b.r * 0.3, 0, 0, 6.29); ctx.fill();
  const flash = b.flash > 0;
  const pulse = 1 + Math.sin(time * 2.2) * 0.03;
  ctx.scale(pulse, pulse);
  // ice-shard crown body
  ctx.fillStyle = "#a8d4f5";
  ctx.shadowColor = "#6fbdff"; ctx.shadowBlur = flash ? 0 : 22;
  ctx.beginPath();
  const spikes = 10;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * 6.29 + Math.sin(time * 0.7) * 0.05;
    const rr = b.r * (i % 2 === 0 ? 1.18 : 0.86);
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  if (flash) { // hit flash as a translucent veil — the ice stays visible
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fill();
  }
  const core = ctx.createRadialGradient(0, 0, 4, 0, 0, b.r * 0.62);
  core.addColorStop(0, "#eaf7ff");
  core.addColorStop(1, "#4d7dff");
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(0, 0, b.r * 0.6, 0, 6.29); ctx.fill();
  ctx.shadowBlur = 0;
  // furious eyes + jagged mouth
  ctx.fillStyle = "#0b2038";
  ctx.beginPath(); ctx.arc(-b.r * 0.24, -b.r * 0.1, b.r * 0.09, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.arc(b.r * 0.24, -b.r * 0.1, b.r * 0.09, 0, 6.29); ctx.fill();
  ctx.strokeStyle = "#0b2038"; ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const px = -b.r * 0.3 + i * b.r * 0.15;
    const py = b.r * 0.28 + (i % 2 === 0 ? 0 : b.r * 0.1);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  // crown spikes
  ctx.fillStyle = "#ffd166";
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 18 - 6, -b.r * 0.92); ctx.lineTo(i * 18, -b.r * 1.22); ctx.lineTo(i * 18 + 6, -b.r * 0.92);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawPickup(ctx, pk, time) {
  const bobY = Math.sin(time * 3.4 + pk.bob) * 3.5;
  ctx.save();
  ctx.translate(pk.x, pk.y + bobY);
  if (pk.life < 3 && Math.floor(time * 6) % 2 === 0) ctx.globalAlpha = 0.35;
  const meta = PICKUP_TYPES[pk.type];
  ctx.shadowColor = meta.color; ctx.shadowBlur = 16;
  ctx.fillStyle = "rgba(6,20,44,0.88)";
  ctx.beginPath(); ctx.arc(0, 0, pk.r + 2, 0, 6.29); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = meta.color; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(0, 0, pk.r + 2, 0, 6.29); ctx.stroke();
  // icons are drawn as shapes, never emoji — they must render everywhere
  if (pk.type === "star") {
    ctx.fillStyle = "#ffd166";
    ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * 6.283;
      const rr = i % 2 === 0 ? 9.5 : 4.2;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  } else if (pk.type === "chili") {
    ctx.fillStyle = "#ff5252";
    ctx.beginPath();
    ctx.moveTo(-3, -6);
    ctx.bezierCurveTo(7, -7, 10, 1, 4, 8);
    ctx.bezierCurveTo(0, 12, -6, 11, -8, 6);
    ctx.bezierCurveTo(-4, 4, -1, 0, -3, -6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#5ff2c8"; ctx.lineWidth = 2.6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-3, -6); ctx.quadraticCurveTo(-2, -10, 3, -11); ctx.stroke();
  } else { // cocoa mug
    ctx.fillStyle = "#ff9d5c";
    ctx.beginPath();
    ctx.moveTo(-7, -5); ctx.lineTo(6, -5); ctx.lineTo(5, 7); ctx.quadraticCurveTo(0, 9.5, -5, 7);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#ff9d5c"; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(8.5, 1, 3.6, -1.2, 1.2); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-3, -8); ctx.quadraticCurveTo(-1.5, -11, -3, -13.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2.5, -8); ctx.quadraticCurveTo(4, -11, 2.5, -13.5); ctx.stroke();
  }
  ctx.restore();
}
