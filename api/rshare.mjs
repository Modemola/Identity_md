// Record share links: /c/<token, wallet or launch #> (vercel.json). Link previews on X, Telegram and
// Discord show the record's own card; people are sent straight on to the record page.
//
//   /c/0x…?s=vibevibe        s: the network a launch number means first (as on the site)
//   /api/rshare?q=…&format=png   the card

import { png } from "./og.mjs";
import { GET as record } from "./record.mjs";
import { cardModel, recordCardSvg, TONE_WORD } from "./_lib/recordcard.mjs";
import { SITE } from "./_lib/vault.mjs";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const headers = (type, maxAge) => ({ "content-type": type, "cache-control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=3600`, "access-control-allow-origin": "*" });

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") || "").trim().replace(/^#/, "");
  const source = params.get("s") === "vibevibe" ? "vibevibe" : params.get("s") === "imd" ? "imd" : null;
  const origin = `https://${SITE}`;
  if (!/^0x[0-9a-fA-F]{40}$/.test(q) && !/^\d{1,7}$/.test(q)) return Response.redirect(`${origin}/`, 302);
  // the record exactly as the record page reads it
  const res = await record(new Request(`${origin}/api/record?q=${q}${source ? `&source=${source}` : ""}`));
  const r = res.ok ? await res.json() : null;
  const net = (source ?? r?.network) === "vibevibe" ? "?net=vibevibe" : "";
  const page = `${origin}/${net}#/check/${q}`;
  if (params.get("format") === "png") {
    if (!r) return new Response("record unavailable", { status: 503, headers: headers("text/plain", 30) });
    return new Response(png(recordCardSvg(cardModel(r, q))), { headers: headers("image/png", 900) });
  }
  const m = r ? cardModel(r, q) : null;
  const title = m ? `${m.word} · ${m.subject}` : "KEPT: check before you buy";
  const desc = m?.lines?.[0] || "What the wallet behind a token did with every launch before this one.";
  // the record's update time in the image URL, so a changed record never shows an old cached card
  const image = `${origin}/api/rshare?q=${q}${source ? `&s=${source}` : ""}&format=png&v=${encodeURIComponent(r?.updatedAt || "")}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="KEPT">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="${origin}/c/${q}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@keptonchainn">
<meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0; url=${esc(page)}">
</head><body><a href="${esc(page)}">${esc(title)}</a></body></html>`;
  return new Response(html, { headers: headers("text/html; charset=utf-8", 300) });
}
export { TONE_WORD };
