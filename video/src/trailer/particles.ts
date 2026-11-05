/// The trailer's particle field: every shape the swarm takes, and the timeline of morphs between
/// them. Pure functions of time, so any frame renders on its own.
import sheet from "./trailer.json";

export const Q = sheet.cues;
export const NA = 6000; // the swarm: takes the shapes
export const NB = 2400; // ambient dust: always drifting

// camera: z = 12, fov 35; the z = 0 plane spans the 1920x1080 frame
export const CAM_Z = 12;
export const FOV = 35;
const K = (2 * CAM_Z * Math.tan(((FOV / 2) * Math.PI) / 180)) / 1080;
export const wx = (x: number) => (x - 960) * K;
export const wy = (y: number) => (540 - y) * K;

export const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const R1 = Float32Array.from({ length: NA }, (_, i) => rnd(i));
const R2 = Float32Array.from({ length: NA }, (_, i) => rnd(i + 7919));
const R3 = Float32Array.from({ length: NA }, (_, i) => rnd(i + 15887));
const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (u * 6 - 15) + 10));
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));

type RGB = [number, number, number];
export const COL = {
  white: [0.92, 0.95, 0.94] as RGB,
  dim: [0.35, 0.4, 0.38] as RGB,
  green: [0.24, 0.81, 0.48] as RGB,
  red: [1.0, 0.36, 0.3] as RGB,
  amber: [0.98, 0.72, 0.18] as RGB,
  gold: [1.0, 0.8, 0.35] as RGB,
};

export type Frame = { p: Float32Array; c: Float32Array; a: Float32Array };
type Shape = (t: number) => Frame;

function alloc(): Frame {
  return { p: new Float32Array(NA * 3), c: new Float32Array(NA * 3), a: new Float32Array(NA).fill(1) };
}
function paint(f: Frame, col: RGB | ((i: number) => RGB)) {
  for (let i = 0; i < NA; i++) {
    const c = typeof col === "function" ? col(i) : col;
    f.c[i * 3] = c[0];
    f.c[i * 3 + 1] = c[1];
    f.c[i * 3 + 2] = c[2];
  }
  return f;
}
const memo = (make: () => Frame): Shape => {
  let f: Frame | null = null;
  return () => (f ??= make());
};

// ---------------------------------------------------------------------------- shapes

/// Deep drifting dust.
export const dust = (seed: number, spread = 1): Shape => (t) => {
  const f = alloc();
  for (let i = 0; i < NA; i++) {
    const a = rnd(i + seed), b = rnd(i + seed + 1), c = rnd(i + seed + 2);
    f.p[i * 3] = (a - 0.5) * 22 * spread + Math.sin(t * 0.2 + i) * 0.3;
    f.p[i * 3 + 1] = (b - 0.5) * 13 * spread + Math.cos(t * 0.17 + i * 1.3) * 0.3;
    f.p[i * 3 + 2] = -18 + c * 22;
    f.a[i] = 0.35 + 0.4 * rnd(i + seed + 3);
  }
  return paint(f, (i) => (rnd(i + 5) > 0.92 ? COL.green : COL.dim));
};

/// A card outline in frame pixels: dense rounded edges, a few inner rows.
function cardPoints(i: number, cx: number, cy: number, w: number, h: number, rows: number): [number, number, number] {
  const r1 = R1[i], r2 = R2[i], r3 = R3[i];
  let x: number, y: number;
  if (r3 < 0.72) {
    // perimeter
    const per = 2 * (w + h);
    let d = r1 * per;
    if (d < w) (x = cx - w / 2 + d), (y = cy - h / 2);
    else if ((d -= w) < h) (x = cx + w / 2), (y = cy - h / 2 + d);
    else if ((d -= h) < w) (x = cx + w / 2 - d), (y = cy + h / 2);
    else (d -= w), (x = cx - w / 2), (y = cy + h / 2 - d);
    x += (r2 - 0.5) * 5;
    y += (rnd(i + 3) - 0.5) * 5;
  } else if (rows > 0) {
    // content rows
    const k = Math.floor(r1 * rows);
    y = cy - h / 2 + ((k + 1) * h) / (rows + 1);
    x = cx - w / 2 + 50 + r2 * (w - 100) * (0.55 + 0.45 * rnd(k + 11));
    y += (rnd(i + 5) - 0.5) * 4;
  } else {
    x = cx + (r1 - 0.5) * w;
    y = cy + (r2 - 0.5) * h;
  }
  return [wx(x), wy(y), (rnd(i + 9) - 0.5) * 0.15];
}

export const card = (cx: number, cy: number, w: number, h: number, rows: number, col: RGB): Shape =>
  memo(() => {
    const f = alloc();
    for (let i = 0; i < NA; i++) f.p.set(cardPoints(i, cx, cy, w, h, rows), i * 3);
    return paint(f, (i) => (R3[i] < 0.72 ? col : COL.dim));
  });

