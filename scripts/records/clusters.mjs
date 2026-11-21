// Funding groups: launchers tied together by the money that paid for their wallets.
//
// A launcher can start a fresh wallet, but someone has to send it ETH. This index reads, for every
// vibe/vibe launcher, where its biggest early deposit came from (api/_lib/funding.mjs), then where
// that funder's own money came from: two steps back. Launchers that share a funder, or whose funders
// share a funder, form a group, and the group's record is the sum of its launchers' records.
//
//   node scripts/records/clusters.mjs <records dir>      (the vibe/vibe index, written by indexer.mjs)
//
// It writes, under <records dir>/funding/:
//   edges.json        what was read: wallet -> [funder, kind], and each funder's fan out (kept between runs)
//   nodes/xx.json     address -> group id, for every launcher and funder in a group
//   groups/<id>.json  a group: its launchers with their records, its funders, and its totals
//   meta.json         totals, and the groups with the most fast exits
//
// Links are kept narrow on purpose. Faucets, contracts and a wallet's own deposit from Ethereum link
// no one. A funder that sent ETH to 150 wallets or more is a service and links no one. The second
// step back (a funder's funder) links only when that wallet funded 30 wallets or fewer.

import fs from "node:fs";
import path from "node:path";
import { firstFunder, fundedBy, unaliasOf, SERVICE_FANOUT } from "../../api/_lib/funding.mjs";
import { toneOf } from "../../api/_lib/records.mjs";

const DIR = process.argv[2];
if (!DIR) throw new Error("usage: clusters.mjs <records dir>");
const OUT = path.join(DIR, "funding");
/** At most this many explorer lookups per run, so one run never holds up the hourly records. */
const MAX_LOOKUPS = Number(process.env.KEPT_FUNDING_MAX || 40_000);
/** A funder's funder links its wallets only when it funded this many or fewer. */
const SECOND_STEP_FANOUT = 30;
const CONCURRENCY = 8;
const KIND = { faucet: "f", bridge: "b", contract: "c", wallet: "w" };

const readJson = (p, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
};

// every launcher, with the summary its record is made from
const launchers = new Map();
for (const f of fs.readdirSync(path.join(DIR, "creators"))) {
  const shard = readJson(path.join(DIR, "creators", f), {});
  for (const [a, rec] of Object.entries(shard)) launchers.set(a, rec.summary);
}

// what earlier runs read: wallet -> [funder, kind] ("" funder: no incoming ETH), funder -> [wallets, truncated]
const state = readJson(path.join(OUT, "edges.json"), { edges: {}, fan: {} });
const { edges, fan } = state;
let lookups = 0;
let failed = 0;

async function pool(items, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < items.length && lookups < MAX_LOOKUPS) {
        const x = items[i++];
        lookups++;
        try {
          await fn(x);
        } catch (e) {
          // the explorer said no: try this wallet again next run
          failed++;
        }
      }
    }),
  );
}
const readFunder = async (w) => {
  const f = await firstFunder(w);
  edges[w] = f ? [f.from, KIND[f.kind]] : ["", "n"];
};
const readFan = async (w) => {
  const { wallets, truncated } = await fundedBy(w);
  fan[w] = [wallets.length, truncated ? 1 : 0];
};
// a funder whose fan out couldn't be read links no one this run: never assume it's one person
const isService = (w) => (fan[w]?.[0] ?? Infinity) >= SERVICE_FANOUT;

const t0 = Date.now();
// 1. each launcher's funder
await pool([...launchers.keys()].filter((a) => !edges[a]), readFunder);
const step1 = new Set();
for (const a of launchers.keys()) if (edges[a]?.[1] === "w") step1.add(edges[a][0]);
// 2. each funder: how many wallets it funded, and its own funder
await pool([...step1].filter((f) => !fan[f]), readFan);
await pool([...step1].filter((f) => !edges[f] && !isService(f)), readFunder);
// 3. each funder's funder: how many wallets it funded
const step2 = new Set();
for (const f of step1) if (!isService(f) && edges[f]?.[1] === "w") step2.add(edges[f][0]);
await pool([...step2].filter((g) => !fan[g]), readFan);
console.log(`funding: ${lookups} lookups (${failed} to retry next run) in ${Math.round((Date.now() - t0) / 1000)}s, ${Object.keys(edges).length} wallets read`);

