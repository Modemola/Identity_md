/// The swarm: one cloud of points that takes every shape in the trailer, placed in the 3D world.
/// Colours are roles: grey points take the scene's palette; green, red and gold keep their meaning.
import { A, B, C, ESPHERE, F, G, H, I, K, milestonePos, Q, RGB, SEAL_END, V3, W } from "./world";

export const NA = 7000;
export const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const R1 = Float32Array.from({ length: NA }, (_, i) => rnd(i));
const R2 = Float32Array.from({ length: NA }, (_, i) => rnd(i + 7919));
const R3 = Float32Array.from({ length: NA }, (_, i) => rnd(i + 15887));
const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (u * 6 - 15) + 10));
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));

export const GREY: RGB = [0.8, 0.8, 0.8]; // "take the palette"
export const GREEN: RGB = [0.24, 1.0, 0.56];
export const RED: RGB = [1.0, 0.3, 0.25];
export const GOLD: RGB = [1.0, 0.78, 0.3];
export const AMBER: RGB = [1.0, 0.66, 0.16];

export type Frame = { p: Float32Array; c: Float32Array; a: Float32Array };
type Shape = (t: number) => Frame;
const alloc = (): Frame => ({ p: new Float32Array(NA * 3), c: new Float32Array(NA * 3), a: new Float32Array(NA).fill(1) });
const memo = (make: () => Frame): Shape => {
  let f: Frame | null = null;
  return () => (f ??= make());
};

/// Local frame-pixel offsets on a plane at `o`, turned by `ry`, into world space.
function place(o: V3, ry: number, lx: number, ly: number, lz = 0): V3 {
  const x = lx * K, y = -ly * K, z = lz;
  const c = Math.cos(ry), s = Math.sin(ry);
  return [o[0] + x * c + z * s, o[1] + y, o[2] - x * s + z * c];
}

/// A card's outline and content rows, in local pixels around its centre.
function cardLocal(i: number, w: number, h: number, rows: number): [number, number] {
  const r1 = R1[i], r2 = R2[i], r3 = R3[i];
  if (r3 < 0.7) {
    const per = 2 * (w + h);
    let d = r1 * per;
    let x: number, y: number;
    if (d < w) (x = -w / 2 + d), (y = -h / 2);
    else if ((d -= w) < h) (x = w / 2), (y = -h / 2 + d);
    else if ((d -= h) < w) (x = w / 2 - d), (y = h / 2);
    else (d -= w), (x = -w / 2), (y = h / 2 - d);
    return [x + (r2 - 0.5) * 6, y + (rnd(i + 3) - 0.5) * 6];
  }
  const k = Math.floor(r1 * Math.max(1, rows));
  const y = -h / 2 + ((k + 1) * h) / (rows + 1) + (rnd(i + 5) - 0.5) * 4;
  return [-w / 2 + 50 + r2 * (w - 100) * (0.5 + 0.5 * rnd(k + 11)), y];
}

type CardSpec = { o: V3; ry?: number; w: number; h: number; rows: number; col: RGB };
export const cards = (list: CardSpec[]): Shape =>
  memo(() => {
    const f = alloc();
    for (let i = 0; i < NA; i++) {
      const c = list[i % list.length];
      const [lx, ly] = cardLocal(i, c.w, c.h, c.rows);
      f.p.set(place(c.o, c.ry ?? 0, lx, ly, (rnd(i + 9) - 0.5) * 0.12), i * 3);
      f.c.set(R3[i] < 0.7 ? c.col : GREY, i * 3);
      f.a[i] = R3[i] < 0.7 ? 1 : 0.5;
    }
    return f;
  });
export const card = (c: CardSpec) => cards([c]);

