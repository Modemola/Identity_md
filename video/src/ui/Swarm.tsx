import React from "react";
import { C } from "../theme";
import { tw } from "../time";

/// The IMD swarm as the site draws it: agents on a sphere around the promise at its centre, with
/// three orbit rings and the octahedral seal. Same lattice and camera as web/src/swarm.js, drawn
/// as SVG so every frame is exact.

type Pt = { x: number; y: number; z: number; seed: number };

function sphere(n: number): Pt[] {
  let s = 1337;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const j = 1 + (rnd() - 0.5) * 0.06;
    out.push({ x: Math.cos(th) * r * j, y: y * j, z: Math.sin(th) * r * j, seed: rnd() });
  }
  return out;
}

const PTS = sphere(760);
const OCTA: [number, number, number][] = [[0.2, 0, 0], [-0.2, 0, 0], [0, 0.27, 0], [0, -0.27, 0], [0, 0, 0.2], [0, 0, -0.2]];
const EDGES = [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2]];

function rotate(p: { x: number; y: number; z: number }, yaw: number, pitch: number) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x1 = p.x * cy + p.z * sy;
  const z1 = -p.x * sy + p.z * cy;
  const y2 = p.y * cp - z1 * sp;
  const z2 = p.y * sp + z1 * cp;
  return { x: x1, y: y2, z: z2 };
}

export type SwarmProps = {
  t: number;
  size: number;
  /// a green wave sweeping the sphere (a kept verdict)
  waveAt?: number;
  /// a panel of nine agents linking to the core; agreeAt[i] is when agent i agrees (Infinity: dissents)
  panelAt?: number;
  agreeAt?: number[];
  panelOut?: number;
  /// the seal at the core turns green
  sealGreenAt?: number;
  spinSpeed?: number;
  pitch?: number;
};

const YAW0 = 0.4;

/// Nine agents on the face the camera sees when the panel forms.
function panelIndices(at: number, speed: number, pitch: number) {
  const yaw = YAW0 + at * speed;
  const cand = PTS.map((p, i) => ({ i, r: rotate(p, yaw, pitch) })).filter((c) => c.r.z > 0.25 && Math.abs(c.r.y) < 0.85);
  const picked: number[] = [];
  for (let k = 0; k < 9; k++) {
    const target = (k / 9) * Math.PI * 2;
    let best = cand[0];
    let bestD = Infinity;
    for (const c of cand) {
      if (picked.includes(c.i)) continue;
      const a = Math.atan2(c.r.y, c.r.x);
      const ring = Math.hypot(c.r.x, c.r.y);
      const d = Math.abs(Math.atan2(Math.sin(a - target), Math.cos(a - target))) + Math.abs(ring - 0.62) * 2;
      if (d < bestD) (bestD = d), (best = c);
    }
    picked.push(best.i);
  }
  return picked;
}

