/// Short 05, Vesting vs KEPT: the world. Two lanes split by a wall of light; four quarters along
/// the flight; the swarm watches the right lane only.
import type { Beam, FieldSpec } from "../trailer2/Field";
import { Frame, GOLD, GREEN, GREY, NA, RED, rnd, seal } from "../trailer2/swarm";
import { CamKey, hitsAt, mix, P, Pal, pathFrom, V3 } from "../trailer2/world";
import sheet from "./vesting.json";

export const Q = sheet.cues;
export const LANE = 4.1;
export const STEP = 14;
export const zOf = (k: number) => -STEP * k;
export const leftCard = (k: number): V3 => [-LANE, 0, zOf(k)];
export const rightCard = (k: number): V3 => [LANE, 0, zOf(k)];
export const RESULT_Z = -56;
export const SEAL_AT: V3 = [0, 1.6, -68];

/// When the right lane's verdict lands for quarter k.
export const verdictAt = (k: number) => Q.quarters[k] + Q.verdict;
export const unlockAt = (k: number) => Q.quarters[k] + Q.unlock;
export const voteAt = (k: number, i: number) => Q.quarters[k] + Q.votes + i * 0.09;

// ---------------------------------------------------------------------------- camera
const keys: CamKey[] = [
  [0, [0, 7, 24], [0, 0, -8]],
  [2.3, [0, 2.4, 13.5], [0, 0.3, 0]],
];
Q.quarters.forEach((q, k) => {
  const sway = k % 2 ? 0.4 : -0.4;
  keys.push([q + 0.35, [sway, 2.1, 13 + zOf(k)], [sway * 0.3, 0.2, zOf(k)]]);
  keys.push([q + 1.65, [-sway * 0.6, 1.8, 11.4 + zOf(k)], [-sway * 0.2, 0.1, zOf(k)]]);
});
keys.push([Q.result + 0.5, [0, 10, RESULT_Z + 24], [0, -0.5, RESULT_Z + 2]]);
keys.push([Q.timeNot - 0.1, [0, 4.5, RESULT_Z + 15], [0, 0.6, RESULT_Z]]);
keys.push([Q.logo - 0.1, [0, 2.6, SEAL_AT[2] + 16], [0, 1.6, SEAL_AT[2]]]);
keys.push([Q.logo + 0.2, [0, 1.6, SEAL_AT[2] + 13], SEAL_AT]);
keys.push([Q.end, [0, 1.6, SEAL_AT[2] + 10.4], SEAL_AT]);

const HITS = [Q.drop, ...Q.quarters.map((_, k) => verdictAt(k)), Q.timeNot, Q.delivery, Q.logo];
export const hit = hitsAt(HITS);
export const cam = pathFrom(keys, hit);

// ---------------------------------------------------------------------------- colour
const PALS: [number, Pal][] = [
  [0, P("#7b5cff", "#39ff8e", "#ff4fd8", "#0b0b22")],
  [Q.quarters[3] + Q.verdict, P("#ff4a3d", "#39ff8e", "#ff9b3d", "#1a0a10")],
  [Q.result, P("#7b5cff", "#39ff8e", "#34d8ff", "#08101e")],
  [Q.timeNot, P("#ff4a3d", "#ff8a3d", "#ff4fd8", "#220808")],
  [Q.delivery, P("#39ff8e", "#2de0c0", "#ffd36b", "#03190f")],
  [Q.logo, P("#3ecf7a", "#ffd36b", "#ffffff", "#021a10")],
];
export function palette(t: number): Pal {
  let i = 0;
  for (let k = 0; k < PALS.length; k++) if (t >= PALS[k][0]) i = k;
  if (i === 0) return PALS[0][1];
  const u = Math.min(1, (t - PALS[i][0]) / 0.35);
  const s = u * u * (3 - 2 * u);
  const a = PALS[i - 1][1], b = PALS[i][1];
  return { a: mix(a.a, b.a, s), b: mix(a.b, b.b, s), c: mix(a.c, b.c, s), bg: mix(a.bg, b.bg, s) };
}

