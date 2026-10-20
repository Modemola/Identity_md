import { AbsoluteFill } from "remotion";
import { C, F, IN, OUT } from "../theme";
import { line, scene, tw, useSeconds } from "../time";
import { Lamp, Seal } from "../ui/Marks";
import { Eyebrow, Rise } from "../ui/Type";

const ROADMAP = ["Ship the app", "Launch the website", "Open source the code", "Grow the pool"];

/// Day one: the team's tokens unlock at once, and the roadmap beside them is only text. Then the seal.
export const Open: React.FC = () => {
  const t = useSeconds();
  const s = scene("open");
  const L1 = line("L1");
  const L2 = line("L2");
  const reveal = L2.end + 0.45;
  const boardOut = tw(t, reveal - 0.35, reveal + 0.4, 0, 1, IN);
  const markIn = tw(t, reveal, reveal + 1.2, 0, 1, OUT);
  const out = tw(t, s.end - 0.6, s.end);
  const unlock = tw(t, L1.start + 1.4, L1.start + 3.0);
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 180, display: "flex", justifyContent: "center", opacity: 1 - boardOut }}>
        <Rise text="Every token launch hands the team its tokens on day one." t={t} at={L1.start} size={58} align="center" maxWidth={1500} accent={["day", "one."]} out={L2.start - 0.3} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 190, display: "flex", justifyContent: "center" }}>
        <Rise text="The roadmap is just a promise." t={t} at={L2.start} size={84} align="center" accent={["promise."]} accentColor={C.caution} out={reveal - 0.25} />
      </div>

      {/* the team wallet fills on day one */}
      <div style={{ position: "absolute", left: 300, top: 430, width: 560, opacity: tw(t, L1.start + 0.8, L1.start + 1.4) * (1 - boardOut), fontFamily: F.mono }}>
        <div style={{ fontSize: 17, letterSpacing: "0.22em", color: C.dim }}>TEAM ALLOCATION · DAY 1</div>
        <div style={{ marginTop: 18, fontSize: 64, fontWeight: 500, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{Math.round(300_000_000 * unlock).toLocaleString("en-US")}</div>
        <div style={{ marginTop: 18, height: 10, background: C.soft }}>
          <div style={{ height: "100%", width: `${unlock * 100}%`, background: C.ink }} />
        </div>
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, fontSize: 20, color: unlock > 0.98 ? C.ink : C.dim }}>
          <Lamp color={unlock > 0.98 ? C.caution : C.faint} /> {unlock > 0.98 ? "UNLOCKED. NOTHING SHIPPED YET." : "UNLOCKING"}
        </div>
      </div>

      {/* the roadmap: words, unchecked */}
      <div style={{ position: "absolute", right: 300, top: 420, width: 520, opacity: tw(t, L1.start + 1.6, L1.start + 2.2) * (1 - boardOut), fontFamily: F.mono }}>
        <div style={{ fontSize: 17, letterSpacing: "0.22em", color: C.dim }}>ROADMAP</div>
        {ROADMAP.map((r, i) => {
          const p = tw(t, L1.start + 1.9 + i * 0.15, L1.start + 2.5 + i * 0.15);
          const shake = t > L2.start ? Math.sin(t * 40 + i) * tw(t, L2.start, L2.start + 0.3) * (1 - tw(t, L2.start + 0.3, L2.start + 0.8)) * 3 : 0;
          return (
            <div key={r} style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 22, fontSize: 30, color: C.ink2, opacity: p, transform: `translateX(${(1 - p) * 20 + shake}px)` }}>
              <span style={{ width: 30, height: 30, border: `2px solid ${t > L2.start ? C.caution : C.faint}` }} />
              {r}
            </div>
          );
        })}
      </div>

      {/* the reveal */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: markIn }}>
        <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", background: "radial-gradient(circle, rgba(62,207,122,0.16), transparent 62%)", transform: `scale(${0.6 + markIn * 0.5})` }} />
        <div style={{ transform: `translateY(${-110 + (1 - markIn) * 30}px)` }}>
          <Seal t={t} at={reveal} size={300} spin={(t - reveal) * 6} />
        </div>
        <div style={{ position: "absolute", top: 640, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <div style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 120, letterSpacing: "0.3em", marginRight: "-0.3em", opacity: tw(t, reveal + 0.5, reveal + 1.2), transform: `translateY(${(1 - tw(t, reveal + 0.5, reveal + 1.3)) * 30}px)` }}>KEPT</div>
          <Rise text="Promises the swarm enforces." t={t} at={reveal + 1.1} size={44} align="center" accent={["swarm"]} color={C.ink2} weight={400} />
          <div style={{ marginTop: 16 }}>
            <Eyebrow t={t} at={reveal + 1.9} lamp={C.ok}>Live on Robinhood Chain · built on IMD</Eyebrow>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
