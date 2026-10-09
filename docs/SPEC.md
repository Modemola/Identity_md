# KEPT — promises the swarm enforces

> The team only gets paid when it ships, and the IMD swarm is the referee.

KEPT lets any project lock tokens behind public milestones. At each deadline the IMD
reasoning oracle checks the milestone and signs a verdict for the KEPT contract. A kept
milestone releases its tokens to the team. A broken one burns them.

Chain: Robinhood Chain (4663). Everything is paid in IMD.

## Parts

| Launch | Kind | Contracts | Purpose |
| --- | --- | --- | --- |
| 1 | `evm_contracts` | `KeptVault` | The product. Open to every project, no token. |
| 2 | `univ4_hook` | `KeptToken`, `KeptHook` | KEPT/IMD pool. The hook's IMD fee funds the Referee Fund in `KeptVault`. The KEPT team locks its own share in a pledge. |

Launch 1 goes first; its address is a constructor argument of `KeptHook`.

## Concepts

- **Pledge**: one project's promise set. It names the locked `token`, the `beneficiary`
  that receives kept tranches, a `name`, the panel settings snapshotted at creation, and an
  IMD `budget` that pays for checks.
- **Milestone** (1–8 per pledge): a template, its parameters, a `deadline`, a token
  `amount`, and a display `title`. Its outcome is `Open`, `Kept` or `Broken`.
- **Check**: one oracle question bought from the IMD Intake for one milestone
  (0.5 IMD today, read live from `Intake.priceOf`).
- **Referee Fund**: IMD anyone can donate (the KEPT hook does so continuously). When a
  milestone is verified kept, the fund rebates the price of one check to that pledge's budget.
  Keeping a promise costs nothing; breaking one means the team paid for its own verdict.

## Milestone templates

Free-form promises are not accepted: vague questions are what make oracle panels disagree.
Each template produces one precise yes/no question. User strings are restricted to a safe
character set and length, so they cannot break the JSON body or the question's sentence.

| Template | Parameters | Evidence | Question (abridged) |
| --- | --- | --- | --- |
| `GithubRelease` | `repo` (`owner/name`), `tag` | panel | Does github.com/`repo` have a published, non-draft release tagged exactly `tag`, published at or before the deadline? |
| `PageContains` | `url` (https), `text` | panel | Does `url`, fetched now, respond successfully and contain the exact text `text`? |
| `ContractDeployed` | `chainId`, `target` | chain | On chain `chainId`, does `target` have contract bytecode at the closing block? |
| `ValueAtLeast` | `chainId`, `target`, `function`, `threshold` | chain | On chain `chainId`, does calling `function` on `target` return a uint256 ≥ `threshold`? |

Supported question chains: Ethereum 1, BNB 56, Robinhood 4663, Base 8453, Arbitrum 42161
(the list `POST /requests/check` reports). On 9 Oct 2026 the exact bodies `KeptVault` generates
for all four templates passed `POST /requests/check` with no blockers, and were accepted by
`POST /requests/quote` (unpaid), which applies the same validation as the Intake.

## Lifecycle

1. `createPledge(token, beneficiary, name, milestones, budget)` pulls the summed token
   amounts and the IMD budget. Fee-on-transfer tokens are refused (exact balance delta).
   Each deadline must be at least one hour and at most three years ahead.
2. `check(pledgeId, index)` buys a question:
   - before the deadline only the creator or beneficiary may call it (to prove early delivery);
   - from the deadline until `deadline + GRACE` (3 days) anyone may;
   - at most `MAX_ATTEMPTS` (3) per milestone, one in flight at a time;
   - the price comes out of the pledge budget; anyone can top it up with `fund`.
