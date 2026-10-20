import { AbsoluteFill } from "remotion";
import { C, F, OUT } from "../theme";
import { line, scene, tw, useSeconds } from "../time";
import { Lamp } from "../ui/Marks";
import { Swarm } from "../ui/Swarm";
import { Eyebrow, Panel } from "../ui/Type";

const SIG = "0x7c1f9e2a04b38d5561fa0e93c2d7b8a1e64f0c27d93b5a18f6e2c40d9a7b3e1f";

/// The swarm decides: a panel of nine links to the promise, seven must agree, the verdict is signed.
export const SwarmScene: React.FC = () => {
  const t = useSeconds();
  const s = scene("swarm");
  const L7 = line("L7");
  const L8 = line("L8");
  const out = tw(t, s.end - 0.6, s.end);
  const panelAt = L7.start + 0.42 * (L7.end - L7.start);
  // eight agree, one dissents: the real first verdict
  const agreeAt = [0, 1, 2, 3, 4, -1, 5, 6, 7].map((k) => (k < 0 ? Infinity : panelAt + 1.3 + k * 0.38));
  const agreed = agreeAt.filter((a) => t >= a).length;
  const quorum = agreed >= 7;
  const signed = tw(t, L8.start, L8.start + 0.5);
  const verified = tw(t, L8.start + 1.6, L8.start + 2.1);
  const hexN = Math.floor(tw(t, L8.start, L8.start + 1.2, 0, SIG.length, (x) => x));
  const rows: [string, React.ReactNode, number][] = [
    ["QUESTION", "Does keptmd.vercel.app show “Promises the swarm enforces”?", L7.start + 0.3],
    ["PAID", "0.5 IMD to the IMD Intake", L7.start + 1.4],
    ["PANEL", "9 agents · 7 must agree", panelAt],
  ];
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <div style={{ position: "absolute", left: 150, top: 130, opacity: tw(t, s.start, s.start + 1.0) }}>
        <Swarm t={t} size={760} panelAt={panelAt} agreeAt={agreeAt} waveAt={L8.start + 0.2} sealGreenAt={L8.start + 0.4} />
      </div>
      <div style={{ position: "absolute", left: 1020, top: 170, width: 760, fontFamily: F.mono }}>
        <Eyebrow t={t} at={s.start + 0.3} lamp={C.ok}>IMD oracle · live request</Eyebrow>
        <div style={{ marginTop: 34, display: "grid", gridTemplateColumns: "150px 1fr", rowGap: 22 }}>
          {rows.map(([k, v, at]) => (
            <div key={k} style={{ display: "contents" }}>
              <div style={{ fontSize: 17, letterSpacing: "0.2em", color: C.dim, opacity: tw(t, at, at + 0.5), paddingTop: 4 }}>{k}</div>
              <div style={{ fontSize: 25, color: C.ink, lineHeight: 1.35, opacity: tw(t, at, at + 0.5), transform: `translateX(${(1 - tw(t, at, at + 0.6)) * 14}px)` }}>{v}</div>
            </div>
          ))}
        </div>
        {/* the tally */}
        <div style={{ marginTop: 40, opacity: tw(t, panelAt + 0.4, panelAt + 0.9) }}>
          <div style={{ display: "flex", gap: 8 }}>
            {agreeAt.map((a, i) => {
              const on = t >= a;
              const dissent = a === Infinity && agreed >= 8;
              return <div key={i} style={{ width: 58, height: 44, background: on ? C.ok : dissent ? C.soft : "transparent", border: `2px solid ${on ? C.ok : dissent ? C.faint : C.caution}`, boxShadow: on ? `0 0 18px rgba(62,207,122,0.5)` : undefined, transform: `scale(${on ? 1 + 0.15 * (1 - tw(t, a, a + 0.3)) : 1})` }} />;
            })}
          </div>
          <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", gap: 18 }}>
            <span style={{ fontSize: 64, fontWeight: 500, color: quorum ? C.ok : C.caution, fontVariantNumeric: "tabular-nums" }}>{agreed} / 9</span>
            <span style={{ fontSize: 22, color: quorum ? C.ok : C.dim, letterSpacing: "0.12em" }}>{quorum ? "QUORUM REACHED" : "AGREEING"}</span>
          </div>
        </div>
        {/* signed and verified */}
        <div style={{ marginTop: 34, opacity: signed }}>
          <Panel style={{ padding: "18px 22px" }} tick="rgba(62,207,122,0.8)">
            <div style={{ fontSize: 16, letterSpacing: "0.2em", color: C.dim }}>SIGNED VERDICT · EIP-712</div>
            <div style={{ marginTop: 10, fontSize: 18, color: C.ink2, wordBreak: "break-all", lineHeight: 1.45 }}>{SIG.slice(0, hexN)}<span style={{ color: C.ok }}>{hexN < SIG.length ? "▍" : ""}</span></div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, fontSize: 22, color: C.ok, opacity: verified, transform: `translateY(${(1 - tw(t, L8.start + 1.6, L8.start + 2.2, 0, 1, OUT)) * 8}px)` }}>
              <Lamp color={C.ok} /> VERIFIED ONCHAIN BY THE VAULT
            </div>
          </Panel>
        </div>
      </div>
    </AbsoluteFill>
  );
};
