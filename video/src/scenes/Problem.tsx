import { AbsoluteFill } from "remotion";
import { C, F } from "../theme";
import { line, scene, tw, useSeconds } from "../time";
import { Lamp } from "../ui/Marks";
import { Eyebrow, Rise } from "../ui/Type";

const MILES = [
  { m: "MONTH 3", what: "Ship the app" },
  { m: "MONTH 6", what: "Launch the website" },
  { m: "MONTH 9", what: "Open source the code" },
  { m: "MONTH 12", what: "Grow the pool" },
];

/// Vesting: the clock runs, every tranche unlocks, every promise stays unshipped.
export const Problem: React.FC = () => {
  const t = useSeconds();
  const s = scene("problem");
  const L3 = line("L3");
  const L4 = line("L4");
  const out = tw(t, s.end - 0.6, s.end);
  const clock = tw(t, L3.start + 0.6, L3.end + 0.2, 0, 1, (x) => x);
  const W = 1300;
  return (
    <AbsoluteFill style={{ opacity: 1 - out, alignItems: "center" }}>
      <div style={{ marginTop: 150 }}>
        <Eyebrow t={t} at={s.start + 0.2}>Vesting · the usual answer</Eyebrow>
      </div>
      <div style={{ position: "absolute", top: 330, left: (1920 - W) / 2, width: W, fontFamily: F.mono }}>
        <div style={{ height: 3, background: C.soft, position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, transformOrigin: "0 50%", transform: `scaleX(${clock})`, background: C.ink }} />
        </div>
        <div style={{ position: "absolute", left: clock * W, top: -34, transform: "translateX(-50%)", fontSize: 18, letterSpacing: "0.2em", color: C.dim }}>TIME</div>
        {MILES.map((m, i) => {
          const x = ((i + 1) / 4) * W - 40;
          const hit = clock * W >= x;
          const k = tw(t, L3.start + 0.6 + ((i + 1) / 4) * (L3.end - L3.start - 0.4), L3.start + 0.9 + ((i + 1) / 4) * (L3.end - L3.start - 0.4));
          return (
            <div key={m.m} style={{ position: "absolute", left: x, top: -11, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 22, height: 22, background: hit ? C.ink : C.void, border: `2px solid ${hit ? C.ink : C.faint}` }} />
              <div style={{ marginTop: 22, fontSize: 16, letterSpacing: "0.18em", color: C.dim }}>{m.m}</div>
              <div style={{ marginTop: 26, fontSize: 24, color: hit ? C.ok : C.faint, opacity: 0.4 + 0.6 * k, whiteSpace: "nowrap" }}>UNLOCKED</div>
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, fontSize: 20, color: hit ? C.alarm : C.faint, opacity: k, whiteSpace: "nowrap" }}>
                <Lamp color={C.alarm} size={10} /> {m.what}: not shipped
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 720, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Rise text="Nobody checks if the promise was kept." t={t} at={L4.start} size={64} align="center" accent={["kept."]} accentColor={C.alarm} />
      </div>
    </AbsoluteFill>
  );
};
