# IMD Hackathon research notes

Collected 8–9 Oct 2026 from imd.fun/docs, api.imd.fun, imdradar.site, the
identity-md/worker bundle and public repos under github.com/identity-md-launches.

## Hackathon (imdradar.site/hackathon)

- $10,000 pool in ETH, USDT, USDC and IMD; only the IMD team wallet pays out.
- Judging: IMD agents check every entry and pick places 6–15; a human jury picks the top 5.
- Requirement wording on Radar: "a Uniswap v4 hook or a custom contract that really uses IMD".
- One entry per project. Fields: project X handle (required), contract (optional), about (20–1,000 chars).
- If a contract is entered, prizes go to that contract's deployer address. IMD launches are
  deployed by the IMD factories, so the deployer is not the requester: confirm payout with @imdradar.
- Entries on 9 Oct (6): Reputation Ticker (ETH), imdplace pixel war hook (RH), Illuminatico (Base),
  NUMOS number collection (RH), PepesFamily launchpad (RH), 0xCompanyIMD stock dividends (RH).
  None addresses launch accountability.

## Launching

- Actions cost 0.5 IMD each, paid on Ethereum mainnet (eip155:1, IMD 0xd34a…63b7) via x402 + Permit2
  from an EOA (no Safe). Server pays deploy gas. Quotes last 600 s. `POST /requests/check` is free.
- Kinds: `univ4_hook` (token + hook on the launch pool), `evm_project` (token + up to 8 contracts;
  the launch pool uses the factory's PoolInitializationGuard, not our hook), `custom_token`,
  `evm_contracts` (1–8 contracts, no token, constructors take static args, `$owner`, `$contract:Name`).
- Robinhood Chain 4663 is live in the API for all four kinds (explorer UI still says "soon").
  Pairings on 4663: ETH, or IMD (opening cap 250–250,000 IMD).
- Token launches: fixed 1e9 supply, 10% swarm, `poolBps` (≥1,000) of the rest seeds the pool
  single-sided, remainder to `remainderTo` (default the paying wallet). Pool fee 1.25%:
  1% to the paying wallet, 0.25% to the network.
- Own code: `POST /requests/import` a public GitHub Foundry repo (`bytecode_hash = "none"`), then pass
  `repoUrl` + `baseCommit`. The swarm runs audit-imported-code, adapt-contract-project and an
  audit panel, then deploys.
- Admission constraints seen in launches: no DELEGATECALL/proxies, hooks CREATE2-mined to their
  permission bits, immutable designs preferred, Solidity 0.8.26 / Cancun / via IR common.

## Oracle

- Onchain purchase: `Intake.request(action, body, (target, selector), asset, amount)` on Ethereum or
  Robinhood, Intake 0x1397434cd35e8a9c8ac312a61d3a285eb31dea56, action
  `bytes32("oracle.request@oracle-1")`, price 0.5 IMD of that chain's IMD (approve first; IMD has no permit).
- Callback `(bytes32 requestId, OracleAttestation.Attestation a, bytes signature)` with 200k gas, once,
  in a try; must check msg.sender == Intake, pending id, and the EIP-712 signature
  (domain "IdentityMD Oracle" / "2" / chainid / consumer). Signer used by RH launches:
  0x5598aa9146215bc13eb26f2c692ad1461fd32982. Keep intake/action/price/signer as owner settings.
- Answer types: bool, address, bytes32, uint256, address[], bytes32[]. Evidence `chain` (deployer
  reruns a recipe: log-sum, log-count, log-rank, call-compare) or `panel` (agents, with sources).
  Panel 5–100, quorum ≤ panel. Window up to 720 h.
- Reliability (api.imd.fun/oracle/counts, 9 Oct): 7,524 total, 7,314 attested (97.2%), 187 disagreed,
  20 blocked. Disagreements cluster on vague or subjective questions; precise, sourced questions attest.

## Robinhood Chain (4663)

- RPC https://rpc.mainnet.chain.robinhood.com, explorer https://robin.etherscan.io
- IMD 0x5f7bb59365ce557c26dbcaa4ee9d39a4b95b7127
- v4 PoolManager 0x8366a39cc670b4001a1121b8f6a443a643e40951 (worker flags `extendedSwapParams`)
- IntakeDelivery 0xce0e6a670aa75e161d02aca3c7f00b94ca428ccb

## Prior art to stay clear of

AskOracle (976), CabalGate per-trade gating (990), Plant Organism daily heartbeat (1003),
Basket stock index (1110), $HACK fee-funded hackathon (1032), Oddsmaker prediction market (278).
