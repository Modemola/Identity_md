#!/usr/bin/env node
// KEPT alerts on Telegram: due dates, verdicts and new pledges, posted to a channel, plus private
// alerts for people who follow a pledge by messaging the bot.
//
//   node alerts.mjs            one pass (what GitHub Actions runs every 10 minutes)
//   node alerts.mjs --dry      print what would be sent; nothing is sent
//
// Environment:
//   TELEGRAM_BOT_TOKEN   from @BotFather
//   TELEGRAM_CHANNEL     the public channel, e.g. @keptalerts (the bot must be an admin there)
//   TELEGRAM_BOT_USERNAME the bot's username without @, for one-tap follow links (t.me/<bot>?start=follow_1)
//   KEPT_CHAIN           4663 (default) or 1
//
// What it sends:
//   - a milestone due in 7 days, and in 1 day
//   - a deadline passed with the milestone still unproven: the 3-day proof window is open
//   - every swarm verdict (delivered or not) and every release or burn, with the verdict card
//   - every new pledge
// Bot commands (in a private chat): /follow 1, /unfollow 1, /list, /start.
//
// What it has sent, and who follows what, is kept in .state.json, so nothing is sent twice.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { verdictCard } from "../../api/_lib/cards.mjs";
import { NETS, SITE, TOPIC, allVaultLogs, amount, lastVerdict, pledgeIds, readPledge, rpc, uint } from "../../api/_lib/vault.mjs";

const SCALED = 4; // KeptVault v2's ValueScaled: a number read on chain at the deadline
const pct = (bps) => Math.round(bps / 100);

const HERE = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes("--dry");
const CHAIN = process.env.KEPT_CHAIN || "4663";
const NET = NETS[CHAIN];
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL = process.env.TELEGRAM_CHANNEL;
const BOT = (process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "");
const API = process.env.TELEGRAM_API || "https://api.telegram.org"; // overridable for tests
const STATE = join(HERE, ".state.json");
const FONTS = ["IBMPlexMono-SemiBold.ttf", "IBMPlexMono-Regular.ttf"].map((f) => join(HERE, "../../api/_lib/fonts", f));
const DAY = 86_400;

if (!NET?.vault) die(`KEPT has no vault on chain ${CHAIN}.`);
if (!DRY && !TOKEN) die("TELEGRAM_BOT_TOKEN is not set (or run with --dry).");

function die(msg) {
  console.error(msg);
  process.exit(1);
}

// ------------------------------------------------------------------ state

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
state.block ??= null; // last block scanned for events
state.sent ??= {}; // alert key -> unix time sent
state.follows ??= {}; // chat id -> [pledge ids]
state.offset ??= 0; // Telegram getUpdates offset
// a dry run never writes: what it "sent" must still go out once the bot is live
const save = () => DRY || writeFileSync(STATE, `${JSON.stringify(state, null, 2)}\n`);

// ------------------------------------------------------------------ Telegram

