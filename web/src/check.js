// The record: who is behind a token and what they did with their other launches.
// Reads /api/record, which serves the launcher index (scripts/records/indexer.mjs).

import { h, link, short, when } from "./dom.js";
import { reveal, words, countUp, magnetic, reduced, liveInterval } from "./fx.js";
import { icon } from "./icons.js";
import { load } from "./store.js";
import { config } from "./config.js";

const HOST = /(^|\.)vercel\.app$/.test(location.hostname) ? location.origin : "https://keptmd.vercel.app";
const EXPLORER = "https://explorer.testnet.chain.robinhood.com";
const MAINNET_EXPLORER = "https://robin.etherscan.io";
/** Records come from two sources: vibe/vibe on the testnet, IMD launches on Robinhood mainnet. */
const SOURCE = config.net === "vibevibe" ? "vibevibe" : "imd";
const SOURCE_NAME = { vibevibe: "vibe/vibe", imd: "IMD" };
const explorerOf = (source) => (source === "imd" ? MAINNET_EXPLORER : EXPLORER);

const getJSON = (url, key, maxAge) =>
  load(
    key,
    async () => {
      const r = await fetch(url);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `KEPT answered ${r.status}`);
      return j;
    },
    { maxAge },
  );
// the network you're on decides which source a launch number means first
export const getRecord = (q) => getJSON(`${HOST}/api/record?q=${encodeURIComponent(q)}&source=${SOURCE}`, `record:${SOURCE}:${q.toLowerCase()}`, 120_000);
export const getTop = () => getJSON(`${HOST}/api/record?view=top&limit=12`, "record:top", 300_000);
export const getImd = () => getJSON(`${HOST}/api/record?view=imd`, "record:imd", 300_000);

/** IMD on Robinhood Chain: every launch whose launcher sold its own tokens into its pool. */
function imdSection() {
  const list = h("div", { class: "exit-board" }, ...Array.from({ length: 3 }, () => h("div", { class: "exit-row sk" })));
  const sub = h("p", { class: "muted" }, "Real money on Robinhood Chain. Every IMD launch names the wallet that gets the team's share of the supply: here are the launches where that wallet sold it into the launch's own pool.");
  const pct = (b) => `${(b / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}%`;
  getImd()
    .then((d) => {
      sub.textContent = `Real money on Robinhood Chain. Of ${d.totals.launches} IMD launches that name a launcher wallet, ${d.totals.sold} saw that wallet sell its own tokens into the launch's pool, ${d.totals.fastExits} of them within an hour.`;
      list.replaceChildren(
        h("div", { class: "exit-row head imd-row" }, h("span", {}, "#"), h("span", {}, "Token"), h("span", {}, "Sold after"), h("span", { class: "hide-s" }, "Of its allocation"), h("span", { class: "hide-s" }, "Launcher"), h("span", {})),
        ...d.sold.map((l, i) =>
          reveal(
            h(
              "a",
              { class: "exit-row imd-row", href: link(`/check/${l.token}`) },
              h("span", { class: "n tnum" }, String(l.id)),
              h("span", { class: "who" }, `$${l.symbol}`),
              h("span", { class: `big tnum ${l.exitAfter !== null && l.exitAfter <= 3600 ? "alarm" : "caution"}` }, l.exitAfter === null ? "?" : ago(l.exitAfter)),
              h("span", { class: "hide-s tnum" }, pct(l.soldBps)),
              h("span", { class: "hide-s addr" }, short(l.launcher)),
              icon("arrow", 16),
            ),
            Math.min(i, 8) * 40,
          ),
        ),
      );
    })
    .catch(() => list.replaceChildren(h("div", { class: "empty" }, "The IMD record is updating. Try again in a minute.")));
  return reveal(h("section", { class: "exit-sec" }, h("div", { class: "sec-head" }, h("h2", { class: "display-s" }, "IMD launchers who sold"), sub), list));
}

const TONE_WORD = { exits: "Sells into its own launches fast", sold: "Has sold into its own launches", clean: "No sells into its own launches", new: "First launch, no sells yet" };
const TONE_CLASS = { exits: "t-alarm", sold: "t-caution", clean: "t-ok", new: "t-new" };

