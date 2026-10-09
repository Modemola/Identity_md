#!/usr/bin/env node
// Opens a KEPT launch through the IMD paid API (https://imd.fun/docs#paid), from your own wallet.
//
//   node launch.mjs vault --owner 0xYOU [--dry-run]
//   node launch.mjs token --vault 0xVAULT --remainder 0xYOU [--pool-bps 6000] [--dry-run]
//   node launch.mjs site [--name kept] [--dry-run]     (after web/src/config.js has the addresses)
//   node launch.mjs status <label>
//
// The private key is read from KEPT_PRIVATE_KEY, or typed in (hidden) when it is not set. Use a
// fresh wallet that holds only what the launch needs: 0.5 IMD on Ethereum per launch, plus a little
// ETH for the one-time Permit2 approval. Nothing is signed before you confirm the plan.

import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { createPublicClient, createWalletClient, http, erc20Abi, sha256, stringToBytes, getAddress } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { x402Client } from "@x402/core/client";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const API = "https://api.imd.fun";
const REPO = "https://github.com/modemola/identity_md";
const PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78ba3";
const ROBINHOOD = 4663;
const RH = {
  intake: "0x1397434cd35e8a9c8ac312a61d3a285eb31dea56",
  imd: "0x5f7bb59365ce557c26dbcaa4ee9d39a4b95b7127",
  action: "0x6f7261636c652e72657175657374406f7261636c652d31000000000000000000",
  signer: "0x5598aa9146215bc13eb26f2c692ad1461fd32982",
};
const STEPS = [{ skill: "audit-imported-code" }, { skill: "adapt-contract-project" }, { skill: "adversarial-review" }];
const STATE_DIR = new URL("./.orders/", import.meta.url);

// ------------------------------------------------------------------ args

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const dryRun = argv.includes("--dry-run");
const addr = (name) => {
  const v = flag(name);
  if (!v || !/^0x[0-9a-fA-F]{40}$/.test(v)) die(`--${name} 0x… is required`);
  return getAddress(v).toLowerCase();
};

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

// ------------------------------------------------------------------ HTTP

async function api(path, { method = "GET", body, token, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, headers: res.headers };
}

// ------------------------------------------------------------------ launch inputs

async function importRepo(kind = "contracts") {
  const head = await fetch(`https://api.github.com/repos/modemola/identity_md/commits/${flag("ref", "claude/vigilant-hamilton-ggh3sv")}`)
    .then((r) => r.json())
    .catch(() => ({}));
  const ref = flag("commit", head.sha);
  if (!ref) die("could not resolve the commit; pass --commit <40-hex sha>");
  const { status, json } = await api("/requests/import", { method: "POST", body: { url: `${REPO}/commit/${ref}`, kind } });
  if (status !== 200 || !json.ok) die(`import refused: ${JSON.stringify(json)}`);
  return json.source;
}

function vaultInput(source, owner) {
  return {
    objective: [
      "Deploy only src/KeptVault.sol from this repository on Robinhood Chain (chain id 4663), with no changes to the",
      "production source unless an audit finding requires one. KEPT lets any project lock tokens behind milestones that",
      "the IMD oracle checks; kept milestones release to the team, unproven ones are burned.",
      `Constructor arguments in order: owner_ = $owner; intake_ = ${RH.intake} (IMD Intake on Robinhood);`,
      `imd_ = ${RH.imd} (IMD on Robinhood); action_ = ${RH.action} (bytes32 "oracle.request@oracle-1");`,
      `signer_ = ${RH.signer} (IMD oracle signer); panelSize_ = 9; quorum_ = 7.`,
      "No token, pool, hook, ETH or initialization calls. Tests: forge test (offline); docs/VERIFICATION.md records a",
      "Robinhood fork rehearsal against the live Intake, IMD and PoolManager.",
    ].join(" "),
    repoUrl: source.repoUrl,
    baseCommit: source.baseCommit,
    onchain: "evm_contracts",
    chainId: ROBINHOOD,
    owner,
    shape: "chain",
    steps: STEPS,
  };
}

