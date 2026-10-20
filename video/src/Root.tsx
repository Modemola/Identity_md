import "./fonts";
import { AbsoluteFill, Composition } from "remotion";
import { End } from "./scenes/End";
import { Fund } from "./scenes/Fund";
import { Live } from "./scenes/Live";
import { Lock } from "./scenes/Lock";
import { Open } from "./scenes/Open";
import { Problem } from "./scenes/Problem";
import { Proof } from "./scenes/Proof";
import { SwarmScene } from "./scenes/SwarmScene";
import { Verdict } from "./scenes/Verdict";
import { Explainer } from "./explainer/Explainer";
import ET from "./explainer/timeline.json";
import { C } from "./theme";
import { TL, useSeconds } from "./time";
import { Backdrop, Finish } from "./ui/Backdrop";
import { Subtitles } from "./ui/Subtitles";

const SCENES: Record<string, React.FC> = { open: Open, problem: Problem, lock: Lock, swarm: SwarmScene, verdict: Verdict, live: Live, fund: Fund, proof: Proof, end: End };

/// Scenes overlap by a beat so every cut is a dissolve, never a jump.
const Film: React.FC<{ clean?: boolean }> = ({ clean }) => {
  const t = useSeconds();
  return (
    <AbsoluteFill style={{ background: "#000", color: C.ink }}>
      <Backdrop />
      {TL.scenes.map((s) => {
        if (t < s.start - 0.05 || t > s.end + 0.6) return null;
        const S = SCENES[s.id];
        const fadeOut = s.id === "end" ? 1 : Math.max(0, Math.min(1, (s.end + 0.6 - t) / 0.6));
        const fadeIn = s.id === "open" ? 1 : Math.max(0, Math.min(1, (t - s.start + 0.05) / 0.5));
        return (
          <AbsoluteFill key={s.id} style={{ opacity: Math.min(fadeIn, fadeOut) }}>
            <S />
          </AbsoluteFill>
        );
      })}
      {clean ? null : <Subtitles />}
      <Finish />
    </AbsoluteFill>
  );
};

export const Root: React.FC = () => (
  <>
    <Composition id="Film" component={Film} defaultProps={{ clean: false }} durationInFrames={TL.frames} fps={TL.fps} width={1920} height={1080} />
    <Composition id="Explainer" component={Explainer} defaultProps={{ clean: false }} durationInFrames={ET.frames} fps={ET.fps} width={1920} height={1080} />
  </>
);
