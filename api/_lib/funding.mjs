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

import { launcher } from "./records.mjs";

const EXPLORER = process.env.KEPT_TESTNET_EXPLORER || "https://explorer.testnet.chain.robinhood.com";
const FAUCETS = new Set(["0x8762f93772c663c6a88ba50900bd5381df2717be"]);
const ALIAS = BigInt("0x1111000000000000000000000000000000001111");
/** The address an Ethereum account's deposits arrive from on an Arbitrum chain. */
export const aliasOf = (a) => `0x${((BigInt(a) + ALIAS) % (1n << 160n)).toString(16).padStart(40, "0")}`;
/** The Ethereum account whose deposits arrive from `a`, if `a` is a shifted address. */
export const unaliasOf = (a) => `0x${((BigInt(a) - ALIAS + (1n << 160n)) % (1n << 160n)).toString(16).padStart(40, "0")}`;
/** A funder sending to more wallets than this is a service (an exchange, a faucet), not one person. */
const SERVICE_FANOUT = 200;

const cache = new Map();
async function api(query) {
  const hit = cache.get(query);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.value;
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(`${EXPLORER}/api?${query}`);
      const j = await r.json();
      const value = Array.isArray(j.result) ? j.result : [];
      cache.set(query, { at: Date.now(), value });
      return value;
    } catch (e) {
      if (attempt >= 2) throw e;
      await new Promise((ok) => setTimeout(ok, 600 * 2 ** attempt));
    }
  }
}

const incoming = (rows, w) =>
  rows
    .filter((t) => (t.to || "").toLowerCase() === w && BigInt(t.value || "0") > 0n && t.isError !== "1")
    .map((t) => ({ from: t.from.toLowerCase(), value: BigInt(t.value), at: Number(t.timeStamp), internal: t.type === "call" || t.traceId !== undefined }));

/** Where a wallet's biggest early deposit came from, and what kind of sender that is. */
export async function funderOf(wallet) {
  const w = wallet.toLowerCase();
  const [plain, internal] = await Promise.all([
    api(`module=account&action=txlist&address=${w}&sort=asc&page=1&offset=20`),
    api(`module=account&action=txlistinternal&address=${w}&sort=asc&page=1&offset=20`),
  ]);
  const ins = [...incoming(plain, w).map((x) => ({ ...x, internal: false })), ...incoming(internal, w).map((x) => ({ ...x, internal: true }))].sort((a, b) => a.at - b.at).slice(0, 10);
  if (!ins.length) return null;
  const big = ins.reduce((a, b) => (b.value > a.value ? b : a));
  const kind = FAUCETS.has(big.from) ? "faucet" : big.from === aliasOf(w) ? "bridge" : big.internal ? "contract" : "wallet";
  // a deposit from Ethereum to another address arrives from the depositor's shifted address: name
  // the Ethereum account behind it, which may itself be a launcher
  const l1 = kind === "wallet" ? unaliasOf(big.from) : null;
  const l1Rec = l1 ? await launcher(l1, { limit: 0 }).catch(() => null) : null;
  return { from: big.from, kind, valueEth: Number(big.value) / 1e18, at: big.at, ...(l1Rec ? { bridgedFrom: l1 } : {}) };
}

/** The wallets a funder sent ETH to, from its first 200 transactions. */
async function fundedBy(funder) {
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
  if (wallets.length > SERVICE_FANOUT) return { siblings: [], service: true, funded: wallets.length };
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
export function redLink(fd) {
  const red = (fd?.siblings || []).filter((x) => x.tone === "exits");
  if (!red.length) return null;
  return {
    funder: fd.funder.from,
    ...(fd.funder.bridgedFrom ? { bridgedFrom: fd.funder.bridgedFrom } : {}),
    red: red.length,
    launches: red.reduce((a, x) => a + x.launches, 0),
    fastExits: red.reduce((a, x) => a + x.fastExits, 0),
  };
}
