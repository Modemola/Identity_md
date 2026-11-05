import React from "react";
import { AbsoluteFill } from "remotion";
import { C, F, INOUT } from "../theme";
import { Agent, Blob, Bubble, CastDefs, Coin, Confetti, Dust, Fire, Sparkle } from "../explainer/cast";
import { bob, Kinetic, pop, rnd, Stage, tw, useSeconds } from "../explainer/kit";
import { Poster } from "../explainer/props";
import { EndCard } from "./EndCard";
import sheet from "./roadmap.json";

/// Short 02: a roadmap checked line by line. Beat sheet: video/shorts/02-roadmap-meets-swarm.md.

const Q = sheet.cues;
const FLOOR = 930;
const LABELS = ["Mobile app", "Mainnet", "Partnerships", "Audit"];
const PX = 390;
const PY = 250;
const PS = 1.05;
// the poster's checkbox centres and label rows, in frame coordinates (the swing has settled by then)
const box = (i: number) => ({ x: PX - 194 * PS, y: PY + (106 + 84 * i) * PS });
const GRID = Array.from({ length: 9 }, (_, i) => ({ x: 760 + (i % 3) * 110, y: 300 + Math.floor(i / 3) * 120 }));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

export const RoadmapMeetsSwarm: React.FC = () => {
  const t = useSeconds();
  const verdictAt = Q.items.map((a) => a + Q.scan + 0.5);
  const kept = Q.yes.map((y) => y >= 7);
  // which line the swarm is on
  let cur = -1;
  for (let i = 0; i < Q.items.length; i++) if (t >= Q.items[i]) cur = i;
  const brokenSoFar = verdictAt.filter((a, i) => !kept[i] && t > a).length;
  const fireK = Math.min(1, brokenSoFar * 0.55) * tw(t, verdictAt[2], verdictAt[2] + 0.5) * (1 - tw(t, Q.score - 0.4, Q.score));
  const scene = 1 - tw(t, Q.score - 0.3, Q.score + 0.2, 0, 1, INOUT);
  const score = pop(t, Q.score, 0.5) * (1 - tw(t, Q.question - 0.3, Q.question));
  const question = tw(t, Q.question - 0.1, Q.question + 0.2) * (1 - tw(t, Q.card - 0.4, Q.card));
  const card = tw(t, Q.card - 0.3, Q.card + 0.3, 0, 1, INOUT);
  const lastBroken = verdictAt[3];
  const shake = [2, 3].reduce((acc, i) => acc + (t > verdictAt[i] && t < verdictAt[i] + 0.5 ? 10 * Math.exp(-(t - verdictAt[i]) * 9) * Math.sin((t - verdictAt[i]) * 70) : 0), 0);

  return (
    <AbsoluteFill style={{ transform: `translate(${shake}px, ${shake * 0.4}px)` }}>
      <Stage light={fireK > 0.1 ? `rgba(255,107,98,${0.08 + 0.1 * fireK})` : "rgba(62,207,122,0.12)"} at={[40, 40]} floor={FLOOR} />

      <AbsoluteFill style={{ opacity: scene }}>
        <div style={{ position: "absolute", top: 36, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <Kinetic text="POV: your roadmap meets the swarm" t={t} at={Q.title + 0.05} size={50} accent={{ swarm: C.ok }} />
        </div>
        <svg width={1080} height={1080} viewBox="0 0 1080 1080" style={{ position: "absolute", overflow: "visible" }}>
          <CastDefs />
          <Poster x={PX} y={PY} t={t} at={Q.poster} s={PS} items={LABELS.map((label, i) => ({ label, at: Q.poster + 0.5 + i * 0.12 }))} />
          <Dust x={PX} y={FLOOR} t={t} at={Q.poster + 0.38} />
          {/* verdicts on the poster */}
          {LABELS.map((_, i) => {
            const b = box(i);
            const v = verdictAt[i];
            const p = pop(t, v, 0.35);
            const scanning = t > Q.items[i] && t < v;
            return (
              <g key={i}>
                {scanning ? <rect x={b.x - 26} y={b.y - 34} width={470} height={68} rx={10} fill="none" stroke={C.caution} strokeWidth={4} strokeDasharray="12 8" strokeDashoffset={-t * 60} /> : null}
                {t > v ? (
                  kept[i] ? (
                    <g>
                      <rect x={b.x - 26} y={b.y - 34} width={470} height={68} rx={10} fill="rgba(62,207,122,0.16)" stroke={C.ok} strokeWidth={4} opacity={p} />
                      <path d={`M ${b.x - 12} ${b.y} L ${b.x - 2} ${b.y + 12} L ${b.x + 20} ${b.y - 16}`} stroke={C.okDeep} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" transform={`translate(${b.x} ${b.y}) scale(${p}) translate(${-b.x} ${-b.y})`} />
                    </g>
                  ) : (
                    <g>
                      <rect x={b.x - 26} y={b.y - 34} width={470} height={68} rx={10} fill="rgba(255,107,98,0.16)" stroke={C.alarm} strokeWidth={4} opacity={p} />
                      <path d={`M ${b.x - 12} ${b.y - 12} L ${b.x + 12} ${b.y + 12} M ${b.x + 12} ${b.y - 12} L ${b.x - 12} ${b.y + 12}`} stroke={C.alarm} strokeWidth={8} strokeLinecap="round" transform={`translate(${b.x} ${b.y}) scale(${p}) translate(${-b.x} ${-b.y})`} />
                      <line x1={b.x + 36} y1={b.y - 2} x2={b.x + 36 + 300 * tw(t, v, v + 0.3)} y2={b.y - 2} stroke={C.alarm} strokeWidth={6} strokeLinecap="round" />
                    </g>
                  )
                ) : null}
                <Sparkle x={b.x} y={b.y} t={t} at={v} size={30} color={kept[i] ? C.ok : C.alarm} />
              </g>
            );
          })}
          {/* the swarm */}
          {GRID.map((g, k) => {
            const a = Q.robots + k * 0.06;
            if (t < a) return null;
            const e = tw(t, a, a + 0.6, 0, 1, INOUT);
            const x = lerp(1250, g.x, e);
            const y = lerp(-150, g.y, e) - Math.sin(e * Math.PI) * 100;
            let state: "idle" | "scan" | "yes" | "no" = "idle";
            if (cur >= 0 && t > Q.items[cur]) {
              const v = verdictAt[cur];
              const voteAt = v - 0.45 + k * 0.05;
              state = t < voteAt ? "scan" : k < Q.yes[cur] ? "yes" : "no";
            }
            const b = cur >= 0 ? box(cur) : null;
            const beam = b && t > Q.items[cur] && t < verdictAt[cur] - 0.4;
            return (
              <g key={k}>
                {beam ? <path d={`M ${x - 8} ${y} L ${x + 8} ${y} L ${b!.x + 440} ${b!.y + 20} L ${b!.x + 440} ${b!.y - 20} Z`} fill={C.ok} opacity={0.08 + 0.04 * Math.sin(t * 12 + k)} /> : null}
                <Agent x={x} y={y} t={t} s={0.55} state={state} seed={k} />
              </g>
            );
          })}
          {/* the tally for the current line */}
          {cur >= 0 && t > verdictAt[cur] - 0.1 ? (
            <g transform={`translate(870 680) scale(${pop(t, verdictAt[cur] - 0.1, 0.3)})`}>
              <rect x={-120} y={-36} width={240} height={64} rx={32} fill={kept[cur] ? C.ok : C.alarm} />
              <text x={0} y={8} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={30} fill="#0b0d0c" letterSpacing={2}>
                {Q.yes[cur]}/9 {kept[cur] ? "KEPT" : "BROKEN"}
              </text>
            </g>
          ) : null}
          {/* coins: to the team when kept, into the fire when broken */}
          {LABELS.map((_, i) =>
            Array.from({ length: 6 }, (_, c) => {
              const a = verdictAt[i] + 0.2 + c * 0.07;
              if (t < a || t > a + 0.75) return null;
              const u = tw(t, a, a + 0.7, 0, 1, (x) => x);
              const b = box(i);
              const tx = kept[i] ? 860 + (rnd(c) - 0.5) * 80 : 300 + (rnd(c + i) - 0.5) * 160;
              const ty = kept[i] ? FLOOR - 120 : FLOOR - 40;
              return <Coin key={`${i}-${c}`} x={lerp(b.x + 200, tx, u)} y={lerp(b.y, ty, u) - Math.sin(u * Math.PI) * (kept[i] ? 160 : 40)} r={20} spin={t * 9 + c} opacity={1 - tw(t, a + 0.65, a + 0.72)} />;
            }),
          )}
          <path d={`M 170 ${FLOOR} L 200 ${FLOOR - 30} L 400 ${FLOOR - 30} L 430 ${FLOOR} Z`} fill="#2a1d1a" stroke="#5a3a33" strokeWidth={3} opacity={tw(t, verdictAt[2] - 0.3, verdictAt[2])} />
          <Fire x={300} y={FLOOR - 30} t={t} k={fireK} w={220} />
          <Blob x={860} y={FLOOR + (1 - pop(t, Q.team, 0.5)) * 500} t={t} s={1.1} skin="team" hat mood={t > lastBroken ? "worried" : t > verdictAt[2] ? "wow" : t > verdictAt[0] ? "joy" : "happy"} arms={t > verdictAt[0] && t < verdictAt[2] ? "up" : "wave"} look={-0.7} seed={2} sq={t > verdictAt[0] && t < verdictAt[2] ? Math.max(0, bob(t)) * 0.05 : 0} />
          <Bubble x={760} y={FLOOR - 200} t={t} at={Q.team + 0.2} until={Q.robots + 0.3} text="it's all done, trust" size={26} tail="right" />
          <Bubble x={740} y={FLOOR - 200} t={t} at={lastBroken + 0.3} until={Q.score - 0.4} text="it was coming soon!" size={26} tail="right" />
        </svg>
      </AbsoluteFill>

      {/* the scorecard */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: score }}>
        <div style={{ transform: `scale(${0.7 + 0.3 * score})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 26, fontFamily: F.mono }}>
          <div style={{ fontSize: 28, letterSpacing: "0.3em", color: C.dim }}>THE VERDICT</div>
          <div style={{ display: "flex", gap: 40 }}>
            {[
              { n: 2, label: "KEPT", col: C.ok, sub: "released" },
              { n: 2, label: "BROKEN", col: C.alarm, sub: "burned" },
            ].map((r) => (
              <div key={r.label} style={{ width: 380, padding: "30px 0", textAlign: "center", border: `4px solid ${r.col}`, borderRadius: 24, background: "rgba(0,0,0,0.5)" }}>
                <div style={{ fontSize: 120, fontWeight: 600, color: r.col, lineHeight: 1 }}>{r.n}</div>
                <div style={{ fontSize: 40, fontWeight: 600, color: r.col, letterSpacing: "0.12em", marginTop: 8 }}>{r.label}</div>
                <div style={{ fontSize: 26, color: C.ink2, marginTop: 10 }}>tokens {r.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </AbsoluteFill>

      {/* the question */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: question }}>
        <Kinetic text="Would your roadmap" t={t} at={Q.question} size={76} />
        <div style={{ height: 10 }} />
        <Kinetic text="survive?" t={t} at={Q.question + 0.35} size={150} accent={{ survive: C.ok }} />
        <div style={{ marginTop: 40, fontFamily: F.mono, fontSize: 34, color: C.ink2, opacity: pop(t, Q.question + 0.9, 0.4) }}>reply with yours ↓</div>
      </AbsoluteFill>
      <svg width={1080} height={1080} style={{ position: "absolute" }}>
        <Confetti x={540} y={600} t={t} at={Q.question + 0.4} n={70} seed={5} />
      </svg>

      <EndCard t={t} at={Q.card} opacity={card} />
      <AbsoluteFill style={{ background: "#000", opacity: tw(t, sheet.duration - 0.6, sheet.duration - 0.05) }} />
    </AbsoluteFill>
  );
};
