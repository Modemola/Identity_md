import { createClient, custom, defineChain, erc20Abi, http, getAddress } from "viem";
// Single actions instead of createPublicClient/createWalletClient: those decorate the client with
// every action viem has (signature verification, ENS, EIP-6492...) and pull ~100 KB of curves and
// helpers into the bundle that KEPT never calls.
import { readContract, getBlockNumber, getContractEvents, simulateContract, waitForTransactionReceipt, writeContract } from "viem/actions";
import { config } from "./config.js";
import { load, put, peek, epoch } from "./store.js";
import vaultAbi from "./abi/KeptVault.json";
import hookAbi from "./abi/KeptHook.json";

export { vaultAbi, hookAbi, erc20Abi };

export const chain = defineChain({
  id: config.chainId,
  name: config.chainId === 4663 ? "Robinhood Chain" : `Chain ${config.chainId}`,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [config.rpc] } },
  blockExplorers: { default: { name: "Explorer", url: config.explorer } },
});

const base = createClient({ chain, transport: http(config.rpc, { batch: { wait: 8 }, retryCount: 2, retryDelay: 250, timeout: 12_000 }) });

/** The few public actions KEPT uses, with the same call shapes as a viem public client. */
export const client = {
  readContract: (args) => readContract(base, args),
  getBlockNumber: () => getBlockNumber(base, { cacheTime: 2_000 }),
  getContractEvents: (args) => getContractEvents(base, args),
  simulateContract: (args) => simulateContract(base, args),
  waitForTransactionReceipt: (args) => waitForTransactionReceipt(base, args),
};

export const Outcome = ["Open", "Kept", "Broken"];
export const Kind = ["GithubRelease", "PageContains", "ContractDeployed", "ValueAtLeast"];

const read = (functionName, args = []) =>
  client.readContract({ address: config.vault, abi: vaultAbi, functionName, args });

// ------------------------------------------------------------------ vault reads

const tokenCache = new Map();

export async function tokenInfo(address) {
  const key = address.toLowerCase();
  if (tokenCache.has(key)) return tokenCache.get(key);
  const known = peek(`token:${key}`);
  if (known) {
    tokenCache.set(key, Promise.resolve(known));
    return known;
  }
  // decimals must be real: a guessed 18 would mis-scale every amount. Only successful reads are
  // cached, so a transient RPC failure is retried next time. The symbol may fall back.
  const p = Promise.all([
    client.readContract({ address, abi: erc20Abi, functionName: "symbol" }).catch(() => "TOKEN"),
    client.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
  ]).then(([symbol, decimals]) => put(`token:${key}`, { address, symbol, decimals: Number(decimals) }));
  p.catch(() => tokenCache.delete(key));
  tokenCache.set(key, p);
  return p;
}

export async function vaultConstants() {
  const [grace, maxAttempts, refereeFund, imd, panelSize, quorum, owner, pledgeCount, pending] = await Promise.all([
    read("GRACE"),
    read("MAX_ATTEMPTS"),
    read("refereeFund"),
    read("imd"),
    read("panelSize"),
    read("quorum"),
    read("owner"),
    read("pledgeCount"),
    read("pendingProtocol"),
  ]);
  const [pIntake, pAction, pSigner, readyAt] = pending;
  const pendingChange = readyAt ? { intake: pIntake, action: pAction, signer: pSigner, readyAt } : null;
  return { grace, maxAttempts, refereeFund, imd, panelSize, quorum, owner, pledgeCount, pendingChange };
}

export async function loadPledge(id) {
  const p = await read("pledge", [BigInt(id)]);
  const [creator, beneficiary, token, name, createdAt, count, open, locked, budget, panelSize, quorum] = p;
  const milestones = await Promise.all(
    Array.from({ length: Number(count) }, (_, i) => loadMilestone(id, i)),
  );
  return {
    id: Number(id),
    creator,
    beneficiary,
    token,
    name,
    createdAt,
    count: Number(count),
    open: Number(open),
    locked,
    budget,
    panelSize,
    quorum,
    milestones,
    tokenInfo: await tokenInfo(token),
  };
}

export async function loadMilestone(id, index) {
  const [m, spec, question, gate] = await Promise.all([
    read("milestone", [BigInt(id), index]),
    read("milestoneSpec", [BigInt(id), index]),
    read("questionOf", [BigInt(id), index]),
    read("checkOpen", [BigInt(id), index]),
  ]);
  const [kind, title, deadline, amount, outcome, settled, attempts, inFlight, askedAt] = m;
  return {
    index,
    kind: Number(kind),
    title,
    deadline,
    amount,
    outcome: Number(outcome),
    settled,
    attempts: Number(attempts),
    inFlight,
    askedAt,
    spec,
    question,
    gate: { open: gate[0], funded: gate[1] },
  };
}

export async function loadAllPledges() {
  const count = Number(await read("pledgeCount"));
  const ids = Array.from({ length: count }, (_, i) => count - i);
  return Promise.all(ids.map(loadPledge));
}

// ------------------------------------------------------------------ cached accessors (see store.js)

/** Every pledge, newest first. Also primes each pledge's own cache entry, so opening one is instant. */
export function getPledges({ maxAge = 0 } = {}) {
  return load("pledges", async () => {
    const e0 = epoch();
    const all = await loadAllPledges();
    // if a transaction invalidated anything while this read was in flight, its copies may predate
    // it: then only the list is returned, and each pledge keeps its own (fresher) entry
    if (epoch() === e0) for (const p of all) put(`pledge:${p.id}`, p);
    return all;
  }, { maxAge });
}

