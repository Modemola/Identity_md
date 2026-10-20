import React from "react";
import { AbsoluteFill } from "remotion";
import { HOOK, TOKEN, VAULT } from "../data";
import { C, F, OUT } from "../theme";
import { line, scene, tw, useSeconds } from "../time";
import { Eyebrow, Panel } from "../ui/Type";

const Tile: React.FC<{ big: string; label: string; t: number; at: number; color?: string }> = ({ big, label, t, at, color = C.ink }) => {
  const p = tw(t, at, at + 0.8, 0, 1, OUT);
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
      <Panel style={{ width: 380, padding: "34px 30px" }}>
        <div style={{ fontFamily: F.mono, fontSize: 92, fontWeight: 500, color, lineHeight: 1 }}>{big}</div>
        <div style={{ fontFamily: F.mono, fontSize: 22, color: C.ink2, marginTop: 18, lineHeight: 1.35 }}>{label}</div>
      </Panel>
    </div>
  );
};

/// Built to be checked.
export const Proof: React.FC = () => {
  const t = useSeconds();
  const s = scene("proof");
  const L14 = line("L14");
  const out = tw(t, s.end - 0.6, s.end);
  const addrs: [string, string][] = [["KeptVault", VAULT], ["KEPT token", TOKEN], ["KeptHook", HOOK]];
  return (
    <AbsoluteFill style={{ opacity: 1 - out, alignItems: "center" }}>
      <div style={{ marginTop: 180 }}>
        <Eyebrow t={t} at={s.start + 0.2}>Built to be checked</Eyebrow>
      </div>
      <div style={{ display: "flex", gap: 30, marginTop: 60 }}>
        <Tile big="221" label="contract tests passing" t={t} at={L14.start + 0.1} />
        <Tile big="3" label="contracts live on Robinhood Chain" t={t} at={L14.start + 2.0} />
        <Tile big="2" label="IMD launches, audited by IMD's agents" t={t} at={L14.start + 3.2} />
        <Tile big="2/2" label="verdicts kept by the swarm" t={t} at={L14.start + 4.4} color={C.ok} />
      </div>
      <div style={{ marginTop: 60, display: "grid", gridTemplateColumns: "auto auto", columnGap: 28, rowGap: 12, fontFamily: F.mono, fontSize: 19, opacity: tw(t, L14.start + 5.0, L14.start + 5.8) }}>
        {addrs.map(([n, a]) => (
          <React.Fragment key={n}>
            <span style={{ color: C.dim, letterSpacing: "0.12em", textAlign: "right" }}>{n}</span>
            <span style={{ color: C.ink2 }}>{a}</span>
          </React.Fragment>
        ))}
      </div>
    </AbsoluteFill>
  );
};