/// Several cards: particles split evenly between them.
export const cards = (list: { cx: number; cy: number; w: number; h: number; rows: number; col: RGB }[]): Shape =>
  memo(() => {
    const f = alloc();
    for (let i = 0; i < NA; i++) {
      const c = list[i % list.length];
      f.p.set(cardPoints(i, c.cx, c.cy, c.w, c.h, c.rows), i * 3);
      const col = R3[i] < 0.72 ? c.col : COL.dim;
      f.c.set(col, i * 3);
    }
    return f;
  });

/// The swarm: a slowly turning sphere with three orbit rings, centred at a frame pixel.
export const sphere = (cx: number, cy: number, radius: number, col: (i: number, t: number) => RGB = () => COL.white, spin = 0.35): Shape => (t) => {
  const f = alloc();
  const ox = wx(cx), oy = wy(cy);
  const yaw = t * spin, pitch = 0.35;
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const nS = Math.floor(NA * 0.78);
  for (let i = 0; i < NA; i++) {
    let x: number, y: number, z: number;
    if (i < nS) {
      const yy = 1 - (i / (nS - 1)) * 2;
      const rr = Math.sqrt(1 - yy * yy);
      const th = i * 2.399963;
      const br = radius * (1 + 0.02 * Math.sin(t * 2 + i));
      x = Math.cos(th) * rr * br;
      y = yy * br;
      z = Math.sin(th) * rr * br;
    } else {
      const k = (i - nS) % 3;
      const a = R1[i] * Math.PI * 2 + t * (0.4 + k * 0.15);
      const rad = radius * (1.38 + k * 0.1);
      x = Math.cos(a) * rad;
      y = 0;
      z = Math.sin(a) * rad;
      const tilt = [1.15, 0.35, -0.65][k], roll = [0.3, -0.9, 1.25][k];
      [y, z] = [y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)];
      [x, y] = [x * Math.cos(roll) - y * Math.sin(roll), x * Math.sin(roll) + y * Math.cos(roll)];
    }
    const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
    const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
    f.p[i * 3] = ox + x1;
    f.p[i * 3 + 1] = oy + y2;
    f.p[i * 3 + 2] = z2;
    f.a[i] = i < nS ? 0.75 : 0.45;
    f.c.set(col(i, t), i * 3);
  }
  return f;
};

/// The KEPT seal: a square, a check, a ring of dots.
export const seal = (cx: number, cy: number, size: number): Shape =>
  memo(() => {
    const f = alloc();
    const s = size;
    const check: [number, number][] = [[0.24, 0.52], [0.42, 0.7], [0.77, 0.3]];
    for (let i = 0; i < NA; i++) {
      const r = R3[i];
      let x: number, y: number, col = COL.white;
      if (r < 0.5) {
        // square outline, thick
        const d = R1[i] * 4;
        const side = Math.floor(d), u = d - side;
        const th = (R2[i] - 0.5) * 0.09;
        const pts: [number, number][] = [[u, 0], [1, u], [1 - u, 1], [0, 1 - u]];
        [x, y] = pts[side];
        if (side % 2 === 0) y += th;
        else x += th;
      } else if (r < 0.82) {
        // check stroke
        const u = R1[i];
        const seg = u < 0.33 ? 0 : 1;
        const v = seg === 0 ? u / 0.33 : (u - 0.33) / 0.67;
        x = check[seg][0] + (check[seg + 1][0] - check[seg][0]) * v + (R2[i] - 0.5) * 0.07;
        y = check[seg][1] + (check[seg + 1][1] - check[seg][1]) * v + (rnd(i + 2) - 0.5) * 0.07;
        col = COL.green;
      } else {
        // the swarm's ring of dots
        const a = Math.floor(R1[i] * 40) / 40 * Math.PI * 2;
        const rad = 0.86 + (R2[i] - 0.5) * 0.02;
        x = 0.5 + Math.cos(a) * rad + (rnd(i + 4) - 0.5) * 0.012;
        y = 0.5 + Math.sin(a) * rad + (rnd(i + 6) - 0.5) * 0.012;
        col = COL.dim;
      }
      f.p[i * 3] = wx(cx + (x - 0.5) * s);
      f.p[i * 3 + 1] = wy(cy + (y - 0.5) * s);
      f.p[i * 3 + 2] = (rnd(i + 8) - 0.5) * 0.1;
      f.c.set(col, i * 3);
    }
    return f;
  });

