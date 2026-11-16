// Hitscan weapons: the numbers, the spread, the raycast that decides
// what a bullet hits, and the armour rule. No projectiles fly; the shot
// is a ray the moment the trigger is pulled.

import * as THREE from 'three';
import { WEAPONS } from './config.js';

export function weaponDef(id) {
  return WEAPONS[id];
}

export function newArsenal() {
  return {
    owned: { p2000: { mag: WEAPONS.p2000.mag, reserve: WEAPONS.p2000.reserve } },
    current: 'p2000',
    reloading: 0,
    lastShot: -10,
    armour: 0,
    flashes: 0,
  };
}

export function buyWeapon(arsenal, id, money) {
  const def = WEAPONS[id];
  if (!def || money < def.price) return { ok: false, money };
  if (arsenal.owned[id]) {
    arsenal.owned[id] = { mag: def.mag, reserve: def.reserve };
  } else {
    arsenal.owned[id] = { mag: def.mag, reserve: def.reserve };
  }
  arsenal.current = id;
  return { ok: true, money: money - def.price };
}

export function currentDef(arsenal) {
  return WEAPONS[arsenal.current];
}

export function canFire(arsenal, now) {
  const def = currentDef(arsenal);
  if (arsenal.reloading > 0) return false;
  if (arsenal.owned[arsenal.current].mag <= 0) return false;
  return now - arsenal.lastShot >= def.interval;
}

export function startReload(arsenal, now) {
  const def = currentDef(arsenal);
  const slot = arsenal.owned[arsenal.current];
  if (arsenal.reloading > 0 || slot.mag >= def.mag || slot.reserve <= 0) return false;
  arsenal.reloading = now + def.reload;
  return true;
}

export function finishReload(arsenal) {
  const def = currentDef(arsenal);
  const slot = arsenal.owned[arsenal.current];
  const need = def.mag - slot.mag;
  const take = Math.min(need, slot.reserve);
  slot.mag += take;
  slot.reserve -= take;
  arsenal.reloading = 0;
}

export function ammoText(arsenal) {
  const slot = arsenal.owned[arsenal.current];
  return `${slot.mag} / ${slot.reserve}`;
}

// One trigger pull: returns the list of pellet directions (one for most
// guns, eight for the shotgun), already spread. Null when it cannot fire.
export function pullTrigger(arsenal, now, rng, moveSpread = 0) {
  if (!canFire(arsenal, now)) return null;
  const def = currentDef(arsenal);
  const slot = arsenal.owned[arsenal.current];
  slot.mag -= 1;
  arsenal.lastShot = now;
  const pellets = def.pellets ?? 1;
  const dirs = [];
  const spread = def.spread + moveSpread;
  for (let i = 0; i < pellets; i++) {
    const a = rng() * Math.PI * 2;
    const r = spread * Math.sqrt(rng());
    dirs.push({ yaw: Math.cos(a) * r, pitch: Math.sin(a) * r });
  }
  return { def, dirs };
}

// Apply armour: half the damage goes to armour first, the rest to health.
// Returns {hpDamage, armourDamage}.
export function applyArmour(damage, armour) {
  if (armour <= 0) return { hp: damage, armourLeft: 0 };
  const absorbed = Math.min(armour, damage * 0.5);
  return { hp: damage - absorbed, armourLeft: armour - absorbed };
}

const _ray = new THREE.Raycaster();
const _dir = new THREE.Vector3();

// Cast one pellet ray. `targets` are meshes with userData {owner, part}.
// Returns {owner, part, point, distance} on a hit, {point, distance,
// blocked:true} on a wall, or null when it flies free.
export function castPellet(origin, baseDir, yawOff, pitchOff, range, targets, occluders) {
  _dir.copy(baseDir);
  // Rotate the direction by the small yaw/pitch offsets.
  const cosY = Math.cos(yawOff);
  const sinY = Math.sin(yawOff);
  const x = _dir.x * cosY - _dir.z * sinY;
  const z = _dir.x * sinY + _dir.z * cosY;
  _dir.x = x;
  _dir.z = z;
  const cosP = Math.cos(pitchOff);
  const sinP = Math.sin(pitchOff);
  const y = _dir.y * cosP - _dir.z * sinP;
  _dir.z = _dir.y * sinP + _dir.z * cosP;
  _dir.y = y;
  _dir.normalize();
  _ray.set(origin, _dir);
  _ray.far = range;
  const hits = _ray.intersectObjects([...targets, ...occluders], false);
  if (hits.length === 0) return null;
  const first = hits[0];
  if (first.object.userData.owner) {
    return {
      owner: first.object.userData.owner,
      part: first.object.userData.part,
      point: first.point.clone(),
      distance: first.distance,
    };
  }
  return { point: first.point.clone(), distance: first.distance, blocked: true };
}
