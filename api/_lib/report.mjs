// The weekly Exits report: what launchers did with their own launches in the last 7 days, on
// vibe/vibe (Robinhood Chain testnet) and IMD (Robinhood Chain mainnet). Data from the two hourly
// launcher indexes; one card for link previews, the site and the Telegram channel.

import { meta, imdMeta, fmtEth } from "./records.mjs";
import { SITE } from "./vault.mjs";

const C = { alarm: "#ff6b62", ok: "#3ecf7a", caution: "#f0b429", ink: "#070908", text: "#eef2ef", muted: "#8d9792", line: "#1f2723" };
const MONO = "'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const n = (x) => Number(x).toLocaleString("en-US");
/** "675.57" to "676": whole test ETH reads better on a card */
const round = (x) => (/^[\d,.]+$/.test(String(x)) && Number(String(x).replace(/,/g, "")) >= 10 ? Math.round(Number(String(x).replace(/,/g, ""))).toLocaleString("en-US") : String(x));
const day = (t) => new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** The week's numbers from both indexes. */
export async function weeklyReport() {
  const [m, im] = await Promise.all([meta(), imdMeta().catch(() => null)]);
  if (!m?.week) return null;
  const w = m.week;
  const imd = { launches: 0, sold: [] };
  if (im) {
    imd.launches = im.launches.filter((l) => l.launchedAt >= w.from && l.launchedAt <= w.to).length;
    imd.sold = im.launches
      .filter((l) => l.firstSellAt && l.firstSellAt >= w.from && l.firstSellAt <= w.to)
      .map((l) => ({ id: l.id, symbol: l.symbol, token: l.token, after: l.firstSellAt - l.launchedAt }));
  }
  return {
    from: w.from,
    to: w.to,
    range: `${day(w.from)} to ${day(w.to)}`,
    vibevibe: {
      launches: w.launches,
      launchers: w.launchers,
      fastExits: w.fastExits,
      fastLaunchers: w.fastLaunchers,
      graduated: w.graduated,
      creatorOutEth: fmtEth(Number(BigInt(w.creatorOut)) / 1e18),
      buyersInEth: fmtEth(Number(BigInt(w.buyersIn)) / 1e18),
      worst: w.worst.map((x) => ({ creator: x.creator, fastExits: x.fastExits, launches: x.launches, creatorOutEth: fmtEth(Number(BigInt(x.creatorOut)) / 1e18) })),
    },
    imd,
    url: `https://${SITE}/report`,
  };
}

/** The report as a 1200x630 card. */
export function reportCard(r) {
  const W = 1200;
  const H = 630;
  const v = r.vibevibe;
  const pct = v.launches ? Math.round((100 * v.fastExits) / v.launches) : 0;
  const rows = v.worst.slice(0, 3).map(
    (x, i) =>
      `<text x="64" y="${406 + i * 40}" fill="${C.muted}" font-family="${MONO}" font-size="20">${String(i + 1).padStart(2, "0")}</text>
<text x="112" y="${406 + i * 40}" fill="${C.text}" font-family="${MONO}" font-size="21" font-weight="600">${esc(short(x.creator))}</text>
<text x="380" y="${406 + i * 40}" fill="${C.alarm}" font-family="${MONO}" font-size="21" font-weight="600">${x.fastExits} of ${x.launches} launches</text>
<text x="${W - 64}" y="${406 + i * 40}" text-anchor="end" fill="${C.muted}" font-family="${MONO}" font-size="20">${esc(x.creatorOutEth)} test ETH out</text>`,
  );
  const imdLine = r.imd.sold.length
    ? `IMD on Robinhood Chain: ${r.imd.sold.length} launcher${r.imd.sold.length === 1 ? "" : "s"} sold into ${r.imd.sold.length === 1 ? "its" : "their"} own pool (${r.imd.sold.map((s) => `$${s.symbol}`).slice(0, 3).join(", ")}).`
    : `IMD on Robinhood Chain: ${r.imd.launches} new launch${r.imd.launches === 1 ? "" : "es"}, no launcher sold into its own pool.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${C.ink}"/>
<rect x="0" y="0" width="12" height="${H}" fill="${C.alarm}"/>
<text x="64" y="74" fill="${C.text}" font-family="${MONO}" font-size="22" font-weight="600" letter-spacing="5">KEPT · EXITS REPORT</text>
<text x="${W - 64}" y="74" text-anchor="end" fill="${C.muted}" font-family="${MONO}" font-size="20">${esc(r.range)}</text>
<text x="64" y="196" fill="${C.alarm}" font-family="${MONO}" font-size="112" font-weight="600">${n(v.fastExits)}</text>
<text x="64" y="240" fill="${C.text}" font-family="${MONO}" font-size="24">vibe/vibe (testnet) launches sold into by their own launcher</text>
<text x="64" y="272" fill="${C.text}" font-family="${MONO}" font-size="24">within an hour: ${pct}% of ${n(v.launches)} this week.</text>
<text x="64" y="324" fill="${C.muted}" font-family="${MONO}" font-size="19">${n(v.fastLaunchers)} wallets did it · they took out ${esc(round(v.creatorOutEth))} of the ${esc(round(v.buyersInEth))} test ETH buyers put in</text>
<line x1="64" y1="356" x2="${W - 64}" y2="356" stroke="${C.line}" stroke-width="2"/>
${rows.join("\n")}
<line x1="64" y1="${H - 98}" x2="${W - 64}" y2="${H - 98}" stroke="${C.line}" stroke-width="2"/>
<text x="64" y="${H - 58}" fill="${r.imd.sold.length ? C.alarm : C.ok}" font-family="${MONO}" font-size="20">${esc(imdLine)}</text>
<text x="${W - 64}" y="${H - 24}" text-anchor="end" fill="${C.muted}" font-family="${MONO}" font-size="18">Check before you buy · ${SITE}</text>
</svg>`;
}

/** The post that goes with the card. */
export function reportText(r) {
  const v = r.vibevibe;
  const top = v.worst[0];
  return [
    `KEPT Exits report, ${r.range}.`,
    "",
    `vibe/vibe (Robinhood Chain testnet): ${n(v.fastExits)} of ${n(v.launches)} new launches were sold into by their own launcher within an hour, by ${n(v.fastLaunchers)} wallets.${top ? ` The worst did it on ${top.fastExits} of its ${top.launches} launches.` : ""}`,
    "",
    r.imd.sold.length
      ? `IMD on Robinhood Chain: ${r.imd.sold.length} launcher${r.imd.sold.length === 1 ? "" : "s"} sold into ${r.imd.sold.length === 1 ? "its" : "their"} own pool: ${r.imd.sold.map((s) => `$${s.symbol}`).join(", ")}.`
      : `IMD on Robinhood Chain: no launcher sold into its own pool this week.`,
    "",
    `Check before you buy: ${r.url}`,
  ].join("\n");
}
