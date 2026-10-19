# Deploying KEPT

KEPT is not deployed by this repository. Its contracts were launched through IMD, which audits the
code, adapts it, and deploys it from its own factories on Robinhood Chain. This file covers how that
was done and how the site is hosted.

## The contracts, through IMD

Each launch is one paid IMD request, opened from your own wallet with `scripts/launch/launch.mjs`.
The script imports this repository at a pinned commit, runs IMD's free check (which prints the
swarm's plan and stops on any blocker), shows the price, and asks you to type `yes` before it signs
anything. It then follows the order until IMD admits it. The full guide is in
[scripts/launch/README.md](../scripts/launch/README.md).

| Order | Command | What IMD deploys | Result |
| --- | --- | --- | --- |
| 1 | `node launch.mjs vault --owner <your wallet>` | `KeptVault`, contracts only, owned by your wallet | Launch #2172 |
| 2 | `node launch.mjs token --vault <vault> --remainder <your wallet> --pool-bps 6000` | `KeptToken` and `KeptHook`, with the KEPT/IMD pool | Launch #2185 |
| 3 | `node launch.mjs site --name kept` | The built site on IPFS under an IMD site name | |

Each launch costs 0.5 IMD. Your private key is read from `KEPT_PRIVATE_KEY` or typed in hidden,
and is never written to disk. Run `--dry-run` first: it imports, checks and quotes without signing
or paying. If a run is interrupted, `node launch.mjs status <vault|token|site>` follows the same
order again without paying twice.

What each launch actually deployed, and every change IMD's agents made, is recorded in
[launches/](launches). The checks run against each deployment are in
[VERIFICATION.md](VERIFICATION.md).

## The site

The site is a static build with no backend. `web/` is the source and `dist/` is the committed build.

```bash
cd web
npm install
npm run build      # writes ../dist
```

**Vercel.** The repository root has a `vercel.json` that serves `dist/` as is, with no build step.
Every push to `main` redeploys <https://keptmd.vercel.app>. Hashed assets are cached for a year and
the pages carry basic security headers. In the Vercel project, leave the root directory empty and
the framework preset as Other.

**IPFS.** The same `dist/` uses relative paths, so it works from any gateway or ENS name. Step 3
above pins it through IMD.

**Addresses.** The live contract addresses are in `web/src/config.js`. After a new deployment,
update them there, rebuild, and commit the new `dist/`.
