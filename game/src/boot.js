// Harbour Line's entry point: the renderer, the world, the loop, and
// the glue between the player, the bots, the rounds and the HUD.

import * as THREE from 'three';
import { MAP, SITES, SPAWNS, BOT_NAMES } from './config.js';
import { buildDock } from './map.js';
import { Bot, botLoadout } from './bots.js';
import { Player } from './player.js';
import { Rounds } from './rounds.js';
import { Hud } from './hud.js';
import { Effects } from './fx.js';
import { SoundBank } from './audio.js';
import { applyShot, tickHeroTracer } from './stage.js';
import { mulberry32 } from './rng.js';
import { startReload } from './weapons.js';

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot');

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 220);
camera.position.set(-19, 6.5, 13);
camera.lookAt(4, 1, -3);
scene.add(camera);

const dock = buildDock(scene);
const fx = new Effects(scene);
const sounds = new SoundBank();
const hud = new Hud();
const rounds = new Rounds();
const rng = mulberry32(20261117);

const player = new Player(scene, camera);
const bots = [];
BOT_NAMES.atk.forEach((name, i) => bots.push(new Bot(scene, 'atk', name, SPAWNS.atk[i + 1])));
BOT_NAMES.def.forEach((name, i) => bots.push(new Bot(scene, 'def', name, SPAWNS.def[i])));

// Invisible hit proxies for the player: bots shoot at these, not at
// the camera. They render nothing (opacity 0) but still raycast.
const proxyMat = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0, depthWrite: false, colorWrite: false,
});
const playerBodyProxy = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.05, 0.5), proxyMat);
const playerHeadProxy = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.36, 0.4), proxyMat);
playerBodyProxy.userData.owner = player;
playerBodyProxy.userData.part = 'body';
playerHeadProxy.userData.owner = player;
playerHeadProxy.userData.part = 'head';
scene.add(playerBodyProxy);
scene.add(playerHeadProxy);

function hitMeshes() {
  const list = [];
  for (const b of bots) {
    if (!b.alive) continue;
    list.push(b.torso, b.head);
  }
  if (player.alive && rounds.phase === 'play') {
    list.push(playerBodyProxy, playerHeadProxy);
  }
  return list;
}

const game = {
  scene, camera, renderer, player, bots, rounds, hud, fx, sounds,
  time: 0, staged: false, heroTracer: null,
};

function aliveCount(team) {
  let n = 0;
  for (const b of bots) if (b.team === team && b.alive) n += 1;
  if (team === 'atk' && player.alive) n += 1;
  return n;
}

function enemiesOf(bot) {
  if (rounds.phase !== 'play') return [];
  const list = [];
  for (const b of bots) {
    if (b.team !== bot.team && b.alive) list.push(b);
  }
  if (bot.team === 'def' && player.alive) list.push(player);
  return list;
}

function nearestSite(x, z) {
  for (const [key, s] of Object.entries(SITES)) {
    if (Math.hypot(s.x - x, s.z - z) <= s.radius) return { key, ...s };
  }
  return null;
}

