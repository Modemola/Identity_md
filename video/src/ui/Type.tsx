import { C, F, OUT } from "../theme";
import { tw } from "../time";

/// A headline that rises word by word through a mask, the way the site's headline does.
export const Rise: React.FC<{
  text: string;
  t: number;
  at: number;
  size?: number;
  accent?: string[];
  accentColor?: string;
  stagger?: number;
  out?: number;
  align?: "left" | "center";
  color?: string;
  weight?: number;
  lineHeight?: number;
  maxWidth?: number;
}> = ({ text, t, at, size = 84, accent = [], accentColor = C.ok, stagger = 0.06, out, align = "left", color = C.ink, weight = 500, lineHeight = 1.06, maxWidth }) => {
  const words = text.split(" ");
  const gone = out === undefined ? 0 : tw(t, out, out + 0.5, 0, 1);
  return (
    <div style={{ fontFamily: F.mono, fontWeight: weight, fontSize: size, lineHeight, letterSpacing: "-0.035em", color, textAlign: align, maxWidth, opacity: 1 - gone, transform: `translateY(${-gone * 20}px)` }}>
      {words.map((w, i) => {
        const p = tw(t, at + i * stagger, at + i * stagger + 0.9, 0, 1, OUT);
        const hit = accent.includes(w.replace(/[.,:]/g, ""));
        return (
          <span key={i}>
            <span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.1em", marginBottom: "-0.1em" }}>
              <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 108}%) rotate(${(1 - p) * 4}deg)`, opacity: p, color: hit ? accentColor : undefined }}>{w}</span>
            </span>
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </div>
  );
};

/// The site's small tracked label, with an optional lamp.
export const Eyebrow: React.FC<{ children: React.ReactNode; t: number; at: number; color?: string; lamp?: string; size?: number }> = ({ children, t, at, color = C.dim, lamp, size = 17 }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 12, fontFamily: F.mono, fontSize: size, letterSpacing: "0.22em", textTransform: "uppercase", color, opacity: tw(t, at, at + 0.6), transform: `translateY(${(1 - tw(t, at, at + 0.8)) * 10}px)` }}>
    {lamp ? <span style={{ width: 10, height: 10, borderRadius: 5, background: lamp, boxShadow: `0 0 12px ${lamp}` }} /> : null}
    {children}
  </div>
);

/// A number that counts to its value, in tabular mono.
export const Count: React.FC<{ value: number; t: number; at: number; dur?: number; from?: number; suffix?: string; style?: React.CSSProperties }> = ({ value, t, at, dur = 1.2, from = 0, suffix = "", style }) => {
  const v = from + (value - from) * tw(t, at, at + dur);
  return <span style={{ fontFamily: F.mono, fontVariantNumeric: "tabular-nums", ...style }}>{Math.round(v).toLocaleString("en-US")}{suffix}</span>;
};

/// IMD's bordered panel with the four corner ticks.
export const Panel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; tick?: string }> = ({ children, style, tick = "rgba(255,255,255,0.55)" }) => (
  <div style={{ position: "relative", border: `1.5px solid ${C.ink}`, background: "rgba(10,10,10,0.88)", ...style }}>
    {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([r, b], i) => (
      <span key={i} style={{ position: "absolute", width: 14, height: 14, borderColor: tick, borderStyle: "solid", borderWidth: `${b ? 0 : 2}px ${r ? 2 : 0}px ${b ? 2 : 0}px ${r ? 0 : 2}px`, left: r ? undefined : -6, right: r ? -6 : undefined, top: b ? undefined : -6, bottom: b ? -6 : undefined }} />
    ))}
    {children}
  </div>
);
