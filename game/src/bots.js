// The seven bots: three teammates, four opponents. They walk the
// waypoint graph, fight what they can see, plant the charge and defuse
// it. Each bot is a small state machine with a think tick, not a script.

import * as THREE from 'three';
import { BOT, WEAPONS, MAP } from './config.js';
import { nearestNode, findPath, nodePos, collide } from './nav.js';
import {
  newArsenal, buyWeapon, currentDef, pullTrigger, castPellet, applyArmour,
} from './weapons.js';
import { mulberry32, pick, range, chance } from './rng.js';

const TEAM_COLOUR = { atk: 0x2dd4bf, def: 0xfb923c };
const TEAM_DARK = { atk: 0x0f766e, def: 0x9a3412 };

const _ray = new THREE.Raycaster();
const _toTarget = new THREE.Vector3();

function makeBody(team, name) {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: TEAM_COLOUR[team], roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1f242e, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), cloth);
  torso.position.y = 1.05;
  torso.castShadow = true;
  g.add(torso);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.4, 0.4), dark);
  vest.position.y = 1.12;
  g.add(vest);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
  head.position.y = 1.66;
  head.castShadow = true;
  g.add(head);
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.38),
    new THREE.MeshStandardMaterial({ color: TEAM_DARK[team], roughness: 0.7 }));
  helmet.position.y = 1.86;
  g.add(helmet);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.24), dark);
    leg.position.set(s * 0.16, 0.31, 0);
    g.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.2), cloth);
    arm.position.set(s * 0.4, 1.05, 0.08);
    arm.rotation.x = -0.7;
    g.add(arm);
  }
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.85), dark);
  gun.position.set(0.18, 1.28, 0.5);
  g.add(gun);
  g.userData.name = name;
  return { group: g, torso, head, gun };
}

export class Bot {
  constructor(scene, team, name, spawn) {
    this.scene = scene;
    this.team = team;
    this.name = name;
    this.spawn = spawn;
    this.rng = mulberry32((Math.random() * 1e9) | 0);
    const body = makeBody(team, name);
    this.group = body.group;
    this.torso = body.torso;
    this.head = body.head;
    this.gun = body.gun;
    this.torso.userData.owner = this;
    this.torso.userData.part = 'body';
    this.head.userData.owner = this;
    this.head.userData.part = 'head';
    scene.add(this.group);
    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.yaw = team === 'atk' ? -Math.PI / 2 : Math.PI / 2;
    this.hp = BOT.health;
    this.alive = true;
    this.arsenal = newArsenal();
    this.path = [];
    this.pathI = 0;
    this.goal = null;
    this.goalSite = null;
    this.flank = false;
    this.carrier = false;
    this.thinkT = Math.random() * BOT.thinkEvery;
    this.burstLeft = 0;
    this.burstPause = 0;
    this.strafeDir = 1;
    this.strafeT = 0;
    this.channel = null; // {kind:'plant'|'defuse', t, need, site}
    this.visibleEnemy = null;
    this.lastSeen = null;
    this.muzzle = new THREE.Vector3();
    this.deadT = 0;
  }

  reset(spawn, loadout) {
    this.pos.set(spawn.x, 0, spawn.z);
    this.yaw = this.team === 'atk' ? -Math.PI / 2 : Math.PI / 2;
    this.group.position.copy(this.pos);
    this.group.rotation.set(0, this.yaw, 0);
    this.group.visible = true;
    this.hp = BOT.health;
    this.alive = true;
    this.arsenal = newArsenal();
    if (loadout) buyWeapon(this.arsenal, loadout, 99999);
    this.arsenal.armour = 50;
    this.path = [];
    this.pathI = 0;
    this.goal = null;
    this.channel = null;
    this.burstLeft = 0;
    this.burstPause = 0;
    this.visibleEnemy = null;
    this.deadT = 0;
  }

  eyePos(out) {
    return out.set(this.pos.x, 1.5, this.pos.z);
  }

  muzzlePos(out) {
    const fx = Math.sin(this.yaw) * -1;
    const fz = Math.cos(this.yaw) * -1;
    return out.set(this.pos.x + fx * 0.7, 1.32, this.pos.z + fz * 0.7);
  }

