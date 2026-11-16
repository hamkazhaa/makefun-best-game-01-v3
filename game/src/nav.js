// The waypoint graph bots walk on, plus the circle-vs-box collision
// that keeps players and bots out of cover. Dijkstra over a small
// hand-placed graph — no navmesh needed at this scale.

import { DEPOT } from './config.js';

// Nodes: id -> {x, z}. Lanes run west-east at z = -11, 0 and +11; the
// mid-lane splits around the depot at x = -8, 0 and +8.
const NODES = {
  spawnW: { x: -23, z: 0 },
  wNorth: { x: -18, z: -11 },
  wMid: { x: -18, z: 0 },
  wSouth: { x: -18, z: 11 },
  mNorth1: { x: -8, z: -11 },
  mMidN1: { x: -8, z: -4.2 },
  mMidS1: { x: -8, z: 4.2 },
  mSouth1: { x: -8, z: 11 },
  mNorth2: { x: 0, z: -11 },
  mMidN2: { x: 0, z: -4.2 },
  mMidS2: { x: 0, z: 4.2 },
  mSouth2: { x: 0, z: 11 },
  mNorth3: { x: 8, z: -11 },
  mMidN3: { x: 8, z: -4.2 },
  mMidS3: { x: 8, z: 4.2 },
  mSouth3: { x: 8, z: 11 },
  siteA: { x: 14, z: -12 },
  siteB: { x: 14, z: 12 },
  eNorth: { x: 18, z: -6 },
  eSouth: { x: 18, z: 6 },
  spawnE: { x: 23, z: 0 },
};

const EDGES = [
  ['spawnW', 'wNorth'], ['spawnW', 'wMid'], ['spawnW', 'wSouth'],
  ['wNorth', 'mNorth1'], ['wMid', 'mMidN1'], ['wMid', 'mMidS1'], ['wSouth', 'mSouth1'],
  ['mNorth1', 'mNorth2'], ['mMidN1', 'mMidN2'], ['mMidS1', 'mMidS2'], ['mSouth1', 'mSouth2'],
  ['mNorth2', 'mNorth3'], ['mMidN2', 'mMidN3'], ['mMidS2', 'mMidS3'], ['mSouth2', 'mSouth3'],
  ['mNorth1', 'mMidN1'], ['mNorth2', 'mMidN2'], ['mNorth3', 'mMidN3'],
  ['mSouth1', 'mMidS1'], ['mSouth2', 'mMidS2'], ['mSouth3', 'mMidS3'],
  ['mMidN1', 'mMidS1'], ['mMidN2', 'mMidS2'], ['mMidN3', 'mMidS3'],
  ['mNorth3', 'siteA'], ['mSouth3', 'siteB'],
  ['mNorth3', 'eNorth'], ['mSouth3', 'eSouth'],
  ['siteA', 'eNorth'], ['siteB', 'eSouth'],
  ['eNorth', 'spawnE'], ['eSouth', 'spawnE'],
  ['mMidN3', 'siteA'], ['mMidS3', 'siteB'],
];

function buildAdjacency() {
  const adj = new Map();
  for (const id of Object.keys(NODES)) adj.set(id, []);
  for (const [a, b] of EDGES) {
    const pa = NODES[a];
    const pb = NODES[b];
    const d = Math.hypot(pa.x - pb.x, pa.z - pb.z);
    adj.get(a).push({ to: b, cost: d });
    adj.get(b).push({ to: a, cost: d });
  }
  return adj;
}

const ADJ = buildAdjacency();

export function nearestNode(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const [id, p] of Object.entries(NODES)) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

// Dijkstra from `from` (a node id) to `to` (a node id). Returns the list
// of node ids to walk, start excluded, goal included.
export function findPath(from, to) {
  if (from === to) return [to];
  const dist = new Map([[from, 0]]);
  const prev = new Map();
  const done = new Set();
  const open = [from];
  while (open.length > 0) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      if ((dist.get(open[i]) ?? Infinity) < (dist.get(open[bi]) ?? Infinity)) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    if (done.has(cur)) continue;
    done.add(cur);
    if (cur === to) break;
    for (const e of ADJ.get(cur) ?? []) {
      const nd = (dist.get(cur) ?? Infinity) + e.cost;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, cur);
        if (!done.has(e.to)) open.push(e.to);
      }
    }
  }
  if (!prev.has(to) && from !== to) return [to];
  const path = [to];
  let cur = to;
  while (cur !== from) {
    cur = prev.get(cur);
    if (cur === undefined) return [to];
    path.unshift(cur);
  }
  return path.slice(1);
}

export function nodePos(id) {
  return NODES[id];
}

export function laneNodes(lane) {
  if (lane === 'north') return ['wNorth', 'mNorth1', 'mNorth2', 'mNorth3'];
  if (lane === 'south') return ['wSouth', 'mSouth1', 'mSouth2', 'mSouth3'];
  return ['wMid', 'mMidN1', 'mMidN2', 'mMidN3'];
}

// Push a circle (x, z, radius) out of every AABB collider and the map
// walls. Returns the corrected position.
export function collide(x, z, radius, colliders, halfW, halfD) {
  let px = x;
  let pz = z;
  for (const c of colliders) {
    const cx = Math.max(c.x - c.hw, Math.min(px, c.x + c.hw));
    const cz = Math.max(c.z - c.hd, Math.min(pz, c.z + c.hd));
    const dx = px - cx;
    const dz = pz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        px = cx + (dx / d) * radius;
        pz = cz + (dz / d) * radius;
      } else {
        // Dead centre: shove out along the shorter axis.
        const pushX = c.hw + radius - Math.abs(px - c.x);
        const pushZ = c.hd + radius - Math.abs(pz - c.z);
        if (pushX < pushZ) px = c.x + (px >= c.x ? c.hw + radius : -(c.hw + radius));
        else pz = c.z + (pz >= c.z ? c.hd + radius : -(c.hd + radius));
      }
    }
  }
  // The depot is a circle: keep out of it too.
  const ddx = px - DEPOT.x;
  const ddz = pz - DEPOT.z;
  const dd = Math.hypot(ddx, ddz);
  const minD = DEPOT.radius - 0.4 + radius;
  if (dd < minD && dd > 1e-6) {
    px = DEPOT.x + (ddx / dd) * minD;
    pz = DEPOT.z + (ddz / dd) * minD;
  }
  px = Math.max(-halfW + radius, Math.min(halfW - radius, px));
  pz = Math.max(-halfD + radius, Math.min(halfD - radius, pz));
  return { x: px, z: pz };
}
