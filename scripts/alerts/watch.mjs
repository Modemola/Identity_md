// Launcher alerts for the KEPT bot: follow the wallet behind a vibe/vibe token and hear when it
// sells into its own launch or launches again; the channel hears when a launcher with a red record
// launches. Reads vibe/vibe's public logs on Robinhood Chain testnet and KEPT's launcher records.
//
// Used by alerts.mjs, which owns the bot's messages: two readers of one bot would steal each
// other's commands.

import { launcher, findLaunches, fmtEth, findImd, imdLauncher } from "../../api/_lib/records.mjs";
import { SITE } from "../../api/_lib/vault.mjs";
import { fundingOf, redLink } from "../../api/_lib/funding.mjs";

const RPC = process.env.KEPT_TESTNET_RPC || "https://rpc.testnet.chain.robinhood.com";
const FACTORIES = ["0xac135da186de8325047ef2afd1d16d5971f731f7", "0xe794217880011f9ca6961340ed5c16ec9559fea0"];
const LAUNCHED = "0xa7e8032bfd07a9fbcde50eabe91eb2901faee6dbddd9cced579491d9b07ef5c8";
const SELL = "0x3899b2b9ba4dfe77b54ff5e6f921672b2a7563ade468f2a106b25a4b808d60de";
const SECONDS_PER_BLOCK = 0.19; // only to size the week of launches kept in memory
/** At most this many wallets per chat, so one chat can't make every pass slow. */
export const MAX_WATCH = 25;
/** The channel posts a red launcher's new launch at most once per wallet in this window. */
const CHANNEL_QUIET = 6 * 3600;
/** After a long outage, read at most this many blocks back (about 1.5 hours), not the whole gap. */
const MAX_GAP = 30_000;
/** Funding lookups (two explorer calls each) per pass, for launchers without a red record. */
const MAX_FUNDING_CHECKS = 15;

async function rpc(method, params) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((ok) => setTimeout(ok, 500 * 2 ** attempt));
    }
  }
}
const hex = (n) => `0x${n.toString(16)}`;
const pad = (a) => `0x${a.slice(2).toLowerCase().padStart(64, "0")}`;
const addrOf = (t) => `0x${t.slice(-40)}`.toLowerCase();
const word = (data, i) => BigInt(`0x${data.slice(2 + i * 64, 66 + i * 64)}`);
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
// the share link: Telegram previews it as the record's own card
const recordLink = (q) => `https://${SITE}/c/${q}`;
const ago = (s) => {
  if (s < 60) return "under a minute";
  const [n, unit] = s < 5400 ? [Math.round(s / 60), "minute"] : s < 172800 ? [Math.round(s / 3600), "hour"] : [Math.round(s / 86400), "day"];
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
};
const blockTimes = new Map();
/** A block's timestamp, read once per pass. */
async function timeOf(block) {
  if (!blockTimes.has(block)) blockTimes.set(block, parseInt((await rpc("eth_getBlockByNumber", [hex(block), false])).timestamp, 16));
  return blockTimes.get(block);
}

function abiString(data, offset) {
  try {
    const at = 2 + Number(offset) * 2;
    const len = Math.min(64, parseInt(data.slice(at, at + 64), 16));
    return Buffer.from(data.slice(at + 64, at + 64 + len * 2), "hex").toString("utf8").replace(/[\u0000-\u001f]/g, "").trim();
  } catch {
    return "";
  }
}

/** One line about a launcher, or a note that it has no record yet. */
export function recordLine(rec) {
  if (!rec) return "No launches on record yet.";
  const s = rec.summary;
  const tone = { exits: "🔴", sold: "🟠", clean: "🟢", new: "⚪" }[rec.tone];
  return `${tone} ${s.launches} launch${s.launches === 1 ? "" : "es"} · ${s.graduated} graduated · sold into ${s.fastExits} within an hour of launching`;
}

/**
 * The wallet a query names: a token's or launch's launcher, or the wallet itself. An IMD launch on
 * mainnet comes first when a number names launches on both, as /check does: real money first.
 */
export async function resolve(q) {
  const raw = String(q || "").trim().replace(/^#/, "");
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw) && !/^\d{1,7}$/.test(raw)) return null;
  const imd = (await findImd(raw).catch(() => []))[0];
  if (imd?.creator) return { wallet: imd.creator, via: { ...imd, source: "imd" } };
  const found = await findLaunches(raw);
  if (found.length) return { wallet: found[0].creator, via: { ...found[0], source: "vibevibe" } };
  return /^0x/.test(raw) ? { wallet: raw.toLowerCase(), via: null } : null;
}

/** One line for a wallet's IMD record. */
function imdLine(rec) {
  const tone = { exits: "🔴", sold: "🟠", clean: "🟢", new: "⚪" }[rec.tone];
  const s = rec.summary;
  return `${tone} ${s.launches} IMD launch${s.launches === 1 ? "" : "es"} on Robinhood Chain · sold into its own pool on ${s.sold} · within an hour on ${s.fastExits}`;
}