// ---------------------------------------------------------------------------- the swarm
const VIOLET: [number, number, number] = [0.55, 0.42, 1];
const R1 = Float32Array.from({ length: NA }, (_, i) => rnd(i + 3));
const R2 = Float32Array.from({ length: NA }, (_, i) => rnd(i + 5003));
const R3 = Float32Array.from({ length: NA }, (_, i) => rnd(i + 9001));
const quarterAt = (t: number) => Q.quarters.reduce((acc, q, k) => (t >= q ? k : acc), -1);
const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

/// Groups: the swarm over the right lane, the left lane's unlock stream, the right lane's payout
/// (or embers), and the wall of light. At the end, everything becomes the seal.
function groups(t: number): Frame {
  const f: Frame = { p: new Float32Array(NA * 3), c: new Float32Array(NA * 3), a: new Float32Array(NA).fill(1) };
  const k = Math.max(0, quarterAt(t));
  // where the action is, eased between quarters
  const kf = t < Q.quarters[0] ? 0 : Math.min(3, k + smooth((t - Q.quarters[k] - 1.6) / 0.6));
  const z = -STEP * kf;
  for (let i = 0; i < NA; i++) {
    let x = 0, y = 0, zz = 0, a = 1, col = GREY;
    if (i < 2200) {
      // the swarm: a sphere above the right lane, a little ahead of the card
      const yy = 1 - (i / 2199) * 2, rr = Math.sqrt(1 - yy * yy), th = i * 2.399963 + t * 0.9;
      const r = 1.05 * (1 + 0.03 * Math.sin(t * 3 + i));
      x = 1.3 + Math.cos(th) * rr * r;
      y = 2.5 + yy * r;
      zz = z - 6 + Math.sin(th) * rr * r;
      a = 0.8 * (1 - smooth((t - Q.result) / 0.4));
      col = rnd(i + 11) > 0.85 ? GREEN : GREY;
    } else if (i < 3800) {
      // vesting: gold pours out of the left card to the team, every quarter, no questions asked
      const on = t > unlockAt(0) ? 1 : 0;
      const u = (R1[i] + Math.max(0, t - unlockAt(0)) * (0.6 + R2[i] * 0.4)) % 1;
      const o = leftCard(Math.round(kf));
      const s = Math.sin(u * Math.PI);
      x = o[0] - 0.5 - u * 9 + (R2[i] - 0.5) * s;
      y = o[1] + s * 2 - u * 1.2 + (R3[i] - 0.5) * s;
      zz = o[2] + u * 3 + (R3[i] - 0.5) * 0.6;
      a = on * (0.35 + 0.65 * s);
      col = GOLD;
    } else if (i < 5600) {
      // KEPT: pays only after a kept verdict; the missed one burns
      const v = verdictAt(k);
      const kept = Q.kept[k];
      const o = rightCard(k);
      if (t < v || t < Q.quarters[0]) {
        x = o[0] + (R1[i] - 0.5) * 3.6;
        y = o[1] + (R2[i] - 0.5) * 2.2;
        zz = o[2];
        a = 0;
      } else if (kept) {
        const u = (R1[i] + (t - v) * (0.7 + R2[i] * 0.4)) % 1;
        const s = Math.sin(u * Math.PI);
        x = o[0] + 0.5 + u * 9 + (R2[i] - 0.5) * s;
        y = o[1] + s * 2 - u * 1.2 + (R3[i] - 0.5) * s;
        zz = o[2] + u * 3;
        a = (0.35 + 0.65 * s) * Math.min(1, (t - v) * 4);
        col = GOLD;
      } else {
        const u = Math.max(0, t - v - R1[i] * 0.8);
        x = o[0] + (R2[i] - 0.5) * 3.6 + Math.sin(u * 3 + i) * 0.3 * u;
        y = o[1] + (R3[i] - 0.5) * 2.2 + u * (1.5 + R2[i] * 2.4);
        zz = o[2] + (R1[i] - 0.5) * 0.4;
        a = u > 0 ? Math.max(0, 1 - u * 0.7) : 0.9;
        const heat = Math.min(1, u * 1.3);
        col = [1, 0.75 - 0.45 * heat, 0.25 - 0.15 * heat];
      }
    } else {
      // the wall of light down the middle
      const u = R1[i];
      x = (R2[i] - 0.5) * 0.25;
      y = -3.5 + ((R3[i] + t * (0.15 + R1[i] * 0.2)) % 1) * 9;
      zz = 16 - u * 80;
      a = 0.6;
      col = rnd(i + 7) > 0.5 ? VIOLET : GREEN;
    }
    f.p[i * 3] = x;
    f.p[i * 3 + 1] = y;
    f.p[i * 3 + 2] = zz;
    f.a[i] = a;
    f.c.set(col, i * 3);
  }
  return f;
}

