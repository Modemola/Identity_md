// KEPT embed: a team's live promise record as a small card for any website, in an iframe.
//
//   /api/embed?token=0x…     every pledge that locks this token
//   /api/embed?team=0x…      every pledge for this beneficiary
//   /api/embed?pledge=1      one pledge
//   &theme=light|dark        default: follows the viewer's system setting
//
// Most sites use /embed.js, which builds the iframe from one <script> tag. The card is plain
// HTML and CSS with no script, read from the chain and cached for five minutes.

import { NETS, SITE, amount, readPledge } from "./_lib/vault.mjs";
import { allPledges, scoreOf } from "./score.mjs";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || "");

function page(body, theme, status = 200, maxAge = 300) {
  const light = ":root{--bg:#ffffff;--fg:#0b0d0c;--dim:#5b6560;--line:#dfe4e1;--soft:#eef1ef}";
  const dark = "--bg:#0b0d0c;--fg:#eef2ef;--dim:#8d9792;--line:#232a26;--soft:#161b18";
  const themeCss =
    theme === "dark" ? `:root{${dark}}` : theme === "light" ? light : `${light}@media (prefers-color-scheme:dark){:root{${dark}}}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>KEPT record</title>
<style>${themeCss}
:root{--kept:#1f9d57;--broken:#e0483e;--open:#c58a00}
@media (prefers-color-scheme:dark){:root{--kept:#3ecf7a;--broken:#ff6b62;--open:#f0b429}}
${theme === "dark" ? ":root{--kept:#3ecf7a;--broken:#ff6b62;--open:#f0b429}" : theme === "light" ? ":root{--kept:#1f9d57;--broken:#e0483e;--open:#c58a00}" : ""}
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--fg);font:13px/1.35 "IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
a.card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 14px;height:100%;padding:12px 14px;border:1px solid var(--line);border-radius:10px;color:inherit;text-decoration:none}
a.card:hover{border-color:var(--kept)}a.card:focus-visible{outline:2px solid var(--kept);outline-offset:-2px}
.brand{display:flex;align-items:center;gap:7px;font-weight:600;letter-spacing:.14em;font-size:12px}
.brand svg{width:15px;height:15px}
.name{grid-column:1;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.score{grid-column:2;grid-row:1/3;text-align:right;align-self:start}
.score b{display:block;font-size:30px;line-height:1;font-variant-numeric:tabular-nums}
.score span{font-size:10px;letter-spacing:.12em;color:var(--dim)}
.rec{grid-column:1/3;color:var(--dim);font-variant-numeric:tabular-nums}
.lamps{grid-column:1/3;display:flex;flex-wrap:wrap;gap:4px}
.lamps i{width:18px;height:7px;border-radius:2px;background:var(--soft)}
.lamps i.k{background:var(--kept)}.lamps i.b{background:var(--broken)}.lamps i.o{background:var(--open);opacity:.45}
.lamps i.p{background:linear-gradient(90deg,var(--kept) var(--s),var(--broken) var(--s))}
.foot{grid-column:1/3;display:flex;justify-content:space-between;gap:10px;color:var(--dim);font-size:11px;white-space:nowrap;min-width:0}
.foot span:first-child{overflow:hidden;text-overflow:ellipsis;min-width:0}
.kept{color:var(--kept)}.broken{color:var(--broken)}.open{color:var(--open)}.none{color:var(--dim)}
</style></head><body>${body}</body></html>`;
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=600`,
      // made to be framed by any site, and nothing else
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors *; base-uri 'none'; form-action 'none'",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });
}

const SEAL = `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="2.5" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M6 10.2l2.8 2.8 5.4-6" fill="none" stroke="var(--kept)" stroke-width="2.6"/></svg>`;

function card({ title, href, pledges, chainLabel }) {
  const s = scoreOf(pledges);
  const tone = s.score === null ? "none" : s.score >= 75 ? "kept" : s.score >= 50 ? "open" : "broken";
  const ms = pledges.flatMap((p) => p.milestones.map((m) => ({ ...m, p })));
  const lamps = ms.slice(0, 24).map((m) => `<i class="${m.outcome === 1 ? "k" : m.outcome === 2 ? "b" : m.outcome === 3 ? "p" : "o"}" title="${esc(m.title)}"${m.outcome === 3 ? ` style="--s:${(m.shareBps ?? 0) / 100}%"` : ""}></i>`).join("");
  const now = Date.now() / 1000;
  const next = ms.filter((m) => m.outcome === 0 && m.deadline > now).sort((a, b) => a.deadline - b.deadline)[0];
  const due = next
    ? `next: ${amount(next.amount, next.p.decimals)} $${esc(next.p.symbol)} · ${new Date(next.deadline * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
    : pledges.length ? "no open deadline" : "";
  const record = pledges.length
    ? `${s.kept} kept · ${s.partial ? `${s.partial} partial · ` : ""}${s.broken} broken · ${s.open} open`
    : "no KEPT pledge yet";
  return `<a class="card" href="${esc(href)}" target="_blank" rel="noopener" aria-label="${esc(`${title}: KEPT score ${s.score ?? "none"}, ${record}. Open on KEPT.`)}">
<div class="brand">${SEAL}KEPT</div>
<div class="score ${tone}"><b>${s.score ?? "–"}</b><span>KEPT SCORE</span></div>
<div class="name">${esc(title)}</div>
<div class="rec">${esc(record)}</div>
<div class="lamps">${lamps}</div>
<div class="foot"><span>${due}</span><span>verified by IMD swarm${chainLabel}</span></div>
</a>`;
}

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const theme = ["light", "dark"].includes(q.get("theme")) ? q.get("theme") : "auto";
  const token = q.get("token");
  const team = q.get("team");
  const pid = q.get("pledge");
  const fail = (msg, status) => page(`<a class="card" href="https://${SITE}" target="_blank" rel="noopener"><div class="brand">${SEAL}KEPT</div><div class="rec">${esc(msg)}</div></a>`, theme, status, 60);
  if (!isAddr(token) && !isAddr(team) && !/^\d{1,9}$/.test(pid || "")) return fail("Set data-token, data-team or data-pledge.", 400);
  const live = Object.entries(NETS).filter(([, n]) => n.vault);
  try {
    if (pid) {
      const p = await readPledge(NETS[4663], Number(pid));
      if (!p) return fail(`Pledge #${pid} not found.`, 404);
      return page(card({ title: p.name, href: `https://${SITE}/#/pledge/${p.id}`, pledges: [p], chainLabel: "" }), theme);
    }
    const every = (await Promise.all(live.map(([id, n]) => allPledges(Number(id), n)))).flat();
    const mine = every.filter((p) => (isAddr(token) ? p.token === token.toLowerCase() : p.beneficiary === team.toLowerCase()));
    const title = mine.length === 1 ? mine[0].name : mine.length ? `${mine[0].symbol} · ${mine.length} pledges` : isAddr(token) ? "This token" : "This team";
    const href = mine.length === 1 ? `https://${SITE}/${mine[0].chainId === 1 ? "?net=ethereum" : ""}#/pledge/${mine[0].id}` : `https://${SITE}/#/board`;
    return page(card({ title, href, pledges: mine, chainLabel: "" }), theme);
  } catch {
    return fail("Chain unreachable. Retrying shortly.", 503);
  }
}
