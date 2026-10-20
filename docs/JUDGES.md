# Trying KEPT in five minutes

KEPT is live on **Robinhood Chain** with real contracts. You can see everything below without a
wallet: the site reads the vault directly. You only need a wallet to send a transaction, and there
is no login or account.

**Live site:** <https://keptmd.vercel.app>

## 1. What to look at, in order

**Home.** The headline, then the swarm scope beside it. That sphere is the IMD swarm, drawn in
real time on the GPU. Watch the verdict feed under it: each line plays out on the sphere. A check
links a panel of nine agents to the core, a kept verdict sends a green wave across the sphere, and
a broken one throws off red embers. Move the pointer over the hero to turn it. The status bar at
the bottom shows the latest Robinhood block, the vault's pledge count and IMD's live oracle answer
count. Below the hero is the list of live pledges.

**KEPT team roadmap (pledge #1).** Click it. This is KEPT's own team allocation: 300,000,000 KEPT
locked behind three milestones. The page shows what is locked, released and burned, the check
budget, and a timeline with each milestone's deadline, its three day proof window hatched after
it, and a NOW marker. Open **What the swarm is asked** on any milestone: that is the exact
question the vault sends to the oracle, written by the vault itself.

**Make a pledge.** Choose **GitHub release**, type any public repository and a tag, and watch the
question appear under the form. The preview is a live read of the vault's own `previewQuestion`,
so a bad repository name or tag is refused with the field to fix. The card on the right keeps the
totals and a timeline of your milestones in view.

**How it works.** The life of one milestone, the four templates, and why the tokens cannot be
taken.

**Referee Fund.** Where the pool fees go, and what the fee is right now.

Press **⌘K** (or **Ctrl+K**, or **/**) anywhere to jump to a page or pledge.

## 2. Checking the claims yourself

Every claim on the site can be read from chain.

| Claim | Check |
|---|---|
| The vault, token and hook are deployed | Open each address in [CONTRACTS.md](CONTRACTS.md) on robin.etherscan.io |
| The team cannot take locked tokens | Read `src/KeptVault.sol`: tokens leave only through `settle`, to the beneficiary or the burn address |
| Verdicts are verified onchain | `onOracleResult` in `src/KeptVault.sol` checks the EIP-712 signature, chain, panel size and quorum |
| KEPT's pledge locks 300,000,000 KEPT | `cast call 0x3152f9cbf64d0c1ac24ea7e101db3e4d8da86896 "pledge(uint256)" 1 --rpc-url https://rpc.mainnet.chain.robinhood.com` |
| The hook's fee starts at the first trade | `cast call 0xb5f28198750864e199477a6898bad44ae4d1e0cc "openedAt()(uint256)" --rpc-url https://rpc.mainnet.chain.robinhood.com` (0 until the first trade) |
| KEPT verifies the IMD oracle's real signature | `forge test --match-contract RealAttestationTest -vv` |
| The suite passes | `forge test` (221 tests) |

## 3. If you want to send a transaction

| | |
|---|---|
| Network | Robinhood Chain |
| Chain ID | `4663` |
| RPC | `https://rpc.mainnet.chain.robinhood.com` |
| Currency | ETH |
| Explorer | `https://robin.etherscan.io` |

Press **Connect**. On your first transaction the site asks your wallet to switch to Robinhood
Chain, or to add it. This is mainnet: transactions cost real
ETH for gas, and a check costs 0.5 IMD. Every action opens a panel that walks through its steps
(allowances, the wallet signature, the block) with a link to each transaction. If the vault refuses
an action, the panel says why in plain words.

**Things anyone can do:** add IMD to a pledge's check budget, donate to the Referee Fund, sweep the
pool's fees into the fund, and settle a milestone once its verdict is in or its proof window has
closed.

**Things only the beneficiary can do:** ask the swarm to check a milestone. Each milestone gets up
to three checks.

## 4. How the swarm decides

When the beneficiary asks, the vault pays the IMD Intake 0.5 IMD and sends the milestone's question.
IMD's oracle gives it to a panel of 9 agents, 7 must agree, and the network signs the verdict.
The Intake calls the vault back with the signed result. The vault checks that the signature comes
from the oracle signer it trusts, for this chain, from a panel and quorum at least as large as the
pledge requires, and only then marks the milestone kept or not proven. A kept verdict refunds the
check from the Referee Fund while the fund holds IMD, and the tranche goes to the beneficiary when
anyone calls `settle`.

A milestone that is not proven within three days of its deadline burns: anyone can settle it and
its tokens go to `0x000000000000000000000000000000000000dEaD`.
