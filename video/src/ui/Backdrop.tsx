import { AbsoluteFill } from "remotion";
import { C } from "../theme";
import { useSeconds } from "../time";

/// Black, a slow drifting pool of verdict green, and the site's dot grid: the room every scene
/// sits in.
export const Backdrop: React.FC = () => {
  const t = useSeconds();
  const x = 50 + Math.sin(t * 0.07) * 18;
  const y = 40 + Math.cos(t * 0.05) * 10;
  return (
    <AbsoluteFill style={{ background: C.void }}>
      <AbsoluteFill style={{ background: `radial-gradient(1100px 700px at ${x}% ${y}%, rgba(62,207,122,0.06), transparent 70%)` }} />
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1.3px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, #000 10%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, #000 10%, transparent 75%)",
          opacity: 0.55,
        }}
      />
    </AbsoluteFill>
  );
};

/// Vignette and CRT scanlines over everything, the swarm scope's screen.
export const Finish: React.FC = () => (
  <>
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 80% at 50% 50%, transparent 55%, rgba(0,0,0,0.6) 100%)" }} />
    <AbsoluteFill style={{ background: "repeating-linear-gradient(180deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 3px)" }} />
  </>
);
