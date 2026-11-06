// KEPT share links: /p/1 (a pledge) and /p/1/2 (milestone 2's verdict), rewritten here by
// vercel.json. Link previews (X, Telegram, Discord) read the Open Graph tags and show the live
// card from /api/og; people are sent straight on to the pledge page.

import { NETS, SITE, amount, readPledge } from "./_lib/vault.mjs";
import { scoreOf } from "./score.mjs";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export async function GET(request) {
  const u = new URL(request.url);
  const q = u.searchParams;
  const chain = q.get("chain") === "1" ? "1" : "4663";
  const net = NETS[chain];
  const id = Number(q.get("pledge"));
  const m = q.get("m") ? Number(q.get("m")) : 0;
  const origin = `https://${SITE}`;
  const net_q = chain === "1" ? "?net=ethereum" : "";
  const target = `${origin}/${net_q}#/pledge/${Number.isInteger(id) && id > 0 ? id : ""}`;

  let title = "KEPT: promises the swarm enforces";
  let desc = "Teams lock tokens behind milestones. The IMD swarm checks each one. Kept tranches unlock, missed ones burn.";
  let image = `${origin}/api/og?pledge=1`;
  let maxAge = 300;
  try {
    if (!net?.vault || !Number.isInteger(id) || id < 1) throw new Error("bad");
    const p = await readPledge(net, id);
    if (!p) throw new Error("missing");
    const c = chain === "1" ? "&chain=1" : "";
    const s = scoreOf([p]);
    if (m && m <= p.count) {
      const ms = p.milestones[m - 1];
      const word = ms.outcome === 1 ? "KEPT" : ms.outcome === 2 ? "BURNED" : "OPEN";
      title = `${word}: ${ms.title} · ${p.name}`;
      desc =
        ms.outcome === 1
          ? `The IMD swarm confirmed it. ${amount(ms.amount, p.decimals)} $${p.symbol} ${ms.settled ? "released" : "unlocks"} to the team.`
          : ms.outcome === 2
            ? `Not proven in time. ${amount(ms.amount, p.decimals)} $${p.symbol} burned for good.`
            : `${amount(ms.amount, p.decimals)} $${p.symbol} on the line. It unlocks if the IMD swarm confirms it; otherwise it burns.`;
      image = `${origin}/api/og?pledge=${id}&m=${m}${c}`;
      if (ms.settled) maxAge = 3600;
    } else {
      title = `${p.name} · KEPT score ${s.score ?? "pending"}`;
      desc = `${s.kept} kept, ${s.broken} broken, ${s.open} open. $${p.symbol} locked behind milestones the IMD swarm checks. Missed ones burn.`;
      image = `${origin}/api/og?pledge=${id}${c}`;
    }
  } catch {
    // unknown pledge or chain trouble: a generic preview, and the visitor still lands on the site
  }

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="KEPT">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(u.href)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@keptonchainn">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
<link rel="canonical" href="${esc(target)}">
</head><body style="background:#070908;color:#eef2ef;font:15px ui-monospace,monospace;padding:24px">
<p><a style="color:#3ecf7a" href="${esc(target)}">Open on KEPT</a></p>
<script>location.replace(${JSON.stringify(target)})</script>
</body></html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=600` },
  });
}