const ctx = {
  time: 0,
  fx, sounds,
  occluders: dock.occluders,
  colliders: dock.colliders,
  sites: SITES,
  get phase() { return rounds.phase; },
  get plantedSite() { return rounds.plantedSite; },
  get hitMeshes() { return hitMeshes(); },
  enemiesOf,
  aliveCount,
  nearestSite,
  damage(owner, amount, part, attacker) {
    if (!owner || !owner.alive) return;
    if (game.staged && owner.isPlayer) return; // staged shots never kill the player
    owner.takeDamage(amount, part, attacker, ctx);
  },
  onPlayerHit() { /* the hurt sound already plays in takeDamage */ },
  onDeath(who, attacker) {
    const killer = attacker ? attacker.name || 'You' : 'The dock';
    const victim = who.isPlayer ? 'You' : who.name;
    hud.feed(`${killer}  ✕  ${victim}`, attacker === player);
    if (who.isPlayer) {
      document.exitPointerLock();
      hud.banner('YOU ARE DOWN', 'Spectating a teammate — next round in a moment', 2400);
    }
  },
  onChannelDone(who, kind, site) {
    if (kind === 'plant') {
      rounds.plant(site, ctx);
    } else if (kind === 'defuse') {
      rounds.defused(ctx);
    }
  },
  onPlanted(site) {
    hud.banner('CHARGE PLANTED', `Site ${site} — defenders must defuse it`, 3200);
    hud.feed(`Charge planted at site ${site}`, false);
  },
  onPhase(phase) {
    if (phase === 'buy') resetRound();
    hud.setBuyOpen(false);
  },
  onRoundEnd(winner, reason) {
    const won = winner === 'atk';
    hud.banner(won ? 'ATTACKERS TAKE THE ROUND' : 'DEFENDERS HOLD THE DOCK', reason, 3000);
    hud.feed(`${won ? 'Attackers' : 'Defenders'} win round ${rounds.round} — ${reason}`, won);
    if (player.alive) {
      player.money += MAP.roundMoney + (won ? MAP.winMoney : 0);
    }
  },
  onMatchEnd(winner) {
    const won = winner === 'atk';
    document.exitPointerLock();
    hud.setBuyOpen(false);
    hud.showMatchEnd(
      true,
      won ? 'MATCH WON — THE DOCK IS YOURS' : 'MATCH LOST — THE DOCK HOLDS',
      `${rounds.score.atk} : ${rounds.score.def}`,
      `${player.kills} eliminations · ${player.deaths} deaths · $${player.money} in hand`,
    );
  },
};

function resetRound() {
  fx.clear();
  player.reset(SPAWNS.atk[0], player.money);
  player.money = Math.max(player.money, MAP.startMoney);
  bots.forEach((b, i) => {
    const spawn = b.team === 'atk' ? SPAWNS.atk[i + 1] : SPAWNS.def[i % 4];
    b.reset(spawn, botLoadout(rng));
  });
  // Attackers pick a site; a quarter of them flank down the far lane.
  const atkBots = bots.filter((b) => b.team === 'atk');
  atkBots.forEach((b, i) => {
    const site = i % 2 === 0 ? 'A' : 'B';
    b.setGoalSite(site, rng() < 0.25);
  });
  // One attacker carries the charge.
  atkBots.forEach((b) => { b.carrier = false; });
  atkBots[0].carrier = true;
  player.carrier = true;
  // Defenders hold a site each.
  bots.filter((b) => b.team === 'def').forEach((b, i) => {
    b.setGoalNode(i % 2 === 0 ? 'siteA' : 'siteB');
  });
}

function startMatch() {
  sounds.unlock();
  hud.showMenu(false);
  hud.showMatchEnd(false);
  player.kills = 0;
  player.deaths = 0;
  player.money = MAP.startMoney;
  rounds.startMatch(ctx);
  canvas.requestPointerLock();
}

hud.onStart = startMatch;
hud.onPlayAgain = () => {
  hud.showMatchEnd(false);
  startMatch();
};
hud.onBuy = (id) => {
  if (player.buy(id, ctx)) hud.renderShop();
};

// ---- input ----------------------------------------------------------

window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
  player.keys[e.code] = true;
  if (e.code === 'KeyB' && rounds.phase === 'buy') hud.setBuyOpen(!hud.buyOpen);
  if (e.code === 'KeyR' && rounds.phase === 'play') {
    if (player.arsenal.reloading <= 0) {
      const ok = startReload(player.arsenal, ctx.time);
      if (ok) sounds.reload();
    }
  }
  if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= 4) player.selectSlot(n);
  }
  if (e.code === 'KeyM') sounds.muted = !sounds.muted;
});

window.addEventListener('keyup', (e) => {
  player.keys[e.code] = false;
});

