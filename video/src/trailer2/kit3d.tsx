import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import * as THREE from "three";
import { F as FONT, INOUT, OUT } from "../theme";
import { camAt, cameraAt, css, FOV, K, Pal, V3 } from "./world";

/// The trailer style as parts: a CSS 3D space that matches the WebGL camera, glass cards, titles,
/// stamps, the live overlay and the finishing layers. Every film in this style builds from these.

type Path = (t: number) => { pos: V3; look: V3; roll: number };

export const tw = (t: number, a: number, b: number, from = 0, to = 1, ease = OUT) => interpolate(t, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
export const SANS = FONT.sans;
export const MONO = FONT.mono;
export const FOV_PX = 540 / Math.tan(((FOV / 2) * Math.PI) / 180);

// ---------------------------------------------------------------------------- CSS 3D
const m3 = (e: number[] | Float32Array) => `matrix3d(${Array.from(e, (v) => (Math.abs(v) < 1e-10 ? 0 : v)).join(",")})`;
const CamCtx = React.createContext<THREE.PerspectiveCamera | null>(null);

/// A CSS 3D space that sees exactly what the WebGL camera sees (the CSS3DRenderer construction).
export const Space: React.FC<{ t: number; path?: Path; children: React.ReactNode }> = ({ t, path = camAt, children }) => {
  const cam = cameraAt(t, 16 / 9, path);
  const e = cam.matrixWorldInverse.elements.slice();
  for (const i of [12, 13, 14]) e[i] /= K; // world units to pixels
  const camCss = `translateZ(${FOV_PX}px) ${m3([e[0], -e[1], e[2], e[3], e[4], -e[5], e[6], e[7], e[8], -e[9], e[10], e[11], e[12], -e[13], e[14], e[15]])} translate(960px, 540px)`;
  return (
    <div style={{ position: "absolute", inset: 0, perspective: `${FOV_PX}px`, overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 1920, height: 1080, transformStyle: "preserve-3d", transform: camCss }}>
        <CamCtx.Provider value={cam}>{children}</CamCtx.Provider>
      </div>
    </div>
  );
};

/// An element placed in the world at `p`, turned by `ry`.
export const Obj: React.FC<{ p: V3; ry?: number; children: React.ReactNode }> = ({ p, ry = 0, children }) => {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(p[0] / K, p[1] / K, p[2] / K), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
  const e = m.elements;
  const objCss = `translate(-50%, -50%) ${m3([e[0], e[1], e[2], e[3], -e[4], -e[5], -e[6], -e[7], e[8], e[9], e[10], e[11], e[12], e[13], e[14], e[15]])}`;
  return <div style={{ position: "absolute", transform: objCss }}>{children}</div>;
};

// ---------------------------------------------------------------------------- pieces
export const Glass: React.FC<{ t: number; at: number; until: number; w: number; h: number; edge: [string, string]; children: React.ReactNode }> = ({ t, at, until, w, h, edge, children }) => {
  const p = tw(t, at, at + 0.4);
  const q = tw(t, until - 0.25, until, 0, 1, INOUT);
  const o = p * (1 - q);
  if (o <= 0.001) return null;
  return (
    <div
      style={{
        width: w,
        height: h,
        boxSizing: "border-box",
        borderRadius: 24,
        border: "2px solid transparent",
        background: `linear-gradient(160deg, rgba(22,26,34,0.82), rgba(8,10,14,0.9)) padding-box, linear-gradient(135deg, ${edge[0]}, ${edge[1]}) border-box`,
        boxShadow: `0 0 80px -10px ${edge[0]}, 0 0 140px -40px ${edge[1]}`,
        opacity: o,
        filter: `blur(${(1 - p) * 12 + q * 8}px) brightness(${1 + (1 - p) * 1.5})`,
        transform: `scale(${0.94 + 0.06 * p})`,
        fontFamily: SANS,
        color: "#fff",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.08) 45%, transparent 60%)`, transform: `translateX(${(((t - at) * 0.6) % 2) * 120 - 60}%)` }} />
      {children}
    </div>
  );
};

export const Eyebrow: React.FC<{ children: React.ReactNode; color: string }> = ({ children, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 17, letterSpacing: "0.24em", color, textTransform: "uppercase" }}>
    <span style={{ width: 9, height: 9, borderRadius: 5, background: color, boxShadow: `0 0 14px ${color}` }} />
    {children}
  </div>
);

export const grad = (a: string, b: string): React.CSSProperties => ({ background: `linear-gradient(100deg, ${a}, ${b})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" });

/// A title that slams in with a scale punch and a blur, in the scene's gradient.
export const Title: React.FC<{ t: number; at: number; until: number; lines: string[]; size: number; y: number; colors: [string, string]; glitch?: boolean; tracking?: string; weight?: number }> = ({
  t,
  at,
  until,
  lines,
  size,
  y,
  colors,
  glitch,
  tracking = "-0.03em",
  weight = 600,
}) => {
  if (t < at - 0.05 || t > until) return null;
  const out = tw(t, until - 0.25, until, 0, 1, INOUT);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, textAlign: "center", opacity: 1 - out, filter: `blur(${out * 14}px)` }}>
      {lines.map((ln, li) => {
        const words = ln.split(" ");
        return (
          <div key={li} style={{ fontFamily: SANS, fontWeight: weight, fontSize: size, lineHeight: 1.04, letterSpacing: tracking }}>
            {words.map((w, i) => {
              const a = at + (li * words.length + i) * 0.06;
              const p = tw(t, a, a + 0.4);
              const jitter = glitch && t > at + 0.3 ? Math.sin(t * 97 + i * 13) * 6 * (Math.sin(t * 23 + i) > 0.6 ? 1 : 0) : 0;
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    marginRight: "0.24em",
                    opacity: p,
                    transform: `translate(${jitter}px, ${(1 - p) * 30}px) scale(${1.35 - 0.35 * p})`,
                    ...grad(colors[0], colors[1]),
                    filter: `blur(${(1 - p) * 16}px) drop-shadow(0 4px 24px rgba(0,0,0,0.85))${glitch ? " drop-shadow(3px 0 rgba(255,0,80,0.8)) drop-shadow(-3px 0 rgba(0,220,255,0.8))" : ""}`,
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export const Stamp: React.FC<{ t: number; at: number; until: number; kind: "kept" | "broken" }> = ({ t, at, until, kind }) => {
  if (t < at || t > until) return null;
  const u = tw(t, at, at + 0.14, 0, 1, (k) => k * k);
  const gone = tw(t, until - 0.25, until, 0, 1, INOUT);
  const col = kind === "kept" ? "#39ff8e" : "#ff4a3d";
  return (
    <div
      style={{
        position: "absolute",
        right: 40,
        top: 30,
        transform: `rotate(${kind === "kept" ? -9 : 8}deg) scale(${3 - 2 * u})`,
        opacity: u * (1 - gone),
        padding: "10px 26px",
        border: `5px solid ${col}`,
        borderRadius: 12,
        color: col,
        fontFamily: MONO,
        fontWeight: 600,
        fontSize: 52,
        letterSpacing: "0.14em",
        background: "rgba(0,0,0,0.45)",
        boxShadow: `0 0 60px ${col}`,
        textShadow: `0 0 20px ${col}`,
      }}
    >
      {kind === "kept" ? "KEPT ✓" : "BROKEN ✕"}
    </div>
  );
};

export const count = (t: number, at: number, dur: number, to: number) => Math.round(to * tw(t, at, at + dur, 0, 1, INOUT)).toLocaleString("en-US");
const HEX = "3152f9cbf64d0c1ac24ea7e101db3e4d8da868969b8fd5aa7ac4fe302cb1a50ad90b4900b2924fa3b5f28198750864e199477a6898bad44ae4d1e0cc";

export const Hud: React.FC<{ t: number; frame: number; pal: Pal; scenes: [number, string][]; on: number; dots: boolean[]; feed?: string }> = ({ t, frame, pal, scenes, on: shown, dots, feed = "KEPT // SWARM.FEED" }) => {
  const a = css(pal.a), b = css(pal.b);
  const on = shown;
  let label = scenes[0][1];
  let at = 0;
  for (const [s, l] of scenes) if (t >= s) (label = l), (at = s);
  const swap = tw(t, at, at + 0.25);
  const tc = `00:00:${String(Math.floor(t)).padStart(2, "0")}:${String(frame % 30).padStart(2, "0")}`;
  const corner = (x: "left" | "right", y: "top" | "bottom") => (
    <div style={{ position: "absolute", [x]: 36, [y]: 36, width: 46, height: 46, [`border${y === "top" ? "Top" : "Bottom"}`]: `2px solid ${a}`, [`border${x === "left" ? "Left" : "Right"}`]: `2px solid ${a}` } as React.CSSProperties} />
  );
  return (
    <AbsoluteFill style={{ opacity: on * 0.85, fontFamily: MONO, color: "#fff" }}>
      {corner("left", "top")}
      {corner("right", "top")}
      {corner("left", "bottom")}
      {corner("right", "bottom")}
      <div style={{ position: "absolute", left: 100, top: 46, fontSize: 16, letterSpacing: "0.3em", color: a }}>{feed}</div>
      <div style={{ position: "absolute", left: 100, top: 72, fontSize: 26, letterSpacing: "0.18em", fontWeight: 600, opacity: swap, transform: `translateX(${(1 - swap) * -20}px)`, ...grad(a, b) }}>{label}</div>
      <div style={{ position: "absolute", right: 100, top: 46, fontSize: 16, letterSpacing: "0.2em", display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: "#ff3d5a", opacity: Math.floor(t * 2) % 2 ? 1 : 0.3, boxShadow: "0 0 12px #ff3d5a" }} />
        REC {tc}
      </div>
      <div style={{ position: "absolute", right: 100, top: 72, fontSize: 14, letterSpacing: "0.2em", color: b }}>CHAIN 4663 · PANEL 9 · QUORUM 7</div>
      {/* the hex column */}
      <div style={{ position: "absolute", right: 44, top: 140, bottom: 140, width: 18, overflow: "hidden", fontSize: 13, lineHeight: "16px", color: a, opacity: 0.6, wordBreak: "break-all" }}>
        <div style={{ transform: `translateY(${-((t * 90) % 400)}px)` }}>{(HEX + HEX + HEX).slice(0, 220)}</div>
      </div>
      {/* the ticker */}
      <div style={{ position: "absolute", left: 100, bottom: 46, width: 1150, overflow: "hidden", whiteSpace: "nowrap", fontSize: 15, letterSpacing: "0.2em", color: "rgba(255,255,255,0.75)" }}>
        <div style={{ transform: `translateX(${-((t * 140) % 1400)}px)` }}>
          {"VAULT 0x3152…6896  ·  KEPT 0x9b8f…4fa3  ·  HOOK 0xb5f2…e0cc  ·  2/2 VERDICTS KEPT  ·  150,000,000 RELEASED  ·  ".repeat(4)}
        </div>
      </div>
      {/* the radar */}
      <svg width={120} height={120} style={{ position: "absolute", right: 96, bottom: 40 }} viewBox="-60 -60 120 120">
        <circle r={54} fill="none" stroke={a} strokeOpacity={0.5} strokeWidth={1.5} />
        <circle r={34} fill="none" stroke={a} strokeOpacity={0.3} strokeWidth={1.5} />
        <path d={`M 0 0 L ${Math.cos(t * 3) * 54} ${Math.sin(t * 3) * 54}`} stroke={b} strokeWidth={2.5} />
        <path d={`M 0 0 L ${Math.cos(t * 3) * 54} ${Math.sin(t * 3) * 54} A 54 54 0 0 0 ${Math.cos(t * 3 - 0.6) * 54} ${Math.sin(t * 3 - 0.6) * 54} Z`} fill={b} opacity={0.25} />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => (
          <circle key={k} cx={Math.cos(k * 0.7) * (20 + k * 3.5)} cy={Math.sin(k * 0.7) * (20 + k * 3.5)} r={2.5} fill={dots[k] ? "#39ff8e" : "#fff"} opacity={0.8} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

export const EndCard: React.FC<{ t: number; at: number; top?: number }> = ({ t, at, top = 700 }) => {
  const p = tw(t, at + 0.35, at + 0.9);
  return (
    <div style={{ position: "absolute", top, left: 0, right: 0, textAlign: "center", opacity: p, filter: `blur(${(1 - p) * 14}px)` }}>
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 140, letterSpacing: "0.3em", marginRight: "-0.3em", lineHeight: 1, ...grad("#ffffff", "#9dffcf"), filter: "drop-shadow(0 0 30px rgba(62,207,122,0.6))" }}>KEPT</div>
      <div style={{ fontFamily: SANS, fontWeight: 400, fontSize: 40, color: "#e8fff3", marginTop: 14, opacity: tw(t, at + 0.8, at + 1.3) }}>
        Promises the <span style={grad("#39ff8e", "#ffd36b")}>swarm</span> enforces.
      </div>
      <div style={{ marginTop: 30, display: "inline-flex", gap: 28, alignItems: "center", fontFamily: MONO, fontSize: 28, opacity: tw(t, at + 1.3, at + 1.8) }}>
        <span style={{ padding: "10px 26px", borderRadius: 999, background: "linear-gradient(90deg,#39ff8e,#ffd36b)", color: "#04120a", fontWeight: 600, boxShadow: "0 0 40px rgba(57,255,142,0.5)" }}>keptmd.vercel.app</span>
        <span style={{ color: "#fff" }}>@keptonchainn</span>
      </div>
    </div>
  );
};


/// The finishing layers every film shares: flash, vignette, grain, the fade in and out.
export const Finish: React.FC<{ t: number; frame: number; pal: Pal; hit: number; duration: number }> = ({ t, frame, pal, hit, duration }) => (
  <>
    <AbsoluteFill style={{ background: css(pal.c, 1), opacity: hit * 0.3, mixBlendMode: "screen" }} />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 80% at 50% 50%, transparent 55%, rgba(0,0,0,0.7) 100%)" }} />
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: 0.08, mixBlendMode: "overlay" }}>
      <filter id="grain2">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 60} />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain2)" />
    </svg>
    <AbsoluteFill style={{ background: "#000", opacity: Math.max(1 - tw(t, 0, 0.4), tw(t, duration - 0.6, duration - 0.05)) }} />
  </>
);

/// Two coloured light leaks drifting in the corners.
export const Leaks: React.FC<{ t: number; pal: Pal }> = ({ t, pal }) => (
  <AbsoluteFill style={{ mixBlendMode: "screen", opacity: 0.35 }}>
    <div style={{ position: "absolute", width: 1100, height: 1100, borderRadius: "50%", left: -500 + Math.sin(t * 0.4) * 160, top: -500 + Math.cos(t * 0.3) * 120, background: `radial-gradient(circle, ${css(pal.b, 0.55)}, transparent 65%)` }} />
    <div style={{ position: "absolute", width: 1000, height: 1000, borderRadius: "50%", right: -460 + Math.cos(t * 0.35) * 160, bottom: -480 + Math.sin(t * 0.45) * 120, background: `radial-gradient(circle, ${css(pal.c, 0.45)}, transparent 65%)` }} />
  </AbsoluteFill>
);
