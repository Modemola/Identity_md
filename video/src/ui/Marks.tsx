import { Img, staticFile } from "remotion";
import { C, F, OUT, SPRING } from "../theme";
import { tw } from "../time";

// The ring of agents around the seal, in the same layout as the brand mark (docs/brand).
const RING = (() => {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out: { a: number; r: number; size: number; op: number }[] = [];
  const n = 56;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.08;
    const m = a % (Math.PI * 2);
    if ((m > 0.18 && m < 0.42) || (a > 3.3 && a < 3.5)) continue;
    out.push({ a, r: 206 + (rnd() - 0.5) * 14, size: [3.2, 4, 4.8, 6][Math.floor(rnd() * 4)], op: 0.45 + rnd() * 0.55 });
  }
  return out;
})();

/// The KEPT seal, drawn: the square traces itself, the check strikes, the swarm gathers round.
export const Seal: React.FC<{ t: number; at: number; size?: number; ink?: string; spin?: number }> = ({ t, at, size = 260, ink = C.ink, spin = 0 }) => {
  const sq = tw(t, at, at + 0.9, 0, 1, OUT);
  const ck = tw(t, at + 0.55, at + 1.05, 0, 1, OUT);
  const per = 4 * 236;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" style={{ overflow: "visible" }}>
      <g transform={`rotate(${spin} 256 256)`}>
        {RING.map((d, i) => {
          const p = tw(t, at + 0.7 + i * 0.012, at + 1.4 + i * 0.012);
          const r = d.r + (1 - p) * 60;
          return <circle key={i} cx={256 + Math.cos(d.a) * r} cy={256 + Math.sin(d.a) * r} r={d.size / 2} fill={ink} opacity={d.op * p} />;
        })}
      </g>
      <rect x={138} y={138} width={236} height={236} fill="none" stroke={ink} strokeWidth={22} strokeDasharray={per} strokeDashoffset={per * (1 - sq)} />
      <path d="M194 262 L238 306 L322 210" fill="none" stroke={C.ok} strokeWidth={28} strokeLinecap="square" strokeDasharray={260} strokeDashoffset={260 * (1 - ck)} style={{ filter: `drop-shadow(0 0 ${18 * ck}px rgba(62,207,122,0.6))` }} />
    </svg>
  );
};

/// The ink stamp that lands on a settled milestone, as on the pledge page.
export const Stamp: React.FC<{ t: number; at: number; kind: "kept" | "broken"; size?: number }> = ({ t, at, kind, size = 64 }) => {
  const p = tw(t, at, at + 0.45, 0, 1, SPRING);
  const o = tw(t, at, at + 0.12);
  const color = kind === "kept" ? C.ok : C.alarm;
  return (
    <div style={{ display: "inline-block", border: `${size / 9}px solid ${color}`, padding: `${size * 0.12}px ${size * 0.35}px`, fontFamily: F.mono, fontWeight: 600, fontSize: size, letterSpacing: "0.18em", color, transform: `rotate(${-14 + p * 6}deg) scale(${2.2 - p * 1.2})`, opacity: o, textShadow: `0 0 30px ${color}55`, boxShadow: `0 0 50px ${color}22 inset` }}>
      {kind === "kept" ? "KEPT ✓" : "BROKEN ✕"}
    </div>
  );
};

/// A status lamp.
export const Lamp: React.FC<{ color: string; size?: number; glow?: boolean }> = ({ color, size = 12, glow = true }) => (
  <span style={{ display: "inline-block", width: size, height: size, borderRadius: size / 2, background: color, boxShadow: glow ? `0 0 ${size}px ${color}` : undefined, flex: "none" }} />
);

/// A browser window around real product footage. `cam` is where the camera looks, in the page's
/// own CSS pixels (stills are a 1440 wide viewport at 2x), and how far in.
export const Browser: React.FC<{
  src: string;
  width?: number;
  cam?: { x: number; y: number; zoom: number };
  pageH: number;
  url?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ src, width = 1500, cam = { x: 720, y: 405, zoom: 1 }, pageH, url = "keptmd.vercel.app", style, children }) => {
  const pageW = 1440;
  const innerH = (width * 810) / 1440;
  const s = (width / pageW) * cam.zoom;
  let tx = width / 2 - cam.x * s;
  let ty = innerH / 2 - cam.y * s;
  tx = Math.min(0, Math.max(width - pageW * s, tx));
  ty = Math.min(0, Math.max(innerH - pageH * s, ty));
  return (
    <div style={{ width, background: C.coal, border: `1.5px solid ${C.hair2}`, boxShadow: "0 60px 140px -40px rgba(0,0,0,0.95), 0 0 120px -30px rgba(62,207,122,0.16)", ...style }}>
      <div style={{ height: 44, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", background: "#111", borderBottom: `1px solid ${C.hair}` }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ width: 12, height: 12, borderRadius: 6, background: "#333" }} />)}
        <div style={{ marginLeft: 18, flex: 1, maxWidth: 560, height: 26, background: "#070707", border: `1px solid ${C.hair}`, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", fontFamily: F.mono, fontSize: 14, color: C.ink2 }}>
          <span style={{ color: C.ok, fontSize: 11 }}>●</span>
          {url}
        </div>
      </div>
      <div style={{ position: "relative", width, height: innerH, overflow: "hidden" }}>
        <Img src={staticFile(src)} style={{ position: "absolute", left: 0, top: 0, width: pageW * s, height: pageH * s, transform: `translate(${tx}px, ${ty}px)` }} />
        {children}
      </div>
    </div>
  );
};

/// Where a page point lands inside a Browser of `width`, for overlays that track the footage.
export function pagePoint(px: number, py: number, cam: { x: number; y: number; zoom: number }, pageH: number, width = 1500) {
  const innerH = (width * 810) / 1440;
  const s = (width / 1440) * cam.zoom;
  let tx = width / 2 - cam.x * s;
  let ty = innerH / 2 - cam.y * s;
  tx = Math.min(0, Math.max(width - 1440 * s, tx));
  ty = Math.min(0, Math.max(innerH - pageH * s, ty));
  return { x: tx + px * s, y: ty + py * s, s };
}
