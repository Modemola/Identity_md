#!/usr/bin/env node
// The KEPT test oracle desk: answers checks on the testnet kit, the way the IMD swarm answers them
// on mainnet. Verdicts here are signed by the test oracle key (.oracle-key), not by IMD.
//
//   node desk.mjs                          list checks waiting for an answer, with their questions
//   node desk.mjs answer 1001 1 yes        milestone 1 of pledge 1001: delivered
//   node desk.mjs answer 1001 2 no         not delivered
//   node desk.mjs answer 1001 3 3000000000000000000   a partial-credit milestone: the number read
//
// Answer honestly: the point of the testnet is to rehearse the real thing.

import { existsSync, readFileSync } from "node:fs";
import { decodeErrorResult, decodeEventLog, encodeAbiParameters, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { HERE, args, artifact, chain, die, operatorWallet, pub } from "./common.mjs";

const DEP = new URL("./deployment.json", HERE);
const ORACLE = new URL("./.oracle-key", HERE);
if (!existsSync(DEP)) die("no deployment.json: run deploy.mjs first");
const d = JSON.parse(readFileSync(DEP, "utf8"));
const vault = { address: d.vault2, abi: artifact("KeptVaultV2").abi };
const intake = { address: d.intake, abi: artifact("TestIntake").abi };
const KINDS = ["GitHub release", "Page contains", "Contract deployed", "Value at least", "Value, partial credit"];

/** Every request the vault made on the test Intake, newest last, with its pledge and milestone. */
async function requests() {
  const latest = await pub.getBlockNumber();
  const logs = [];
  for (let from = BigInt(d.vault2From); from <= latest; from += 9_999_999n) {
    const to = from + 9_999_998n > latest ? latest : from + 9_999_998n;
    logs.push(...(await pub.getContractEvents({ ...vault, eventName: "CheckRequested", fromBlock: from, toBlock: to })));
  }
  return logs.map((l) => ({ id: l.args.pledgeId, index: Number(l.args.index), rid: l.args.intakeRequestId, block: l.blockNumber }));
}

async function pending() {
  const out = [];
  for (const r of await requests()) {
    const [target] = await pub.readContract({ ...intake, functionName: "callbacks", args: [r.rid] });
    if (target === "0x0000000000000000000000000000000000000000") continue; // answered
    const m = await pub.readContract({ ...vault, functionName: "milestone", args: [r.id, r.index] });
    if (m[7] !== r.rid) continue; // superseded: the vault cleared it and asked again
    const [, , , appeal] = await pub.readContract({ ...vault, functionName: "milestoneV2", args: [r.id, r.index] });
    const body = JSON.parse(await pub.readContract({ ...vault, functionName: "questionOf", args: [r.id, r.index] }));
    out.push({ ...r, kind: Number(m[0]), title: m[1], deadline: m[2], askedAt: m[8], appeal, body });
  }
  return out;
}

async function list() {
  const p = await pending();
  if (!p.length) return console.log("No checks waiting. Pledges on the testnet vault ask from the KEPT site.");
  for (const r of p) {
    console.log(`\n— pledge ${r.id}, milestone ${r.index + 1}: ${r.title}`);
    console.log(`  ${KINDS[r.kind]}${r.appeal ? " · APPEAL (15 agents, final)" : ""} · asked at block ${r.block}`);
    console.log(`  Q: ${r.body.question}`);
    console.log(`  answer with: node desk.mjs answer ${r.id} ${r.index + 1} ${r.kind === 4 ? "<number, raw units>" : "yes|no"}`);
  }
}

async function answer(pledgeId, milestoneNo, value) {
  const id = BigInt(pledgeId);
  const index = Number(milestoneNo) - 1;
  const r = (await pending()).find((x) => x.id === id && x.index === index);
  if (!r) die(`no check waiting for pledge ${pledgeId}, milestone ${milestoneNo}`);
  const scaled = r.kind === 4;
  let answerType, answer;
  if (scaled) {
    if (!/^\d+$/.test(value)) die("a partial-credit milestone takes the number read, in raw units");
    answerType = 3;
    answer = encodeAbiParameters([{ type: "uint256" }], [BigInt(value)]);
  } else {
    if (!["yes", "no"].includes(value)) die("answer yes or no");
    answerType = 0;
    answer = encodeAbiParameters([{ type: "bool" }], [value === "yes"]);
  }
  if (!existsSync(ORACLE)) die("no .oracle-key here: answer from the computer that deployed the kit");
  const oracle = privateKeyToAccount(readFileSync(ORACLE, "utf8").trim());
  const now = (await pub.getBlock()).timestamp;
  const spec = await pub.readContract({ ...vault, functionName: "milestoneSpec", args: [id, index] });
  const [panelSize, quorum] = r.appeal ? [15, 11] : [9, 7];
  const a = {
    requestId: keccak256(toHex(`kept-test-oracle:${r.rid}`)),
    // chain questions are about their own chain; release and page questions about the vault's
    chainId: [2, 3, 4].includes(r.kind) ? BigInt(spec.chainId) : BigInt(chain.id),
    questionHash: keccak256(toHex(r.body.question)),
    answerType,
    answer,
    figure: scaled ? BigInt(value) : 0n,
    fromBlock: 0n,
    toBlock: 0n,
    blockHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    panelJobId: keccak256(toHex("kept-test-oracle")),
    panelSize,
    quorum,
    agreed: panelSize,
    issuedAt: now < r.askedAt ? r.askedAt : now,
    expiresAt: (now < r.askedAt ? r.askedAt : now) + 86400n,
  };
  const signature = await oracle.signTypedData({
    domain: { name: "IdentityMD Oracle", version: "2", chainId: chain.id, verifyingContract: vault.address },
    types: {
      OracleAttestation: [
        { name: "requestId", type: "bytes32" }, { name: "chainId", type: "uint256" }, { name: "questionHash", type: "bytes32" },
        { name: "answerType", type: "uint8" }, { name: "answer", type: "bytes" }, { name: "figure", type: "uint256" },
        { name: "fromBlock", type: "uint64" }, { name: "toBlock", type: "uint64" }, { name: "blockHash", type: "bytes32" },
        { name: "panelJobId", type: "bytes32" }, { name: "panelSize", type: "uint16" }, { name: "quorum", type: "uint16" },
        { name: "agreed", type: "uint16" }, { name: "issuedAt", type: "uint64" }, { name: "expiresAt", type: "uint64" },
      ],
    },
    primaryType: "OracleAttestation",
    message: a,
  });
  const { wallet } = await operatorWallet();
  const hash = await wallet.writeContract({ ...intake, functionName: "deliver", args: [r.rid, a, signature] });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  const ev = receipt.logs.map((l) => { try { return decodeEventLog({ abi: intake.abi, ...l }); } catch { return null; } }).find((e) => e?.eventName === "Delivered");
  if (ev?.args.ok) {
    console.log(`Delivered: pledge ${pledgeId}, milestone ${milestoneNo} → ${scaled ? `${value} (raw)` : value}. tx ${hash}`);
  } else {
    let why = ev?.args.reason;
    try { why = decodeErrorResult({ abi: vault.abi, data: ev.args.reason }).errorName; } catch {}
    die(`the vault refused the verdict (${why}). The request is still open. tx ${hash}`);
  }
}

// "answer" may come anywhere among the flags (e.g. after --rpc <url>)
const at = args.indexOf("answer");
if (at >= 0) await answer(args[at + 1], args[at + 2], args[at + 3]);
else await list();
