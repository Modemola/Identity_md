// Deploys KeptBond beside the testnet KeptVaultV2: ETH behind a promise, paid to holders when it
// breaks (docs/BONDS.md).
//
//   node deploy-bond.mjs --dry-run      the plan and the cost, nothing sent
//   node deploy-bond.mjs                deploys; the key from KEPT_TESTNET_KEY or a hidden prompt
//
// The vault comes from deployment.json when it's here, else the kit's live testnet vault. ETH no
// one sells for in a bond's 30-day auction goes to the deploying wallet (or --leftover 0x…).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { formatEther, getAddress, isAddress } from "viem";
import { HERE, args, artifact, chain, die, operatorWallet, pub } from "./common.mjs";

const DRY = args.includes("--dry-run");
const KIT = new URL("./deployment.json", HERE);
const OUT = new URL("./bond.json", HERE);
const LIVE_VAULT = "0x2e46f4bdddc8664982b2266462d70c056cdf7ee2";

if ((await pub.getChainId()) !== chain.id) die(`the RPC is not Robinhood Chain testnet (${chain.id})`);
if (existsSync(OUT) && !args.includes("--again")) die("bond.json exists: KeptBond is already deployed. Pass --again to deploy a new one.");
const vault = getAddress(existsSync(KIT) ? JSON.parse(readFileSync(KIT, "utf8")).vault2 : LIVE_VAULT);
if (((await pub.getCode({ address: vault })) ?? "0x").length <= 2) die(`no KeptVaultV2 at ${vault}`);

const { account, wallet } = await operatorWallet();
const flag = args.indexOf("--leftover");
const leftover = flag >= 0 ? args[flag + 1] : account.address;
if (!isAddress(leftover)) die("--leftover needs an address");
const balance = await pub.getBalance({ address: account.address });
const { abi, bytecode } = artifact("KeptBond");
const gas = BigInt(bytecode.length / 2) * 220n + 60_000n;
const gasPrice = await pub.getGasPrice();
console.log(`Vault:     ${vault}`);
console.log(`Leftover:  ${getAddress(leftover)} (gets auction ETH nobody sold for after 30 days)`);
console.log(`Deployer:  ${account.address} · ${formatEther(balance)} testnet ETH`);
console.log(`About ${formatEther(gas * gasPrice)} testnet ETH at ${Number(gasPrice) / 1e9} gwei.`);
if (DRY) {
  console.log("\nDry run: nothing sent.");
  process.exit(0);
}
if (balance === 0n) die("this address has no testnet ETH");

const hash = await wallet.deployContract({ abi, bytecode, args: [vault, getAddress(leftover)] });
const r = await pub.waitForTransactionReceipt({ hash });
if (r.status !== "success") die(`deploy failed: ${hash}`);
const record = { network: "Robinhood Chain testnet", chainId: chain.id, bond: r.contractAddress, bondFrom: Number(r.blockNumber), vault, leftoverTo: getAddress(leftover), deployedAt: new Date().toISOString() };
writeFileSync(OUT, `${JSON.stringify(record, null, 2)}\n`);
console.log(`\n  KeptBond  ${r.contractAddress}  (tx ${hash})`);
console.log("\nDeployed. Wrote scripts/testnet/bond.json: send its contents to wire the site.");