/**
 * Bot commands for launchers. Returns the reply, or null when the command isn't one of these.
 * `state.watch` maps a chat id to the wallets it watches.
 */
export async function watchCommand(cmd, arg, chat, state) {
  const mine = (state.watch[chat] ??= []);
  const done = (reply) => {
    if (!state.watch[chat]?.length) delete state.watch[chat];
    return reply;
  };
  if (/^\/check/.test(cmd)) {
    // an IMD launch on Robinhood mainnet: the record of the wallet that got the team's share
    const imd = (await findImd(String(arg || "")).catch(() => []))[0];
    const imdRec = imd ? await imdLauncher(imd.creator).catch(() => null) : /^0x[0-9a-fA-F]{40}$/.test(arg || "") ? await imdLauncher(arg).catch(() => null) : null;
    if (imdRec && (imd || !(await findLaunches(arg).catch(() => [])).length)) {
      const tone = { exits: "🔴", sold: "🟠", clean: "🟢", new: "⚪" }[imdRec.tone];
      const s = imdRec.summary;
      return done(`IMD on Robinhood Chain${imd ? `, launch #${imd.id}` : ""}: launcher <code>${imdRec.address}</code>\n${tone} ${s.launches} IMD launch${s.launches === 1 ? "" : "es"} · sold into its own pool on ${s.sold} · within an hour on ${s.fastExits}\n${imdRec.facts.slice(0, 3).map((f) => `· ${esc(f.text)}`).join("\n")}\n${recordLink(arg)}`);
    }
    const r = await resolve(arg);
    if (!r) return done("Send a token, a wallet or a launch number: /check 0x… or /check 7836");
    const rec = await launcher(r.wallet);
    const head = r.via ? `Launch #${r.via.id}, launched by <code>${r.wallet}</code>` : `<code>${r.wallet}</code>`;
    return done(`${head}\n${recordLine(rec)}\n${rec ? rec.facts.slice(0, 3).map((f) => `· ${esc(f.text)}`).join("\n") : ""}\n${recordLink(arg)}\n\nWatch this wallet: /watch ${r.wallet}`);
  }
  if (/^\/watch/.test(cmd)) {
    const r = await resolve(arg);
    if (!r) return done("Send a token, a wallet or a launch number: /watch 0x… or /watch 2288");
    if (!mine.includes(r.wallet)) {
      if (mine.length >= MAX_WATCH) return done(`You watch ${MAX_WATCH} wallets already. Drop one with /unwatch first.`);
      mine.push(r.wallet);
    }
    const [rec, irec] = await Promise.all([launcher(r.wallet).catch(() => null), imdLauncher(r.wallet).catch(() => null)]);
    const lines = [irec ? imdLine(irec) : null, rec || !irec ? `vibe/vibe: ${recordLine(rec)}` : null].filter(Boolean).join("\n");
    const where = r.via ? `, the launcher behind ${r.via.source === "imd" ? "IMD" : "vibe/vibe"} launch #${r.via.id}` : "";
    return done(
      `👁 Watching <code>${r.wallet}</code>${where}.\n${lines}\n\nYou'll hear when it sells into one of its own launches${irec ? ", moves its share to another wallet," : ""} or launches again.\n${recordLink(r.wallet)}`,
    );
  }
  if (/^\/unwatch/.test(cmd)) {
    const r = await resolve(arg);
    const w = r?.wallet ?? String(arg || "").toLowerCase();
    state.watch[chat] = mine.filter((x) => x !== w);
    return done(`Stopped watching <code>${esc(w)}</code>.`);
  }
  return null;
}

/** The wallets a chat watches, for /list. */
export const watchedBy = (state, chat) => state.watch[chat] ?? [];

/**
 * One pass: new launches and launchers' sells since the last pass. `send(chat, html)` delivers;
 * `channel` is the public channel, or empty.
 */
export async function watchPass({ state, send, channel, save }) {
  const vv = (state.vv ??= { block: null, pools: {}, posted: {} });
  vv.funders ??= {}; // launcher -> red-linked funder, or "" when checked and not linked
  let checks = 0;
  const head = parseInt(await rpc("eth_blockNumber", []), 16);
  // the first pass starts now: no flood of old launches
  let from = vv.block == null ? head : vv.block + 1;
  if (head - from > MAX_GAP) from = head - MAX_GAP;
  if (from > head) return { launches: 0, sells: 0 };
  const watchers = new Map();
  for (const [chat, wallets] of Object.entries(state.watch)) for (const w of wallets) watchers.set(w, [...(watchers.get(w) ?? []), chat]);
  const records = new Map();
  const recordOf = async (w) => {
    if (!records.has(w)) records.set(w, await launcher(w).catch(() => null));
    return records.get(w);
  };
  const now = Math.floor(Date.now() / 1000);

  // 1. new launches
  const launched = [];
  for (const f of FACTORIES) launched.push(...(await rpc("eth_getLogs", [{ address: f, topics: [LAUNCHED], fromBlock: hex(from), toBlock: hex(head) }])));
  launched.sort((a, b) => parseInt(a.blockNumber, 16) - parseInt(b.blockNumber, 16));
  for (const l of launched) {
    const creator = addrOf(l.topics[2]);
    const token = addrOf(l.topics[3]);
    const pool = `0x${l.data.slice(26, 66)}`.toLowerCase();
    const symbol = abiString(l.data, word(l.data, 2)) || "?";
    const id = Number(BigInt(l.topics[1]));
    const block = parseInt(l.blockNumber, 16);
    vv.pools[pool] = { creator, token, symbol, id, block, eth: word(l.data, 4) === 0n };
    const rec = await recordOf(creator);
    for (const chat of watchers.get(creator) ?? []) {
      await send(chat, `🚀 <code>${short(creator)}</code> launched again: <b>$${esc(symbol)}</b> (launch #${id})\n${recordLine(rec)}\n${recordLink(token)}`);
    }
    // the channel: a launcher with a red record, at most once per wallet every few hours
    if (channel && rec?.tone === "exits" && now - (vv.posted[creator] ?? 0) > CHANNEL_QUIET) {
      const s = rec.summary;
      await send(
        channel,
        `⚠️ <b>$${esc(symbol)}</b> just launched on vibe/vibe (#${id})\nIts launcher <code>${short(creator)}</code> sold into its own launch within an hour on <b>${s.fastExits} of ${s.launches}</b> launches before this one.\nCheck before you buy: ${recordLink(token)}`,
      );
      vv.posted[creator] = now;
    } else if (channel && rec?.tone !== "exits" && checks < MAX_FUNDING_CHECKS && !(creator in vv.funders)) {
      // a fresh wallet: its own record is clean, but its ETH may come from the wallet behind red ones
      checks++;
      const k = redLink(await fundingOf(creator).catch(() => null));
      vv.funders[creator] = k ? k.funder : "";
      if (k && now - (vv.posted[k.funder] ?? 0) > CHANNEL_QUIET) {
        await send(
          channel,
          `⚠️ <b>$${esc(symbol)}</b> just launched on vibe/vibe (#${id}) from ${rec ? "a wallet with no red record" : "a fresh wallet"}
Its ETH came from <code>${short(k.funder)}</code>, which also funded <b>${k.red}</b> launcher${k.red === 1 ? "" : "s"} with a red record: ${k.red === 1 ? "it" : "they"} sold into ${k.fastExits} of ${k.launches} launches within an hour.
Check before you buy: ${recordLink(token)}`,
        );
        vv.posted[k.funder] = now;
      }
    }
  }

  // 2. sells by watched wallets into their own launches
  let sells = 0;
  for (const [w, chats] of watchers) {
    const logs = await rpc("eth_getLogs", [{ topics: [SELL, null, pad(w)], fromBlock: hex(from), toBlock: hex(head) }]);
    if (!logs.length) continue;
    const rec = await recordOf(w);
    const own = new Map((rec?.launches ?? []).map((l) => [l.pool, { symbol: l.symbol, id: l.id, token: l.token, launchedAt: l.launchedAt, eth: l.pairIsEth }]));
    for (const l of logs) {
      const pool = l.address.toLowerCase();
      const live = vv.pools[pool];
      const launch = own.get(pool) ?? (live?.creator === w ? { symbol: live.symbol, id: live.id, token: live.token, block: live.block, eth: live.eth } : null);
      if (!launch) continue; // a sale on someone else's launch is ordinary trading
      const soldAt = await timeOf(parseInt(l.blockNumber, 16));
      const launchedAt = launch.launchedAt ?? (await timeOf(launch.block));
      const out = launch.eth ? ` and took ${fmtEth(Number(word(l.data, 3)) / 1e18)} ETH out` : "";
      for (const chat of chats) {
        await send(chat, `🔻 <code>${short(w)}</code> sold into its own launch <b>$${esc(launch.symbol)}</b>${out}, ${ago(Math.max(0, soldAt - launchedAt))} after launching it.\n${recordLink(launch.token)}`);
      }
      sells++;
    }
  }

  // keep a week of live launches, so a launcher's sells are caught before the hourly record has them
  const keepFrom = head - Math.round((7 * 86400) / SECONDS_PER_BLOCK);
  for (const [p, v] of Object.entries(vv.pools)) if (v.block < keepFrom) delete vv.pools[p];
  for (const [w, t] of Object.entries(vv.posted)) if (now - t > 7 * 86400) delete vv.posted[w];
  // funding never changes, but keep the memory small: forget all after 5,000 launchers
  if (Object.keys(vv.funders).length > 5000) vv.funders = {};
  vv.block = head;
  save();
  return { launches: launched.length, sells };
}
