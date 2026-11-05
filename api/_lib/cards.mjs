// The verdict card: one milestone's outcome as a 1200x675 SVG, sized for an X post.
// The endpoint serves it as SVG; the verdict bot renders the same SVG to PNG.

import { SITE, amount } from "./vault.mjs";

const C = { kept: "#3ecf7a", broken: "#ff6b62", open: "#f0b429", ink: "#070908", text: "#eef2ef", muted: "#8d9792", line: "#1f2723" };
const MONO = "'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Greedy word wrap for a monospace face: `cols` characters a line, at most `lines` lines. */
function wrap(text, cols, lines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const out = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= cols) cur = next;
    else {
      if (cur) out.push(cur);
      cur = w.length > cols ? `${w.slice(0, cols - 1)}…` : w;
    }
  }
  if (cur) out.push(cur);
  if (out.length > lines) {
    out.length = lines;
    out[lines - 1] = `${out[lines - 1].slice(0, cols - 1).replace(/\s+\S*$/, "")}…`;
  }
  return out;
}

const seal = (x, y, s, check = C.kept, edge = "#fff") =>
  `<g transform="translate(${x} ${y}) scale(${s / 20})"><rect x="2.5" y="2.5" width="15" height="15" fill="none" stroke="${edge}" stroke-width="2.4"/><path d="M6 10.2l2.8 2.8 5.4-6" fill="none" stroke="${check}" stroke-width="2.6" stroke-linecap="square"/></g>`;

/**
 * @param p        a pledge from readPledge
 * @param index    the milestone
 * @param verdict  lastVerdict(), or null when the milestone burned without a check
 */
