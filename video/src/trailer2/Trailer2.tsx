import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { C as COL, F as FONT, INOUT, OUT } from "../theme";
import sheet from "../trailer/trailer.json";
import { Field } from "./Field";
import { A, cameraAt, css, E, F, FOV, G, H, hitAmount, K, milestonePos, paletteAt, Q, V3, W, C } from "./world";

/// KEPT launch trailer v2: a flight through ten coloured scenes. Beat sheet:
/// video/shorts/04-launch-trailer-v2.md. Cues: src/trailer/trailer.json (shared with the score).

const tw = (t: number, a: number, b: number, from = 0, to = 1, ease = OUT) => interpolate(t, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
const SANS = FONT.sans;
const MONO = FONT.mono;
const FOV_PX = 540 / Math.tan(((FOV / 2) * Math.PI) / 180);

// ---------------------------------------------------------------------------- CSS 3D
const m3 = (e: number[] | Float32Array) => `matrix3d(${Array.from(e, (v) => (Math.abs(v) < 1e-10 ? 0 : v)).join(",")})`;
const CamCtx = React.createContext<THREE.PerspectiveCamera | null>(null);

/// A CSS 3D space that sees exactly what the WebGL camera sees (the CSS3DRenderer construction).
const Space: React.FC<{ t: number; children: React.ReactNode }> = ({ t, children }) => {
  const cam = cameraAt(t);
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
const Obj: React.FC<{ p: V3; ry?: number; children: React.ReactNode }> = ({ p, ry = 0, children }) => {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(p[0] / K, p[1] / K, p[2] / K), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
  const e = m.elements;
  const objCss = `translate(-50%, -50%) ${m3([e[0], e[1], e[2], e[3], -e[4], -e[5], -e[6], -e[7], e[8], e[9], e[10], e[11], e[12], e[13], e[14], e[15]])}`;
  return <div style={{ position: "absolute", transform: objCss }}>{children}</div>;
};

// ---------------------------------------------------------------------------- pieces
const Glass: React.FC<{ t: number; at: number; until: number; w: number; h: number; edge: [string, string]; children: React.ReactNode }> = ({ t, at, until, w, h, edge, children }) => {
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

const Eyebrow: React.FC<{ children: React.ReactNode; color: string }> = ({ children, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 17, letterSpacing: "0.24em", color, textTransform: "uppercase" }}>
    <span style={{ width: 9, height: 9, borderRadius: 5, background: color, boxShadow: `0 0 14px ${color}` }} />
    {children}
  </div>
);

const grad = (a: string, b: string): React.CSSProperties => ({ background: `linear-gradient(100deg, ${a}, ${b})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" });

/// A title that slams in with a scale punch and a blur, in the scene's gradient.
const Title: React.FC<{ t: number; at: number; until: number; lines: string[]; size: number; y: number; colors: [string, string]; glitch?: boolean; tracking?: string; weight?: number }> = ({
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

const Stamp: React.FC<{ t: number; at: number; until: number; kind: "kept" | "broken" }> = ({ t, at, until, kind }) => {
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

const count = (t: number, at: number, dur: number, to: number) => Math.round(to * tw(t, at, at + dur, 0, 1, INOUT)).toLocaleString("en-US");
const ROWS = [
  ["Mobile app", "Q1"],
  ["Mainnet", "Q2"],
  ["Partnerships", "Q3"],
  ["Token utility", "Q4"],
];
const MILESTONES = [
  { t: "Release v1.0.0", s: "on GitHub", icon: "M8 8h14l10 10-14 14L8 22z", c: ["#ffb02e", "#ff6a2e"] },
  { t: "Website live", s: "keptmd.vercel.app", icon: "M6 8h28v24H6z M6 15h28", c: ["#ffd36b", "#ff8a3d"] },
  { t: "Contract deployed", s: "code at an address", icon: "M20 5l14 8v14l-14 8-14-8V13z M6 13l14 8 14-8 M20 21v14", c: ["#ff8a3d", "#ff4fd8"] },
  { t: "Pool earns 5 IMD", s: "an onchain number", icon: "M6 28a14 14 0 1 1 28 0 M20 26l7-9", c: ["#ffb02e", "#ffd36b"] },
];
const SIG = "0x7c1f9e2a04b38d55a1fa0e93c2d7b8a1ee4f0c27d93b5a18fbe2c40d9a7b3e1f";

// ---------------------------------------------------------------------------- the 3D cards
const Cards: React.FC<{ t: number }> = ({ t }) => {
  const quorum = Q.votes[7];
  const yes = Q.votes.filter((v, i) => i !== Q.no && t >= v).length;
  const burn = tw(t, Q.burn, Q.burn + 1.1, 0, 110, (x) => x);
  return (
    <Space t={t}>
      {t > Q.cardOn - 0.1 && t < Q.shatter + 0.05 ? (
        <Obj p={A}>
          <Glass t={t} at={Q.cardOn} until={Q.shatter} w={760} h={460} edge={t > Q.broken + 0.5 ? ["#ff3d5a", "#ff8a3d"] : ["#7b5cff", "#ff4fd8"]}>
            <div style={{ padding: "36px 46px", transform: t > Q.broken + 0.6 ? `translate(${Math.sin(t * 90) * 8}px, ${Math.cos(t * 70) * 4}px)` : undefined }}>
              <Eyebrow color={t > Q.broken + 0.5 ? "#ff6b7a" : "#c3adff"}>Roadmap · 2026</Eyebrow>
              {ROWS.map(([name, q], i) => {
                const st = Q.broken + 0.15 + i * 0.12;
                const struck = t > st;
                return (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: 18, marginTop: i ? 22 : 30, fontSize: 38, fontWeight: 500, color: struck ? "#ff7a72" : "#fff", position: "relative" }}>
                    <span style={{ width: 26, height: 26, borderRadius: 13, border: `3px solid ${struck ? "#ff3d5a" : "#c3adff"}` }} />
                    {name}
                    <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 22, color: "#c3adff" }}>{q}</span>
                    <span style={{ position: "absolute", left: 44, right: 60, top: "52%", height: 4, background: "#ff3d5a", boxShadow: "0 0 12px #ff3d5a", transformOrigin: "0 50%", transform: `scaleX(${tw(t, st, st + 0.2)})` }} />
                  </div>
                );
              })}
            </div>
          </Glass>
        </Obj>
      ) : null}

      {t > Q.pledge && t < Q.milestones + 0.2 ? (
        <Obj p={C}>
          <Glass t={t} at={Q.pledge + 0.2} until={Q.milestones + 0.15} w={820} h={480} edge={["#2de0c0", "#3ee6ff"]}>
            <div style={{ padding: "38px 48px" }}>
              <Eyebrow color="#2de0c0">New pledge</Eyebrow>
              {[
                ["Token", "KEPT"],
                ["Locked", count(t, Q.pledge + 0.2, 0.5, 300_000_000)],
                ["Milestones", "4"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 26, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <span style={{ fontSize: 26, color: "#9fe9df" }}>{k}</span>
                  <span style={{ fontFamily: MONO, fontSize: 42, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: 30, height: 72, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 600, color: "#02140f", background: "linear-gradient(90deg, #2de0c0, #3ecf7a)", transform: `scale(${t > Q.lockClick && t < Q.lockClick + 0.15 ? 0.95 : 1})`, boxShadow: t > Q.lockClick ? "0 0 70px #2de0c0" : "none" }}>
                {t > Q.lockClick ? "Locked in the vault ✓" : "Lock tokens"}
              </div>
            </div>
          </Glass>
        </Obj>
      ) : null}

      {t > Q.milestones && t < Q.deadline + 0.2
        ? MILESTONES.map((m, k) => {
            const mp = milestonePos(k);
            const locked = t > Q.locks[k];
            return (
              <Obj key={k} p={mp.p} ry={mp.ry}>
                <Glass t={t} at={Q.milestones + 0.25 + k * 0.08} until={Q.deadline + 0.15} w={380} h={300} edge={locked ? (m.c as [string, string]) : ["#55606a", "#2a3038"]}>
                  <div style={{ padding: 30, display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
                    <svg width={44} height={44} viewBox="0 0 40 40">
                      <path d={m.icon} fill="none" stroke={m.c[0]} strokeWidth={2.8} strokeLinejoin="round" />
                    </svg>
                    <div style={{ marginTop: 20, fontSize: 32, fontWeight: 600 }}>{m.t}</div>
                    <div style={{ marginTop: 6, fontSize: 19, color: "#ffd9a8", fontFamily: MONO }}>{m.s}</div>
                    <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 12, fontFamily: MONO, fontSize: 18, letterSpacing: "0.2em", color: locked ? m.c[0] : "#6b7580" }}>
                      <svg width={30} height={36} viewBox="0 0 40 48">
                        <path d={`M 10 ${22 - (1 - tw(t, Q.locks[k], Q.locks[k] + 0.15)) * 8} V 14 a 10 10 0 0 1 20 0 V ${22 - (1 - tw(t, Q.locks[k], Q.locks[k] + 0.15)) * 8}`} fill="none" stroke={locked ? m.c[0] : "#6b7580"} strokeWidth={4} />
                        <rect x={4} y={20} width={32} height={24} rx={6} fill={locked ? m.c[0] : "#6b7580"} />
                      </svg>
                      {locked ? "LOCKED" : "OPEN"}
                    </div>
                  </div>
                </Glass>
              </Obj>
            );
          })
        : null}

      {t > Q.deadline && t < Q.drop + 0.2 ? (
        <Obj p={E}>
          <Glass t={t} at={Q.deadline + 0.15} until={Q.drop + 0.1} w={560} h={300} edge={["#ff4a3d", "#3ecf7a"]}>
            <div style={{ padding: "34px 40px" }}>
              <Eyebrow color="#ff6b62">Deadline · now</Eyebrow>
              <div style={{ marginTop: 24, fontSize: 42, fontWeight: 600 }}>Release v1.0.0</div>
              <div style={{ marginTop: 8, fontSize: 21, color: "#9fe9c0", fontFamily: MONO }}>github.com/modemola/identity_md</div>
              <div style={{ marginTop: 24, fontSize: 23, color: "#cfe" }}>Proven or not? Nine agents decide.</div>
            </div>
          </Glass>
        </Obj>
      ) : null}

      {t > Q.drop - 0.05 && t < Q.brokenCard ? (
        <Obj p={F}>
          <Glass t={t} at={Q.drop} until={Q.brokenCard - 0.15} w={820} h={420} edge={t >= quorum ? ["#39ff8e", "#34d8ff"] : ["#34d8ff", "#ff4fd8"]}>
            <div style={{ padding: "34px 44px" }}>
              <Eyebrow color="#34d8ff">IMD oracle · live verdict</Eyebrow>
              <div style={{ marginTop: 16, fontSize: 29, color: "#e6f6ff", lineHeight: 1.35 }}>Does the KEPT repo have a published release v1.0.0?</div>
              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                {Q.votes.map((v, i) => {
                  const on = t >= v;
                  const yv = i !== Q.no;
                  return <div key={i} style={{ flex: 1, height: 46, borderRadius: 10, background: on ? (yv ? "linear-gradient(180deg,#39ff8e,#1fbf6a)" : "linear-gradient(180deg,#ff6b62,#d93b33)") : "rgba(255,255,255,0.07)", transform: `scale(${on ? 1 + 0.25 * (1 - tw(t, v, v + 0.2)) : 1})`, boxShadow: on ? `0 0 28px ${yv ? "#39ff8e" : "#ff4a3d"}` : "none" }} />;
                })}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginTop: 22 }}>
                <span style={{ fontFamily: MONO, fontSize: 76, fontWeight: 600, ...(yes >= 7 ? grad("#39ff8e", "#34d8ff") : { color: "#fff" }) }}>{yes} / 9</span>
                <span style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.22em", color: yes >= 7 ? "#39ff8e" : "#9ab" }}>{yes >= 7 ? "QUORUM REACHED" : "7 MUST AGREE"}</span>
              </div>
              <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 16, color: "#7fdcff", whiteSpace: "nowrap", overflow: "hidden" }}>{t > quorum + 0.15 ? `signed ${SIG.slice(0, Math.floor(tw(t, quorum + 0.15, quorum + 0.8, 0, SIG.length, (x) => x)))}` : ""}</div>
            </div>
            <Stamp t={t} at={Q.kept} until={Q.brokenCard - 0.15} kind="kept" />
          </Glass>
        </Obj>
      ) : null}

      {t > Q.stream && t < Q.brokenCard ? (
        <Obj p={W} ry={-0.35}>
          <Glass t={t} at={Q.stream + 0.4} until={Q.brokenCard - 0.1} w={460} h={230} edge={["#ffd36b", "#ff8a3d"]}>
            <div style={{ padding: "32px 38px" }}>
              <Eyebrow color="#ffd36b">Team wallet</Eyebrow>
              <div style={{ marginTop: 18, fontFamily: MONO, fontSize: 52, fontWeight: 600, ...grad("#fff3c4", "#ffb02e") }}>+{count(t, Q.stream + 0.5, 1.1, 50_000_000)}</div>
              <div style={{ marginTop: 4, fontSize: 22, color: "#ffd9a8" }}>KEPT released by the swarm</div>
            </div>
          </Glass>
        </Obj>
      ) : null}

      {t > Q.brokenCard && t < Q.burn + 1.4 ? (
        <Obj p={G}>
          <div style={{ WebkitMaskImage: `linear-gradient(0deg, transparent ${burn}%, #000 ${burn + 12}%)`, maskImage: `linear-gradient(0deg, transparent ${burn}%, #000 ${burn + 12}%)` }}>
            <Glass t={t} at={Q.brokenCard + 0.1} until={Q.burn + 1.3} w={760} h={360} edge={["#ff4a3d", "#ff9b3d"]}>
              <div style={{ padding: "36px 44px" }}>
                <Eyebrow color="#ff6b62">Deadline passed</Eyebrow>
                <div style={{ marginTop: 22, fontSize: 46, fontWeight: 600 }}>Pool earns 5 IMD</div>
                <div style={{ marginTop: 10, fontSize: 24, color: "#ffb3a8", fontFamily: MONO }}>2 / 9 agree · not proven</div>
                <div style={{ marginTop: 28, fontSize: 27, ...grad("#ff9b3d", "#ff4a3d") }}>150,000,000 KEPT → 0x…dEaD</div>
              </div>
              <Stamp t={t} at={Q.brokenCard + 0.25} until={Q.burn + 1.3} kind="broken" />
            </Glass>
          </div>
        </Obj>
      ) : null}

      {[
        { big: "300,000,000", small: "KEPT locked by its own team", c: ["#8fa8ff", "#c3adff"] },
        { big: "2 / 2", small: "promises confirmed by the swarm", c: ["#39ff8e", "#2de0c0"] },
        { big: "LIVE", small: "on Robinhood Chain", c: ["#ffd36b", "#ff8a3d"] },
      ].map((s, i) => {
        const a = Q.stats[i];
        const b = i < 2 ? Q.stats[i + 1] - 0.15 : Q.tagline - 0.25;
        if (t < a - 0.1 || t > b) return null;
        const p = tw(t, a, a + 0.35);
        return (
          <Obj key={i} p={H[i]}>
            <div style={{ textAlign: "center", opacity: p, filter: `blur(${(1 - p) * 14}px)`, whiteSpace: "nowrap" }}>
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 160, letterSpacing: "-0.05em", lineHeight: 1, ...grad(s.c[0], s.c[1]), filter: `drop-shadow(0 0 40px ${s.c[0]})` }}>{s.big}</div>
              <div style={{ fontFamily: MONO, fontSize: 30, letterSpacing: "0.22em", color: "#fff", textTransform: "uppercase", marginTop: 14 }}>{s.small}</div>
            </div>
          </Obj>
        );
      })}
    </Space>
  );
};

