// Deployment addresses. Filled in after the two IMD launches; until then the site explains
// that KEPT is launching and every page still renders. Any value can be overridden from the URL
// for review or local testing: ?vault=0x…&hook=0x…&token=0x…&rpc=https://…&chain=4663&from=123
const DEFAULTS = {
  chainId: 4663,
  rpc: "https://rpc.mainnet.chain.robinhood.com",
  explorer: "https://robin.etherscan.io",
  vault: "",
  hook: "",
  token: "",
  fromBlock: 0,
};

const params = new URLSearchParams(location.search);
const pick = (key, fallback) => params.get(key) || fallback;

export const config = {
  chainId: Number(pick("chain", DEFAULTS.chainId)),
  rpc: pick("rpc", DEFAULTS.rpc),
  explorer: pick("explorer", DEFAULTS.explorer),
  vault: pick("vault", DEFAULTS.vault),
  hook: pick("hook", DEFAULTS.hook),
  token: pick("token", DEFAULTS.token),
  fromBlock: BigInt(pick("from", DEFAULTS.fromBlock)),
  imdApi: "https://api.imd.fun",
  imdExplorer: "https://explorer.imd.fun",
  repo: "https://github.com/modemola/identity_md",
};

export const deployed = /^0x[0-9a-fA-F]{40}$/.test(config.vault);

/** Query string that carries overrides across in-site links. */
export const carry = (() => {
  const keep = new URLSearchParams();
  for (const k of ["vault", "hook", "token", "rpc", "chain", "from", "explorer"]) {
    if (params.get(k)) keep.set(k, params.get(k));
  }
  const s = keep.toString();
  return s ? `?${s}` : "";
})();
