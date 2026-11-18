# KEPT bonds: ETH behind a promise

A pledge locks a team's own tokens. If a promise breaks, those tokens burn. That helps holders only as much as a burn does: their share of the supply grows, but nobody pays them anything.

A **bond** adds real money. With a milestone, the team (or anyone backing it) posts ETH. The vault's verdict decides where it goes:

| verdict | the ETH |
| --- | --- |
| **kept** | goes back to whoever posted it |
| **partly kept** (a numeric milestone) | the delivered share goes back; the rest is forfeited |
| **broken** | all of it is forfeited |

**Forfeited ETH buys the token from holders, and burns it.** Holders who want out after a broken promise get a buyer the team paid for. Everyone who stays holds a larger share of a smaller supply.

## How the buyback works

The bond is a buyer, so it runs a **rising-bid auction**:

1. **It opens low.** The opening bid is the price at which the whole forfeit would buy the whole supply, far below any real market price.
2. **It doubles every hour**, rising smoothly in between.
3. **Holders sell when the bid is worth it.** Anyone holding the token can sell to the bond at the current bid. The bond pays in ETH and sends every token it buys to `0x…dEaD`.
4. **It stops rising at a cap,** where one whole token would take the entire forfeit, so the price can never run away.
5. **ETH nobody sells for within 30 days** goes to an address fixed when the contract was deployed, so it can never be stuck.

Because the bid starts low and rises, sellers decide the price, and the bond pays about the market price. No price oracle, DEX or router is involved, so nothing can be manipulated, and it works for any token on any venue.

## The rules

- **Before the deadline only:** a bond can be posted while the milestone is open. The minimum is 0.001 ETH.
- **It can't be withdrawn.** Only the verdict releases it.
- **Anyone can apply the verdict** once it exists, and then each bonder takes back their own share.
- **No owner.** Nobody can pause it, change it or move the ETH.

## Honest limits

- **A team can sell its own tokens into its forfeited bond.** It gets ETH back at the market price, but the tokens it sells are burned. Breaking the promise still costs it the bond's value in tokens.
- **A broken promise doesn't make holders whole.** It gives them a buyer and a smaller supply. The size of the bond is the size of the protection, so a bond worth having is one that's large next to the team's raise.
- **Testnet only for now.** Before mainnet, KeptBond should have an outside audit.

## Contract

`src/KeptBond.sol` reads verdicts from KeptVaultV2 and changes nothing in it. It's tested with real verdicts through the vault:
- **`test/KeptBond.t.sol`:** kept, broken and partial verdicts, the bid curve, every rule, sweeping, re-entry, and a fuzz test that every wei posted ends with a bonder, a seller or the leftover address.
- **`test/fork/BondFork.t.sol`:** on a fork of the live testnet, it bonds ETH behind pledge #1001, lets the milestone break, and pays a holder for real $SCOUT.

**Deploy on the testnet** (about 0.002 testnet ETH):
```sh
cd scripts/testnet
node deploy-bond.mjs --dry-run
node deploy-bond.mjs
```
It writes `bond.json`. Put its address in `web/src/config.js` under `vibevibe.bond`, and every v2 pledge page shows its bond.