/// An ellipse around the vote card; nine bright agent knots, lit by their votes.
export const voteRing = (cx: number, cy: number, rx: number, ry: number): Shape => (t) => {
  const f = alloc();
  for (let i = 0; i < NA; i++) {
    const knot = i % 3 === 0;
    const k = Math.floor(i / 3) % 9;
    let a = knot ? (k / 9) * Math.PI * 2 - Math.PI / 2 + (R1[i] - 0.5) * 0.06 : R1[i] * Math.PI * 2;
    a += t * 0.12;
    const jit = knot ? 0.6 : 1;
    f.p[i * 3] = wx(cx + Math.cos(a) * (rx + (R2[i] - 0.5) * 30 * jit));
    f.p[i * 3 + 1] = wy(cy + Math.sin(a) * (ry + (R2[i] - 0.5) * 30 * jit));
    f.p[i * 3 + 2] = (R3[i] - 0.5) * 0.6;
    const vAt = Q.votes[k];
    const voted = knot && t >= vAt;
    const yes = k !== Q.no;
    const quorum = t >= Q.votes[7];
    f.c.set(voted ? (yes ? COL.green : COL.red) : quorum ? COL.green : knot ? COL.white : COL.dim, i * 3);
    f.a[i] = knot ? (voted ? 1 : 0.6) : 0.35;
  }
  return f;
};

/// Gold tokens flowing along a curve from one point to another.
export const stream = (x0: number, y0: number, x1: number, y1: number, t0: number): Shape => (t) => {
  const f = alloc();
  for (let i = 0; i < NA; i++) {
    const u = (R1[i] + Math.max(0, t - t0) * (0.55 + R2[i] * 0.4)) % 1;
    const bx = x0 + (x1 - x0) * u;
    const by = y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * 160;
    const spread = Math.sin(u * Math.PI) * 60 + 8;
    f.p[i * 3] = wx(bx + (R2[i] - 0.5) * spread);
    f.p[i * 3 + 1] = wy(by + (R3[i] - 0.5) * spread);
    f.p[i * 3 + 2] = (rnd(i + 3) - 0.5) * 0.8;
    f.a[i] = 0.5 + 0.5 * Math.sin(u * Math.PI);
  }
  return paint(f, COL.gold);
};

/// A shape blown apart from t0: outward for shards, upward for embers.
export const blast = (base: Shape, t0: number, mode: "shatter" | "embers", col: RGB): Shape => (t) => {
  const b = base(t0);
  const f = alloc();
  const u = Math.max(0, t - t0);
  for (let i = 0; i < NA; i++) {
    const x = b.p[i * 3], y = b.p[i * 3 + 1], z = b.p[i * 3 + 2];
    if (mode === "shatter") {
      const dx = x + (R1[i] - 0.5) * 2, dy = y + (R2[i] - 0.5) * 2;
      const len = Math.hypot(dx, dy) + 0.2;
      const v = 2.5 + R3[i] * 6;
      f.p[i * 3] = x + (dx / len) * v * u;
      f.p[i * 3 + 1] = y + (dy / len) * v * u - 1.2 * u * u;
      f.p[i * 3 + 2] = z + (R3[i] - 0.3) * 9 * u;
      f.a[i] = Math.max(0, 1 - u * 0.9);
    } else {
      const delay = R1[i] * 0.9;
      const v = Math.max(0, u - delay);
      f.p[i * 3] = x + Math.sin(v * 3 + i) * 0.25 * v;
      f.p[i * 3 + 1] = y + v * (1.4 + R2[i] * 2.2);
      f.p[i * 3 + 2] = z + (R3[i] - 0.5) * v;
      f.a[i] = v > 0 ? Math.max(0, 1 - v * 0.75) : 1;
    }
    const heat = mode === "embers" && u > R1[i] * 0.9 ? clamp01((u - R1[i] * 0.9) * 1.2) : 1;
    const c = mode === "embers" ? ([1, 0.75 - 0.45 * heat, 0.25 - 0.15 * heat] as RGB) : col;
    f.c.set(c, i * 3);
  }
  return f;
};

// ---------------------------------------------------------------------------- the timeline

type Key = { at: number; dur: number; shape: Shape; swirl?: number; stagger?: number };

const ROADMAP = card(960, 560, 760, 460, 5, COL.white);
const ROADMAP_RED = card(960, 560, 760, 460, 5, COL.red);
const SPHERE = sphere(960, 540, 2.3, (i, t) => (rnd(i + 3) > 0.9 ? COL.green : COL.white));
const MILESTONES = [0, 1, 2, 3].map((k) => ({ cx: 300 + k * 440, cy: 600, w: 380, h: 300, rows: 3, col: COL.amber }));
const VOTE = voteRing(960, 560, 560, 330);

