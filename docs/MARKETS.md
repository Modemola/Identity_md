# Will they ship? Markets on KEPT milestones

Status: contract and tests done (`src/KeptMarkets.sol`, `test/KeptMarkets.t.sol`, `test/fork/MarketsFork.t.sol`). Not deployed. Decided: bets in IMD, a 1,000 IMD YES cap, a fee of 1% to the check budget and 1% to the Referee Fund.

## The idea

Every open milestone on KEPT gets a YES/NO market: *will this team deliver this milestone?* People bet IMD. The same swarm verdict that releases or burns the team's tranche also settles the market. KEPT adds no new oracle and no admin who decides outcomes.

This gives people who don't hold a team's token a reason to care about its pledge. It also turns every deadline into an event people watch, and it buys IMD.

## How it settles

The market reads the vault, which already records the answer:

- **YES wins** when `vault.milestone(id, i).outcome == Kept`. That is set the moment the swarm's signed verdict lands.
- **NO wins** when it is `Broken`. That is set by `settle` once the milestone is not proven by `deadline + 3 days`.

`settle` is open to anyone, and `resolve()` on the market calls it when needed. A market can therefore always be closed out, with nobody's permission.

**Safety valve:** if a market is still unresolved 14 days after `deadline + 3 days`, it is voided and everyone gets their stake back. That should never happen, since `settle` cannot be blocked for longer than one `ANSWER_TIMEOUT`. It exists so funds can never be stuck by a bug.

## Mechanics: a parimutuel pool

There are two pools, YES and NO, both in IMD. When the market resolves, the winning side splits the whole pot in proportion to their stakes, minus the fee.

**Why a pool and not an order book or AMM:**
- A new market has no liquidity and nobody to make a market.
- A pool needs neither and works from the first bet.
- Odds show live as the pool ratio. For example, YES 300 / NO 100 means 75% YES.

**Rules:**
- **Opening:** the first bet on a milestone opens its market. One market per milestone, all held in one `KeptMarkets` contract.
- **Closing:** no new bets after the earliest of:
  - the milestone's deadline;
  - the first check asked after the market opened (`attempts` or `inFlight` changes), because a check means the team believes it is done;
  - any outcome being recorded.
- **Payout:**
  - Winners: `stake + stake * losingPool * 0.98 / winningPool`.
  - One-sided market (nobody on the other side): everyone is refunded and no fee is taken.
  - Void market: everyone is refunded.
- **Claiming:** each winner calls `claim` (pull, not push). Payouts round down, so at most one wei per winner stays in the contract.

## The fee: 2% of the losing pool, all of it back into KEPT

- **1% to that pledge's check budget** (`vault.fund`). A milestone people bet on pays for its own verdict, which also fixes the "no budget, nobody checks" problem.
- **1% to the Referee Fund** (`vault.fundReferee`), which refunds the checks of teams that keep their word.

KEPT keeps no treasury cut. The only path for value is back into verdicts.

## The insider problem, honestly

The team knows more than anyone about whether it will ship.

**Betting YES on itself is fine.** It is the team putting more on the line that it delivers.

**The danger is betting NO and then sabotaging on purpose.** It only pays if the NO winnings are worth more than the tranche the team burns by failing. The defences:

1. **Cap the YES pool per market**, meaning what a NO bettor can win. The cap is a contract setting the owner can only **lower**, starting at **1,000 IMD**. A team that throws a milestone to win at most about 1,000 IMD also burns its own tranche, which for any real pledge is worth far more.
2. **The pledge's creator and beneficiary addresses cannot bet.** This is easy to get around with a second wallet, so it is a signal, not a guarantee. The docs will say so.
3. **Bets close at the first check**, so nobody can bet after the team signals it is done.
4. **Everything is public:** every bet is an event, and the pledge page shows the largest positions.

The opposite worry, outsiders betting NO and hoping the oracle gets it wrong, is the swarm's problem as much as ours. Bigger panels and the planned appeal round address it.

## What the owner can and cannot do

The contract is deliberately boring.

**The owner can:**
- lower the per-market cap;
- pause *new* bets.

**The owner cannot:**
- move funds;
- change outcomes;
- change the fee;
- point the contract at a different vault.

The vault and IMD addresses are fixed at deploy.

## Contract sketch

```solidity
contract KeptMarkets {
    IKeptVault public immutable vault;
    IERC20 public immutable imd;
    uint16 public constant FEE_BPS = 200;        // 2% of the losing pool
    uint256 public constant VOID_AFTER = 14 days; // after deadline + GRACE
    uint256 public yesCap = 1_000e18;             // owner may only lower it

    struct Market { uint128 yes; uint128 no; uint8 attemptsAtOpen; uint8 state; bool feePaid; } // Open, Yes, No, Void
    mapping(bytes32 => Market) public markets;   // key: pledgeId, index
    mapping(bytes32 => mapping(address => uint256[2])) public stakes;

    function bet(uint256 pledgeId, uint8 index, bool yes, uint256 amount) external;
    function resolve(uint256 pledgeId, uint8 index) external; // settles the vault first if it must
    function claim(uint256 pledgeId, uint8 index) external returns (uint256 paid);
    function quote(uint256 pledgeId, uint8 index) external view returns (uint256 yesOdds, bool open, uint64 closesAt);
}
```

## On the site

- **Pledge page:** each open milestone gets a "Will they ship?" bar showing the YES/NO split, the pot, the closing time, a bet form and your position. After the verdict, it shows a claim button.
- **Board:** a "Hottest markets" list, ranked by pot size.
- **Verdict cards:** a line such as "the market paid 2,400 IMD to 31 people".
- **Sharing:** "I bet YES on @team shipping X" posts with the same card style.

## Tests before launch

- Foundry unit tests for every path: YES wins, NO wins, one-sided, void, cap reached, closing on the first check, the creator and beneficiary blocked, claim twice.
- A fuzz test that payouts plus fees never exceed deposits.
- An invariant test that the contract's IMD balance always covers what it owes.
- A fork test against the live vault and pledge #1.

## Deploy

Deploy it the same way as the vault: an `evm_contracts` IMD launch through `scripts/launch/launch.mjs`. You run it, and the key never leaves your machine. There is no change to the live vault: markets only read from it, and they call the existing `settle`, `fund` and `fundReferee`.

## Decisions needed from you

1. **Currency: IMD or ETH?** I recommend IMD. It matches everything else on KEPT and creates demand for IMD.
2. **Cap: is 1,000 IMD per market right to start?**
3. **Fee split: 1% check budget and 1% Referee Fund, nothing to a treasury.** OK?
4. **Legal:** prediction markets are regulated as gambling or derivatives in many countries, the US included. I'm not a lawyer. Before launch, decide where you're comfortable offering this. At minimum, the site would show a notice and could hide the bet form by region. Consider asking someone qualified.
