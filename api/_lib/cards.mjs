// The verdict card: one milestone's outcome as a 1200x675 SVG, sized for an X post.
// The endpoint serves it as SVG; the verdict bot renders the same SVG to PNG.

import { SITE, amount, recordOf, recordText, signerOf } from "./vault.mjs";

const SCALED = 4; // KeptVault v2's ValueScaled kind: a number read on chain at the deadline
const pctOf = (m) => Math.round((m.shareBps ?? 0) / 100);
/** The tokens a partial milestone unlocks, and the rest. */
const splitOf = (m) => {
  const paid = (m.amount * BigInt(m.shareBps ?? 0)) / 10_000n;
  return [paid, m.amount - paid];
};

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
  const partial = m.outcome === 3;
  const tone = m.outcome === 1 ? "kept" : m.outcome === 2 ? "broken" : "open";
  const col = C[tone];
  const [paid, burned] = splitOf(m);
  const amt = partial ? `${amount(paid, p.decimals)} of ${amount(m.amount, p.decimals)} ${p.symbol}` : `${amount(m.amount, p.decimals)} ${p.symbol}`;
  const stampText = partial ? "PARTIAL" : tone === "kept" ? "KEPT" : tone === "broken" ? "BURNED" : "OPEN";
  const what = partial
    ? `${m.settled ? "unlocked" : "unlocks"} · ${amount(burned, p.decimals)} burned`
    : tone === "kept" ? (m.settled ? "released to the team" : "unlocks to the team") : tone === "broken" ? "burned for good" : `due ${new Date(m.deadline * 1000).toUTCString().slice(5, 16)}`;
  const title = wrap(m.title, 22, 3);

  // the panel: one dot per agent
  let panel = "";
  if (m.kind === SCALED && m.outcome) {
    // a number read on chain is not a vote: say what was measured
    panel = `<text x="64" y="555" fill="${C.text}" font-family="${MONO}" font-size="20">measured on chain at the deadline: ${pctOf(m)}% of the target</text>`;
  } else if (verdict) {
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
    .map((x, i) => `<rect x="${W - 64 - (p.count - i) * 34 + 6}" y="540" width="26" height="12" rx="3" fill="${x.outcome === 1 ? C.kept : x.outcome === 2 ? C.broken : x.outcome === 3 ? C.open : C.line}"${x.index === index ? ` stroke="${C.text}" stroke-width="2"` : ""}/>`)
    .join("");
  const record = recordText(recordOf(p.milestones), p.count);

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
  <text x="0" y="${stampText.length > 4 ? 22 : 26}" text-anchor="middle" fill="${col}" font-family="${MONO}" font-size="${stampText.length > 4 ? 58 : 78}" font-weight="600" letter-spacing="6">${stampText}</text>
</g>
<line x1="64" y1="500" x2="${W - 64}" y2="500" stroke="${C.line}" stroke-width="2"/>
${panel}
${lamps}
<text x="${W - 64}" y="522" text-anchor="end" fill="${C.muted}" font-family="${MONO}" font-size="18">${esc(record)}</text>
<text x="64" y="620" fill="${C.muted}" font-family="${MONO}" font-size="20">verified onchain by ${signerOf(p)}</text>
<text x="${W - 64}" y="620" text-anchor="end" fill="${C.text}" font-family="${MONO}" font-size="20">${SITE}</text>
</svg>`;
}

/** The text of the post that goes with the card. */
export function verdictPost(p, index, verdict, chainId = 4663) {
  const m = p.milestones[index];
  const amt = `${amount(m.amount, p.decimals)} $${p.symbol}`;
  const record = recordText(recordOf(p.milestones), p.count).replace(/ · /g, ", ");
  // the /p/ share link: X shows this milestone's card under the post
  const link = `https://${SITE}/p/${p.id}/${index + 1}${Number(chainId) === 4663 ? "" : `?chain=${Number(chainId)}`}`;
  if (m.outcome === 3) {
    const [paid, burned] = splitOf(m);
    return `PARTLY KEPT. "${m.title}" reached ${pctOf(m)}% of its target, measured on chain at the deadline.\n\n${amount(paid, p.decimals)} $${p.symbol} ${m.settled ? "unlocked" : "unlocks"} to the team behind "${p.name}". ${amount(burned, p.decimals)} $${p.symbol} burns.\n\nRecord: ${record}.\n${link}`;
  }
  if (m.outcome === 1) {
    const panel = m.kind === SCALED ? "Measured on chain: 100% of the target. " : p.testOracle ? "Confirmed by KEPT's test oracle on the testnet. " : verdict ? `${verdict.agreed} of ${verdict.panelSize} agents agreed. ` : "";
    return `KEPT. "${m.title}" was delivered.\n\n${panel}${amt} ${m.settled ? "released" : "unlocks"} to the team behind "${p.name}".\n\nRecord: ${record}.\n${link}`;
  }
  if (m.outcome === 2) {
    const why = m.kind === SCALED && verdict ? "Measured on chain at the deadline: nothing above the floor. " : p.testOracle && verdict ? "KEPT's test oracle said it was not delivered. " : verdict ? `${verdict.agreed} of ${verdict.panelSize} agents said it was not delivered. ` : "Nobody proved it by the deadline. ";
    return `BURNED. "${m.title}" was not delivered.\n\n${why}${amt} from "${p.name}" is gone for good.\n\nRecord: ${record}.\n${link}`;
  }
  return `"${m.title}" is due. ${amt} from "${p.name}" is on the line.\n${link}`;
}