function tokenInput(source, vault, remainder, poolBps) {
  return {
    objective: [
      "Launch the KEPT token with its Uniswap v4 hook on Robinhood Chain (chain id 4663), paired with IMD, from this",
      "repository with no changes to the production source unless an audit finding requires one.",
      "Token: src/KeptToken.sol, name KEPT, symbol KEPT, 18 decimals, fixed 1,000,000,000 supply minted to its deployer,",
      "no constructor arguments, no owner, mint, tax or pause.",
      "Hook: src/KeptHook.sol, constructor arguments in order: $poolManager; IMD on Robinhood",
      `${RH.imd}; $token; the deployed KeptVault ${vault}; $factory.`,
      "Permissions beforeInitialize, beforeSwap, afterSwap, beforeSwapReturnDelta, afterSwapReturnDelta (flags 0x20cc),",
      "CREATE2-mined. Pool fee 12500, tick spacing 60. Only the launch factory may initialize the pool. The hook charges",
      "IMD on the IMD leg of each swap (20% at opening decaying to 1% over 30 minutes, then 1%) as ERC-6909 claims;",
      "anyone can sweep() them into the KeptVault Referee Fund. No owner, proxy or upgrade path.",
      "Tests: forge test (offline); docs/VERIFICATION.md records a Robinhood fork rehearsal on the live PoolManager.",
    ].join(" "),
    repoUrl: source.repoUrl,
    baseCommit: source.baseCommit,
    onchain: "univ4_hook",
    chainId: ROBINHOOD,
    pairWith: "imd",
    economics: { poolBps, remainderTo: remainder },
    shape: "chain",
    steps: STEPS,
  };
}

function siteInput(source, name) {
  if (source.site?.build !== false || source.site?.exportDir !== "dist") {
    die(`expected the committed static export in dist/, got ${JSON.stringify(source.site)}`);
  }
  return {
    objective: `Host the KEPT website: the committed static export in dist/ of this repository, unchanged, under the site name ${name}.`,
    repoUrl: source.repoUrl,
    baseCommit: source.baseCommit,
    ipfs: name,
    shape: "chain",
    steps: [{ skill: "site-content-check" }],
  };
}

// ------------------------------------------------------------------ wallet

