"use strict";
/* Particle system + floating combat text + ground decals.
   Decals are the "permanence" layer: snow splats, ice shards and scorch rings
   stay on the arena floor and fade slowly, so every screenshot shows the
   evidence of a battle that just happened. */
class Particles {
  constructor(rng) {
    this.rng = rng;
    this.list = [];
    this.texts = [];
    this.decals = [];
    this.arcs = [];
    this.glowCache = {};
  }

  /* Cached radial-gradient glow sprite per colour — the canvas-cheap way
     to fake bloom (Naio Games' horde guide: "fake most lights — glowing
     sprites instead of real lights"). Replaces shadowBlur on particles. */
  glowSprite(color) {
    let s = this.glowCache[color];
    if (!s) {
      s = document.createElement("canvas");
      s.width = s.height = 64;
      const c = s.getContext("2d");
      const g = c.createRadialGradient(32, 32, 2, 32, 32, 32);
      g.addColorStop(0, color);
      g.addColorStop(0.25, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.globalAlpha = 0.5;
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
      this.glowCache[color] = s;
    }
    return s;
  }

  /* Jagged frost arc between two kill points (Geometry Wars energy,
     winter-skinned): chained kills crackle. */
  arc(x1, y1, x2, y2) {
    const pts = [{ x: x1, y: y1 }];
    const segs = 5;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len, ny = dx / len;
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const off = (this.rng.next() - 0.5) * len * 0.22;
      pts.push({ x: x1 + dx * t + nx * off, y: y1 + dy * t + ny * off });
    }
    pts.push({ x: x2, y: y2 });
    this.arcs.push({ pts, life: 0.18, maxLife: 0.18 });
    if (this.arcs.length > 24) this.arcs.shift();
  }