/// A turning sphere with three orbit rings.
export const sphere = (o: V3, radius: number, spin = 0.35, accent: RGB | null = null): Shape => (t) => {
  const f = alloc();
  const yaw = t * spin, pitch = 0.4;
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const nS = Math.floor(NA * 0.74);
  for (let i = 0; i < NA; i++) {
    let x: number, y: number, z: number;
    if (i < nS) {
      const yy = 1 - (i / (nS - 1)) * 2;
      const rr = Math.sqrt(1 - yy * yy);
      const th = i * 2.399963;
      const br = radius * (1 + 0.025 * Math.sin(t * 2.4 + i));
      x = Math.cos(th) * rr * br;
      y = yy * br;
      z = Math.sin(th) * rr * br;
    } else {
      const k = (i - nS) % 3;
      const a = R1[i] * Math.PI * 2 + t * (0.5 + k * 0.2);
      const rad = radius * (1.42 + k * 0.14);
      x = Math.cos(a) * rad;
      y = 0;
      z = Math.sin(a) * rad;
      const tilt = [1.15, 0.35, -0.65][k], roll = [0.3, -0.9, 1.25][k];
      [y, z] = [y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)];
      [x, y] = [x * Math.cos(roll) - y * Math.sin(roll), x * Math.sin(roll) + y * Math.cos(roll)];
    }
    const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
    const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
    f.p[i * 3] = o[0] + x1;
    f.p[i * 3 + 1] = o[1] + y2;
    f.p[i * 3 + 2] = o[2] + z2;
    f.a[i] = i < nS ? 0.8 : 0.55;
    f.c.set(accent && rnd(i + 3) > 0.88 ? accent : GREY, i * 3);
  }
  return f;
};

/// The KEPT seal: a square, a check, a ring of dots.
export const seal = (o: V3, size: number): Shape =>
  memo(() => {
    const f = alloc();
    const check: [number, number][] = [[0.24, 0.52], [0.42, 0.7], [0.77, 0.3]];
    for (let i = 0; i < NA; i++) {
      const r = R3[i];
      let x: number, y: number, col: RGB = [1, 1, 1];
      if (r < 0.48) {
        const d = R1[i] * 4, side = Math.floor(d), u = d - side;
        const th = (R2[i] - 0.5) * 0.09;
        const pts: [number, number][] = [[u, 0], [1, u], [1 - u, 1], [0, 1 - u]];
        [x, y] = pts[side];
        if (side % 2 === 0) y += th;
        else x += th;
      } else if (r < 0.8) {
        const u = R1[i];
        const seg = u < 0.33 ? 0 : 1;
        const v = seg === 0 ? u / 0.33 : (u - 0.33) / 0.67;
        x = check[seg][0] + (check[seg + 1][0] - check[seg][0]) * v + (R2[i] - 0.5) * 0.07;
        y = check[seg][1] + (check[seg + 1][1] - check[seg][1]) * v + (rnd(i + 2) - 0.5) * 0.07;
        col = GREEN;
      } else {
        const a = (Math.floor(R1[i] * 40) / 40) * Math.PI * 2;
        x = 0.5 + Math.cos(a) * 0.86 + (rnd(i + 4) - 0.5) * 0.012;
        y = 0.5 + Math.sin(a) * 0.86 + (rnd(i + 6) - 0.5) * 0.012;
        col = GREY;
      }
      f.p.set(place(o, 0, (x - 0.5) * size, (y - 0.5) * size, (rnd(i + 8) - 0.5) * 0.1), i * 3);
      f.c.set(col, i * 3);
    }
    return f;
  });

/// Nine agent knots on a tilted ring around the vote card, lit by their votes.
export const voteRing = (o: V3): Shape => (t) => {
  const f = alloc();
  for (let i = 0; i < NA; i++) {
    const knot = i % 3 === 0;
    const k = Math.floor(i / 3) % 9;
    let a = knot ? (k / 9) * Math.PI * 2 - Math.PI / 2 + (R1[i] - 0.5) * 0.05 : R1[i] * Math.PI * 2;
    a += t * 0.25;
    const rx = 6.2 + (R2[i] - 0.5) * (knot ? 0.25 : 0.5);
    const ry = 3.8 + (R2[i] - 0.5) * (knot ? 0.25 : 0.5);
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    const tilt = 0.35;
    f.p[i * 3] = o[0] + x;
    f.p[i * 3 + 1] = o[1] + y * Math.cos(tilt);
    f.p[i * 3 + 2] = o[2] + y * Math.sin(tilt) + (R3[i] - 0.5) * 0.4;
    const voted = knot && t >= Q.votes[k];
    const yes = k !== Q.no;
    f.c.set(voted ? (yes ? GREEN : RED) : t >= Q.votes[7] ? GREEN : GREY, i * 3);
    f.a[i] = knot ? (voted ? 1 : 0.7) : 0.4;
  }
  return f;
};
export const knotPos = (k: number, t: number): V3 => {
  const a = (k / 9) * Math.PI * 2 - Math.PI / 2 + t * 0.25;
  const y = Math.sin(a) * 3.8;
  return [F[0] + Math.cos(a) * 6.2, F[1] + y * Math.cos(0.35), F[2] + y * Math.sin(0.35)];
};

