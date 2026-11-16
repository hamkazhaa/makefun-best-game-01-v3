// Short-lived combat feedback: tracers, sparks, shockwave rings and
// muzzle flashes. Everything here is created, animated in tick() and
// disposed — nothing uses setInterval.

import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.sparks = [];
    this.rings = [];
    this.flashes = [];
  }

  tracer(from, to, colour = 0xffe9a8) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({
      color: colour, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09, max: 0.09 });
  }

  burst(point, colour = 0xffc46b, count = 14, speed = 6) {
    const positions = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      vels.push(new THREE.Vector3(Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s, Math.sin(a) * Math.cos(b) * s));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: colour, size: 0.09, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.sparks.push({ pts, vels, life: 0.5, max: 0.5 });
  }

  ring(point, colour = 0xff9a3c, maxRadius = 7) {
    const geo = new THREE.RingGeometry(0.85, 1, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: colour, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(point);
    mesh.position.y = Math.max(0.12, point.y);
    this.scene.add(mesh);
    this.rings.push({ mesh, life: 0.7, max: 0.7, maxRadius });
  }

  flash(point) {
    const light = new THREE.PointLight(0xffc46b, 14, 9, 2);
    light.position.copy(point);
    this.scene.add(light);
    this.flashes.push({ light, life: 0.07, max: 0.07 });
  }

  explosion(point) {
    this.ring(point, 0xffb347, 9);
    this.ring(new THREE.Vector3(point.x, point.y + 0.4, point.z), 0xffffff, 5);
    this.burst(point, 0xff8c1a, 40, 11);
    this.burst(new THREE.Vector3(point.x, point.y + 1, point.z), 0xffe9a8, 24, 7);
    this.flash(point);
  }

  tick(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, (t.life / t.max)) * 0.95;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      const pos = s.pts.geometry.attributes.position;
      for (let j = 0; j < s.vels.length; j++) {
        const v = s.vels[j];
        v.y -= 12 * dt;
        pos.array[j * 3] += v.x * dt;
        pos.array[j * 3 + 1] += v.y * dt;
        pos.array[j * 3 + 2] += v.z * dt;
        if (pos.array[j * 3 + 1] < 0.03) pos.array[j * 3 + 1] = 0.03;
      }
      pos.needsUpdate = true;
      s.pts.material.opacity = Math.max(0, s.life / s.max);
      if (s.life <= 0) {
        this.scene.remove(s.pts);
        s.pts.geometry.dispose();
        s.pts.material.dispose();
        this.sparks.splice(i, 1);
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const k = 1 - r.life / r.max;
      const s = 0.3 + k * r.maxRadius;
      r.mesh.scale.set(s, s, 1);
      r.mesh.material.opacity = Math.max(0, 0.9 * (1 - k));
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        this.rings.splice(i, 1);
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      f.light.intensity = Math.max(0, 14 * (f.life / f.max));
      if (f.life <= 0) {
        this.scene.remove(f.light);
        this.flashes.splice(i, 1);
      }
    }
  }

  clear() {
    for (const t of this.tracers) { this.scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); }
    for (const s of this.sparks) { this.scene.remove(s.pts); s.pts.geometry.dispose(); s.pts.material.dispose(); }
    for (const r of this.rings) { this.scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); }
    for (const f of this.flashes) this.scene.remove(f.light);
    this.tracers = [];
    this.sparks = [];
    this.rings = [];
    this.flashes = [];
  }
}
