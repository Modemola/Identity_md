import { AbsoluteFill } from "remotion";
import { C, F, IN, OUT } from "../theme";
import { line, scene, tw, useSeconds } from "../time";
import { Lamp, Stamp } from "../ui/Marks";
import { Panel } from "../ui/Type";

const SEEDS = Array.from({ length: 46 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.678;
  return { u: a - Math.floor(a), v: b - Math.floor(b) };
});

const Card: React.FC<{ t: number; title: string; amount: string; at: number; kind: "kept" | "broken"; stampAt: number }> = ({ t, title, amount, at, kind, stampAt }) => {
  const p = tw(t, at, at + 0.7, 0, 1, OUT);
  const done = t > stampAt;
  const col = kind === "kept" ? C.ok : C.alarm;
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 30}px)`, position: "relative" }}>
      <Panel style={{ width: 620, padding: "30px 34px", borderColor: done ? col : C.ink }} tick={done ? col : undefined}>
        <div style={{ fontFamily: F.mono, display: "flex", alignItems: "center", gap: 12, fontSize: 18, letterSpacing: "0.12em", color: done ? col : C.caution }}>
          <Lamp color={done ? col : C.caution} size={11} /> {done ? (kind === "kept" ? "SWARM: DELIVERED" : "NOT PROVEN IN TIME") : "AWAITING VERDICT"}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 34, fontWeight: 500, marginTop: 16 }}>{title}</div>
        <div style={{ fontFamily: F.mono, fontSize: 24, color: C.dim, marginTop: 10 }}>tranche · {amount}</div>
      </Panel>
      <div style={{ position: "absolute", right: -40, top: -36 }}>
        <Stamp t={t} at={stampAt} kind={kind} size={46} />
      </div>
    </div>
  );
};

/// Kept: the tranche flows to the team. Not proven in time: it burns.
export const Verdict: React.FC = () => {
  const t = useSeconds();
  const s = scene("verdict");
  const L9 = line("L9");
  const L10 = line("L10");
  const out = tw(t, s.end - 0.6, s.end);
  const keptAt = L9.start + 0.35;
  const burnAt = L10.start + 0.45;
  const flow = tw(t, keptAt + 0.5, keptAt + 2.3, 0, 1, (x) => x);
  const burn = tw(t, burnAt + 0.4, burnAt + 2.4, 0, 1, (x) => x);
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <div style={{ position: "absolute", left: 170, top: 210 }}>
        <Card t={t} title="Ship the app" amount="50,000,000" at={s.start + 0.1} kind="kept" stampAt={keptAt} />
      </div>
      <div style={{ position: "absolute", left: 1130, top: 210 }}>
        <Card t={t} title="Grow the pool" amount="150,000,000" at={s.start + 0.3} kind="broken" stampAt={burnAt} />
      </div>
      {/* tokens stream to the team */}
      {SEEDS.map((d, i) => {
        const k = Math.max(0, Math.min(1, flow * 1.6 - d.u * 0.6));
        if (k <= 0 || k >= 1) return null;
        const x = 480 + (d.v - 0.5) * 240 + Math.sin(k * Math.PI) * (d.v - 0.5) * 120;
        const y = 420 + k * 330;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: 10, height: 10, background: C.ok, boxShadow: `0 0 12px ${C.ok}`, opacity: Math.sin(k * Math.PI) }} />;
      })}
      <div style={{ position: "absolute", left: 300, top: 780, fontFamily: F.mono, opacity: tw(t, keptAt + 0.4, keptAt + 1.0) }}>
        <Panel style={{ padding: "18px 30px", display: "flex", alignItems: "center", gap: 20, borderColor: C.ok }} tick={C.ok}>
          <span style={{ fontSize: 18, letterSpacing: "0.2em", color: C.dim }}>TEAM WALLET</span>
          <span style={{ fontSize: 34, color: C.ok, fontVariantNumeric: "tabular-nums" }}>+{Math.round(50_000_000 * flow).toLocaleString("en-US")}</span>
        </Panel>
      </div>
      {/* tokens burn */}
      {SEEDS.map((d, i) => {
        const k = Math.max(0, Math.min(1, burn * 1.5 - d.u * 0.5));
        if (k <= 0 || k >= 1) return null;
        const x = 1440 + (d.v - 0.5) * 420 + Math.sin(k * 9 + i) * 14;
        const y = 420 + k * k * 340 - Math.sin(k * Math.PI) * 60 * d.v;
        const hot = 1 - k;
        return <div key={`b${i}`} style={{ position: "absolute", left: x, top: y, width: 7 + 6 * hot, height: 7 + 6 * hot, borderRadius: "50%", background: hot > 0.5 ? "#ffd27a" : C.alarm, boxShadow: `0 0 ${14 * hot}px ${C.alarm}`, opacity: Math.sin(k * Math.PI) }} />;
      })}
      <div style={{ position: "absolute", left: 1290, top: 780, fontFamily: F.mono, opacity: tw(t, burnAt + 0.4, burnAt + 1.0) }}>
        <Panel style={{ padding: "18px 30px", display: "flex", alignItems: "center", gap: 20, borderColor: C.alarm }} tick={C.alarm}>
          <span style={{ fontSize: 18, letterSpacing: "0.2em", color: C.dim }}>BURNED TO 0x…dEaD</span>
          <span style={{ fontSize: 34, color: C.alarm, fontVariantNumeric: "tabular-nums" }}>{Math.round(150_000_000 * burn).toLocaleString("en-US")}</span>
        </Panel>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 100, display: "flex", justifyContent: "center", gap: 120, fontFamily: F.mono, fontSize: 22, letterSpacing: "0.22em" }}>
        <span style={{ color: C.ok, opacity: tw(t, L9.start, L9.start + 0.5) }}>KEPT → THE TEAM</span>
        <span style={{ color: C.alarm, opacity: tw(t, L10.start, L10.start + 0.5) * (1 - tw(t, s.end, s.end + 1, 0, 1, IN)) }}>BROKEN → BURNED</span>
      </div>
    </AbsoluteFill>
  );
};
