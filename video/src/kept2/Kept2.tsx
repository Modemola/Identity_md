import React from "react";
import { AbsoluteFill } from "remotion";
import { Again, Launch, Meet } from "./Acts1";
import { Groups, Money, Record } from "./Acts2";
import { End, Launchpads, Live, Promises, Telegram } from "./Acts3";
import { Captions, INOUT, P, TL, tw, useSeconds } from "./kit";

const ACTS: Record<string, { C: React.FC; color: string; at: [number, number] }> = {
  launch: { C: Launch, color: P.yellow, at: [960, 540] },
  again: { C: Again, color: P.violet, at: [1500, 300] },
  meet: { C: Meet, color: P.mint, at: [960, 540] },
  record: { C: Record, color: P.blue, at: [400, 800] },
  money: { C: Money, color: P.pink, at: [1600, 700] },
  groups: { C: Groups, color: P.orange, at: [300, 300] },
  live: { C: Live, color: P.cyan, at: [1500, 800] },
  telegram: { C: Telegram, color: P.tg, at: [500, 500] },
  launchpads: { C: Launchpads, color: P.lime, at: [1400, 300] },
  promises: { C: Promises, color: P.grape, at: [960, 900] },
  end: { C: End, color: P.cream, at: [960, 540] },
};
const RINGS = [P.yellow, P.pink, P.white, P.ink];
const IRIS = 0.75;

/// KEPT 2.0: each act opens in a circle of its own colour that grows over the last one, with
/// rings of colour riding its edge.
export const Kept2: React.FC<{ clean?: boolean }> = ({ clean }) => {
  const t = useSeconds();
  const scenes = TL.scenes;
  return (
    <AbsoluteFill style={{ background: P.ink }}>
      {scenes.map((s, i) => {
        const next = scenes[i + 1];
        if (t < s.start || (next && t > next.start + IRIS + 0.05)) return null;
        const a = ACTS[s.id];
        const p = i === 0 ? 1 : tw(t, s.start, s.start + IRIS, 0, 1, INOUT);
        const r = p * 2300;
        const [cx, cy] = a.at;
        return (
          <AbsoluteFill key={s.id} style={{ clipPath: p >= 1 ? undefined : `circle(${r}px at ${cx}px ${cy}px)` }}>
            <a.C />
          </AbsoluteFill>
        );
      })}
      {/* rings on the iris edge */}
      {scenes.slice(1).map((s, i) => {
        if (t < s.start || t > s.start + IRIS + 0.3) return null;
        const p = tw(t, s.start, s.start + IRIS, 0, 1, INOUT);
        const [cx, cy] = ACTS[s.id].at;
        return (
          <svg key={s.id} width={1920} height={1080} style={{ position: "absolute" }}>
            {RINGS.map((c, k) => (
              <circle key={k} cx={cx} cy={cy} r={Math.max(0, p * 2300 - k * 34)} fill="none" stroke={c} strokeWidth={26} opacity={1 - tw(t, s.start + IRIS, s.start + IRIS + 0.3)} />
            ))}
          </svg>
        );
      })}
      {clean ? null : <Captions />}
    </AbsoluteFill>
  );
};
