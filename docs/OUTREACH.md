# Outreach drafts

## 1. Funding the launch (1.5 IMD + a little ETH on Ethereum)

**Option A: fund it yourself.** About 1.6 IMD (a little extra for price movement) plus roughly
$5–10 of ETH for gas on Ethereum mainnet. At the last known price (~$9.70 per IMD, Bankless
snapshot on 25 Sep) that is about $15 of IMD; check the live price first. Buy IMD on Uniswap
using the token address `0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7` (verify it on
https://imd.fun before swapping; copycat tokens exist). Use a fresh wallet that holds only this.

**Option B: ask @damian_et.** He offered to fund up to 30 launches for people with a unique
Uniswap v4 hook idea who lack the IMD to open a job, for projects with a new verified X account.
Ask him to **send the IMD to your wallet** rather than pay the order himself. Whoever pays an order
becomes its payer (the 1% trading-fee share and the default token remainder go to the paying
wallet), and you want all of that, plus vault ownership, in your own wallet.

DM draft:

```
Hi Damian, saw your offer to fund launches for unique v4 hook ideas.

I'm building KEPT for the IMD hackathon: teams lock tokens behind public milestones, the IMD
oracle checks each one at its deadline, kept tranches unlock and broken ones burn. Every check
is a paid oracle job for the swarm, and our KEPT/IMD v4 hook funds a Referee Fund that refunds
checks for teams that keep their word. It's open to every IMD launch: a trust layer for the
launchpad.

It's fully built and tested: 83 Foundry tests, the IMD oracle conformance vector, a real
production signature verified, and a fork rehearsal on Robinhood's live Intake and PoolManager.
Free launch checks pass with no blockers. Repo: github.com/modemola/identity_md

What I'm missing is 1.5 IMD (vault + token/hook + site, 0.5 each) and a little ETH for the
Permit2 approval. Could you send it to <your wallet>? Our own team tokens get locked in KEPT
behind our roadmap, with the first verdicts landing before judging.
```

## 2. The project X account

Handle ideas, in order of preference (check availability when you sign up):
`@keptonchain`, `@kept_imd`, `@keptswarm`, `@keptprotocol`.

- **Name:** KEPT
- **Bio:** `Promises the IMD swarm enforces. Lock tokens behind milestones: kept unlocks, broken burns. Built on @identitymd · Robinhood Chain`
- **Avatar:** green rounded square with a dark check mark (the site favicon, `web/index.html`).
- **Pinned post:** the launch thread in `docs/SUBMISSION.md` §3, once the vault is live.
- If you take the sponsorship route, Damian asked for a **verified** account; check what that
  requires before you post the DM.

## 3. Payout question for @imdradar

```
Hi! Question before I submit to the IMD hackathon.

Radar pays prizes to the deployer of the contract in the entry. My project launches through the
IMD launchpad, so the IMD factory deploys the contracts, not my wallet. How should a
factory-deployed entry name its payout wallet? Should I leave the contract field empty and give
my wallet some other way, or is there a field or message you'd like me to use?

Thanks for running Radar.
```