const SEAL = seal(SEAL_AT, 300);
export function swarm(t: number): Frame {
  const g = groups(Math.min(t, Q.logo - 0.5));
  if (t < Q.logo - 0.5) return g;
  const s = SEAL(t);
  const f: Frame = { p: new Float32Array(NA * 3), c: new Float32Array(NA * 3), a: new Float32Array(NA) };
  for (let i = 0; i < NA; i++) {
    const u = smooth((t - (Q.logo - 0.5) - R1[i] * 0.3) / 0.6);
    const sw = Math.sin(u * Math.PI) * 1.8;
    for (let d = 0; d < 3; d++) f.p[i * 3 + d] = g.p[i * 3 + d] + (s.p[i * 3 + d] - g.p[i * 3 + d]) * u;
    f.p[i * 3] += Math.cos(R2[i] * 6.28 + u * 4) * sw;
    f.p[i * 3 + 1] += Math.sin(R2[i] * 6.28 + u * 4) * sw;
    for (let d = 0; d < 3; d++) f.c[i * 3 + d] = g.c[i * 3 + d] + (s.c[i * 3 + d] - g.c[i * 3 + d]) * u;
    f.a[i] = Math.max(0.6, g.a[i]) * (1 - u) + s.a[i] * u;
  }
  return f;
}

// ---------------------------------------------------------------------------- set pieces
const win = (t: number, a: number, b: number, f = 0.3) => Math.max(0, Math.min(1, (t - a) / f, (b - t) / f));
export const SPEC: FieldSpec = {
  cam,
  palette,
  hit,
  swarm,
  beatFrom: Q.drop,
  grid: () => 1,
  tunnel: () => 0,
  rays: (t) => ({ on: win(t, Q.logo - 0.05, 31, 0.4), at: SEAL_AT }),
  beams: (t) => {
    const out: Beam[] = [];
    // the wall of light
    for (let j = 0; j < 6; j++) {
      const zz = 14 - j * 14;
      out.push({ a: [0, -4.2, zz], b: [0, 6, zz], col: [0.75, 0.75, 1], k: 0.45 * Math.min(1, t / Q.lanes) * (1 - win(t, Q.logo - 0.6, 40, 0.5)), fade: 0.1 });
    }
    // the swarm checking the current milestone
    const k = quarterAt(t);
    if (k >= 0) {
      const on = win(t, Q.quarters[k] + 0.2, verdictAt(k) + 0.1, 0.15);
      const o = rightCard(k);
      for (let j = 0; j < 9; j++) {
        if (t < voteAt(k, j) - 0.25) continue;
        const yes = Q.kept[k] ? j !== 4 : j < 2;
        const v = voteAt(k, j);
        const flare = t >= v ? 1 + 2 * Math.exp(-(t - v) * 8) : 0.5;
        out.push({ a: [1.3 + Math.cos(j * 0.7) * 0.7, 1.8, o[2] - 6 + Math.sin(j * 0.7) * 0.7], b: [o[0] - 2.4 + j * 0.6, o[1] + 1.2, o[2]], col: t >= v ? (yes ? GREEN : RED) : [1, 1, 1], k: on * flare * 0.5, fade: 0.25 });
      }
    }
    return out;
  },
};
