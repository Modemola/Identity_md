// Answers the bot between alert passes, so a tap or a pasted token gets a reply in seconds
// rather than at the next pass. Long-polls Telegram for the given number of seconds, then exits.
//
//   node listen.mjs 175
//
// It shares .state.json with alerts.mjs; the workflow runs the two one after the other, never at
// the same time.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handleUpdate } from "./bot.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE = join(HERE, ".state.json");
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = process.env.TELEGRAM_API || "https://api.telegram.org";
const CHANNEL = ((c) => (c && !/^@|^-?\d+$/.test(c) ? `@${c}` : c))((process.env.TELEGRAM_CHANNEL || "").trim().replace(/^https?:\/\/t\.me\//, ""));
const seconds = Math.max(5, Number(process.argv[2]) || 175);
if (!TOKEN) process.exit(0);

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
state.offset ??= 0;
state.follows ??= {};
state.watch ??= {};
const save = () => writeFileSync(STATE, `${JSON.stringify(state, null, 2)}\n`);

async function tg(method, body) {
  const r = await fetch(`${API}/bot${TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) {
    const e = new Error(`telegram ${method}: ${j.description || r.status}`);
    e.retryAfter = j.parameters?.retry_after;
    throw e;
  }
  return j.result;
}

const end = Date.now() + seconds * 1000;
let answered = 0;
while (Date.now() < end - 2000) {
  // Telegram holds the request open until a message arrives or the timeout passes
  const wait = Math.min(25, Math.floor((end - Date.now()) / 1000) - 2);
  if (wait < 1) break;
  let updates = [];
  try {
    updates = await tg("getUpdates", { offset: state.offset, timeout: wait, allowed_updates: ["message", "callback_query"] });
  } catch (e) {
    console.error(`listen: ${e.message}`);
    await new Promise((ok) => setTimeout(ok, Math.min((e.retryAfter ?? 10) * 1000, Math.max(0, end - Date.now()))));
    continue;
  }
  for (const u of updates) {
    state.offset = u.update_id + 1;
    await handleUpdate(u, { tg, state, channel: CHANNEL }).catch((e) => console.error(`listen: reply failed: ${e.message}`));
    answered++;
    save();
  }
}
if (answered) console.log(`listen: answered ${answered} message${answered === 1 ? "" : "s"}`);
