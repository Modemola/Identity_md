/// The trailer's world: where every scene sits in 3D, the camera's flight through them, and the
/// colour of each scene. World units: 1 unit = 1/K frame pixels at the standard 12 unit distance.
import * as THREE from "three";
import sheet from "../trailer/trailer.json";

export const Q = sheet.cues;
export const FOV = 35;
export const K = (2 * 12 * Math.tan(((FOV / 2) * Math.PI) / 180)) / 1080; // world units per frame px at 12 units
export type V3 = [number, number, number];

// ---------------------------------------------------------------------------- stages
export const A: V3 = [0, 0, 0]; // the roadmap
export const B: V3 = [0, 0, -40]; // the swarm, then the seal, at the end of the tunnel
export const C: V3 = [14, 1, -58]; // the pledge
export const D: V3 = [14, 1, -80]; // the milestones
export const E: V3 = [0, 0, -110]; // the deadline
export const ESPHERE: V3 = [5.2, 4.2, -114];
export const F: V3 = [0, 0, -140]; // the vote
export const W: V3 = [9.5, 0.2, -142]; // the team wallet
export const G: V3 = [-24, 0, -170]; // the broken promise
export const H: V3[] = [
  [0, 0, -200],
  [0, 0, -216],
  [0, 0, -232],
]; // the numbers
export const I: V3 = [0, -1.5, -270]; // the planet, and the mark
export const SEAL_END: V3 = [I[0], I[1] + 3.2, I[2] + 2];

export const milestonePos = (k: number): { p: V3; ry: number } => ({
  p: [D[0] + (k - 1.5) * 4.7, D[1], D[2] - Math.abs(k - 1.5) * 1.3],
  ry: -(k - 1.5) * 0.2,
});

// ---------------------------------------------------------------------------- camera
type CamKey = [number, V3, V3]; // time, position, look-at
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const KEYS: CamKey[] = [
  [0.0, [-6, 2.8, 15], A],
  [2.2, [-2.2, 1.0, 10.5], A],
  [3.6, [2.6, 0.2, 8.6], A],
  [3.95, [1.2, 0.0, 5.5], [0, 0, -10]],
  [5.6, [0, 0, -23], B],
  [6.0, [0, 0, -27.5], B],
  [6.95, [0.9, 0.4, -29.2], B],
  [7.3, add(C, [-3.5, 0.6, 9.5]), C],
  [8.0, add(C, [1.8, 0.2, 8.2]), add(C, [0.4, 0, 0])],
  [8.35, add(D, [-9, 2.4, 10.5]), add(D, [-3.5, 0, 0])],
  [10.2, add(D, [8, 1.0, 9.5]), add(D, [3.5, 0, 0])],
  [10.6, add(E, [-6.5, -1.4, 12]), add(E, [2.2, 1.8, -2])],
  [11.9, add(E, [-3.4, -0.6, 9.5]), add(E, [2.4, 2.0, -2])],
  [12.15, add(F, [Math.sin(-0.95) * 12.5, 1.8, Math.cos(-0.95) * 12.5]), F],
  [13.0, add(F, [Math.sin(-0.4) * 11.5, 1.0, Math.cos(-0.4) * 11.5]), F],
  [14.0, add(F, [Math.sin(0.2) * 10.5, 0.2, Math.cos(0.2) * 10.5]), F],
  [14.9, add(F, [Math.sin(0.55) * 11, -0.6, Math.cos(0.55) * 11]), F],
  [15.3, add(F, [2.4, 1.2, 11]), add(F, [3.5, 0, 0])],
  [16.8, add(W, [-1.5, 0.6, 9]), W],
  [17.2, add(G, [-3.2, 1.6, 10.5]), G],
  [18.8, add(G, [1.6, -0.4, 7.6]), add(G, [0, 1.2, 0])],
  [19.05, add(H[0], [0, 0, 13]), H[0]],
  [20.25, add(H[0], [0.4, 0.2, 7]), H[0]],
  [20.55, add(H[1], [0, 0, 13]), H[1]],
  [21.75, add(H[1], [-0.4, -0.2, 7]), H[1]],
  [22.05, add(H[2], [0, 0, 13]), H[2]],
  [23.2, add(H[2], [0.3, 0.2, 7.5]), H[2]],
  [23.55, add(I, [-11, 6, 17]), I],
  [25.85, add(I, [7, 2.4, 14]), I],
  [26.15, add(SEAL_END, [0, 0, 13]), SEAL_END],
  [30.0, add(SEAL_END, [0, 0, 10.2]), SEAL_END],
];

