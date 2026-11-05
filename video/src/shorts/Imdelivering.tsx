import React from "react";
import { AbsoluteFill } from "remotion";
import { C, F, INOUT } from "../theme";
import { Seal } from "../ui/Marks";
import { StampMark } from "../explainer/ActsC";
import { Agent, Blob, Bubble, CastDefs, Coin, Confetti, Sparkle } from "../explainer/cast";
import { bob, pop, rnd, Stage, tw, useSeconds } from "../explainer/kit";
import sheet from "./imdelivering.json";

/// Short 01: the IMD founder's "Im-" list, answered with the one word that is KEPT.
/// Beat sheet and post copy: video/shorts/01-imdelivering.md. Cues: ./imdelivering.json.

const Q = sheet.cues;
const WORDS = ["defi", "degen", "decentralized", "delusional", "deploying", "debugging", "designing", "deflationary"];
const FLOOR = 930;
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

export const Imdelivering: React.FC = () => {
  const t = useSeconds();
  const yesAt = Q.votes.filter((_, i) => i !== Q.no);
  const quorum = yesAt[6];
  const yes = Q.votes.filter((v, i) => i !== Q.no && t >= v).length;
  const card = tw(t, Q.card - 0.4, Q.card + 0.3, 0, 1, INOUT);

  // the reel: which suffix shows, and how far the swap has slid
  let k = -1;
  for (let i = 0; i < WORDS.length; i++) if (t >= Q.words[i]) k = i;
  const spinning = t >= Q.scratch && t < Q.freeze;
  const frozen = t >= Q.freeze && t < Q.stamp;
  const done = t >= Q.stamp;
  const slide = k >= 0 && !spinning && !frozen && !done ? tw(t, Q.words[k], Q.words[k] + 0.13, 0, 1, INOUT) : 1;
  const suffix = done ? "delivering" : frozen ? "de…?" : spinning ? WORDS[Math.floor(t * 30) % WORDS.length] : k >= 0 ? WORDS[k] : "";
  const prev = k > 0 && !spinning && !frozen && !done ? WORDS[k - 1] : "";
  const imIn = pop(t, Q.im, 0.4);
  const payoff = pop(t, Q.stamp + 0.05, 0.5);
  const size = done ? 104 + 22 * payoff : 104;
  const wordY = done ? 330 : 400;
  const shake = t > Q.stamp + 0.14 && t < Q.stamp + 0.6 ? 14 * Math.exp(-(t - Q.stamp - 0.14) * 10) * Math.sin((t - Q.stamp) * 70) : 0;
  const robotsOut = tw(t, Q.sub - 0.4, Q.sub + 0.3, 0, 1, INOUT);

  return (
    <AbsoluteFill style={{ transform: `translate(${shake}px, ${shake * 0.4}px)` }}>
      <Stage light={done ? "rgba(62,207,122,0.22)" : frozen ? "rgba(255,255,255,0.06)" : "rgba(240,180,41,0.14)"} at={[50, 36]} floor={FLOOR} />

      {/* the word */}
      <AbsoluteFill style={{ opacity: 1 - card }}>
        <div style={{ position: "absolute", top: wordY - size * 0.6, left: 0, right: 0, display: "flex", justifyContent: "center", fontFamily: F.mono, fontWeight: 600, fontSize: size, letterSpacing: "-0.04em", lineHeight: 1.2 }}>
          <span style={{ color: done ? C.ok : C.ink, display: "inline-block", transform: `scale(${imIn})` }}>Im</span>
          <span style={{ position: "relative", display: "inline-block", overflow: "hidden", height: size * 1.2 }}>
            {prev ? (
              <span style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${-slide * 100}%)`, opacity: 1 - slide, color: C.ink, whiteSpace: "nowrap" }}>{prev}</span>
            ) : null}
            <span
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                transform: `translateY(${(1 - slide) * 100}%) scale(${done ? 0.9 + 0.1 * payoff : 1})`,
                color: done ? C.ok : frozen ? "rgba(255,255,255,0.4)" : C.caution,
                filter: spinning ? "blur(5px)" : undefined,
                textShadow: done ? "0 0 40px rgba(62,207,122,0.5)" : undefined,
              }}
            >
              {suffix}
            </span>
          </span>
        </div>
        {/* word counter under the reel */}
        <div style={{ position: "absolute", top: wordY + 70, left: 0, right: 0, textAlign: "center", fontFamily: F.mono, fontSize: 24, letterSpacing: "0.3em", color: C.dim, opacity: k >= 0 && !done && !frozen ? 1 : 0 }}>
          {spinning ? "· · ·" : `${Math.max(0, k + 1)} / 8`}
        </div>
        <div style={{ position: "absolute", top: 610, left: 0, right: 0, textAlign: "center", fontFamily: F.mono, fontSize: 38, fontWeight: 500, color: C.ink, opacity: pop(t, Q.sub, 0.5), transform: `translateY(${(1 - pop(t, Q.sub, 0.5)) * 30}px)` }}>
          Tokens unlock only when
          <br />
          the <span style={{ color: C.ok }}>swarm</span> confirms delivery.
        </div>
      </AbsoluteFill>

      <svg width={1080} height={1080} viewBox="0 0 1080 1080" style={{ position: "absolute", overflow: "visible", opacity: 1 - card }}>
        <CastDefs />
        {/* the frozen question gets a scanning frame */}
        {frozen ? <rect x={250} y={330} width={580} height={150} rx={18} fill="none" stroke={C.caution} strokeWidth={4} strokeDasharray="14 10" strokeDashoffset={-t * 60} opacity={0.6} /> : null}
        {/* the swarm */}
        {Array.from({ length: 9 }, (_, i) => {
          const a = Q.robots + i * 0.06;
          if (t < a) return null;
          const e1 = tw(t, a, a + 0.6, 0, 1, INOUT);
          const x = lerp(1250 - i * 30, 140 + i * 100, e1);
          const y = lerp(-150, 640, e1) - Math.sin(e1 * Math.PI) * 120 - robotsOut * 900;
          const v = Q.votes[i];
          const state = t >= v ? (i === Q.no ? "no" : "yes") : t > Q.scan ? "scan" : "idle";
          const beam = t > Q.scan && t < Q.votes[i] ? 1 : 0;
          return (
            <g key={i}>
              {beam ? <path d={`M ${x - 10} ${y - 30} L ${x + 10} ${y - 30} L ${540 + (x - 540) * 0.35 + 30} 470 L ${540 + (x - 540) * 0.35 - 30} 470 Z`} fill={C.ok} opacity={0.1 + 0.05 * Math.sin(t * 12 + i)} /> : null}
              <Agent x={x} y={y} t={t} s={0.6} state={state} seed={i} />
              <Sparkle x={x} y={y - 40} t={t} at={v} size={22} color={i === Q.no ? C.alarm : C.ok} />
            </g>
          );
        })}
        <text x={540} y={790 - robotsOut * 900} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={64} fill={yes >= 7 ? C.ok : "#fff"} opacity={tw(t, Q.votes[0] - 0.2, Q.votes[0])}>
          {yes} / 9
        </text>
        <g transform={`translate(540 ${860 - robotsOut * 900}) scale(${pop(t, quorum, 0.4)})`}>
          <rect x={-150} y={-38} width={300} height={66} rx={33} fill={C.ok} />
          <text x={0} y={8} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={34} fill="#0b0d0c" letterSpacing={5}>
            QUORUM
          </text>
        </g>
        <Confetti x={540} y={760} t={t} at={quorum} n={60} seed={3} />

        {/* the crowd: cheers the list, ducks for the swarm, returns for the payoff */}
        {(["pink", "lilac", "mint"] as const).map((skin, i) => {
          const up = Math.min(pop(t, 0.3 + i * 0.1, 0.5), 1 - tw(t, Q.robots - 0.3, Q.robots + 0.1)) + pop(t, Q.sub + 0.1 + i * 0.08, 0.5);
          const hop = !frozen && !spinning ? Math.max(0, bob(t, i * 0.3)) * 20 : 0;
          return <Blob key={skin} x={470 + i * 220} y={FLOOR + 30 + (1 - Math.min(1, up)) * 260 - hop} t={t} s={0.95} skin={skin} mood={done ? "joy" : frozen || spinning ? "wow" : "happy"} arms={done ? "up" : frozen ? "down" : "wave"} look={-0.5 + i * 0.1} seed={i * 5 + 1} />;
        })}
        {/* the team */}
        <Blob x={170} y={FLOOR + (1 - pop(t, Q.team, 0.5)) * 500} t={t} s={1.15} skin="team" hat mood={done ? "joy" : t > Q.robots + 0.4 ? "worried" : "happy"} arms={done ? "up" : "wave"} look={0.7} seed={2} sq={done ? Math.max(0, bob(t)) * 0.06 : 0} />
        <Bubble x={330} y={FLOOR - 190} t={t} at={Q.team + 0.3} until={Q.robots + 0.2} text="trust me, we're delivering" size={24} tail="left" />
        {Array.from({ length: 12 }, (_, c) => {
          const a = Q.stamp + 0.3 + c * 0.08;
          if (t < a) return null;
          const u = tw(t, a, a + 0.6, 0, 1, (x) => x);
          return <Coin key={c} x={170 + (rnd(c) - 0.5) * 160} y={lerp(560, FLOOR - 110, u * u)} r={22} spin={t * 9 + c} opacity={1 - tw(t, a + 0.55, a + 0.62)} />;
        })}

        {/* the payoff */}
        <StampMark x={790} y={230} t={t} at={Q.stamp} kind="kept" s={0.7} />
        <Confetti x={540} y={360} t={t} at={Q.stamp + 0.05} n={110} spread={1.1} seed={9} />
        <Sparkle x={240} y={260} t={t} at={Q.stamp + 0.3} size={44} />
        <Sparkle x={900} y={420} t={t} at={Q.stamp + 0.5} size={34} color={C.ok} />
      </svg>

      {/* end card */}
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 150, opacity: card }}>
        <div style={{ transform: `scale(${pop(t, Q.card, 0.6)})` }}>
          <Seal t={t} at={Q.card} size={200} spin={(t - Q.card) * 6} />
        </div>
        <div style={{ marginTop: 26, fontFamily: F.mono, fontWeight: 600, fontSize: 120, letterSpacing: "0.28em", marginRight: "-0.28em", color: C.ink }}>KEPT</div>
        <div style={{ fontFamily: F.mono, fontSize: 38, color: C.ink2, opacity: pop(t, Q.card + 0.5, 0.5) }}>
          Promises the <span style={{ color: C.ok }}>swarm</span> enforces.
        </div>
        <div style={{ marginTop: 44, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, fontFamily: F.mono, fontSize: 30, opacity: pop(t, Q.card + 0.9, 0.5) }}>
          <span style={{ color: "#0b0d0c", background: C.ok, padding: "8px 24px", borderRadius: 999, fontWeight: 600 }}>keptmd.vercel.app</span>
          <span style={{ color: C.ink }}>@keptonchainn</span>
          <span style={{ fontSize: 20, letterSpacing: "0.3em", color: C.dim }}>BUILT ON IMD · ROBINHOOD CHAIN</span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#000", opacity: tw(t, sheet.duration - 0.6, sheet.duration - 0.05) }} />
    </AbsoluteFill>
  );
};
