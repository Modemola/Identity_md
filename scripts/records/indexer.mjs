// KEPT launcher records: indexes every vibe/vibe launch on Robinhood Chain testnet (46630) from
// public event logs, and writes small JSON files that /api/record reads.
//
//   node scripts/records/indexer.mjs <out dir>
//
// Incremental: <out dir>/state.json remembers the last block read, so later runs only read new
// blocks. No dependencies; plain JSON-RPC. Run hourly by .github/workflows/records.yml.
//
// What it records are facts from the chain, per launch: who launched it, whether it graduated,
// what buyers put in, and what the launcher itself bought and sold on its own bonding curve.

import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const RPC = process.env.KEPT_TESTNET_RPC || "https://rpc.testnet.chain.robinhood.com";
const OUT = process.argv[2] || "records-data";
const SOURCE = "vibevibe-46630";

/** vibe/vibe's launch factories, oldest first. Launch numbers restart at 1 on each. */
export const FACTORIES = [
  { address: "0xe794217880011f9ca6961340ed5c16ec9559fea0", from: 126079564 },
  { address: "0xac135da186de8325047ef2afd1d16d5971f731f7", from: 149444416 },
];
const T = {
  launched: "0xa7e8032bfd07a9fbcde50eabe91eb2901faee6dbddd9cced579491d9b07ef5c8",
  graduated: "0xab164bba6f9a29b6722f18be5ea821368fedba444c4f8733118f3557d77ab2ae",
  launchBuy: "0x5b18697b3628e2e1fc787629f624c31f0e98e273ced4f25efbb83d3865368dda",
  buy: "0x55867fe9a84ea30ad247ef1bb703eba47fd9af476149002512a2814b1e3d8fb5",
  sell: "0x3899b2b9ba4dfe77b54ff5e6f921672b2a7563ade468f2a106b25a4b808d60de",
};

// ------------------------------------------------------------------ rpc

let calls = 0;
async function rpc(method, params) {
  for (let attempt = 0; ; attempt++) {
    calls++;
    let j;
    try {
      const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      if ((r.status === 429 || r.status >= 500) && attempt < 5) throw new Error(`http ${r.status}`);
      j = await r.json();
    } catch (e) {
      if (attempt >= 5) throw e;
      await new Promise((ok) => setTimeout(ok, 500 * 2 ** attempt));
      continue;
    }
    if (j.error) {
      const err = new Error(j.error.message);
      err.rpc = j.error.message;
      throw err;
    }
    return j.result;
  }
}
const hex = (n) => `0x${Number(n).toString(16)}`;
const words = (data) => (data.slice(2).match(/.{64}/g) ?? []).map((w) => BigInt(`0x${w}`));
const addrOf = (t) => `0x${t.slice(-40)}`.toLowerCase();

/**
 * Logs over [from, to], one topic set at a time. The RPC serves ten million blocks per call when
 * every position holds one value, but at most 10,000 logs: a full range is halved until it fits.
 */
async function logs(filter, from, to, onChunk) {
  // the most blocks the RPC allows for this kind of query, once it has said so
  let cap = 10_000_000;
  let span = Math.min(cap, to - from + 1);
  let at = from;
  while (at <= to) {
    const end = Math.min(to, at + span - 1);
    try {
      const got = await rpc("eth_getLogs", [{ ...filter, fromBlock: hex(at), toBlock: hex(end) }]);
      onChunk(got);
      if (process.env.KEPT_PROGRESS && Math.random() < 0.02) console.log(`  … block ${end} of ${to}`);
      at = end + 1;
      // grow back after a dense stretch
      if (got.length < 2_500 && span < cap) span = Math.min(cap, span * 2);
    } catch (e) {
      const m = /only (\d+) are allowed/.exec(e.rpc || "");
      if (m) span = cap = Number(m[1]);
      else if (/exceeds limit/.test(e.rpc || "") && span > 1) span = Math.max(1, Math.floor(span / 4));
      else throw e;
    }
  }
}

