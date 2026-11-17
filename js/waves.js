"use strict";
/* Wave director: 12 named, escalating blizzard waves, then endless scaling.
   Composition is a table, not a formula smear — every wave has an identity
   the banner can announce and the title can advertise. */
const WAVES = [
  { name: "FIRST FLURRIES",        comp: { chiller: 7 } },
  { name: "SPEEDERS ON ICE",       comp: { chiller: 6, speeder: 4 } },
  { name: "THE BRUTE ARRIVES",     comp: { chiller: 8, speeder: 3, brute: 1 } },
  { name: "SPLIT DECISION",        comp: { chiller: 7, splitter: 4, speeder: 4 } },
  { name: "GENERAL BLIZZARD",      comp: { chiller: 6, speeder: 4 }, boss: 1 },
  { name: "WHITEOUT RUSH",         comp: { speeder: 12, chiller: 6 } },
  { name: "DOUBLE BRUTE TROUBLE",  comp: { brute: 2, chiller: 10, splitter: 3 } },
  { name: "THE SWARM REMEMBERS",   comp: { chiller: 14, speeder: 8, splitter: 4 } },
  { name: "AVALANCHE PROTOCOL",    comp: { brute: 3, speeder: 10, chiller: 8 } },
  { name: "BLIZZARD, UNTHAWED",    comp: { chiller: 10, speeder: 6, splitter: 4 }, boss: 2 },
  { name: "TOTAL WHITEOUT",        comp: { chiller: 16, speeder: 12, splitter: 6, brute: 2 } },
  { name: "THE LAST FLURRY",       comp: { chiller: 18, speeder: 12, splitter: 6, brute: 4 } },
];

function waveComp(n) {
  if (n <= WAVES.length) return WAVES[n - 1];
  // Endless: keep scaling the final wave's recipe
  const extra = n - WAVES.length;
  return {
    name: "BLIZZARD ETERNAL " + extra,
    comp: {
      chiller: 18 + extra * 2, speeder: 12 + extra * 2,
      splitter: 6 + extra, brute: 4 + Math.floor(extra / 2),
    },
    boss: n % 5 === 0 ? 2 : 0,
  };
}

function waveHpScale(n) {
  return 1 + Math.max(0, n - 4) * 0.16;
}

function buildSpawnQueue(n, rng) {
  const def = waveComp(n);
  const queue = [];
  for (const type of Object.keys(def.comp)) {
    for (let i = 0; i < def.comp[type]; i++) queue.push(type);
  }
  // Fisher–Yates with the seeded rng: mixed order, reproducible
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const t = queue[i]; queue[i] = queue[j]; queue[j] = t;
  }
  return { queue, bossLevel: def.boss || 0, name: def.name, total: queue.length + (def.boss ? 1 : 0) };
}
