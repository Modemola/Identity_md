# KEPT on vibe/vibe

A note for the vibe/vibe team: what KEPT reads from vibe/vibe, what you can put on a launch page, and one question.

## KEPT in one paragraph

A team locks part of its own supply behind public milestones: a release, a page going live, a number reached on chain. At each deadline the IMD oracle swarm checks the milestone and signs a verdict, and the vault checks that signature on chain. Kept milestones unlock to the team. Missed ones burn. The team's record (kept, broken, partly kept) is public and can't be edited by anyone, us included. KEPT is live on Robinhood Chain mainnet: https://keptmd.vercel.app

## On vibe/vibe's chain today

vibe/vibe runs on Robinhood Chain testnet (46630). The IMD oracle isn't on that chain yet, so KEPT runs there as a **test kit** (`scripts/testnet`):

- **The vault is the same.** KeptVault v2 runs unchanged: up to eight milestones, partial credit on numeric targets, checks after the deadline, one appeal.
- **The oracle is a stand-in.** Verdicts are signed by KEPT's **test oracle** key in exactly IMD's format, and the vault checks them exactly as it checks IMD's. Checks are paid in a worthless test IMD token with a faucet.
- **Labelled everywhere.** The site shows a banner on every page, and the badge, embed, share cards and posts say "test oracle" or "testnet". Testnet records never count toward a mainnet KEPT score.

On the site, pick **VibeVibe test** in the network switch, or open `https://keptmd.vercel.app/?net=vibevibe`.

Deployed on Robinhood Chain testnet:

| contract | address |
| --- | --- |
| KeptVaultV2 | `0x2e46f4bdddc8664982b2266462d70c056cdf7ee2` (block 152,827,842) |
| KeptQuestionsV2 | `0xf316b944e57ab61d369bdbbab8ad00af162c5733` |
| TestIntake | `0xd62cf7ab156aed369ae853312905d33f8b1b1c9e` |
| TestIMD (faucet) | `0xd55fb61724a30c9f97a37fb29cdf774d4bf90b98` |
| test oracle signer | `0x42CB35cE774960fd852F186782Fe932CCdA0654E` |

## What KEPT reads from vibe/vibe

Only public event logs; no vibe/vibe contract is called and nothing needs to change on your side.

| what | where | used for |
| --- | --- | --- |
| `Launched(uint256 indexed id, address indexed creator, address indexed token, ...)`, topic `0xa7e8032b…f5c8` | factory `0xe794217880011f9ca6961340ed5c16ec9559fea0`, from block 126,079,564 | "Draft my pledge" from a launch number: `id` finds the launch, `token` is what gets locked, the first data word is the pool |
| `Graduated(bytes32 indexed dexPool)`, topic `0xab164bba…b2ae` | the launch's pool | whether the token can be locked yet (below) |

A team types its launch number (e.g. 8422 for $SCOUT) and KEPT drafts the pledge: the token, a release milestone from the team's repo, and one milestone per roadmap line. The team reviews every field before signing.

## For your launch pages

**Badge**, 20 px, with the token's KEPT score:
```html
<img src="https://keptmd.vercel.app/api/score?token=0x…&chain=46630&format=svg" alt="KEPT score">
```

**Live card**, 380x128, with milestones, lamps and the next deadline:
```html
<script src="https://keptmd.vercel.app/embed.js" data-token="0x…" data-chain="46630" async></script>
```

**JSON**, for your own UI: `https://keptmd.vercel.app/api/score?token=0x…&chain=46630`. It returns the score, kept, broken and open counts, and each pledge with its link. A token with no pledge returns `score: null`, which reads as "no record yet", not as a bad one.

Once KEPT's vibe/vibe vault is on mainnet with IMD verdicts, the same lines work with `&chain=` dropped or changed, and the "testnet" label goes away.

## The one question: the graduation lock

vibe/vibe locks a token's transfers until it graduates. Before then, the token's own `transferFrom` reverts (custom error `0xdb89e3f4`), so the KEPT vault can't take the tokens. We tested both cases on a fork of the live testnet (`test/fork/VibeVibeFork.t.sol`):
- **Graduated:** $SCOUT, launch #8422, locked and released.
- **Not graduated:** launch #47444 is refused by the token.

Today KEPT tells a team with an ungraduated launch to come back once it graduates.

The pledge is most useful **at launch**, when buyers are deciding whether to trust the team. Would vibe/vibe consider letting the KEPT vault receive tokens before graduation? For example, an allowlist entry for the vault address. The vault can only release tokens to the team on a kept verdict or burn them on a missed one, so allowing it doesn't open a path to sell before graduation. We'd be glad to walk through the contract.

## Contacts

- **Code:** https://github.com/modemola/identity_md (`src/v2`, `src/testnet`, `scripts/testnet`)
- **X:** @keptonchainn
