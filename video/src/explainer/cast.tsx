import React from "react";
import { C, F } from "../theme";
import { pop, rnd, tw } from "./kit";

/// The cast, drawn as flat vector shapes. Every piece is placed by its feet (or centre) in a
/// 1920x1080 SVG, so scenes only move numbers.

export const SKIN = {
  blue: ["#7fb8ff", "#3f7fd6"],
  pink: ["#ff9cc0", "#d9587f"],
  lilac: ["#c3adff", "#7f62d9"],
  mint: ["#7fe3c0", "#2fa57d"],
  peach: ["#ffc08f", "#d9813f"],
  team: ["#6fd3e6", "#2b97ad"],
} as const;
export type Skin = keyof typeof SKIN;

/// Gradients and glows every scene's SVG shares.
export const CastDefs: React.FC = () => (
  <defs>
    {Object.entries(SKIN).map(([k, [hi, lo]]) => (
      <linearGradient key={k} id={`skin-${k}`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stopColor={hi} />
        <stop offset="100%" stopColor={lo} />
      </linearGradient>
    ))}
    <radialGradient id="coin" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0%" stopColor="#ffe9a3" />
      <stop offset="45%" stopColor="#f6c445" />
      <stop offset="100%" stopColor="#c98a0c" />
    </radialGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#3a4541" />
      <stop offset="100%" stopColor="#1a201e" />
    </linearGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#4a5652" />
      <stop offset="55%" stopColor="#2a3330" />
      <stop offset="100%" stopColor="#1b2220" />
    </linearGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#fbf8ef" />
      <stop offset="100%" stopColor="#e9e3d2" />
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="10" />
    </filter>
  </defs>
);

export type Mood = "happy" | "joy" | "sad" | "wow" | "neutral" | "sleep" | "worried";
export type Arms = "down" | "up" | "wave" | "point" | "hold" | "none";
export type Holding = "laptop" | "megaphone" | "bag" | "glass" | null;

const DARK = "#1d1416";

export const Blob: React.FC<{
  x: number;
  y: number;
  t: number;
  s?: number;
  skin?: Skin;
  mood?: Mood;
  look?: number;
  seed?: number;
  sq?: number;
  hat?: boolean;
  arms?: Arms;
  holding?: Holding;
  flip?: boolean;
  rot?: number;
  opacity?: number;
}> = ({ x, y, t, s = 1, skin = "blue", mood = "happy", look = 0, seed = 0, sq = 0, hat = false, arms = "down", holding = null, flip = false, rot = 0, opacity = 1 }) => {
  const dark = SKIN[skin][1];
  const blink = (t + seed * 1.37) % 3.3 < 0.11 && mood !== "sleep";
  const breathe = 0.012 * Math.sin(t * 3 + seed);
  const sx = (1 + sq + breathe) * (flip ? -1 : 1);
  const sy = 1 - sq - breathe;
  const wave = Math.sin(t * 14 + seed) * 18;
  const arm = (side: -1 | 1) => {
    const x0 = 56 * side;
    const y0 = -48;
    let ex = 76 * side, ey = -14;
    if (arms === "up") (ex = 70 * side), (ey = -128 + Math.sin(t * 12 + seed + side) * 8);
    if (arms === "wave" && side === 1) (ex = 82), (ey = -118 + wave);
    if (arms === "point" && side === 1) (ex = 104), (ey = -66);
    if (arms === "hold") (ex = 26 * side), (ey = -30);
    return <path d={`M ${x0} ${y0} Q ${(x0 + ex) / 2 + 10 * side} ${(y0 + ey) / 2 + 8} ${ex} ${ey}`} stroke={dark} strokeWidth={15} strokeLinecap="round" fill="none" />;
  };
  const eyeY = -70;
  const px = look * 6;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} opacity={opacity}>
      <ellipse cx={0} cy={2} rx={62 * (1 + sq)} ry={10} fill="#000" opacity={0.45} />
      <g transform={`scale(${sx} ${sy})`}>
        {arms !== "none" && arms !== "hold" ? (
          <>
            {arm(-1)}
            {arm(1)}
          </>
        ) : null}
        <path d="M -54 0 Q -66 0 -64 -22 C -66 -74 -48 -116 0 -116 C 48 -116 66 -74 64 -22 Q 66 0 54 0 Z" fill={`url(#skin-${skin})`} />
        <path d="M -40 -92 C -30 -108 -10 -112 6 -110" stroke="#fff" strokeOpacity={0.35} strokeWidth={7} strokeLinecap="round" fill="none" />
        {/* eyes */}
        {mood === "sleep" ? (
          <g stroke={DARK} strokeWidth={5} strokeLinecap="round" fill="none">
            <path d={`M -32 ${eyeY} q 10 7 20 0`} />
            <path d={`M 12 ${eyeY} q 10 7 20 0`} />
          </g>
        ) : (
          [-22, 22].map((ex) => (
            <g key={ex}>
              <ellipse cx={ex} cy={eyeY} rx={13} ry={blink ? 1.5 : mood === "wow" ? 18 : 16} fill="#fff" />
              {!blink ? <circle cx={ex + px} cy={eyeY + 2 + (mood === "sad" ? 4 : 0)} r={mood === "wow" ? 6 : 7.5} fill={DARK} /> : null}
              {!blink ? <circle cx={ex + px + 3} cy={eyeY - 2} r={2.4} fill="#fff" /> : null}
            </g>
          ))
        )}
        {mood === "sad" || mood === "worried" ? (
          <g stroke={DARK} strokeWidth={4.5} strokeLinecap="round">
            <path d="M -34 -94 L -14 -88" />
            <path d="M 34 -94 L 14 -88" />
          </g>
        ) : null}
        {/* mouth */}
        {mood === "happy" ? <path d="M -17 -42 Q 0 -20 17 -42 Z" fill={DARK} /> : null}
        {mood === "joy" ? (
          <g>
            <path d="M -22 -44 Q 0 -6 22 -44 Z" fill={DARK} />
            <ellipse cx={0} cy={-22} rx={9} ry={5} fill="#ff7a8f" />
          </g>
        ) : null}
        {mood === "sad" ? <path d="M -14 -30 Q 0 -42 14 -30" stroke={DARK} strokeWidth={5} strokeLinecap="round" fill="none" /> : null}
        {mood === "worried" ? <path d="M -16 -34 q 8 -7 16 0 t 16 0" stroke={DARK} strokeWidth={4.5} strokeLinecap="round" fill="none" transform="translate(0 0)" /> : null}
        {mood === "wow" ? <ellipse cx={0} cy={-34} rx={8} ry={11} fill={DARK} /> : null}
        {mood === "neutral" || mood === "sleep" ? <path d="M -9 -36 L 9 -36" stroke={DARK} strokeWidth={5} strokeLinecap="round" /> : null}
        {mood === "happy" || mood === "joy" ? (
          <g fill="#ff6f91" opacity={0.4}>
            <ellipse cx={-40} cy={-48} rx={9} ry={6} />
            <ellipse cx={40} cy={-48} rx={9} ry={6} />
          </g>
        ) : null}
        {mood === "worried" ? <path d="M 50 -96 q 7 12 0 16 q -7 -4 0 -16 Z" fill="#9fd8ff" /> : null}
        {hat ? (
          <g>
            <path d="M -50 -100 C -50 -150 50 -150 50 -100 Z" fill="#f6c445" />
            <path d="M -10 -146 L -10 -104 M 10 -146 L 10 -104" stroke="#d9a52a" strokeWidth={5} />
            <rect x={-64} y={-106} width={128} height={12} rx={6} fill="#e8b22f" />
          </g>
        ) : null}
        {arms === "hold" ? (
          <>
            {arm(-1)}
            {arm(1)}
          </>
        ) : null}
      </g>
      {holding ? <Held what={holding} t={t} flip={flip} /> : null}
    </g>
  );
};