export const Swarm: React.FC<SwarmProps> = ({ t, size, waveAt, panelAt, agreeAt = [], panelOut, sealGreenAt, spinSpeed = 0.16, pitch = 0.32 }) => {
  const yaw = YAW0 + t * spinSpeed;
  const half = size / 2;
  const f = 2.45;
  const proj = (r: { x: number; y: number; z: number }) => {
    const d = 3.3 - r.z;
    return { x: half + ((r.x * f) / d) * half * 0.86, y: half - ((r.y * f) / d) * half * 0.86, depth: (r.z + 1.2) / 2.4 };
  };
  const panel = React.useMemo(() => (panelAt === undefined ? [] : panelIndices(panelAt, spinSpeed, pitch)), [panelAt, spinSpeed, pitch]);
  const panelOn = panelAt === undefined ? 0 : tw(t, panelAt, panelAt + 0.6) * (panelOut === undefined ? 1 : 1 - tw(t, panelOut, panelOut + 0.8));

  // the kept wave: a ring of light from the face the camera sees
  const waveK = waveAt === undefined ? -1 : (t - waveAt) / 2.6;
  const waveDir = { x: 0.2, y: 0.25, z: 0.95 };

  const drawn = PTS.map((p, i) => {
    const breathe = 1 + 0.018 * Math.sin(t * 0.8 + p.seed * 31);
    const r = rotate({ x: p.x * breathe, y: p.y * breathe, z: p.z * breathe }, yaw, pitch);
    let lit = 0;
    let push = 0;
    if (waveK > 0 && waveK < 1) {
      const ang = Math.acos(Math.max(-1, Math.min(1, (r.x * waveDir.x + r.y * waveDir.y + r.z * waveDir.z) / 1.0)));
      const front = waveK * 3.4;
      const band = Math.exp(-Math.pow((ang - front) * 4, 2));
      const behind = ang < front ? Math.sin(waveK * Math.PI) * 0.55 : 0;
      lit = Math.max(band, behind);
      push = band * 0.07;
    } else if (waveK >= 1) lit = 0.18;
    const rr = { x: r.x * (1 + push), y: r.y * (1 + push), z: r.z * (1 + push) };
    const q = proj(rr);
    return { i, q, lit, seed: p.seed };
  }).sort((a, b) => a.q.depth - b.q.depth);

  const ring = (radius: number, tiltX: number, tiltZ: number) => {
    const pts: string[] = [];
    for (let k = 0; k <= 96; k++) {
      const a = (k / 96) * Math.PI * 2;
      let x = Math.cos(a) * radius, y = 0, z = Math.sin(a) * radius;
      [y, z] = [y * Math.cos(tiltX) - z * Math.sin(tiltX), y * Math.sin(tiltX) + z * Math.cos(tiltX)];
      [x, y] = [x * Math.cos(tiltZ) - y * Math.sin(tiltZ), x * Math.sin(tiltZ) + y * Math.cos(tiltZ)];
      const q = proj(rotate({ x, y, z }, yaw, pitch));
      pts.push(`${q.x.toFixed(1)},${q.y.toFixed(1)}`);
    }
    return pts.join(" ");
  };

  const sealG = sealGreenAt === undefined ? 0 : tw(t, sealGreenAt, sealGreenAt + 0.6);
  const sealColor = `rgb(${Math.round(230 - 168 * sealG)}, ${Math.round(230 - 23 * sealG)}, ${Math.round(230 - 108 * sealG)})`;
  const center = proj({ x: 0, y: 0, z: 0 });

  return (
    <svg width={size} height={size} style={{ overflow: "visible" }}>
      <defs>
        <radialGradient id="sw-glow">
          <stop offset="0%" stopColor="rgba(62,207,122,0.16)" />
          <stop offset="60%" stopColor="rgba(62,207,122,0)" />
        </radialGradient>
      </defs>
      <circle cx={half} cy={half} r={half * 0.95} fill="url(#sw-glow)" />
      {[ring(1.22, 1.2, 0.3), ring(1.3, 0.35, -0.9), ring(1.15, -0.6, 1.25)].map((d, k) => (
        <polyline key={k} points={d} fill="none" stroke="rgba(220,220,220,0.13)" strokeWidth={1.2} />
      ))}
      {drawn.map(({ i, q, lit, seed }) => {
        const a = (0.16 + q.depth * 0.79) * (seed > 0.93 ? 1 : 0.82);
        const rad = (0.5 + q.depth * 0.95) * (size / 520) * 1.9 * (1 + lit * 0.9);
        const g = lit;
        const col = `rgb(${Math.round(225 - 163 * g)}, ${Math.round(225 - 18 * g)}, ${Math.round(225 - 103 * g)})`;
        return <circle key={i} cx={q.x} cy={q.y} r={rad} fill={col} opacity={a} />;
      })}
      {EDGES.map(([a, b], k) => {
        const spin = t * 0.6;
        const pa = proj(rotate(rotate({ x: OCTA[a][0], y: OCTA[a][1], z: OCTA[a][2] }, spin, 0.2), yaw * 0.2, 0));
        const pb = proj(rotate(rotate({ x: OCTA[b][0], y: OCTA[b][1], z: OCTA[b][2] }, spin, 0.2), yaw * 0.2, 0));
        return <line key={k} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={sealColor} strokeWidth={1.8} opacity={0.85} style={{ filter: sealG ? `drop-shadow(0 0 6px rgba(62,207,122,${0.8 * sealG}))` : undefined }} />;
      })}
      {panelOn > 0 &&
        panel.map((idx, k) => {
          const p = PTS[idx];
          const q = proj(rotate(p, yaw, pitch));
          const agreed = t >= (agreeAt[k] ?? Infinity);
          const dissent = (agreeAt[k] ?? Infinity) === Infinity && agreeAt.length > 0 && t > Math.max(...agreeAt.filter(isFinite)) + 0.2;
          const col = agreed ? C.ok : dissent ? C.dim : C.caution;
          const grow = tw(t, (panelAt ?? 0) + k * 0.07, (panelAt ?? 0) + k * 0.07 + 0.5);
          const pop = agreed ? 1 + 0.6 * (1 - tw(t, agreeAt[k], agreeAt[k] + 0.4)) : 1;
          return (
            <g key={k} opacity={panelOn}>
              <line x1={center.x} y1={center.y} x2={center.x + (q.x - center.x) * grow} y2={center.y + (q.y - center.y) * grow} stroke={col} strokeWidth={1.6} opacity={0.75} />
              <circle cx={q.x} cy={q.y} r={7 * pop} fill="none" stroke={col} strokeWidth={2} opacity={grow} />
              <circle cx={q.x} cy={q.y} r={3.4} fill={col} opacity={grow} />
            </g>
          );
        })}
    </svg>
  );
};