/** "61 min", "3 h", "2 d" */
function ago(s) {
  if (s < 90) return `${Math.max(1, Math.round(s))} s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  if (s < 172800) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} d`;
}
const ethOf = (wei) => Number(BigInt(wei || "0")) / 1e18;
function fmtEth(x) {
  if (!x) return "0";
  if (x < 0.001) return "<0.001";
  return x.toLocaleString("en-US", { maximumFractionDigits: x < 1 ? 3 : 2 });
}
const ex = (kind, v, source = "vibevibe") => h("a", { class: "addr", href: `${explorerOf(source)}/${kind}/${v}`, target: "_blank", rel: "noopener" }, short(v));

/** The search box: a token, a wallet or a launch number. */
export function searchBox({ value = "", big = false } = {}) {
  const input = h("input", {
    type: "search",
    value,
    placeholder: "Token, wallet or launch #",
    "aria-label": "Token address, wallet address or vibe/vibe launch number",
    spellcheck: "false",
    autocomplete: "off",
    enterkeyhint: "search",
  });
  const go = (e) => {
    e.preventDefault();
    const q = input.value.trim().replace(/^#/, "");
    if (!q) return input.focus();
    location.hash = `#/check/${encodeURIComponent(q)}`;
  };
  return h("form", { class: `check-search${big ? " big" : ""}`, role: "search", onsubmit: go }, icon("search", big ? 22 : 18), input, h("button", { class: "btn primary", type: "submit" }, "Check", icon("arrow", 16)));
}

// ------------------------------------------------------------------ live feed

const RPC = "https://rpc.testnet.chain.robinhood.com";
const FACTORIES = ["0xac135da186de8325047ef2afd1d16d5971f731f7", "0xe794217880011f9ca6961340ed5c16ec9559fea0"];
const LAUNCHED = "0xa7e8032bfd07a9fbcde50eabe91eb2901faee6dbddd9cced579491d9b07ef5c8";
const SECONDS_PER_BLOCK = 0.19;

async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}
function abiString(data, offset) {
  try {
    const at = 2 + Number(offset) * 2;
    const len = Math.min(64, parseInt(data.slice(at, at + 64), 16));
    const hex = data.slice(at + 64, at + 64 + len * 2);
    return new TextDecoder().decode(Uint8Array.from(hex.match(/../g) ?? [], (b) => parseInt(b, 16))).replace(/[\u0000-\u001f]/g, "").trim();
  } catch {
    return "";
  }
}
function decodeLaunch(l) {
  const w = (i) => BigInt(`0x${l.data.slice(2 + i * 64, 66 + i * 64)}`);
  return {
    id: Number(BigInt(l.topics[1])),
    creator: `0x${l.topics[2].slice(26)}`,
    token: `0x${l.topics[3].slice(26)}`,
    block: Number(BigInt(l.blockNumber)),
    name: abiString(l.data, w(1)),
    symbol: abiString(l.data, w(2)),
    oldFactory: l.address.toLowerCase() === FACTORIES[1],
  };
}

const TONE_SHORT = { exits: "quick exits", sold: "has sold", clean: "no sells", new: "first launch" };

/**
 * New vibe/vibe launches as they land, each with its launcher's record. Reads the chain from the
 * browser every few seconds while the feed is on screen; records come from /api/record.
 */