3. The Intake calls `onOracleResult(requestId, attestation, signature)`. KEPT accepts it
   only from the Intake that took the request, only for a request it made, only when signed
   by the oracle signer in KEPT's EIP-712 domain, for the right question chain, with at least
   the snapshotted panel size and quorum, `agreed >= quorum`, issued after the ask, and as a
   bool. `true` marks the milestone `Kept` and pays the rebate if the fund can. `false` is
   recorded and the milestone stays `Open`. The callback only verifies and stores (it must fit
   200k gas); tokens move in `settle`.
4. A check with no answer after 24 hours can be cleared by anyone (`clearStale`), freeing the
   slot. The attempt still counts.
5. `settle(pledgeId, index)` is permissionless:
   - `Kept` → the tranche goes to the beneficiary;
   - still `Open` after `deadline + GRACE` with nothing in flight → `Broken`, and the tranche
     is sent to `0x…dEaD`.
   Unproven means broken: the burden of proof is on the team.
6. When the last milestone settles, the unused IMD budget returns to the creator.

## Trust model

- No one can move locked tokens except through a verdict or a missed deadline. The owner has
  no withdrawal, pause or upgrade path.
- The owner (the KEPT team wallet) can change the Intake, action id and oracle signer, which
  the IMD docs say must stay settable. Every change waits 7 days in public (`proposeProtocol`
  → `executeProtocol`), and requests already in flight stay bound to the Intake that took them.
  Panel size and quorum changes apply to new pledges only. Ownership can be renounced. The
  website shows a warning on every page while a change is pending.
- IMD (the payment asset) is immutable.
- Known limits: a creator controls the strings in their own question, so the panel is the last
  line of defence against wording games (the character set blocks quoting tricks; quorum 7 of 9
  by default). A milestone the swarm cannot confirm is broken, so teams should pick templates
  they can prove. Third parties can spend at most 3 checks per milestone, and only after the
  deadline. The page-text template tells the panel the quoted text is a literal string, never an
  instruction.
- Verdicts arrive only through the Intake callback, bound to the Intake request that asked.
  There is deliberately no public `submit` for re-delivery: KEPT cannot recompute the oracle's
  question hash, so a public path would let a valid verdict for one milestone be replayed onto
  another. A callback that never lands times out after 24 hours and the milestone can be asked
  again. The heaviest callback path (kept + rebate) is tested to stay under 150k of the 200k gas.
- Rebasing tokens, whose balances shrink without a transfer, are not supported; fee-on-transfer
  tokens are refused at creation.

## KEPT token and hook

- `KeptToken`: KEPT / KEPT, 18 decimals, fixed 1,000,000,000 minted to the launch factory.
  No owner, mint, tax or pause.
- `KeptHook`: immutable fee hook for the single KEPT/IMD pool (LP fee 12500, tick spacing 60).
  It charges a fee on the gross IMD leg of every swap: 20% at opening, decaying linearly to 1%
  over 30 minutes (anti-snipe), then 1% forever. Fees accrue as PoolManager ERC-6909 claims;
  anyone can call `sweep()`, which redeems them and deposits the IMD into the KEPT Referee
  Fund. Fee math is adapted from the accepted imdDRONE hook (launch 909). Only the launch factory
  (`$factory`) may initialize the pool, as on the live imd.place hook. Permissions `0x20cc`.
- The team's launch allocation goes into a public KEPT pledge right after launch, with
  milestones dated inside the hackathon window so judges can see real verdicts and settlements.

## Launch plan

1. Publish this repository publicly; `POST /requests/import` with `kind: contracts`.
2. Launch 1: `launch.open`, `onchain: "evm_contracts"`, `chainId: 4663`, `owner: <team wallet>`,
   deploy only `KeptVault`.
3. Launch 2: `launch.open`, `onchain: "univ4_hook"`, `chainId: 4663`, `pairWith: "imd"`,
   `economics: {poolBps, remainderTo: <team wallet>}`, deploy `KeptToken` + `KeptHook` with the
   vault address.
4. Lock the team share in a pledge, run the first checks, build the site, file on IMD Radar.
