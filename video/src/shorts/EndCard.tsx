import React from "react";
import { AbsoluteFill } from "remotion";
import { C, F } from "../theme";
import { Seal } from "../ui/Marks";
import { pop } from "../explainer/kit";

/// The closing card every short shares: seal, wordmark, tagline, link, handle.
export const EndCard: React.FC<{ t: number; at: number; opacity: number }> = ({ t, at, opacity }) => (
  <AbsoluteFill style={{ alignItems: "center", paddingTop: 150, opacity }}>
    <div style={{ transform: `scale(${pop(t, at, 0.6)})` }}>
      <Seal t={t} at={at} size={200} spin={(t - at) * 6} />
    </div>
    <div style={{ marginTop: 26, fontFamily: F.mono, fontWeight: 600, fontSize: 120, letterSpacing: "0.28em", marginRight: "-0.28em", color: C.ink }}>KEPT</div>
    <div style={{ fontFamily: F.mono, fontSize: 38, color: C.ink2, opacity: pop(t, at + 0.5, 0.5) }}>
      Promises the <span style={{ color: C.ok }}>swarm</span> enforces.
    </div>
    <div style={{ marginTop: 44, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, fontFamily: F.mono, fontSize: 30, opacity: pop(t, at + 0.9, 0.5) }}>
      <span style={{ color: "#0b0d0c", background: C.ok, padding: "8px 24px", borderRadius: 999, fontWeight: 600 }}>keptmd.vercel.app</span>
      <span style={{ color: C.ink }}>@keptonchainn</span>
      <span style={{ fontSize: 20, letterSpacing: "0.3em", color: C.dim }}>BUILT ON IMD · ROBINHOOD CHAIN</span>
    </div>
  </AbsoluteFill>
);
