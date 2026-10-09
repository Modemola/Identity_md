# KEPT — hackathon submission kit

Everything to paste, in order. Fill the `0x…` placeholders after the launches deploy.

## 1. IMD Radar entry (imdradar.site/hackathon)

- **Project Twitter account:** `@…` (the new KEPT account)
- **Contract address:** the `KeptVault` address on Robinhood Chain (read the payout note in §5 first)
- **About your project** (paste as is):

```
KEPT: promises the IMD swarm enforces.

Every launch hands its team most of the supply, and buyers can only hope the team ships. KEPT turns the roadmap into a contract: a team locks tokens behind public milestones, and at each deadline the IMD oracle checks the milestone and signs a verdict onchain. Kept: the tranche unlocks to the team. Not proven within 3 days: it burns.

Built for IMD, on Robinhood Chain:
- KeptVault buys every check from the IMD Intake (0.5 IMD to the swarm per check) and verifies the signed EIP-712 verdict itself
- 4 milestone templates so every question is precise: GitHub release, page text, contract deployed, onchain value
- KEPT/IMD Uniswap v4 hook funds a Referee Fund that refunds checks for teams that keep their word
- open to every IMD launch: a trust layer for the launchpad

Our own team tokens are locked in KEPT behind our roadmap. Source, tests, Robinhood fork proof: github.com/modemola/identity_md
```

## 2. X profile

- **Name:** KEPT
- **Handle ideas:** `@keptonchain`, `@kept_imd`, `@keptswarm`
- **Bio:** `Promises the IMD swarm enforces. Lock tokens behind milestones: kept unlocks, broken burns. Built on @identitymd · Robinhood Chain`
- **Link:** the IPFS / eth.limo site

## 3. Launch thread

1. Every token launch hands the team most of the supply. Buyers just have to hope they build what they promised.
   KEPT makes the promise a contract, and the IMD swarm the referee. 🧵
2. A team locks tokens behind public milestones: "v1 released on GitHub by Oct 17", "contract deployed on Base", "10M burned".
   At each deadline, the IMD oracle checks the milestone and signs a verdict onchain.
3. Kept → the tranche unlocks to the team.
   Not proven within 3 days → it burns.
   Unproven means broken. No admin can move the tokens.
4. Every check is a paid IMD oracle job: 0.5 IMD to the agents who answer it. Every KEPT pledge is recurring work for the swarm.
5. Our KEPT/IMD pool has a Uniswap v4 hook that feeds a Referee Fund. Keep your promise and your check is refunded. Break it and you paid for your own verdict.
6. We locked our own team tokens in KEPT, behind our own roadmap. Watch the swarm judge us: <site link>
7. Open to every IMD launch. Built for the Identity MD Hackathon. Source, tests and a Robinhood fork rehearsal: github.com/modemola/identity_md

## 4. Our own pledge (create right after the token launch)

Lock the `remainderTo` share (with `--pool-bps 6000`: 300,000,000 KEPT, 30% of supply) in one
pledge named **"KEPT team roadmap"**, beneficiary = team wallet, budget 4 IMD (one retry per
milestone). The first three come due inside the hackathon window so verdicts land before judging.

| # | Promise | Template | Parameters | Deadline (UTC) | Amount |
| --- | --- | --- | --- | --- | --- |
| 1 | KEPT site live on IPFS | Page contains | site URL · `Promises the swarm enforces` | Oct 15, 12:00 | 30,000,000 |
| 2 | Ship KEPT v1.0.0 | GitHub release | `modemola/identity_md` · `v1.0.0` | Oct 17, 12:00 | 30,000,000 |
| 3 | A second pledge is live on KEPT | Value at least | Robinhood · vault · `pledgeCount()` ≥ 2 | Oct 19, 12:00 | 40,000,000 |
| 4 | KEPT vault on Ethereum mainnet | Contract deployed | chain 1 · the future address | Dec 15, 12:00 | 100,000,000 |
| 5 | Referee Fund reaches 100 IMD | Value at least | Robinhood · vault · `refereeFund()` ≥ 100e18 | Jan 31, 12:00 | 100,000,000 |

Milestone 4 needs the Ethereum address before the pledge is created (a CREATE2 address can be
known in advance); if that is not ready, replace it with another template. Ask for early checks
on 1 and 2 as soon as they are delivered: a kept verdict before the deadline settles at once.

## 5. Before submitting

- **Payout address.** Radar pays prizes to the deployer of the contract you enter. Both KEPT
  contracts are deployed by the IMD factory, so ask @imdradar how a factory-deployed entry names
  its payout wallet before you submit (entries cannot be edited).
- **Rules:** launched through the IMD protocol during the build period ✔ · custom contract and
  v4 hook that use IMD ✔ · dedicated X account ✔ · filed on Radar before Oct 21 ✔.