export function liveFeed() {
  const list = h("div", { class: "feed" }, ...Array.from({ length: 5 }, () => h("div", { class: "feed-row sk" })));
  const status = h("span", { class: "faint" }, "Connecting to vibe/vibe…");
  const seen = new Set();
  const rows = [];
  let last = 0;
  let head = 0;
  let busy = false;

  // launches per wallet within the feed's own window, which is newer than the hourly record
  const recent = new Map();
  const recordChip = (l) => {
    const chip = h("span", { class: "rec-chip" }, "reading record…");
    getRecord(l.creator)
      .then((r) => {
        const L = r.launcher;
        if (!L) return chip.replaceChildren("no record yet");
        const s = L.summary;
        chip.className = `rec-chip t-${L.tone}`;
        chip.replaceChildren(h("b", {}, TONE_SHORT[L.tone]), L.tone === "exits" || L.tone === "sold" ? ` · ${s.fastExits}/${s.launches} sold within an hour` : s.launches > 1 ? ` · ${s.launches} launches` : "");
        if (L.tone === "exits") chip.closest(".feed-row")?.classList.add("flag");
      })
      .catch(() => chip.replaceChildren("record unavailable"));
    return chip;
  };
  const age = (b) => {
    const s = Math.max(0, (head - b) * SECONDS_PER_BLOCK);
    return s < 60 ? `${Math.round(s)}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`;
  };
  const row = (l) =>
    h(
      "a",
      { class: "feed-row", href: link(`/check/${l.token}`), "data-block": l.block, "data-creator": l.creator },
      h("span", { class: "when faint tnum" }, age(l.block)),
      h("span", { class: "tok" }, h("b", {}, `$${l.symbol || "?"}`), h("span", { class: "faint" }, ` ${l.name}`)),
      h("span", { class: "faint hide-s tnum" }, `#${l.id}${l.oldFactory ? " (first factory)" : ""}`),
      h("span", { class: "hide-s who" }, h("span", { class: "addr" }, short(l.creator)), h("small", { class: "repeat caution" })),
      recordChip(l),
    );

  async function poll(initial = false) {
    if (busy) return;
    busy = true;
    try {
      head = parseInt(await rpc("eth_blockNumber", []), 16);
      const from = initial ? head - 20_000 : last + 1;
      if (from > head) return;
      const got = (await Promise.all(FACTORIES.map((a) => rpc("eth_getLogs", [{ address: a, topics: [LAUNCHED], fromBlock: `0x${from.toString(16)}`, toBlock: `0x${head.toString(16)}` }])))).flat();
      last = head;
      const fresh = got.map(decodeLaunch).filter((l) => !seen.has(l.token)).sort((a, b) => a.block - b.block);
      for (const l of fresh) {
        seen.add(l.token);
        recent.set(l.creator, (recent.get(l.creator) || 0) + 1);
        const el = row(l);
        if (!initial) el.classList.add("new");
        rows.unshift(el);
      }
      rows.splice(14).forEach((el) => el.remove());
      if (initial) list.replaceChildren(...rows);
      else if (fresh.length) list.prepend(...rows.slice(0, fresh.length));
      for (const el of rows) {
        el.querySelector(".when").textContent = age(Number(el.dataset.block));
        const n = recent.get(el.dataset.creator) || 0;
        const rep = el.querySelector(".repeat");
        if (n > 1) (rep.textContent = `${n} launches in this feed`), el.classList.add("repeat-on");
      }
      status.textContent = `Live · block ${head.toLocaleString("en-US")}`;
    } catch {
      status.textContent = "Reconnecting…";
    } finally {
      busy = false;
    }
  }

  const el = h(
    "section",
    { class: "feed-sec" },
    h("div", { class: "sec-head" }, h("h2", { class: "display-s" }, h("span", { class: "lamp alarm blink" }), " New launches, checked"), h("p", { class: "muted" }, "Every vibe/vibe launch as it lands, next to its launcher's record. A red row is a launcher that has sold into its own launches within an hour, again and again. Records update hourly."), status),
    list,
  );
  poll(true);
  const stop = liveInterval(el, () => poll(false), 6000);
  return { el, stop };
}

// ------------------------------------------------------------------ home

