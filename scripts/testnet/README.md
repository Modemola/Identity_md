# KEPT on vibe/vibe's chain: the testnet kit

vibe/vibe runs on **Robinhood Chain testnet** (chain ID 46630, RPC `https://rpc.testnet.chain.robinhood.com`, explorer `https://explorer.testnet.chain.robinhood.com`). The IMD oracle isn't there: it has no Intake and no IMD token on that chain. So this kit runs KEPT v2, unchanged, with two stand-ins:

| contract | what it is |
| --- | --- |
| `TestIMD` | pays for checks; worthless, with a faucet giving 100 a day |
| `TestIntake` | takes check requests exactly like IMD's Intake; verdicts come from the **test oracle** key |
| `KeptQuestionsV2`, `KeptVaultV2` | KEPT v2 as on mainnet |

**Every verdict on this kit is a test verdict, signed by a key you hold, not by the IMD swarm.** It exists so vibe/vibe's team can build and try the integration: pledges, checks, appeals, partial credit, releases and burns. Real verdicts happen on mainnet.

## Deploy (about 0.01 testnet ETH)

Use a throwaway key that holds only testnet ETH from the Robinhood Chain testnet faucet.

```sh
cd scripts/testnet
npm install
node deploy.mjs --dry-run     # the plan and the cost
node deploy.mjs               # asks for the key, hidden; or set KEPT_TESTNET_KEY
```

It makes a fresh **test oracle key**, saved only on this computer in `.oracle-key`, and deploys the four contracts. The addresses go to `deployment.json`.
- **`deployment.json`:** commit it, or send it to wire the KEPT site to the testnet.
- **`.oracle-key`:** never share it or commit it (it's gitignored). Whoever has it decides every test verdict.

## Answer checks: the test oracle desk

```sh
node desk.mjs                              # checks waiting, with the exact question for each
node desk.mjs answer 1001 1 yes            # pledge 1001, milestone 1: delivered
node desk.mjs answer 1001 2 no             # not delivered (the team may then appeal once)
node desk.mjs answer 1001 3 1000000000000000000000000000   # a partial-credit milestone: the number, raw units
```

The desk signs each verdict exactly the way IMD signs one (EIP-712, "IdentityMD Oracle" v2), and the vault checks it exactly as it checks IMD's. An appeal is answered as a 15-agent panel with a quorum of 11. Answer honestly: the point is to rehearse the real thing.

## Rules worth knowing on vibe/vibe

- **Pledge after graduation.** vibe/vibe locks a token's transfers until it graduates. Before then, the token's own `transferFrom` reverts (custom error `0xdb89e3f4`), so the vault can't take it. `test/fork/VibeVibeFork.t.sol` shows both cases on the real testnet.
- **A team can promise something about its own testnet token.** v2 accepts chain questions about the vault's own chain, so "SCOUT supply holds at 1B" works here. A mainnet vault still accepts only the chains IMD serves.

## Tested

`test/testnet/TestnetKit.t.sol` covers the kit end to end. `test/fork/VibeVibeFork.t.sol` runs it on a fork of the real testnet: a $SCOUT holder pledges, the test oracle confirms, and settle releases. The scripts themselves were rehearsed on that fork:
- deploy
- pledge three milestones
- the desk answers "no"
- the team appeals and the desk answers the appeal as a 15-agent panel
- a partial-credit milestone is scored after its deadline
- all three settle and the vault ends empty