async function account() {
  let key = process.env.KEPT_PRIVATE_KEY;
  if (!key) key = await ask("Private key (hidden, never stored): ", true);
  key = key.trim();
  if (!key.startsWith("0x")) key = `0x${key}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) die("that is not a 32-byte private key");
  return privateKeyToAccount(key);
}

function ask(question, hidden = false) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? question : "");
  }
  return new Promise((resolve) =>
    rl.question(question, (a) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(a);
    }),
  );
}

// canonical JSON: sorted keys, no whitespace (the docs' `canon`)
const canon = (v) =>
  v === null
    ? "null"
    : Array.isArray(v)
      ? `[${v.map(canon).join(",")}]`
      : typeof v === "object"
        ? `{${Object.keys(v)
            .sort()
            .map((k) => `${JSON.stringify(k)}:${canon(v[k])}`)
            .join(",")}}`
        : JSON.stringify(v);

// ------------------------------------------------------------------ flow

async function open(label, input, action = "launch.open") {
  console.log(`\n▸ Free check of the ${label} ${action === "job.open" ? "job" : "launch"}…`);
  const check = await api("/requests/check", { method: "POST", body: { action, input } });
  if (check.status !== 200) die(`check failed (${check.status}): ${JSON.stringify(check.json)}`);
  if (check.json.blockers?.length) die(`the check found blockers:\n${JSON.stringify(check.json.blockers, null, 2)}`);
  console.log("  The swarm will:");
  for (const step of check.json.plan || []) console.log(`   · ${step.title}`);
  for (const s of check.json.suggestions || []) console.log(`  suggestion: ${JSON.stringify(s)}`);

  const caps = (await api("/requests/capabilities")).json;
  const launchAction = caps.actions.find((a) => a.action === action);
  const price = BigInt(launchAction.payment.amount);
  console.log(`  Price: ${Number(price) / 1e18} IMD on Ethereum, paid to ${launchAction.payment.payTo}`);

  const token = randomBytes(32).toString("hex");
  const requestKey = randomUUID();
  const quote = await api("/requests/quote", { method: "POST", token, body: { requestKey, action, input } });
  if (quote.status !== 201 && quote.status !== 200) die(`quote refused (${quote.status}): ${JSON.stringify(quote.json)}`);
  const order = quote.json.order;
  mkdirSync(STATE_DIR, { recursive: true });
  const statePath = new URL(`${label}.json`, STATE_DIR);
  writeFileSync(statePath, JSON.stringify({ label, orderId: order.id, token, requestKey, input, createdAt: new Date().toISOString() }, null, 2));
  console.log(`  Quote ${order.id}, valid until ${new Date(order.quote.expiresAt * 1000).toISOString()} (saved to .orders/${label}.json)`);

  const url = `/requests/${order.id}/submit`;
  const challenge = await api(url, { method: "POST", token });
  if (challenge.status !== 402) die(`expected the 402 payment challenge, got ${challenge.status}: ${JSON.stringify(challenge.json)}`);
  const ch = challenge.json;
  const req = ch.accepts[0];
  console.log(`  Challenge: ${req.amount} units of ${req.asset} on ${req.network} via ${req.extra?.assetTransferMethod}`);
  if (BigInt(req.amount) !== price || req.asset.toLowerCase() !== launchAction.payment.asset.toLowerCase()) {
    die("the challenge does not match the advertised price and asset; stopping");
  }

  if (dryRun) {
    console.log("\n✓ Dry run complete: import, check, quote and challenge all succeeded. Nothing was signed or paid.\n");
    return;
  }

  const acct = await account();
  const chainId = Number(req.network.split(":")[1]);
  if (chainId !== 1) die(`unexpected payment network ${req.network}`);
  const rpc = flag("eth-rpc", "https://ethereum-rpc.publicnode.com");
  const pub = createPublicClient({ chain: mainnet, transport: http(rpc) });
  const imd = getAddress(req.asset);
  const [bal, allowance, eth] = await Promise.all([
    pub.readContract({ address: imd, abi: erc20Abi, functionName: "balanceOf", args: [acct.address] }),
    pub.readContract({ address: imd, abi: erc20Abi, functionName: "allowance", args: [acct.address, PERMIT2] }),
    pub.getBalance({ address: acct.address }),
  ]);
  console.log(`\n  Wallet ${acct.address}: ${Number(bal) / 1e18} IMD, ${Number(eth) / 1e18} ETH on Ethereum`);
  if (bal < price) die(`the wallet needs at least ${Number(price) / 1e18} IMD on Ethereum`);

  const go = await ask(`\nOpen the ${label} order and pay ${Number(price) / 1e18} IMD? Type "yes": `);
  if (go.trim().toLowerCase() !== "yes") die("cancelled; nothing was paid");

  if (allowance < price) {
    console.log("  Approving Permit2 for IMD (one-time, needs a little ETH)…");
    const wallet = createWalletClient({ chain: mainnet, transport: http(rpc), account: acct });
    const hash = await wallet.writeContract({ address: imd, abi: erc20Abi, functionName: "approve", args: [PERMIT2, 2n ** 256n - 1n] });
    await pub.waitForTransactionReceipt({ hash });
    console.log(`  Approved: ${hash}`);
  }

  // The challenge may have aged while approving; ask for a fresh one against the same order.
  const fresh = (await api(url, { method: "POST", token })).json;
  const accepted = fresh.accepts[0];
  // x402 refuses non-default assets unless allowed: allow IMD on Ethereum only, capped at the quoted price.
  const client = x402Client.fromConfig({
    schemes: [{ network: accepted.network, client: new ExactEvmScheme(acct) }],
    spendControls: { allowedAssets: [{ network: accepted.network, asset: accepted.asset, maxAmountPerPayment: price.toString() }] },
  });
  const { extensions, ...generated } = await client.createPaymentPayload({ x402Version: 2, resource: fresh.resource, accepts: [accepted] });
  const payment = JSON.parse(JSON.stringify({ ...generated, accepted }));
  const q = fresh.quote;
  const quoteSignature = await acct.signTypedData({
    domain: { name: "IdentityMD Paid Action", version: "1", chainId: Number(q.payment.network.slice(7)) },
    primaryType: "QuoteApproval",
    types: {
      QuoteApproval: [
        { name: "resource", type: "string" },
        { name: "requesterScopeHash", type: "bytes32" },
        { name: "quoteId", type: "string" },
        { name: "quoteHash", type: "bytes32" },
        { name: "paymentHash", type: "bytes32" },
        { name: "action", type: "string" },
        { name: "asset", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "payTo", type: "address" },
        { name: "expiresAt", type: "uint256" },
      ],
    },
    message: {
      resource: fresh.resourceUrl,
      requesterScopeHash: `0x${fresh.requesterScopeHash}`,
      quoteId: q.id,
      quoteHash: `0x${q.quoteHash}`,
      paymentHash: sha256(stringToBytes(canon(payment))),
      action: q.action,
      asset: q.payment.asset,
      amount: BigInt(q.payment.amount),
      payTo: q.payment.payTo,
      expiresAt: BigInt(q.expiresAt),
    },
  });

  console.log("  Submitting payment…");
  const submit = await api(url, {
    method: "POST",
    token,
    headers: { "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(payment) },
    body: { quoteSignature },
  });
  if (submit.status !== 200 && submit.status !== 202) die(`submit refused (${submit.status}): ${JSON.stringify(submit.json)}`);
  await follow(label, order.id, token);
}

async function follow(label, orderId, token) {
  console.log(`  Following order ${orderId}…`);
  for (let i = 0; i < 120; i++) {
    const { json } = await api(`/requests/${orderId}`, { token });
    process.stdout.write(`\r  status: ${json.status}            `);
    if (json.status === "admitted") {
      const r = json.admission?.result || {};
      console.log(`\n\n✓ ${label} admitted.`);
      console.log(`  Job: https://explorer.imd.fun/jobs/${r.jobId}`);
      console.log(`  Status: ${API}${r.statusUrl}`);
      return;
    }
    if (["payment_failed", "expired"].includes(json.status)) die(`order ended as ${json.status}: ${JSON.stringify(json)}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log("\n  Still pending; run `node launch.mjs status <label>` later.");
}

// ------------------------------------------------------------------ main

if (cmd === "vault") {
  const source = await importRepo();
  console.log(`Imported ${source.repoUrl} @ ${source.baseCommit}`);
  await open("vault", vaultInput(source, addr("owner")));
} else if (cmd === "token") {
  const poolBps = Number(flag("pool-bps", "6000"));
  if (!Number.isInteger(poolBps) || poolBps < 1000 || poolBps > 9000) die("--pool-bps must be 1000–9000");
  const source = await importRepo();
  console.log(`Imported ${source.repoUrl} @ ${source.baseCommit}`);
  await open("token", tokenInput(source, addr("vault"), addr("remainder"), poolBps));
} else if (cmd === "site") {
  const name = flag("name", "kept");
  if (!/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(name)) die("--name must be a lowercase site label");
  const source = await importRepo("site");
  console.log(`Imported ${source.repoUrl} @ ${source.baseCommit} (static export in ${source.site.exportDir}/)`);
  await open("site", siteInput(source, name), "job.open");
} else if (cmd === "status") {
  const label = argv[1];
  const path = new URL(`${label}.json`, STATE_DIR);
  if (!label || !existsSync(path)) die("usage: node launch.mjs status <vault|token>");
  const s = JSON.parse(readFileSync(path, "utf8"));
  await follow(label, s.orderId, s.token);
} else {
  console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 11).join("\n").replace(/^\/\/ ?/gm, ""));
}
