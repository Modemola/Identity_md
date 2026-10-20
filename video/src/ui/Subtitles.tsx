import { C, F } from "../theme";
import { TL, tw, useSeconds } from "../time";

/// Captions for a muted feed: each line split into short phrases, timed by their length.
type Seg = { text: string; start: number; end: number };

function segments(): Seg[] {
  const out: Seg[] = [];
  for (const l of TL.lines) {
    const parts: string[] = [];
    const sentences = l.caption.match(/[^.!?]+[.!?]?/g) ?? [l.caption];
    for (const s of sentences) {
      let cur = "";
      for (const w of s.trim().split(" ")) {
        if ((cur + " " + w).trim().length > 52 && cur) {
          parts.push(cur.trim());
          cur = w;
        } else cur = `${cur} ${w}`;
      }
      if (cur.trim()) parts.push(cur.trim());
    }
    const total = parts.reduce((a, p) => a + p.length, 0);
    let t = l.start;
    for (const p of parts) {
      const d = (p.length / total) * (l.end - l.start);
      out.push({ text: p, start: t, end: t + d });
      t += d;
    }
  }
  return out;
}
const SEGS = segments();

export const Subtitles: React.FC = () => {
  const t = useSeconds();
  const seg = SEGS.find((s) => t >= s.start - 0.05 && t < s.end + 0.25);
  if (!seg) return null;
  const o = Math.min(tw(t, seg.start - 0.05, seg.start + 0.15), 1 - tw(t, seg.end + 0.05, seg.end + 0.25));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 48, display: "flex", justifyContent: "center", opacity: o }}>
      <div style={{ fontFamily: F.mono, fontSize: 27, fontWeight: 400, color: C.ink, padding: "9px 20px", background: "rgba(0,0,0,0.72)", border: `1px solid ${C.hair}`, letterSpacing: "0.01em" }}>
        {seg.text}
      </div>
    </div>
  );
};