export function checkHome({ examples, feed }) {
  const stats = { launches: h("b", { class: "tnum" }, "…"), exiters: h("b", { class: "tnum" }, "…"), out: h("b", { class: "tnum" }, "…"), graduated: h("b", { class: "tnum" }, "…") };
  const board = h("div", { class: "exit-board" }, ...Array.from({ length: 6 }, () => h("div", { class: "exit-row sk" })));
  const updated = h("span", { class: "faint" });
  getTop()
    .then((t) => {
      countUp(stats.launches, t.totals.launches);
      countUp(stats.exiters, t.totals.launchersWithFastExits);
      countUp(stats.graduated, Math.round((100 * t.totals.graduated) / Math.max(1, t.totals.launches)), (n) => `${Math.round(n)}%`);
      const out = Number(String(t.totals.creatorOutEth).replace(/[<,]/g, ""));
      stats.out.textContent = `${out >= 100 ? Math.round(out).toLocaleString("en-US") : t.totals.creatorOutEth} ETH`;
      updated.textContent = `Updated ${when(Date.parse(t.updatedAt) / 1000)} · block ${t.block.toLocaleString("en-US")}`;
      board.replaceChildren(
        h("div", { class: "exit-row head" }, h("span", {}, "#"), h("span", {}, "Launcher"), h("span", {}, "Quick exits"), h("span", { class: "hide-s" }, "Launches"), h("span", { class: "hide-s" }, "ETH out"), h("span", {})),
        ...t.leaders.map((l, i) =>
          reveal(
            h(
              "a",
              { class: "exit-row", href: link(`/check/${l.creator}`) },
              h("span", { class: "n tnum" }, String(i + 1).padStart(2, "0")),
              h("span", { class: "who" }, short(l.creator)),
              h("span", { class: "big alarm tnum" }, String(l.fastExits), h("small", {}, ` of ${l.launches}`)),
              h("span", { class: "hide-s tnum" }, l.launches.toLocaleString("en-US")),
              h("span", { class: "hide-s tnum" }, l.creatorOutEth),
              icon("arrow", 16),
            ),
            Math.min(i, 8) * 40,
          ),
        ),
      );
    })
    .catch(() => board.replaceChildren(h("div", { class: "empty" }, "The record is updating. Try again in a minute.")));

  return [
    h(
      "div",
      { class: "check-hero" },
      h("span", { class: "eyebrow rise" }, h("span", { class: "lamp alarm blink" }), "Live record · every vibe/vibe and IMD launch"),
      h("h1", { class: "display" }, words("Check before you buy.", { delay: 80, accent: ["buy."] })),
      h(
        "p",
        { class: "lede rise", style: { animationDelay: "380ms" } },
        "Paste any token, wallet or launch number. KEPT shows what the wallet behind it did with every launch before this one: what graduated, and how fast it sold into its own buyers.",
      ),
      h("div", { class: "rise", style: { animationDelay: "480ms" } }, searchBox({ big: true })),
      h("div", { class: "check-try rise", style: { animationDelay: "560ms" } }, "Try ", ...examples.flatMap((e, i) => [i ? " · " : "", h("a", { href: link(`/check/${e.q}`) }, e.label)])),
    ),
    reveal(
      h(
        "div",
        { class: "big-stats" },
        h("div", {}, stats.launches, h("span", {}, "vibe/vibe launches on record")),
        h("div", { class: "alarm" }, stats.exiters, h("span", {}, "launchers sold into their own launch within an hour")),
        h("div", {}, stats.out, h("span", {}, "taken out by launchers selling their own tokens")),
        h("div", {}, stats.graduated, h("span", {}, "of vibe/vibe launches ever graduated")),
      ),
    ),
    imdSection(),
    feed,
    reveal(
      h(
        "section",
        { class: "exit-sec" },
        h("div", { class: "sec-head" }, h("h2", { class: "display-s" }, "Fastest exits on vibe/vibe"), h("p", { class: "muted" }, "Launchers that most often sold into their own launch within an hour of creating it. Every number links to its record, and every record links to the chain."), updated),
        board,
      ),
    ),
  ];
}

// ------------------------------------------------------------------ one record

/** Who holds the supply right now: launcher, launch pool, burned, everyone else. */
function holdingsBar(hd, graduated, poolName = "Launch pool") {
  const pct = (b) => `${(b / 100).toLocaleString("en-US", { maximumFractionDigits: b < 100 ? 2 : 1 })}%`;
  const parts = [
    ["launcher", "The launcher", hd.launcherBps],
    ...(graduated ? [] : [["pool", poolName, hd.poolBps]]),
    ["burned", "Burned", hd.burnedBps],
    ["others", "Everyone else", graduated ? hd.othersBps + hd.poolBps : hd.othersBps],
  ].filter(([, , b]) => b > 0);
  return h(
    "div",
    { class: "hold" },
    h("div", { class: "hold-head" }, h("span", { class: "label" }, "Who holds it now"), h("b", { class: hd.launcherBps >= 1000 ? "alarm" : "" }, `Launcher ${pct(hd.launcherBps)}`)),
    h("div", { class: "hold-bar", role: "img", "aria-label": parts.map(([, t, b]) => `${t} ${pct(b)}`).join(", ") }, ...parts.map(([k, t, b]) => h("i", { class: `h-${k}`, style: { flexGrow: String(Math.max(b, 40)) }, title: `${t} ${pct(b)}` }))),
    h("div", { class: "hold-keys" }, ...parts.map(([k, t, b]) => h("span", {}, h("i", { class: `h-${k}` }), `${t} ${pct(b)}`))),
  );
}

