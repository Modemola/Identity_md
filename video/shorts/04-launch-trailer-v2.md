# 04: KEPT launch trailer, v2

Same story, timing and score as `03-launch-trailer.md`, rebuilt to answer one note: it looked
static, monochrome and weak. What changed:

- **The camera never stops.** Every scene sits in a different place in 3D space, and the camera
  flies a continuous path through them: over a grid floor, down a light tunnel, orbiting the vote,
  tracking the gold stream, through each number. Whips between scenes ease in and out on the beat.
- **Environments that change.** A glowing grid floor that pulses on the kick, a ring tunnel, light
  rays behind the seal and the logo, coloured nebula clouds, warp streaks whose length follows the
  camera's speed, beams from the swarm and from every voting agent, embers on the burn.
- **Colour per scene.** Violet and magenta for the promise, crimson for broken, cyan for the
  tunnel, emerald for the reveal, teal for the pledge, amber for the milestones, electric green,
  cyan and magenta for the drop, gold for the payout, red for the burn, a different hue for each
  number, violet to green for the line. Grey particles take the scene's palette; green, red and
  gold keep their meaning.
- **Cards in 3D.** The glass cards live in the same 3D space as the particles (a CSS 3D layer driven
  by the WebGL camera), so the camera orbits and flies past them. Gradient edges, a moving sheen.
- **Layers at once.** A live overlay on the frame edges: scene label, REC timecode, a scrolling hex
  column, a ticker with the real contract addresses, a radar whose nine dots light with the votes.
  Light leaks drift in the corners; every hit flashes, punches the frame and kicks the camera.

Files: `src/trailer2/` (world.ts: stages, camera path, palettes; swarm.ts: shapes; Field.tsx: the
WebGL world; Trailer2.tsx: cards, titles, overlay). Score: `audio/trailer_mix.py`.
