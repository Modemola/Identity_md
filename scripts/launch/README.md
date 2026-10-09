# Opening the KEPT launches

`launch.mjs` opens the two KEPT launches through the IMD paid API from your own wallet. It runs
the documented flow end to end: import this repository at a pinned commit, the free
`POST /requests/check` (prints the swarm's plan and stops on any blocker), a quote, the x402
Permit2 payment and IMD's EIP-712 quote approval, then follows the order until it is admitted.

## What you need

- Node.js 22+.
- A wallet on Ethereum mainnet with **1.5 IMD** (0.5 each for the vault, the token and the site)
  and a little ETH for the one-time Permit2 approval of IMD. Use a fresh wallet that holds only this.
- Your own address for `--owner` / `--remainder` (it can be the same wallet).

## Run

```sh
cd scripts/launch
npm install

# Rehearse first: import, check, quote and payment challenge, nothing signed or paid.
node launch.mjs vault --owner 0xYOU --dry-run

# 1. The product: KeptVault, no token. You become its owner.
node launch.mjs vault --owner 0xYOU

# 2. After the vault is deployed: KEPT token + hook, paired with IMD.
#    pool-bps of the supply seeds the pool; the rest of your 90% goes to --remainder,
#    and you lock it in a KEPT pledge on the website.
node launch.mjs token --vault 0xVAULT --remainder 0xYOU --pool-bps 6000 --dry-run
node launch.mjs token --vault 0xVAULT --remainder 0xYOU --pool-bps 6000

# 3. After both deploy: put the addresses in web/src/config.js, rebuild (npm run build in web/),
#    commit and push, then host the committed dist/ on IPFS under an IMD site name.
node launch.mjs site --name kept --dry-run
node launch.mjs site --name kept

# Re-attach to an order later:
node launch.mjs status vault
```

The key comes from `KEPT_PRIVATE_KEY` or is typed in hidden; it is never written to disk. You
must type `yes` before anything is signed. Order tokens are kept in `.orders/` (git-ignored) so
you can follow an order again.

Pass `--commit <sha>` to pin a specific commit (otherwise the head of the KEPT branch is used),
and `--eth-rpc <url>` to use your own Ethereum RPC.

## Verified on 2026-10-09

- The site job dry-runs cleanly too: IMD imports the committed `dist/` as a ready static export
  (no build) and the plan is a content check, then IPFS pinning under the site name.
- `workflow.open` (contracts and site in one payment) is refused for API callers today
  (`evaluation_unavailable`, including IMD's own documented example), so the site is its own job.
- Both launches dry-run cleanly against `api.imd.fun`: import accepted, check with no blockers,
  quote at 0.5 IMD, Permit2 challenge on Ethereum.
- A throwaway wallet with no IMD submitted a signed payment for a real quote; IMD rejected it only
  with `permit2_insufficient_balance`, which means the payment payload, the Permit2 signature and
  the quote approval all validate.
- `@x402/core` 2.28.0 (the version IMD pins) refuses non-default assets unless allowed, so the
  script allows exactly IMD on Ethereum, capped at the quoted price.