const Held: React.FC<{ what: Exclude<Holding, null>; t: number; flip: boolean }> = ({ what, t, flip }) => {
  const f = flip ? -1 : 1;
  if (what === "laptop")
    return (
      <g transform="translate(0 4) scale(0.82)">
        <path d="M -52 0 L 52 0 L 44 -62 L -44 -62 Z" fill="#20262a" stroke="#4b565b" strokeWidth={3} />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={-34 + (i % 2) * 8} y={-52 + i * 11} width={22 + ((i * 17 + Math.floor(t * 6)) % 40)} height={5} rx={2} fill={i === 3 ? C.ok : "#7fb8ff"} opacity={0.9} />
        ))}
        <rect x={-62} y={0} width={124} height={9} rx={4} fill="#3b4549" />
      </g>
    );
  if (what === "megaphone")
    return (
      <g transform={`translate(${70 * f} -70) scale(${f} 1)`}>
        <path d="M 0 -10 L 50 -30 L 50 30 L 0 10 Z" fill="#ff6b62" />
        <rect x={-14} y={-12} width={16} height={24} rx={4} fill="#c94a43" />
        {[0, 1, 2].map((i) => {
          const k = ((t * 2 + i / 3) % 1);
          return <path key={i} d={`M ${62 + k * 40} -24 Q ${74 + k * 40} 0 ${62 + k * 40} 24`} stroke="#fff" strokeWidth={4} fill="none" opacity={1 - k} strokeLinecap="round" />;
        })}
      </g>
    );
  if (what === "bag")
    return (
      <g transform={`translate(${78 * f} -10)`}>
        <path d="M -30 0 C -40 -40 -20 -56 -8 -60 L 8 -60 C 20 -56 40 -40 30 0 Z" fill="#c9a26a" stroke="#8a6a3c" strokeWidth={3} />
        <path d="M -10 -60 L -14 -70 L 14 -70 L 10 -60" fill="#8a6a3c" />
        <text x={0} y={-18} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={26} fill="#6b4c22">K</text>
      </g>
    );
  return (
    <g transform={`translate(${86 * f} -84) rotate(${-30 * f})`}>
      <line x1={0} y1={26} x2={0} y2={70} stroke="#8a6a3c" strokeWidth={10} strokeLinecap="round" />
      <circle cx={0} cy={0} r={28} fill="rgba(160,220,255,0.25)" stroke="#d8dee0" strokeWidth={7} />
      <path d="M -12 -12 Q -4 -20 6 -18" stroke="#fff" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.8} />
    </g>
  );
};

