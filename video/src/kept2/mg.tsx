import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { INOUT, OUT, tw } from "./kit";

/// The motion system for the KEPT 2.0 film: vivid gradient fields with grain, an editorial serif,
/// the real KEPT app in a floating window with a camera that pushes in, a cursor, focus blur.

export const SERIF = "'Instrument Serif', 'Newsreader', Georgia, serif";
export const SANS = "Inter, system-ui, sans-serif";
export const MONO = "'IBM Plex Mono', monospace";
export const HEAD = "Archivo, 'Arial Narrow', sans-serif";

export const V = {
  red: "#ef3b4f",
  amber: "#f5a524",
  green: "#19b46b",
  grey: "#9aa0b4",
  ink: "#0f0d1a",
};

const clamp = (x: number) => Math.max(0, Math.min(1, x));

// ---------------------------------------------------------------------------------- gradient field
/// Four soft colour pools drifting over a base, then grain. `k` fades the whole field in.
export const Mesh: React.FC<{ t: number; colors: string[]; base?: string; seed?: number; k?: number; grain?: number }> = ({ t, colors, base = "#ffffff", seed = 0, k = 1, grain = 0.07 }) => {
  const pos = [
    [18, 22],
    [82, 18],
    [78, 86],
    [16, 82],
  ];
  return (
    <AbsoluteFill style={{ background: base, overflow: "hidden" }}>
      <AbsoluteFill style={{ opacity: k, filter: "blur(40px)", transform: "scale(1.15)" }}>
        {colors.map((c, i) => {
          const [x, y] = pos[i % 4];
          const dx = Math.sin(t * 0.21 + i * 1.7 + seed) * 9;
          const dy = Math.cos(t * 0.17 + i * 2.3 + seed) * 8;
          return (
            <AbsoluteFill
              key={i}
              style={{ background: `radial-gradient(${900 + (i % 2) * 260}px ${720 + (i % 3) * 120}px at ${x + dx}% ${y + dy}%, ${c} 0%, ${c}00 70%)` }}
            />
          );
        })}
      </AbsoluteFill>
      <Grain amount={grain} />
    </AbsoluteFill>
  );
};

export const Grain: React.FC<{ amount?: number }> = ({ amount = 0.07 }) => (
  <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: amount, mixBlendMode: "overlay" }}>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width={1920} height={1080} filter="url(#grain)" />
  </svg>
);

