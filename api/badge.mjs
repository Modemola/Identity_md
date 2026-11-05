// KEPT badge: a team's live promise record as an SVG, for READMEs, sites and docs.
//
//   /api/badge?pledge=1                  one pledge
//   /api/badge?team=0x…                  every pledge whose beneficiary is that address
//   &style=flat (default) | card         a 20 px shield, or a 440x120 card
//
// No dependencies: it reads the vault over JSON-RPC and decodes the few words it needs. Cached at
// the edge for five minutes, so a README full of badges costs the RPC almost nothing.

const RPC = process.env.KEPT_RPC || "https://rpc.mainnet.chain.robinhood.com";
const VAULT = process.env.KEPT_VAULT || "0x3152f9cbf64d0c1ac24ea7e101db3e4d8da86896";
const SITE = "keptmd.vercel.app";

const SEL = { pledgeCount: "c6d6c183", pledge: "7326c9c0", milestone: "a5aaba22" };
const word = (n) => BigInt(n).toString(16).padStart(64, "0");

async function call(batch) {
  const body = batch.map((data, id) => ({ jsonrpc: "2.0", id, method: "eth_call", params: [{ to: VAULT, data }, "latest"] }));
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`rpc ${res.status}`);
  const out = await res.json();
  return out.sort((a, b) => a.id - b.id).map((r) => {
    if (r.error) throw new Error(r.error.message);
    return r.result.slice(2);
  });
}

const uint = (hex, i) => BigInt(`0x${hex.slice(i * 64, i * 64 + 64)}`);
const addr = (hex, i) => `0x${hex.slice(i * 64 + 24, i * 64 + 64)}`.toLowerCase();
function str(hex, i) {
  const off = Number(uint(hex, i)) * 2;
  const len = Number(BigInt(`0x${hex.slice(off, off + 64)}`));
  return Buffer.from(hex.slice(off + 64, off + 64 + len * 2), "hex").toString("utf8");
}

async function pledgeCount() {
  const [c] = await call([`0x${SEL.pledgeCount}`]);
  return Number(uint(c, 0));
}

async function pledge(id) {
  const [p] = await call([`0x${SEL.pledge}${word(id)}`]);
  const count = Number(uint(p, 5));
  if (!count) return null;
  const ms = await call(Array.from({ length: count }, (_, i) => `0x${SEL.milestone}${word(id)}${word(i)}`));
  return {
    id,
    beneficiary: addr(p, 1),
    name: str(p, 3),
    milestones: ms.map((m) => ({ title: str(m, 1), deadline: Number(uint(m, 2)), outcome: Number(uint(m, 4)) })),
  };
}

async function teamPledges(team) {
  const n = await pledgeCount();
  const all = await Promise.all(Array.from({ length: n }, (_, i) => pledge(i + 1)));
  return all.filter((p) => p && p.beneficiary === team.toLowerCase());
}

// ---------------------------------------------------------------------------- drawing

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const COLOR = { kept: "#3ecf7a", broken: "#ff6b62", open: "#f0b429", none: "#6b7580", ink: "#0b0d0c" };
const MONO = "'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

function record(milestones) {
  const kept = milestones.filter((m) => m.outcome === 1).length;
  const broken = milestones.filter((m) => m.outcome === 2).length;
  const total = milestones.length;
  // green while every settled promise was kept; amber until the first one is proven
  const tone = !total ? "none" : broken ? "broken" : kept ? "kept" : "open";
  const text = !total ? "no pledges" : broken ? `${kept} kept · ${broken} broken` : `${kept}/${total} promises kept`;
  return { kept, broken, total, tone, text };
}

const seal = (x, y, s, check = COLOR.kept, edge = "#fff") =>
  `<g transform="translate(${x} ${y}) scale(${s / 20})"><rect x="2.5" y="2.5" width="15" height="15" fill="none" stroke="${edge}" stroke-width="2.4"/><path d="M6 10.2l2.8 2.8 5.4-6" fill="none" stroke="${check}" stroke-width="2.6" stroke-linecap="square"/></g>`;

