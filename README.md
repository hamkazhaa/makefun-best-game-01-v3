# Harbour Line — best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/hamkazhaa/makefun-best-game-01-v3/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/hamkazhaa/makefun-best-game-01-v3/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Built for the [make.fun "Make the best game" bounty](https://make.fun/bounty/best-game-01) ($1,000 in USDC).

A 4v4 round-based tactical FPS on the Port Meridian dock. Attackers push
down three lanes to plant the charge at Site A or Site B; defenders hold
the dock and defuse it. First to 7 rounds takes the harbour.

## What is in the game

- **The dock**: three lanes, two bomb sites, a fuel depot that blocks
  mid-lane, a container bridge to walk under, crates, containers and
  floodlight towers — all built from boxes, cylinders and planes.
- **The loop**: 15-second buy phase, 100-second rounds, plant (4 s) and
  defuse (5 s), detonation 35 seconds after the plant, first to 7.
- **The money**: $800 to start, $300 a round, $300 a kill, $300 a round
  win. The shop sells 7 guns — including the Kestrel DMR ($3,400, 55
  damage, 3× headshots, 2.2× zoom) — plus Kevlar and a flash utility.
- **The bots**: three teammates and four opponents who walk a waypoint
  graph (Dijkstra), take flanking routes a quarter of the time, fight
  with bursts and strafing, plant the charge and converge to defuse it.
- **The feel**: hitscan tracers, hit sparks, explosion shockwave rings,
  muzzle flashes, a full HUD (health, armour, ammo, money, timer, round
  pips, kill feed, live minimap) and fully synthesised WebAudio sounds —
  shots, reloads, beeps, the round-start horn and the blast.

## How to play

```
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Click **Deploy to
the dock**, click again to lock your aim.

- **WASD** move · **Mouse** aim · **Click** shoot · **R** reload
- **1–4** weapons · **B** buy · **E** plant at a site · **Space** jump
- **Ctrl** crouch · **Right mouse** zoom (DMR / sniper) · **M** mute

## How it is built

`game/` is static files only — no build step, no network. three.js
0.187.0 is vendored under `game/vendor/three/`; the game's own code is
in `game/src/` (one job per file: the map, the waypoints, the weapons,
the bots, the player, the rounds, the HUD, the effects, the sounds).
`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the kit's `vendor/makefun-game.ts`.

Screenshots are real renders of the game in headless Chromium, staged
with `?shot=start|buy|play|end`.
