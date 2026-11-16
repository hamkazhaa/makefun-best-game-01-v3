// The human player: a first-person camera with a viewmodel gun, WASD
// movement, pointer-lock mouse look, and the same arsenal the bots use.

import * as THREE from 'three';
import { PLAYER, MAP, WEAPONS } from './config.js';
import {
  newArsenal, buyWeapon, currentDef, pullTrigger, castPellet, applyArmour,
  startReload, finishReload,
} from './weapons.js';
import { collide } from './nav.js';
import { mulberry32 } from './rng.js';

export class Player {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.isPlayer = true;
    this.rng = mulberry32((Math.random() * 1e9) | 0);
    this.pos = new THREE.Vector3(-23, 0, 0);
    this.velY = 0;
    this.yaw = -Math.PI / 2;
    this.pitch = 0;
    this.hp = PLAYER.health;
    this.alive = true;
    this.arsenal = newArsenal();
    this.money = 800;
    this.kills = 0;
    this.deaths = 0;
    this.keys = {};
    this.locked = false;
    this.firing = false;
    this.crouching = false;
    this.onGround = true;
    this.recoil = 0;
    this.zoomed = false;
    this.carrier = true;
    this.plantT = 0;
    this.stepT = 0;
    this.spectating = null;

    // Viewmodel: a simple gun made of boxes, parented to the camera.
    this.viewmodel = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x1f242e, roughness: 0.6, metalness: 0.4 });
    const mid = new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.5, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.55), dark);
    this.viewmodel.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), mid);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.4);
    this.viewmodel.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.1), dark);
    grip.position.set(0, -0.13, 0.12);
    grip.rotation.x = 0.3;
    this.viewmodel.add(grip);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.08), mid);
    sight.position.set(0, 0.09, -0.1);
    this.viewmodel.add(sight);
    this.viewmodel.position.set(0.3, -0.28, -0.55);
    this.viewmodel.scale.setScalar(0.68);
    this.camera.add(this.viewmodel);
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.02, -0.55);
    this.viewmodel.add(this.muzzle);
  }

  reset(spawn, money) {
    this.pos.set(spawn.x, 0, spawn.z);
    this.yaw = -Math.PI / 2;
    this.pitch = 0;
    this.velY = 0;
    this.hp = PLAYER.health;
    this.alive = true;
    this.money = money;
    this.arsenal = newArsenal();
    this.carrier = true;
    this.plantT = 0;
    this.recoil = 0;
    this.zoomed = false;
    this.spectating = null;
    this.viewmodel.visible = true;
  }

  eyePos(out) {
    const h = this.crouching ? PLAYER.crouchHeight : PLAYER.eyeHeight;
    return out.set(this.pos.x, h, this.pos.z);
  }

  lookDir(out) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  takeDamage(amount, part, attacker, ctx) {
    if (!this.alive) return;
    const res = applyArmour(amount, this.arsenal.armour);
    this.arsenal.armour = res.armourLeft;
    this.hp -= res.hp;
    ctx.sounds.hurt();
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.deaths += 1;
      this.viewmodel.visible = false;
      ctx.onDeath(this, attacker);
    }
  }

  buy(id, ctx) {
    const price = id === 'armour' ? 650 : id === 'flash' ? 200 : null;
    if (id === 'armour') {
      if (this.money < 650 || this.arsenal.armour >= 100) { ctx.sounds.denied(); return false; }
      this.money -= 650;
      this.arsenal.armour = 100;
      ctx.sounds.buyClick();
      return true;
    }
    if (id === 'flash') {
      if (this.money < 200) { ctx.sounds.denied(); return false; }
      this.money -= 200;
      this.arsenal.flashes += 1;
      ctx.sounds.buyClick();
      return true;
    }
    const res = buyWeapon(this.arsenal, id, this.money);
    if (res.ok) {
      this.money = res.money;
      ctx.sounds.buyClick();
      return true;
    }
    ctx.sounds.denied();
    return false;
  }

  selectSlot(n) {
    const ids = Object.keys(this.arsenal.owned);
    const wanted = ids.find((id) => WEAPONS[id].slot === n);
    if (wanted && this.arsenal.reloading <= 0) this.arsenal.current = wanted;
  }

  update(dt, ctx) {
    if (!this.alive) return;
    const now = ctx.time;

    // Reload finishing.
    if (this.arsenal.reloading > 0 && now >= this.arsenal.reloading) {
      finishReload(this.arsenal);
    }

    // Movement.
    const speed = this.crouching ? PLAYER.crouchSpeed : PLAYER.walkSpeed;
    let fx = 0;
    let fz = 0;
    if (this.keys['KeyW']) fz -= 1;
    if (this.keys['KeyS']) fz += 1;
    if (this.keys['KeyA']) fx -= 1;
    if (this.keys['KeyD']) fx += 1;
    const len = Math.hypot(fx, fz);
    if (len > 0) {
      fx /= len;
      fz /= len;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      // Forward on the ground is (-sin, -cos); right is (cos, -sin).
      const mx = -sin * -fz + cos * fx;
      const mz = -cos * -fz + -sin * fx;
      const nx = this.pos.x + mx * speed * dt;
      const nz = this.pos.z + mz * speed * dt;
      const next = collide(nx, nz, PLAYER.radius, ctx.colliders, MAP.halfWidth, MAP.halfDepth);
      this.pos.x = next.x;
      this.pos.z = next.z;
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 0.42;
        ctx.sounds.step();
      }
    }

    // Jump / gravity.
    if (this.keys['Space'] && this.onGround) {
      this.velY = PLAYER.jumpSpeed;
      this.onGround = false;
    }
    this.velY -= PLAYER.gravity * dt;
    this.pos.y += this.velY * dt;
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.velY = 0;
      this.onGround = true;
    }

    // Crouch.
    this.crouching = !!this.keys['ControlLeft'] || !!this.keys['KeyC'];

    // Zoom.
    const def = currentDef(this.arsenal);
    this.zoomed = this.keys['MouseRight'] && def.zoom > 1;
    this.camera.fov = this.zoomed ? 75 / def.zoom : 75;
    this.camera.updateProjectionMatrix();

    // Recoil recovery.
    this.recoil = Math.max(0, this.recoil - dt * 6);

    // Firing.
    if (this.firing && this.locked) {
      const moveSpread = len > 0 ? 0.008 : 0;
      const pull = pullTrigger(this.arsenal, now, this.rng, moveSpread);
      if (pull) {
        this.recoil = Math.min(0.09, this.recoil + 0.02);
        // The bullet flies from the eye, straight down the aim line:
        // the viewmodel muzzle sits to the side of the camera, so a ray
        // from it would fly parallel to the aim and miss dead-centre.
        const eye = this.eyePos(new THREE.Vector3());
        const muzzlePos = new THREE.Vector3();
        this.muzzle.getWorldPosition(muzzlePos);
        const base = this.lookDir(new THREE.Vector3());
        for (const off of pull.dirs) {
          const hit = castPellet(
            eye, base, off.yaw, off.pitch,
            pull.def.range, ctx.hitMeshes, ctx.occluders,
          );
          const end = hit ? hit.point : eye.clone().add(base.clone().multiplyScalar(pull.def.range));
          ctx.fx.tracer(muzzlePos, end, 0xffe9a8);
          if (hit && hit.owner) {
            ctx.fx.burst(hit.point, 0xffc46b, 10, 5);
            const dmg = pull.def.damage * (hit.part === 'head' ? pull.def.headMult : 1);
            ctx.damage(hit.owner, dmg, hit.part, this);
            ctx.sounds.hit();
            if (!hit.owner.alive) {
              this.kills += 1;
              this.money += 300;
              ctx.sounds.kill();
            }
          } else if (hit) {
            ctx.fx.burst(hit.point, 0x9aa3b2, 6, 3);
          }
        }
        ctx.fx.flash(muzzlePos);
        ctx.sounds.shot(pull.def.pitch, pull.def.damage >= 50);
        if (!pull.def.auto) this.firing = false;
      } else if (this.arsenal.owned[this.arsenal.current].mag === 0) {
        ctx.sounds.dryClick();
        this.firing = false;
      }
    }

    // Planting: hold E near a site while carrying the charge.
    if (this.keys['KeyE'] && this.carrier && ctx.phase === 'play' && !ctx.plantedSite) {
      const site = ctx.nearestSite(this.pos.x, this.pos.z);
      if (site) {
        this.plantT += dt;
        if (this.plantT >= MAP.plantSeconds) {
          this.plantT = 0;
          this.carrier = false;
          ctx.onChannelDone(this, 'plant', site.key);
        }
      } else {
        this.plantT = 0;
      }
    } else {
      this.plantT = 0;
    }

    // Apply camera transform.
    this.camera.position.set(this.pos.x, this.pos.y + (this.crouching ? PLAYER.crouchHeight : PLAYER.eyeHeight), this.pos.z);
    this.camera.rotation.set(this.pitch + this.recoil, this.yaw, 0, 'YXZ');
  }
}
