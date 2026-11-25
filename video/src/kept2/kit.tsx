import React from "react";
import { AbsoluteFill } from "remotion";
import { SPRING, OUT, INOUT } from "../theme";
import { tw, useSeconds } from "../time";
import timeline from "./timeline.json";

/// KEPT 2.0, the film: bright colour fields, sticker cards with ink outlines and hard shadows,
/// condensed headlines that pop word by word, and an iris of colour between acts.

export { tw, useSeconds, SPRING, OUT, INOUT };

type Line = { id: string; scene: string; start: number; end: number; caption: string };
export const TL = timeline as { fps: number; duration: number; frames: number; scenes: { id: string; start: number; end: number }[]; lines: Line[] };
export const scene = (id: string) => TL.scenes.find((s) => s.id === id)!;
export const line = (id: string) => TL.lines.find((l) => l.id === id)!;
export const L = (id: string) => line(id).start;
export const LE = (id: string) => line(id).end;

function weighted(caption: string) {
  const words = caption.split(" ");
  const w = words.map((x) => x.length + 1 + (/[.?!]$/.test(x) ? 6 : /[,:]$/.test(x) ? 3 : 0));
  return { words, w, total: w.reduce((a, b) => a + b, 0) };
}
/// When a word is spoken, estimated from its place in the line (the mix uses the same rule).
export function wt(id: string, word: string, nth = 0): number {
  const l = line(id);
  const { words, w, total } = weighted(l.caption);
  let acc = 0;
  let seen = 0;
  for (let i = 0; i < words.length; i++) {
    if (words[i].replace(/[^\w'%.]/g, "").replace(/\.$/, "").toLowerCase() === word.toLowerCase()) {
      if (seen === nth) return l.start + (acc / total) * (l.end - l.start);
      seen++;
    }
    acc += w[i];
  }
  throw new Error(`"${word}" is not in ${id}`);
}

// ---------------------------------------------------------------------------------- palette
export const P = {
  ink: "#16112e",
  cream: "#fff6e6",
  white: "#ffffff",
  yellow: "#ffd23f",
  sun: "#ffb400",
  coral: "#ff5d5d",
  red: "#ff3b4e",
  violet: "#7b5cff",
  mint: "#2ee6a8",
  green: "#16c172",
  blue: "#2f6bff",
  sky: "#7cc4ff",
  pink: "#ff6fb5",
  orange: "#ff8a2a",
  cyan: "#1fd1f9",
  tg: "#2aa3ef",
  lime: "#b8f03c",
  grape: "#5b2bd6",
  amber: "#ffb020",
  grey: "#a3a8bf",
};
export const TONE = { red: P.red, amber: P.amber, green: P.green, grey: P.grey };

export const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
export const pop = (t: number, at: number, d = 0.5) => tw(t, at, at + d, 0, 1, SPRING);
export const BPM = 120;
export const BEAT = 60 / BPM;
/// a little bounce on the beat, for things that dance
export const bounce = (t: number, ph = 0) => Math.abs(Math.sin(((t / BEAT + ph) % 1) * Math.PI));
export const FONT = {
  head: "Archivo, 'Arial Narrow', sans-serif",
  text: "Inter, system-ui, sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

// ---------------------------------------------------------------------------------- the field
type Shape = "circle" | "ring" | "squiggle" | "tri" | "plus" | "half" | "star" | "pill" | "dots";
const SHAPES: Shape[] = ["circle", "ring", "squiggle", "tri", "plus", "half", "star", "pill", "dots"];

const ShapeArt: React.FC<{ kind: Shape; c: string; s: number }> = ({ kind, c, s }) => {
  const k = s;
  switch (kind) {
    case "circle":
      return <circle r={22 * k} fill={c} />;
    case "ring":
      return <circle r={22 * k} fill="none" stroke={c} strokeWidth={9 * k} />;
    case "squiggle":
      return <path d={`M ${-40 * k} 0 q ${10 * k} ${-18 * k} ${20 * k} 0 t ${20 * k} 0 t ${20 * k} 0 t ${20 * k} 0`} stroke={c} strokeWidth={9 * k} fill="none" strokeLinecap="round" />;
    case "tri":
      return <path d={`M 0 ${-26 * k} L ${24 * k} ${16 * k} L ${-24 * k} ${16 * k} Z`} fill={c} strokeLinejoin="round" />;
    case "plus":
      return <path d={`M 0 ${-22 * k} V ${22 * k} M ${-22 * k} 0 H ${22 * k}`} stroke={c} strokeWidth={10 * k} strokeLinecap="round" />;
    case "half":
      return <path d={`M ${-26 * k} 0 A ${26 * k} ${26 * k} 0 0 1 ${26 * k} 0 Z`} fill={c} />;
    case "star": {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const r = (i % 2 ? 11 : 26) * k;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        return `${Math.cos(a) * r},${Math.sin(a) * r}`;
      }).join(" ");
      return <polygon points={pts} fill={c} strokeLinejoin="round" />;
    }
    case "pill":
      return <rect x={-30 * k} y={-11 * k} width={60 * k} height={22 * k} rx={11 * k} fill={c} />;
    case "dots":
      return (
        <g fill={c}>
          {[0, 1, 2].map((i) => [0, 1, 2].map((j) => <circle key={`${i}${j}`} cx={(i - 1) * 16 * k} cy={(j - 1) * 16 * k} r={4 * k} />))}
        </g>
      );
  }
};

/// A bright colour field: a base, two drifting glows and a confetti of playful shapes.
export const Field: React.FC<{ base: string; glow?: [string, string]; shapes?: string[]; seed?: number; n?: number; dots?: boolean; calm?: number }> = ({
  base,
  glow = ["rgba(255,255,255,0.35)", "rgba(0,0,0,0.12)"],
  shapes = [P.white, P.ink],
  seed = 0,
  n = 22,
  dots = true,
  calm = 1,
}) => {
  const t = useSeconds();
  return (
    <AbsoluteFill style={{ background: base, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(900px 700px at ${30 + Math.sin(t * 0.35 + seed) * 8}% ${28 + Math.cos(t * 0.3) * 6}%, ${glow[0]}, transparent 70%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(1000px 800px at ${78 + Math.cos(t * 0.28 + seed) * 7}% ${82 + Math.sin(t * 0.33) * 5}%, ${glow[1]}, transparent 70%)` }} />
      {dots ? (
        <svg width={1920} height={1080} style={{ position: "absolute", opacity: 0.16 }}>
          <defs>
            <pattern id={`dots-${seed}`} width={34} height={34} patternUnits="userSpaceOnUse" patternTransform={`translate(${(t * 6) % 34} ${(t * 4) % 34})`}>
              <circle cx={4} cy={4} r={2.6} fill={P.ink} />
            </pattern>
          </defs>
          <rect width={1920} height={1080} fill={`url(#dots-${seed})`} />
        </svg>
      ) : null}
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {Array.from({ length: n }, (_, i) => {
          const r = (k: number) => rnd(seed * 97 + i * 13 + k);
          const depth = 0.5 + r(1) * 1.1;
          const x = (r(2) * 2200 - 140 + t * 14 * depth * calm * (r(3) > 0.5 ? 1 : -1) + 2200) % 2200 - 140;
          const y = r(4) * 1180 - 50 + Math.sin(t * (0.6 + r(5)) * calm + i) * 26 * depth;
          const rot = r(6) * 360 + t * (r(7) - 0.5) * 70 * calm;
          const kind = SHAPES[Math.floor(r(8) * SHAPES.length)];
          const c = shapes[Math.floor(r(9) * shapes.length)];
          return (
            <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`} opacity={0.5 + r(10) * 0.45}>
              <ShapeArt kind={kind} c={c} s={depth} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------- type
/// A condensed headline that pops in word by word; words in `accent` take a highlight chip.
export const Title: React.FC<{
  text: string;
  t: number;
  at: number | number[];
  size?: number;
  color?: string;
  accent?: Record<string, string>;
  accentInk?: string;
  out?: number;
  shadow?: string | null;
  align?: "center" | "left";
  style?: React.CSSProperties;
  stagger?: number;
}> = ({ text, t, at, size = 140, color = P.white, accent = {}, accentInk = P.ink, out, shadow = P.ink, align = "center", style, stagger = 0.08 }) => {
  const words = text.split(" ");
  const gone = out === undefined ? 0 : tw(t, out, out + 0.35, 0, 1, INOUT);
  return (
    <div
      style={{
        fontFamily: FONT.head,
        fontStretch: "72%",
        fontWeight: 850,
        fontSize: size,
        lineHeight: 0.92,
        textTransform: "uppercase",
        letterSpacing: "-0.005em",
        color,
        textAlign: align,
        opacity: 1 - gone,
        transform: `translateY(${gone * -40}px) scale(${1 - gone * 0.06})`,
        ...style,
      }}
    >
      {words.map((w, i) => {
        if (w === "/") return <br key={i} />;
        const a = Array.isArray(at) ? at[Math.min(i, at.length - 1)] : at + i * stagger;
        const p = pop(t, a, 0.5);
        const key = w.replace(/[^\w'%.+=]/g, "").replace(/\.+$/, "");
        const hue = accent[key];
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              position: "relative",
              transform: `translateY(${(1 - p) * 60}px) scale(${0.3 + 0.7 * p}) rotate(${(1 - p) * -10}deg)`,
              opacity: Math.min(1, p * 1.6),
              marginRight: i < words.length - 1 ? "0.22em" : 0,
              padding: hue ? "0.02em 0.14em 0.04em" : 0,
              color: hue ? accentInk : undefined,
              textShadow: hue || !shadow ? "none" : `0.05em 0.05em 0 ${shadow}`,
            }}
          >
            {hue ? (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  background: hue,
                  borderRadius: "0.12em",
                  zIndex: -1,
                  transformOrigin: "0 50%",
                  transform: `scaleX(${tw(t, a + 0.1, a + 0.45, 0, 1, OUT)}) rotate(-1.5deg)`,
                  boxShadow: `0.05em 0.05em 0 ${P.ink}`,
                }}
              />
            ) : null}
            <span style={{ position: "relative" }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
};

/// A white sticker card: ink outline, rounded, with a hard offset shadow.
export const Card: React.FC<{ x: number; y: number; w: number; h?: number; bg?: string; r?: number; children?: React.ReactNode; style?: React.CSSProperties; shadow?: number }> = ({
  x,
  y,
  w,
  h,
  bg = P.white,
  r = 30,
  children,
  style,
  shadow = 12,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      background: bg,
      border: `6px solid ${P.ink}`,
      borderRadius: r,
      boxShadow: `${shadow}px ${shadow}px 0 ${P.ink}`,
      boxSizing: "border-box",
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

/// A rounded tag in a verdict colour.
export const Chip: React.FC<{ color: string; text: string; size?: number; ink?: string; style?: React.CSSProperties }> = ({ color, text, size = 30, ink = P.ink, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: size * 0.4,
      background: color,
      color: ink,
      border: `5px solid ${P.ink}`,
      borderRadius: 999,
      padding: `${size * 0.25}px ${size * 0.7}px`,
      fontFamily: FONT.head,
      fontStretch: "80%",
      fontWeight: 800,
      fontSize: size,
      textTransform: "uppercase",
      boxShadow: `5px 5px 0 ${P.ink}`,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {text}
  </div>
);

/// A number that counts up, tabular.
export const Count: React.FC<{ t: number; at: number; to: number; d?: number; fmt?: (n: number) => string; style?: React.CSSProperties }> = ({ t, at, to, d = 1.1, fmt, style }) => {
  const v = to * tw(t, at, at + d, 0, 1, OUT);
  const s = fmt ? fmt(v) : Math.round(v).toLocaleString("en-US");
  return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{s}</span>;
};

/// Enter with a springy pop from a direction, leave on `out`.
export function enter(t: number, at: number, out?: number, from: [number, number] = [0, 80]) {
  const p = pop(t, at, 0.6);
  const g = out === undefined ? 0 : tw(t, out, out + 0.4, 0, 1, INOUT);
  return {
    opacity: Math.min(1, p * 1.5) * (1 - g),
    transform: `translate(${(1 - p) * from[0] + g * from[0] * -0.5}px, ${(1 - p) * from[1] - g * 40}px) scale(${0.6 + 0.4 * p - g * 0.08})`,
  };
}

// ---------------------------------------------------------------------------------- captions
export const Captions: React.FC = () => {
  const t = useSeconds();
  const l = TL.lines.find((x) => t >= x.start - 0.1 && t < x.end + 0.35);
  if (!l) return null;
  const { words, w, total } = weighted(l.caption);
  const phrases: number[][] = [];
  let cur: number[] = [];
  words.forEach((x, i) => {
    cur.push(i);
    if (/[.?!,]$/.test(x) || cur.length >= 6) {
      phrases.push(cur);
      cur = [];
    }
  });
  if (cur.length) phrases.push(cur);
  const starts: number[] = [];
  let acc = 0;
  for (let i = 0; i < words.length; i++) {
    starts.push(l.start + (acc / total) * (l.end - l.start));
    acc += w[i];
  }
  let k = 0;
  for (let i = 0; i < phrases.length; i++) if (t >= starts[phrases[i][0]] - 0.05) k = i;
  const ph = phrases[k];
  const o = Math.min(tw(t, l.start - 0.1, l.start + 0.1), 1 - tw(t, l.end + 0.15, l.end + 0.35));
  const kp = pop(t, starts[ph[0]] - 0.05, 0.3);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 40, display: "flex", justifyContent: "center", opacity: o }}>
      <div
        style={{
          fontFamily: FONT.text,
          fontSize: 36,
          fontWeight: 700,
          padding: "12px 26px 14px",
          borderRadius: 20,
          background: P.white,
          color: P.ink,
          border: `5px solid ${P.ink}`,
          boxShadow: `7px 7px 0 ${P.ink}`,
          transform: `scale(${0.92 + 0.08 * kp})`,
          letterSpacing: "-0.01em",
        }}
      >
        {ph.map((i) => {
          const on = t >= starts[i] - 0.04;
          const lit = on && (i === ph[ph.length - 1] || t < starts[i + 1] - 0.04);
          return (
            <span key={i} style={{ position: "relative", display: "inline-block", marginRight: i === ph[ph.length - 1] ? 0 : "0.32em", color: on ? P.ink : "rgba(22,17,46,0.3)" }}>
              {lit ? <span style={{ position: "absolute", inset: "-2px -6px", background: P.yellow, borderRadius: 8, zIndex: 0 }} /> : null}
              <span style={{ position: "relative" }}>{words[i]}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
