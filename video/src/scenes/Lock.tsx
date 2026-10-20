import { AbsoluteFill } from "remotion";
import { C, F, INOUT, OUT } from "../theme";
import { line, scene, tw, useSeconds } from "../time";
import { Browser, Lamp, pagePoint } from "../ui/Marks";
import { Eyebrow, Panel, Rise } from "../ui/Type";

// The site's template icons (web/src/icons.js).
const ICON: Record<string, string[]> = {
  release: ["M4 12V5h7l9 9-7 7-9-9", "M8.5 8.5h.01"],
  page: ["M6 3h9l4 4v14H6z", "M14 3v5h5", "M9 13h7", "M9 17h5"],
  cube: ["M12 3l8 4.5v9L12 21l-8-4.5v-9z", "M4 7.5l8 4.5 8-4.5", "M12 12v9"],
  gauge: ["M4 17a8 8 0 1 1 16 0", "M12 17l4-6", "M4 21h16"],
  lock: ["M6 11h12v10H6z", "M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11"],
};
export const Icon: React.FC<{ name: string; size?: number; color?: string }> = ({ name, size = 40, color = C.ink }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="square">
    {ICON[name].map((d) => <path key={d} d={d} />)}
  </svg>
);

const TILES = [
  { icon: "release", label: "GitHub release", eg: "tag v1.0.0 published", frac: 0.45 },
  { icon: "page", label: "Page contains", eg: "the site shows the text", frac: 0.6 },
  { icon: "cube", label: "Contract deployed", eg: "code at an address", frac: 0.73 },
  { icon: "gauge", label: "Value at least", eg: "an onchain number", frac: 0.86 },
];

const NEW_H = 1840;

/// Lock: the four milestone templates, the locked tranche, and the question the vault writes.
export const Lock: React.FC = () => {
  const t = useSeconds();
  const s = scene("lock");
  const L5 = line("L5");
  const L6 = line("L6");
  const out = tw(t, s.end - 0.6, s.end);
  const at = (f: number) => L5.start + f * (L5.end - L5.start);
  const part1 = 1 - tw(t, L6.start - 0.5, L6.start + 0.2);
  const browserIn = tw(t, L6.start - 0.4, L6.start + 0.6, 0, 1, OUT);
  const cam = {
    x: 640,
    y: tw(t, L6.start, L6.start + 1.6, 900, 1180, INOUT),
    zoom: tw(t, L6.start, L6.start + 1.6, 1.0, 1.55, INOUT),
  };
  const q = pagePoint(250, 1215, cam, NEW_H, 1400);
  const hl = tw(t, L6.start + 1.7, L6.start + 2.3);
  return (
    <AbsoluteFill style={{ opacity: 1 - out, alignItems: "center" }}>
      <div style={{ position: "absolute", top: 120, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: part1 }}>
        <Rise text="Lock tokens behind public milestones." t={t} at={L5.start} size={56} align="center" accent={["milestones."]} />
      </div>
      {/* the locked tranche */}
      <div style={{ position: "absolute", top: 270, opacity: tw(t, at(0.2), at(0.3)) * part1, transform: `translateY(${(1 - tw(t, at(0.2), at(0.32))) * 20}px)` }}>
        <Panel style={{ padding: "22px 40px", display: "flex", alignItems: "center", gap: 26 }}>
          <Icon name="lock" size={44} />
          <div style={{ fontFamily: F.mono }}>
            <div style={{ fontSize: 16, letterSpacing: "0.22em", color: C.dim }}>LOCKED IN THE VAULT</div>
            <div style={{ fontSize: 46, fontWeight: 500, marginTop: 4 }}>300,000,000 KEPT</div>
          </div>
          <div style={{ marginLeft: 20, display: "flex", alignItems: "center", gap: 10, fontFamily: F.mono, fontSize: 18, color: C.caution }}><Lamp color={C.caution} size={10} /> 3 MILESTONES</div>
        </Panel>
      </div>
      {/* the four templates, each on its phrase */}
      <div style={{ position: "absolute", top: 520, display: "flex", gap: 0, border: `1px solid ${C.soft}`, opacity: part1 }}>
        {TILES.map((tile) => {
          const p = tw(t, at(tile.frac), at(tile.frac) + 0.7, 0, 1, OUT);
          const on = t > at(tile.frac);
          return (
            <div key={tile.label} style={{ width: 330, padding: "34px 26px", borderRight: `1px solid ${C.soft}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, background: on ? "#101010" : "transparent", opacity: 0.25 + 0.75 * p, transform: `translateY(${(1 - p) * 18}px)`, position: "relative" }}>
              <Icon name={tile.icon} size={56} color={on ? C.ink : C.faint} />
              <div style={{ fontFamily: F.mono, fontSize: 26, fontWeight: 500, color: on ? C.ink : C.faint }}>{tile.label}</div>
              <div style={{ fontFamily: F.mono, fontSize: 18, color: C.dim }}>{tile.eg}</div>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: C.ok, transformOrigin: "0 50%", transform: `scaleX(${p})` }} />
            </div>
          );
        })}
      </div>
      {/* the question, written by the vault */}
      <div style={{ position: "absolute", top: 120, opacity: browserIn, transform: `translateY(${(1 - browserIn) * 40}px) scale(${0.96 + 0.04 * browserIn})` }}>
        <Eyebrow t={t} at={L6.start} lamp={C.ok}>One yes or no question · written by the vault</Eyebrow>
      </div>
      <div style={{ position: "absolute", top: 190, opacity: browserIn, transform: `translateY(${(1 - browserIn) * 40}px)` }}>
        <Browser src="shots/new-full.png" width={1400} pageH={NEW_H} cam={cam} url="keptmd.vercel.app/#/new">
          <div style={{ position: "absolute", left: q.x - 16, top: q.y - 16, width: 1080 * q.s * 0.62, height: 210 * q.s * 0.62 + 20, border: `2px solid ${C.ok}`, opacity: hl, boxShadow: `0 0 40px rgba(62,207,122,${0.35 * hl})` }} />
        </Browser>
      </div>
    </AbsoluteFill>
  );
};
