// Launcher records: what the wallet behind a token did with its other launches. Read from the
// index that scripts/records/indexer.mjs writes to the repo's `data` branch every hour.
//
// Everything here is a fact read from the chain: launches, graduations, buys and the launcher's
// own sells on its bonding curves. The tone is a colour for the page, from a published rule.

const BASE = process.env.KEPT_RECORDS_URL || "https://raw.githubusercontent.com/Modemola/identity_md/data/records/vibevibe-46630";

const cache = new Map();
async function get(path) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < 300_000) return hit.value;
  let value;
  if (BASE.startsWith("/")) {
    const { readFile } = await import("node:fs/promises");
    value = await readFile(`${BASE}/${path}`, "utf8").then(JSON.parse, () => null);
  } else {
    const r = await fetch(`${BASE}/${path}`);
    if (r.status === 404) value = null;
    else if (!r.ok) throw new Error(`records ${r.status}`);
    else value = await r.json();
  }
  cache.set(path, { at: Date.now(), value });
  return value;
}

export const meta = () => get("meta.json");
const shard = (a) => a.slice(2, 4).toLowerCase();

function timeOf(blockTimes, b) {
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

export const FACTORY_LABEL = ["vibe/vibe (first factory)", "vibe/vibe"];

/** One launch, from the index's compact row, with times and amounts spelled out. */
function launch(row, blockTimes) {
  const [factory, id, token, pool, block, symbol, name, eth, grad, buys, buyersIn, creatorIn, creatorOut, sells, firstSell] = row;
  const launchedAt = timeOf(blockTimes, block);
  return {
    factory,
    id,
    token,
    pool,
    symbol,
    name,
    launchedAt,
    graduated: Boolean(grad),
    pairIsEth: Boolean(eth),
    buys,
    buyersIn,
    creatorIn,
    creatorOut,
    creatorSells: sells,
    exitAfter: firstSell ? Math.max(0, timeOf(blockTimes, firstSell) - launchedAt) : null,
  };
}

const eth = (wei) => Number(BigInt(wei)) / 1e18;

/**
 * The page tone, by a rule anyone can check: `exits` when the launcher sold into its own launch
 * within an hour of launching, at least twice or on a quarter of its launches; `sold` when it sold
 * into its own launches at all; `clean` when it never did across two launches or more; `new` for a
 * first launch with no sells yet. Tone colours the page; the facts carry it.
 */
export function toneOf(s) {
  if (s.fastExits >= 2 || (s.launches >= 2 && s.fastExits / s.launches >= 0.25) || (s.launches === 1 && s.fastExits === 1)) return "exits";
  if (s.sold > 0) return "sold";
  // one launch and no sells is no history yet, not a clean record
  return s.launches > 1 ? "clean" : "new";
}

/** Plain sentences for the record, most important first. */
export function factsOf(s, fastExitSeconds = 3600) {
  const out = [];
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const mins = Math.round(fastExitSeconds / 60);
  if (s.fastExits) out.push({ tone: "alarm", text: `Sold into its own launch within ${mins} minutes of launching, on ${s.fastExits} of ${s.launches} launch${s.launches === 1 ? "" : "es"}.` });
  const net = eth(s.creatorOut) - eth(s.creatorIn);
  if (s.ethLaunches && net > 0.0005) out.push({ tone: "alarm", text: `Took ${fmtEth(net)} ETH more out of its own launches than it put in. Buyers put in ${fmtEth(eth(s.buyersIn))} ETH.` });
  if (s.sold && s.sold !== s.fastExits) out.push({ tone: "caution", text: `Sold into ${s.sold} of its own launches in total.` });
  out.push({ tone: s.graduated ? "ok" : "caution", text: `${s.graduated} of ${s.launches} launch${s.launches === 1 ? "" : "es"} graduated (${pct(s.graduated, s.launches)}%).` });
  if (s.launches >= 10) out.push({ tone: "caution", text: `Launched ${s.launches.toLocaleString("en-US")} tokens.` });
  if (!s.sold) out.push({ tone: "ok", text: "Never sold into its own launches." });
  return out;
}

export function fmtEth(x) {
  if (x === 0) return "0";
  if (x < 0.001) return "<0.001";
  return x.toLocaleString("en-US", { maximumFractionDigits: x < 1 ? 3 : 2 });
}

/** A launcher's record, or null when this wallet never launched on vibe/vibe. */
export async function launcher(address, { limit = 50 } = {}) {
  const a = address.toLowerCase();
  const [m, sh] = await Promise.all([meta(), get(`creators/${shard(a)}.json`)]);
  const rec = sh?.[a];
  if (!m || !rec) return null;
  const s = rec.summary;
  return {
    address: a,
    summary: s,
    tone: toneOf(s),
    facts: factsOf(s, m.fastExitSeconds),
    launches: rec.launches.slice(0, limit).map((r) => launch(r, m.blockTimes)),
  };
}

/** The launches a query names: a token address, or a launch number (on either factory). */
export async function findLaunches(q) {
  const m = await meta();
  if (!m) return [];
  if (/^0x[0-9a-fA-F]{40}$/.test(q)) {
    const t = q.toLowerCase();
    const hit = (await get(`tokens/${shard(t)}.json`))?.[t];
    return hit ? [{ factory: hit[0], id: hit[1], token: t, creator: hit[2] }] : [];
  }
  const id = Number(String(q).replace(/^#/, ""));
  if (!Number.isInteger(id) || id < 1) return [];
  const out = [];
  for (let f = m.factories.length - 1; f >= 0; f--) {
    const hit = (await get(`ids/${f}-${Math.floor(id / 1000)}.json`))?.[id];
    if (hit) out.push({ factory: f, id, token: hit[0], creator: hit[1] });
  }
  return out;
}

/** The fields of one launch row, by token, from its launcher's record. */
export async function launchOf(token, creator) {
  const rec = await launcher(creator, { limit: 300 });
  return rec?.launches.find((l) => l.token === token.toLowerCase()) ?? null;
}

// ------------------------------------------------------------------ IMD launches on Robinhood Chain

const IMD_BASE = process.env.KEPT_IMD_RECORDS_URL || "https://raw.githubusercontent.com/Modemola/identity_md/data/records/imd-4663";
let imdCache = null;
async function imdIndex() {
  if (imdCache && Date.now() - imdCache.at < 300_000) return imdCache.value;
  let value = null;
  if (IMD_BASE.startsWith("/")) {
    const { readFile } = await import("node:fs/promises");
    value = await readFile(`${IMD_BASE}/index.json`, "utf8").then(JSON.parse, () => null);
  } else {
    const r = await fetch(`${IMD_BASE}/index.json`);
    if (r.ok) value = await r.json();
    else if (r.status !== 404) throw new Error(`imd records ${r.status}`);
  }
  imdCache = { at: Date.now(), value };
  return value;
}
export const imdMeta = imdIndex;

const share = (part, whole) => (BigInt(whole) > 0n ? Number((BigInt(part) * 10_000n) / BigInt(whole)) : 0);

/** One IMD launch, with the launcher's moves as shares of what it received. */
function imdLaunch(l, fastExitSeconds) {
  return {
    source: "imd",
    id: l.id,
    kind: l.kind,
    token: l.token,
    symbol: l.symbol,
    name: l.name,
    repo: l.repo,
    launchedAt: l.launchedAt,
    received: l.received,
    soldBps: share(l.soldToPool, l.received),
    movedBps: share(l.moved, l.received),
    liquidityBps: share(l.liquidity || "0", l.received),
    burnedBps: share(l.burned, l.received),
    creatorSells: l.sells,
    exitAfter: l.firstSellAt ? Math.max(0, l.firstSellAt - l.launchedAt) : null,
    fast: Boolean(l.firstSellAt && l.firstSellAt - l.launchedAt <= fastExitSeconds),
  };
}

function imdFacts(s, launches, fastExitSeconds) {
  const out = [];
  const mins = Math.round(fastExitSeconds / 60);
  const n = (k) => `${k} of ${s.launches} launch${s.launches === 1 ? "" : "es"}`;
  if (s.fastExits) out.push({ tone: "alarm", text: `Sold into its own launch's pool within ${mins} minutes of launching, on ${n(s.fastExits)}.` });
  const sold = launches.filter((l) => l.soldBps > 0);
  if (sold.length) {
    const top = sold.reduce((a, b) => (b.soldBps > a.soldBps ? b : a));
    out.push({ tone: "alarm", text: `Sold up to ${(top.soldBps / 100).toFixed(top.soldBps < 100 ? 2 : 0)}% of its allocation into the pool ($${top.symbol}).` });
  }
  if (s.moved) out.push({ tone: "caution", text: `Moved part of its allocation to other wallets on ${n(s.moved)}. Those wallets may sell instead.` });
  const liq = launches.filter((l) => l.liquidityBps > 0).length;
  if (liq) out.push({ tone: "ok", text: `Added its own tokens to the pool's liquidity on ${n(liq)}.` });
  if (!s.sold) out.push({ tone: "ok", text: "Never sold into its own launches' pools." });
  if (s.launches >= 3) out.push({ tone: "caution", text: `Launched ${s.launches} tokens on IMD.` });
  return out;
}

/** A wallet's record as an IMD launcher (its `remainderTo` on launches), or null. */
export async function imdLauncher(address, { limit = 50 } = {}) {
  const idx = await imdIndex();
  const a = address.toLowerCase();
  const s = idx?.launchers?.[a];
  if (!s) return null;
  const launches = idx.launches.filter((l) => l.launcher === a).map((l) => imdLaunch(l, idx.fastExitSeconds));
  return {
    source: "imd",
    address: a,
    summary: s,
    tone: toneOf(s),
    facts: imdFacts(s, launches, idx.fastExitSeconds),
    launches: launches.slice(0, limit),
  };
}

/** IMD launches a query names: a token address or an IMD launch number. */
export async function findImd(q) {
  const idx = await imdIndex();
  if (!idx) return [];
  const raw = String(q).replace(/^#/, "").toLowerCase();
  const hit = /^0x/.test(raw) ? idx.launches.find((l) => l.token === raw) : idx.launches.find((l) => l.id === Number(raw));
  return hit ? [{ source: "imd", factory: "IMD", id: hit.id, token: hit.token, creator: hit.launcher }] : [];
}
export const IMD_POOL_MANAGER = "0x8366a39cc670b4001a1121b8f6a443a643e40951";
