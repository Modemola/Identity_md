import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import timeline from "./timeline.json";
import { OUT } from "./theme";

export type Line = { id: string; scene: string; start: number; end: number; caption: string };
export const TL = timeline as { fps: number; duration: number; frames: number; scenes: { id: string; start: number; end: number }[]; lines: Line[] };

export const scene = (id: string) => TL.scenes.find((s) => s.id === id)!;
export const line = (id: string) => TL.lines.find((l) => l.id === id)!;

/// Seconds since the start of the film.
export function useSeconds() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
}

/// Tween from a to b over [t0, t1] with an easing; clamped.
export function tw(t: number, t0: number, t1: number, a = 0, b = 1, easing = OUT) {
  return interpolate(t, [t0, t1], [a, b], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}

/// 0 to 1 in, hold, 1 to 0 out.
export function win(t: number, t0: number, t1: number, fadeIn = 0.5, fadeOut = 0.5) {
  return Math.min(tw(t, t0, t0 + fadeIn), 1 - tw(t, t1 - fadeOut, t1, 0, 1));
}
