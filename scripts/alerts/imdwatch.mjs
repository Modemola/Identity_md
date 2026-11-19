// IMD launcher alerts for the KEPT bot: on Robinhood Chain mainnet, every IMD launch names a
// wallet that receives the team's share (docs/RECORDS.md). Each pass reads that wallet's new
// transfers of its own token. A sale into the launch's pool goes to the channel and to anyone
// watching the wallet; tokens moved to another wallet go to watchers. Adding liquidity stays quiet.
//
// Used by alerts.mjs. The launches come from KEPT's hourly IMD index.

import { imdMeta, fmtEth } from "../../api/_lib/records.mjs";
import { SITE } from "../../api/_lib/vault.mjs";

const RPC = process.env.KEPT_RPC || "https://rpc.mainnet.chain.robinhood.com";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const SWAP = "0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f";
const MODIFY_LIQUIDITY = "0xf208f4912782fd25c7f114ca3723a2d5dd6f3bcc3ac8db5af63baa85f711d5ec";
const BURN = new Set(["0x000000000000000000000000000000000000dead", "0x0000000000000000000000000000000000000000"]);
/** After an outage, read at most this many blocks back (a few hours on Robinhood Chain), not the whole gap. */
const MAX_GAP = Number(process.env.KEPT_IMD_MAX_GAP || 150_000);

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function rpc(method, params) {
  for (let attempt = 0; ; attempt++) {
    const j = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })
      .then((r) => r.json())
      .catch((e) => ({ error: { message: e.message } }));
    if (!j.error) {
      await sleep(120); // the public mainnet RPC rate-limits bursts
      return j.result;
    }
    if (attempt >= 5) throw new Error(`${method}: ${j.error.message}`);
    await sleep(700 * 2 ** attempt);
  }
}
const hex = (n) => `0x${n.toString(16)}`;
const pad = (a) => `0x${a.slice(2).toLowerCase().padStart(64, "0")}`;
const addrOf = (t) => `0x${t.slice(-40)}`.toLowerCase();
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const pct = (part, whole) => (whole > 0n ? Number((part * 10_000n) / whole) / 100 : 0);
const pctText = (x) => `${x.toLocaleString("en-US", { maximumFractionDigits: x < 1 ? 2 : 0 })}%`;
const ago = (s) => {
  if (s < 60) return "under a minute";
  const [n, unit] = s < 5400 ? [Math.round(s / 60), "minute"] : s < 172800 ? [Math.round(s / 3600), "hour"] : [Math.round(s / 86400), "day"];
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
};
const amountText = (v) => (Number(v) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 0 });

/**
 * One pass over every IMD launch with a launcher wallet. `state.imd` keeps the last block read;
 * `state.watch` maps chats to watched wallets (shared with the vibe/vibe watcher).
 */
export async function imdPass({ state, send, channel, save }) {
  const idx = await imdMeta();
  if (!idx) return { launches: 0, sales: 0, moves: 0 };
  const st = (state.imd ??= { block: null });
  const head = parseInt(await rpc("eth_blockNumber", []), 16);
  // the first pass starts now: no flood of old sales
  let from = st.block == null ? head : st.block + 1;
  if (head - from > MAX_GAP) from = head - MAX_GAP;
  if (from > head) return { launches: idx.launches.length, sales: 0, moves: 0 };

  const watchers = new Map();
  for (const [chat, wallets] of Object.entries(state.watch ?? {})) for (const w of wallets) watchers.set(w, [...(watchers.get(w) ?? []), chat]);
  const pm = idx.poolManager.toLowerCase();
  let sales = 0;
  let moves = 0;

  // a watched wallet on a new IMD launch: the hourly index lists it, this pass announces it once
  const seen = new Set(st.seen ?? []);
  const firstRun = !st.seen;
  for (const L of idx.launches) {
    if (seen.has(L.id)) continue;
    seen.add(L.id);
    if (firstRun || !L.launcher) continue;
    for (const chat of watchers.get(L.launcher) ?? []) {
      await send(chat, `🚀 <code>${short(L.launcher)}</code> is the launcher of a new IMD launch: <b>$${esc(L.symbol)}</b> (#${L.id}, Robinhood Chain).\nhttps://${SITE}/#/check/${L.token}`);
    }
  }
  st.seen = [...seen];

  for (const L of idx.launches) {
    if (!L.launcher) continue;
    const logs = await rpc("eth_getLogs", [{ address: L.token, topics: [TRANSFER, pad(L.launcher)], fromBlock: hex(from), toBlock: hex(head) }]);
    if (!logs.length) continue;
    const received = BigInt(L.received || "0");
    const link = `https://${SITE}/#/check/${L.token}`;
    const title = `<b>$${esc(L.symbol)}</b> (IMD launch #${L.id}, Robinhood Chain)`;
    // one message per launch per pass: several sales in a row read as one
    let sold = 0n;
    let count = 0;
    let firstAt = 0;
    const moved = new Map();
    for (const g of logs) {
      const to = addrOf(g.topics[2]);
      const v = BigInt(g.data);
      if (to === pm) {
        const receipt = await rpc("eth_getTransactionReceipt", [g.transactionHash]);
        const topics = (receipt?.logs ?? []).filter((x) => x.address.toLowerCase() === pm).map((x) => x.topics[0]);
        if (!topics.includes(SWAP) && topics.includes(MODIFY_LIQUIDITY)) continue; // adding liquidity, not a sale
        sold += v;
        count++;
        if (!firstAt) firstAt = parseInt((await rpc("eth_getBlockByNumber", [g.blockNumber, false])).timestamp, 16);
      } else if (!BURN.has(to)) moved.set(to, (moved.get(to) ?? 0n) + v);
    }
    if (count) {
      const msg = `🔻 ${title}\nIts launcher <code>${short(L.launcher)}</code> sold ${amountText(sold)} $${esc(L.symbol)} into the launch's own pool${count > 1 ? ` in ${count} sales` : ""}${received ? `: ${pctText(pct(sold, received))} of the share it received` : ""}. The first came ${ago(Math.max(0, firstAt - L.launchedAt))} after launch.\n${link}`;
      for (const chat of new Set([...(watchers.get(L.launcher) ?? []), ...(channel ? [channel] : [])])) await send(chat, msg);
      sales += count;
    }
    for (const [to, v] of moved) {
      const msg = `↪️ ${title}\nIts launcher <code>${short(L.launcher)}</code> moved ${amountText(v)} $${esc(L.symbol)}${received ? ` (${pctText(pct(v, received))} of its share)` : ""} to <code>${short(to)}</code>. That wallet may sell instead.\n${link}`;
      for (const chat of watchers.get(L.launcher) ?? []) await send(chat, msg);
      moves++;
    }
  }
  st.block = head;
  save();
  return { launches: idx.launches.length, sales, moves };
}
