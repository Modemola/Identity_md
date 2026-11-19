// The weekly Exits report (api/_lib/report.mjs).
//
//   /report                  a share link: X, Telegram and Discord show the card; people go on to the site
//   /api/report?format=png   the card, 1200x630
//   /api/report?format=json  the numbers
//   /api/report?format=text  the post that goes with the card

import { png } from "./og.mjs";
import { weeklyReport, reportCard, reportText } from "./_lib/report.mjs";
import { SITE } from "./_lib/vault.mjs";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const headers = (type, maxAge) => ({ "content-type": type, "cache-control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=600`, "access-control-allow-origin": "*" });

export async function GET(request) {
  const format = new URL(request.url).searchParams.get("format");
  let r;
  try {
    r = await weeklyReport();
  } catch {
    r = null;
  }
  if (!r) return new Response("report unavailable, retrying shortly", { status: 503, headers: headers("text/plain; charset=utf-8", 30) });
  if (format === "png") return new Response(png(reportCard(r)), { headers: headers("image/png", 900) });
  if (format === "json") return new Response(JSON.stringify(r, null, 2), { headers: headers("application/json", 900) });
  if (format === "text") return new Response(reportText(r), { headers: headers("text/plain; charset=utf-8", 900) });
  // the share link: the week in the image URL, so a new week's card is never served from an old cache
  const origin = `https://${SITE}`;
  const image = `${origin}/api/report?format=png&w=${r.to}`;
  const title = `KEPT Exits report · ${r.range}`;
  const desc = `${r.vibevibe.fastExits.toLocaleString("en-US")} vibe/vibe launches were sold into by their own launcher within an hour this week. Check before you buy.`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="KEPT">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="${origin}/report">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@keptonchainn">
<meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${image}">
<meta http-equiv="refresh" content="0; url=${origin}/#/report">
</head><body><a href="${origin}/#/report">${esc(title)}</a></body></html>`;
  return new Response(html, { headers: headers("text/html; charset=utf-8", 900) });
}
