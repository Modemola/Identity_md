// KEPT link-preview images: 1200x630 PNGs for the og:image of /p/<pledge> share links.
//
//   /api/og?pledge=1          the pledge's whole record
//   /api/og?pledge=1&m=1      one milestone's verdict card (m counts from 1, as on the site)
//   &chain=1                  KEPT's Ethereum vault
//
// X and most chat apps show PNG or JPG previews, never SVG, so the cards are rendered here.

import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { ogFrame, recordCard, verdictCard } from "./_lib/cards.mjs";
import { NETS, lastVerdict, readPledge, isLive } from "./_lib/vault.mjs";
import { scoreOf } from "./score.mjs";

// fonts ship with the function (vercel.json includeFiles); the path is relative to the project root
const FONTS = ["IBMPlexMono-SemiBold.ttf", "IBMPlexMono-Regular.ttf"].map((f) => join(process.cwd(), "api/_lib/fonts", f));

export function png(svg) {
  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "IBM Plex Mono" } }).render().asPng();
}

/** The preview SVG for a pledge, or one of its milestones; null when there is no such thing. */
export async function previewSvg(net, id, m) {
  const p = await readPledge(net, id);
  if (!p) return null;
  if (m) {
    const index = m - 1;
    if (index >= p.count) return null;
    const v = p.milestones[index].outcome ? await lastVerdict(net, id, index) : null;
    return { svg: ogFrame(verdictCard(p, index, v)), p, settled: p.milestones[index].settled };
  }
  return { svg: recordCard(p, scoreOf([p]).score), p, settled: p.open === 0 };
}

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const net = NETS[q.get("chain") || "4663"];
  const id = q.get("pledge");
  const m = q.get("m");
  if (!isLive(net) || !/^\d{1,9}$/.test(id || "") || (m && !/^\d{1,3}$/.test(m))) return new Response("use ?pledge=1 or ?pledge=1&m=1", { status: 400 });
  try {
    const r = await previewSvg(net, Number(id), m ? Number(m) : 0);
    if (!r) return new Response("not found", { status: 404 });
    // a finished record never changes; a live one is re-read every five minutes
    const maxAge = r.settled ? 86_400 : 300;
    return new Response(png(r.svg), {
      headers: { "content-type": "image/png", "cache-control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=600`, "access-control-allow-origin": "*" },
    });
  } catch {
    return new Response("chain unreachable", { status: 503, headers: { "cache-control": "public, max-age=30" } });
  }
}
