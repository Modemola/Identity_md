// KEPT health: how fresh each data source is. The daily health job (.github/workflows/health.yml)
// reads this and opens a GitHub issue when something is stale; records show the same age.
//
//   /api/health          200 when every source is fresh, 503 when one is stale

import { meta, imdMeta } from "./_lib/records.mjs";

/** Records are rebuilt hourly: three missed runs in a row is stale. */
export const STALE_AFTER = 3 * 3600;

export async function GET() {
  const now = Math.floor(Date.now() / 1000);
  const age = (iso) => (iso ? now - Math.floor(Date.parse(iso) / 1000) : null);
  const [m, im] = await Promise.all([meta().catch(() => null), imdMeta().catch(() => null)]);
  const sources = {
    "vibevibe-records": { updatedAt: m?.updatedAt ?? null, ageSeconds: age(m?.updatedAt), block: m?.block ?? null },
    "imd-records": { updatedAt: im?.updatedAt ?? null, ageSeconds: age(im?.updatedAt), block: im?.block ?? null },
  };
  for (const s of Object.values(sources)) s.ok = s.ageSeconds !== null && s.ageSeconds <= STALE_AFTER;
  const ok = Object.values(sources).every((s) => s.ok);
  return new Response(JSON.stringify({ ok, checkedAt: new Date(now * 1000).toISOString(), staleAfterSeconds: STALE_AFTER, sources }, null, 2), {
    status: ok ? 200 : 503,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=60, s-maxage=60", "access-control-allow-origin": "*" },
  });
}
