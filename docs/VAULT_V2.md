# KeptVault v2

Status: built and tested, not deployed. Decided: all three features, an appeal panel of 15 with quorum 11, pledges from #1001, and markets pay YES only at 100%.

**Built:**
- **Contracts:** `src/v2/KeptVaultV2.sol` (22.2 KB) and `src/v2/KeptQuestionsV2.sol`, the question builder deployed beside it to stay under the 24 KB limit.
- **Tests:** v1's vault suites ported, 18 feature tests including a conservation fuzz test, markets on v2, and a fork test that buys a real oracle request after a deadline.
- **Server and bots:** every API, the alerts and the verdict bot read both vaults.
- **Site:** reads both vaults, shows partial results and appeals, and adds the partial-credit milestone type to the pledge form once v2 is live.
- **Launch:** `launch.mjs vault-v2`.

**Two things to know:**
- **Referee Fund:** the KEPT hook sends its trading fees to **v1's** Referee Fund, because the hook was deployed pointing at v1 and can't be changed. Until something else funds v2's own Referee Fund, its check rebates come only from donations, and from market fees once a v2 market exists.
- **Markets:** `KeptMarkets` takes one vault at deploy, so markets on v2 pledges need their own deploy. The site shows markets on v1 pledges only for now.

v1 stays live and unchanged. Pledge #1 stays on v1, because locked tokens can't move between contracts. v2 is a second vault: new pledges choose it, and the site, badge, score, alerts and embed read both.

## What v2 fixes

Three things a real team would push back on, found while building and running v1:

1. **All or nothing.** A team that gets its pool to 4.9 IMD out of 5 burns the whole tranche, the same as one that did nothing.
2. **"What if the panel gets it wrong?"** Three tries with a 9-agent panel is fair. But once they're used, there's no recourse, even for a team that clearly delivered.
3. **The deadline trap.** In v1, every milestone except a GitHub release must be checked *before* its deadline. A team that hits its number at 9 PM on deadline day has to have already asked the swarm. We nearly fell into this ourselves with milestone 3.

## The oracle supports all three

Checked against IMD's free question checker on 2026-11-07, with no blockers:

| question | answer | evidence | panel | result |
| --- | --- | --- | --- | --- |
| "call `collected()` on the KEPT hook at the last block at or before a date; return the uint256" | `uint256` | `chain` | 9 / 7 | accepted, no suggestions |
| the v1.0.0 GitHub release question | `bool` | `panel` | **15 / 11** | accepted, no suggestions |

With `chain` evidence, IMD re-runs the contract call itself at the pinned block. The answer is a number nobody interprets, so it's safe to pay out by.

## 1. Partial credit, for numeric milestones only

A new kind, **`ValueScaled`**: a contract call, a **floor** and a **target**.

- The swarm returns the call's value *v* at the last block at or before the deadline (`uint256`, chain evidence).
- The share that unlocks is `(v − floor) / (target − floor)`, clamped to 0 to 100%. The rest burns.
- Example: our milestone 3 as `ValueScaled` with floor 0 and target 5 IMD. At 3 IMD, 90M KEPT unlocks and 60M burns. At 5 IMD or more, all 150M unlocks.

**Why only numeric milestones.** Agents grading "how much of the app shipped" is the kind of vague question panels disagree on. For the other kinds, partial credit already exists in v1: split a deliverable into up to 8 milestones, each with its own tranche. The site will suggest that.

## 2. Checks after the deadline for anything that can be re-checked

v2 pins every chain question to **the last block at or before the deadline**. A past block can be read at any time, so `ValueAtLeast`, `ValueScaled` and `ContractDeployed` can be checked during the 3-day window after the deadline, as GitHub releases already can.

Only `PageContains` must still be checked before its deadline, because nobody can see what a page said yesterday. The site will say so when a team picks it.

This removes the trap in point 3 for every kind except web pages.

## 3. One appeal per milestone

When a milestone's last verdict was "not delivered", the team may ask once more, with a **15-agent panel and a quorum of 11**:

- **When:** within the same window the milestone can be checked: before the deadline for a page, until 3 days after it for everything else.
- **Cost:** paid from the check budget like any check, at most 2 × 0.5 IMD, and it counts as the fourth try.
- **Result:** final. Delivered makes the milestone kept. Not delivered leaves it to burn on schedule.
- **Exceptions:** there's no appeal on chain-evidence questions, since IMD re-runs the same call and would give the same answer.

## Unchanged

Custody (only a kept verdict or a missed deadline moves tokens), the Referee Fund and rebates, the check budget, `settle`, `clearStale`, the owner's limited powers, the EIP-712 verdict checks. All of v1's tests are carried over.

## Pledge numbers

v2's first pledge is **#1001**. v1 and v2 numbers never collide, so `/p/1` always means v1's pledge #1 and `/p/1001` is v2's first. No link, badge or score changes meaning.

## Markets

`KeptMarkets` (not yet deployed) reads a milestone's outcome. For v2 it needs one rule for partial outcomes. Proposed: **YES wins at 100%**, and **anything less pays NO**, because the market asks "will they deliver the milestone", not "will they deliver some of it". The markets contract takes the vault address at deploy, so a v2 market is a second deploy.

## Work, in order

1. **Contract:** `KeptVault` v2 with `ValueScaled`, block-pinned chain questions, `appeal()`, the `Partial` outcome and pledges from #1001. Every v1 test is carried over, plus new tests, a fuzz test that payout + burn == amount for every value, and a fork test.
2. **Site and APIs:** read both vaults. This touches the pledge list, Board, Graveyard, score, badge, embed, verdict cards, previews, alerts and the verdict bot.
3. **Make a pledge:** choose the floor and target for `ValueScaled`, and a warning when picking `PageContains`.
4. **Launch:** `launch.mjs vault-v2`, an IMD `evm_contracts` launch, 0.5 IMD, run by you.

## Decisions needed

1. **All three features, or start smaller?** Partial credit and checks after the deadline are the bigger wins. The appeal could follow later.
2. **Appeal panel of 15 / quorum 11**, as IMD proposed?
3. **v2 pledges numbered from #1001?**
4. **Markets on a partial outcome:** YES only at 100%?
