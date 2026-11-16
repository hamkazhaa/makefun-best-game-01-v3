// Port Meridian: the dock itself. Ground, walls, cover, the fuel depot,
// the container bridge, floodlights and the two site markers. Everything
// is boxes, cylinders and planes with flat colours — no textures loaded
// from anywhere.

import * as THREE from 'three';
import { MAP, SITES, COVER, DEPOT } from './config.js';

const PALETTE = {
  concrete: 0x3d4450,
  concreteDark: 0x2c313b,
  asphalt: 0x232830,
  rust: 0xb4552d,
  teal: 0x1f8a7a,
  tealDark: 0x146055,
  ember: 0xd97b2b,
  amber: 0xffb347,
  steel: 0x6b7280,
  steelDark: 0x4a505c,
  hazard: 0xe8b93c,
  water: 0x0d2733,
  sky: 0x1a2436,
};

function box(w, h, d, colour, x, y, z, rough = 0.9) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: colour, roughness: rough, metalness: 0.08 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function letterTexture(letter, colour) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = colour;
  g.font = '900 84px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildDock(scene) {
  const occluders = [];
  const colliders = [];

  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.sky, 55, 130);

  const hemi = new THREE.HemisphereLight(0x9db8d9, 0x1c222c, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.7);
  sun.position.set(-30, 38, -18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -34;
  sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -26;
  sun.shadow.camera.far = 120;
  scene.add(sun);

  // The dock slab and the water around it.
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(MAP.halfWidth * 2 + 2, 1, MAP.halfDepth * 2 + 2),
    new THREE.MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.95 }),
  );
  ground.position.set(0, -0.5, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 320),
    new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.25, metalness: 0.4 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -1.1, 0);
  scene.add(water);

  // Painted lane guides on the slab.
  const laneMat = new THREE.MeshBasicMaterial({ color: 0x565e6c });
  for (const z of [-11, 0, 11]) {
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(MAP.halfWidth * 2, 0.35), laneMat);
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(0, 0.01, z);
    scene.add(lane);
  }

  // Perimeter walls.
  const wallMat = new THREE.MeshStandardMaterial({ color: PALETTE.concreteDark, roughness: 0.9 });
  const mkWall = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, MAP.wallHeight, d), wallMat);
    m.position.set(x, MAP.wallHeight / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    occluders.push(m);
  };
  mkWall(MAP.halfWidth * 2 + 2, 1, 0, -MAP.halfDepth - 0.5);
  mkWall(MAP.halfWidth * 2 + 2, 1, 0, MAP.halfDepth + 0.5);
  mkWall(1, MAP.halfDepth * 2 + 2, -MAP.halfWidth - 0.5, 0);
  mkWall(1, MAP.halfDepth * 2 + 2, MAP.halfWidth + 0.5, 0);

  // Cover: containers and crates from the config.
  for (const c of COVER) {
    const colour = c.kind === 'container' ? PALETTE.rust : 0x7a6a4f;
    const m = box(c.w, c.h, c.d, colour, c.x, c.h / 2, c.z);
    scene.add(m);
    occluders.push(m);
    colliders.push({ x: c.x, z: c.z, hw: c.w / 2, hd: c.d / 2 });
    if (c.kind === 'container') {
      const stripe = box(c.w + 0.04, 0.18, c.d + 0.04, PALETTE.hazard, c.x, c.h - 0.25, c.z);
      scene.add(stripe);
    }
  }

  // The fuel depot: three glowing barrels, a hazard ring and amber lamps.
  const depotGroup = new THREE.Group();
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x8a2f1d, roughness: 0.6, metalness: 0.3,
    emissive: 0x531505, emissiveIntensity: 0.6,
  });
  for (const [bx, bz] of [[-1.1, -0.7], [1.1, -0.7], [0, 1.1]]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 2.1, 18), barrelMat);
    barrel.position.set(DEPOT.x + bx, 1.05, DEPOT.z + bz);
    barrel.castShadow = true;
    depotGroup.add(barrel);
  }
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(DEPOT.radius - 0.35, DEPOT.radius, 48),
    new THREE.MeshBasicMaterial({ color: PALETTE.hazard, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(DEPOT.x, 0.02, DEPOT.z);
  depotGroup.add(ring);
  const lampMat = new THREE.MeshStandardMaterial({
    color: PALETTE.amber, emissive: PALETTE.amber, emissiveIntensity: 2.2,
  });
  for (const a of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.steelDark }));
    post.position.set(DEPOT.x + Math.cos(a) * 2.6, 1.7, DEPOT.z + Math.sin(a) * 2.6);
    depotGroup.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), lampMat);
    lamp.position.set(DEPOT.x + Math.cos(a) * 2.6, 3.5, DEPOT.z + Math.sin(a) * 2.6);
    depotGroup.add(lamp);
    const glow = new THREE.PointLight(PALETTE.amber, 6, 10, 2);
    glow.position.set(DEPOT.x + Math.cos(a) * 2.6, 3.4, DEPOT.z + Math.sin(a) * 2.6);
    depotGroup.add(glow);
  }
  scene.add(depotGroup);
  colliders.push({ x: DEPOT.x, z: DEPOT.z, hw: 2.1, hd: 2.1 });

  // The container bridge over mid-lane: walk under it, not through it.
  const bridge = new THREE.Group();
  const deck = box(3.2, 0.9, 9, PALETTE.tealDark, 0, 4.6, 0);
  bridge.add(deck);
  const deckTop = box(3.4, 0.15, 9.2, PALETTE.teal, 0, 5.1, 0);
  bridge.add(deckTop);
  for (const z of [-4, 4]) {
    const leg = box(0.5, 4.2, 0.5, PALETTE.steelDark, 0, 2.1, z);
    bridge.add(leg);
  }
  for (const x of [-1.4, 1.4]) {
    const rail = box(0.12, 0.9, 9, PALETTE.steel, x, 5.6, 0);
    bridge.add(rail);
  }
  scene.add(bridge);
  occluders.push(deck);
  colliders.push({ x: 0, z: -4, hw: 0.5, hd: 0.5 });
  colliders.push({ x: 0, z: 4, hw: 0.5, hd: 0.5 });

  // Floodlight towers at the four corners.
  for (const [tx, tz] of [[-24, -16], [-24, 16], [24, -16], [24, 16]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 7, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.steelDark }));
    pole.position.set(tx, 3.5, tz);
    pole.castShadow = true;
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.5),
      new THREE.MeshStandardMaterial({ color: PALETTE.steel, emissive: 0xdfeaff, emissiveIntensity: 0.7 }));
    head.position.set(tx, 7.1, tz);
    head.lookAt(0, 0, 0);
    scene.add(head);
    const spot = new THREE.SpotLight(0xdfeaff, 60, 45, 0.7, 0.5, 1.6);
    spot.position.set(tx, 7, tz);
    spot.target.position.set(tx > 0 ? 12 : -12, 0, tz > 0 ? 8 : -8);
    scene.add(spot);
    scene.add(spot.target);
  }

  // Site markers: painted rings plus floating letters.
  const markers = {};
  for (const [key, s] of Object.entries(SITES)) {
    const decal = new THREE.Mesh(
      new THREE.RingGeometry(s.radius - 0.3, s.radius, 40),
      new THREE.MeshBasicMaterial({ color: key === 'A' ? PALETTE.teal : PALETTE.ember, side: THREE.DoubleSide }),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(s.x, 0.02, s.z);
    scene.add(decal);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: letterTexture(key, key === 'A' ? '#2dd4bf' : '#fb923c'),
      transparent: true, depthWrite: false,
    }));
    sprite.scale.set(3.4, 3.4, 1);
    sprite.position.set(s.x, 4.4, s.z);
    scene.add(sprite);
    markers[key] = { x: s.x, z: s.z, radius: s.radius, sprite };
  }

  return { occluders, colliders, markers };
}
