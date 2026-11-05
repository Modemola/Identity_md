import { AbsoluteFill } from "remotion";
import { C, F, OUT } from "../theme";
import { line, scene, tw, useSeconds } from "../time";
import { Lamp } from "../ui/Marks";
import { Eyebrow, Rise } from "../ui/Type";

const NODES = [
  { title: "KEPT / IMD", sub: "every trade", frac: 0.0 },
  { title: "KeptHook", sub: "Uniswap v4 hook", frac: 0.22 },
  { title: "Referee Fund", sub: "held by the vault", frac: 0.42 },
  { title: "Kept milestone", sub: "check refunded", frac: 0.72 },
];
const WIRES = ["1% of the IMD side", "sweep", "0.5 IMD back"];

/// Keeping a promise costs nothing: pool fees refund the checks of teams that deliver.
export const Fund: React.FC = () => {
  const t = useSeconds();
  const s = scene("fund");
  const L13 = line("L13");
  const out = tw(t, s.end - 0.6, s.end);
  const at = (f: number) => L13.start + f * (L13.end - L13.start);
  const NW = 300, GAP = 150, X0 = (1920 - (NODES.length * NW + (NODES.length - 1) * GAP)) / 2;
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <div style={{ position: "absolute", top: 170, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Eyebrow t={t} at={s.start + 0.2}>The Referee Fund</Eyebrow>
      </div>
      <div style={{ position: "absolute", top: 230, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Rise text="Keeping a promise costs nothing." t={t} at={s.start + 0.4} size={60} align="center" accent={["nothing."]} />
      </div>
      {NODES.map((n, i) => {
        const p = tw(t, at(n.frac), at(n.frac) + 0.6, 0, 1, OUT);
        const last = i === NODES.length - 1;
        return (
          <div key={n.title} style={{ position: "absolute", left: X0 + i * (NW + GAP), top: 470, width: NW, padding: "26px 24px", border: `1.5px solid ${last ? C.ok : C.ink}`, background: "#0a0a0a", opacity: p, transform: `translateY(${(1 - p) * 20}px)`, fontFamily: F.mono, boxShadow: last ? `0 0 40px rgba(62,207,122,${0.3 * p})` : undefined }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, letterSpacing: "0.2em", color: C.dim }}><Lamp color={last ? C.ok : C.caution} size={9} /> STEP {i + 1}</div>
            <div style={{ fontSize: 30, fontWeight: 500, marginTop: 14, color: last ? C.ok : C.ink }}>{n.title}</div>
            <div style={{ fontSize: 19, color: C.dim, marginTop: 8 }}>{n.sub}</div>
          </div>
        );
      })}
      {WIRES.map((w, i) => {
        const x = X0 + (i + 1) * NW + i * GAP;
        const p = tw(t, at(NODES[i + 1].frac) - 0.4, at(NODES[i + 1].frac) + 0.2);
        const dash = (t * 60) % 24;
        return (
          <div key={w} style={{ position: "absolute", left: x + 8, top: 520, width: GAP - 16, opacity: p }}>
            <svg width={GAP - 16} height={20}>
              <line x1={0} y1={10} x2={GAP - 26} y2={10} stroke={C.ok} strokeWidth={2.5} strokeDasharray="10 6" strokeDashoffset={-dash} />
              <path d={`M${GAP - 28} 3 L${GAP - 17} 10 L${GAP - 28} 17`} fill={C.ok} />
            </svg>
            <div style={{ fontFamily: F.mono, fontSize: 16, color: C.dim, textAlign: "center", marginTop: 8, lineHeight: 1.3 }}>{w}</div>
          </div>
        );
      })}
      <div style={{ position: "absolute", top: 760, left: 0, right: 0, textAlign: "center", fontFamily: F.mono, fontSize: 26, color: C.ink2, opacity: tw(t, at(0.86), at(0.86) + 0.6) }}>
        Breaking one means paying for your own verdict.
      </div>
    </AbsoluteFill>
  );
};
