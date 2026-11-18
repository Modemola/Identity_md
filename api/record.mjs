// KEPT record: who is behind a token, and what they did with their other launches.
//
//   /api/record?q=0x…        a token or a wallet
//   /api/record?q=123        a vibe/vibe launch number (both factories are searched)
//   &format=svg              a 20 px badge instead of JSON
//
// Reads the launcher index (scripts/records/indexer.mjs), refreshed hourly from vibe/vibe's
// public event logs on Robinhood Chain testnet, plus the wallet's KEPT pledges on every network.
// Facts only: launches, graduations, buys, and the launcher's own sells on its bonding curves.

import { meta, launcher, findLaunches, fmtEth, FACTORY_LABEL } from "./_lib/records.mjs";
import { NETS, isLive } from "./_lib/vault.mjs";
import { allPledges, scoreOf } from "./score.mjs";

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
<title>KEPT record: ${esc(text)} · facts from vibe/vibe's public logs</title>
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
  if (!/^0x[0-9a-fA-F]{40}$/.test(q) && !/^#?\d{1,7}$/.test(q)) {
    const error = "use ?q= with a token, a wallet or a vibe/vibe launch number";
    return svg ? reply(badge("?q=0x…", "none"), "image/svg+xml; charset=utf-8", 400, 3600) : reply(JSON.stringify({ error }), "application/json", 400, 3600);
  }
  try {
    const m = await meta();
    if (!m) throw new Error("index missing");
    const found = await findLaunches(q);
    // an address that launched nothing may still be a launcher's wallet
    const wallet = found.length ? found[0].creator : /^0x/.test(q) ? q.toLowerCase() : null;
    const rec = wallet ? await launcher(wallet) : null;
    if (svg) {
      if (!rec) return reply(badge("no launches on record", "none"), "image/svg+xml; charset=utf-8", 200, 300);
      const s = rec.summary;
      const text = s.fastExits ? `${s.fastExits}/${s.launches} quick exits` : s.sold ? `sold ${s.sold}/${s.launches}` : `${s.launches} launch${s.launches === 1 ? "" : "es"} · no sells`;
      return reply(badge(text, rec.tone), "image/svg+xml; charset=utf-8", 200, 300);
    }
    const body = {
      source: "vibe/vibe launches on Robinhood Chain testnet (46630), from public event logs",
      updatedAt: m.updatedAt,
      block: m.block,
      query: q,
      // a launch number can name a launch on each factory: both are listed, newest factory first
      matches: found.map((f) => ({ ...f, factory: FACTORY_LABEL[f.factory] })),
      launcher: rec && {
        address: rec.address,
        tone: rec.tone,
        facts: rec.facts.map((f) => f.text),
        summary: {
          ...rec.summary,
          buyersInEth: fmtEth(Number(BigInt(rec.summary.buyersIn)) / 1e18),
          creatorInEth: fmtEth(Number(BigInt(rec.summary.creatorIn)) / 1e18),
          creatorOutEth: fmtEth(Number(BigInt(rec.summary.creatorOut)) / 1e18),
        },
        recent: rec.launches.map((l) => ({ ...l, factory: FACTORY_LABEL[l.factory] })),
      },
      kept: wallet ? await pledgesOf(wallet) : null,
      rule: `Red: sold into its own launch within ${m.fastExitSeconds / 60} minutes of launching, on two launches or a quarter of them. Amber: sold into its own launches. Green: never sold into them, across two launches or more. Grey: a first launch with no sells yet.`,
    };
    return reply(JSON.stringify(body, null, 2), "application/json", 200, 300);
  } catch (e) {
    return svg ? reply(badge("record unavailable", "none"), "image/svg+xml; charset=utf-8", 503, 30) : reply(JSON.stringify({ error: "record unavailable, retrying shortly" }), "application/json", 503, 30);
  }
}