/// A KEPT token: gold, stamped K, spinning around its vertical axis.
export const Coin: React.FC<{ x: number; y: number; r?: number; spin?: number; opacity?: number; rot?: number }> = ({ x, y, r = 26, spin = 0, opacity = 1, rot = 0 }) => {
  const c = Math.cos(spin);
  const face = Math.abs(c);
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`} opacity={opacity}>
      <ellipse cx={0} cy={0} rx={Math.max(r * 0.16, r * face)} ry={r} fill="#b77b08" />
      <ellipse cx={0} cy={0} rx={r * face * 0.94} ry={r * 0.94} fill="url(#coin)" />
      {face > 0.3 ? (
        <>
          <ellipse cx={0} cy={0} rx={r * face * 0.72} ry={r * 0.72} fill="none" stroke="#fff3c4" strokeOpacity={0.55} strokeWidth={r * 0.08} />
          <text x={0} y={r * 0.36} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={r * 1.0} fill="#9a6200" transform={`scale(${c >= 0 ? face : -face} 1)`}>
            K
          </text>
        </>
      ) : null}
    </g>
  );
};

/// One of the swarm: a small robot with a single eye.
export const Agent: React.FC<{ x: number; y: number; t: number; s?: number; state?: "idle" | "scan" | "yes" | "no"; seed?: number; look?: number; opacity?: number; tilt?: number }> = ({
  x,
  y,
  t,
  s = 1,
  state = "idle",
  seed = 0,
  look = 0,
  opacity = 1,
  tilt = 0,
}) => {
  const hover = Math.sin(t * 4 + seed * 2) * 6;
  const col = state === "no" ? C.alarm : C.ok;
  const scanX = state === "scan" ? Math.sin(t * 9 + seed) * 16 : look * 12;
  return (
    <g transform={`translate(${x} ${y + hover}) rotate(${tilt}) scale(${s})`} opacity={opacity}>
      <ellipse cx={0} cy={72 - hover} rx={34 - hover} ry={7} fill={col} opacity={0.18} />
      <path d={`M -12 40 L 0 ${56 + Math.sin(t * 40 + seed) * 5} L 12 40 Z`} fill={col} opacity={0.7} filter="url(#glow)" />
      <line x1={0} y1={-40} x2={0} y2={-62} stroke="#59665f" strokeWidth={5} />
      <circle cx={0} cy={-66} r={7} fill={col} opacity={0.6 + 0.4 * Math.sin(t * 6 + seed)} filter="url(#glow)" />
      <rect x={-60} y={-14} width={14} height={30} rx={5} fill="#2c3632" />
      <rect x={46} y={-14} width={14} height={30} rx={5} fill="#2c3632" />
      <rect x={-50} y={-40} width={100} height={82} rx={24} fill="url(#metal)" stroke={col} strokeOpacity={0.55} strokeWidth={3} />
      <rect x={-38} y={-27} width={76} height={50} rx={15} fill="#020403" />
      {state === "yes" ? (
        <path d="M -16 -2 L -4 10 L 18 -14" stroke={col} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#glow)" />
      ) : state === "no" ? (
        <path d="M -12 -12 L 12 12 M 12 -12 L -12 12" stroke={col} strokeWidth={7} strokeLinecap="round" fill="none" filter="url(#glow)" />
      ) : (
        <rect x={-17 + scanX} y={-8} width={34} height={13} rx={6.5} fill={col} filter="url(#glow)" />
      )}
    </g>
  );
};

export const Padlock: React.FC<{ x: number; y: number; s?: number; open?: number; color?: string }> = ({ x, y, s = 1, open = 0, color = "#f6c445" }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d={`M -14 ${-4 - open * 14} L -14 -20 A 14 14 0 0 1 14 -20 L 14 ${-4 - (open > 0.5 ? 14 : 0)}`} stroke="#c9cfcc" strokeWidth={7} fill="none" transform={`rotate(${open * -25} 14 -4)`} />
    <rect x={-22} y={-6} width={44} height={34} rx={7} fill={color} />
    <circle cx={0} cy={8} r={4.5} fill="#000" opacity={0.5} />
    <rect x={-2} y={8} width={4} height={10} fill="#000" opacity={0.5} />
  </g>
);

export type IconName = "tag" | "page" | "cube" | "gauge" | "chain";
export const Icon: React.FC<{ name: IconName; x: number; y: number; s?: number; color?: string }> = ({ name, x, y, s = 1, color = "#fff" }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} stroke={color} strokeWidth={4.5} fill="none" strokeLinejoin="round" strokeLinecap="round">
    {name === "tag" ? (
      <>
        <path d="M -22 -22 L 2 -22 L 24 0 L 2 22 L -22 -2 Z" />
        <circle cx={-10} cy={-10} r={3.5} fill={color} />
      </>
    ) : null}
    {name === "page" ? (
      <>
        <rect x={-24} y={-20} width={48} height={40} rx={4} />
        <path d="M -24 -10 L 24 -10" />
        <path d="M -14 0 L 10 0 M -14 9 L 4 9" />
      </>
    ) : null}
    {name === "cube" ? (
      <>
        <path d="M 0 -24 L 22 -12 L 22 12 L 0 24 L -22 12 L -22 -12 Z" />
        <path d="M -22 -12 L 0 0 L 22 -12 M 0 0 L 0 24" />
      </>
    ) : null}
    {name === "gauge" ? (
      <>
        <path d="M -24 12 A 24 24 0 1 1 24 12" />
        <path d="M 0 6 L 12 -12" />
        <circle cx={0} cy={6} r={3.5} fill={color} />
      </>
    ) : null}
    {name === "chain" ? (
      <>
        <rect x={-26} y={-10} width={28} height={20} rx={10} />
        <rect x={-2} y={-10} width={28} height={20} rx={10} />
      </>
    ) : null}
  </g>
);

/// A speech bubble that pops in at `at` and out at `until`.
export const Bubble: React.FC<{ x: number; y: number; t: number; at: number; until?: number; text: string; size?: number; color?: string; ink?: string; tail?: "left" | "right" | "down" }> = ({
  x,
  y,
  t,
  at,
  until = 1e9,
  text,
  size = 30,
  color = "#fff",
  ink = "#111",
  tail = "down",
}) => {
  const p = pop(t, at, 0.4) * (1 - tw(t, until, until + 0.25));
  if (p <= 0.001) return null;
  const w = text.length * size * 0.62 + 40;
  const h = size + 30;
  const tx = tail === "left" ? -w / 2 + 26 : tail === "right" ? w / 2 - 26 : 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${p})`}>
      <rect x={-w / 2} y={-h} width={w} height={h} rx={h / 2} fill={color} />
      <path d={`M ${tx - 12} -4 L ${tx + (tail === "left" ? -14 : tail === "right" ? 14 : 0)} 20 L ${tx + 12} -4 Z`} fill={color} />
      <text x={0} y={-h / 2 + size * 0.36} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={size} fill={ink}>
        {text}
      </text>
    </g>
  );
};

