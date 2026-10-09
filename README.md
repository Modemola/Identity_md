# KEPT

**Promises the swarm enforces.** A team locks its tokens behind public milestones. At each
deadline the IMD swarm checks the milestone and signs a verdict onchain. Kept: the tokens
unlock to the team. Broken: they are burned.

Built on the IMD protocol for Robinhood Chain (4663). Every check is paid in IMD to the swarm.

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
