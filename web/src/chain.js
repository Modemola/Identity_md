import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  erc20Abi,
  http,
  getAddress,
} from "viem";
import { config } from "./config.js";
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

export const client = createPublicClient({ chain, transport: http(config.rpc, { batch: true }) });

export const Outcome = ["Open", "Kept", "Broken"];
export const Kind = ["GithubRelease", "PageContains", "ContractDeployed", "ValueAtLeast"];

const read = (functionName, args = []) =>
  client.readContract({ address: config.vault, abi: vaultAbi, functionName, args });

// ------------------------------------------------------------------ vault reads

const tokenCache = new Map();

export async function tokenInfo(address) {
  const key = address.toLowerCase();
  if (tokenCache.has(key)) return tokenCache.get(key);
  const p = Promise.all([
    client.readContract({ address, abi: erc20Abi, functionName: "symbol" }).catch(() => "TOKEN"),
    client.readContract({ address, abi: erc20Abi, functionName: "decimals" }).catch(() => 18),
  ]).then(([symbol, decimals]) => ({ address, symbol, decimals: Number(decimals) }));
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

export async function oracleRequest(uuid) {
  const r = await fetch(`${config.imdApi}/oracle/requests/${uuid}?members=0`);
  if (!r.ok) throw new Error(`oracle ${r.status}`);
  return r.json();
}

// ------------------------------------------------------------------ wallet

let wallet = null;
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
  wallet = createWalletClient({ chain, transport: custom(eth), account });
  eth.on?.("accountsChanged", (a) => {
    account = a[0] ? getAddress(a[0]) : null;
    if (account) wallet = createWalletClient({ chain, transport: custom(eth), account });
    emit();
  });
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

/** Simulates first (so reverts surface with their reason), then sends and waits. */
export async function send({ address, abi, functionName, args = [] }) {
  if (!account) await connect();
  await ensureChain();
  const { request } = await client.simulateContract({ address, abi, functionName, args, account });
  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Transaction reverted");
  return receipt;
}

export async function ensureAllowance(token, spender, amount) {
  if (amount === 0n) return;
  const have = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, spender],
  });
  if (have >= amount) return;
  await send({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, amount] });
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