function abiString(data, offset) {
  try {
    const at = 2 + Number(offset) * 2;
    const len = Number(BigInt(`0x${data.slice(at, at + 64)}`));
    const bytes = data.slice(at + 64, at + 64 + Math.min(len, 64) * 2);
    return Buffer.from(bytes, "hex").toString("utf8").replace(/[\u0000-\u001f]/g, "").trim();
  } catch {
    return "";
  }
}

// ------------------------------------------------------------------ state

/**
 * One launch: [factory, id, token, pool, creator, block, symbol, name, pairIsEth, graduated,
 *   buys, buyersIn, creatorIn, creatorOut, creatorSells, firstCreatorSellBlock]
 * Amounts are the pair token's wei as decimal strings (ETH when pairIsEth).
 */
const L = { f: 0, id: 1, token: 2, pool: 3, creator: 4, block: 5, symbol: 6, name: 7, eth: 8, grad: 9, buys: 10, buyersIn: 11, creatorIn: 12, creatorOut: 13, sells: 14, firstSell: 15 };

function loadState() {
  const p = join(OUT, "state.json");
  if (!existsSync(p)) return { source: SOURCE, block: 0, launches: [], blockTimes: [] };
  return JSON.parse(readFileSync(p, "utf8"));
}

// ------------------------------------------------------------------ run

async function main() {
  mkdirSync(OUT, { recursive: true });
  const state = loadState();
  const head = Number(await rpc("eth_blockNumber", []));
  const from = state.block ? state.block + 1 : Math.min(...FACTORIES.map((f) => f.from));
  if (from > head) return console.log("up to date at", head);
  console.log(`reading blocks ${from} to ${head}`);

  const byPool = new Map(state.launches.map((l) => [l[L.pool], l]));
  const add = (l, i, v) => (l[i] = (BigInt(l[i]) + v).toString());

  // 1. launches, from each factory
  for (const [fi, f] of FACTORIES.entries()) {
    await logs({ address: f.address, topics: [T.launched] }, Math.max(from, f.from), head, (got) => {
      for (const g of got) {
        const w = words(g.data);
        const pool = `0x${w[0].toString(16).padStart(40, "0")}`;
        if (byPool.has(pool)) continue;
        const l = [fi, Number(BigInt(g.topics[1])), addrOf(g.topics[3]), pool, addrOf(g.topics[2]), Number(BigInt(g.blockNumber)), abiString(g.data, w[2]), abiString(g.data, w[1]), w[4] === 0n ? 1 : 0, 0, 0, "0", "0", "0", 0, 0];
        state.launches.push(l);
        byPool.set(pool, l);
      }
    });
    console.log(`factory ${fi}: ${state.launches.filter((l) => l[L.f] === fi).length} launches`);
  }

  // 2. trades and graduations on those pools; events from anything else are ignored
  const stream = async (name, topic, fn) => {
    let n = 0;
    await logs({ topics: [topic] }, from, head, (got) => {
      for (const g of got) {
        const l = byPool.get(g.address.toLowerCase());
        if (l) (fn(l, g), n++);
      }
    });
    console.log(`${name}: ${n} on KEPT-indexed pools`);
  };
  await stream("graduations", T.graduated, (l) => (l[L.grad] = 1));
  await stream("launch buys", T.launchBuy, (l, g) => {
    const w = words(g.data);
    if (addrOf(g.topics[1]) === l[L.creator]) add(l, L.creatorIn, w[2]);
    else (add(l, L.buyersIn, w[2]), l[L.buys]++);
  });
  await stream("buys", T.buy, (l, g) => {
    const w = words(g.data);
    if (addrOf(g.topics[2]) === l[L.creator]) add(l, L.creatorIn, w[3]);
    else (add(l, L.buyersIn, w[3]), l[L.buys]++);
  });
  await stream("sells", T.sell, (l, g) => {
    if (addrOf(g.topics[2]) !== l[L.creator]) return;
    const w = words(g.data);
    add(l, L.creatorOut, w[3]);
    l[L.sells]++;
    const b = Number(BigInt(g.blockNumber));
    if (!l[L.firstSell] || b < l[L.firstSell]) l[L.firstSell] = b;
  });

  // 3. block times, sampled, so a block number can be turned into a time without a call per block
  const step = 250_000;
  const have = new Set(state.blockTimes.map(([b]) => b));
  const want = [];
  for (let b = Math.floor(Math.min(...FACTORIES.map((f) => f.from)) / step) * step; b <= head; b += step) if (!have.has(b)) want.push(b);
  want.push(head);
  for (const b of want) {
    const blk = await rpc("eth_getBlockByNumber", [hex(b), false]);
    if (blk) state.blockTimes.push([b, Number(BigInt(blk.timestamp))]);
  }
  state.blockTimes.sort((a, b) => a[0] - b[0]);
  state.blockTimes = state.blockTimes.filter((x, i, a) => i === a.length - 1 || x[0] % step === 0);
  state.block = head;
  state.updatedAt = new Date().toISOString();

  writeFileSync(join(OUT, "state.json"), JSON.stringify(state));
  writeShards(state);
  console.log(`done: ${state.launches.length} launches, ${calls} rpc calls`);
}

