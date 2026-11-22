// KEPT record: who is behind a token, and what they did with their other launches.
//
//   /api/record?q=0x…        a token or a wallet
//   /api/record?q=123        a launch number: vibe/vibe (both factories) and IMD are searched
//   &source=imd              show an IMD launch first when a number names both (the site sends this on mainnet)
//   &format=svg              a 20 px badge instead of JSON
//   ?view=top | imd | groups  the fastest exits, IMD launches that sold, the funding groups board
//                             (&net=imd for IMD's groups on mainnet)
//
// Reads two launcher indexes, refreshed hourly: vibe/vibe on Robinhood Chain testnet
// (scripts/records/indexer.mjs) and IMD launches on Robinhood Chain mainnet (scripts/records/imd.mjs),
// plus the wallet's KEPT pledges on every network. Facts only: launches, and the launcher's own
// sales into its launches' pools or curves.

import { meta, launcher, findLaunches, liveLaunch, fmtEth, FACTORY_LABEL, imdMeta, imdLauncher, findImd, IMD_POOL_MANAGER } from "./_lib/records.mjs";
import { NETS, isLive } from "./_lib/vault.mjs";
import { allPledges, scoreOf } from "./score.mjs";
import { holdings, pctText } from "./_lib/holdings.mjs";
import { fundingOf, launchersFundedBy, unaliasOf, redLink, groupLink, groupWarning, RED_SHARE } from "./_lib/funding.mjs";
import { groupOf, groupsMeta } from "./_lib/records.mjs";

const TESTNET_RPC = process.env.KEPT_RPC_46630 || "https://rpc.testnet.chain.robinhood.com";
const MAINNET_RPC = process.env.KEPT_RPC || "https://rpc.mainnet.chain.robinhood.com";

const reply = (body, type, status, maxAge) =>
  new Response(body, {
    status,
    headers: {
      "content-type": type,
      "cache-control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=600`,
      "access-control-allow-origin": "*",
    },
  });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const MONO = "'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const TONE = { exits: "#ff6b62", sold: "#f0b429", clean: "#3ecf7a", new: "#9aa3ad", none: "#6b7580" };

