// Deterministic staged scenes for the screenshots (?shot=start|buy|
// play|end). Each one poses the game — camera, bots, HUD — so a still
// frame shows the whole loop at a glance. Nothing here is a mock: the
// scene is the real game, posed.

import * as THREE from 'three';

export function applyShot(shot, game) {
  const { player, bots, rounds, hud, camera, fx } = game;
  const atkBots = bots.filter((b) => b.team === 'atk');
  const defBots = bots.filter((b) => b.team === 'def');

  if (shot === 'start') {
    // Menu over a cinematic view down mid-lane.
    rounds.phase = 'menu';
    hud.showMenu(true);
    camera.position.set(-19, 6.5, 13);
    camera.lookAt(4, 1, -3);
    camera.fov = 62;
    camera.updateProjectionMatrix();
    poseBots(atkBots, [[-8, -4], [-6, 2], [-4, -1]], Math.PI / 2);
    poseBots(defBots, [[4, -4], [7, 3], [10, -2]], -Math.PI / 2);
    game.staged = true;
    window.__shotReady = true;
    return;
  }

  if (shot === 'buy') {
    rounds.phase = 'buy';
    rounds.phaseT = 0;
    rounds.round = 3;
    rounds.score = { atk: 1, def: 1 };
    rounds.history = ['atk', 'def'];
    hud.showMenu(false);
    hud.setBuyOpen(true);
    player.pos.set(-21, 0, -2);
    player.yaw = -Math.PI / 2;
    player.pitch = 0;
    player.money = 4100;
    game.staged = true;
    window.__shotReady = true;
    return;
  }

  if (shot === 'play') {
    rounds.phase = 'play';
    rounds.phaseT = 12;
    rounds.round = 4;
    rounds.score = { atk: 2, def: 1 };
    rounds.history = ['atk', 'def', 'atk'];
    hud.showMenu(false);
    player.pos.set(-11, 0, 1.5);
    player.yaw = -Math.PI / 2;
    player.pitch = -0.03;
    player.hp = 78;
    player.money = 1900;
    player.kills = 3;
    poseBots(defBots, [[1, -3.5], [5, 2.5], [9, -5], [12, 4]], Math.PI / 2);
    poseBots(atkBots, [[-14, -3], [-15, 4], [-6, -6]], -Math.PI / 2);
    // Keep a hero tracer in the air while the shot is taken: re-drawn
    // every frame from a defender's muzzle toward the player.
    game.heroTracer = {
      until: game.time + 4,
      from: new THREE.Vector3(1, 1.35, -3.5),
      to: new THREE.Vector3(-10.4, 1.3, 1.2),
    };
    game.staged = true;
    window.__shotReady = true;
    return;
  }

  if (shot === 'end') {
    rounds.phase = 'matchEnd';
    rounds.score = { atk: 7, def: 4 };
    rounds.history = ['atk', 'def', 'atk', 'atk', 'def', 'atk', 'def', 'atk', 'def', 'atk', 'atk'];
    player.kills = 12;
    player.deaths = 3;
    hud.showMenu(false);
    hud.showMatchEnd(
      true,
      'MATCH WON — THE DOCK IS YOURS',
      '7 : 4',
      '12 eliminations · 3 deaths · $4,150 earned',
    );
    camera.position.set(-16, 4.5, 10);
    camera.lookAt(6, 1, -4);
    camera.fov = 62;
    camera.updateProjectionMatrix();
    poseBots(atkBots, [[-8, -4], [-6, 2], [-4, -1]], Math.PI / 2);
    poseBots(defBots, [[4, -4], [7, 3]], -Math.PI / 2);
    game.staged = true;
    window.__shotReady = true;
    return;
  }

  window.__shotReady = true;
}

function poseBots(list, spots, yaw) {
  list.forEach((b, i) => {
    const spot = spots[i % spots.length];
    b.pos.set(spot[0], 0, spot[1]);
    b.yaw = yaw;
    b.group.position.set(spot[0], 0, spot[1]);
    b.group.rotation.y = yaw + Math.PI;
    b.group.visible = true;
    b.alive = true;
    b.hp = 100;
  });
}

export function tickHeroTracer(game) {
  if (!game.heroTracer) return;
  if (game.time > game.heroTracer.until) {
    game.heroTracer = null;
    return;
  }
  game.fx.tracer(game.heroTracer.from, game.heroTracer.to, 0xffe9a8);
}
