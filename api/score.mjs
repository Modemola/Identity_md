// KEPT score: a team's promise record and one number for it, for other apps to show.
//
//   /api/score?team=0x…        every pledge whose beneficiary is that address
//   /api/score?token=0x…       every pledge that locks that token (what a token page knows)
//   &format=svg                a 20 px badge instead of JSON
//
// Reads every chain KEPT is live on. The score is the kept rate with one kept and one broken
// promise added as a prior: (kept + 1) / (settled + 2). A team with one kept promise scores 67,
// not 100, and the score only moves toward the extremes as settled promises pile up. No settled
// promise yet means no score. A partial delivery on KeptVault v2 counts as its share: 60% of a
// milestone adds 0.6 to kept and 0.4 to broken.

import { NETS, amount, pledgeIds, readPledge, recordOf } from "./_lib/vault.mjs";

const reply = (body, type, status, maxAge) =>
  new Response(body, {
    status,
    headers: {
      "content-type": type,
      "cache-control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=600`,
      "access-control-allow-origin": "*",
    },
  });

export async function allPledges(chainId, net) {
  const all = await pledgeIds(net);
  const out = [];
  // a few at a time, to stay friendly with public RPCs
  for (let i = 0; i < all.length; i += 8) {
    out.push(...(await Promise.all(all.slice(i, i + 8).map((id) => readPledge(net, id)))).filter(Boolean).map((p) => ({ ...p, chainId })));
  }
  return out;
}

export function scoreOf(pledges) {
  const r = recordOf(pledges.flatMap((p) => p.milestones));
  return {
    score: r.settled ? Math.round((100 * (r.credit + 1)) / (r.settled + 2)) : null,
    kept: r.kept,
    partial: r.partial,
    broken: r.broken,
    open: r.open,
  };
}

const MONO = "'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
function badge(s) {
  const text = s.score === null ? (s.open ? "no record yet" : "no pledges") : `score ${s.score} · ${s.kept} kept${s.partial ? ` · ${s.partial} partial` : ""}${s.broken ? ` · ${s.broken} broken` : ""}`;
  const col = s.score === null ? "#6b7580" : s.score >= 75 ? "#3ecf7a" : s.score >= 50 ? "#f0b429" : "#ff6b62";
  const left = 62;
  const right = Math.round(text.length * 6.6 + 20);
  const w = left + right;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="KEPT ${text}">
<title>KEPT ${text} · verified by the IMD swarm</title>
<rect width="${w}" height="20" rx="3" fill="#0b0d0c"/>
<rect x="${left}" width="${right}" height="20" rx="3" fill="${col}"/>
<rect x="${left}" width="4" height="20" fill="${col}"/>
<g transform="translate(6 3) scale(0.7)"><rect x="2.5" y="2.5" width="15" height="15" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M6 10.2l2.8 2.8 5.4-6" fill="none" stroke="#3ecf7a" stroke-width="2.6" stroke-linecap="square"/></g>
<text x="25" y="14" fill="#fff" font-family="${MONO}" font-size="11" font-weight="600" letter-spacing="1.2">KEPT</text>
<text x="${left + 10}" y="14" fill="#0b0d0c" font-family="${MONO}" font-size="11" font-weight="600">${text}</text>
</svg>`;
}

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const team = q.get("team");
  const token = q.get("token");
  const svg = q.get("format") === "svg";
  const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || "");
  if (!isAddr(team) && !isAddr(token)) {
    const msg = "use ?team=0x… or ?token=0x…";
    return svg ? reply(badge({ score: null, open: 0 }), "image/svg+xml; charset=utf-8", 400, 3600) : reply(JSON.stringify({ error: msg }), "application/json", 400, 3600);
  }
  const live = Object.entries(NETS).filter(([, n]) => n.vault);
  try {
    const every = (await Promise.all(live.map(([id, n]) => allPledges(Number(id), n)))).flat();
    const match = isAddr(team) ? (p) => p.beneficiary === team.toLowerCase() : (p) => p.token === token.toLowerCase();
    const mine = every.filter(match);
    const s = scoreOf(mine);
    if (svg) return reply(badge(s), "image/svg+xml; charset=utf-8", 200, 300);
    const body = {
      query: isAddr(team) ? { team: team.toLowerCase() } : { token: token.toLowerCase() },
      ...s,
      formula: "(kept + 1) / (settled + 2), rounded, where a partial delivery counts as its share; null until a promise settles",
      pledges: mine.map((p) => ({
        chainId: p.chainId,
        id: p.id,
        name: p.name,
        beneficiary: p.beneficiary,
        token: p.token,
        symbol: p.symbol,
        locked: amount(p.locked, p.decimals),
        vault: p.version,
        ...scoreOf([p]),
        url: `https://keptmd.vercel.app/${p.chainId === 1 ? "?net=ethereum" : ""}#/pledge/${p.id}`,
      })),
      checked: live.map(([id]) => Number(id)),
    };
    return reply(JSON.stringify(body, null, 2), "application/json", 200, 300);
  } catch {
    return svg ? reply(badge({ score: null, open: 0 }), "image/svg+xml; charset=utf-8", 503, 30) : reply(JSON.stringify({ error: "chain unreachable" }), "application/json", 503, 30);
  }
}
