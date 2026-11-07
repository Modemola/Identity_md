// The networks KEPT runs on. Each has its own vault; the site shows one at a time. A network
// without a vault address is hidden until it is deployed (fill in `vault` and `fromBlock`).
// Any value can be overridden from the URL for review or local testing:
// ?net=ethereum&vault=0x…&hook=0x…&token=0x…&rpc=https://…&chain=1&from=123&markets=0x…&marketsFrom=123
export const NETWORKS = {
  robinhood: {
    name: "Robinhood Chain",
    short: "Robinhood",
    chainId: 4663,
    rpc: "https://rpc.mainnet.chain.robinhood.com",
    explorer: "https://robin.etherscan.io",
    vault: "0x3152f9cbf64d0c1ac24ea7e101db3e4d8da86896", // KeptVault, IMD launch #2172
    hook: "0xb5f28198750864e199477a6898bad44ae4d1e0cc", // KeptHook, IMD launch #2185
    token: "0x9b8fd5aa7ac4fe302cb1a50ad90b4900b2924fa3", // KEPT token, IMD launch #2185
    fromBlock: 91910657, // the vault's deploy block: history scans start here
    markets: "", // KeptMarkets: fill in after `launch.mjs markets`
    marketsFrom: 0, // its deploy block
    vault2: "", // KeptVault v2 (docs/VAULT_V2.md): fill in after `launch.mjs vault-v2`
    vault2From: 0, // its deploy block
  },
  ethereum: {
    name: "Ethereum",
    short: "Ethereum",
    chainId: 1,
    rpc: "https://ethereum-rpc.publicnode.com",
    explorer: "https://etherscan.io",
    vault: "", // KeptVault on Ethereum: fill in after `launch.mjs eth-vault`
    hook: "",
    token: "",
    fromBlock: 0,
    markets: "",
    marketsFrom: 0,
    vault2: "",
    vault2From: 0,
  },
};

const isAddr = (v) => /^0x[0-9a-fA-F]{40}$/.test(v || "");
export const LIVE = Object.keys(NETWORKS).filter((k) => isAddr(NETWORKS[k].vault));

const params = new URLSearchParams(location.search);
const pick = (key, fallback) => params.get(key) || fallback;
const stored = (() => {
  try {
    return localStorage.getItem("kept:net");
  } catch {
    return null;
  }
})();
// a link names its network; otherwise the last one chosen; otherwise Robinhood Chain
const wanted = [params.get("net"), stored].find((k) => k && NETWORKS[k] && (LIVE.includes(k) || params.get("vault")));
const net = wanted || "robinhood";
const n = NETWORKS[net];

export const config = {
  net,
  name: n.name,
  short: n.short,
  chainId: Number(pick("chain", n.chainId)),
  rpc: pick("rpc", n.rpc),
  explorer: pick("explorer", n.explorer),
  vault: pick("vault", n.vault),
  hook: pick("hook", n.hook),
  token: pick("token", n.token),
  fromBlock: BigInt(pick("from", n.fromBlock)),
  markets: pick("markets", n.markets),
  marketsFrom: BigInt(pick("marketsFrom", n.marketsFrom || n.fromBlock)),
  vault2: pick("vault2", n.vault2),
  vault2From: BigInt(pick("vault2From", n.vault2From || n.fromBlock)),
  // the KEPT alerts bot's username (scripts/alerts); a pledge page offers one-tap Telegram alerts once set
  telegramBot: "",
  imdApi: "https://api.imd.fun",
  imdExplorer: "https://explorer.imd.fun",
  repo: "https://github.com/modemola/identity_md",
};

export const deployed = isAddr(config.vault);
/** v2 numbers its pledges from here, so a number names its vault. */
export const FIRST_V2 = 1001;
/** KeptVault v2 is live on this network: new pledges are made there. */
export const v2Live = deployed && isAddr(config.vault2);
/** The vault that holds pledge `id`. */
export const vaultOf = (id) => (Number(id) >= FIRST_V2 ? config.vault2 : config.vault);

/** Will they ship? markets are live on this network. */
export const marketsLive = deployed && isAddr(config.markets);

/** The network that serves a chain id, if KEPT is live there. */
export const networkFor = (chainId) => LIVE.find((k) => NETWORKS[k].chainId === chainId);

/** `?net=…` for links into a network other than the default, so shared links open the right vault. */
export const netQuery = (key = net) => (key === "robinhood" ? "" : `?net=${key}`);

/** Switches network: remembered for next time, then the page reloads on `hash` with `extra` params. */
export function setNetwork(key, { hash = location.hash, extra = {} } = {}) {
  try {
    localStorage.setItem("kept:net", key);
  } catch {}
  const q = new URLSearchParams({ ...(key === "robinhood" ? {} : { net: key }), ...extra });
  const s = q.toString();
  location.href = `${location.pathname}${s ? `?${s}` : ""}${hash}`;
}