/** An IMD launch: what the launcher did with the allocation it received. */
function imdCard(l, { lead = false, hold = null } = {}) {
  const pct = (b) => `${(b / 100).toLocaleString("en-US", { maximumFractionDigits: b < 100 ? 2 : 0 })}%`;
  const exit = l.exitAfter !== null;
  return h(
    "div",
    { class: `launch-card${lead ? " lead" : ""}${l.fast ? " fast" : ""}` },
    h("div", { class: "lc-top" }, h("span", { class: "sym" }, `$${l.symbol || "?"}`), h("span", { class: "faint" }, l.name), h("span", { class: "spacer" }), h("span", { class: "chip kind" }, "IMD · Robinhood Chain")),
    h(
      "div",
      { class: "lc-grid" },
      h("div", {}, h("span", { class: "label" }, "Launch"), `#${l.id}`, h("small", { class: "faint" }, ` · ${l.kind.replace(/_/g, " ")}`)),
      h("div", {}, h("span", { class: "label" }, "Launched"), when(l.launchedAt)),
      h(
        "div",
        { class: l.fast ? "alarm" : exit ? "caution" : "ok" },
        h("span", { class: "label" }, "Launcher sold into the pool"),
        exit ? `${pct(l.soldBps)} of its allocation` : "never",
        exit ? h("small", {}, `, first ${ago(l.exitAfter)} after launch`) : null,
      ),
      h(
        "div",
        { class: l.movedBps ? "caution" : "" },
        h("span", { class: "label" }, "Moved to other wallets"),
        l.movedBps ? `${pct(l.movedBps)} of its allocation` : "none",
        l.liquidityBps ? h("small", { class: "ok" }, ` · added ${pct(l.liquidityBps)} as liquidity`) : null,
      ),
    ),
    hold ? holdingsBar(hold, false, "Uniswap pool") : null,
    h("div", { class: "lc-links" }, "Token ", ex("address", l.token, "imd"), l.repo ? [" · ", h("a", { class: "addr", href: l.repo, target: "_blank", rel: "noopener" }, "source repo")] : null),
  );
}

function launchCard(l, { lead = false, hold = null } = {}) {
  if (l.source === "imd") return imdCard(l, { lead, hold });
  const exit = l.exitAfter !== null;
  const fast = exit && l.exitAfter <= 3600;
  return h(
    "div",
    { class: `launch-card${lead ? " lead" : ""}${fast ? " fast" : ""}` },
    h(
      "div",
      { class: "lc-top" },
      h("span", { class: "sym" }, `$${l.symbol || "?"}`),
      h("span", { class: "faint" }, l.name),
      h("span", { class: "spacer" }),
      h("span", { class: `chip ${l.graduated ? "kept" : "open"}` }, h("span", { class: `lamp ${l.graduated ? "kept" : "open"}` }), l.graduated ? "graduated" : "not graduated"),
    ),
    h(
      "div",
      { class: "lc-grid" },
      h("div", {}, h("span", { class: "label" }, "Launch"), `#${l.id}`, h("small", { class: "faint" }, l.factory === "vibe/vibe" ? "" : " (first factory)")),
      h("div", {}, h("span", { class: "label" }, "Launched"), when(l.launchedAt)),
      h("div", {}, h("span", { class: "label" }, "Buyers"), `${l.buys.toLocaleString("en-US")} buys`, l.pairIsEth ? h("small", { class: "faint" }, ` · ${fmtEth(ethOf(l.buyersIn))} ETH`) : null),
      h(
        "div",
        { class: fast ? "alarm" : exit ? "caution" : "ok" },
        h("span", { class: "label" }, "Launcher sold"),
        exit ? `${ago(l.exitAfter)} after launch` : "never",
        exit && l.pairIsEth ? h("small", {}, ` · ${fmtEth(ethOf(l.creatorOut))} ETH out`) : null,
      ),
    ),
    hold ? holdingsBar(hold, l.graduated) : null,
    h("div", { class: "lc-links" }, "Token ", ex("address", l.token), " · Pool ", ex("address", l.pool)),
  );
}

