# KEPT records: who is behind a token

Bad actors never lock tokens behind promises. So KEPT also keeps a record of every launcher, whether they opt in or not: what the wallet behind a token did with every launch before this one.

The record covers two launchpads:
- **every vibe/vibe launch** on Robinhood Chain testnet, on both of vibe/vibe's factories
- **every IMD launch on Robinhood Chain mainnet** that names a launcher wallet (below)

Open https://keptmd.vercel.app, paste a token, a wallet or a launch number, and press Check. A launch number can name a launch on both; the site shows the one for the network you're on first, and lists the others.

Every record also shows **who holds the token right now**, read live: the launcher, the launch pool or curve, burned, and everyone else. A launcher with a record of selling fast, still holding a big share, is the plainest warning a buyer can get.

## What the record shows

Facts read from vibe/vibe's public event logs, per launch:

| fact | from |
| --- | --- |
| who launched it | the factory's `Launched` event (`creator`) |
| whether it graduated | the pool's `Graduated` event |
| how many buys and how much buyers put in | the pool's `LaunchBuy` and `Buy` events, excluding the launcher |
| what the launcher bought and sold on its own curve | the same events where the buyer or seller is the launcher |
| how soon after launch the launcher first sold | the launcher's first `Sell`, timed from the launch block |

Per launcher, these add up to:
- launches and how many graduated
- how many launches it sold into, and how many within an hour of launching
- ETH in and ETH out on its own launches, and what buyers put in

Amounts are summed for ETH-paired launches only. Launches paired with another token are counted, but their amounts aren't added to ETH.

## IMD launches on Robinhood Chain (mainnet)

IMD's own launch factory deploys every IMD token, so the deployer says nothing about who's behind it. The requester instead names a wallet in the launch's `launch.json`: `economics.remainderTo`. That wallet receives the supply left after the pool seed and the swarm's 10%. KEPT treats it as the launcher and follows every transfer of the token out of it:

| transfer | counted as |
| --- | --- |
| into the Uniswap v4 PoolManager, in a transaction that swaps | a **sale into its own pool** |
| into the PoolManager, in a transaction that only adds liquidity | **liquidity added** (not a sale) |
| to `0x…dEaD` or the zero address | burned |
| to any other wallet | **moved**: shown, since that wallet may sell instead |

Hook and project launches that name no remainder wallet have no launcher, so they're left out. `scripts/records/imd.mjs` builds this index hourly, beside the vibe/vibe one.

## Funding: one owner, many wallets

A launcher can start a fresh wallet, but it has to put ETH in it. For vibe/vibe launchers, each record shows where a wallet's **biggest early deposit** came from (of its first ten incoming transfers), read live from the testnet explorer:

| source | what it says |
| --- | --- |
| the testnet faucet | nothing: it funds everyone |
| the wallet's own deposit from Ethereum | nothing about another wallet. Arbitrum chains show a deposit as coming from the sender's address shifted by `0x1111…1111`, so a wallet funding itself looks like a different sender; KEPT recognises it |
| a contract, such as a swap paying out | nothing about a person |
| **another wallet** | **a link**: KEPT lists every other launcher that wallet funded, with their records |

When the funding wallet is an Ethereum account's deposit address, the record names the account too. The first such cluster found: one Ethereum account bridged ETH to itself and four fresh wallets, and all five are red launchers, with 359 launches and 160 sold into within an hour.

Looking up a wallet that launched nothing but funded launchers shows those launchers as its record. A funder that sent ETH to more than 200 wallets is treated as a service, such as an exchange, and links no one. Mainnet funding needs an explorer key, so IMD records don't show it yet.

## The colour of a record

The colour is a rule, not an opinion. Anyone can check it against the numbers on the page:

| colour | rule |
| --- | --- |
| **red**: "Sells into its own launches fast" | the launcher sold into its own launch within 60 minutes of launching, on at least 2 launches or at least a quarter of them (or its only launch) |
| **amber**: "Has sold into its own launches" | it sold into at least one of its own launches, but not that fast that often |
| **green**: "No sells into its own launches" | it never sold into its own launches, across two launches or more |
| **grey**: "First launch, no sells yet" | its only launch, with no sells so far: no history to go on yet |

KEPT doesn't call anyone a scammer. The record states what the chain shows, and the page says so.

**A green record isn't a promise.** A launcher can use a fresh wallet. Teams that want to prove themselves lock tokens behind milestones on KEPT, and those pledges show on their record.

## For launch pages and apps

**Badge**, 20 px, in the record's colour:
```html
<img src="https://keptmd.vercel.app/api/record?q=0x…&format=svg" alt="KEPT record">
```

**JSON**, at `https://keptmd.vercel.app/api/record?q=…`. The `q` can be a token, a wallet or a vibe/vibe launch number. The response includes:
- `launcher`: the summary, the facts as sentences, the colour, and the newest 50 launches in full
- `matches`: the launches the query named. A launch number can exist on both factories; the current factory comes first.
- `kept`: the wallet's KEPT pledges and score, on every network
- `rule`: the colour rule, in words

**Totals and the fastest exits**: `https://keptmd.vercel.app/api/record?view=top`.

## How it stays current

`scripts/records/indexer.mjs` reads new launches, trades and graduations from both factories, in as few RPC calls as the testnet allows. A GitHub Action (`.github/workflows/records.yml`) runs it every hour and publishes small JSON files to the repo's `data` branch:
- `creators/xx.json`: launcher records, split by address
- `tokens/xx.json`: token to launch
- `ids/f-n.json`: launch number to token
- `meta.json`: totals, block times and the ranking

GitHub's scheduler drops most runs of an hourly schedule, so one run of the job loops for about five and a half hours, one pass an hour, then starts the next run itself. The daily health job restarts the chain if it stops and opens an issue labelled `kept-health`. Every record shows when it was last updated, and `/api/health` gives the age of each source.

The API reads one small file per lookup. Vercel ignores the `data` branch, so the hourly update never triggers a deploy.

To run it yourself:
```sh
node scripts/records/indexer.mjs ./records-data
```
The first run reads every launch since vibe/vibe began and takes about half an hour. Later runs read only the new blocks.
