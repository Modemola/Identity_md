// KEPT launcher records for IMD launches on Robinhood Chain mainnet (4663).
//
//   node scripts/records/imd.mjs <out dir>
//
// An IMD launch is deployed by IMD's launch factory from a public repo. The requester names a
// wallet, `economics.remainderTo` in the repo's launch.json, that receives the supply left after the
// pool seed and the swarm's 10%. That wallet is the launcher. This follows every transfer of the
// token out of it: into the Uniswap v4 PoolManager (a sale into the launch's pool), to a burn
// address, or to another wallet. Facts only. Incremental: <out dir>/imd-state.json keeps the last
// block read. Run hourly by .github/workflows/records.yml, beside the vibe/vibe indexer.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const RPC = process.env.KEPT_RPC || "https://rpc.mainnet.chain.robinhood.com";
const IMD_API = "https://api.imd.fun";
const OUT = process.argv[2] || "records-data";
const CHAIN = 4663;
const POOL_MANAGER = "0x8366a39cc670b4001a1121b8f6a443a643e40951";
const BURN = new Set(["0x000000000000000000000000000000000000dead", "0x0000000000000000000000000000000000000000"]);
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
// the PoolManager's events (v4-core IPoolManager): a transfer into it is a sale only when its
// transaction swaps; one that only modifies liquidity is the launcher adding to the pool
const SWAP = "0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f";
const MODIFY_LIQUIDITY = "0xf208f4912782fd25c7f114ca3723a2d5dd6f3bcc3ac8db5af63baa85f711d5ec";
/** Seconds after launch within which a sale counts as an exit right after launch, as on vibe/vibe. */
export const FAST_EXIT = 3600;

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
let calls = 0;
async function rpc(method, params) {
  for (let attempt = 0; ; attempt++) {
    calls++;
    const j = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })
      .then((r) => r.json())
      .catch((e) => ({ error: { message: e.message } }));
    if (!j.error) {
      await sleep(150); // the public mainnet RPC rate-limits bursts
      return j.result;
    }
    if (attempt >= 6) throw new Error(`${method}: ${j.error.message}`);
    await sleep(800 * 2 ** attempt);
  }
}
const hex = (n) => `0x${n.toString(16)}`;
const pad = (a) => `0x${a.slice(2).toLowerCase().padStart(64, "0")}`;
const addrOf = (t) => `0x${t.slice(-40)}`.toLowerCase();

/** Logs over [from, to] in ten-million-block steps: one address and one value per topic. */
async function logs(filter, from, to) {
  const out = [];
  for (let a = from; a <= to; a += 10_000_000) out.push(...(await rpc("eth_getLogs", [{ ...filter, fromBlock: hex(a), toBlock: hex(Math.min(to, a + 9_999_999)) }])));
  return out;
}

async function allLaunches() {
  const out = [];
  let before = null;
  for (let i = 0; i < 50; i++) {
    const r = await fetch(`${IMD_API}/launches?limit=200${before ? `&before=${before}` : ""}`).then((r) => r.json());
    out.push(...r.launches);
    if (r.launches.length < 200) break;
    before = r.launches.at(-1).launchNumber;
  }
  return out;
}

