// Reads KEPT's vaults over plain JSON-RPC. Shared by every endpoint, the verdict bot and the alerts,
// so all of them draw the same numbers. No dependencies.
//
// Two vaults per chain: v1 (pledges 1, 2, ...) and v2 (pledges 1001, 1002, ...; docs/VAULT_V2.md).
// A pledge number names its vault, so every caller passes a number and this file picks the vault.

export const NETS = {
  4663: {
    name: "Robinhood Chain",
    rpc: process.env.KEPT_RPC || "https://rpc.mainnet.chain.robinhood.com",
    vault: process.env.KEPT_VAULT || "0x3152f9cbf64d0c1ac24ea7e101db3e4d8da86896",
    fromBlock: Number(process.env.KEPT_FROM_BLOCK || 91910657),
    // KeptVault v2: fill in after `launch.mjs vault-v2`
    vault2: process.env.KEPT_VAULT2 || "",
    vault2From: Number(process.env.KEPT_VAULT2_FROM_BLOCK || 0),
    explorer: "https://explorer.mainnet.chain.robinhood.com",
  },
  1: {
    name: "Ethereum",
    rpc: process.env.KEPT_RPC_1 || "https://ethereum-rpc.publicnode.com",
    vault: process.env.KEPT_VAULT_1 || "",
    fromBlock: Number(process.env.KEPT_FROM_BLOCK_1 || 0),
    vault2: process.env.KEPT_VAULT2_1 || "",
    vault2From: Number(process.env.KEPT_VAULT2_FROM_BLOCK_1 || 0),
    explorer: "https://etherscan.io",
  },
};

export const SITE = "keptmd.vercel.app";

/** v2 numbers its pledges from here (KeptVaultV2.FIRST_PLEDGE). */
export const FIRST_V2 = 1001;
/** The vault that holds pledge `id`, and the block its history starts at. */
export const vaultOf = (net, id) => (id >= FIRST_V2 ? net.vault2 : net.vault);
export const fromOf = (net, id) => (id >= FIRST_V2 ? net.vault2From : net.fromBlock);
/** The vaults live on a chain: [address, first block, first pledge number]. */
export const vaults = (net) => [[net.vault, net.fromBlock, 1], [net.vault2, net.vault2From, FIRST_V2]].filter(([v]) => v);

const SEL = {
  pledgeCount: "c6d6c183",
  pledge: "7326c9c0",
  milestone: "a5aaba22",
  milestoneV2: "00d7335e",
  symbol: "95d89b41",
  decimals: "313ce567",
};

export const TOPIC = {
  settled: "0x68fbc2551545ee5402e50cd6d73fd08205d73ca5b85c3a5320e4c7fb9f5b0f2f",
  verdict: "0x006c4215c60df81476fb90ec908a4eea91e38acb768ec907359d9d5c1c704d19",
  funded: "0xa9f7081b3f19af4d38c503ee34ec0d349e9072ae7bc1ea5d350ecf8a348478fe",
  created: "0xe89999e6cb721fbde519355a42612e3d1199f8b9976aab236aa2250409b6070f",
  // v2 only
  scored: "0xd19e1e30421c0e6d1d2dfa55add0920dcf55deb6a5fbcf82899fdda5525fa6b0",
  burned: "0xd86dd93660332a82a1375bafe68e63968f979afbebfee1ca04838b584d5dc7c7",
  appealed: "0x3f5e3a985470657062843a26eade72f3f4d37d8f28927f9351c165aae28a47db",
};

export const word = (n) => BigInt(n).toString(16).padStart(64, "0");
const hex = (n) => `0x${Number(n).toString(16)}`;

/** POST to the RPC, retrying a rate limit or a server error up to three times with backoff. */
async function post(net, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(net.rpc, { method: "POST", headers: { "content-type": "application/json" }, body });
    if (res.ok || attempt === 3 || !(res.status === 429 || res.status >= 500)) return res;
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
  }
}