/// Burst of confetti from (x, y) at `at`.
export const Confetti: React.FC<{ x: number; y: number; t: number; at: number; n?: number; spread?: number; seed?: number }> = ({ x, y, t, at, n = 70, spread = 1, seed = 0 }) => {
  const u = t - at;
  if (u < 0 || u > 3.2) return null;
  const cols = [C.ok, "#f6c445", "#7fb8ff", "#ff9cc0", "#fff", "#c3adff"];
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const a = -Math.PI / 2 + (rnd(i + seed) - 0.5) * Math.PI * 1.3;
        const v = (500 + rnd(i * 3 + seed) * 700) * spread;
        const px = x + Math.cos(a) * v * u * 0.9;
        const py = y + Math.sin(a) * v * u + 900 * u * u;
        const r = (rnd(i * 7 + seed) * 720 + u * 600) % 360;
        return <rect key={i} x={px - 6} y={py - 3} width={12} height={6 + rnd(i + 2) * 8} fill={cols[i % cols.length]} transform={`rotate(${r} ${px} ${py})`} opacity={1 - tw(t, at + 2.2, at + 3.2)} rx={2} />;
      })}
    </g>
  );
};

/// A puff of dust where something lands.
export const Dust: React.FC<{ x: number; y: number; t: number; at: number; w?: number }> = ({ x, y, t, at, w = 1 }) => {
  const u = t - at;
  if (u < 0 || u > 0.9) return null;
  return (
    <g opacity={1 - u / 0.9}>
      {Array.from({ length: 10 }, (_, i) => {
        const side = i % 2 ? 1 : -1;
        const d = (60 + rnd(i) * 160) * w * tw(t, at, at + 0.7);
        return <circle key={i} cx={x + side * d} cy={y - rnd(i + 4) * 30 * u * 3} r={(10 + rnd(i + 2) * 16) * (0.6 + u)} fill="#cfd6d2" opacity={0.25} />;
      })}
    </g>
  );
};

