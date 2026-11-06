# KEPT alerts on Telegram

Every 10 minutes, GitHub Actions runs `alerts.mjs`, which sends:

| when | what |
| --- | --- |
| a milestone is due in 7 days, then in 1 day | 📅 / ⏰ with the amount on the line |
| a deadline passes and the milestone is still unproven | ⚠️ how long is left before it burns |
| the swarm confirms a milestone | ✅ with the verdict card |
| the swarm says it isn't delivered yet | ❌ the team can still try again |
| a tranche is released, or burned | 🔓 / 🔥 (the burn comes with the verdict card) |
| someone creates a pledge | 🆕 with a one-tap link to follow it |

Everything goes to the public channel. People who follow a pledge also get its alerts in a private chat with the bot.

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
5. Send me the bot's username so I can turn on the **Get alerts on Telegram** button on pledge pages (`telegramBot` in `web/src/config.js`).

The first run starts from the current block, so it doesn't post old verdicts. Due-date alerts start with the next milestone that comes into range.

## Bot commands (in a private chat with the bot)

- `/follow 1`: alerts for pledge #1
- `/unfollow 1`: stop them
- `/list`: what you follow

A link like `t.me/keptalerts_bot?start=follow_1` follows a pledge in one tap. The pledge page and the 🆕 alerts use these links.

Replies to commands arrive at the next scheduled run, usually within 10 to 20 minutes, because the bot isn't running all the time. GitHub can delay scheduled runs at busy times. It also pauses them after 60 days without activity in the repo; a manual run turns them back on.

## Run it locally

```sh
cd scripts/alerts
npm install
node alerts.mjs --dry      # prints what it would send; sends and saves nothing
TELEGRAM_BOT_TOKEN=… TELEGRAM_CHANNEL=@keptalerts node alerts.mjs
```

`KEPT_CHAIN=1` watches the Ethereum vault once it is live. `KEPT_NOW=<unix time>` pretends it is another time, to test the due-date alerts.