export const KEYS: Key[] = [
  { at: 0, dur: 0.01, shape: dust(100) },
  { at: Q.cardForm, dur: 0.7, shape: ROADMAP, swirl: 1.2, stagger: 0.25 },
  { at: Q.broken + 0.5, dur: 0.3, shape: ROADMAP_RED, stagger: 0.2 },
  { at: Q.shatter, dur: 0.01, shape: blast(ROADMAP_RED, Q.shatter, "shatter", COL.red) },
  { at: Q.sphere, dur: 0.8, shape: SPHERE, swirl: 2.5, stagger: 0.3 },
  { at: Q.seal - 0.35, dur: 0.45, shape: seal(960, 430, 330), swirl: 0.6, stagger: 0.12 },
  { at: Q.pledge - 0.1, dur: 0.6, shape: card(960, 540, 820, 480, 4, COL.green), swirl: 1.0, stagger: 0.2 },
  { at: Q.milestones - 0.1, dur: 0.6, shape: cards(MILESTONES), swirl: 0.8, stagger: 0.25 },
  { at: Q.deadline - 0.2, dur: 0.8, shape: sphere(1380, 540, 1.5, (i, t) => (i % 667 === 0 ? COL.green : COL.white), 0.6), swirl: 1.5, stagger: 0.3 },
  { at: Q.drop - 0.25, dur: 0.5, shape: VOTE, swirl: 1.0, stagger: 0.2 },
  { at: Q.stream - 0.15, dur: 0.45, shape: stream(820, 560, 1500, 560, Q.stream), swirl: 0.6, stagger: 0.25 },
  { at: Q.brokenCard - 0.2, dur: 0.5, shape: card(960, 540, 760, 360, 3, COL.red), swirl: 0.8, stagger: 0.2 },
  { at: Q.burn, dur: 0.01, shape: blast(card(960, 540, 760, 360, 3, COL.red), Q.burn, "embers", COL.red) },
  { at: Q.stats[0] - 0.2, dur: 0.6, shape: sphere(960, 540, 3.2, () => COL.white, 0.25), swirl: 1.2, stagger: 0.3 },
  { at: Q.tagline - 0.3, dur: 0.9, shape: sphere(960, 560, 2.6, (i) => (rnd(i + 3) > 0.85 ? COL.green : COL.white), 0.3), swirl: 1.0, stagger: 0.3 },
  { at: Q.logo - 0.45, dur: 0.6, shape: seal(960, 380, 300), swirl: 1.4, stagger: 0.2 },
];

/// The swarm's state at time t: blend the previous shape into the current one, particle by
/// particle, with a staggered start and a curling swirl mid-flight.
export function swarmAt(t: number): Frame {
  let k = 0;
  for (let i = 0; i < KEYS.length; i++) if (t >= KEYS[i].at) k = i;
  const cur = KEYS[k];
  const to = cur.shape(t);
  if (k === 0) return to;
  const from = KEYS[k - 1].shape(Math.min(t, cur.at));
  const st = cur.stagger ?? 0;
  const sw = cur.swirl ?? 0;
  const span = cur.dur + st;
  if (t >= cur.at + span) return to;
  const f = alloc();
  for (let i = 0; i < NA; i++) {
    const u = smooth(clamp01((t - cur.at - R1[i] * st) / cur.dur));
    const s = Math.sin(u * Math.PI) * sw;
    const ang = R2[i] * Math.PI * 2 + u * 3;
    for (let d = 0; d < 3; d++) f.p[i * 3 + d] = from.p[i * 3 + d] + (to.p[i * 3 + d] - from.p[i * 3 + d]) * u;
    f.p[i * 3] += Math.cos(ang) * s;
    f.p[i * 3 + 1] += Math.sin(ang) * s;
    f.p[i * 3 + 2] += (R3[i] - 0.5) * s * 1.5;
    for (let d = 0; d < 3; d++) f.c[i * 3 + d] = from.c[i * 3 + d] + (to.c[i * 3 + d] - from.c[i * 3 + d]) * u;
    f.a[i] = from.a[i] + (to.a[i] - from.a[i]) * u;
  }
  return f;
}

/// Ambient dust, always present behind everything.
export function dustAt(t: number) {
  const p = new Float32Array(NB * 3);
  const a = new Float32Array(NB);
  for (let i = 0; i < NB; i++) {
    const r = (j: number) => rnd(i * 5 + j + 50000);
    p[i * 3] = (r(0) - 0.5) * 30 + Math.sin(t * 0.15 + i) * 0.4 + t * 0.08 * (r(3) - 0.5);
    p[i * 3 + 1] = (r(1) - 0.5) * 18 + Math.cos(t * 0.12 + i) * 0.4;
    p[i * 3 + 2] = -25 + r(2) * 33;
    a[i] = 0.12 + 0.3 * r(4);
  }
  return { p, a };
}