/// A four-pointed sparkle.
export const Sparkle: React.FC<{ x: number; y: number; t: number; at: number; size?: number; color?: string }> = ({ x, y, t, at, size = 40, color = "#fff" }) => {
  const u = t - at;
  if (u < 0 || u > 0.8) return null;
  const k = Math.sin((u / 0.8) * Math.PI);
  const r = size * k;
  return <path d={`M ${x} ${y - r} Q ${x} ${y} ${x + r} ${y} Q ${x} ${y} ${x} ${y + r} Q ${x} ${y} ${x - r} ${y} Q ${x} ${y} ${x} ${y - r} Z`} fill={color} transform={`rotate(${u * 90} ${x} ${y})`} filter="url(#glow)" />;
};

/// Flames rising from a line `w` wide, at strength `k` (0 to 1).
export const Fire: React.FC<{ x: number; y: number; t: number; k: number; w?: number }> = ({ x, y, t, k, w = 300 }) => {
  if (k <= 0.01) return null;
  return (
    <g style={{ mixBlendMode: "screen" }}>
      <ellipse cx={x} cy={y - 20} rx={w * 0.6} ry={60 * k} fill="#ff6b2a" opacity={0.25 * k} filter="url(#soft)" />
      {Array.from({ length: 46 }, (_, i) => {
        const period = 0.7 + rnd(i) * 0.6;
        const u = ((t + rnd(i + 1) * 3) % period) / period;
        const px = x + (rnd(i + 2) - 0.5) * w + Math.sin(t * 6 + i) * 10 * u;
        const py = y - u * (140 + rnd(i + 3) * 160) * k;
        const r = (26 + rnd(i + 4) * 22) * (1 - u) * k;
        const col = u < 0.3 ? "#fff1a8" : u < 0.6 ? "#ffb23d" : "#ff5a3c";
        return <circle key={i} cx={px} cy={py} r={Math.max(0, r)} fill={col} opacity={(1 - u) * 0.85} />;
      })}
    </g>
  );
};
