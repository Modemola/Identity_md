#!/usr/bin/env node
// KEPT verdict bot: watches the vault for settled milestones and posts each one to X with its card.
//
//   node bot.mjs                  watch, and write each post to out/ (nothing is posted)
//   node bot.mjs --post           watch and post to X (needs the four X_* keys, see README)
//   node bot.mjs --once           one pass, then exit (for cron)
//   node bot.mjs --since 93300000 start from this block instead of where the last run stopped
//   node bot.mjs --chain 1        KEPT's Ethereum vault (default: Robinhood Chain, 4663)
//
// It never posts the same milestone twice: what it has seen is kept in .state.json.

import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { verdictCard, verdictPost } from "../../api/_lib/cards.mjs";
import { NETS, TOPIC, lastVerdict, readPledge, rpc, vaultLogs } from "../../api/_lib/vault.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);

const CHAIN = opt("--chain") || "4663";
const NET = NETS[CHAIN];
const POST = flag("--post");
let since = opt("--since"); // applies to the first pass only
const ONCE = flag("--once");
const EVERY = Number(opt("--every") || 60) * 1000;
const OUT = join(HERE, "out");
const STATE = join(HERE, ".state.json");
const FONTS = ["IBMPlexMono-SemiBold.ttf", "IBMPlexMono-Regular.ttf"].map((f) => join(HERE, "../../api/_lib/fonts", f));

if (!NET || !NET.vault) {
  console.error(`KEPT has no vault on chain ${CHAIN} yet.`);
  process.exit(1);
}
const X = { key: process.env.X_API_KEY, secret: process.env.X_API_SECRET, token: process.env.X_ACCESS_TOKEN, tokenSecret: process.env.X_ACCESS_SECRET };
if (POST && Object.values(X).some((v) => !v)) {
  console.error("--post needs X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN and X_ACCESS_SECRET. See README.md.");
  process.exit(1);
}

// ------------------------------------------------------------------ state

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
state[CHAIN] ??= { block: null, done: [] };
const mine = state[CHAIN];
const save = () => writeFileSync(STATE, `${JSON.stringify(state, null, 2)}\n`);

// ------------------------------------------------------------------ X

const pct = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** OAuth 1.0a header. Body parameters are left out: both requests send JSON or multipart. */
function oauth(method, url) {
  const o = {
    oauth_consumer_key: X.key,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: X.token,
    oauth_version: "1.0",
  };
  const params = Object.keys(o).sort().map((k) => `${pct(k)}=${pct(o[k])}`).join("&");
  const base = [method, pct(url), pct(params)].join("&");
  o.oauth_signature = createHmac("sha1", `${pct(X.secret)}&${pct(X.tokenSecret)}`).update(base).digest("base64");
  return `OAuth ${Object.keys(o).sort().map((k) => `${pct(k)}="${pct(o[k])}"`).join(", ")}`;
}

async function uploadImage(png) {
  const url = "https://api.x.com/2/media/upload";
  const form = new FormData();
  form.append("media", new Blob([png], { type: "image/png" }), "verdict.png");
  form.append("media_category", "tweet_image");
  const r = await fetch(url, { method: "POST", headers: { authorization: oauth("POST", url) }, body: form });
  const j = await r.json().catch(() => ({}));
  const id = j.data?.id ?? j.media_id_string;
  if (!r.ok || !id) throw new Error(`media upload ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return id;
}

async function postToX(text, png) {
  const media = await uploadImage(png);
  const url = "https://api.x.com/2/tweets";
  const r = await fetch(url, {
    method: "POST",
    headers: { authorization: oauth("POST", url), "content-type": "application/json" },
    body: JSON.stringify({ text, media: { media_ids: [media] } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`post ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j.data?.id;
}

// ------------------------------------------------------------------ the loop

function render(svg) {
  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "IBM Plex Mono" } }).render().asPng();
}

async function handle(pledgeId, index) {
  const key = `${pledgeId}:${index}`;
  if (mine.done.includes(key)) return;
  const p = await readPledge(NET, pledgeId);
  const v = await lastVerdict(NET, pledgeId, index);
  const text = verdictPost(p, index, v, CHAIN);
  const png = render(verdictCard(p, index, v));
  mkdirSync(OUT, { recursive: true });
  const base = join(OUT, `chain${CHAIN}-pledge${pledgeId}-m${index + 1}`);
  writeFileSync(`${base}.png`, png);
  writeFileSync(`${base}.txt`, `${text}\n`);
  if (POST) {
    const id = await postToX(text, png);
    console.log(`posted pledge #${pledgeId} milestone ${index + 1}: https://x.com/i/status/${id}`);
  } else {
    console.log(`ready: pledge #${pledgeId} milestone ${index + 1} -> ${base}.png (run with --post to publish)\n${text}\n`);
  }
  mine.done.push(key);
  save();
}

async function pass() {
  const latest = Number(await rpc(NET, "eth_blockNumber", []));
  // first run: start from now, so a fresh bot does not post the whole history
  const from = since ? Number(since) : mine.block != null ? mine.block + 1 : latest;
  if (from > latest) return;
  const { logs } = await vaultLogs(NET, [TOPIC.settled], { from, to: latest });
  for (const l of logs) await handle(Number(BigInt(l.topics[1])), Number(BigInt(l.topics[2])));
  mine.block = latest;
  since = undefined;
  save();
  if (!logs.length) console.log(`${new Date().toISOString()} block ${latest}: nothing new`);
}

console.log(`KEPT verdict bot · ${NET.name} · vault ${NET.vault} · ${POST ? "POSTING to X" : "dry run, writing to out/"}`);
do {
  try {
    await pass();
  } catch (e) {
    console.error(`${new Date().toISOString()} ${e.message}`);
    if (ONCE) process.exitCode = 1;
  }
  if (!ONCE) await new Promise((r) => setTimeout(r, EVERY));
} while (!ONCE);
