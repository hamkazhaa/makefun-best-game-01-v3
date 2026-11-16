// Harbour Line — shared tuning numbers. Every value here is a design
// decision, not a copy: the dock, the lanes, the guns and the money.

export const MAP = {
  halfWidth: 26, // x: -26 (west, attackers) .. +26 (east, defenders)
  halfDepth: 18, // z: -18 (north) .. +18 (south)
  wallHeight: 5,
  buySeconds: 15,
  roundSeconds: 100,
  plantSeconds: 4,
  defuseSeconds: 5,
  detonateSeconds: 35,
  winRounds: 7,
  maxRounds: 13,
  startMoney: 800,
  roundMoney: 300,
  killMoney: 300,
  winMoney: 300,
};

export const SITES = {
  A: { x: 14, z: -12, radius: 4.5 },
  B: { x: 14, z: 12, radius: 4.5 },
};

export const SPAWNS = {
  atk: [
    { x: -23, z: -5 },
    { x: -23, z: -1.5 },
    { x: -23, z: 1.5 },
    { x: -23, z: 5 },
  ],
  def: [
    { x: 23, z: -5 },
    { x: 23, z: -1.5 },
    { x: 23, z: 1.5 },
    { x: 23, z: 5 },
  ],
};

// The depot sits on mid-lane and blocks a straight walk through the
// middle; the waypoint graph routes around it on both sides.
export const DEPOT = { x: 0, z: 0, radius: 3.2 };

// Axis-aligned cover boxes: {x, z, w, d, h, kind}. Bots and the player
// collide with them; bullets stop at them.
export const COVER = [
  { x: -14, z: -11, w: 4, d: 1.6, h: 2.4, kind: 'container' },
  { x: -14, z: 11, w: 4, d: 1.6, h: 2.4, kind: 'container' },
  { x: -6, z: -14, w: 3, d: 3, h: 1.6, kind: 'crate' },
  { x: -6, z: 14, w: 3, d: 3, h: 1.6, kind: 'crate' },
  { x: 6, z: -14, w: 3, d: 3, h: 1.6, kind: 'crate' },
  { x: 6, z: 14, w: 3, d: 3, h: 1.6, kind: 'crate' },
  { x: 10, z: -6, w: 1.6, d: 4, h: 2.6, kind: 'container' },
  { x: 10, z: 6, w: 1.6, d: 4, h: 2.6, kind: 'container' },
  { x: -20, z: -13, w: 2.4, d: 2.4, h: 1.4, kind: 'crate' },
  { x: -20, z: 13, w: 2.4, d: 2.4, h: 1.4, kind: 'crate' },
  { x: 20, z: -13, w: 2.4, d: 2.4, h: 1.4, kind: 'crate' },
  { x: 20, z: 13, w: 2.4, d: 2.4, h: 1.4, kind: 'crate' },
  { x: 2, z: -8, w: 2, d: 2, h: 1.2, kind: 'crate' },
  { x: -2, z: 8, w: 2, d: 2, h: 1.2, kind: 'crate' },
];

export const WEAPONS = {
  p2000: {
    name: 'P2000', slot: 1, price: 200, damage: 26, headMult: 2,
    mag: 12, reserve: 36, interval: 0.28, auto: false, spread: 0.011,
    range: 60, zoom: 1, reload: 1.4, pitch: 660,
  },
  mp9: {
    name: 'MP9', slot: 1, price: 900, damage: 22, headMult: 2,
    mag: 30, reserve: 120, interval: 0.08, auto: true, spread: 0.02,
    range: 45, zoom: 1, reload: 1.9, pitch: 880,
  },
  nova: {
    name: 'Nova', slot: 2, price: 1200, damage: 9, headMult: 1.5,
    pellets: 8, mag: 6, reserve: 24, interval: 0.85, auto: false,
    spread: 0.045, range: 22, zoom: 1, reload: 2.6, pitch: 300,
  },
  ak47: {
    name: 'AK-47', slot: 2, price: 2700, damage: 34, headMult: 2,
    mag: 30, reserve: 90, interval: 0.11, auto: true, spread: 0.014,
    range: 70, zoom: 1, reload: 2.2, pitch: 520,
  },
  m4a1: {
    name: 'M4A1', slot: 2, price: 3100, damage: 30, headMult: 2,
    mag: 30, reserve: 90, interval: 0.1, auto: true, spread: 0.011,
    range: 70, zoom: 1, reload: 2.1, pitch: 580,
  },
  kestrel: {
    name: 'Kestrel DMR', slot: 3, price: 3400, damage: 55, headMult: 3,
    mag: 10, reserve: 30, interval: 0.9, auto: false, spread: 0.003,
    range: 110, zoom: 2.2, reload: 2.4, pitch: 440,
  },
  awp: {
    name: 'AWP', slot: 3, price: 4750, damage: 110, headMult: 2,
    mag: 5, reserve: 15, interval: 1.4, auto: false, spread: 0.002,
    range: 130, zoom: 3, reload: 3.1, pitch: 240,
  },
};

export const SHOP = [
  { id: 'p2000', label: 'P2000 pistol', price: 200 },
  { id: 'mp9', label: 'MP9 SMG', price: 900 },
  { id: 'nova', label: 'Nova shotgun', price: 1200 },
  { id: 'ak47', label: 'AK-47 rifle', price: 2700 },
  { id: 'm4a1', label: 'M4A1 rifle', price: 3100 },
  { id: 'kestrel', label: 'Kestrel DMR', price: 3400 },
  { id: 'awp', label: 'AWP sniper', price: 4750 },
  { id: 'armour', label: 'Kevlar armour (+50)', price: 650 },
  { id: 'flash', label: 'Flash utility', price: 200 },
];

export const BOT_NAMES = {
  atk: ['Mara', 'Juno', 'Pike'],
  def: ['Rook', 'Sable', 'Wren', 'Heron'],
};

export const PLAYER = {
  radius: 0.42,
  eyeHeight: 1.62,
  crouchHeight: 1.05,
  walkSpeed: 5.2,
  crouchSpeed: 2.6,
  jumpSpeed: 5.4,
  gravity: 14,
  health: 100,
};

export const BOT = {
  radius: 0.42,
  speed: 4.1,
  health: 100,
  sightRange: 42,
  sightHalfAngle: 1.05, // ~60 degrees each side
  thinkEvery: 0.15,
  burstMin: 3,
  burstMax: 7,
  aimError: 0.028, // radians of wobble at 10 m
};