// ---------------------------------------------------------------------------------- type
/// Words rise out of a blur, one after another. `*word*` is set in italic, in `accent`.
export const Words: React.FC<{
  text: string;
  t: number;
  at: number;
  out?: number;
  size?: number;
  color?: string;
  accent?: string;
  stagger?: number;
  align?: "left" | "center" | "right";
  font?: string;
  weight?: number;
  style?: React.CSSProperties;
  lh?: number;
  tracking?: string;
}> = ({ text, t, at, out, size = 96, color = "#fff", accent, stagger = 0.07, align = "center", font = SERIF, weight = 400, style, lh = 1.02, tracking = "-0.01em" }) => {
  const words = text.split(" ");
  const gone = out === undefined ? 0 : tw(t, out, out + 0.5, 0, 1, INOUT);
  let n = 0;
  // `*a few words*` is one italic run
  let open = false;
  const italic = words.map((w) => {
    const starts = w.startsWith("*");
    const ends = /\*[.,!?]?$/.test(w);
    const on = open || starts;
    if (starts) open = true;
    if (ends) open = false;
    return on;
  });
  return (
    <div style={{ fontFamily: font, fontSize: size, fontWeight: weight, lineHeight: lh, letterSpacing: tracking, color, textAlign: align, ...style }}>
      {words.map((w, i) => {
        if (w === "/") return <br key={i} />;
        const it = italic[i];
        const word = w.replace(/\*/g, "");
        const a = at + n++ * stagger;
        const p = tw(t, a, a + 0.75, 0, 1, OUT);
        const blur = (1 - p) * 14 + gone * 16;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              marginRight: i < words.length - 1 ? "0.24em" : 0,
              opacity: p * (1 - gone),
              filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
              transform: `translateY(${(1 - p) * size * 0.28 - gone * size * 0.15}px)`,
              fontStyle: it ? "italic" : undefined,
              color: it && accent ? accent : undefined,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

/// A small uppercase label with a coloured dot.
export const Kicker: React.FC<{ t: number; at: number; out?: number; text: string; dot?: string; color?: string; style?: React.CSSProperties }> = ({ t, at, out, text, dot = "#fff", color = "rgba(255,255,255,0.85)", style }) => {
  const p = tw(t, at, at + 0.6, 0, 1, OUT) * (1 - (out === undefined ? 0 : tw(t, out, out + 0.4)));
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 14, fontFamily: SANS, fontWeight: 600, fontSize: 22, letterSpacing: "0.16em", textTransform: "uppercase", color, opacity: p, filter: `blur(${(1 - p) * 6}px)`, ...style }}>
      <span style={{ width: 10, height: 10, borderRadius: 5, background: dot, boxShadow: `0 0 16px ${dot}` }} />
      {text}
    </div>
  );
};

/// The chapter title in the lower third, with the chapter count on the right.
export const LowerThird: React.FC<{ t: number; at: number; out: number; title: string; sub: string; n: number; of?: number; color?: string; accent?: string }> = ({
  t,
  at,
  out,
  title,
  sub,
  n,
  of = 7,
  color = "#fff",
  accent = "#fff",
}) => {
  const p = tw(t, at, at + 0.8, 0, 1, OUT);
  const g = tw(t, out - 0.5, out, 0, 1, INOUT);
  if (p <= 0 || g >= 1) return null;
  return (
    <>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(10,8,20,0) 72%, rgba(10,8,20,0.28) 100%)", opacity: p * (1 - g) }} />
      <div style={{ position: "absolute", left: 96, bottom: 64, opacity: 1 - g, filter: g > 0 ? `blur(${g * 10}px)` : undefined }}>
        <Words text={title} t={t} at={at} size={58} color={color} accent={accent} align="left" stagger={0.06} />
        <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 500, color, opacity: 0.78 * tw(t, at + 0.4, at + 1.1), marginTop: 10, letterSpacing: "0.005em" }}>{sub}</div>
      </div>
      <div style={{ position: "absolute", right: 96, bottom: 74, display: "flex", alignItems: "center", gap: 18, opacity: p * (1 - g) }}>
        <div style={{ fontFamily: MONO, fontSize: 18, color, opacity: 0.8 }}>{String(n).padStart(2, "0")}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {Array.from({ length: of }, (_, i) => (
            <div key={i} style={{ width: 34, height: 3, borderRadius: 2, background: color, opacity: i < n - 1 ? 0.75 : i === n - 1 ? 0.25 + 0.75 * clamp((t - at) / Math.max(1, out - at)) : 0.22 }} />
          ))}
        </div>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------------- glass
export const Glass: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode; dark?: boolean; r?: number }> = ({ style, children, dark, r = 28 }) => (
  <div
    style={{
      background: dark ? "rgba(16,14,28,0.55)" : "rgba(255,255,255,0.72)",
      backdropFilter: "blur(30px) saturate(1.4)",
      WebkitBackdropFilter: "blur(30px) saturate(1.4)",
      border: dark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(255,255,255,0.75)",
      borderRadius: r,
      boxShadow: "0 30px 80px rgba(20,10,40,0.22), 0 4px 14px rgba(20,10,40,0.08)",
      ...style,
    }}
  >
    {children}
  </div>
);

/// Pop a block in from a blur.
export function rise(t: number, at: number, out?: number, dy = 40) {
  const p = tw(t, at, at + 0.7, 0, 1, OUT);
  const g = out === undefined ? 0 : tw(t, out, out + 0.45, 0, 1, INOUT);
  const b = (1 - p) * 16 + g * 16;
  return { opacity: p * (1 - g), transform: `translateY(${(1 - p) * dy - g * 20}px) scale(${0.96 + 0.04 * p})`, filter: b > 0.05 ? `blur(${b}px)` : undefined };
}

// ---------------------------------------------------------------------------------- camera
export type Cam = { t: number; cx: number; cy: number; z: number };
export function cam(t: number, ks: Cam[]): Cam {
  if (t <= ks[0].t) return ks[0];
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i];
    const b = ks[i + 1];
    if (t < b.t) {
      const e = INOUT(clamp((t - a.t) / (b.t - a.t)));
      return { t, cx: a.cx + (b.cx - a.cx) * e, cy: a.cy + (b.cy - a.cy) * e, z: a.z + (b.z - a.z) * e };
    }
  }
  return ks[ks.length - 1];
}

