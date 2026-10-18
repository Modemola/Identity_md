# KEPT

**Promises the swarm enforces.** A team locks its tokens behind public milestones. At each
deadline the IMD swarm checks the milestone and signs a verdict onchain. Kept: the tokens
unlock to the team. Broken: they are burned.

Built on the IMD protocol for Robinhood Chain (4663). Every check is paid in IMD to the swarm.

This assignment launches **only `src/KeptVault.sol:KeptVault`** on chain 4663. The token and
hook below belong to a separate future launch. This launch sends zero ETH and makes no
initialization calls. Its nonpayable constructor already accepts the factory's static arguments:

| Argument, in order | Value |
| --- | --- |
| `owner_` (`address`) | `$owner`, resolving to `0xd3336a7c8a7d8814c437196abb16c4fe7aa7b016` |
| `intake_` (`address`) | `0x1397434cd35e8a9c8ac312a61d3a285eb31dea56` (Intake v1) |
| `imd_` (`address`) | `0x5f7bb59365ce557c26dbcaa4ee9d39a4b95b7127` |
| `action_` (`bytes32`) | `0x6f7261636c652e72657175657374406f7261636c652d31000000000000000000` |
| `signer_` (`address`) | `0x5598aa9146215bc13eb26f2c692ad1461fd32982` |
| `panelSize_` (`uint16`) | `9` |
| `quorum_` (`uint16`) | `7` |

The deployment handoff supplies the deployed address. The manifest belongs to the following
launch step. See [ADAPTATION.md](ADAPTATION.md) for audit dispositions and
[docs/VERIFICATION.md](docs/VERIFICATION.md) for checks and the fork rehearsal.

- Full design: [docs/SPEC.md](docs/SPEC.md)
- Protocol research and addresses: [docs/research.md](docs/research.md)

## Contracts

| Contract | What it does |
| --- | --- |
| `KeptVault` | Holds locked tokens per pledge, buys oracle checks from the IMD Intake, verifies signed verdicts, pays kept tranches and burns broken ones. Open to any project. |
| `KeptToken` | KEPT, fixed 1,000,000,000 supply, plain ERC-20. |
| `KeptHook` | Uniswap v4 hook on the KEPT/IMD pool. Takes 1% of the IMD leg (20% at opening, decaying over 30 minutes) and sweeps it into the vault's Referee Fund, which refunds the check of every milestone a team keeps. |

Milestones use four templates so every question the swarm gets is precise:
`GithubRelease`, `PageContains`, `ContractDeployed`, `ValueAtLeast`.

Only a pledge's **beneficiary** can buy its three check attempts. Anyone can fund it, clear a
stale check, settle, or return the completed pledge's unused budget to its creator.
`check(id, index)` caps payment at `DEFAULT_MAX_PRICE = 500000000000000000` (0.5 IMD).
`check(id, index, maxPrice)` explicitly accepts another ceiling in IMD atomic units; it still
pays only the live quote. A higher quote reverts without spending budget or an attempt.
`checkOpen` has matching two- and three-argument forms; `funded` includes the price ceiling.

Page and chain templates are snapshots: ask early enough for the oracle to **sign by the
deadline**. A timely, unexpired signature may be delivered later. Their grace period does not
permit a new check or a signature issued after the deadline. GitHub release checks can still
be requested during the three-day grace period because their question explicitly requires
publication by the deadline. Early success remains final: these templates do not prove that
a page, deployment or value persists through the deadline. Missing or delayed oracle evidence
can still cause a burn; a paid check does not guarantee delivery or a refund.

## Supported tokens and trust

Use plain ERC-20s whose vault balance changes only through exact transfers. **Do not deposit
rebasing, balance-decaying, confiscatable or transfer-restricted tokens**, including tokens
whose administrator can later introduce these behaviours. Deposit taxes are rejected by an
exact balance-delta check, but that check cannot detect future balance shrinkage or freezes.
Metadata or a successful deposit is not evidence of compatibility.

KEPT accounts in nominal units and pools custody by token. If an unsupported token shrinks
the vault's balance, early settlements can consume the remaining backing and the last tranche
can become unpayable. Its IMD budget then remains locked because budget refunds require all
milestones to settle. There is no pro-rata loss allocation or rescue withdrawal. This is a
documented restriction, not an onchain detector of every incompatible ERC-20.

The owner may replace the Intake, action and signer after a public seven-day delay. Existing
pledges cannot exit during that notice, and an owner-selected signer can approve later checks.
In-flight requests retain their original Intake and signer. Panel changes affect future pledges;
ownership can be transferred or renounced. The owner and IMD's request-to-verdict pairing remain
trust assumptions. The pinned v1 Intake supports `request`; failed requests use the existing
one-day timeout, without a v2 failure callback.

## Build and test

Solidity 0.8.26, Cancun, via IR, optimizer 200, `bytecode_hash = "none"`. Dependencies are
vendored under `lib/` (no submodules, network, FFI or filesystem permissions needed).

```sh
forge build
forge test
```

The suite covers the full pledge lifecycle, every callback guard, the IMD oracle
conformance vector (KEPT verifies the protocol's real signature), the hook's exact fee in all
four swap modes on a real local PoolManager in both currency orders, and stateful invariants
proving locked tokens and IMD are always accounted for.

## Provenance

`src/OracleAttestation.sol` is the protocol's canonical consumer, copied unchanged from
AskOracle (launch 976). `KeptHook` fee math and `src/libraries/SpecifiedAmount.sol` come
from the accepted imdDRONE hook (launch 909). Both are MIT.
