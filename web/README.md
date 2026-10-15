# KEPT website

Static site for KEPT. It reads the vault directly from Robinhood Chain and talks to the
user's wallet; there is no backend. The production build is committed at `../dist/` and is
what gets pinned to IPFS.

```sh
npm install
npm run build      # writes ../dist
npm run dev        # local development
```

Addresses live in `src/config.js` and are filled in once the IMD launches deploy. Any of them
can be overridden from the URL for review or local testing:

```
?vault=0x…&hook=0x…&token=0x…&rpc=http://127.0.0.1:8545&chain=31337
```

`../script/LocalDemo.s.sol` seeds a local anvil chain with pledges in every state
(kept, broken, checking, open) for exactly that.

## Design and performance

The look follows IMD's own interface: paper and ink, IBM Plex Mono (bundled and preloaded, no
font CDN), 1.5px rules, square corners, numbered section headers, a status bar with lamps, and a
light and dark theme.

What a visitor sees:

- **The Swarm Scope.** The hero is an instrument panel around a real-time 3D view of the IMD swarm:
  about 2,000 agents on a sphere around the promise at its centre. Every line the verdict feed
  prints plays out in 3D. A check links a panel of nine agents to the core, a kept verdict sends a
  green wave across the sphere, and a broken one throws off red embers. The pointer steers it.
- **Page transitions.** Navigation runs through the View Transitions API: pages lift out and rise
  in, the header and status bar stay put, and a pledge's title flies from its row into the page
  heading and back. The theme switch reveals the new theme as a circle growing from the toggle.
- **A pledge on a timeline.** Milestones appear as nodes on a time axis, with their proof windows
  hatched and a live NOW marker. Clicking a node jumps to the milestone.
- **Transactions as steps.** Every onchain action opens a sheet listing its steps (allowances,
  wallet signature, block confirmation), each with its own state and transaction link. Steps
  that aren't needed are marked as skipped.
- **A live draft.** Making a pledge shows a sticky preview card with the timeline, totals and
  budget, plus the exact question the swarm will be asked, read from the vault itself.
- **⌘K / Ctrl+K / "/"** jumps to any page or pledge.

What keeps it fast:

- **Instant navigation.** Reads go through a stale-while-revalidate cache (`src/store.js`): memory
  first, then sessionStorage, so even a reload paints at once. The fresh read updates the page in
  place only if something changed. Pledges prefetch on hover, focus and touch. Opening a pledge
  from the list puts its heading on screen in about 80 ms.
- **A small bundle.** viem is used as single actions rather than full public and wallet clients,
  which keeps out about 100 KB of signature, curve and ENS code. ABIs ship without
  `internalType`. The 3D scene is its own 4.5 KB chunk, fetched after first paint when the
  browser is idle. The main script is 68 KB gzipped.
- **A careful 3D scene.**
  - Raw WebGL2: no 3D library, all motion in shaders.
  - Shaders compile asynchronously where supported (`KHR_parallel_shader_compile`).
  - It renders only on screen and in a visible tab.
  - A frame-time watchdog first halves the agents and resolution, then caps the swarm at 20 fps,
    then holds it still, so a weak device keeps a smooth page.
  - Software-only GL, a lost context or missing WebGL all fall back to a still 2D frame.
  - Reduced motion gets one still frame.
- **Compositor-only motion.** Only `transform` and `opacity` animate, plus `clip-path` inside the
  theme transition. Looping lamps and rings sit on their own layers, so a blink never repaints its
  surroundings. Nothing animates layout.
- **No replays.** A background refresh never replays entrances, and timers stop when a page is
  left. Pointer effects apply only to fine pointers.

Measured on the local demo with Playwright and Chromium, with the 3D swarm running:

- Desktop: first contentful paint 144 ms, 60 fps idle and scrolling, worst frame 17 ms, no long
  tasks after load.
- With the CPU throttled 4x (a low-end phone): first contentful paint 296 ms, 60 fps idle and
  scrolling, worst frame 17 ms, no long tasks after load.
