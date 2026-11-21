// Who funded a launcher, and which other launchers the same wallet funded: the link a fresh
// wallet can't hide. Read on demand from the Robinhood Chain testnet explorer (Blockscout), so only
// vibe/vibe launchers for now; mainnet needs an explorer key.
//
// A wallet's funder is where its biggest early deposit came from (of its first ten incoming
// transfers, plain or from inside a contract). Most deposits identify nobody, and the record says so:
//   faucet    the testnet faucet, which funds everyone
//   bridge    the wallet's own deposit from Ethereum (Arbitrum chains shift the sender's address by
//             0x1111…1111, so a deposit arrives "from" the wallet's own address plus that offset)
//   contract  a contract, such as a swap or a router paying out
//   wallet    another wallet: the only kind that links two launchers

import { launcher, groupOf } from "./records.mjs";

const EXPLORER = process.env.KEPT_TESTNET_EXPLORER || "https://explorer.testnet.chain.robinhood.com";
const FAUCETS = new Set(["0x8762f93772c663c6a88ba50900bd5381df2717be"]);
const ALIAS = BigInt("0x1111000000000000000000000000000000001111");
/** The address an Ethereum account's deposits arrive from on an Arbitrum chain. */
export const aliasOf = (a) => `0x${((BigInt(a) + ALIAS) % (1n << 160n)).toString(16).padStart(40, "0")}`;
/** The Ethereum account whose deposits arrive from `a`, if `a` is a shifted address. */
export const unaliasOf = (a) => `0x${((BigInt(a) - ALIAS + (1n << 160n)) % (1n << 160n)).toString(16).padStart(40, "0")}`;
/**
 * A funder that sent ETH to this many wallets in its first 200 transactions is a service (an
 * exchange, a faucet, a bot), not one person: it links no one.
 */
export const SERVICE_FANOUT = 150;

const cache = new Map();
async function api(query) {
  const hit = cache.get(query);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.value;
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(`${EXPLORER}/api?${query}`);
      const j = await r.json();
      // "no transactions found" is an answer; anything else without a list (a rate limit, an error)
      // isn't, and must never be read as "this wallet was never funded"
      if (!Array.isArray(j.result) && !/^No .*found/i.test(j.message || "")) throw new Error(`explorer: ${j.message || r.status}`);
      const value = Array.isArray(j.result) ? j.result : [];
      // the funding index makes tens of thousands of calls in one process: keep memory bounded
      if (cache.size > 5000) cache.clear();
      cache.set(query, { at: Date.now(), value });
      return value;
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((ok) => setTimeout(ok, 800 * 2 ** attempt));
    }
  }
}

const incoming = (rows, w) =>
  rows
    .filter((t) => (t.to || "").toLowerCase() === w && BigInt(t.value || "0") > 0n && t.isError !== "1")
    .map((t) => ({ from: t.from.toLowerCase(), value: BigInt(t.value), at: Number(t.timeStamp), internal: t.type === "call" || t.traceId !== undefined }));

/**
 * Where a wallet's biggest early deposit came from, and what kind of sender that is, from the
 * explorer alone (no record lookups): what the funding index stores.
 */
export async function firstFunder(wallet) {
  const w = wallet.toLowerCase();
  const [plain, internal] = await Promise.all([
    api(`module=account&action=txlist&address=${w}&sort=asc&page=1&offset=20`),
    api(`module=account&action=txlistinternal&address=${w}&sort=asc&page=1&offset=20`),
  ]);
  const ins = [...incoming(plain, w).map((x) => ({ ...x, internal: false })), ...incoming(internal, w).map((x) => ({ ...x, internal: true }))].sort((a, b) => a.at - b.at).slice(0, 10);
  if (!ins.length) return null;
  const big = ins.reduce((a, b) => (b.value > a.value ? b : a));
  const kind = FAUCETS.has(big.from) ? "faucet" : big.from === aliasOf(w) ? "bridge" : big.internal ? "contract" : "wallet";
  return { from: big.from, kind, valueEth: Number(big.value) / 1e18, at: big.at };
}

/** Where a wallet's biggest early deposit came from, naming the Ethereum account behind a deposit. */
export async function funderOf(wallet) {
  const f = await firstFunder(wallet);
  if (!f) return null;
  // a deposit from Ethereum to another address arrives from the depositor's shifted address: name
  // the Ethereum account behind it, which may itself be a launcher
  const l1 = f.kind === "wallet" ? unaliasOf(f.from) : null;
  const l1Rec = l1 ? await launcher(l1, { limit: 0 }).catch(() => null) : null;
  return { ...f, ...(l1Rec ? { bridgedFrom: l1 } : {}) };
}