// ---------------------------------------------------------------------------- overlays
const SCENES: [number, string][] = [
  [0, "01 PROMISE"],
  [Q.sphere, "02 SWARM"],
  [Q.pledge, "03 PLEDGE"],
  [Q.milestones, "04 MILESTONES"],
  [Q.deadline, "05 DEADLINE"],
  [Q.drop, "06 VERDICT"],
  [Q.kept, "07 PAYOUT"],
  [Q.brokenCard, "08 BURN"],
  [Q.stats[0], "09 PROOF"],
  [Q.tagline, "10 KEPT"],
];
const HEX = "3152f9cbf64d0c1ac24ea7e101db3e4d8da868969b8fd5aa7ac4fe302cb1a50ad90b4900b2924fa3b5f28198750864e199477a6898bad44ae4d1e0cc";

const Hud: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const pal = paletteAt(t);
  const a = css(pal.a), b = css(pal.b);
  const on = tw(t, 0.4, 1.0) * (1 - tw(t, Q.logo + 0.5, Q.logo + 1.2));
  let label = SCENES[0][1];
  let at = 0;
  for (const [s, l] of SCENES) if (t >= s) (label = l), (at = s);
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
      <div style={{ position: "absolute", left: 100, top: 46, fontSize: 16, letterSpacing: "0.3em", color: a }}>KEPT // SWARM.FEED</div>
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
          <circle key={k} cx={Math.cos(k * 0.7) * (20 + k * 3.5)} cy={Math.sin(k * 0.7) * (20 + k * 3.5)} r={2.5} fill={t > (Q.votes[k] ?? 99) ? "#39ff8e" : "#fff"} opacity={0.8} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