function hermite(t: number, pick: (k: CamKey) => V3): V3 {
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
  const k0 = KEYS[Math.max(0, i - 1)], k1 = KEYS[i], k2 = KEYS[i + 1], k3 = KEYS[Math.min(KEYS.length - 1, i + 2)];
  const h = k2[0] - k1[0];
  const u = Math.max(0, Math.min(1, (t - k1[0]) / h));
  const p1 = pick(k1), p2 = pick(k2), p0 = pick(k0), p3 = pick(k3);
  // tangents: velocity through each key; a key next to a whip (a short segment) stops dead, so
  // the whip eases in and out and never overshoots into the next shot
  const whip = (a: CamKey, b: CamKey) => b[0] - a[0] < 0.45;
  const z = [0, 0, 0];
  const m1 = whip(k0, k1) || whip(k1, k2) ? z : p1.map((_, d) => ((p2[d] - p0[d]) / Math.max(1e-3, k2[0] - k0[0])) * 0.8);
  const m2 = whip(k1, k2) || whip(k2, k3) ? z : p1.map((_, d) => ((p3[d] - p1[d]) / Math.max(1e-3, k3[0] - k1[0])) * 0.8);
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  return [0, 1, 2].map((d) => h00 * p1[d] + h10 * h * m1[d] + h01 * p2[d] + h11 * h * m2[d]) as V3;
}

const HITS = [Q.shatter, Q.seal, Q.drop, Q.votes[7], Q.kept, Q.brokenCard + 0.25, ...Q.stats, Q.logo];
export const hitAmount = (t: number) => HITS.reduce((m, h) => Math.max(m, t >= h ? Math.exp(-(t - h) * 9) : 0), 0);

export function camAt(t: number) {
  const pos = hermite(t, (k) => k[1]);
  const look = hermite(t, (k) => k[2]);
  // handheld drift, a little roll, and a kick on every hit
  const hit = hitAmount(t);
  pos[0] += Math.sin(t * 1.3) * 0.06 + Math.sin(t * 61) * 0.05 * hit;
  pos[1] += Math.cos(t * 1.1) * 0.05 + Math.cos(t * 53) * 0.05 * hit;
  const roll = Math.sin(t * 0.45) * 0.035 + Math.sin(t * 0.17 + 1) * 0.02;
  return { pos, look, roll };
}

/// A three.js camera at time t, shared by the WebGL scene and the CSS 3D layer.
export function cameraAt(t: number, aspect = 16 / 9) {
  const c = camAt(t);
  const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 400);
  cam.position.set(...c.pos);
  cam.up.set(Math.sin(c.roll), Math.cos(c.roll), 0);
  cam.lookAt(...c.look);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

// ---------------------------------------------------------------------------- colour
export type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
type Pal = { a: RGB; b: RGB; c: RGB; bg: RGB };
const P = (a: string, b: string, c: string, bg: string): Pal => ({ a: hex(a), b: hex(b), c: hex(c), bg: hex(bg) });

const PALETTES: [number, Pal][] = [
  [0, P("#7b5cff", "#ff4fd8", "#3ee6ff", "#140a30")],
  [3.0, P("#ff3d5a", "#ff8a3d", "#ff4fd8", "#2c0712")],
  [3.95, P("#3ee6ff", "#4f7bff", "#3ecf7a", "#04142c")],
  [5.9, P("#3ecf7a", "#2de0c0", "#ffd36b", "#02190f")],
  [7.1, P("#2de0c0", "#3ee6ff", "#3ecf7a", "#021a1f")],
  [8.15, P("#ffb02e", "#ff6a2e", "#ffd36b", "#1f1004")],
  [10.4, P("#3ecf7a", "#3ee6ff", "#7b5cff", "#03181a")],
  [12.0, P("#39ff8e", "#34d8ff", "#ff4fd8", "#04101e")],
  [15.1, P("#ffd36b", "#ffb02e", "#39ff8e", "#1a1304")],
  [17.0, P("#ff4a3d", "#ff9b3d", "#ffd36b", "#260806")],
  [18.95, P("#4f7bff", "#7b5cff", "#3ee6ff", "#070b28")],
  [20.45, P("#3ecf7a", "#2de0c0", "#ffd36b", "#031a10")],
  [21.95, P("#ffd36b", "#ff8a3d", "#3ecf7a", "#1c1306")],
  [23.4, P("#7b5cff", "#2de0c0", "#3ecf7a", "#0c0a26")],
  [25.9, P("#3ecf7a", "#ffd36b", "#ffffff", "#021a10")],
];
const mix = (x: RGB, y: RGB, u: number): RGB => [x[0] + (y[0] - x[0]) * u, x[1] + (y[1] - x[1]) * u, x[2] + (y[2] - x[2]) * u];

export function paletteAt(t: number): Pal {
  let i = 0;
  for (let k = 0; k < PALETTES.length; k++) if (t >= PALETTES[k][0]) i = k;
  const cur = PALETTES[i][1];
  if (i === 0) return cur;
  const prev = PALETTES[i - 1][1];
  const u = Math.min(1, (t - PALETTES[i][0]) / 0.35);
  const s = u * u * (3 - 2 * u);
  return { a: mix(prev.a, cur.a, s), b: mix(prev.b, cur.b, s), c: mix(prev.c, cur.c, s), bg: mix(prev.bg, cur.bg, s) };
}
export const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
