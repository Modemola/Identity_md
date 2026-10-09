# Verification record

## Offline suite

```sh
forge test
```

76 tests pass offline (the Robinhood fork suite skips unless run on a fork): vault lifecycle and every callback guard, the
protocol's EIP-712 conformance vector, a production oracle signature, hook fee accounting on a
local v4 PoolManager in both currency orders, and stateful invariants (128 runs × 128 calls each).

## Production signature

`test/RealAttestation.t.sol` recovers the live oracle signer
`0x5598aa9146215bc13eb26f2c692ad1461fd32982` from Robinhood request
`2cbdce1f-1eb9-4a87-ba4c-2ec8ce244392` (attested 2026-10-08T21:41Z) using KEPT's own
`OracleAttestation.hashStruct`. That request was signed with `agreed` 139 below `quorum` 140,
settled by the deployer's chain rerun, which is why chain-evidence templates accept
`agreed < quorum` and panel templates do not.

## Robinhood fork rehearsal

```sh
forge test --match-contract RobinhoodForkTest \
  --fork-url https://rpc.mainnet.chain.robinhood.com --fork-block-number 83978104
```

Passed on 2026-10-09 at block 83,978,104 (2 passed, 0 failed) against the real Intake
`0x1397…ea56`, IMD `0x5f7b…7127` and Uniswap v4 PoolManager `0x8366…0951`:

- `test_checkBuysARealOracleRequest`: a KEPT check pays exactly the live price (0.5 IMD) to the
  real Intake, leaves no allowance, and the Intake's `Requested` event carries KEPT's exact body,
  callback target and selector.
- `test_hookTradesAndFundsTheRefereeOnTheLivePoolManager`: the hook, at a `0x20cc` address,
  initializes a KEPT/IMD pool on the live PoolManager, charges its fee on a buy and a sell, and
  `sweep()` deposits exactly the collected IMD into the Referee Fund.

Balances are synthetic (`deal`); nothing is broadcast. Public RPCs prune state, so repeat with a
fresh block number or an archive RPC.

## Oracle body validation

On 2026-10-09 the exact bodies `KeptVault` generates for all four templates passed
`POST /requests/check` with no blockers and were accepted by an unpaid `POST /requests/quote`.