/// Gold tokens pouring from one point to another along an arc.
export const stream = (from: V3, to: V3, t0: number): Shape => (t) => {
  const f = alloc();
  for (let i = 0; i < NA; i++) {
    const u = (R1[i] + Math.max(0, t - t0) * (0.5 + R2[i] * 0.45)) % 1;
    const s = Math.sin(u * Math.PI);
    f.p[i * 3] = from[0] + (to[0] - from[0]) * u + (R2[i] - 0.5) * (s * 1.2 + 0.1);
    f.p[i * 3 + 1] = from[1] + (to[1] - from[1]) * u + s * 2.2 + (R3[i] - 0.5) * (s * 1.2 + 0.1);
    f.p[i * 3 + 2] = from[2] + (to[2] - from[2]) * u + (rnd(i + 3) - 0.5) * s * 1.4;
    f.a[i] = 0.4 + 0.6 * s;
    f.c.set(rnd(i + 4) > 0.8 ? [1, 0.95, 0.7] : GOLD, i * 3);
  }
  return f;
};

/// A shape blown apart from t0: shards outward and at the lens, or embers rising.
export const blast = (base: Shape, t0: number, mode: "shatter" | "embers"): Shape => (t) => {
  const b = base(t0);
  const f = alloc();
  const u = Math.max(0, t - t0);
  for (let i = 0; i < NA; i++) {
    const x = b.p[i * 3], y = b.p[i * 3 + 1], z = b.p[i * 3 + 2];
    if (mode === "shatter") {
      const v = 3 + R3[i] * 9;
      const dx = R1[i] - 0.5, dy = R2[i] - 0.5;
      f.p[i * 3] = x + dx * v * u;
      f.p[i * 3 + 1] = y + dy * v * u;
      f.p[i * 3 + 2] = z + (2 + R3[i] * 14) * u;
      f.a[i] = Math.max(0, 1 - u * 0.6);
      f.c.set(RED, i * 3);
    } else {
      const delay = R1[i] * 0.9;
      const v = Math.max(0, u - delay);
      f.p[i * 3] = x + Math.sin(v * 3 + i) * 0.3 * v;
      f.p[i * 3 + 1] = y + v * (1.6 + R2[i] * 2.6);
      f.p[i * 3 + 2] = z + (R3[i] - 0.5) * v * 1.4;
      f.a[i] = v > 0 ? Math.max(0, 1 - v * 0.7) : 1;
      const heat = clamp01(v * 1.3);
      f.c.set([1, 0.75 - 0.45 * heat, 0.25 - 0.15 * heat], i * 3);
    }
  }
  return f;
};

/// A spiral tube along the numbers: the camera flies through it.
export const helix = (from: V3, to: V3): Shape => (t) => {
  const f = alloc();
  for (let i = 0; i < NA; i++) {
    const u = R1[i];
    const strand = i % 4;
    const a = u * Math.PI * 14 + strand * (Math.PI / 2) + t * 0.8;
    const r = 4.2 + (R2[i] - 0.5) * 0.4;
    f.p[i * 3] = from[0] + Math.cos(a) * r;
    f.p[i * 3 + 1] = from[1] + Math.sin(a) * r;
    f.p[i * 3 + 2] = from[2] + (to[2] - from[2]) * u;
    f.a[i] = 0.7;
    f.c.set(strand === 0 ? GREEN : GREY, i * 3);
  }
  return f;
};

/// Distant drift before anything forms.
const drift: Shape = (t) => {
  const f = alloc();
  for (let i = 0; i < NA; i++) {
    f.p[i * 3] = (R1[i] - 0.5) * 30 + Math.sin(t * 0.3 + i) * 0.4;
    f.p[i * 3 + 1] = (R2[i] - 0.5) * 16 + Math.cos(t * 0.25 + i) * 0.4;
    f.p[i * 3 + 2] = -24 + R3[i] * 30;
    f.a[i] = 0.5;
    f.c.set(GREY, i * 3);
  }
  return f;
};