// ------------------------------------------------------------------ output

/** Time of a block, interpolated between sampled blocks. */
export function timeOf(blockTimes, b) {
  let lo = blockTimes[0], hi = blockTimes[blockTimes.length - 1];
  for (const p of blockTimes) {
    if (p[0] <= b) lo = p;
    if (p[0] >= b) {
      hi = p;
      break;
    }
  }
  if (hi[0] === lo[0]) return lo[1];
  return Math.round(lo[1] + ((b - lo[0]) * (hi[1] - lo[1])) / (hi[0] - lo[0]));
}

/** Seconds between launch and the launcher's first sell that count as an exit right after launch. */
export const FAST_EXIT = 3600;

/** A launcher's totals from its launches: facts only, no judgement. */
export function summarise(launches, blockTimes) {
  const s = { launches: launches.length, graduated: 0, sold: 0, fastExits: 0, ethLaunches: 0, buyersIn: 0n, creatorIn: 0n, creatorOut: 0n, first: 0, last: 0 };
  for (const l of launches) {
    if (l[L.grad]) s.graduated++;
    if (l[L.sells]) s.sold++;
    if (l[L.firstSell] && timeOf(blockTimes, l[L.firstSell]) - timeOf(blockTimes, l[L.block]) <= FAST_EXIT) s.fastExits++;
    if (l[L.eth]) {
      s.ethLaunches++;
      s.buyersIn += BigInt(l[L.buyersIn]);
      s.creatorIn += BigInt(l[L.creatorIn]);
      s.creatorOut += BigInt(l[L.creatorOut]);
    }
    const t = timeOf(blockTimes, l[L.block]);
    if (!s.first || t < s.first) s.first = t;
    if (t > s.last) s.last = t;
  }
  return { ...s, buyersIn: s.buyersIn.toString(), creatorIn: s.creatorIn.toString(), creatorOut: s.creatorOut.toString() };
}

/**
 * The last 7 days, for the weekly Exits report: launches made in the week, how many their own
 * launcher sold into within FAST_EXIT, what launchers took out, and the week's worst wallets.
 */