export type Rect = { x: number; y: number; w: number; h: number };
export type Focus = { t: number; r: Rect | null };
/// The focus at time t: a rect (in page px) and how strongly the rest is blurred.
export function focusAt(t: number, fs: Focus[]): { r: Rect | null; k: number } {
  let cur: Focus | null = null;
  let prev: Focus | null = null;
  for (const f of fs) if (t >= f.t) (prev = cur), (cur = f);
  if (!cur) return { r: null, k: 0 };
  const p = tw(t, cur.t, cur.t + 0.6, 0, 1, INOUT);
  if (!cur.r) return { r: prev?.r ?? null, k: prev?.r ? 1 - p : 0 };
  if (prev?.r) {
    const a = prev.r;
    const b = cur.r;
    return { r: { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.w + (b.w - a.w) * p, h: a.h + (b.h - a.h) * p }, k: 1 };
  }
  return { r: cur.r, k: p };
}

export type Shot = { at: number; src: string; h: number };

/// The KEPT app in a browser window. The camera names the page point at the window's centre and
/// a zoom (1 shows the page's full 1440px width). Pages swap with a blur dissolve.
export const Browser: React.FC<{
  t: number;
  shots: Shot[];
  view: Cam;
  focus?: { r: Rect | null; k: number };
  url: string;
  w?: number;
  h?: number;
  glow?: string;
  overlay?: (s: number, px: number, py: number) => React.ReactNode;
}> = ({ t, shots, view, focus, url, w = 1560, h = 900, glow = "#ffffff", overlay }) => {
  const BAR = 48;
  const VW = w;
  const VH = h - BAR;
  const s = view.z * (VW / 1440);
  const layer = (sh: Shot, o: number, b: number) => {
    const px = Math.max(0, Math.min(sh.h - VH / s, view.cy - VH / (2 * s)));
    const pxx = view.cx - VW / (2 * s);
    const img = (extra: React.CSSProperties) => (
      <Img src={staticFile(`kept2/${sh.src}.png`)} style={{ position: "absolute", left: -pxx * s, top: -px * s, width: 1440 * s, height: sh.h * s, maxWidth: "none", ...extra }} />
    );
    const f = focus?.r && focus.k > 0 ? focus : null;
    return (
      <AbsoluteFill key={sh.src + sh.at} style={{ opacity: o, filter: b > 0.05 ? `blur(${b}px)` : undefined }}>
        {f ? (
          <>
            {img({ filter: `blur(${f.k * 7}px)` })}
            <AbsoluteFill style={{ background: `rgba(250,249,252,${f.k * 0.5})` }} />
            <AbsoluteFill style={{ clipPath: `inset(${(f.r!.y - px) * s}px ${VW - (f.r!.x + f.r!.w - pxx) * s}px ${VH - (f.r!.y + f.r!.h - px) * s}px ${(f.r!.x - pxx) * s}px round ${12 * s}px)` }}>{img({})}</AbsoluteFill>
            <div
              style={{
                position: "absolute",
                left: (f.r!.x - pxx) * s - 8,
                top: (f.r!.y - px) * s - 8,
                width: f.r!.w * s + 16,
                height: f.r!.h * s + 16,
                borderRadius: 12 * s + 8,
                border: `2px solid ${glow}`,
                boxShadow: `0 0 0 6px ${glow}33, 0 24px 70px ${glow}55`,
                opacity: f.k,
              }}
            />
          </>
        ) : (
          img({})
        )}
        {overlay ? overlay(s, pxx, px) : null}
      </AbsoluteFill>
    );
  };
  // the current shot and, during a swap, the last one
  let i = 0;
  shots.forEach((sh, k) => t >= sh.at && (i = k));
  const cur = shots[i];
  const swap = i > 0 ? tw(t, cur.at, cur.at + 0.55, 0, 1, INOUT) : 1;
  return (
    <div style={{ width: w, height: h, borderRadius: 22, overflow: "hidden", background: "#f7f6f9", boxShadow: "0 60px 140px rgba(20,8,40,0.35), 0 10px 30px rgba(20,8,40,0.15), 0 0 0 1px rgba(255,255,255,0.5)" }}>
      <div style={{ height: BAR, background: "#ecebf0", display: "flex", alignItems: "center", padding: "0 20px", gap: 9, borderBottom: "1px solid #dddce3" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
        ))}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ width: 560, height: 30, borderRadius: 9, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: SANS, fontSize: 15, color: "#55525f" }}>
            <svg width={12} height={14}>
              <rect x={1.5} y={6} width={9} height={7} rx={1.5} fill="#8a8794" />
              <path d="M 3.5 6 V 4.5 a 2.5 2.5 0 0 1 5 0 V 6" stroke="#8a8794" strokeWidth={1.6} fill="none" />
            </svg>
            {url}
          </div>
        </div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ position: "relative", width: VW, height: VH, overflow: "hidden" }}>
        {i > 0 && swap < 1 ? layer(shots[i - 1], 1 - swap, swap * 14) : null}
        {layer(cur, swap, (1 - swap) * 14)}
      </div>
    </div>
  );
};