export function verdictCard(p, index, verdict) {
  const m = p.milestones[index];
  const W = 1200, H = 675;
  const tone = m.outcome === 1 ? "kept" : m.outcome === 2 ? "broken" : "open";
  const col = C[tone];
  const amt = `${amount(m.amount, p.decimals)} ${p.symbol}`;
  const stampText = tone === "kept" ? "KEPT" : tone === "broken" ? "BURNED" : "OPEN";
  const what =
    tone === "kept" ? (m.settled ? "released to the team" : "unlocks to the team") : tone === "broken" ? "burned for good" : `due ${new Date(m.deadline * 1000).toUTCString().slice(5, 16)}`;
  const title = wrap(m.title, 22, 3);
  const kept = p.milestones.filter((x) => x.outcome === 1).length;
  const broken = p.milestones.filter((x) => x.outcome === 2).length;

  // the panel: one dot per agent
  let panel = "";
  if (verdict) {
    const n = verdict.panelSize;
    const gap = Math.min(30, 300 / n);
    for (let i = 0; i < n; i++) {
      const on = i < verdict.agreed;
      panel += `<circle cx="${76 + i * gap}" cy="548" r="8" fill="${on ? (verdict.kept ? C.kept : C.broken) : "none"}" stroke="${on ? "none" : C.muted}" stroke-width="2"/>`;
    }
    panel += `<text x="${76 + n * gap + 8}" y="555" fill="${C.text}" font-family="${MONO}" font-size="20">${verdict.agreed} of ${verdict.panelSize} agents agreed</text>`;
  } else if (tone === "broken") {
    panel = `<text x="64" y="555" fill="${C.text}" font-family="${MONO}" font-size="20">not proven by the deadline</text>`;
  }

  const lamps = p.milestones
    .map((x, i) => `<rect x="${W - 64 - (p.count - i) * 34 + 6}" y="540" width="26" height="12" rx="3" fill="${x.outcome === 1 ? C.kept : x.outcome === 2 ? C.broken : C.line}"${x.index === index ? ` stroke="${C.text}" stroke-width="2"` : ""}/>`)
    .join("");
  const record = broken ? `${kept} kept · ${broken} broken` : `${kept}/${p.count} promises kept`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <radialGradient id="glow" cx="0.82" cy="0.36" r="0.7"><stop offset="0" stop-color="${col}" stop-opacity="0.28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity="0.04"/></pattern>
</defs>
<rect width="${W}" height="${H}" fill="${C.ink}"/>
<rect width="${W}" height="${H}" fill="url(#grid)"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" fill="none" stroke="${col}" stroke-opacity="0.55" stroke-width="3"/>
${seal(64, 56, 34)}
<text x="112" y="84" fill="${C.text}" font-family="${MONO}" font-size="26" font-weight="600" letter-spacing="5">KEPT</text>
<text x="${W - 64}" y="84" text-anchor="end" fill="${C.muted}" font-family="${MONO}" font-size="20" letter-spacing="2">PLEDGE #${p.id} · MILESTONE ${index + 1} OF ${p.count}</text>
<text x="64" y="160" fill="${C.muted}" font-family="${MONO}" font-size="22">${esc(p.name.length > 48 ? `${p.name.slice(0, 47)}…` : p.name)}</text>
${title.map((l, i) => `<text x="64" y="${226 + i * 62}" fill="${C.text}" font-family="${MONO}" font-size="50" font-weight="600">${esc(l)}</text>`).join("\n")}
<text x="64" y="${title.length * 62 + 262}" fill="${col}" font-family="${MONO}" font-size="44" font-weight="600">${esc(amt)}</text>
<text x="64" y="${title.length * 62 + 300}" fill="${C.text}" font-family="${MONO}" font-size="24">${esc(what)}</text>
<g transform="translate(940 300) rotate(-9)">
  <rect x="-170" y="-74" width="340" height="148" rx="10" fill="none" stroke="${col}" stroke-width="9"/>
  <rect x="-156" y="-60" width="312" height="120" rx="6" fill="none" stroke="${col}" stroke-width="2.5" stroke-opacity="0.7"/>
  <text x="0" y="${tone === "broken" ? 22 : 26}" text-anchor="middle" fill="${col}" font-family="${MONO}" font-size="${tone === "broken" ? 62 : 78}" font-weight="600" letter-spacing="6">${stampText}</text>
</g>
<line x1="64" y1="500" x2="${W - 64}" y2="500" stroke="${C.line}" stroke-width="2"/>
${panel}
${lamps}
<text x="${W - 64}" y="522" text-anchor="end" fill="${C.muted}" font-family="${MONO}" font-size="18">${esc(record)}</text>
<text x="64" y="620" fill="${C.muted}" font-family="${MONO}" font-size="20">verified onchain by the IMD swarm</text>
<text x="${W - 64}" y="620" text-anchor="end" fill="${C.text}" font-family="${MONO}" font-size="20">${SITE}</text>
</svg>`;
}

/** The text of the post that goes with the card. */
export function verdictPost(p, index, verdict, chainId = 4663) {
  const m = p.milestones[index];
  const amt = `${amount(m.amount, p.decimals)} $${p.symbol}`;
  const kept = p.milestones.filter((x) => x.outcome === 1).length;
  const broken = p.milestones.filter((x) => x.outcome === 2).length;
  const record = broken ? `${kept} kept, ${broken} broken` : `${kept}/${p.count} promises kept`;
  const link = `https://${SITE}/${Number(chainId) === 1 ? "?net=ethereum" : ""}#/pledge/${p.id}`;
  if (m.outcome === 1) {
    const panel = verdict ? `${verdict.agreed} of ${verdict.panelSize} agents agreed. ` : "";
    return `KEPT. "${m.title}" was delivered.\n\n${panel}${amt} ${m.settled ? "released" : "unlocks"} to the team behind "${p.name}".\n\nRecord: ${record}.\n${link}`;
  }
  if (m.outcome === 2) {
    const why = verdict ? `${verdict.agreed} of ${verdict.panelSize} agents said it was not delivered. ` : "Nobody proved it by the deadline. ";
    return `BURNED. "${m.title}" was not delivered.\n\n${why}${amt} from "${p.name}" is gone for good.\n\nRecord: ${record}.\n${link}`;
  }
  return `"${m.title}" is due. ${amt} from "${p.name}" is on the line.\n${link}`;
}
