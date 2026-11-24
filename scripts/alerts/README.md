# KEPT alerts on Telegram

Every 3 minutes, GitHub Actions runs `alerts.mjs`, which sends:

| when | what |
| --- | --- |
| a milestone is due in 7 days, then in 1 day | 📅 / ⏰ with the amount on the line |
| a deadline passes and the milestone is still unproven | ⚠️ how long is left before it burns |
| the swarm confirms a milestone | ✅ with the verdict card |
| the swarm says it isn't delivered yet | ❌ the team can still try again |
| a tranche is released, or burned | 🔓 / 🔥 (the burn comes with the verdict card) |
| someone creates a pledge | 🆕 with a one-tap link to follow it |
| a launcher with a red record launches again on vibe/vibe | ⚠️ to the channel, with its record (at most once per wallet every 6 hours) |
| a wallet with no red record launches on vibe/vibe, and the wallet that funded it also funded launchers with a red record | ⚠️ to the channel: the funder and what its red launchers did (at most once per funder every 6 hours) |
| a watched launcher launches again | 🚀 to its watchers, with its record |
| a watched launcher sells into one of its own launches | 🔻 to its watchers: which token, how soon after launching, and the ETH it took out |
| an IMD launcher on Robinhood Chain sells into its own launch's pool | 🔻 to the channel and its watchers: how much of its share, and how soon after launch (adding liquidity stays quiet) |
| a watched IMD launcher moves its share to another wallet | ↪️ to its watchers: that wallet may sell instead |
| a watched wallet is the launcher of a new IMD launch | 🚀 to its watchers |
| a new IMD launch whose launcher has a red record, or whose money ties it to IMD launchers with one (a quarter or more of its funding group) | ⚠️ to the channel, at most once per launcher or group every 6 hours. Funding needs `BLOCKSCOUT_API_KEY` as an Actions secret |
| Monday, from 09:00 UTC | 📊 the weekly Exits report card to the channel, once a week |

Pledge alerts and red launcher warnings go to the public channel. People who follow a pledge or watch a launcher get those alerts in a private chat with the bot.

Launcher alerts read vibe/vibe's public logs on Robinhood Chain testnet and KEPT's launcher records (`docs/RECORDS.md`). A sell is only reported when it's into one of the wallet's own launches, so ordinary trading stays quiet.

Telegram's API is free and GitHub Actions is free for this, so nothing here costs money.

## Set it up (about 10 minutes, all doable from a phone)

1. **Create the bot.**
   - In Telegram, open **@BotFather** and send `/newbot`.
   - Name it `KEPT alerts`, and give it a username ending in `bot`, e.g. `keptalerts_bot`.
   - BotFather replies with a **token**. Keep it private: anyone with it controls the bot.
2. **Create the channel.**
   - New Channel, name `KEPT alerts`, make it public with a link such as `t.me/keptalerts`.
   - Open its settings, then Administrators, then Add Admin, and add your bot. It only needs **Post messages**.
3. **Give GitHub the settings.** In the repo, go to **Settings > Secrets and variables > Actions**.
   - On the **Secrets** tab, add a new repository secret named `TELEGRAM_BOT_TOKEN` and paste the token.
   - On the **Variables** tab, add a new repository variable named `TELEGRAM_CHANNEL` with the value `@keptalerts` (your channel's @name).
   - Also on the **Variables** tab, add `TELEGRAM_BOT_USERNAME` with the value `keptalerts_bot` (your bot's username, without the @).
4. **Run it once by hand:** **Actions > KEPT alerts > Run workflow**. The log ends with `N pledges checked`.
5. Send me the bot's username so I can turn on the **Get alerts on Telegram** button on pledge pages and the **Watch on Telegram** button on records (`telegramBot` in `web/src/config.js`).

The first run starts from the current block, so it doesn't post old verdicts. Due-date alerts start with the next milestone that comes into range.

## The bot (in a private chat with `@kept_alerts_bot`)

`/start` opens a menu of buttons: **Check a token**, **Watchlist**, **Fastest exits**, **Funding groups**, **This week**, **Pledge alerts**, the site and the channel. Telegram's **Menu** button beside the message box lists the commands.

- **Paste a token, a wallet or a launch number** with no command and you get its record as a card: the verdict, the numbers, why, red money, its funding group and who holds the supply, with **Watch** and **Full record** buttons.
- `/check 0x…` or `/check 7836`: the same, as a command
- `/watch 0x…` or `/watch 2288`: alerts when that launcher sells into its own launch, moves its share, or launches again, on vibe/vibe or IMD (up to 25 per chat). `/unwatch 0x…` stops them.
- `/follow 1`: alerts for pledge #1. `/unfollow 1` stops them.
- `/list`: your watchlist, with a ✖ to stop each one
- `/top`, `/groups`, `/report`: the fastest exits, the funding groups, this week's Exits report

A link like `t.me/kept_alerts_bot?start=follow_1` follows a pledge in one tap, and `?start=watch_0x…` watches a launcher. Pledge pages, record pages and the 🆕 alerts use these links. The conversation is in `bot.mjs`.

**Replies come within seconds.** Between alert passes, `listen.mjs` long-polls the bot for about three minutes instead of sleeping. GitHub's scheduler drops most runs of frequent schedules, so once the bot token is set, one run loops for about five and a half hours and then starts the next one itself; a schedule every two hours and the health job every six hours (`.github/workflows/health.yml`) restart the chain if it ever stops, and the health job opens an issue labelled `kept-health` when it does.

**One bot, one program.** Telegram blocks a bot that two programs read at once ("Too Many Requests" on every call). Use the token in this repository only; the job logs which bot its token belongs to every six hours.

## Run it locally

```sh
cd scripts/alerts
npm install
node alerts.mjs --dry      # prints what it would send; sends and saves nothing
TELEGRAM_BOT_TOKEN=… TELEGRAM_CHANNEL=@keptalerts node alerts.mjs
```

`KEPT_CHAIN=1` watches the Ethereum vault once it is live. `KEPT_NOW=<unix time>` pretends it is another time, to test the due-date alerts.