/// Titles: screen-space, in the scene's gradient.
const Titles: React.FC<{ t: number }> = ({ t }) => (
  <>
    <Title t={t} at={Q.promise} until={Q.cardForm + 0.15} lines={["EVERY ROADMAP", "IS A PROMISE."]} size={118} y={360} colors={["#c3adff", "#ff4fd8"]} />
    <Title t={t} at={Q.broken} until={Q.shatter + 0.1} lines={["MOST GET BROKEN."]} size={92} y={140} colors={["#ff3d5a", "#ff8a3d"]} glitch />
    <Title t={t} at={Q.introducing} until={Q.seal - 0.2} lines={["INTRODUCING"]} size={40} y={515} colors={["#3ee6ff", "#7fb8ff"]} tracking="0.55em" weight={500} />
    <Title t={t} at={Q.seal + 0.05} until={Q.pledge - 0.05} lines={["KEPT"]} size={170} y={720} colors={["#ffffff", "#9dffcf"]} tracking="0.3em" />
    <Title t={t} at={Q.milestones + 0.15} until={Q.deadline} lines={["LOCKED BEHIND MILESTONES"]} size={62} y={120} colors={["#ffd36b", "#ff6a2e"]} />
    <Title t={t} at={Q.deadline + 0.1} until={Q.drop - 0.05} lines={["THE DEADLINE HITS.", "THE SWARM CHECKS."]} size={64} y={110} colors={["#3ecf7a", "#3ee6ff"]} />
    <Title t={t} at={Q.kept + 0.25} until={Q.brokenCard - 0.1} lines={["KEPT? PAID."]} size={80} y={110} colors={["#ffd36b", "#39ff8e"]} />
    <Title t={t} at={Q.burn - 0.2} until={Q.stats[0] - 0.15} lines={["BROKEN? BURNED."]} size={84} y={110} colors={["#ff4a3d", "#ffb02e"]} glitch />
    <Title t={t} at={Q.tagline} until={Q.logo - 0.35} lines={["PROMISES THE", "SWARM ENFORCES."]} size={124} y={340} colors={["#c3adff", "#3ecf7a"]} />
  </>
);