export function checkResult(q, rec) {
  const L = rec.launcher;
  const asked = rec.matches.length ? rec.matches : [];
  const lead = L && asked.length ? L.recent.find((l) => l.token === asked[0].token) : null;
  const head = [
    h("div", { class: "check-top" }, searchBox({ value: q })),
    asked.length > 1
      ? h(
          "div",
          { class: "banner" },
          h("span", { class: "lamp caution" }),
          h(
            "div",
            {},
            h("b", {}, `Launch #${asked[0].id} names ${asked.length} launches. `),
            `Showing ${SOURCE_NAME[asked[0].source]}${asked[0].source === "vibevibe" ? ` (${asked[0].factory})` : ""}. The others: `,
            ...asked.slice(1).flatMap((m, i) => [i ? ", " : "", h("a", { href: link(`/check/${m.token}`) }, `${SOURCE_NAME[m.source]}${m.source === "vibevibe" && m.factory !== "vibe/vibe" ? " (first factory)" : ""} ${short(m.token)}`)]),
            ".",
          ),
        )
      : null,
  ];
  if (!L) {
    return [
      ...head,
      h(
        "div",
        { class: "verdict-panel none" },
        h("div", { class: "vp-word" }, "No launches on record"),
        h("p", {}, /^0x/i.test(q) ? "This address hasn't launched a token on vibe/vibe or IMD, and isn't a token from either. A wallet with no record isn't proven safe: it may be new, or launching from another wallet." : `No launch #${q} on record yet, on vibe/vibe or IMD.`),
      ),
    ];
  }
  const s = L.summary;
  const imd = L.source === "imd";
  const tone = TONE_CLASS[L.tone];
  const share = `https://x.com/intent/post?text=${encodeURIComponent(
    imd
      ? `Checked ${lead ? `$${lead.symbol}` : short(L.address)} on @keptonchainn. Its launcher on IMD: ${s.launches} launch${s.launches === 1 ? "" : "es"}, sold into its own pool on ${s.sold}, within an hour on ${s.fastExits}.`
      : `Checked ${lead ? `$${lead.symbol}` : short(L.address)} on @keptonchainn. Its launcher: ${s.launches} launches, ${s.graduated} graduated, sold into ${s.fastExits} within an hour of launching.`,
  )}&url=${encodeURIComponent(`https://keptmd.vercel.app/${SOURCE === "vibevibe" ? "?net=vibevibe" : ""}#/check/${q}`)}`;
  const nums = imd
    ? [
        h("div", {}, h("b", { class: "tnum" }, String(s.launches)), h("span", {}, s.launches === 1 ? "IMD launch" : "IMD launches")),
        h("div", { class: s.sold ? "alarm" : "" }, h("b", { class: "tnum" }, String(s.sold)), h("span", {}, "sold into its own pool")),
        h("div", { class: s.fastExits ? "alarm" : "" }, h("b", { class: "tnum" }, String(s.fastExits)), h("span", {}, "sold within an hour")),
        h("div", { class: s.moved ? "caution" : "" }, h("b", { class: "tnum" }, String(s.moved)), h("span", {}, "moved tokens to other wallets")),
      ]
    : [
        h("div", {}, h("b", { class: "tnum" }, s.launches.toLocaleString("en-US")), h("span", {}, s.launches === 1 ? "launch" : "launches")),
        h("div", {}, h("b", { class: "tnum" }, s.graduated.toLocaleString("en-US")), h("span", {}, "graduated")),
        h("div", { class: s.fastExits ? "alarm" : "" }, h("b", { class: "tnum" }, s.fastExits.toLocaleString("en-US")), h("span", {}, "sold within an hour")),
        h("div", { class: Number(s.creatorOutEth.replace(/[<,]/g, "")) > 0 ? "alarm" : "" }, h("b", { class: "tnum" }, s.creatorOutEth), h("span", {}, "ETH out to the launcher")),
      ];
  const badge = `<img src="https://keptmd.vercel.app/api/record?q=${q}&format=svg" alt="KEPT record">`;
  return [
    ...head,
    reveal(
      h(
        "div",
        { class: `verdict-panel ${tone}` },
        h("div", { class: "vp-kicker" }, `${imd ? "IMD on Robinhood Chain" : "vibe/vibe"} · `, lead ? `$${lead.symbol} · launch #${lead.id} · launched by ` : "Launcher ", h("a", { class: "addr", href: `${explorerOf(L.source)}/address/${L.address}`, target: "_blank", rel: "noopener" }, L.address)),
        h("div", { class: "vp-word" }, TONE_WORD[L.tone]),
        h("div", { class: "vp-nums" }, ...nums),
        h("ul", { class: "vp-facts" }, ...L.facts.map((f) => h("li", {}, f)), rec.alsoOn ? h("li", {}, `Also launched ${rec.alsoOn.launches} token${rec.alsoOn.launches === 1 ? "" : "s"} on ${SOURCE_NAME[rec.alsoOn.source]}${rec.alsoOn.fastExits ? `, selling into ${rec.alsoOn.fastExits} within an hour` : ""}.`) : null),
        h(
          "div",
          { class: "vp-actions" },
          config.telegramBot
            ? h("a", { class: "btn small primary", href: `https://t.me/${config.telegramBot}?start=watch_${L.address}`, target: "_blank", rel: "noopener" }, icon("pulse", 14), "Watch on Telegram")
            : null,
          h("a", { class: "btn small", href: share, target: "_blank", rel: "noopener" }, icon("arrow", 14), "Post this record"),
          h("button", { class: "btn small", type: "button", onclick: (e) => navigator.clipboard?.writeText(badge).then(() => (e.currentTarget.textContent = "Badge code copied")) }, "Copy badge for a launch page"),
        ),
      ),
    ),
    lead ? reveal(h("section", { class: "check-sec" }, h("h2", { class: "display-s" }, "This launch"), launchCard(lead, { lead: true, hold: rec.holdings }))) : null,
    rec.kept && rec.kept.pledges.length
      ? reveal(
          h(
            "section",
            { class: "check-sec" },
            h("h2", { class: "display-s" }, "Promises on KEPT"),
            h("p", { class: "muted" }, `This wallet has locked tokens behind ${rec.kept.pledges.length} KEPT pledge${rec.kept.pledges.length === 1 ? "" : "s"}: ${rec.kept.kept} kept, ${rec.kept.broken} broken, ${rec.kept.open} open.`),
            h("div", { class: "chips" }, ...rec.kept.pledges.map((p) => h("a", { class: "btn small", href: `${location.pathname}${p.chainId === 46630 ? "?net=vibevibe" : p.chainId === 1 ? "?net=ethereum" : ""}#/pledge/${p.id}` }, `#${p.id} ${p.name}`))),
          ),
        )
      : null,
    !lead || L.recent.length > 1 ? reveal(
      h(
        "section",
        { class: "check-sec" },
        h("h2", { class: "display-s" }, lead ? "Its other launches" : "Its launches", h("span", { class: "faint" }, lead ? ` · newest ${L.recent.length - 1} of ${s.launches - 1}` : ` · newest ${L.recent.length} of ${s.launches}`)),
        h("div", { class: "launch-list" }, ...L.recent.filter((l) => !lead || l.token !== lead.token).map((l, i) => reveal(launchCard(l), Math.min(i, 6) * 50))),
      ),
    ) : null,
    h("p", { class: "fine muted check-rule" }, rec.rule, imd ? " Facts from Robinhood Chain's public transfer logs: a sale is the launcher's own tokens going into the Uniswap pool in a swap; adding liquidity isn't counted. The launcher is the remainder wallet named in the launch's launch.json." : " Facts from vibe/vibe's public event logs on Robinhood Chain testnet.", " A clean record isn't a promise: a launcher can use a fresh wallet. ", h("a", { href: link("/teams") }, "Teams that want to prove themselves lock tokens on KEPT"), "."),
  ];
}

/** The page for a query: a skeleton first, then the record. */
export function checkPage(q, paintInto) {
  paintInto([h("div", { class: "check-top" }, searchBox({ value: q })), h("div", { class: "verdict-panel sk" }, h("div", { class: "vp-word" }, "Reading the record…"))]);
  return getRecord(q).then(
    (rec) => paintInto(checkResult(q, rec), true),
    (e) => paintInto([h("div", { class: "check-top" }, searchBox({ value: q })), h("div", { class: "verdict-panel none" }, h("div", { class: "vp-word" }, "Couldn't read the record"), h("p", {}, String(e.message || e)))], true),
  );
}
export { magnetic, reduced };
