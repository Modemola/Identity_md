// Shared by deploy.mjs and desk.mjs: the chain, the key prompt and the artifacts.
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const HERE = new URL(".", import.meta.url);
export const args = process.argv.slice(2);
export const flag = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);

/** Robinhood Chain testnet, where vibe/vibe runs. --rpc points elsewhere (a local fork, say). */
export const RPC = flag("rpc", process.env.KEPT_TESTNET_RPC || "https://rpc.testnet.chain.robinhood.com");
export const chain = defineChain({
  id: 46630,
  name: "Robinhood Chain testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Explorer", url: "https://explorer.testnet.chain.robinhood.com" } },
});
export const pub = createPublicClient({ chain, transport: http(RPC) });

export const artifact = (name) => JSON.parse(readFileSync(new URL(`./artifacts/${name}.json`, HERE), "utf8"));

export function die(msg) {
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

/** Hidden prompt: the key is typed, never echoed, never written to disk. */
export function ask(question, hidden = false) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? question : "");
  return new Promise((resolve) =>
    rl.question(question, (a) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(a.trim());
    }),
  );
}

/** The deployer and operator: KEPT_TESTNET_KEY, or typed in hidden. A throwaway testnet key only. */
export async function operatorWallet() {
  let key = process.env.KEPT_TESTNET_KEY || (await ask("Testnet private key (hidden, never saved): ", true));
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) key = `0x${key}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) die("that is not a private key");
  const account = privateKeyToAccount(key);
  return { account, wallet: createWalletClient({ account, chain, transport: http(RPC) }) };
}

export const ACTION = "0x6f7261636c652e72657175657374406f7261636c652d31000000000000000000";