export function getPledge(id, { maxAge = 0 } = {}) {
  return load(`pledge:${id}`, () => loadPledge(id), { maxAge });
}

export function getConstants({ maxAge = 0 } = {}) {
  return load("constants", vaultConstants, { maxAge });
}

export function getHistory(id, { maxAge = 0 } = {}) {
  return load(`history:${id}`, () => pledgeHistory(id), { maxAge });
}

/** Cached-or-nothing, for painting the first frame. */
export const cachedPledges = () => peek("pledges");
export const cachedPledge = (id) => peek(`pledge:${id}`) ?? peek("pledges")?.find((p) => p.id === Number(id));
export const cachedConstants = () => peek("constants");
export const cachedHistory = (id) => peek(`history:${id}`);

/** Warms a pledge page's data before the click lands (hover, focus, touchstart). */
export function prefetchPledge(id) {
  getPledge(id, { maxAge: 15_000 }).catch(() => {});
  getHistory(id, { maxAge: 30_000 }).catch(() => {});
  getConstants({ maxAge: 60_000 }).catch(() => {});
}

export async function previewQuestion(input) {
  return read("previewQuestion", [input]);
}

// ------------------------------------------------------------------ events

/** getLogs over [from, latest], halving the span whenever the RPC refuses a range. */
async function logsInChunks(event, args) {
  const latest = await client.getBlockNumber();
  let from = config.fromBlock;
  let span = 500_000n;
  const out = [];
  while (from <= latest) {
    const to = from + span - 1n > latest ? latest : from + span - 1n;
    try {
      const logs = await client.getContractEvents({
        address: config.vault,
        abi: vaultAbi,
        eventName: event,
        args,
        fromBlock: from,
        toBlock: to,
      });
      out.push(...logs);
      from = to + 1n;
    } catch (e) {
      if (span <= 1_000n) throw e;
      span /= 2n;
    }
  }
  return out;
}

export async function pledgeHistory(id) {
  const args = { pledgeId: BigInt(id) };
  const [verdicts, checks, settles, rebates] = await Promise.all([
    logsInChunks("Verdict", args),
    logsInChunks("CheckRequested", args),
    logsInChunks("Settled", args),
    logsInChunks("Rebated", args),
  ]);
  return { verdicts, checks, settles, rebates };
}

// ------------------------------------------------------------------ oracle

/** The attestation's requestId is the oracle UUID's sixteen bytes, left-aligned. */
export function uuidFromBytes32(b) {
  const h = b.slice(2, 34);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** An oracle request's record. Settled requests do not change, so one read per tab is enough. */
export function oracleRequest(uuid) {
  return load(`oracle:${uuid}`, async () => {
    const r = await fetch(`${config.imdApi}/oracle/requests/${uuid}?members=0`);
    if (!r.ok) throw new Error(`oracle ${r.status}`);
    return r.json();
  }, { maxAge: Infinity });
}

// ------------------------------------------------------------------ wallet

let wallet = null;
let listening = false;
let account = null;
const listeners = new Set();

export const onAccount = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const currentAccount = () => account;
const emit = () => listeners.forEach((fn) => fn(account));

export async function connect() {
  const eth = window.ethereum;
  if (!eth) throw new Error("No wallet found. Install a browser wallet such as MetaMask or Rabby.");
  const [addr] = await eth.request({ method: "eth_requestAccounts" });
  account = getAddress(addr);
  wallet = createClient({ chain, transport: custom(eth), account });
  if (!listening) {
    listening = true;
    eth.on?.("accountsChanged", (a) => {
      account = a[0] ? getAddress(a[0]) : null;
      if (account) wallet = createClient({ chain, transport: custom(eth), account });
      emit();
    });
  }
  emit();
  return account;
}

async function ensureChain() {
  const eth = window.ethereum;
  const hex = `0x${config.chainId.toString(16)}`;
  const current = await eth.request({ method: "eth_chainId" });
  if (current === hex) return;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (e) {
    if (e.code !== 4902) throw e;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hex,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: [config.rpc],
          blockExplorerUrls: [config.explorer],
        },
      ],
    });
  }
}

/**
 * Simulates first (so reverts surface with their reason), then sends and waits.
 * `onPhase` hears "sign" (waiting on the wallet), "pending" (with the hash) and "confirmed".
 */
export async function send({ address, abi, functionName, args = [] }, onPhase = () => {}) {
  if (!account) await connect();
  await ensureChain();
  const { request } = await client.simulateContract({ address, abi, functionName, args, account });
  onPhase("sign");
  const hash = await writeContract(wallet, request);
  onPhase("pending", hash);
  const receipt = await client.waitForTransactionReceipt({ hash, pollingInterval: 1_000 });
  onPhase("confirmed", hash);
  if (receipt.status !== "success") throw new Error("Transaction reverted");
  return receipt;
}

/** Approves `spender` for `amount` unless it already can spend that much. Returns whether it sent a tx. */
export async function needsAllowance(token, spender, amount) {
  if (amount === 0n) return false;
  if (!account) await connect();
  const have = await client.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [account, spender] });
  return have < amount;
}

export async function ensureAllowance(token, spender, amount, onPhase) {
  if (amount === 0n) return;
  const have = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, spender],
  });
  if (have >= amount) return;
  await send({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, amount] }, onPhase);
}

export async function balanceOf(token, who) {
  return client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [who] });
}

/** Human-readable reason from a viem error, preferring the contract's custom error name. */
export function reason(e) {
  const name = e?.cause?.data?.errorName || e?.data?.errorName;
  if (name) return name.replace(/([a-z])([A-Z])/g, "$1 $2");
  return e?.shortMessage || e?.message || String(e);
}