// union-find over launchers and the funders that link them
const parent = new Map();
const find = (x) => {
  while (parent.get(x) !== x) {
    parent.set(x, parent.get(parent.get(x)));
    x = parent.get(x);
  }
  return x;
};
const add = (x) => parent.has(x) || parent.set(x, x);
const union = (a, b) => {
  add(a);
  add(b);
  const [ra, rb] = [find(a), find(b)];
  if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
};
const via = new Map(); // a launcher or funder -> the wallet that funded it, when that link counts
for (const a of launchers.keys()) {
  const [f, kind] = edges[a] ?? [];
  if (kind !== "w" || isService(f)) continue;
  union(a, f);
  via.set(a, f);
}
for (const f of [...via.values()]) {
  if (via.has(f) && launchers.has(f)) continue; // a launcher funding a launcher: already linked by its own edge
  const [g, kind] = edges[f] ?? [];
  if (kind === "w" && !isService(g) && (fan[g]?.[0] ?? Infinity) <= SECOND_STEP_FANOUT) {
    union(f, g);
    via.set(f, g);
  }
  // a deposit from Ethereum arrives from the depositor's shifted address: the Ethereum account,
  // when it launches too, is the same owner
  const l1 = unaliasOf(f);
  if (launchers.has(l1)) union(f, l1);
}

// groups: components with two launchers or more
const members = new Map();
for (const x of parent.keys()) {
  const r = find(x);
  if (!members.has(r)) members.set(r, []);
  members.get(r).push(x);
}
fs.rmSync(path.join(OUT, "groups"), { recursive: true, force: true });
fs.rmSync(path.join(OUT, "nodes"), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "groups"), { recursive: true });
fs.mkdirSync(path.join(OUT, "nodes"), { recursive: true });
const nodes = {};
const index = [];
for (const list of members.values()) {
  const ls = list.filter((x) => launchers.has(x));
  if (ls.length < 2) continue;
  const id = ls.sort()[0];
  const rows = ls
    .map((a) => {
      const s = launchers.get(a);
      return { address: a, tone: toneOf(s), launches: s.launches, fastExits: s.fastExits, graduated: s.graduated, sold: s.sold, funder: via.get(a) ?? null };
    })
    .sort((x, y) => y.fastExits - x.fastExits || y.launches - x.launches);
  const funders = list.filter((x) => !launchers.has(x)).map((f) => ({ address: f, funder: via.get(f) ?? null, funded: fan[f]?.[0] ?? null }));
  const totals = {
    launchers: rows.length,
    red: rows.filter((r) => r.tone === "exits").length,
    launches: rows.reduce((a, r) => a + r.launches, 0),
    fastExits: rows.reduce((a, r) => a + r.fastExits, 0),
    graduated: rows.reduce((a, r) => a + r.graduated, 0),
  };
  fs.writeFileSync(path.join(OUT, "groups", `${id}.json`), JSON.stringify({ id, totals, launchers: rows, funders }));
  for (const x of list) (nodes[x.slice(2, 4)] ??= {})[x] = id;
  index.push({ id, ...totals });
}
for (const [sh, map] of Object.entries(nodes)) fs.writeFileSync(path.join(OUT, "nodes", `${sh}.json`), JSON.stringify(map));
index.sort((a, b) => b.fastExits - a.fastExits || b.launchers - a.launchers);
fs.writeFileSync(path.join(OUT, "edges.json"), JSON.stringify(state));
fs.writeFileSync(
  path.join(OUT, "meta.json"),
  JSON.stringify({
    updatedAt: new Date().toISOString(),
    launchersRead: [...launchers.keys()].filter((a) => edges[a]).length,
    launchers: launchers.size,
    groups: index.length,
    groupedLaunchers: index.reduce((a, g) => a + g.launchers, 0),
    redGroups: index.filter((g) => g.red).length,
    top: index.slice(0, 50),
  }),
);
console.log(`funding: ${index.length} groups, ${index.reduce((a, g) => a + g.launchers, 0)} launchers in them, ${index.filter((g) => g.red).length} with a red launcher`);
