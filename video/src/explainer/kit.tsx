import React from "react";
import { AbsoluteFill } from "remotion";
import { C, F, SPRING } from "../theme";
import { tw, useSeconds } from "../time";
import timeline from "./timeline.json";

export { tw, useSeconds };

type Line = { id: string; scene: string; start: number; end: number; caption: string };
export const TL = timeline as { fps: number; duration: number; frames: number; scenes: { id: string; start: number; end: number }[]; lines: Line[] };
export const scene = (id: string) => TL.scenes.find((s) => s.id === id)!;
export const line = (id: string) => TL.lines.find((l) => l.id === id)!;

/// Words of a caption with their weights: letters, plus a breath after punctuation.
function weighted(caption: string) {
  const words = caption.split(" ");
  const w = words.map((x) => x.length + 1 + (/[.?!]$/.test(x) ? 6 : /[,:]$/.test(x) ? 3 : 0));
  return { words, w, total: w.reduce((a, b) => a + b, 0) };
}

/// When a word is spoken, estimated from its place in the line.
export function wt(id: string, word: string, nth = 0): number {
  const l = line(id);
  const { words, w, total } = weighted(l.caption);
  let acc = 0;
  let seen = 0;
  for (let i = 0; i < words.length; i++) {
    if (words[i].replace(/[^\w']/g, "").toLowerCase() === word.toLowerCase()) {
      if (seen === nth) return l.start + (acc / total) * (l.end - l.start);
      seen++;
    }
    acc += w[i];
  }
  throw new Error(`"${word}" is not in ${id}`);
}

/// Every word's start time in a line.
export function wordTimes(id: string): number[] {
  const l = line(id);
  const { w, total } = weighted(l.caption);
  let acc = 0;
  return w.map((x) => {
    const at = l.start + (acc / total) * (l.end - l.start);
    acc += x;
    return at;
  });
}

export const BEAT = 60 / 112;
export const bob = (t: number, ph = 0) => Math.sin((t / BEAT + ph) * Math.PI * 2);
export const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/// 0 to 1 with an overshoot: the springy entrance every element uses.
export const pop = (t: number, at: number, d = 0.5) => tw(t, at, at + d, 0, 1, SPRING);

/// A fall from `h` pixels above that lands at `at + 0.38` and bounces twice.
export function drop(t: number, at: number, h = 700) {
  const u = t - at;
  const fall = 0.38;
  if (u < 0) return -h;
  if (u < fall) return -h * (1 - (u / fall) ** 2);
  const v = u - fall;
  return -Math.abs(Math.sin(v * 9)) * 70 * Math.exp(-v * 6);
}
/// The squash after a landing: positive is flatter.
export const thud = (t: number, landAt: number) => (t < landAt ? 0 : 0.28 * Math.exp(-(t - landAt) * 9) * Math.cos((t - landAt) * 22));

/// The room: near black, one coloured spotlight, a floor, slow dust.
export const Stage: React.FC<{ light?: string; at?: [number, number]; floor?: number }> = ({ light = "rgba(62,207,122,0.16)", at = [50, 38], floor = 860 }) => {
  const t = useSeconds();
  return (
    <AbsoluteFill style={{ background: "#060807" }}>
      <AbsoluteFill style={{ background: `radial-gradient(1100px 760px at ${at[0] + Math.sin(t * 0.3) * 3}% ${at[1]}%, ${light}, transparent 70%)` }} />
      <AbsoluteFill style={{ top: floor, background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0) 60%)", borderTop: "1px solid rgba(255,255,255,0.07)" }} />
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {Array.from({ length: 34 }, (_, i) => {
          const x = (rnd(i) * 1920 + t * (8 + rnd(i + 9) * 14)) % 1920;
          const y = (rnd(i + 3) * 900 - t * (5 + rnd(i + 5) * 10) + 2000) % 900;
          return <circle key={i} cx={x} cy={y} r={1 + rnd(i + 7) * 1.8} fill="#fff" opacity={0.05 + rnd(i + 11) * 0.08} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

/// A headline that pops in word by word; accent words take a colour.
export const Kinetic: React.FC<{
  text: string;
  t: number;
  at: number | number[];
  size?: number;
  accent?: Record<string, string>;
  out?: number;
  weight?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ text, t, at, size = 96, accent = {}, out, weight = 600, color = C.ink, style }) => {
  const words = text.split(" ");
  const gone = out === undefined ? 0 : tw(t, out, out + 0.35);
  return (
    <div style={{ fontFamily: F.mono, fontWeight: weight, fontSize: size, lineHeight: 1.08, letterSpacing: "-0.04em", color, textAlign: "center", opacity: 1 - gone, transform: `scale(${1 - gone * 0.1})`, ...style }}>
      {words.map((w, i) => {
        const a = Array.isArray(at) ? at[Math.min(i, at.length - 1)] : at + i * 0.09;
        const p = pop(t, a, 0.45);
        const hue = accent[w.replace(/[^\w']/g, "")];
        return (
          <span key={i} style={{ display: "inline-block", transform: `translateY(${(1 - p) * 40}px) scale(${0.4 + 0.6 * p}) rotate(${(1 - p) * -8}deg)`, opacity: Math.min(1, p * 1.5), color: hue, marginRight: i < words.length - 1 ? "0.32em" : 0, position: "relative" }}>
            {w}
            {hue ? <span style={{ position: "absolute", left: 0, right: 0, bottom: "-0.06em", height: "0.09em", background: hue, transformOrigin: "0 50%", transform: `scaleX(${tw(t, a + 0.2, a + 0.6)})`, borderRadius: 4 }} /> : null}
          </span>
        );
      })}
    </div>
  );
};

/// Captions for the muted feed: the line in short phrases, the spoken word lit.
export const Captions: React.FC = () => {
  const t = useSeconds();
  const l = TL.lines.find((x) => t >= x.start - 0.1 && t < x.end + 0.3);
  if (!l) return null;
  const { words, w, total } = weighted(l.caption);
  // phrases of at most ~6 words, cut at punctuation where possible
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
  const o = Math.min(tw(t, l.start - 0.1, l.start + 0.1), 1 - tw(t, l.end + 0.1, l.end + 0.3));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 44, display: "flex", justifyContent: "center", opacity: o }}>
      <div style={{ fontFamily: F.mono, fontSize: 34, fontWeight: 500, padding: "10px 22px", borderRadius: 14, background: "rgba(0,0,0,0.78)", border: "1px solid rgba(255,255,255,0.12)" }}>
        {ph.map((i) => {
          const on = t >= starts[i] - 0.04;
          const p = tw(t, starts[i] - 0.04, starts[i] + 0.12);
          return (
            <span key={i} style={{ color: on ? C.ink : "rgba(255,255,255,0.38)", display: "inline-block", transform: `translateY(${-3 * p * (1 - tw(t, starts[i] + 0.12, starts[i] + 0.3))}px)`, marginRight: i === ph[ph.length - 1] ? 0 : "0.4em" }}>
              {words[i]}
            </span>
          );
        })}
      </div>
    </div>
  );
};
