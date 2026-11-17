# FLURRY FRENZY — Lofi's Snowball Siege

**A wave-survival snowball arena starring Lofi the Yeti, built for CLAY Hackathon III (mini-game track).**

Frost Gremlins are storming the Flurry village. Lofi has a Sui-blue scarf, a
strong throwing arm, and an unlimited supply of snow. Hold the village through
**12 named, escalating blizzard waves** — and pop the **General Blizzard**
himself at waves 5 and 10.

![Title screen](screenshots/01-title.png)

## Play it

Open `index.html` in any modern browser (or serve the folder statically —
no build step, no dependencies, no assets to download):

```bash
npx serve .        # or: python3 -m http.server
```

| Input | Action |
|---|---|
| WASD / Arrow keys | Move Lofi |
| Mouse | Aim |
| Hold Click / Space | Throw snowballs |
| P | Pause |
| M | Mute |

## What's inside

- **12 escalating waves + endless "Blizzard Eternal" scaling** — every wave
  is a named composition, not a formula: *Speeders on Ice*, *Split Decision*,
  *Avalanche Protocol*, *Total Whiteout*…
- **5 Frost Gremlin types** — Chillers, zig-zag Speeders, 9-HP Brutes,
  Splitters that burst into Minis, and the Minis themselves.
- **A boss with mechanics** — General Blizzard (waves 5 & 10) fires radial
  ice-shard bursts and summons reinforcements; full-width boss HP bar.
- **Combo system** — chained pops build a ×2–×9 score multiplier on a
  draining timer; the synth soundtrack pitches up as your chain climbs.
- **3 pickups** — Hot Cocoa (+1 HP), Chili (8 s of triple-rate rapid fire),
  and the Snowstar Bomb, which pops the entire screen in a staggered chain.
- **Juice everywhere** — hit-stop, trauma-based screen shake, hit flash,
  knockback, squash & stretch, particle bursts, snowball trails, floating
  score text, and ground decals that keep the scars of every fight on the
  arena floor.
- **Zero assets** — every sprite (Lofi included) is drawn procedurally on
  canvas, and every sound is synthesized with WebAudio. The whole game is
  a handful of text files.

## Screenshots

| | |
|---|---|
| ![Wave 3](screenshots/02-wave3-brute.png) | ![Boss fight](screenshots/03-wave5-boss.png) |
| Wave 3 — *The Brute Arrives* | Wave 5 — General Blizzard's shard bursts |
| ![Wave 8](screenshots/04-wave8-swarm.png) | |
| Wave 8 — *The Swarm Remembers*, combo ×3 running | |

## Tech

Vanilla JavaScript + Canvas 2D + WebAudio. No frameworks, no build step.

```
index.html          page shell
styles.css          page frame
js/rng.js           seeded RNG (mulberry32) — demo mode is reproducible
js/audio.js         WebAudio synth SFX with a combo pitch ladder
js/particles.js     particles, floating text, permanence decals
js/entities.js      Lofi, 5 gremlin types, the boss, pickups (all procedural art)
js/waves.js         the 12-wave escalation table + endless scaling
js/game.js          engine: loop, combat, juice, HUD, screens, demo AI
```

**Demo / attract mode:** open `index.html?demo=1&wave=5` and a built-in AI
plays Lofi by itself — handy for recording the demo video. `&stage=1`
pre-populates the arena so the first frame is already mid-battle, and
`&seed=N` makes a run reproducible.

## Credits

Built for **CLAY Hackathon III** by Lofi the Yeti / Lofi Foundation on Sui
Network. Lofi character © Lofi Foundation; this is a fan-made hackathon
mini-game.
