# KEPT verdict bot

Posts every settled milestone to X: the verdict card plus a short post.

- **Kept:** the stamp, the amount released, how many agents agreed, the team's record.
- **Broken:** the burn, the amount gone, the record.

The card is the same one the site serves at `/api/verdict?pledge=1&m=0`.

## Run it

```sh
cd scripts/verdict-bot
npm install
node bot.mjs                 # dry run: watches the vault, writes each post to out/
```

On its first run the bot starts from the current block, so it does not post old verdicts. To make cards for past ones, run `node bot.mjs --once --since 93300000`. They land in `out/` as a PNG and a text file you can post by hand.

The bot keeps what it has handled in `.state.json` and never posts the same milestone twice.

## Post to X

1. In the X developer portal, create an app with **Read and Write** permission.
2. Generate the API key and secret, and an access token and secret for the @keptonchainn account.
3. Export them, then start the bot with `--post`:

```sh
export X_API_KEY=...  X_API_SECRET=...  X_ACCESS_TOKEN=...  X_ACCESS_SECRET=...
node bot.mjs --post
```

Keep these keys out of the repo. `.env` and `.state.json` are already gitignored.

## Options

| flag | what it does |
| --- | --- |
| `--post` | post to X (without it, nothing leaves your machine) |
| `--once` | one pass, then exit; use with cron |
| `--every 60` | seconds between passes when watching (default 60) |
| `--since <block>` | start from this block on the first pass |
| `--chain 1` | KEPT's Ethereum vault, once it is live |

A cron line that checks every 5 minutes:

```
*/5 * * * * cd /path/to/Identity_md/scripts/verdict-bot && node bot.mjs --once --post >> bot.log 2>&1
```

## Notes

- The card uses IBM Plex Mono, bundled in `fonts/` under the SIL Open Font License (`fonts/OFL.txt`).
- `KEPT_RPC` and `KEPT_VAULT` override the Robinhood Chain RPC and vault. `KEPT_RPC_1` and `KEPT_VAULT_1` do the same for Ethereum.
