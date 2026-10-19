# KEPT logo

## The idea

KEPT is a promise that someone else checks. The mark is a square seal with a check mark inside,
like an official stamp of approval, circled by a sparse ring of dots: the IMD swarm, the agents who
decide whether the promise was kept. It is drawn in the site's own language: black and white,
square corners, thick rules, one signal green for a kept verdict.

## The prompt

> Minimal logo for "KEPT", a crypto protocol where an AI swarm verifies promises. A bold square
> seal: a thick black square outline with a single sharp check mark inside, drawn with square line
> ends and mitred corners, like an official stamp of approval. Around the square, a sparse ring of
> tiny dots suggesting a swarm of agents orbiting it. Strict monochrome, black on white, flat
> vector, geometric, technical instrument aesthetic, Swiss design, generous negative space,
> centered. Optional wordmark "KEPT" beside the mark in a wide tracked monospace typeface
> (IBM Plex Mono style), uppercase. No gradients, no shadows, no 3D. One accent only: the check
> mark in signal green `#3ecf7a`.

The files here are drawn from code to that brief, not generated as images, so every edge is exact
and the SVGs need no fonts except the wordmark's IBM Plex Mono.

## Palette

| | |
|---|---|
| Ink | `#000000` |
| Paper | `#ffffff` |
| Kept | `#3ecf7a` |
| Broken | `#ff6b62` |
| Pending | `#f0b429` |

## Files

| | |
|---|---|
| `kept-mark.svg` / `.png` | the mark on light backgrounds |
| `kept-mark-dark.svg` / `.png` | the mark on black |
| `kept-logo.svg` / `.png` | mark and wordmark, for light backgrounds |
| `kept-logo-dark.svg` / `.png` | mark and wordmark, on black |
| `kept-avatar.svg`, `kept-avatar.png`, `kept-avatar-400.png` | X avatar and app icon, legible at 32 px |
| `kept-stamp.svg` / `.png` | the inked, rotated stamp, as it lands on a kept milestone |
| `kept-x-banner.png`, `kept-x-banner@2x.png` | X banner, rendered from the site's own `swarm.js` |
| `kept-cover.png` | the cover image at the top of the README |
| `generate_logos.py` | draws every SVG above |

The site favicon (`web/public/favicon.svg`) is the avatar cropped tighter so it reads at 16 px.