/// A window that rises toward the viewer in 3D.
export const Stage3D: React.FC<{ t: number; at: number; out?: number; children: React.ReactNode; x?: number; y?: number; scale?: number; tilt?: number; style?: React.CSSProperties }> = ({
  t,
  at,
  out,
  children,
  x = 0,
  y = 0,
  scale = 1,
  tilt = 0,
  style,
}) => {
  const p = tw(t, at, at + 1.3, 0, 1, OUT);
  const g = out === undefined ? 0 : tw(t, out, out + 0.7, 0, 1, INOUT);
  return (
    <AbsoluteFill style={{ perspective: 2400, perspectiveOrigin: "50% 40%" }}>
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `translate(${x}px, ${y + (1 - p) * 520 - g * 80}px) rotateX(${(1 - p) * 38 + tilt + g * -10}deg) scale(${scale * (0.86 + 0.14 * p) * (1 - g * 0.08)})`,
          opacity: Math.min(1, p * 1.4) * (1 - g),
          filter: g > 0.01 ? `blur(${g * 18}px)` : undefined,
          ...style,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------- cursor
export type CurKey = { t: number; x: number; y: number; click?: boolean };
export const Cursor: React.FC<{ t: number; keys: CurKey[]; show?: [number, number] }> = ({ t, keys, show }) => {
  if (show && (t < show[0] || t > show[1])) return null;
  const o = show ? Math.min(tw(t, show[0], show[0] + 0.3), 1 - tw(t, show[1] - 0.3, show[1])) : 1;
  let x = keys[0].x;
  let y = keys[0].y;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t >= a.t && t < b.t) {
      const e = INOUT(clamp((t - a.t) / (b.t - a.t)));
      x = a.x + (b.x - a.x) * e;
      y = a.y + (b.y - a.y) * e - Math.sin(e * Math.PI) * 30;
    } else if (t >= b.t) {
      x = b.x;
      y = b.y;
    }
  }
  const clicks = keys.filter((k) => k.click && t >= k.t - 0.1 && t < k.t + 0.6);
  const press = clicks.some((k) => Math.abs(t - k.t) < 0.09) ? 0.86 : 1;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, pointerEvents: "none", opacity: o }}>
      {clicks.map((k, i) => {
        const u = clamp((t - k.t) / 0.55);
        return <div key={i} style={{ position: "absolute", left: k.x - 40 * u - 6, top: k.y - 40 * u - 6, width: 12 + 80 * u, height: 12 + 80 * u, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.18)", opacity: 1 - u }} />;
      })}
      <svg width={40} height={46} style={{ position: "absolute", left: x - 4, top: y - 2, transform: `scale(${press})`, transformOrigin: "4px 2px", filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.3))" }}>
        <path d="M 5 3 L 5 34 L 13 26.5 L 18.5 39 L 24 36.6 L 18.6 24.4 L 29.5 24 Z" fill="#111" stroke="#fff" strokeWidth={2.4} strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------------------------- the mark
export const Mark: React.FC<{ size?: number; draw?: number; color?: string; fill?: string }> = ({ size = 120, draw = 1, color = V.green, fill = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 120 120">
    <rect x={6} y={6} width={108} height={108} rx={26} fill={fill} stroke={V.ink} strokeWidth={7} />
    <path d="M 33 62 L 52 81 L 88 41" stroke={color} strokeWidth={13} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
  </svg>
);

/// A verdict pill in the app's own style.
export const Verdict: React.FC<{ color: string; text: string; size?: number; dark?: boolean }> = ({ color, text, size = 26, dark }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.45, padding: `${size * 0.42}px ${size * 0.8}px`, borderRadius: 999, background: dark ? "rgba(255,255,255,0.08)" : "#fff", border: `1.5px solid ${color}55`, fontFamily: SANS, fontWeight: 600, fontSize: size, color: dark ? "#fff" : V.ink, whiteSpace: "nowrap" }}>
    <span style={{ width: size * 0.5, height: size * 0.5, borderRadius: "50%", background: color, boxShadow: `0 0 ${size * 0.6}px ${color}` }} />
    {text}
  </div>
);
