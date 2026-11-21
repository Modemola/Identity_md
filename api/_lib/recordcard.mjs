// A launcher record as a 1200x630 card, for the link previews of /c/<token, wallet or launch #>.
// Drawn from /api/record's own answer, so the card always says what the record page says.

import { SITE } from "./vault.mjs";

const C = { exits: "#ff6b62", sold: "#f0b429", clean: "#3ecf7a", new: "#9aa3ad", ink: "#070908", text: "#eef2ef", muted: "#8d9792", line: "#1f2723" };
const MONO = "'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const n = (x) => Number(x).toLocaleString("en-US");
export const TONE_WORD = { exits: "Sells into its own launches fast", sold: "Has sold into its own launches", clean: "No sells into its own launches", new: "First launch, no sells yet", linked: "Funded by the wallet behind red launchers" };

/** Greedy word wrap for a monospace face. */
function wrap(text, cols, max) {
  const out = [];
  let cur = "";
  for (const w of String(text).split(/\s+/)) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= cols) cur = next;
    else {
      if (cur) out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  if (out.length > max) out.splice(max, out.length - max, `${out[max - 1].slice(0, cols - 1)}…`);
  return out.slice(0, max);
}

/** What the card shows, from a /api/record answer: the verdict, four numbers and two lines. */
export function cardModel(r, q) {
  const L = r.launcher;
  if (!L && r.funded?.siblings?.length) {
    const sib = r.funded.siblings;
    const red = sib.filter((x) => x.tone === "exits").length;
    const launches = sib.reduce((a, x) => a + x.launches, 0);
    const fast = sib.reduce((a, x) => a + x.fastExits, 0);
    return {
      tone: red ? "exits" : "new",
      kicker: "KEPT RECORD · vibe/vibe",
      subject: `Funder ${short(q)}`,
      word: red ? "Funds launchers that sell fast" : "Funds launchers",
      nums: [[sib.length, "launchers funded"], [red, "red records"], [launches, "launches"], [fast, "sold within an hour"]],
      lines: [r.funded.bridgeOwner ? `One owner: an Ethereum account that launches too sent ETH to all ${sib.length}.` : `It sent ETH to ${r.funded.funded} wallets; ${sib.length} are launchers.`],
    };
  }
  if (!L) return { tone: "new", kicker: "KEPT RECORD", subject: /^0x/i.test(q) ? short(q) : `Launch #${q}`, word: "No launches on record", nums: [], lines: ["No launch on vibe/vibe or IMD from this wallet yet. No record isn't proof of safety."] };
  const imd = L.source === "imd";
  const s = L.summary;
  const lead = r.matches?.[0] && L.recent.find((l) => l.token === r.matches[0].token);
  const lines = [];
  const k = r.linked;
  if (k) lines.push(`Funded by the same wallet as ${k.red} red launcher${k.red === 1 ? "" : "s"}. ${k.red === 1 ? "It" : "They"} sold into ${n(k.fastExits)} launch${k.fastExits === 1 ? "" : "es"} within an hour.`);
  if (L.facts[0]) lines.push(L.facts[0]);
  const sib = r.funding?.siblings || [];
  if (imd && L.facts[1]) lines.push(L.facts[1]);
  else if (k) {
    // already said
  } else if (sib.length) {
    const fast = sib.reduce((a, x) => a + x.fastExits, 0);
    lines.push(`Its funder also funded ${sib.length} other launcher${sib.length === 1 ? "" : "s"}, which sold into ${n(fast)} launches within an hour.`);
  } else if (r.holdings?.text) lines.push(r.holdings.text);
  else if (L.facts[1]) lines.push(L.facts[1]);
  return {
    tone: L.tone,
    kicker: `KEPT RECORD · ${imd ? "IMD on Robinhood Chain" : "vibe/vibe"}`,
    subject: lead ? `$${lead.symbol} · launched by ${short(L.address)}` : `Launcher ${short(L.address)}`,
    // a green or grey record funded by the wallet behind red launchers reads amber, as on the page
    ...(k && (L.tone === "new" || L.tone === "clean") ? { word: TONE_WORD.linked, toneOverride: "sold" } : { word: TONE_WORD[L.tone] }),
    nums: imd
      ? [[s.launches, s.launches === 1 ? "IMD launch" : "IMD launches"], [s.sold, "sold into own pool"], [s.fastExits, "sold within an hour"], [s.moved, "moved to other wallets"]]
      : [[s.launches, s.launches === 1 ? "launch" : "launches"], [s.graduated, "graduated"], [s.fastExits, "sold within an hour"], [`${s.creatorOutEth}`, `${"test ETH out"}`]],
    lines,
  };
}

/** The card. */
export function recordCardSvg(model) {
  const W = 1200;
  const H = 630;
  const tone = C[model.toneOverride ?? model.tone] ?? C.new;
  const word = wrap(model.word.toUpperCase(), 21, 2);
  const wordSize = word.length > 1 ? 64 : 76;
  const top = 168;
  const words = word.map((l, i) => `<text x="64" y="${top + i * (wordSize + 6)}" fill="${tone}" font-family="${MONO}" font-size="${wordSize}" font-weight="600">${esc(l)}</text>`).join("\n");
  const numsY = top + word.length * (wordSize + 6) + 52;
  const nums = model.nums
    .map(([v, label], i) => {
      const x = 64 + i * 272;
      const hot = /sold|red|moved|out/.test(label) && Number(String(v).replace(/[<,]/g, "")) > 0;
      return `<text x="${x}" y="${numsY}" fill="${hot ? C.exits : C.text}" font-family="${MONO}" font-size="44" font-weight="600">${esc(typeof v === "number" ? n(v) : v)}</text>
<text x="${x}" y="${numsY + 30}" fill="${C.muted}" font-family="${MONO}" font-size="18">${esc(label)}</text>`;
    })
    .join("\n");
  const linesY = model.nums.length ? numsY + 88 : numsY - 20;
  const lines = model.lines
    .flatMap((l) => wrap(l, 84, 2))
    .slice(0, 3)
    .map((l, i) => `<text x="64" y="${linesY + i * 30}" fill="${C.text}" font-family="${MONO}" font-size="21">${esc(l)}</text>`)
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${C.ink}"/>
<rect x="0" y="0" width="12" height="${H}" fill="${tone}"/>
<text x="64" y="68" fill="${C.text}" font-family="${MONO}" font-size="20" font-weight="600" letter-spacing="4">${esc(model.kicker)}</text>
<text x="${W - 64}" y="68" text-anchor="end" fill="${C.muted}" font-family="${MONO}" font-size="20">${esc(model.subject)}</text>
${words}
${model.nums.length ? `<line x1="64" y1="${numsY - 58}" x2="${W - 64}" y2="${numsY - 58}" stroke="${C.line}" stroke-width="2"/>` : ""}
${nums}
${lines}
<text x="${W - 64}" y="${H - 34}" text-anchor="end" fill="${C.muted}" font-family="${MONO}" font-size="18">Check before you buy · ${SITE}</text>
</svg>`;
}