function badge(text, tone) {
  const left = 62;
  const right = Math.round(text.length * 6.6 + 20);
  const w = left + right;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="KEPT record: ${esc(text)}">
<title>KEPT record: ${esc(text)} · facts from public chain logs</title>
<rect width="${w}" height="20" rx="3" fill="#0b0d0c"/>
<rect x="${left}" width="${right}" height="20" rx="3" fill="${TONE[tone]}"/>
<rect x="${left}" width="6" height="20" fill="${TONE[tone]}"/>
<text x="10" y="14" fill="#fff" font-family="${MONO}" font-size="11" font-weight="600" letter-spacing="1">KEPT</text>
<text x="${left + 10}" y="14" fill="#0b0d0c" font-family="${MONO}" font-size="11" font-weight="600">${esc(text)}</text>
</svg>`;
}

/** The wallet's KEPT pledges, on every network KEPT runs (testnet included, labelled by chain). */
async function pledgesOf(wallet) {
  const nets = Object.entries(NETS).filter(([, n]) => isLive(n));
  const every = (await Promise.all(nets.map(([id, n]) => allPledges(Number(id), n).catch(() => [])))).flat();
  const mine = every.filter((p) => p.beneficiary === wallet.toLowerCase());
  return { ...scoreOf(mine), pledges: mine.map((p) => ({ chainId: p.chainId, id: p.id, name: p.name, testOracle: p.testOracle })) };
}

/**
 * A record with a launch the hourly index hasn't read yet: put first, and said plainly. A wallet
 * with nothing else on record gets a first-launch record from it.
 */
function withLive(rec, l) {
  const note = { tone: "caution", text: `$${l.symbol || "?"} launched after the last hourly update, so its buys and the launcher's sales aren't counted here yet.` };
  if (rec) return { ...rec, facts: [note, ...rec.facts], launches: [l, ...rec.launches] };
  const summary = { launches: 1, graduated: 0, sold: 0, fastExits: 0, buys: 0, buyersIn: "0", creatorIn: "0", creatorOut: "0", ethLaunches: l.pairIsEth ? 1 : 0 };
  return { address: l.creator, summary, tone: "new", facts: [note], launches: [l] };
}

/** The explorer is a nice-to-have: a slow answer never holds up the record. */
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") || params.get("token") || params.get("wallet") || "").trim();
  const svg = params.get("format") === "svg";
  // the index's totals and the launchers with the most quick exits, for KEPT's home page
  if (params.get("view") === "top") {
    try {
      const m = await meta();
      if (!m) throw new Error("index missing");
      const { blockTimes, fastExitLeaders, ...rest } = m;
      const leaders = fastExitLeaders.slice(0, Math.min(100, Number(params.get("limit")) || 20)).map((l) => ({ ...l, creatorOutEth: fmtEth(Number(BigInt(l.creatorOut)) / 1e18), buyersInEth: fmtEth(Number(BigInt(l.buyersIn)) / 1e18) }));
      const t = m.totals;
      return reply(JSON.stringify({ ...rest, totals: { ...t, buyersInEth: fmtEth(Number(BigInt(t.buyersIn)) / 1e18), creatorOutEth: fmtEth(Number(BigInt(t.creatorOut)) / 1e18), creatorInEth: fmtEth(Number(BigInt(t.creatorIn)) / 1e18) }, leaders }, null, 2), "application/json", 200, 300);
    } catch {
      return reply(JSON.stringify({ error: "record unavailable, retrying shortly" }), "application/json", 503, 30);
    }
  }
  // funding groups: launchers tied together by the wallets that funded them, the red ones first
  if (params.get("view") === "groups") {
    try {
      const gm = await groupsMeta(params.get("net") === "imd" ? "imd" : "vibevibe");
      if (!gm?.list) throw new Error("groups missing");
      // the board lists the groups that turn their launchers amber: at least a quarter red
      const red = gm.list.filter((g) => g.red && g.red / g.launchers >= RED_SHARE).sort((a, b) => b.fastExits - a.fastExits || b.red - a.red);
      const limit = Math.min(200, Number(params.get("limit")) || 100);
      const body = {
        updatedAt: gm.updatedAt,
        totals: { launchers: gm.launchers, launchersRead: gm.launchersRead, groups: gm.groups, groupedLaunchers: gm.groupedLaunchers, redGroups: red.length, redGroupLaunchers: red.reduce((a, g) => a + g.launchers, 0), redGroupFastExits: red.reduce((a, g) => a + g.fastExits, 0) },
        rule: "Groups where at least a quarter of the launchers have a red record, by how many launches their launchers sold into within an hour.",
        groups: red.slice(0, limit),
      };
      return reply(JSON.stringify(body, null, 2), "application/json", 200, 300);
    } catch {
      return reply(JSON.stringify({ error: "funding groups are being built, try again shortly" }), "application/json", 503, 60);
    }
  }
  // IMD on Robinhood Chain: totals, and the launches whose launcher sold into its own pool
  if (params.get("view") === "imd") {
    try {
      const im = await imdMeta();
      if (!im) throw new Error("index missing");
      const share = (part, whole) => (BigInt(whole) > 0n ? Number((BigInt(part) * 10_000n) / BigInt(whole)) : 0);
      const sold = im.launches
        .filter((l) => l.sells > 0)
        .map((l) => ({ id: l.id, token: l.token, symbol: l.symbol, launcher: l.launcher, soldBps: share(l.soldToPool, l.received), exitAfter: l.firstSellAt ? l.firstSellAt - l.launchedAt : null }))
        .sort((a, b) => (a.exitAfter ?? 1e12) - (b.exitAfter ?? 1e12));
      const body = {
        updatedAt: im.updatedAt,
        block: im.block,
        totals: { launches: im.launches.length, launchers: Object.keys(im.launchers).length, sold: sold.length, fastExits: sold.filter((l) => l.exitAfter !== null && l.exitAfter <= im.fastExitSeconds).length },
        sold,
      };
      return reply(JSON.stringify(body, null, 2), "application/json", 200, 300);
    } catch {
      return reply(JSON.stringify({ error: "record unavailable, retrying shortly" }), "application/json", 503, 30);
    }
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(q) && !/^#?\d{1,7}$/.test(q)) {
    const error = "use ?q= with a token, a wallet or a launch number";
    return svg ? reply(badge("?q=0x…", "none"), "image/svg+xml; charset=utf-8", 400, 3600) : reply(JSON.stringify({ error }), "application/json", 400, 3600);
  }
  try {
    // two sources: vibe/vibe on the testnet and IMD launches on mainnet. A launch number can name a
    // launch on each; ?source= (the site sends the network you're on) says which to show first
    const order = params.get("source") === "imd" ? ["imd", "vibevibe"] : ["vibevibe", "imd"];
    const [m, im] = await Promise.all([meta().catch(() => null), imdMeta().catch(() => null)]);
    if (!m && !im) throw new Error("index missing");
    const bySource = {
      vibevibe: m ? (await findLaunches(q)).map((f) => ({ ...f, source: "vibevibe", factory: FACTORY_LABEL[f.factory] })) : [],
      imd: im ? await findImd(q) : [],
    };
    // a token launched since the hourly update: read its launch from the chain, so a link in a
    // fresh alert never lands on "no launches on record"
    let live = null;
    if (m && !bySource.vibevibe.length && !bySource.imd.length && /^0x/.test(q)) {
      live = await withTimeout(liveLaunch(q), 4000).catch(() => null);
      if (live) bySource.vibevibe = [{ factory: FACTORY_LABEL[live.factory], id: live.id, token: live.token, creator: live.creator, source: "vibevibe" }];
    }
    const found = order.flatMap((src) => bySource[src]);
    const primary = found[0];
    // an address that launched nothing may still be a launcher's wallet
    const wallet = primary ? primary.creator : /^0x/.test(q) ? q.toLowerCase() : null;
    const [recV, recI] = wallet ? await Promise.all([m ? launcher(wallet).catch(() => null) : null, im ? imdLauncher(wallet).catch(() => null) : null]) : [null, null];
    const recs = { vibevibe: live ? withLive(recV, live) : recV, imd: recI };
    const src = primary ? primary.source : order.find((x) => recs[x]) ?? order[0];
    const rec = recs[src];
    const other = order.find((x) => x !== src && recs[x]);
    if (svg) {
      if (!rec) return reply(badge("no launches on record", "none"), "image/svg+xml; charset=utf-8", 200, 300);
      const s = rec.summary;
      // a launcher without a red record of its own may still be funded by the wallet behind red ones
      if (rec.tone !== "exits") {
        const link = groupWarning(await withTimeout(groupLink(rec.address, null, src), 3000).catch(() => null), rec.address);
        if (link) return reply(badge(`funding tied to ${link.red} red launcher${link.red === 1 ? "" : "s"}`, "sold"), "image/svg+xml; charset=utf-8", 200, 300);
      }
      const text = s.fastExits ? `${s.fastExits}/${s.launches} quick exits` : s.sold ? `sold ${s.sold}/${s.launches}` : `${s.launches} launch${s.launches === 1 ? "" : "es"} · no sells`;
      return reply(badge(text, rec.tone), "image/svg+xml; charset=utf-8", 200, 300);
    }
    // the live reads (who holds the supply, who funded the launcher, the wallet's pledges) don't
    // depend on each other: run them side by side, so a record answers in the time of the slowest
    const lead = primary && rec ? rec.launches.find((l) => l.token === primary.token) : null;
    const holdP = (async () => {
      if (!primary?.creator) return null;
      if (src === "imd") {
        const hd = await holdings(MAINNET_RPC, primary.token, { launcher: primary.creator, pools: [IMD_POOL_MANAGER] }).catch(() => null);
        if (hd) hd.text = `The launcher holds ${pctText(hd.launcherBps)} of the supply right now, ${pctText(hd.poolBps)} is in the Uniswap pool${hd.burnedBps ? `, ${pctText(hd.burnedBps)} is burned` : ""}.`;
        return hd;
      }
      const hd = await holdings(TESTNET_RPC, primary.token, { launcher: primary.creator, pools: lead ? [lead.pool] : [] }).catch(() => null);
      // a graduated token's curve is empty: its liquidity moved to Uniswap, so the pool share says nothing
      const curve = lead && !lead.graduated;
      if (hd) hd.text = `The launcher holds ${pctText(hd.launcherBps)} of the supply right now${curve ? `, ${pctText(hd.poolBps)} is still in the launch pool` : ""}${hd.burnedBps ? `, ${pctText(hd.burnedBps)} is burned` : ""}.`;
      return hd;
    })();
    const keptP = wallet ? pledgesOf(wallet).catch(() => null) : Promise.resolve(null);
    // who funded this launcher, and the other launchers the same wallet funded, on the launcher's own
    // network; then the launchers its money ties it to, up to two funders back. A wallet that
    // launched nothing may be a funder: then the launchers it funded are its record
    const fundP = rec
      ? (async () => {
          const fd = await withTimeout(fundingOf(rec.address, src), 6000).catch(() => null);
          const gl = await withTimeout(groupLink(rec.address, fd?.funder, src), 5000).catch(() => null);
          if (gl) gl.network = src;
          return [fd, gl];
        })()
      : Promise.resolve([null, null]);
    const [hold, kept, [funding, groupFound]] = await Promise.all([holdP, keptP, fundP]);
    let funded = null;
    let group = groupFound;
    if (!rec && /^0x/.test(q) && !primary) {
      // a funder in a funding group: the group is its record, two steps deep
      for (const net of order) {
        const g = await groupOf(q, net).catch(() => null);
        if (g) {
          group = { group: g, path: [q.toLowerCase()], live: false, network: net };
          break;
        }
      }
    }
    if (!rec && /^0x/.test(q) && !primary && !group) {
      const f = await withTimeout(launchersFundedBy(q), 6000).catch(() => null);
      if (f?.siblings?.length) {
        // the funder may be an Ethereum account's bridge address: name the account when it launches too
        const owner = unaliasOf(q);
        funded = { ...f, ...(f.siblings.some((x) => x.address === owner) ? { bridgeOwner: owner } : {}) };
      }
    }
    const fast = ((src === "imd" ? im : m) ?? m ?? im).fastExitSeconds / 60;
    const body = {
      source: src === "imd" ? "IMD launches on Robinhood Chain (4663), from public transfer logs and each launch's launch.json" : "vibe/vibe launches on Robinhood Chain testnet (46630), from public event logs",
      network: src,
      updatedAt: (src === "imd" ? im : m)?.updatedAt,
      block: (src === "imd" ? im : m)?.block,
      query: q,
      // every launch the query names, the preferred source first
      matches: found,
      launcher: rec && {
        source: src,
        address: rec.address,
        tone: rec.tone,
        facts: rec.facts.map((f) => f.text),
        summary:
          src === "imd"
            ? rec.summary
            : {
                ...rec.summary,
                buyersInEth: fmtEth(Number(BigInt(rec.summary.buyersIn)) / 1e18),
                creatorInEth: fmtEth(Number(BigInt(rec.summary.creatorIn)) / 1e18),
                creatorOutEth: fmtEth(Number(BigInt(rec.summary.creatorOut)) / 1e18),
              },
        recent: src === "imd" ? rec.launches : rec.launches.map((l) => ({ ...l, source: "vibevibe", factory: FACTORY_LABEL[l.factory] })),
      },
      // the same wallet also launched on the other source
      alsoOn: other ? { source: other, tone: recs[other].tone, launches: recs[other].summary.launches, fastExits: recs[other].summary.fastExits } : null,
      kept,
      holdings: hold,
      funding,
      // the funder also funded launchers with a red record
      // a launcher in a funding group is judged by its group; one newer than the index, by its funder's launchers
      linked: rec && rec.tone !== "exits" ? (group ? groupWarning(group, rec.address) : redLink(funding)) : null,
      funded,
      // the funding group: launchers tied together by the wallets that funded them
      group: group && {
        network: group.network,
        id: group.group.id,
        totals: group.group.totals,
        funders: group.group.funders.length,
        path: group.path,
        live: group.live,
        launchers: group.group.launchers.slice(0, 60),
      },
      rule: `Red: sold into its own launch within ${fast} minutes of launching, on two launches or a quarter of them. Amber: sold into its own launches. Green: never sold into them, across two launches or more. Grey: a first launch with no sells yet. Amber also when a green or grey launcher's funder also funded launchers with a red record (see linked: launchers its funding ties it to, up to two funders back); tone stays the launcher's own.`,
    };
    return reply(JSON.stringify(body, null, 2), "application/json", 200, 300);
  } catch (e) {
    return svg ? reply(badge("record unavailable", "none"), "image/svg+xml; charset=utf-8", 503, 30) : reply(JSON.stringify({ error: "record unavailable, retrying shortly" }), "application/json", 503, 30);
  }
}