/** The wallets a funder sent ETH to, from its first 200 transactions. */
export async function fundedBy(funder) {
  const out = await api(`module=account&action=txlist&address=${funder}&sort=asc&page=1&offset=200`);
  const to = new Set();
  for (const t of out) if ((t.from || "").toLowerCase() === funder && BigInt(t.value || "0") > 0n && t.to) to.add(t.to.toLowerCase());
  return { wallets: [...to], truncated: out.length >= 200 };
}

/**
 * A launcher's funding: its funder, and, when the funder is a wallet, the other launchers that
 * wallet funded with their combined record. `skip` leaves out the launcher asked about.
 */
export async function fundingOf(wallet) {
  const f = await funderOf(wallet);
  if (!f) return null;
  if (f.kind !== "wallet") return { funder: f, siblings: [] };
  return { funder: f, ...(await launchersFundedBy(f.from, wallet)) };
}

/** The launchers among the wallets `funder` sent ETH to, each with its record summary. */
export async function launchersFundedBy(funder, skip = null) {
  const { wallets, truncated } = await fundedBy(funder.toLowerCase());
  if (wallets.length >= SERVICE_FANOUT) return { siblings: [], service: true, funded: wallets.length };
  const candidates = wallets.filter((x) => x !== skip?.toLowerCase());
  const recs = await Promise.all(candidates.map((x) => launcher(x, { limit: 0 }).catch(() => null)));
  const siblings = recs
    .filter(Boolean)
    .map((r) => ({ address: r.address, tone: r.tone, launches: r.summary.launches, fastExits: r.summary.fastExits, graduated: r.summary.graduated }))
    .sort((a, b) => b.fastExits - a.fastExits || b.launches - a.launches);
  return { siblings, funded: wallets.length, truncated };
}

/**
 * The warning a fresh wallet can't shake: its funder also funded launchers with a red record.
 * Null when the funder links to no red launcher. A fact about the funder, not a change to the
 * launcher's own colour, which stays the rule on its own launches.
 */
/**
 * The share of the other launchers that must be red for the money to count against a launcher: the
 * same quarter as the colour rule. A big funder (a bot, a service) with a few red users doesn't
 * paint all of them amber; a tight group of red wallets does.
 */
export const RED_SHARE = 0.25;

export function redLink(fd) {
  const sib = fd?.siblings || [];
  const red = sib.filter((x) => x.tone === "exits");
  if (!red.length || red.length / sib.length < RED_SHARE) return null;
  return {
    funder: fd.funder.from,
    ...(fd.funder.bridgedFrom ? { bridgedFrom: fd.funder.bridgedFrom } : {}),
    red: red.length,
    launches: red.reduce((a, x) => a + x.launches, 0),
    fastExits: red.reduce((a, x) => a + x.fastExits, 0),
  };
}

/** The funding path inside a group, from `address` back: the address, its funder, that funder's funder. */
function pathIn(group, address) {
  const up = new Map([...group.launchers, ...group.funders].map((x) => [x.address, x.funder]));
  const out = [address];
  while (out.length < 3 && up.get(out[out.length - 1])) out.push(up.get(out[out.length - 1]));
  return out;
}

/**
 * The funding group a wallet belongs to. From the hourly index when it's there; otherwise, for a
 * wallet newer than the index, read live: its funder's group, or its funder's funder's. `known`
 * is the wallet's funder when the caller already read it.
 */
export async function groupLink(wallet, known = null) {
  const w = wallet.toLowerCase();
  const g = await groupOf(w);
  if (g) return { group: g, path: pathIn(g, w), live: false };
  const f = known ?? (await firstFunder(w));
  if (f?.kind !== "wallet") return null;
  const g1 = await groupOf(f.from);
  if (g1) return { group: g1, path: [w, ...pathIn(g1, f.from)].slice(0, 3), live: true };
  const ff = await firstFunder(f.from);
  if (ff?.kind !== "wallet") return null;
  const g2 = await groupOf(ff.from);
  return g2 ? { group: g2, path: [w, f.from, ff.from], live: true } : null;
}

/**
 * The warning from a group: the other launchers its money links `self` to, and the red ones among
 * them. Null when fewer than a quarter of them are red. The same shape as redLink, plus the group.
 */
export function groupWarning(gl, self) {
  if (!gl) return null;
  const others = gl.group.launchers.filter((x) => x.address !== self.toLowerCase());
  const red = others.filter((x) => x.tone === "exits");
  if (!red.length || red.length / others.length < RED_SHARE) return null;
  return {
    funder: gl.path[1] ?? null,
    path: gl.path,
    group: gl.group.id,
    others: others.length,
    red: red.length,
    launches: red.reduce((a, x) => a + x.launches, 0),
    fastExits: red.reduce((a, x) => a + x.fastExits, 0),
  };
}