const EndCard: React.FC<{ t: number }> = ({ t }) => {
  const p = tw(t, Q.logo + 0.35, Q.logo + 0.9);
  return (
    <div style={{ position: "absolute", top: 700, left: 0, right: 0, textAlign: "center", opacity: p, filter: `blur(${(1 - p) * 14}px)` }}>
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 140, letterSpacing: "0.3em", marginRight: "-0.3em", lineHeight: 1, ...grad("#ffffff", "#9dffcf"), filter: "drop-shadow(0 0 30px rgba(62,207,122,0.6))" }}>KEPT</div>
      <div style={{ fontFamily: SANS, fontWeight: 400, fontSize: 40, color: "#e8fff3", marginTop: 14, opacity: tw(t, Q.logo + 0.8, Q.logo + 1.3) }}>
        Promises the <span style={grad("#39ff8e", "#ffd36b")}>swarm</span> enforces.
      </div>
      <div style={{ marginTop: 30, display: "inline-flex", gap: 28, alignItems: "center", fontFamily: MONO, fontSize: 28, opacity: tw(t, Q.logo + 1.3, Q.logo + 1.8) }}>
        <span style={{ padding: "10px 26px", borderRadius: 999, background: "linear-gradient(90deg,#39ff8e,#ffd36b)", color: "#04120a", fontWeight: 600, boxShadow: "0 0 40px rgba(57,255,142,0.5)" }}>keptmd.vercel.app</span>
        <span style={{ color: "#fff" }}>@keptonchainn</span>
      </div>
    </div>
  );
};