function flat(r) {
  const cw = 6.6; // monospace 11 px
  const left = 62;
  const right = Math.round(r.text.length * cw + 20);
  const w = left + right;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="KEPT: ${esc(r.text)}">
<title>KEPT: ${esc(r.text)} · verified by the IMD swarm</title>
<rect width="${w}" height="20" rx="3" fill="${COLOR.ink}"/>
<rect x="${left}" width="${right}" height="20" rx="3" fill="${COLOR[r.tone]}"/>
<rect x="${left}" width="4" height="20" fill="${COLOR[r.tone]}"/>
${seal(6, 3, 14)}
<text x="25" y="14" fill="#fff" font-family="${MONO}" font-size="11" font-weight="600" letter-spacing="1.2">KEPT</text>
<text x="${left + 10}" y="14" fill="${COLOR.ink}" font-family="${MONO}" font-size="11" font-weight="600">${esc(r.text)}</text>
</svg>`;
}

function card(r, title, milestones) {
  const w = 440, h = 120;
  const lamps = milestones.slice(0, 16).map((m, i) => {
    const c = m.outcome === 1 ? COLOR.kept : m.outcome === 2 ? COLOR.broken : COLOR.open;
    return `<rect x="${24 + i * 22}" y="88" width="16" height="8" rx="2" fill="${c}"/>`;
  });
  const big = r.total ? `${r.kept}/${r.total}` : "0";
  const t = title.length > 30 ? `${title.slice(0, 29)}…` : title;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="KEPT: ${esc(r.text)}">
<title>${esc(title)} · ${esc(r.text)} · verified by the IMD swarm</title>
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#11161a"/><stop offset="1" stop-color="#060807"/></linearGradient></defs>
<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="14" fill="url(#g)" stroke="${COLOR[r.tone]}" stroke-opacity="0.7" stroke-width="1.5"/>
${seal(22, 18, 22)}
<text x="52" y="34" fill="#fff" font-family="${MONO}" font-size="15" font-weight="600" letter-spacing="2">KEPT</text>
<text x="52" y="54" fill="#9aa3a0" font-family="${MONO}" font-size="12">${esc(t)}</text>
<text x="${w - 24}" y="50" text-anchor="end" fill="${COLOR[r.tone]}" font-family="${MONO}" font-size="34" font-weight="600">${big}</text>
<text x="${w - 24}" y="70" text-anchor="end" fill="#cfd6d2" font-family="${MONO}" font-size="11" letter-spacing="1.5">${r.broken ? `${r.broken} BROKEN` : "PROMISES KEPT"}</text>
${lamps.join("")}
<text x="${w - 24}" y="98" text-anchor="end" fill="#6b7580" font-family="${MONO}" font-size="10">verified by the IMD swarm · ${SITE}</text>
</svg>`;
}

const svg = (body, status = 200, maxAge = 300) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=600`,
      "access-control-allow-origin": "*",
    },
  });

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const style = q.get("style") === "card" ? "card" : "flat";
  const pid = q.get("pledge");
  const team = q.get("team");
  try {
    let milestones = [];
    let title = "";
    if (pid && /^\d{1,9}$/.test(pid)) {
      const p = Number(pid) >= 1 && Number(pid) <= (await pledgeCount()) ? await pledge(Number(pid)) : null;
      if (!p) return svg(flat({ text: "pledge not found", tone: "none" }), 404, 60);
      milestones = p.milestones;
      title = `#${p.id} · ${p.name}`;
    } else if (team && /^0x[0-9a-fA-F]{40}$/.test(team)) {
      const ps = await teamPledges(team);
      milestones = ps.flatMap((p) => p.milestones);
      title = ps.length === 1 ? `#${ps[0].id} · ${ps[0].name}` : `${ps.length} pledges · ${team.slice(0, 6)}…${team.slice(-4)}`;
    } else {
      return svg(flat({ text: "?pledge=1 or ?team=0x…", tone: "none" }), 400, 3600);
    }
    const r = record(milestones);
    return svg(style === "card" ? card(r, title, milestones) : flat(r));
  } catch {
    return svg(flat({ text: "chain unreachable", tone: "none" }), 503, 30);
  }
}