async function launchJson(repoUrl) {
  const repo = repoUrl.replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "");
  for (const branch of ["main", "master"]) {
    const r = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/launch.json`).catch(() => null);
    if (r?.ok) return r.json().catch(() => null);
  }
  return null;
}

const blockTimes = new Map();
async function timeOf(block) {
  if (!blockTimes.has(block)) blockTimes.set(block, parseInt((await rpc("eth_getBlockByNumber", [hex(block), false])).timestamp, 16));
  return blockTimes.get(block);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const statePath = join(OUT, "imd-state.json");
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : { block: 0, launches: {} };
  const head = parseInt(await rpc("eth_blockNumber", []), 16);

  // 1. launches: new ones get their launch.json read once
  const listed = (await allLaunches()).filter((l) => l.chainId === CHAIN && l.status === "live");
  for (const l of listed) {
    if (state.launches[l.launchNumber]) continue;
    const tok = l.artifacts.find((a) => a.role === "token");
    if (!tok) continue;
    const lj = await launchJson(l.sourceRepoUrl);
    const launcher = lj?.economics?.remainderTo?.toLowerCase();
    state.launches[l.launchNumber] = {
      id: l.launchNumber,
      kind: l.kind,
      token: tok.address.toLowerCase(),
      symbol: lj?.token?.symbol || tok.name || "",
      name: lj?.token?.name || tok.name || "",
      repo: l.sourceRepoUrl,
      block: tok.blockNumber,
      launchedAt: await timeOf(tok.blockNumber),
      // null: the launch names no remainder wallet (hook and project launches), or burns the remainder
      // (remainderTo is a burn address), so no wallet holds a team share to sell
      launcher: launcher && /^0x[0-9a-f]{40}$/.test(launcher) && !BURN.has(launcher) ? launcher : null,
      remainderBurned: Boolean(launcher && BURN.has(launcher)),
      poolBps: lj?.economics?.poolBps ?? null,
      received: "0",
      soldToPool: "0",
      liquidity: "0",
      burned: "0",
      moved: "0",
      sells: 0,
      firstSell: 0,
      read: tok.blockNumber - 1,
    };
  }

  for (const L of Object.values(state.launches)) if (L.launcher && BURN.has(L.launcher)) Object.assign(L, { launcher: null, remainderBurned: true });

  // 2. the launcher's transfers of its own token, from where each launch was last read
  for (const L of Object.values(state.launches)) {
    if (!L.launcher || L.read >= head) continue;
    const from = L.read + 1;
    const add = (k, v) => (L[k] = (BigInt(L[k]) + v).toString());
    for (const g of await logs({ address: L.token, topics: [TRANSFER, null, pad(L.launcher)] }, from, head)) add("received", BigInt(g.data));
    for (const g of await logs({ address: L.token, topics: [TRANSFER, pad(L.launcher)] }, from, head)) {
      const to = addrOf(g.topics[2]);
      const v = BigInt(g.data);
      if (to === POOL_MANAGER) {
        const receipt = await rpc("eth_getTransactionReceipt", [g.transactionHash]);
        const pm = (receipt?.logs ?? []).filter((x) => x.address.toLowerCase() === POOL_MANAGER).map((x) => x.topics[0]);
        if (!pm.includes(SWAP) && pm.includes(MODIFY_LIQUIDITY)) {
          add("liquidity", v);
          continue;
        }
        add("soldToPool", v);
        L.sells++;
        const b = parseInt(g.blockNumber, 16);
        if (!L.firstSell || b < L.firstSell) L.firstSell = b;
      } else if (BURN.has(to)) add("burned", v);
      else add("moved", v);
    }
    if (L.firstSell && !L.firstSellAt) L.firstSellAt = await timeOf(L.firstSell);
    L.read = head;
  }
  state.block = head;
  state.updatedAt = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify(state));
  writeIndex(state);
  console.log(`imd: ${Object.keys(state.launches).length} launches, ${Object.values(state.launches).filter((l) => l.launcher).length} with a launcher, ${calls} rpc calls`);
}

/** A launcher's totals over its IMD launches, in the same shape as vibe/vibe's records. */
export function summariseImd(launches) {
  const s = { launches: launches.length, sold: 0, fastExits: 0, moved: 0, first: 0, last: 0 };
  for (const l of launches) {
    if (l.sells) s.sold++;
    if (l.firstSellAt && l.firstSellAt - l.launchedAt <= FAST_EXIT) s.fastExits++;
    if (BigInt(l.moved) > 0n) s.moved++;
    if (!s.first || l.launchedAt < s.first) s.first = l.launchedAt;
    if (l.launchedAt > s.last) s.last = l.launchedAt;
  }
  return s;
}

function writeIndex(state) {
  const launches = Object.values(state.launches).filter((l) => l.launcher);
  const byLauncher = {};
  for (const l of launches) (byLauncher[l.launcher] ??= []).push(l);
  const launchers = {};
  for (const [w, ls] of Object.entries(byLauncher)) launchers[w] = summariseImd(ls);
  const strip = ({ read, repo, ...rest }) => ({ ...rest, repo });
  writeFileSync(
    join(OUT, "index.json"),
    JSON.stringify({
      source: "imd-4663",
      chainId: CHAIN,
      block: state.block,
      updatedAt: state.updatedAt,
      fastExitSeconds: FAST_EXIT,
      poolManager: POOL_MANAGER,
      launches: launches.sort((a, b) => b.id - a.id).map(strip),
      launchers,
    }),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => (console.error(e), process.exit(1)));