  burst(x, y, opts) {
    const o = Object.assign({
      n: 10, color: "#ffffff", speed: 190, life: 0.55, size: 3,
      gravity: 300, drag: 2.2, glow: false, spread: Math.PI * 2, dir: 0,
      shrink: true,
    }, opts || {});
    for (let i = 0; i < o.n; i++) {
      if (this.list.length > 2400) break;
      const a = o.dir + (this.rng.next() - 0.5) * o.spread;
      const sp = o.speed * this.rng.range(0.3, 1.05);
      const life = o.life * this.rng.range(0.6, 1.25);
      this.list.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life, maxLife: life,
        size: o.size * this.rng.range(0.6, 1.5),
        color: o.color, gravity: o.gravity, drag: o.drag,
        glow: o.glow, shrink: o.shrink, rot: this.rng.range(0, 6.28),
        vr: this.rng.range(-7, 7), shape: o.shape || "circle",
      });
    }
  }

  snowPop(x, y, color) {
    this.burst(x, y, { n: 30, color: color || "#eaf7ff", speed: 230, life: 0.6, size: 3.4, glow: true });
    this.burst(x, y, { n: 16, color: "#9fd8ff", speed: 130, life: 0.45, size: 2.2, shape: "shard" });
    this.decal(x, y, this.rng.range(10, 20), "splat");
    if (this.rng.chance(0.4)) this.decal(x + this.rng.range(-8, 8), y + this.rng.range(-6, 6), this.rng.range(7, 12), "pile");
  }

  explosion(x, y, big) {
    const s = big ? 1.8 : 1;
    this.burst(x, y, { n: Math.round(64 * s), color: "#ffffff", speed: 340 * s, life: 0.7, size: 4, glow: true });
    this.burst(x, y, { n: Math.round(38 * s), color: "#6fbdff", speed: 240 * s, life: 0.8, size: 3, shape: "shard" });
    this.burst(x, y, { n: Math.round(24 * s), color: "#ffd166", speed: 170 * s, life: 0.5, size: 3.4, glow: true });
    this.decal(x, y, 34 * s, "ring");
  }

  trailDot(x, y, color, size) {
    if (this.list.length > 2400) return;
    this.list.push({
      x, y, vx: 0, vy: 0, life: 0.28, maxLife: 0.28,
      size: size || 3, color: color || "#bfe6ff", gravity: 0, drag: 0,
      glow: true, shrink: true, rot: 0, vr: 0, shape: "circle",
    });
  }

  decal(x, y, r, kind, life) {
    this.decals.push({ x, y, r, kind, life: life || 26, maxLife: life || 26, rot: this.rng.range(0, 6.28) });
    if (this.decals.length > 260) this.decals.shift();
  }

  floatText(x, y, text, opts) {
    const o = Object.assign({ color: "#ffffff", size: 16, vy: -66 }, opts || {});
    this.texts.push({ x, y, text, color: o.color, size: o.size, vy: o.vy, life: 0.95, maxLife: 0.95 });
    if (this.texts.length > 60) this.texts.shift();
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt; t.y += t.vy * dt; t.vy *= (1 - 1.6 * dt);
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.life -= dt;
      if (d.life <= 0) this.decals.splice(i, 1);
    }
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      this.arcs[i].life -= dt;
      if (this.arcs[i].life <= 0) this.arcs.splice(i, 1);
    }
  }

  drawDecals(ctx) {
    for (const d of this.decals) {
      const a = Math.min(0.5, (d.life / d.maxLife) * 0.65);
      ctx.save();
      ctx.translate(d.x, d.y); ctx.rotate(d.rot); ctx.globalAlpha = a;
      if (d.kind === "ring") {
        ctx.strokeStyle = "#7fd0ff"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, d.r, 0, 6.29); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0, 0, d.r * 0.72, 0, 6.29); ctx.stroke();
      } else if (d.kind === "pile") {
        // a little heap of spent snowballs — the ammo tells the story
        ctx.fillStyle = "#eaf6ff";
        ctx.beginPath(); ctx.arc(-d.r * 0.45, d.r * 0.25, d.r * 0.55, 0, 6.29); ctx.fill();
        ctx.beginPath(); ctx.arc(d.r * 0.45, d.r * 0.25, d.r * 0.55, 0, 6.29); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -d.r * 0.3, d.r * 0.62, 0, 6.29); ctx.fill();
        ctx.fillStyle = "rgba(111,188,240,0.5)";
        ctx.beginPath(); ctx.arc(0, -d.r * 0.3, d.r * 0.3, 0, 6.29); ctx.fill();
      } else if (d.kind === "print") {
        ctx.fillStyle = "rgba(190,225,255,0.55)";
        ctx.beginPath(); ctx.ellipse(0, 0, d.r, d.r * 0.62, 0, 0, 6.29); ctx.fill();
      } else {
        ctx.fillStyle = "#cfeaff";
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * 6.28;
          ctx.beginPath();
          ctx.ellipse(Math.cos(ang) * d.r * 0.4, Math.sin(ang) * d.r * 0.3, d.r * 0.42, d.r * 0.26, ang, 0, 6.29);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const t = p.life / p.maxLife;
      const s = p.shrink ? p.size * (0.4 + 0.6 * t) : p.size;
      if (p.glow && s >= 2.2) {
        // fake bloom: cached glow sprite, additive — no shadowBlur cost
        const gs = s * 5.5;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(0.75, t * 1.1);
        ctx.drawImage(this.glowSprite(p.color), p.x - gs / 2, p.y - gs / 2, gs, gs);
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.6);
      ctx.fillStyle = p.color;
      if (p.shape === "shard") {
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.moveTo(-s, 0); ctx.lineTo(s * 1.6, s * 0.4); ctx.lineTo(-s * 0.4, s);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, 6.29); ctx.fill();
      }
      ctx.restore();
    }
    // frost arcs crackle on top, additive
    if (this.arcs.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      for (const a of this.arcs) {
        const al = Math.max(0, a.life / a.maxLife);
        ctx.globalAlpha = al * 0.75;
        ctx.strokeStyle = "#6fbcF0"; ctx.lineWidth = 3;
        ctx.beginPath();
        a.pts.forEach((pt, i) => { if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
        ctx.stroke();
        ctx.globalAlpha = al;
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawTexts(ctx) {
    ctx.save();
    ctx.textAlign = "center";
    for (const t of this.texts) {
      const k = t.life / t.maxLife;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = "800 " + t.size + "px 'Trebuchet MS', sans-serif";
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(4,16,38,0.85)";
      const pop = 1 + Math.max(0, k - 0.82) * 2.2;
      ctx.save();
      ctx.translate(t.x, t.y); ctx.scale(pop, pop);
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }
}
