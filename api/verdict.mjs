// KEPT verdict card: one milestone's outcome as a 1200x675 SVG.
//
//   /api/verdict?pledge=1&m=0            milestone 1 of pledge 1 (m counts from 0)
//   &chain=1                             a pledge on KEPT's Ethereum vault (default: Robinhood Chain)
//   &format=json                         the post text and the numbers instead of the picture
//
// The verdict bot (scripts/verdict-bot) renders this same card to PNG and posts it.

import { verdictCard, verdictPost } from "./_lib/cards.mjs";
import { NETS, lastVerdict, readPledge } from "./_lib/vault.mjs";

const reply = (body, type, status, maxAge) =>
  new Response(body, {
    status,
    headers: {
      "content-type": type,
      "cache-control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=600`,
      "access-control-allow-origin": "*",
    },
  });

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const chain = q.get("chain") || "4663";
  const net = NETS[chain];
  const json = q.get("format") === "json";
  const fail = (status, error) => (json ? reply(JSON.stringify({ error }), "application/json", status, 60) : reply(error, "text/plain; charset=utf-8", status, 60));
  if (!net || !net.vault) return fail(404, "KEPT is not live on that chain");
  const id = q.get("pledge");
  const m = q.get("m") ?? "0";
  if (!/^\d{1,9}$/.test(id || "") || !/^\d{1,3}$/.test(m)) return fail(400, "use ?pledge=1&m=0");
  try {
    const p = await readPledge(net, Number(id));
    if (!p) return fail(404, "pledge not found");
    const index = Number(m);
    if (index >= p.count) return fail(404, "milestone not found");
    const v = p.milestones[index].outcome ? await lastVerdict(net, p.id, index) : null;
    // a settled milestone never changes again; an open one is re-read every five minutes
    const maxAge = p.milestones[index].settled ? 86_400 : 300;
    if (json) {
      const ms = p.milestones[index];
      return reply(
        JSON.stringify({ pledge: p.id, name: p.name, milestone: index, title: ms.title, outcome: ["open", "kept", "broken", "partial"][ms.outcome], shareBps: ms.shareBps, settled: ms.settled, amount: ms.amount.toString(), symbol: p.symbol, verdict: v, post: verdictPost(p, index, v, chain) }),
        "application/json",
        200,
        maxAge,
      );
    }
    return reply(verdictCard(p, index, v), "image/svg+xml; charset=utf-8", 200, maxAge);
  } catch {
    return fail(503, "chain unreachable");
  }
}
