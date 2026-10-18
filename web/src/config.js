// Deployment addresses. Filled in after the two IMD launches; until then the site explains
// that KEPT is launching and every page still renders. Any value can be overridden from the URL
// for review or local testing: ?vault=0x…&hook=0x…&token=0x…&rpc=https://…&chain=4663&from=123
const DEFAULTS = {
  chainId: 4663,
  rpc: "https://rpc.mainnet.chain.robinhood.com",
  explorer: "https://robin.etherscan.io",
  vault: "0x3152f9cbf64d0c1ac24ea7e101db3e4d8da86896", // KeptVault, IMD launch #2172
  hook: "0xb5f28198750864e199477a6898bad44ae4d1e0cc", // KeptHook, IMD launch #2185
  token: "0x9b8fd5aa7ac4fe302cb1a50ad90b4900b2924fa3", // KEPT token, IMD launch #2185
  fromBlock: 91910657, // the vault's deploy block: history scans start here
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