export function weekOf(launches, blockTimes, head) {
  const to = timeOf(blockTimes, head);
  const from = to - 7 * 86_400;
  const recent = launches.filter((l) => timeOf(blockTimes, l[L.block]) >= from);
  const s = summarise(recent, blockTimes);
  const byCreator = new Map();
  for (const l of recent) {
    const fast = l[L.firstSell] && timeOf(blockTimes, l[L.firstSell]) - timeOf(blockTimes, l[L.block]) <= FAST_EXIT;
    const e = byCreator.get(l[L.creator]) ?? { creator: l[L.creator], launches: 0, fastExits: 0, creatorOut: 0n };
    e.launches++;
    if (fast) e.fastExits++;
    if (l[L.eth]) e.creatorOut += BigInt(l[L.creatorOut]);
    byCreator.set(l[L.creator], e);
  }
  const worst = [...byCreator.values()]
    .filter((e) => e.fastExits > 0)
    .sort((a, b) => b.fastExits - a.fastExits || (b.creatorOut > a.creatorOut ? 1 : b.creatorOut < a.creatorOut ? -1 : 0))
    .slice(0, 5)
    .map((e) => ({ ...e, creatorOut: e.creatorOut.toString() }));
  return { from, to, ...s, launchers: byCreator.size, fastLaunchers: [...byCreator.values()].filter((e) => e.fastExits > 0).length, worst };
}

function writeShards(state) {
  const { launches, blockTimes } = state;
  for (const d of ["creators", "tokens", "ids"]) {
    rmSync(join(OUT, d), { recursive: true, force: true });
    mkdirSync(join(OUT, d), { recursive: true });
  }
  const shard = (a) => a.slice(2, 4);
  const creators = new Map();
  const tokens = new Map();
  const ids = new Map();
  for (const l of launches) {
    const c = l[L.creator];
    if (!creators.has(c)) creators.set(c, []);
    creators.get(c).push(l);
    const ts = shard(l[L.token]);
    if (!tokens.has(ts)) tokens.set(ts, {});
    tokens.get(ts)[l[L.token]] = [l[L.f], l[L.id], c];
    const is = `${l[L.f]}-${Math.floor(l[L.id] / 1000)}`;
    if (!ids.has(is)) ids.set(is, {});
    ids.get(is)[l[L.id]] = [l[L.token], c];
  }
  const cshards = new Map();
  const ranked = [];
  for (const [c, ls] of creators) {
    ls.sort((a, b) => b[L.block] - a[L.block]);
    const summary = summarise(ls, blockTimes);
    ranked.push([c, summary]);
    const s = shard(c);
    if (!cshards.has(s)) cshards.set(s, {});
    // the newest 300 launches in full; the summary always covers every launch
    cshards.get(s)[c] = { summary, launches: ls.slice(0, 300).map((l) => [...l.slice(0, 4), ...l.slice(5)]) };
  }
  for (const [s, v] of cshards) writeFileSync(join(OUT, "creators", `${s}.json`), JSON.stringify(v));
  for (const [s, v] of tokens) writeFileSync(join(OUT, "tokens", `${s}.json`), JSON.stringify(v));
  for (const [s, v] of ids) writeFileSync(join(OUT, "ids", `${s}.json`), JSON.stringify(v));

  // the launchers with the most exits right after launch, for the public ranking
  const top = ranked
    .filter(([, s]) => s.fastExits > 0)
    .sort((a, b) => b[1].fastExits - a[1].fastExits || (BigInt(b[1].creatorOut) > BigInt(a[1].creatorOut) ? 1 : BigInt(b[1].creatorOut) < BigInt(a[1].creatorOut) ? -1 : 0))
    .slice(0, 100)
    .map(([c, s]) => ({ creator: c, ...s }));
  const all = summarise(launches, blockTimes);
  const week = weekOf(launches, blockTimes, state.block);
  writeFileSync(
    join(OUT, "meta.json"),
    JSON.stringify({
      source: SOURCE,
      chainId: 46630,
      factories: FACTORIES.map((f) => f.address),
      block: state.block,
      updatedAt: state.updatedAt,
      fastExitSeconds: FAST_EXIT,
      launchFields: ["factory", "id", "token", "pool", "block", "symbol", "name", "pairIsEth", "graduated", "buys", "buyersIn", "creatorIn", "creatorOut", "creatorSells", "firstCreatorSellBlock"],
      blockTimes,
      totals: { ...all, launchers: creators.size, launchersWithFastExits: ranked.filter(([, s]) => s.fastExits > 0).length },
      week,
      fastExitLeaders: top,
    }),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => (console.error(e), process.exit(1)));
