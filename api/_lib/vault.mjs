// Reads a KeptVault over plain JSON-RPC. Shared by the verdict card endpoint and the verdict bot,
// so both draw the same numbers. No dependencies.

export const NETS = {
  4663: {
    name: "Robinhood Chain",
    rpc: process.env.KEPT_RPC || "https://rpc.mainnet.chain.robinhood.com",
    vault: process.env.KEPT_VAULT || "0x3152f9cbf64d0c1ac24ea7e101db3e4d8da86896",
    fromBlock: Number(process.env.KEPT_FROM_BLOCK || 91910657),
    explorer: "https://explorer.mainnet.chain.robinhood.com",
  },
  1: {
    name: "Ethereum",
    rpc: process.env.KEPT_RPC_1 || "https://ethereum-rpc.publicnode.com",
    vault: process.env.KEPT_VAULT_1 || "",
    fromBlock: Number(process.env.KEPT_FROM_BLOCK_1 || 0),
    explorer: "https://etherscan.io",
  },
};

export const SITE = "keptmd.vercel.app";

const SEL = {
  pledgeCount: "c6d6c183",
  pledge: "7326c9c0",
  milestone: "a5aaba22",
  symbol: "95d89b41",
  decimals: "313ce567",
};

export const TOPIC = {
  settled: "0x68fbc2551545ee5402e50cd6d73fd08205d73ca5b85c3a5320e4c7fb9f5b0f2f",
  verdict: "0x006c4215c60df81476fb90ec908a4eea91e38acb768ec907359d9d5c1c704d19",
  funded: "0xa9f7081b3f19af4d38c503ee34ec0d349e9072ae7bc1ea5d350ecf8a348478fe",
  created: "0xe89999e6cb721fbde519355a42612e3d1199f8b9976aab236aa2250409b6070f",
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

export async function pledgeCount(net) {
  const [c] = await calls(net, [[net.vault, `0x${SEL.pledgeCount}`]]);
  return Number(uint(c, 0));
}

/** A pledge with every milestone and its token's symbol and decimals; null if it does not exist. */
export async function readPledge(net, id) {
  if (id < 1 || id > (await pledgeCount(net))) return null;
  const [p] = await calls(net, [[net.vault, `0x${SEL.pledge}${word(id)}`]]);
  const count = Number(uint(p, 5));
  const token = addr(p, 2);
  const out = await calls(net, [
    [token, `0x${SEL.symbol}`],
    [token, `0x${SEL.decimals}`],
    ...Array.from({ length: count }, (_, i) => [net.vault, `0x${SEL.milestone}${word(id)}${word(i)}`]),
  ]);
  const [sym, dec, ...ms] = out;
  return {
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
      outcome: Number(uint(m, 4)), // 0 open, 1 kept, 2 broken
      settled: uint(m, 5) === 1n,
      attempts: Number(uint(m, 6)),
    })),
  };
}

/**
 * Logs from the vault. Every topic position takes one value, which lets the RPC serve ten
 * million blocks per call; the range is walked in steps of that size.
 */
export async function vaultLogs(net, topics, { from = net.fromBlock, to } = {}) {
  const latest = to ?? Number(await rpc(net, "eth_blockNumber", []));
  const STEP = 9_999_999;
  const out = [];
  for (let f = from; f <= latest; f += STEP) {
    const t = Math.min(latest, f + STEP - 1);
    out.push(...(await rpc(net, "eth_getLogs", [{ address: net.vault, fromBlock: hex(f), toBlock: hex(t), topics }])));
  }
  return { logs: out, latest };
}

/** The last swarm verdict on one milestone: how many agents agreed, out of how many. */
export async function lastVerdict(net, id, index) {
  const { logs } = await vaultLogs(net, [TOPIC.verdict, `0x${word(id)}`, `0x${word(index)}`]);
  const l = logs.at(-1);
  if (!l) return null;
  const d = l.data.slice(2);
  return { kept: uint(d, 0) === 1n, agreed: Number(uint(d, 1)), quorum: Number(uint(d, 2)), panelSize: Number(uint(d, 3)), tx: l.transactionHash };
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
