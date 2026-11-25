import React from "react";
import { AbsoluteFill } from "remotion";
import { Again, Launch, Meet } from "./A";
import { Groups, Money, Record } from "./B";
import { End, Launchpads, Live, Promises, Telegram } from "./C";
import { INOUT, TL, tw, useSeconds } from "./kit";

const ACTS: Record<string, React.FC> = {
  launch: Launch,
  again: Again,
  meet: Meet,
  record: Record,
  money: Money,
  groups: Groups,
  live: Live,
  telegram: Telegram,
  launchpads: Launchpads,
  promises: Promises,
  end: End,
};
const X = 0.8;

/// KEPT 2.0, the film. Each act dissolves in out of a blur over the one before.
export const Kept2: React.FC<{ clean?: boolean }> = () => {
  const t = useSeconds();
  const scenes = TL.scenes;
  return (
    <AbsoluteFill style={{ background: "#fff" }}>
      {scenes.map((s, i) => {
        const next = scenes[i + 1];
        if (t < s.start - 0.01 || (next && t > next.start + X)) return null;
        const A = ACTS[s.id];
        const p = i === 0 ? 1 : tw(t, s.start, s.start + X, 0, 1, INOUT);
        return (
          <AbsoluteFill key={s.id} style={{ opacity: p, filter: p < 1 ? `blur(${(1 - p) * 24}px)` : undefined, transform: p < 1 ? `scale(${1.04 - 0.04 * p})` : undefined }}>
            <A />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};
