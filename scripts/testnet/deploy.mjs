#!/usr/bin/env node
// Deploys KEPT's testnet kit on Robinhood Chain testnet, where vibe/vibe runs:
//   TestIMD (check token with a faucet), TestIntake (stands in for IMD's), KeptQuestionsV2, KeptVaultV2.
//
//   node deploy.mjs --dry-run      the plan and the cost, nothing sent
//   node deploy.mjs                deploy (asks for a throwaway testnet key, hidden)
//
// It also makes the test oracle key: a fresh key, saved only on this computer in .oracle-key, whose
// address the vault trusts for verdicts. Keep it: desk.mjs signs verdicts with it.
// The addresses go to deployment.json, which the site and APIs read.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { formatEther, parseEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { ACTION, HERE, args, artifact, chain, die, operatorWallet, pub } from "./common.mjs";

const DRY = args.includes("--dry-run");
const ORACLE = new URL("./.oracle-key", HERE);
const OUT = new URL("./deployment.json", HERE);

if ((await pub.getChainId()) !== chain.id) die(`the RPC is not Robinhood Chain testnet (${chain.id})`);
if (existsSync(OUT) && !args.includes("--again")) die("deployment.json exists: the kit is already deployed. Pass --again to deploy a new one.");

// the oracle key: reuse one already made on this computer, else make one
const existing = existsSync(ORACLE) ? readFileSync(ORACLE, "utf8").trim() : null;
const oracleKey = existing ?? generatePrivateKey();
const oracle = privateKeyToAccount(oracleKey);
console.log(`Test oracle signer: ${oracle.address}${existing ? " (existing key in .oracle-key)" : " (new key, saved to .oracle-key when you deploy)"}`);

const { account, wallet } = await operatorWallet();
const balance = await pub.getBalance({ address: account.address });
console.log(`Operator and owner: ${account.address} · ${formatEther(balance)} testnet ETH`);

const plan = [
  ["TestIMD", []],
  ["TestIntake", (d) => [account.address, account.address, parseEther("0.5")]],
  ["KeptQuestionsV2", []],
  ["KeptVaultV2", (d) => [account.address, d.TestIntake, d.TestIMD, ACTION, oracle.address, 9, 7, d.KeptQuestionsV2]],
];

// cost: estimate each deploy at today's gas price
const gasPrice = await pub.getGasPrice();
let gas = 0n;
for (const [name] of plan) gas += BigInt(artifact(name).bytecode.length / 2) * 220n + 60_000n; // rough: initcode-heavy deploys
console.log(`\nPlan: deploy ${plan.map(([n]) => n).join(", ")}.`);
console.log(`About ${formatEther(gas * gasPrice)} testnet ETH at ${Number(gasPrice) / 1e9} gwei.`);
if (DRY) {
  console.log("\nDry run: nothing sent.");
  process.exit(0);
}
if (balance === 0n) die("this address has no testnet ETH: get some from the Robinhood Chain testnet faucet first");
// saved before anything is sent: the vault will trust exactly this key's address
if (!existing) writeFileSync(ORACLE, `${oracleKey}\n`, { mode: 0o600 });

const done = {};
let firstBlock = null;
for (const [name, ctor] of plan) {
  const { abi, bytecode } = artifact(name);
  const hash = await wallet.deployContract({ abi, bytecode, args: typeof ctor === "function" ? ctor(done) : ctor });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") die(`${name} deploy failed: ${hash}`);
  done[name] = r.contractAddress;
  firstBlock ??= r.blockNumber;
  console.log(`  ${name.padEnd(16)} ${r.contractAddress}  (tx ${hash})`);
}

const record = {
  network: "Robinhood Chain testnet",
  chainId: chain.id,
  explorer: chain.blockExplorers.default.url,
  vault2: done.KeptVaultV2,
  vault2From: Number(firstBlock),
  intake: done.TestIntake,
  imd: done.TestIMD,
  questions: done.KeptQuestionsV2,
  oracleSigner: oracle.address,
  operator: account.address,
  testOracle: true,
  deployedAt: new Date().toISOString(),
};
writeFileSync(OUT, `${JSON.stringify(record, null, 2)}\n`);
console.log(`\nDeployed. Wrote scripts/testnet/deployment.json. Send it (not .oracle-key) to wire the site.`);
console.log(`Get test IMD for checks from the faucet: TestIMD.faucet() on ${done.TestIMD}, 100 a day.`);
