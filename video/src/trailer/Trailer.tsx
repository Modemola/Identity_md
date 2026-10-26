import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F, INOUT, OUT } from "../theme";
import { cam, Field, planeTransform } from "./Field";
import { Q } from "./particles";
import sheet from "./trailer.json";

/// The KEPT launch trailer: the swarm as light, the product as glass. Beat sheet:
/// video/shorts/03-launch-trailer.md. Every cue lives in ./trailer.json.

const tw = (t: number, a: number, b: number, from = 0, to = 1, ease = OUT) => interpolate(t, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
/// in over `fade`, out over `fade`: 0 to 1 to 0
const life = (t: number, a: number, b: number, fade = 0.35) => Math.min(tw(t, a, a + fade), 1 - tw(t, b - fade, b, 0, 1, INOUT));
const SANS = F.sans;

/// A glass card that materialises out of the particles drawing its outline.
const Glass: React.FC<{ t: number; at: number; until: number; cx: number; cy: number; w: number; h: number; tint?: string; children: React.ReactNode; tilt?: number }> = ({
  t,
  at,
  until,
  cx,
  cy,
  w,
  h,
  tint = "rgba(255,255,255,0.14)",
  children,
  tilt = 0,
}) => {
  const p = tw(t, at, at + 0.45);
  const q = tw(t, until - 0.3, until, 0, 1, INOUT);
  const o = p * (1 - q);
  if (o <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: cx - w / 2,
        top: cy - h / 2,
        width: w,
        height: h,
        borderRadius: 22,
        background: "linear-gradient(160deg, rgba(28,34,32,0.72), rgba(10,13,12,0.82))",
        border: `1.5px solid ${tint}`,
        boxShadow: `0 40px 120px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 60px -20px ${tint}`,
        opacity: o,
        filter: `blur(${(1 - p) * 14 + q * 10}px)`,
        transform: `perspective(1600px) rotateY(${tilt * (1 - p * 0.6)}deg) scale(${0.96 + 0.04 * p + q * 0.03})`,
        fontFamily: SANS,
        color: C.ink,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
};

/// A line of type that resolves word by word out of a blur.
const Words: React.FC<{ t: number; at: number; until: number; text: string; size: number; weight?: number; accent?: Record<string, string>; y: number; color?: string; tracking?: string }> = ({
  t,
  at,
  until,
  text,
  size,
  weight = 300,
  accent = {},
  y,
  color = C.ink,
  tracking = "-0.025em",
}) => {
  const out = tw(t, until - 0.3, until, 0, 1, INOUT);
  if (t < at - 0.1 || out >= 1) return null;
  return (
    <div style={{ position: "absolute", top: y - size * 0.6, left: 0, right: 0, textAlign: "center", fontFamily: SANS, fontWeight: weight, fontSize: size, letterSpacing: tracking, color, opacity: 1 - out, filter: `blur(${out * 12}px)` }}>
      {text.split(" ").map((w, i) => {
        const p = tw(t, at + i * 0.07, at + i * 0.07 + 0.55);
        return (
          <span key={i} style={{ display: "inline-block", marginRight: "0.26em", opacity: p, filter: `blur(${(1 - p) * 12}px)`, transform: `translateY(${(1 - p) * 18}px)`, color: accent[w.replace(/[^\w]/g, "")] }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = C.dim }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: F.mono, fontSize: 16, letterSpacing: "0.24em", color, textTransform: "uppercase" }}>
    <span style={{ width: 8, height: 8, borderRadius: 4, background: color, boxShadow: `0 0 12px ${color}` }} />
    {children}
  </div>
);

const Lock: React.FC<{ t: number; at: number; size?: number }> = ({ t, at, size = 34 }) => {
  const shut = tw(t, at, at + 0.15, 0, 1, INOUT);
  const col = t >= at ? C.caution : C.dim;
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 40 48">
      <path d={`M 10 ${22 - (1 - shut) * 8} V 14 a 10 10 0 0 1 20 0 V ${22 - (1 - shut) * 8}`} fill="none" stroke={col} strokeWidth={4} />
      <rect x={4} y={20} width={32} height={24} rx={6} fill={col} />
    </svg>
  );
};

const Stamp: React.FC<{ t: number; at: number; until: number; kind: "kept" | "broken"; x: number; y: number }> = ({ t, at, until, kind, x, y }) => {
  if (t < at || t > until) return null;
  const gone = tw(t, until - 0.3, until, 0, 1, INOUT);
  const u = tw(t, at, at + 0.14, 0, 1, (k) => k * k);
  const col = kind === "kept" ? C.ok : C.alarm;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${kind === "kept" ? -8 : 7}deg) scale(${3 - 2 * u})`,
        opacity: u * (1 - gone),
        filter: `blur(${gone * 10}px)`,
        padding: "10px 26px",
        border: `5px solid ${col}`,
        borderRadius: 12,
        color: col,
        fontFamily: F.mono,
        fontWeight: 600,
        fontSize: 54,
        letterSpacing: "0.14em",
        background: "rgba(0,0,0,0.35)",
        boxShadow: `0 0 50px ${col}55`,
      }}
    >
      {kind === "kept" ? "KEPT ✓" : "BROKEN ✕"}
    </div>
  );
};

const count = (t: number, at: number, dur: number, to: number) => Math.round(to * tw(t, at, at + dur, 0, 1, INOUT)).toLocaleString("en-US");

// ------------------------------------------------------------------------------------------

const ROWS = [
  ["Mobile app", "Q1"],
  ["Mainnet", "Q2"],
  ["Partnerships", "Q3"],
  ["Token utility", "Q4"],
];
const MILESTONES = [
  { t: "Release v1.0.0", s: "on GitHub", icon: "M8 8h14l10 10-14 14L8 22z" },
  { t: "Website live", s: "keptmd.vercel.app", icon: "M6 8h28v24H6z M6 15h28" },
  { t: "Contract deployed", s: "code at an address", icon: "M20 5l14 8v14l-14 8-14-8V13z M6 13l14 8 14-8 M20 21v14" },
  { t: "Pool earns 5 IMD", s: "an onchain number", icon: "M6 28a14 14 0 1 1 28 0 M20 26l7-9" },
];
const SIG = "0x7c1f9e2a04b38d55a1fa0e93c2d7b8a1ee4f0c27d93b5a18fbe2c40d9a7b3e1f";

const Hud: React.FC<{ t: number }> = ({ t }) => {
  const quorum = Q.votes[7];
  const yes = Q.votes.filter((v, i) => i !== Q.no && t >= v).length;
  const voteSlide = tw(t, Q.kept - 0.15, Q.kept + 0.2, 0, 1, INOUT);
  return (
    <AbsoluteFill style={{ transform: planeTransform(t), transformOrigin: "50% 50%", color: C.ink }}>
      {/* 1. the promise, and the roadmap that breaks it */}
      <Words t={t} at={Q.promise} until={Q.cardForm + 0.1} text="Every roadmap is a promise." size={84} y={540} />
      <Words t={t} at={Q.broken} until={Q.shatter + 0.05} text="Most get broken." size={64} y={250} accent={{ broken: C.alarm }} />
      <Glass t={t} at={Q.cardOn} until={Q.shatter} cx={960} cy={560} w={760} h={460} tint={t > Q.broken + 0.5 ? "rgba(255,107,98,0.7)" : undefined}>
        <div style={{ padding: "34px 44px", transform: t > Q.broken + 0.6 ? `translate(${Math.sin(t * 90) * 6}px, ${Math.cos(t * 70) * 3}px)` : undefined }}>
          <Eyebrow>Roadmap · 2026</Eyebrow>
          {ROWS.map(([name, q], i) => {
            const struck = t > Q.broken + 0.15 + i * 0.12;
            return (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 18, marginTop: i ? 22 : 30, fontSize: 36, fontWeight: 400, color: struck ? "rgba(255,107,98,0.85)" : C.ink, position: "relative" }}>
                <span style={{ width: 26, height: 26, borderRadius: 13, border: `2.5px solid ${struck ? C.alarm : "rgba(255,255,255,0.4)"}` }} />
                {name}
                <span style={{ marginLeft: "auto", fontFamily: F.mono, fontSize: 22, color: C.dim }}>{q}</span>
                <span style={{ position: "absolute", left: 44, right: 60, top: "52%", height: 3, background: C.alarm, transformOrigin: "0 50%", transform: `scaleX(${tw(t, Q.broken + 0.15 + i * 0.12, Q.broken + 0.35 + i * 0.12)})` }} />
              </div>
            );
          })}
        </div>
      </Glass>

      {/* 2. introducing */}
      <Words t={t} at={Q.introducing} until={Q.seal - 0.3} text="Introducing" size={30} weight={400} y={540} tracking="0.5em" color={C.ink2} />
      <div style={{ position: "absolute", top: 640, left: 0, right: 0, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 120, letterSpacing: "0.32em", marginRight: "-0.32em", opacity: life(t, Q.seal + 0.05, Q.pledge - 0.1, 0.3), filter: `blur(${(1 - tw(t, Q.seal, Q.seal + 0.4)) * 16}px)` }}>
        KEPT
      </div>

      {/* 3. the pledge */}
      <Glass t={t} at={Q.pledge + 0.25} until={Q.milestones} cx={960} cy={540} w={820} h={480} tint="rgba(62,207,122,0.55)">
        <div style={{ padding: "38px 48px" }}>
          <Eyebrow color={C.ok}>New pledge</Eyebrow>
          {[
            ["Token", "KEPT"],
            ["Locked", `${count(t, Q.pledge + 0.25, 0.5, 300_000_000)}`],
            ["Milestones", "4"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 26, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ fontSize: 26, color: C.dim }}>{k}</span>
              <span style={{ fontFamily: F.mono, fontSize: 40, fontWeight: 500 }}>{v}</span>
            </div>
          ))}
          <div
            style={{
              marginTop: 30,
              height: 70,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 600,
              color: "#04120a",
              background: C.ok,
              transform: `scale(${t > Q.lockClick && t < Q.lockClick + 0.15 ? 0.96 : 1})`,
              boxShadow: t > Q.lockClick ? "0 0 60px rgba(62,207,122,0.6)" : "none",
            }}
          >
            {t > Q.lockClick ? "Locked in the vault ✓" : "Lock tokens"}
          </div>
        </div>
      </Glass>

      {/* 4. the milestones */}
      <Words t={t} at={Q.milestones + 0.1} until={Q.deadline - 0.2} text="Locked behind milestones anyone can check." size={56} y={250} accent={{ check: C.ok }} />
      {MILESTONES.map((m, k) => (
        <Glass key={k} t={t} at={Q.milestones + 0.3 + k * 0.08} until={Q.deadline - 0.15} cx={300 + k * 440} cy={600} w={380} h={300} tint={t > Q.locks[k] ? "rgba(240,180,41,0.6)" : undefined} tilt={(k - 1.5) * 6}>
          <div style={{ padding: "30px 30px", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
            <svg width={40} height={40} viewBox="0 0 40 40">
              <path d={m.icon} fill="none" stroke={C.ink} strokeWidth={2.6} strokeLinejoin="round" />
            </svg>
            <div style={{ marginTop: 22, fontSize: 32, fontWeight: 500 }}>{m.t}</div>
            <div style={{ marginTop: 6, fontSize: 20, color: C.dim, fontFamily: F.mono }}>{m.s}</div>
            <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 12 }}>
              <Lock t={t} at={Q.locks[k]} />
              <span style={{ fontFamily: F.mono, fontSize: 18, letterSpacing: "0.2em", color: t > Q.locks[k] ? C.caution : C.faint }}>{t > Q.locks[k] ? "LOCKED" : "OPEN"}</span>
            </div>
          </div>
        </Glass>
      ))}

      {/* 5. the deadline: the swarm reaches for the first milestone */}
      <Words t={t} at={Q.deadline} until={Q.drop - 0.1} text="At the deadline, the swarm checks." size={56} y={200} accent={{ swarm: C.ok }} />
      <Glass t={t} at={Q.deadline + 0.15} until={Q.drop - 0.05} cx={560} cy={560} w={560} h={300} tint="rgba(255,107,98,0.5)">
        <div style={{ padding: "34px 40px" }}>
          <Eyebrow color={C.alarm}>Deadline · now</Eyebrow>
          <div style={{ marginTop: 26, fontSize: 40, fontWeight: 500 }}>Release v1.0.0</div>
          <div style={{ marginTop: 8, fontSize: 22, color: C.dim, fontFamily: F.mono }}>github.com/modemola/identity_md</div>
          <div style={{ marginTop: 26, fontSize: 22, color: C.ink2 }}>Proven or not? Nine agents decide.</div>
        </div>
      </Glass>
      {t > Q.beam && t < Q.drop ? (
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {[-60, -20, 20, 60].map((dy, i) => (
            <line key={i} x1={1170} y1={540 + dy * 0.5} x2={840 + 840 * 0 + (1 - tw(t, Q.beam, Q.beam + 0.4)) * 330} y2={560 + dy} stroke={C.ok} strokeWidth={2.5} strokeDasharray="10 12" strokeDashoffset={-t * 120} opacity={0.75 * (1 - tw(t, Q.drop - 0.2, Q.drop))} style={{ filter: "drop-shadow(0 0 6px #3ecf7a)" }} />
          ))}
        </svg>
      ) : null}

      {/* 6. the vote */}
      <Glass t={t} at={Q.drop + 0.05} until={Q.brokenCard - 0.2} cx={960 - 260 * voteSlide} cy={560} w={820} h={420} tint={t >= quorum ? "rgba(62,207,122,0.7)" : undefined}>
        <div style={{ padding: "34px 44px", transform: `scale(${1 - 0.2 * voteSlide})`, transformOrigin: "0 0" }}>
          <Eyebrow color={C.ok}>IMD oracle · live verdict</Eyebrow>
          <div style={{ marginTop: 18, fontSize: 28, color: C.ink2, lineHeight: 1.35 }}>Does the KEPT repo have a published release v1.0.0?</div>
          <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
            {Q.votes.map((v, i) => {
              const on = t >= v;
              const yesV = i !== Q.no;
              return <div key={i} style={{ flex: 1, height: 44, borderRadius: 10, background: on ? (yesV ? C.ok : C.alarm) : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", transform: `scale(${on ? 1 + 0.2 * (1 - tw(t, v, v + 0.2)) : 1})`, boxShadow: on ? `0 0 24px ${yesV ? "#3ecf7a88" : "#ff6b6288"}` : "none" }} />;
            })}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginTop: 22 }}>
            <span style={{ fontFamily: F.mono, fontSize: 72, fontWeight: 500, color: yes >= 7 ? C.ok : C.ink }}>{yes} / 9</span>
            <span style={{ fontFamily: F.mono, fontSize: 20, letterSpacing: "0.22em", color: yes >= 7 ? C.ok : C.dim }}>{yes >= 7 ? "QUORUM REACHED" : "7 MUST AGREE"}</span>
          </div>
          <div style={{ marginTop: 10, fontFamily: F.mono, fontSize: 16, color: C.dim, whiteSpace: "nowrap", overflow: "hidden" }}>
            {t > quorum + 0.15 ? `signed ${SIG.slice(0, Math.floor(tw(t, quorum + 0.15, quorum + 0.8, 0, SIG.length, (x) => x)))}` : ""}
          </div>
        </div>
      </Glass>
      <Stamp t={t} at={Q.kept} until={Q.brokenCard - 0.2} kind="kept" x={960 - 260 + 220} y={430} />
      <Glass t={t} at={Q.stream + 0.4} until={Q.brokenCard - 0.2} cx={1500} cy={560} w={440} h={220} tint="rgba(240,180,41,0.6)">
        <div style={{ padding: "32px 38px" }}>
          <Eyebrow color={C.caution}>Team wallet</Eyebrow>
          <div style={{ marginTop: 20, fontFamily: F.mono, fontSize: 48, fontWeight: 500, color: "#ffd36b" }}>+{count(t, Q.stream + 0.5, 1.1, 50_000_000)}</div>
          <div style={{ marginTop: 6, fontSize: 22, color: C.dim }}>KEPT released by the swarm</div>
        </div>
      </Glass>

      {/* 7. the broken promise burns */}
      <Words t={t} at={Q.burn - 0.1} until={Q.stats[0] - 0.2} text="Miss it, and it burns." size={60} y={240} accent={{ burns: C.alarm }} />
      <div style={{ position: "absolute", inset: 0, WebkitMaskImage: `linear-gradient(0deg, transparent ${tw(t, Q.burn, Q.burn + 1.1, 0, 110, (x) => x)}%, #000 ${tw(t, Q.burn, Q.burn + 1.1, 0, 110, (x) => x) + 12}%)`, maskImage: `linear-gradient(0deg, transparent ${tw(t, Q.burn, Q.burn + 1.1, 0, 110, (x) => x)}%, #000 ${tw(t, Q.burn, Q.burn + 1.1, 0, 110, (x) => x) + 12}%)` }}>
        <Glass t={t} at={Q.brokenCard + 0.1} until={Q.burn + 1.3} cx={960} cy={540} w={760} h={360} tint="rgba(255,107,98,0.7)">
          <div style={{ padding: "36px 44px" }}>
            <Eyebrow color={C.alarm}>Deadline passed</Eyebrow>
            <div style={{ marginTop: 22, fontSize: 44, fontWeight: 500 }}>Pool earns 5 IMD</div>
            <div style={{ marginTop: 10, fontSize: 24, color: C.dim, fontFamily: F.mono }}>2 / 9 agree · not proven</div>
            <div style={{ marginTop: 30, fontSize: 26, color: "#ff9b94" }}>150,000,000 KEPT → 0x…dEaD</div>
          </div>
        </Glass>
        <Stamp t={t} at={Q.brokenCard + 0.25} until={Q.burn + 1.3} kind="broken" x={1160} y={420} />
      </div>

      {/* 8. the real numbers */}
      {[
        { big: "300,000,000", small: "KEPT locked by its own team", col: C.ink },
        { big: "2 / 2", small: "promises confirmed by the swarm", col: C.ok },
        { big: "Live", small: "on Robinhood Chain", col: C.caution },
      ].map((s, i) => {
        const a = Q.stats[i];
        const b = i < 2 ? Q.stats[i + 1] : Q.tagline - 0.2;
        const p = tw(t, a, a + 0.5);
        const o = life(t, a, b, 0.25);
        if (o <= 0) return null;
        return (
          <div key={i} style={{ position: "absolute", top: 390, left: 0, right: 0, textAlign: "center", opacity: o, transform: `scale(${1.12 - 0.12 * p})`, filter: `blur(${(1 - p) * 18}px)` }}>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 150, letterSpacing: "-0.04em", color: s.col, textShadow: `0 0 60px ${s.col}44` }}>{s.big}</div>
            <div style={{ fontFamily: F.mono, fontSize: 28, letterSpacing: "0.2em", color: C.ink2, textTransform: "uppercase", marginTop: 4 }}>{s.small}</div>
          </div>
        );
      })}

      {/* 9. the line */}
      <Words t={t} at={Q.tagline} until={Q.logo - 0.3} text="Promises the" size={110} y={470} />
      <Words t={t} at={Q.tagline + 0.3} until={Q.logo - 0.3} text="swarm enforces." size={110} y={610} accent={{ swarm: C.ok }} />

      {/* 10. the mark */}
      <div style={{ position: "absolute", top: 560, left: 0, right: 0, textAlign: "center", opacity: tw(t, Q.logo + 0.3, Q.logo + 0.8), filter: `blur(${(1 - tw(t, Q.logo + 0.3, Q.logo + 0.8)) * 14}px)` }}>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 132, letterSpacing: "0.32em", marginRight: "-0.32em" }}>KEPT</div>
        <div style={{ fontFamily: SANS, fontWeight: 300, fontSize: 40, color: C.ink2, marginTop: 6, opacity: tw(t, Q.logo + 0.8, Q.logo + 1.3) }}>
          Promises the <span style={{ color: C.ok }}>swarm</span> enforces.
        </div>
        <div style={{ marginTop: 38, display: "inline-flex", gap: 28, alignItems: "center", fontFamily: F.mono, fontSize: 28, opacity: tw(t, Q.logo + 1.3, Q.logo + 1.8) }}>
          <span style={{ padding: "10px 26px", borderRadius: 999, background: C.ok, color: "#04120a", fontWeight: 600 }}>keptmd.vercel.app</span>
          <span style={{ color: C.ink2 }}>@keptonchainn</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/// Flashes on the big hits.
const HITS = [Q.seal, Q.drop, Q.votes[7], Q.kept, Q.brokenCard + 0.25, ...Q.stats, Q.logo];

export const Trailer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const flash = HITS.reduce((m, h) => Math.max(m, t >= h ? Math.exp(-(t - h) * 14) : 0), 0);
  const c = cam(t);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ background: `radial-gradient(1200px 800px at ${50 + c.x * 20}% 60%, rgba(30,90,60,0.22), transparent 70%)` }} />
      <Field />
      <Hud t={t} />
      <AbsoluteFill style={{ background: "#fff", opacity: flash * 0.28, mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 75% at 50% 50%, transparent 55%, rgba(0,0,0,0.75) 100%)" }} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: 0.07, mixBlendMode: "overlay" }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={frame % 60} />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
      <AbsoluteFill style={{ background: "#000", opacity: Math.max(1 - tw(t, 0, 0.5), tw(t, sheet.duration - 0.7, sheet.duration - 0.05)) }} />
    </AbsoluteFill>
  );
};