export const Trailer2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const pal = paletteAt(t);
  const hit = hitAmount(t);
  const punch = 1 + 0.04 * hit;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${punch})` }}>
        <AbsoluteFill style={{ background: `radial-gradient(1400px 900px at 50% 55%, ${css(pal.bg, 1)}, #000 75%)` }} />
        <Field />
        <Cards t={t} />
        {/* light leaks */}
        <AbsoluteFill style={{ mixBlendMode: "screen", opacity: 0.35 }}>
          <div style={{ position: "absolute", width: 1100, height: 1100, borderRadius: "50%", left: -500 + Math.sin(t * 0.4) * 160, top: -500 + Math.cos(t * 0.3) * 120, background: `radial-gradient(circle, ${css(pal.b, 0.55)}, transparent 65%)` }} />
          <div style={{ position: "absolute", width: 1000, height: 1000, borderRadius: "50%", right: -460 + Math.cos(t * 0.35) * 160, bottom: -480 + Math.sin(t * 0.45) * 120, background: `radial-gradient(circle, ${css(pal.c, 0.45)}, transparent 65%)` }} />
        </AbsoluteFill>
        <Titles t={t} />
        <EndCard t={t} />
      </AbsoluteFill>
      <Hud t={t} frame={frame} />
      <AbsoluteFill style={{ background: css(pal.c, 1), opacity: hit * 0.3, mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 80% at 50% 50%, transparent 55%, rgba(0,0,0,0.7) 100%)" }} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: 0.08, mixBlendMode: "overlay" }}>
        <filter id="grain2">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 60} />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain2)" />
      </svg>
      <AbsoluteFill style={{ background: "#000", opacity: Math.max(1 - tw(t, 0, 0.4), tw(t, sheet.duration - 0.6, sheet.duration - 0.05)) }} />
    </AbsoluteFill>
  );
};