// ------------------------------------------------------------------ link previews (1200x630)

/** A pledge's whole record as a 1200x630 card: what X shows under a shared /p/<id> link. */
export function recordCard(p, score) {
  const W = 1200, H = 630;
  const rec = recordOf(p.milestones);
  const tone = score === null ? C.muted : score >= 75 ? C.kept : score >= 50 ? C.open : C.broken;
  const total = p.milestones.reduce((x, m) => x + m.amount, 0n);
  const name = wrap(p.name, 30, 2);
  const rows = p.milestones.slice(0, 4).map((m, i) => {
    const y = 300 + i * 52;
    const col = m.outcome === 1 ? C.kept : m.outcome === 2 ? C.broken : C.open;
    const label = m.outcome === 1 ? "KEPT" : m.outcome === 2 ? "BURNED" : m.outcome === 3 ? `${pctOf(m)}% KEPT` : `DUE ${new Date(m.deadline * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).toUpperCase()}`;
    const t = m.title.length > 40 ? `${m.title.slice(0, 39)}…` : m.title;
    return `<rect x="64" y="${y - 17}" width="22" height="22" rx="4" fill="${m.outcome ? col : "none"}" stroke="${col}" stroke-width="2.5"/>
<text x="104" y="${y}" fill="${C.text}" font-family="${MONO}" font-size="24">${esc(t)}</text>
<text x="840" y="${y}" text-anchor="end" fill="${C.muted}" font-family="${MONO}" font-size="20">${esc(`${amount(m.amount, p.decimals)} ${p.symbol}`)}</text>
<text x="${W - 64}" y="${y}" text-anchor="end" fill="${col}" font-family="${MONO}" font-size="20" font-weight="600" letter-spacing="1">${label}</text>`;
  });
  const more = p.count > 4 ? `<text x="104" y="${300 + 4 * 52}" fill="${C.muted}" font-family="${MONO}" font-size="20">+ ${p.count - 4} more</text>` : "";
  const record = `${recordText(rec, p.count)}${rec.open ? ` · ${rec.open} open` : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <radialGradient id="glow" cx="0.85" cy="0.2" r="0.6"><stop offset="0" stop-color="${tone}" stop-opacity="0.22"/><stop offset="1" stop-color="${tone}" stop-opacity="0"/></radialGradient>
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity="0.04"/></pattern>
</defs>
<rect width="${W}" height="${H}" fill="${C.ink}"/>
<rect width="${W}" height="${H}" fill="url(#grid)"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" fill="none" stroke="${tone}" stroke-opacity="0.5" stroke-width="3"/>
${seal(64, 52, 32)}
<text x="110" y="78" fill="${C.text}" font-family="${MONO}" font-size="24" font-weight="600" letter-spacing="5">KEPT</text>
<text x="64" y="132" fill="${C.muted}" font-family="${MONO}" font-size="20" letter-spacing="2">PLEDGE #${p.id} · ${esc(amount(total, p.decimals))} $${esc(p.symbol)} LOCKED</text>
${name.map((l, i) => `<text x="64" y="${184 + i * 52}" fill="${C.text}" font-family="${MONO}" font-size="44" font-weight="600">${esc(l)}</text>`).join("\n")}
<text x="${W - 64}" y="150" text-anchor="end" fill="${tone}" font-family="${MONO}" font-size="104" font-weight="600">${score ?? "–"}</text>
<text x="${W - 64}" y="186" text-anchor="end" fill="${C.muted}" font-family="${MONO}" font-size="18" letter-spacing="3">KEPT SCORE</text>
${rows.join("\n")}
${more}
<line x1="64" y1="540" x2="${W - 64}" y2="540" stroke="${C.line}" stroke-width="2"/>
<text x="64" y="584" fill="${C.text}" font-family="${MONO}" font-size="22">${esc(record)}</text>
<text x="${W - 64}" y="584" text-anchor="end" fill="${C.muted}" font-family="${MONO}" font-size="20">verified by ${signerOf(p)} · ${SITE}</text>
</svg>`;
}

/** Fits a card of any size into the 1200x630 link-preview frame, centred on the card's ink. */
export function ogFrame(svg, w = 1200, h = 675) {
  const W = 1200, H = 630;
  const s = Math.min(W / w, H / h);
  const x = (W - w * s) / 2, y = (H - h * s) / 2;
  const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${C.ink}"/><svg x="${x}" y="${y}" width="${w * s}" height="${h * s}" viewBox="0 0 ${w} ${h}">${inner}</svg></svg>`;
}
