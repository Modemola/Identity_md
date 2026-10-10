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

The look follows IMD's own interface: paper and ink, IBM Plex Mono (bundled, no font CDN),
1.5px rules, square corners, numbered section headers, a status bar with lamps, and a light
and dark theme. The hero is a "verdict unit", an instrument panel with seven-segment
readouts, one lamp per milestone, a scope trace and a terminal feed of swarm verdicts.

Motion is kept cheap so the site stays smooth on low-end phones:

- Only `transform` and `opacity` animate, so the compositor does the work. Nothing animates
  layout.
- The hero is SVG and CSS, not WebGL, so it cannot fail on a blocked GPU and adds nothing to
  load.
- The headline entrance is CSS only and never waits for chain data. Content is visible
  without JavaScript, because hidden states only exist under `html.js`.
- Scroll reveals use one shared `IntersectionObserver`. Timers (the verdict feed, the status
  bar) pause off screen and in background tabs.
- Pointer effects (magnetic buttons, row spotlight) apply only to fine pointers.
  `prefers-reduced-motion` gets the final state immediately.
- Markup is built with `h()`/`s()` in `src/dom.js`, never raw HTML strings.

Measured on the local demo with Playwright and Chromium:

- Desktop: first contentful paint 148ms, 60fps while idle and while scrolling, no long tasks.
- With the CPU throttled 4x (a low-end phone): first contentful paint 308ms, 60fps while idle
  and while scrolling, worst frame 17ms, no long tasks after load.