async function tg(method, body) {
  if (DRY) return console.log(`[dry] ${method} ${JSON.stringify(body).slice(0, 400)}`);
  const isForm = body instanceof FormData;
  const r = await fetch(`${API}/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: isForm ? {} : { "content-type": "application/json" },
    body: isForm ? body : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(`telegram ${method}: ${j.description || r.status}`);
  return j.result;
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
/** One tap from the channel: opens the bot, which follows the pledge. */
const followLink = (id) => (BOT ? `<a href="https://t.me/${BOT}?start=follow_${id}">Get alerts for this pledge</a>` : `Alerts for this pledge: message the bot /follow ${id}`);
// /p/ share links: Telegram shows the pledge's live record card under the alert
const link = (id) => `https://${SITE}/p/${id}${CHAIN === "1" ? "?chain=1" : ""}`;

/** Sends to the channel and to everyone following this pledge. */
async function broadcast(pledgeId, html, png) {
  const chats = [CHANNEL, ...Object.keys(state.follows).filter((c) => state.follows[c].includes(pledgeId))].filter(Boolean);
  for (const chat_id of chats) {
    try {
      if (png) {
        const form = new FormData();
        form.append("chat_id", String(chat_id));
        form.append("caption", html);
        form.append("parse_mode", "HTML");
        form.append("photo", new Blob([png], { type: "image/png" }), "verdict.png");
        await tg("sendPhoto", DRY ? { chat_id, caption: html, photo: `${png.length} bytes` } : form);
      } else {
        await tg("sendMessage", { chat_id, text: html, parse_mode: "HTML", link_preview_options: { prefer_large_media: true } });
      }
    } catch (e) {
      console.error(`could not send to ${chat_id}: ${e.message}`);
      // someone who blocked the bot is dropped, so one dead chat never stalls the rest
      if (/blocked|chat not found|deactivated/i.test(e.message) && chat_id !== CHANNEL) delete state.follows[chat_id];
    }
  }
}

const render = (svg) => new Resvg(svg, { fitTo: { mode: "width", value: 1200 }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "IBM Plex Mono" } }).render().asPng();

// ------------------------------------------------------------------ commands

async function commands(pledgeIds) {
  if (DRY) return;
  const updates = await tg("getUpdates", { offset: state.offset, timeout: 0, allowed_updates: ["message"] });
  for (const u of updates) {
    state.offset = u.update_id + 1;
    const msg = u.message;
    if (!msg?.text || msg.chat?.type !== "private") continue;
    const chat = String(msg.chat.id);
    let [cmd, arg] = msg.text.trim().split(/\s+/);
    // a t.me/<bot>?start=follow_1 link arrives as "/start follow_1"
    if (/^\/start/.test(cmd) && /^follow_\d+$/.test(arg || "")) [cmd, arg] = ["/follow", arg.slice(7)];
    const id = Number(arg);
    const mine = (state.follows[chat] ??= []);
    let reply;
    if (/^\/follow/.test(cmd)) {
      if (!pledgeIds.includes(id)) reply = `There is no pledge #${esc(arg ?? "")}. Try /follow 1.`;
      else {
        if (!mine.includes(id)) mine.push(id);
        reply = `Following pledge #${id}. You'll get its due dates, verdicts and burns here.\n${link(id)}`;
      }
    } else if (/^\/unfollow/.test(cmd)) {
      state.follows[chat] = mine.filter((x) => x !== id);
      reply = `Stopped following pledge #${esc(arg ?? "")}.`;
    } else if (/^\/list/.test(cmd)) {
      reply = mine.length ? `You follow: ${mine.map((x) => `#${x}`).join(", ")}` : "You don't follow any pledge yet. Try /follow 1.";
    } else {
      reply = [
        "<b>KEPT alerts</b>: teams lock tokens behind milestones, the IMD swarm checks each one. Kept tranches unlock, missed ones burn.",
        "",
        "/follow 1: alerts for pledge #1 (due dates, verdicts, burns)",
        "/unfollow 1: stop them",
        "/list: what you follow",
        "",
        `Every pledge: https://${SITE}/#/board`,
      ].join("\n");
    }
    if (!state.follows[chat]?.length) delete state.follows[chat];
    await tg("sendMessage", { chat_id: msg.chat.id, text: reply, parse_mode: "HTML", link_preview_options: { is_disabled: true } }).catch((e) => console.error(e.message));
  }
}

// ------------------------------------------------------------------ due dates

const span = (s) => (s >= DAY ? `${Math.round(s / DAY)} day${Math.round(s / DAY) === 1 ? "" : "s"}` : `${Math.max(1, Math.round(s / 3600))} hours`);

async function dueAlerts(pledges, now, grace) {
  for (const p of pledges) {
    for (const m of p.milestones) {
      if (m.outcome !== 0) continue;
      const left = m.deadline - now;
      const at = `${amount(m.amount, p.decimals)} $${p.symbol}`;
      const head = `<b>${esc(p.name)}</b> · milestone ${m.index + 1}: ${esc(m.title)}`;
      const key = (k) => `${k}:${p.id}:${m.index}`;
      let msg = null;
      if (left > 0 && left <= DAY && !state.sent[key("due1")]) {
        msg =
          m.kind === SCALED
            ? `⏰ Due in ${span(left)}\n${head}\nAt the deadline the swarm reads the number on chain: the share of the target reached unlocks from ${at}, the rest burns.\n${link(p.id)}`
            : `⏰ Due in ${span(left)}\n${head}\n${at} unlocks if the swarm confirms it${m.checkBy > m.deadline ? "" : " before the deadline, when checks close"}. Otherwise it burns.\n${link(p.id)}`;
        state.sent[key("due1")] = state.sent[key("due7")] = now;
      } else if (left > DAY && left <= 7 * DAY && !state.sent[key("due7")]) {
        msg = `📅 Due in ${span(left)}\n${head}\n${at} on the line.\n${link(p.id)}`;
        state.sent[key("due7")] = now;
      } else if (left <= 0 && -left < grace && !state.sent[key("window")]) {
        // whether checks are still open comes from the vault itself (v1: only releases; v2: all but pages)
        msg =
          now <= m.checkBy
            ? `⚠️ Deadline passed, not proven yet\n${head}\nThe team has ${span(m.checkBy - now)} to ask the swarm, or ${at} burns.\n${link(p.id)}`
            : `⚠️ Deadline passed, not proven\n${head}\nChecks are closed. Unless a check already asked confirms it, ${at} burns in ${span(grace + left)}.\n${link(p.id)}`;
        state.sent[key("due1")] = state.sent[key("due7")] = state.sent[key("window")] = now;
      }
      if (msg) {
        console.log(`due alert: pledge #${p.id} milestone ${m.index + 1}`);
        await broadcast(p.id, msg);
        save();
      }
    }
  }
}

// ------------------------------------------------------------------ events

async function eventAlerts(byId, from, to) {
  // one after another: kinder to public RPCs than all at once. Every vault on the chain (v1, v2).
  const kinds = [["verdict", TOPIC.verdict], ["settled", TOPIC.settled], ["created", TOPIC.created], ["scored", TOPIC.scored], ["appealed", TOPIC.appealed]];
  const all = [];
  for (const [kind, topic] of kinds) all.push(...(await allVaultLogs(NET, [topic], { from, to })).logs.map((l) => ({ l, kind })));
  all.sort((a, b) => Number(BigInt(a.l.blockNumber) - BigInt(b.l.blockNumber)) || Number(BigInt(a.l.logIndex) - BigInt(b.l.logIndex)));

  for (const { l, kind } of all) {
    const id = Number(BigInt(l.topics[1]));
    const key = `${kind}:${l.transactionHash}:${Number(BigInt(l.logIndex))}`;
    if (state.sent[key]) continue;
    const p = byId.get(id) ?? (await readPledge(NET, id));
    if (!p) continue;
    if (kind === "created") {
      const total = p.milestones.reduce((x, m) => x + m.amount, 0n);
      await broadcast(id, `🆕 New pledge #${id}: <b>${esc(p.name)}</b>\n${amount(total, p.decimals)} $${p.symbol} locked behind ${p.count} milestone${p.count === 1 ? "" : "s"}. The IMD swarm checks each one.\n${link(id)}\n${followLink(id)}`);
    } else {
      const index = Number(BigInt(l.topics[2]));
      const m = p.milestones[index];
      const head = `<b>${esc(p.name)}</b> · milestone ${index + 1}: ${esc(m.title)}`;
      const d = l.data.slice(2);
      if (kind === "scored") {
        // v2 partial credit: the number at the deadline and the share it earned
        const share = Number(uint(d, 1));
        const m2 = { ...m, outcome: share >= 10_000 ? 1 : share === 0 ? 2 : 3, shareBps: share };
        const p2 = { ...p, milestones: p.milestones.map((x, i) => (i === index ? m2 : x)) };
        const png = render(verdictCard(p2, index, null));
        const paid = (m.amount * BigInt(share)) / 10_000n;
        await broadcast(
          id,
          share >= 10_000
            ? `✅ KEPT: 100% of the target, measured on chain\n${head}\n${amount(m.amount, p.decimals)} $${p.symbol} unlocks to the team.\n${link(id)}`
            : share === 0
              ? `🔥 Nothing above the floor, measured on chain\n${head}\n${amount(m.amount, p.decimals)} $${p.symbol} burns.\n${link(id)}`
              : `🟡 PARTLY KEPT: ${pct(share)}% of the target, measured on chain\n${head}\n${amount(paid, p.decimals)} $${p.symbol} unlocks to the team. ${amount(m.amount - paid, p.decimals)} burns.\n${link(id)}`,
          png,
        );
      } else if (kind === "appealed") {
        await broadcast(id, `⚖️ Appeal\n${head}\nThe team asked again after a "not delivered". A 15-agent panel decides, and 11 must agree. This answer is final.\n${link(id)}`);
      } else if (kind === "verdict" && m.kind === SCALED) {
        // a scaled milestone's verdict is reported by its "scored" event, with the share
      } else if (kind === "verdict") {
        const kept = uint(d, 0) === 1n;
        const agreed = Number(uint(d, 1));
        const panel = Number(uint(d, 3));
        if (kept) {
          const png = render(verdictCard(p, index, { kept, agreed, panelSize: panel }));
          await broadcast(id, `✅ KEPT: the swarm confirmed it\n${head}\n${agreed} of ${panel} agents agreed. ${amount(m.amount, p.decimals)} $${p.symbol} unlocks to the team.\n${link(id)}`, png);
        } else {
          await broadcast(id, `❌ Not delivered yet, says the swarm\n${head}\n${agreed} of ${panel} agents agreed it isn't there. The team can try again before the deadline.\n${link(id)}`);
        }
      } else {
        const outcome = Number(uint(d, 0));
        if (outcome === 3) {
          const paid = BigInt(`0x${d.slice(128, 192)}`);
          await broadcast(id, `🔓 ${pct(m.shareBps)}% released\n${head}\n${amount(paid, p.decimals)} $${p.symbol} sent to the team; ${amount(m.amount - paid, p.decimals)} burned.\n${link(id)}`);
        } else if (outcome === 2) {
          const v = await lastVerdict(NET, id, index);
          const png = render(verdictCard(p, index, v));
          await broadcast(id, `🔥 BURNED\n${head}\nNot proven in time. ${amount(m.amount, p.decimals)} $${p.symbol} is gone for good.\n${link(id)}`, png);
        } else {
          await broadcast(id, `🔓 Released\n${head}\n${amount(m.amount, p.decimals)} $${p.symbol} sent to the team.\n${link(id)}`);
        }
      }
    }
    console.log(`event alert: ${kind} pledge #${id}`);
    state.sent[key] = Math.floor(Date.now() / 1000);
    save();
  }
}

// ------------------------------------------------------------------ main

const latest = Number(await rpc(NET, "eth_blockNumber", []));
const block = await rpc(NET, "eth_getBlockByNumber", ["latest", false]);
// KEPT_NOW pretends it is another time, for testing the due-date alerts
const now = Number(process.env.KEPT_NOW || BigInt(block.timestamp));
const grace = 3 * DAY;
const pledges = [];
for (const id of await pledgeIds(NET)) pledges.push(await readPledge(NET, id));
const byId = new Map(pledges.map((p) => [p.id, p]));

await commands(pledges.map((p) => p.id));
// the first run starts at the current block: no flood of old verdicts
const from = state.block == null ? latest : state.block + 1;
if (from <= latest) await eventAlerts(byId, from, latest);
state.block = latest;
// re-read after the events above: a verdict that just landed must not be followed by a "due" ping
const fresh = [];
for (const id of await pledgeIds(NET)) fresh.push(await readPledge(NET, id));
await dueAlerts(fresh, now, grace);
// forget sent keys older than 90 days, so the state stays small
for (const [k, t] of Object.entries(state.sent)) if (now - t > 90 * DAY) delete state.sent[k];
save();
console.log(`${new Date().toISOString()} block ${latest}: ${pledges.length} pledges checked, ${Object.keys(state.follows).length} followers`);