export async function rpc(net, method, params) {
  const res = await post(net, JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }));
  if (!res.ok) throw new Error(`rpc ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}

async function calls(net, batch) {
  const body = batch.map(([to, data], id) => ({ jsonrpc: "2.0", id, method: "eth_call", params: [{ to, data }, "latest"] }));
  const res = await post(net, JSON.stringify(body));
  if (!res.ok) throw new Error(`rpc ${res.status}`);
  const out = await res.json();
  return out.sort((a, b) => a.id - b.id).map((r) => {
    if (r.error) throw new Error(r.error.message);
    return r.result.slice(2);
  });
}

export const uint = (h, i) => BigInt(`0x${h.slice(i * 64, i * 64 + 64) || "0"}`);
export const addr = (h, i) => `0x${h.slice(i * 64 + 24, i * 64 + 64)}`.toLowerCase();
export function str(h, i) {
  const off = Number(uint(h, i)) * 2;
  const len = Number(BigInt(`0x${h.slice(off, off + 64)}`));
  return Buffer.from(h.slice(off + 64, off + 64 + len * 2), "hex").toString("utf8");
}

/** The last pledge number on one vault (v2's count starts at 1000). */
async function lastId(net, vault) {
  const [c] = await calls(net, [[vault, `0x${SEL.pledgeCount}`]]);
  return Number(uint(c, 0));
}

/** v1's pledge count. Kept for callers that predate v2; new code uses pledgeIds. */
export async function pledgeCount(net) {
  return lastId(net, net.vault);
}

/** Every pledge number on the chain, v1's then v2's. */
export async function pledgeIds(net) {
  const out = [];
  for (const [v, , first] of vaults(net)) {
    const last = await lastId(net, v);
    for (let i = first; i <= last; i++) out.push(i);
  }
  return out;
}

/** A pledge with every milestone and its token's symbol and decimals; null if it does not exist. */
export async function readPledge(net, id) {
  const vault = vaultOf(net, id);
  const v2 = id >= FIRST_V2;
  if (!vault || id < (v2 ? FIRST_V2 : 1) || id > (await lastId(net, vault))) return null;
  const [p] = await calls(net, [[vault, `0x${SEL.pledge}${word(id)}`]]);
  const count = Number(uint(p, 5));
  const token = addr(p, 2);
  const out = await calls(net, [
    [token, `0x${SEL.symbol}`],
    [token, `0x${SEL.decimals}`],
    ...Array.from({ length: count }, (_, i) => [vault, `0x${SEL.milestone}${word(id)}${word(i)}`]),
    // v2: the share that unlocks, and until when the milestone can be checked
    ...(v2 ? Array.from({ length: count }, (_, i) => [vault, `0x${SEL.milestoneV2}${word(id)}${word(i)}`]) : []),
  ]);
  const [sym, dec, ...rest] = out;
  const ms = rest.slice(0, count);
  const extra = rest.slice(count);
  return {
    version: v2 ? 2 : 1,
    vault,
    id,
    creator: addr(p, 0),
    beneficiary: addr(p, 1),
    token,
    name: str(p, 3),
    count,
    open: Number(uint(p, 6)),
    locked: uint(p, 7),
    budget: uint(p, 8),
    symbol: sym ? str(sym, 0) : "TOKEN",
    decimals: dec ? Number(uint(dec, 0)) : 18,
    milestones: ms.map((m, index) => ({
      index,
      kind: Number(uint(m, 0)),
      title: str(m, 1),
      deadline: Number(uint(m, 2)),
      amount: uint(m, 3),
      outcome: Number(uint(m, 4)), // 0 open, 1 kept, 2 broken, 3 partial (v2)
      settled: uint(m, 5) === 1n,
      attempts: Number(uint(m, 6)),
      // the share of the tranche that unlocks, in basis points: v1 is all or nothing
      shareBps: extra[index] ? Number(uint(extra[index], 0)) : Number(uint(m, 4)) === 1 ? 10_000 : 0,
      appealed: extra[index] ? uint(extra[index], 2) === 1n : false,
      // v1: only a GitHub release (kind 0) gets the 3-day grace; v2 reports its own
      checkBy: extra[index] ? Number(uint(extra[index], 4)) : Number(uint(m, 2)) + (Number(uint(m, 0)) === 0 ? 3 * 86400 : 0),
    })),
  };
}

/**
 * Logs from the vault. Every topic position takes one value, which lets the RPC serve ten
 * million blocks per call; the range is walked in steps of that size.
 */
export async function vaultLogs(net, topics, { from = net.fromBlock, to, vault = net.vault } = {}) {
  const latest = to ?? Number(await rpc(net, "eth_blockNumber", []));
  const STEP = 9_999_999;
  const out = [];
  for (let f = from; f <= latest; f += STEP) {
    const t = Math.min(latest, f + STEP - 1);
    out.push(...(await rpc(net, "eth_getLogs", [{ address: vault, fromBlock: hex(f), toBlock: hex(t), topics }])));
  }
  return { logs: out, latest };
}

/** The same logs from every live vault, oldest first. `from` never reaches before a vault's deploy. */
export async function allVaultLogs(net, topics, { from = 0, to } = {}) {
  const latest = to ?? Number(await rpc(net, "eth_blockNumber", []));
  const logs = [];
  for (const [vault, first] of vaults(net)) {
    logs.push(...(await vaultLogs(net, topics, { from: Math.max(from, first), to: latest, vault })).logs);
  }
  logs.sort((a, b) => Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)) || Number(BigInt(a.logIndex) - BigInt(b.logIndex)));
  return { logs, latest };
}

/** The last swarm verdict on one milestone: how many agents agreed, out of how many. */
export async function lastVerdict(net, id, index) {
  const { logs } = await vaultLogs(net, [TOPIC.verdict, `0x${word(id)}`, `0x${word(index)}`], { vault: vaultOf(net, id), from: fromOf(net, id) });
  const l = logs.at(-1);
  if (!l) return null;
  const d = l.data.slice(2);
  return { kept: uint(d, 0) === 1n, agreed: Number(uint(d, 1)), quorum: Number(uint(d, 2)), panelSize: Number(uint(d, 3)), tx: l.transactionHash };
}

/** v2: the number a scaled milestone was read at, and the share it earned. */
export async function lastScore(net, id, index) {
  if (id < FIRST_V2 || !net.vault2) return null;
  const { logs } = await vaultLogs(net, [TOPIC.scored, `0x${word(id)}`, `0x${word(index)}`], { vault: net.vault2, from: net.vault2From });
  const l = logs.at(-1);
  if (!l) return null;
  const d = l.data.slice(2);
  return { value: uint(d, 0), shareBps: Number(uint(d, 1)), tx: l.transactionHash };
}

/** Whole-token amount with thousands separators, for cards and posts. */
export function amount(v, decimals) {
  const whole = v / 10n ** BigInt(decimals);
  const frac = Number(v % 10n ** BigInt(decimals)) / 10 ** decimals;
  const n = Number(whole) + frac;
  if (n >= 1e9) return `${+(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * One way to count a record, used by every endpoint and bot: kept, partial (v2), broken and open
 * milestones, and `credit`, kept milestones plus each partial's share (a 60% partial is 0.6).
 */
export function recordOf(milestones) {
  let kept = 0, partial = 0, broken = 0, credit = 0;
  for (const m of milestones) {
    if (m.outcome === 1) (kept++, (credit += 1));
    else if (m.outcome === 3) (partial++, (credit += (m.shareBps ?? 0) / 10_000));
    else if (m.outcome === 2) broken++;
  }
  const settled = kept + partial + broken;
  return { kept, partial, broken, open: milestones.length - settled, settled, credit };
}

/** "2/3 promises kept", or "2 kept · 1 partial · 1 broken" once anything fell short. */
export function recordText(r, total = r.settled + r.open) {
  if (!total) return "no pledges";
  if (!r.partial && !r.broken) return `${r.kept}/${total} promises kept`;
  return [`${r.kept} kept`, r.partial && `${r.partial} partial`, r.broken && `${r.broken} broken`].filter(Boolean).join(" · ");
}
