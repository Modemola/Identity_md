import React from "react";
import { AbsoluteFill } from "remotion";
import { C, INOUT } from "../theme";
import { DayOne, Hype, Soon } from "./ActsA";
import { Meet, Trust, VaultAct } from "./ActsB";
import { End, Real, SwarmAct, VerdictAct } from "./ActsC";
import { Captions, TL, tw, useSeconds } from "./kit";

const ACTS: Record<string, React.FC> = { hype: Hype, dayone: DayOne, soon: Soon, trust: Trust, meet: Meet, vault: VaultAct, swarm: SwarmAct, verdict: VerdictAct, real: Real, end: End };
/// Acts that open on an iris; the rest whip in from the right.
const IRIS = new Set(["meet", "end"]);
const WHIP = 0.4;

export const Explainer: React.FC<{ clean?: boolean }> = ({ clean }) => {
  const t = useSeconds();
  return (
    <AbsoluteFill style={{ background: "#060807", color: C.ink }}>
      {TL.scenes.map((s, i) => {
        const next = TL.scenes[i + 1];
        const leaveIris = next && IRIS.has(next.id);
        if (t < s.start - WHIP || t > s.end + (leaveIris ? 0.7 : WHIP)) return null;
        const A = ACTS[s.id];
        let style: React.CSSProperties = {};
        if (i > 0 && IRIS.has(s.id)) {
          const r = tw(t, s.start - 0.15, s.start + 0.55, 0, 1, INOUT) * 1300;
          style = { clipPath: `circle(${r}px at 50% 50%)`, zIndex: 2 };
        } else if (i > 0) {
          const u = tw(t, s.start - WHIP, s.start + 0.2, 0, 1, INOUT);
          style = { transform: `translateX(${(1 - u) * 1920}px)`, filter: u < 1 ? `blur(${Math.sin(u * Math.PI) * 14}px)` : undefined, zIndex: 1 };
        }
        if (next && !leaveIris) {
          const v = tw(t, s.end - WHIP, s.end + 0.2, 0, 1, INOUT);
          if (v > 0) style = { ...style, transform: `translateX(${-v * 1920}px)`, filter: `blur(${Math.sin(v * Math.PI) * 14}px)` };
        }
        if (!next) style = { ...style, opacity: 1 - tw(t, s.end - 1.0, s.end - 0.1) };
        return (
          <AbsoluteFill key={s.id} style={style}>
            <A />
          </AbsoluteFill>
        );
      })}
      {TL.scenes.filter((s, i) => i > 0 && IRIS.has(s.id)).map((s) => {
        const r = tw(t, s.start - 0.15, s.start + 0.55, 0, 1, INOUT) * 1300;
        const o = r > 0 && r < 1300 ? 1 : 0;
        return (
          <AbsoluteFill key={`ring-${s.id}`} style={{ opacity: o, zIndex: 3 }}>
            <svg width={1920} height={1080}>
              <circle cx={960} cy={540} r={r} fill="none" stroke={C.ok} strokeWidth={10} />
            </svg>
          </AbsoluteFill>
        );
      })}
      {clean ? null : (
        <AbsoluteFill style={{ zIndex: 5 }}>
          <Captions />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ zIndex: 6, background: "radial-gradient(ellipse 90% 85% at 50% 50%, transparent 60%, rgba(0,0,0,0.5) 100%)", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
