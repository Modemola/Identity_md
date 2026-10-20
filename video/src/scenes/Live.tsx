import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, F, INOUT, OUT } from "../theme";
import { line, scene, tw, useSeconds } from "../time";
import { Browser, Lamp, pagePoint } from "../ui/Marks";
import { Eyebrow, Panel } from "../ui/Type";

const PAGE_H = 1912;
type Cam = { x: number; y: number; zoom: number };

/// Piecewise camera: hold each key, ease between them.
function camAt(t: number, keys: [number, Cam][]): Cam {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, c1] = keys[i];
    const [t0, c0] = keys[i - 1];
    if (t <= t1) {
      const k = tw(t, t0, t1, 0, 1, INOUT);
      return { x: c0.x + (c1.x - c0.x) * k, y: c0.y + (c1.y - c0.y) * k, zoom: c0.zoom + (c1.zoom - c0.zoom) * k };
    }
  }
  return keys[keys.length - 1][1];
}

const Callout: React.FC<{ t: number; at: number; until: number; x: number; y: number; big: string; small: string; color?: string }> = ({ t, at, until, x, y, big, small, color = C.ok }) => {
  const o = Math.min(tw(t, at, at + 0.4), 1 - tw(t, until - 0.3, until));
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: o, transform: `translateY(${(1 - tw(t, at, at + 0.6, 0, 1, OUT)) * 14}px)` }}>
      <Panel style={{ padding: "14px 22px", borderColor: color, background: "rgba(0,0,0,0.92)" }} tick={color}>
        <div style={{ fontFamily: F.mono, fontSize: 44, fontWeight: 500, color, lineHeight: 1 }}>{big}</div>
        <div style={{ fontFamily: F.mono, fontSize: 17, letterSpacing: "0.16em", color: C.dim, marginTop: 8 }}>{small}</div>
      </Panel>
    </div>
  );
};

/// It is live: the swarm scope, then KEPT's own pledge with both real verdicts.
export const Live: React.FC = () => {
  const t = useSeconds();
  const s = scene("live");
  const L11 = line("L11");
  const L12 = line("L12");
  const out = tw(t, s.end - 0.6, s.end);
  const frac = (f: number) => L12.start + f * (L12.end - L12.start);
  const toPledge = L11.start + 2.6;
  const homeOn = 1 - tw(t, toPledge - 0.3, toPledge + 0.4);
  const v1 = frac(0.27), v2 = frac(0.55), rel = frac(0.73);
  const cam = camAt(t, [
    [toPledge, { x: 720, y: 405, zoom: 1.0 }],
    [L11.end, { x: 640, y: 330, zoom: 1.12 }],
    [v1, { x: 720, y: 820, zoom: 1.24 }],
    [v1 + 2.0, { x: 720, y: 840, zoom: 1.24 }],
    [v2, { x: 720, y: 1125, zoom: 1.24 }],
    [v2 + 1.4, { x: 720, y: 1140, zoom: 1.24 }],
    [rel, { x: 600, y: 345, zoom: 1.32 }],
  ]);
  const W = 1500;
  const enter = tw(t, s.start, s.start + 0.8, 0, 1, OUT);
  return (
    <AbsoluteFill style={{ opacity: 1 - out, alignItems: "center" }}>
      <div style={{ marginTop: 74 }}>
        <Eyebrow t={t} at={s.start + 0.1} lamp={C.ok}>Live on Robinhood Chain · KEPT's own pledge</Eyebrow>
      </div>
      <div style={{ position: "absolute", top: 140, opacity: enter, transform: `translateY(${(1 - enter) * 40}px)` }}>
        <div style={{ position: "relative" }}>
          <Browser src="shots/pledge-full.png" width={W} pageH={PAGE_H} cam={cam} url="keptmd.vercel.app/#/pledge/1">
          </Browser>
          <div style={{ position: "absolute", left: 0, top: 0, width: W, opacity: homeOn }}>
            <Browser src="shots/home.png" width={W} pageH={810} cam={{ x: 720, y: 405, zoom: 1 }} url="keptmd.vercel.app" />
          </div>
          <Callout t={t} at={L11.start + 3.4} until={L11.end + 0.6} x={980} y={560} big="300,000,000 KEPT" small="LOCKED BEHIND 3 MILESTONES" color={C.ink} />
          <Callout t={t} at={v1 + 0.4} until={v2 - 0.2} x={1040} y={150} big="8 / 9 agreed" small="MILESTONE 1 · WEBSITE IS LIVE" />
          <Callout t={t} at={v2 + 0.4} until={rel - 0.2} x={1040} y={150} big="7 / 9 agreed" small="MILESTONE 2 · v1.0.0 RELEASED" />
          <Callout t={t} at={rel + 0.5} until={s.end} x={880} y={520} big="150,000,000 KEPT" small="RELEASED TO THE TEAM BY THE SWARM" />
        </div>
      </div>
    </AbsoluteFill>
  );
};
