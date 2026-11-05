import { Easing } from "remotion";

/// The site's palette and type, so the film and the product are one object: paper and ink,
/// IBM Plex Mono, and colour only for verdicts.
export const C = {
  void: "#000000",
  coal: "#0a0a0a",
  bezel: "#121212",
  panel: "#0d0d0d",
  ink: "#ffffff",
  ink2: "#cfcfcf",
  dim: "#9a9a9a",
  faint: "#5c5c5c",
  soft: "#262626",
  ok: "#3ecf7a",
  okDeep: "#1f9d55",
  alarm: "#ff6b62",
  caution: "#f0b429",
  hair: "rgba(255,255,255,0.10)",
  hair2: "rgba(255,255,255,0.20)",
};

export const F = { mono: "'IBM Plex Mono', ui-monospace, monospace", sans: "'IBM Plex Sans', system-ui, sans-serif" };

/// One easing family for the whole film, the same curves the site uses.
export const OUT = Easing.bezier(0.22, 1, 0.36, 1);
export const INOUT = Easing.bezier(0.65, 0, 0.35, 1);
export const IN = Easing.bezier(0.7, 0, 0.84, 0);
export const SPRING = Easing.bezier(0.34, 1.56, 0.64, 1);