document.addEventListener('mousemove', (e) => {
  if (!player.locked || game.staged) return;
  player.yaw -= e.movementX * 0.0021;
  player.pitch -= e.movementY * 0.0021;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch));
});

document.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    if (rounds.phase === 'buy' || rounds.phase === 'play') {
      if (!player.locked && !game.staged) {
        sounds.unlock();
        canvas.requestPointerLock();
      } else {
        player.firing = true;
      }
    }
  }
  if (e.button === 2) player.keys.MouseRight = true;
});

document.addEventListener('mouseup', (e) => {
  if (e.button === 0) player.firing = false;
  if (e.button === 2) player.keys.MouseRight = false;
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('pointerlockchange', () => {
  player.locked = document.pointerLockElement === canvas;
  if (!player.locked) player.firing = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- the loop -------------------------------------------------------

const clock = new THREE.Clock();
let firstFrame = true;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  game.time += dt;
  ctx.time = game.time;

  if (firstFrame) {
    firstFrame = false;
    if (SHOT) {
      applyShot(SHOT, game);
    } else {
      window.__ready = true;
    }
  }

  if (!game.staged) {
    if (rounds.phase === 'menu') {
      // Slow orbit behind the title screen.
      const t = game.time * 0.05;
      camera.position.set(Math.sin(t) * 20 - 4, 7, Math.cos(t) * 16);
      camera.lookAt(0, 1, 0);
    } else if (rounds.phase === 'matchEnd') {
      // Hold the last view.
    } else {
      rounds.tick(dt, ctx);
      if (rounds.phase === 'play' || rounds.phase === 'buy' || rounds.phase === 'roundEnd') {
        if (player.alive) {
          player.update(dt, ctx);
        } else if (rounds.phase === 'play') {
          // Spectate a living teammate.
          const mate = bots.find((b) => b.team === 'atk' && b.alive);
          if (mate) {
            const bx = mate.pos.x + Math.sin(mate.yaw) * 3.4;
            const bz = mate.pos.z + Math.cos(mate.yaw) * 3.4;
            camera.position.set(bx, 3.2, bz);
            camera.lookAt(mate.pos.x, 1.4, mate.pos.z);
          }
        }
        for (const b of bots) b.update(dt, ctx);
      }
    }
  } else {
    // Staged: the world still breathes — bots fight, effects animate —
    // but the camera stays posed and the player cannot die.
    if (SHOT === 'play') {
      for (const b of bots) b.update(dt, ctx);
      tickHeroTracer(game);
    }
    if (SHOT === 'start' || SHOT === 'end') {
      for (const b of bots) {
        if (b.alive) {
          b.group.position.y = Math.abs(Math.sin(game.time * 1.5 + b.pos.x)) * 0.03;
        }
      }
    }
  }

  // Keep the player's hit proxies glued to the camera.
  playerBodyProxy.position.set(player.pos.x, 0.95, player.pos.z);
  playerHeadProxy.position.set(player.pos.x, 1.62, player.pos.z);

  fx.tick(dt);

  // HUD.
  hud.update({
    hp: player.hp,
    armour: player.arsenal.armour,
    ammo: player.arsenal ? `${player.arsenal.owned[player.arsenal.current].mag} / ${player.arsenal.owned[player.arsenal.current].reserve}` : '—',
    money: player.money,
    timeLeft: rounds.timeLeft,
    score: rounds.score,
    history: rounds.history,
    frags: player.kills,
    round: rounds.round,
    phase: rounds.phase,
    planted: rounds.plantedSite,
    carrier: player.carrier,
    deaths: player.deaths,
    alive: player.alive,
  });
  const plantProgress = player.plantT > 0 ? player.plantT / MAP.plantSeconds : null;
  hud.setPlant(plantProgress, plantProgress != null ? 'PLANTING THE CHARGE…' : '');
  hud.drawMinimap(player, bots, rounds.plantedSite);

  renderer.render(scene, camera);
}

window.__game = game;
frame();