  takeDamage(amount, part, attacker, ctx) {
    if (!this.alive) return;
    // `amount` already carries the headshot multiplier from the shooter.
    const res = applyArmour(amount, this.arsenal.armour);
    this.arsenal.armour = res.armourLeft;
    this.hp -= res.hp;
    if (attacker && attacker.isPlayer) ctx.onPlayerHit(this, part);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(ctx, attacker);
    }
  }

  die(ctx, attacker) {
    this.alive = false;
    this.deadT = 0;
    this.channel = null;
    this.group.rotation.z = Math.PI / 2;
    this.group.position.y = 0.25;
    ctx.onDeath(this, attacker);
  }

  setGoalSite(siteKey, flank) {
    this.goalSite = siteKey;
    this.flank = flank;
    const goalNode = siteKey === 'A' ? 'siteA' : 'siteB';
    const from = nearestNode(this.pos.x, this.pos.z);
    let path = findPath(from, goalNode);
    if (flank) {
      const far = siteKey === 'A' ? 'mSouth2' : 'mNorth2';
      const first = findPath(from, far);
      const second = findPath(far, goalNode);
      path = [...first, ...second];
    }
    this.path = path;
    this.pathI = 0;
  }

  setGoalNode(nodeId) {
    const from = nearestNode(this.pos.x, this.pos.z);
    this.path = findPath(from, nodeId);
    this.pathI = 0;
    this.goalSite = null;
  }

  _canSee(enemy, ctx) {
    const ep = enemy.eyePos ? enemy.eyePos(new THREE.Vector3()) : new THREE.Vector3(enemy.pos.x, 1.5, enemy.pos.z);
    const dx = ep.x - this.pos.x;
    const dz = ep.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > BOT.sightRange) return null;
    const angTo = Math.atan2(-dx, -dz);
    let diff = angTo - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > BOT.sightHalfAngle && dist > 6) return null;
    _toTarget.copy(ep);
    const origin = this.eyePos(new THREE.Vector3());
    const dir = _toTarget.clone().sub(origin).normalize();
    _ray.set(origin, dir);
    _ray.far = dist;
    const hits = _ray.intersectObjects(ctx.occluders, false);
    if (hits.length > 0) return null;
    return { enemy, dist, point: ep };
  }

  _shootAt(target, ctx, dt) {
    if (this.burstPause > 0) {
      this.burstPause -= dt;
      return;
    }
    if (this.burstLeft <= 0) {
      this.burstLeft = BOT.burstMin + Math.floor(this.rng() * (BOT.burstMax - BOT.burstMin));
      this.burstPause = 0.35 + this.rng() * 0.5;
      return;
    }
    const now = ctx.time;
    const pull = pullTrigger(this.arsenal, now, this.rng, 0.006);
    if (!pull) {
      if (this.arsenal.owned[this.arsenal.current].mag === 0) {
        this.arsenal.reloading = now + currentDef(this.arsenal).reload;
      }
      return;
    }
    this.burstLeft -= 1;
    const origin = this.muzzlePos(new THREE.Vector3());
    const tp = target.eyePos ? target.eyePos(new THREE.Vector3()) : new THREE.Vector3(target.pos.x, 1.4, target.pos.z);
    tp.y -= 0.25;
    const base = tp.clone().sub(origin).normalize();
    // Aim error grows with distance.
    const err = BOT.aimError * (1 + tp.distanceTo(origin) / 18);
    for (const off of pull.dirs) {
      const hit = castPellet(
        origin, base,
        off.yaw + (this.rng() - 0.5) * err * 2,
        off.pitch + (this.rng() - 0.5) * err * 2,
        pull.def.range, ctx.hitMeshes, ctx.occluders,
      );
      const end = hit ? hit.point : origin.clone().add(base.clone().multiplyScalar(pull.def.range));
      ctx.fx.tracer(origin, end, 0xffd27a);
      if (hit && hit.owner) {
        ctx.fx.burst(hit.point, 0xffc46b, 8, 4);
        if (hit.owner !== this) {
          const dmg = pull.def.damage * (hit.part === 'head' ? pull.def.headMult : 1);
          ctx.damage(hit.owner, dmg, hit.part, this);
        }
      } else if (hit) {
        ctx.fx.burst(hit.point, 0x9aa3b2, 6, 3);
      }
    }
    ctx.fx.flash(origin);
    ctx.sounds.shot(pull.def.pitch, pull.def.damage >= 50);
  }

  update(dt, ctx) {
    if (!this.alive) {
      this.deadT += dt;
      if (this.deadT > 6) this.group.visible = false;
      return;
    }
    // Finish reloads.
    if (this.arsenal.reloading > 0 && ctx.time >= this.arsenal.reloading) {
      // eslint-disable-next-line no-underscore-dangle
      const def = currentDef(this.arsenal);
      const slot = this.arsenal.owned[this.arsenal.current];
      const take = Math.min(def.mag - slot.mag, slot.reserve);
      slot.mag += take;
      slot.reserve -= take;
      this.arsenal.reloading = 0;
    }

    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = BOT.thinkEvery;
      this.visibleEnemy = null;
      for (const e of ctx.enemiesOf(this)) {
        if (!e.alive) continue;
        const seen = this._canSee(e, ctx);
        if (seen) { this.visibleEnemy = seen; break; }
      }
      if (this.visibleEnemy) this.lastSeen = this.visibleEnemy.enemy;
    }

    // Channel actions (plant / defuse) freeze the bot in place.
    if (this.channel) {
      this.channel.t += dt;
      if (this.channel.t >= this.channel.need) {
        const done = this.channel;
        this.channel = null;
        ctx.onChannelDone(this, done.kind, done.site);
      }
      return;
    }

    const fighting = !!this.visibleEnemy;
    if (fighting) {
      const t = this.visibleEnemy;
      const dx = t.point.x - this.pos.x;
      const dz = t.point.z - this.pos.z;
      this.yaw = Math.atan2(-dx, -dz);
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeDir = Math.random() < 0.5 ? -1 : 1;
        this.strafeT = 0.6 + Math.random() * 0.9;
      }
      const strafeX = Math.cos(this.yaw) * this.strafeDir * BOT.speed * 0.45;
      const strafeZ = -Math.sin(this.yaw) * this.strafeDir * BOT.speed * 0.45;
      const next = collide(
        this.pos.x + strafeX * dt, this.pos.z + strafeZ * dt,
        BOT.radius, ctx.colliders, MAP.halfWidth, MAP.halfDepth,
      );
      this.pos.x = next.x;
      this.pos.z = next.z;
      this._shootAt(t.enemy, ctx, dt);
    } else if (this.pathI < this.path.length) {
      const node = nodePos(this.path[this.pathI]);
      const dx = node.x - this.pos.x;
      const dz = node.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.7) {
        this.pathI += 1;
      } else {
        this.yaw = Math.atan2(-dx, -dz);
        const step = BOT.speed * dt;
        const nx = this.pos.x + (dx / dist) * step;
        const nz = this.pos.z + (dz / dist) * step;
        const next = collide(nx, nz, BOT.radius, ctx.colliders, MAP.halfWidth, MAP.halfDepth);
        this.pos.x = next.x;
        this.pos.z = next.z;
      }
    } else if (this.goalSite && this.team === 'atk' && this.carrier && ctx.phase === 'play') {
      // At the site with the charge: start planting.
      const site = ctx.sites[this.goalSite];
      const d = Math.hypot(site.x - this.pos.x, site.z - this.pos.z);
      if (d <= site.radius) {
        this.channel = { kind: 'plant', t: 0, need: MAP.plantSeconds, site: this.goalSite };
        ctx.sounds.plantBeep();
      }
    } else if (this.team === 'def' && ctx.plantedSite) {
      // Converge on the planted site and defuse.
      const site = ctx.sites[ctx.plantedSite];
      const d = Math.hypot(site.x - this.pos.x, site.z - this.pos.z);
      if (d <= site.radius) {
        this.channel = { kind: 'defuse', t: 0, need: MAP.defuseSeconds, site: ctx.plantedSite };
        ctx.sounds.defuseBeep();
      } else if (this.pathI >= this.path.length) {
        this.setGoalSite(ctx.plantedSite, false);
      }
    }

    // Walk bob.
    const moving = this.pathI < this.path.length && !fighting;
    this.group.position.set(this.pos.x, moving ? Math.abs(Math.sin(ctx.time * 9)) * 0.05 : 0, this.pos.z);
    this.group.rotation.y = this.yaw;
    // Face the group forward: models face -z when yaw is 0 in our scheme.
    this.group.rotation.y = this.yaw + Math.PI;
  }
}

export function botLoadout(rng) {
  const roll = rng();
  if (roll < 0.35) return 'ak47';
  if (roll < 0.6) return 'm4a1';
  if (roll < 0.8) return 'mp9';
  if (roll < 0.92) return 'nova';
  return 'kestrel';
}
