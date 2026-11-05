import { AbsoluteFill } from "remotion";
import { REPO, SITE } from "../data";
import { C, F, OUT } from "../theme";
import { line, scene, tw, useSeconds } from "../time";
import { Seal } from "../ui/Marks";
import { Rise } from "../ui/Type";

export const End: React.FC = () => {
  const t = useSeconds();
  const s = scene("end");
  const L15 = line("L15");
  const inn = tw(t, s.start + 0.2, s.start + 1.4, 0, 1, OUT);
  const black = tw(t, s.end - 1.2, s.end - 0.1);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", width: 1000, height: 1000, borderRadius: "50%", background: "radial-gradient(circle, rgba(62,207,122,0.14), transparent 62%)", opacity: inn }} />
      <div style={{ transform: `translateY(-150px)` }}>
        <Seal t={t} at={s.start + 0.2} size={250} spin={(t - s.start) * 5} />
      </div>
      <div style={{ position: "absolute", top: 600, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 110, letterSpacing: "0.3em", marginRight: "-0.3em", opacity: tw(t, L15.start - 0.6, L15.start), transform: `translateY(${(1 - tw(t, L15.start - 0.6, L15.start + 0.2)) * 24}px)` }}>KEPT</div>
        <Rise text="Promises the swarm enforces." t={t} at={L15.start + 0.5} size={44} align="center" accent={["swarm"]} color={C.ink2} weight={400} />
        <div style={{ marginTop: 30, display: "flex", gap: 30, fontFamily: F.mono, fontSize: 24, opacity: tw(t, L15.start + 1.3, L15.start + 1.9) }}>
          <span style={{ color: C.ok }}>{SITE}</span>
          <span style={{ color: C.faint }}>·</span>
          <span style={{ color: C.ink }}>@keptonchainn</span>
          <span style={{ color: C.faint }}>·</span>
          <span style={{ color: C.ink2 }}>{REPO}</span>
        </div>
        <div style={{ marginTop: 8, fontFamily: F.mono, fontSize: 16, letterSpacing: "0.3em", color: C.dim, opacity: tw(t, L15.start + 1.9, L15.start + 2.5) }}>IMD HACKATHON · ROBINHOOD CHAIN</div>
      </div>
      <AbsoluteFill style={{ background: "#000", opacity: black }} />
    </AbsoluteFill>
  );
};