// ---------------------------------------------------------------------------- the timeline
type Key = { at: number; dur: number; shape: Shape; swirl?: number; stagger?: number };
const ROADMAP = card({ o: A, w: 760, h: 460, rows: 5, col: GREY });
const ROADMAP_RED = card({ o: A, w: 760, h: 460, rows: 5, col: RED });
const BROKEN = card({ o: G, w: 760, h: 360, rows: 3, col: RED });

export const KEYS: Key[] = [
  { at: 0, dur: 0.01, shape: drift },
  { at: Q.cardForm, dur: 0.7, shape: ROADMAP, swirl: 1.4, stagger: 0.25 },
  { at: Q.broken + 0.5, dur: 0.3, shape: ROADMAP_RED, stagger: 0.2 },
  { at: Q.shatter, dur: 0.01, shape: blast(ROADMAP_RED, Q.shatter, "shatter") },
  { at: Q.sphere, dur: 0.9, shape: sphere(B, 2.4, 0.6, GREEN), swirl: 3, stagger: 0.3 },
  { at: Q.seal - 0.35, dur: 0.45, shape: seal(B, 340), swirl: 0.8, stagger: 0.12 },
  { at: Q.pledge - 0.1, dur: 0.55, shape: card({ o: C, w: 820, h: 480, rows: 4, col: GREEN }), swirl: 2, stagger: 0.2 },
  { at: Q.milestones - 0.1, dur: 0.55, shape: cards([0, 1, 2, 3].map((k) => ({ o: milestonePos(k).p, ry: milestonePos(k).ry, w: 380, h: 300, rows: 3, col: AMBER }))), swirl: 2, stagger: 0.25 },
  { at: Q.deadline - 0.2, dur: 0.7, shape: sphere(ESPHERE, 1.8, 0.7, GREEN), swirl: 2, stagger: 0.3 },
  { at: Q.drop - 0.25, dur: 0.5, shape: voteRing(F), swirl: 1.5, stagger: 0.2 },
  { at: Q.stream - 0.15, dur: 0.45, shape: stream([F[0] + 2.5, F[1], F[2]], W, Q.stream), swirl: 0.8, stagger: 0.25 },
  { at: Q.brokenCard - 0.2, dur: 0.5, shape: BROKEN, swirl: 2, stagger: 0.2 },
  { at: Q.burn, dur: 0.01, shape: blast(BROKEN, Q.burn, "embers") },
  { at: Q.stats[0] - 0.25, dur: 0.6, shape: helix([0, 0, H[0][2] + 6], [0, 0, H[2][2] - 6]), swirl: 2, stagger: 0.3 },
  { at: Q.tagline - 0.3, dur: 0.9, shape: sphere(I, 3.8, 0.3, GREEN), swirl: 2, stagger: 0.3 },
  { at: Q.logo - 0.45, dur: 0.6, shape: seal(SEAL_END, 320), swirl: 1.6, stagger: 0.2 },
];

export function swarmAt(t: number): Frame {
  let k = 0;
  for (let i = 0; i < KEYS.length; i++) if (t >= KEYS[i].at) k = i;
  const cur = KEYS[k];
  const to = cur.shape(t);
  if (k === 0) return to;
  const st = cur.stagger ?? 0, sw = cur.swirl ?? 0;
  if (t >= cur.at + cur.dur + st) return to;
  const from = KEYS[k - 1].shape(Math.min(t, cur.at));
  const f = alloc();
  for (let i = 0; i < NA; i++) {
    const u = smooth(clamp01((t - cur.at - R1[i] * st) / cur.dur));
    const s = Math.sin(u * Math.PI) * sw;
    const ang = R2[i] * Math.PI * 2 + u * 4;
    for (let d = 0; d < 3; d++) f.p[i * 3 + d] = from.p[i * 3 + d] + (to.p[i * 3 + d] - from.p[i * 3 + d]) * u;
    f.p[i * 3] += Math.cos(ang) * s;
    f.p[i * 3 + 1] += Math.sin(ang) * s;
    f.p[i * 3 + 2] += (R3[i] - 0.5) * s * 2;
    for (let d = 0; d < 3; d++) f.c[i * 3 + d] = from.c[i * 3 + d] + (to.c[i * 3 + d] - from.c[i * 3 + d]) * u;
    f.a[i] = from.a[i] + (to.a[i] - from.a[i]) * u;
  }
  return f;
}
