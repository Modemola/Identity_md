# Security model

What KEPT trusts, what it does not, and what a reviewer should push on. Both launches went through
IMD's launch pipeline, where audit agents reviewed the code and a judge reproduced and ranked their
findings. Every finding is listed here whether or not the code changed, with the test that pins it.
The full notes are in [launches/vault-2172.adaptation.md](launches/vault-2172.adaptation.md) and
[launches/token-2185.adaptation.md](launches/token-2185.adaptation.md).

## What holds without trusting anyone

- **Locked tokens only move two ways.** A kept milestone pays its tranche to the pledge's
  beneficiary; a milestone not proven in time is sent to `0x…dEaD`. There is no withdrawal, pause,
  proxy or upgrade path, and no account can redirect a tranche.
- **A verdict has to be signed.** `onOracleResult` accepts a result only from the Intake the check
  was sent to, for the ticket it opened, with an EIP-712 signature from the signer recorded when
  the check was asked, for this chain, from a panel and quorum at least as large as the pledge was
  created with, issued after the check was asked.
- **Checks are paid from the pledge's own budget.** A check never spends more than the caller's
  price ceiling (0.5 IMD by default), and a higher quote reverts without spending budget or an
  attempt.
- **The hook has no owner.** It cannot be reconfigured after deployment. Only the launch factory
  could initialize its pool, once.

## What KEPT trusts

**The IMD oracle and its signer.** A milestone is kept when the oracle's signer says so. KEPT checks
the signature and the panel, not the answer itself. If the oracle's panel answers wrongly, the
vault follows the signed answer.

**The vault owner, after seven days of notice.** The owner
(`0xd3336a7c8a7d8814c437196abb16c4fe7aa7b016`, an externally owned account today) can replace the
oracle Intake, action and signer through `proposeProtocol` and `executeProtocol`. Every change is
public for seven days before it takes effect. Checks already in flight keep the Intake and signer
they were asked with. Existing pledges cannot exit during the notice, and a signer chosen by the
owner can approve later checks, so this is a trust assumption for every pledge. The owner can also
change the panel size and quorum for future pledges, and transfer or renounce ownership. The site
shows a red banner whenever a change is pending.

**The tokens people lock.** Use plain ERC-20s whose vault balance changes only through exact
transfers. Deposit taxes are refused by an exact balance check. Rebasing, balance decaying,
confiscatable or transfer restricted tokens are not supported: if such a token shrinks the vault's
balance, earlier settlements can use up the backing and the last tranche can become unpayable.

## Audit findings: the vault (IMD launch #2172)

| Finding | Severity | Outcome | Pinned by |
| --- | --- | --- | --- |
| A page, contract or value snapshot signed after its deadline could still release tokens | behavioural | **Fixed.** Snapshot templates close new checks at the deadline and refuse attestations issued after it. GitHub releases keep the grace period because their question pins the publication time. | `test/KeptVaultAudit.t.sol` |
| The creator could use up all three checks so the beneficiary could never prove delivery | behavioural | **Fixed.** Only the beneficiary can spend checks. | `test/KeptVaultAudit.t.sol` |
| A repriced or replaced Intake could spend a whole budget on one check | behavioural | **Fixed.** `check(id, index, maxPrice)` enforces a ceiling; the two argument form uses 0.5 IMD. | `test/KeptVaultAudit.t.sol` |
| A token that shrinks the vault's balance can make the last tranche unpayable | behavioural | **Documented.** Such tokens are not supported, as above. | `test/KeptVaultTokenCompatibility.t.sol` |
| The owner controls the oracle settings | informational | **Documented.** The seven day notice and its limits, as above. | `test/KeptVault.t.sol` |
| Scope and evidence of the oracle integration | informational | **Confirmed.** The canonical attestation, type hash and callback are unchanged; a launch rehearsal was added. | `test/KeptVaultLaunch.t.sol` |

## Audit findings: the token and hook (IMD launch #2185)

| Finding | Severity | Outcome | Pinned by |
| --- | --- | --- | --- |
| The fee rounded down, so dust swaps paid nothing | low | **Fixed.** The fee rounds up in all four swap modes; any swap that moves IMD pays at least one wei. | `test_dustSwapsRoundTheFeeUp`, `testFuzz_dustSwapsAlwaysPay` |
| The 30 minute opening window started at pool initialization | low | **Fixed.** It starts at the first swap that moves IMD. | `test_openingClockStartsAtFirstSwapNotInitialize` |
| A 1 wei swap on the empty pool could start the window before liquidity existed | medium | **Fixed.** Only a swap the pool actually fills starts the clock. | `KeptHookOpeningTest` |
| The Referee Fund rebates checks for any kept milestone, including trivial pledges on worthless tokens | medium | **Documented.** The vault is live and has no upgrade path, so the fund is a public subsidy for kept checks. A rebate cap belongs to a future vault version. | the token launch record |
| Swept fees sit in the vault, under the owner's seven day notice | low, advisory | **Documented.** As above. | the token launch record |
| Coverage | informational | **Confirmed** and asserted by the launch rehearsal. | `test/KeptHookLaunch.t.sol` |

## What a reviewer should push on

- **The oracle's answers.** KEPT can only be as right as the panel. A page that shows the text
  briefly, or a release published and then deleted, is judged at the moment the swarm looks.
  Snapshot checks prove the state when they ran, not that it lasted.
- **Timing near a deadline.** Page, contract and value checks must be signed by the deadline.
  Asking late leaves no room for oracle latency, and a check that is never answered times out after
  a day with its fee spent.
- **The owner key.** Today it is a single externally owned account. Moving it to a multisig, or
  renouncing it once the oracle settings are final, would remove the main trust assumption.
