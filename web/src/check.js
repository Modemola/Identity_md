// The record: who is behind a token and what they did with their other launches.
// Reads /api/record, which serves the launcher index (scripts/records/indexer.mjs).

import { h, link, short, when } from "./dom.js";
import { reveal, words, countUp, magnetic, reduced, liveInterval } from "./fx.js";
import { icon } from "./icons.js";
import { load } from "./store.js";
import { config } from "./config.js";
import { moneyMap } from "./moneymap.js";

const HOST = /(^|\.)vercel\.app$/.test(location.hostname) ? location.origin : "https://keptmd.vercel.app";
const EXPLORER = "https://explorer.testnet.chain.robinhood.com";
const MAINNET_EXPLORER = "https://robin.etherscan.io";
/** Records come from two sources: vibe/vibe on the testnet, IMD launches on Robinhood mainnet. */
const SOURCE = config.net === "vibevibe" ? "vibevibe" : "imd";
const SOURCE_NAME = { vibevibe: "vibe/vibe", imd: "IMD" };
const explorerOf = (source) => (source === "imd" ? MAINNET_EXPLORER : EXPLORER);
/** A record's share link: X, Telegram and Discord preview it as the record's own card. */
const shareUrl = (q, source = SOURCE) => `https://keptmd.vercel.app/c/${q}?s=${source}`;

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
const getGroups = (net = "vibevibe") => getJSON(`${HOST}/api/record?view=groups${net === "imd" ? "&net=imd" : ""}`, `record:groups:${net}`, 300_000);

/** One funding group in a ranked list: the wallet its money starts from, and what its launchers did. */
function groupRow(g, i) {
  const share = Math.round((100 * g.red) / g.launchers);
  return reveal(
    h(
      "a",
      { class: "exit-row group-row", href: link(`/check/${g.root}`) },
      h("span", { class: "n tnum" }, String(i + 1).padStart(2, "0")),
      h("span", { class: "who" }, short(g.root)),
      h("span", { class: "big alarm tnum" }, String(g.fastExits), h("small", {}, ` of ${g.launches.toLocaleString("en-US")}`)),
      h("span", { class: "tnum" }, `${g.red} of ${g.launchers} red`, h("small", { class: "faint hide-s" }, ` · ${share}%`)),
      icon("arrow", 16),
    ),
    Math.min(i, 8) * 40,
  );
}
const groupHead = () => h("div", { class: "exit-row group-row head" }, h("span", {}, "#"), h("span", {}, "Money from"), h("span", {}, "Fast exits"), h("span", {}, "Launchers"), h("span", {}));

/** The funding groups board: launchers tied together by the wallets that funded them, red ones first. */
export function groupsPage() {
  const stats = { groups: h("b", { class: "tnum" }, "…"), launchers: h("b", { class: "tnum" }, "…"), fast: h("b", { class: "tnum" }, "…"), read: h("b", { class: "tnum" }, "…") };
  const board = h("div", { class: "exit-board" }, ...Array.from({ length: 8 }, () => h("div", { class: "exit-row sk" })));
  const updated = h("span", { class: "faint" });
  const post = h("a", { class: "btn small", target: "_blank", rel: "noopener", href: "#", hidden: true }, icon("arrow", 14), "Post the top group");
  getGroups()
    .then((r) => {
      const t = r.totals;
      countUp(stats.groups, t.redGroups);
      countUp(stats.launchers, t.redGroupLaunchers);
      countUp(stats.fast, t.redGroupFastExits);
      countUp(stats.read, t.launchersRead);
      updated.textContent = `Updated ${when(Date.parse(r.updatedAt) / 1000)}`;
      board.replaceChildren(groupHead(), ...r.groups.map(groupRow));
      const g = r.groups[0];
      if (g) {
        post.hidden = false;
        post.href = `https://x.com/intent/post?text=${encodeURIComponent(`One source of money, ${g.launchers} launchers on vibe/vibe. ${g.red} have a red record: they sold into ${g.fastExits.toLocaleString("en-US")} of their own launches within an hour. Checked on @keptonchainn.`)}&url=${encodeURIComponent(shareUrl(g.root, "vibevibe"))}`;
      }
    })
    .catch(() => board.replaceChildren(h("div", { class: "empty" }, "Funding groups are being built. They're read hourly; try again shortly.")));
  return [
    h(
      "div",
      { class: "check-hero" },
      h("span", { class: "eyebrow rise" }, h("span", { class: "lamp alarm blink" }), "Follow the money · vibe/vibe and IMD"),
      h("h1", { class: "display" }, words("Funding groups", { delay: 80 })),
      h(
        "p",
        { class: "lede rise", style: { animationDelay: "300ms" } },
        "A launcher can start a fresh wallet, but someone has to send it ETH. KEPT reads where every launcher's money came from, two wallets back, and groups the launchers that share it. These are the groups where at least a quarter of the launchers sell into their own launches fast.",
      ),
    ),
    reveal(
      h(
        "div",
        { class: "big-stats" },
        h("div", { class: "alarm" }, stats.groups, h("span", {}, "groups with red launchers")),
        h("div", {}, stats.launchers, h("span", {}, "launchers in them")),
        h("div", { class: "alarm" }, stats.fast, h("span", {}, "launches sold into within an hour")),
        h("div", {}, stats.read, h("span", {}, "launchers' funding read")),
      ),
    ),
    reveal(
      h(
        "section",
        { class: "exit-sec" },
        h(
          "div",
          { class: "sec-head" },
          h("h2", { class: "display-s" }, "By fast exits"),
          h("p", { class: "muted" }, "Each row is the wallet the group's money starts from. Open it to see every launcher in the group and the path the money took. A group is a fact about money, not proof of one owner; the rule is in ", h("a", { href: "https://github.com/modemola/identity_md/blob/main/docs/RECORDS.md#funding-groups", target: "_blank", rel: "noopener" }, "RECORDS.md"), "."),
          updated,
        ),
        board,
        h("div", { class: "chips check-sec" }, post, h("a", { class: "btn small", href: link("/") }, "Check a token")),
      ),
    ),
    imdGroups(),
  ];
}

/** IMD's funding groups on mainnet: few launchers, so shown whenever there is one. */
function imdGroups() {
  const board = h("div", { class: "exit-board" });
  const sec = h(
    "section",
    { class: "exit-sec" },
    h("div", { class: "sec-head" }, h("h2", { class: "display-s" }, "IMD on Robinhood Chain"), h("p", { class: "muted" }, "The same rule on mainnet, for IMD launchers: real money.")),
    board,
  );
  getGroups("imd")
    .then((r) => (r.groups.length ? board.replaceChildren(groupHead(), ...r.groups.map(groupRow)) : sec.remove()))
    .catch(() => sec.remove());
  return reveal(sec);
}

/** The home page's short list of funding groups. */
function groupsPanel() {
  const board = h("div", { class: "exit-board" }, ...Array.from({ length: 5 }, () => h("div", { class: "exit-row sk" })));
  getGroups()
    .then((r) => board.replaceChildren(groupHead(), ...r.groups.slice(0, 8).map(groupRow)))
    .catch(() => board.replaceChildren(h("div", { class: "empty" }, "Funding groups are being built. They're read hourly; try again shortly.")));
  return {
    desc: ["Fresh wallets, the same money. Launchers tied together by the wallets that funded them, where a quarter or more sell fast."],
    board,
    more: h("a", { class: "btn small", href: link("/groups") }, "All funding groups", icon("arrow", 14)),
  };
}
export const getImd = () => getJSON(`${HOST}/api/record?view=imd`, "record:imd", 300_000);

/** The weekly Exits report: the card, the post that goes with it, and a one-tap share. */
export function reportPage() {
  const text = h("pre", { class: "report-text" }, "Loading this week's report…");
  const share = h("a", { class: "btn primary", target: "_blank", rel: "noopener", href: "#" }, icon("arrow", 16), "Post on X");
  fetch(`${HOST}/api/report?format=text`)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
    .then((t) => {
      text.textContent = t;
      // the link previews as the card on X, so the post carries the text and the link only
      const body = t.replace(/\n*Check before you buy: \S+$/, "");
      share.href = `https://x.com/intent/post?text=${encodeURIComponent(body)}&url=${encodeURIComponent("https://keptmd.vercel.app/report")}`;
    })
    .catch(() => (text.textContent = "The report is updating. Try again in a minute."));
  return [
    h(
      "div",
      { class: "check-hero" },
      h("span", { class: "eyebrow rise" }, h("span", { class: "lamp alarm blink" }), "Every week"),
      h("h1", { class: "display" }, words("Exits report", { delay: 80 })),
      h("p", { class: "lede rise", style: { animationDelay: "300ms" } }, "What launchers did with their own launches in the last 7 days, on vibe/vibe and IMD. Built from the chain every hour; the channel gets it every Monday."),
    ),
    reveal(h("img", { class: "report-card", src: `${HOST}/api/report?format=png`, alt: "This week's KEPT Exits report", width: "1200", height: "630" })),
    reveal(h("div", { class: "report-share" }, text, h("div", { class: "chips" }, share, h("a", { class: "btn", href: link("/") }, "Check a token")))),
  ];
}

/** IMD on Robinhood Chain: every launch whose launcher sold its own tokens into its pool. */
function imdPanel() {
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
  return { desc: sub, board: list };
}

const TONE_WORD = { exits: "Sells into its own launches fast", sold: "Has sold into its own launches", clean: "No sells into its own launches", new: "First launch, no sells yet", linked: "Funded by the wallet behind red launchers" };
const TONE_CLASS = { exits: "t-alarm", sold: "t-caution", clean: "t-ok", new: "t-new", linked: "t-caution" };
/** The verdict shown: a green or grey record whose funder also funded red launchers reads amber. */
const shownTone = (rec) => (rec.linked && (rec.launcher.tone === "new" || rec.launcher.tone === "clean") ? "linked" : rec.launcher.tone);

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
      rows.splice(8).forEach((el) => el.remove());
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
    { class: "feed-sec", id: "live" },
    h(
      "div",
      { class: "board-head" },
      h("div", {}, h("span", { class: "label live-label" }, h("span", { class: "lamp alarm blink" }), "Live"), h("h2", { class: "display-s" }, "New launches, checked")),
      h("span", { class: "feed-status" }, status),
    ),
    h("p", { class: "muted tab-desc" }, "Every vibe/vibe launch as it lands, next to its launcher's record. A red row is a launcher that keeps selling into its own launches within an hour."),
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

  const imd = imdPanel();
  const groups = groupsPanel();
  return [
    h(
      "div",
      { class: "home-hero" },
      h(
        "div",
        { class: "hh-main" },
        h("span", { class: "eyebrow rise" }, h("span", { class: "lamp alarm blink" }), "Live on Robinhood Chain · vibe/vibe and IMD"),
        h("h1", { class: "display" }, words("Check before you buy.", { delay: 80, accent: ["buy."] })),
        h(
          "p",
          { class: "lede rise", style: { animationDelay: "380ms" } },
          "Paste any token, wallet or launch number. KEPT shows what the wallet behind it did with every launch before, and whose money it's using.",
        ),
        h("div", { class: "rise", style: { animationDelay: "480ms" } }, searchBox({ big: true })),
        h("div", { class: "check-try rise", style: { animationDelay: "560ms" } }, "Try ", ...examples.flatMap((e, i) => [i ? " · " : "", h("a", { href: link(`/check/${e.q}`) }, e.label)])),
      ),
      whatsNew(),
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
    feed,
    boardTabs([
      {
        label: "Fastest exits",
        icon: "flame",
        desc: ["Launchers that most often sold into their own launch within an hour of creating it, on vibe/vibe. ", updated],
        board,
        more: h("a", { class: "btn small", href: link("/report") }, "This week's Exits report", icon("arrow", 14)),
      },
      { label: "Funding groups", icon: "graph", ...groups },
      { label: "IMD sellers", icon: "fund", ...imd },
    ]),
  ];
}

/** What KEPT 2.0 does that the first one didn't, beside the search. */
function whatsNew() {
  const item = (ic, title, text, href, onclick) =>
    h("a", { class: "wn-item", href, ...(onclick ? { onclick } : {}) }, h("span", { class: "wn-ic" }, icon(ic, 18)), h("span", { class: "wn-body" }, h("b", {}, title), h("span", {}, text)), icon("arrow", 14));
  return h(
    "aside",
    { class: "wn rise", style: { animationDelay: "420ms" } },
    h("div", { class: "wn-head" }, h("span", { class: "wn-tag" }, "2.0"), h("b", {}, "What KEPT does now")),
    item("search", "A record for every launcher", "Every vibe/vibe launch and every IMD launch on mainnet, read from the chain.", link("/how")),
    item("graph", "Follow the money", "Fresh wallets traced two funders back and grouped with the launchers they're tied to.", link("/groups")),
    item("bell", "Warned as they launch", "New launches are checked as they land. Red launchers and red money are flagged first.", link("/"), (e) => {
      e.preventDefault();
      document.getElementById("live")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }),
    item("shield", "Promises with teeth", "Teams lock tokens behind milestones the IMD swarm checks. Missed ones burn.", link("/pledges")),
  );
}

/** One card, several boards: tabs instead of a stack of tables. */
function boardTabs(tabs) {
  const panel = h("div", { class: "tab-panel" });
  const btns = tabs.map((t, i) =>
    h("button", { class: "tab", type: "button", role: "tab", "aria-selected": "false", onclick: () => select(i) }, t.icon ? icon(t.icon, 15) : null, t.label),
  );
  function select(i) {
    btns.forEach((b, j) => b.setAttribute("aria-selected", String(i === j)));
    const t = tabs[i];
    panel.replaceChildren(h("p", { class: "muted tab-desc" }, ...[].concat(t.desc)), t.board, t.more ? h("div", { class: "tab-more" }, t.more) : null);
    panel.classList.remove("swap");
    void panel.offsetWidth;
    panel.classList.add("swap");
  }
  select(0);
  return reveal(
    h(
      "section",
      { class: "board-sec" },
      h("div", { class: "board-head" }, h("div", {}, h("span", { class: "label" }, "Leaderboards"), h("h2", { class: "display-s" }, "Who to watch")), h("div", { class: "tabs", role: "tablist" }, ...btns)),
      panel,
    ),
  );
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
      l.live
        ? h("div", { class: "muted" }, h("span", { class: "label" }, "Trades"), "counted at the next hourly update")
        : h("div", {}, h("span", { class: "label" }, "Buyers"), `${l.buys.toLocaleString("en-US")} buys`, l.pairIsEth ? h("small", { class: "faint" }, ` · ${fmtEth(ethOf(l.buyersIn))} ETH`) : null),
      l.live
        ? null
        : h(
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

const TONE_CHIP = { exits: ["broken", "quick exits"], sold: ["open", "has sold"], clean: ["kept", "no sells"], new: ["kind", "first launch"] };

/** One launcher in a funding list: its record in a line, linking to its page. */
function siblingRow(x) {
  const [cls, word] = TONE_CHIP[x.tone] ?? TONE_CHIP.new;
  return h(
    "a",
    { class: "exit-row sib-row", href: link(`/check/${x.address}`) },
    h("span", { class: "who" }, short(x.address)),
    h("span", { class: `chip ${cls}` }, h("span", { class: `lamp ${cls}` }), word),
    h("span", { class: `tnum ${x.fastExits ? "alarm" : ""}` }, `${x.fastExits} of ${x.launches} sold within an hour`),
    icon("arrow", 16),
  );
}

const sumOf = (list) => list.reduce((a, x) => ({ launches: a.launches + x.launches, fastExits: a.fastExits + x.fastExits }), { launches: 0, fastExits: 0 });

/** Who funded this launcher, and the other launchers the same wallet funded. */
/** One sentence on where a launcher's money came from. */
function fundingLead(fd) {
  const f = fd.funder;
  const what = {
    faucet: ["Its first ETH came from the testnet faucet, which funds everyone.", "No link to anyone."],
    bridge: ["Its ETH came from its own deposit from Ethereum.", "No link to another wallet."],
    contract: [`Its biggest early deposit came from a contract, such as a swap paying out (${short(f.from)}).`, "No link to a person."],
  }[f.kind];
  if (what) return h("p", { class: "muted" }, what[0], " ", what[1]);
  const sib = fd.siblings || [];
  const all = sumOf(sib);
  return h(
    "p",
    { class: "fund-lead" },
    "Its ETH came from ",
    h("a", { href: link(`/check/${f.from}`) }, short(f.from)),
    f.bridgedFrom ? [" (a deposit from the Ethereum account ", h("a", { href: link(`/check/${f.bridgedFrom}`) }, short(f.bridgedFrom)), ")"] : null,
    sib.length
      ? `, which also funded ${sib.length} other launcher${sib.length === 1 ? "" : "s"}. Together they made ${all.launches.toLocaleString("en-US")} launches and sold into ${all.fastExits.toLocaleString("en-US")} within an hour.`
      : ". That wallet funded no other launcher on record.",
  );
}

/** Who funded this launcher, when it belongs to no funding group. */
function fundingSection(fd) {
  const sib = fd.funder.kind === "wallet" ? fd.siblings || [] : [];
  return reveal(
    h(
      "section",
      { class: "check-sec" },
      h("span", { class: "label sec-label" }, "Follow the money"),
      h("h2", { class: "display-s" }, "Funding"),
      fundingLead(fd),
      sib.length ? h("div", { class: "exit-board" }, ...sib.map(siblingRow)) : null,
    ),
  );
}

/** One funding group's numbers, as a sentence. */
const groupSentence = (t) =>
  `${t.launchers} launchers are tied together by the wallets that funded them, up to two funders back. ${t.red ? `${t.red} ${t.red === 1 ? "has" : "have"} a red record. ` : "None has a red record. "}Between them: ${t.launches.toLocaleString("en-US")} launches, ${t.fastExits.toLocaleString("en-US")} sold into within an hour.`;

/** The launchers this wallet's money ties it to. */
function groupSection(g, self, fd = null) {
  const others = g.launchers.filter((x) => x.address !== self);
  const path = g.path.length > 1 ? g.path : null;
  return reveal(
    h(
      "section",
      { class: "check-sec", id: "funding-group" },
      h("span", { class: "label sec-label" }, "Follow the money"),
      h("h2", { class: "display-s" }, "Funding group", h("span", { class: "faint" }, ` · ${g.totals.launchers} launchers`)),
      fd ? fundingLead(fd) : null,
      h("p", { class: "fund-lead" }, groupSentence(g.totals)),
      path
        ? h(
            "p",
            { class: "fund-path" },
            ...path.flatMap((a, i) => [i ? h("span", { class: "faint" }, " funded by ") : null, i ? h("a", { href: link(`/check/${a}`) }, short(a)) : h("b", {}, "This wallet")]),
            g.live ? h("span", { class: "faint" }, " · read live, newer than the hourly index") : null,
          )
        : null,
      moneyMap(g, self),
      h(
        "details",
        { class: "mm-list" },
        h("summary", {}, `Every launcher in the group, by fast exits${g.totals.launchers > g.launchers.length ? ` (top ${g.launchers.length})` : ""}`),
        h("div", { class: "exit-board" }, ...others.map(siblingRow)),
      ),
    ),
  );
}

/** A launcher's funder also funded launchers with a red record: said first, before its own facts. */
function linkedNote(k, fresh) {
  return h(
    "div",
    { class: "linked-note" },
    h("span", { class: "lamp alarm" }),
    h(
      "p",
      {},
      h("b", {}, "Linked to red records. "),
      "Its ETH came from ",
      h("a", { href: link(`/check/${k.funder}`) }, short(k.funder)),
      k.bridgedFrom ? [" (the Ethereum account ", h("a", { href: link(`/check/${k.bridgedFrom}`) }, short(k.bridgedFrom)), ")"] : null,
      k.group
        ? [
            k.path?.[2] ? [", which was funded by ", h("a", { href: link(`/check/${k.path[2]}`) }, short(k.path[2]))] : null,
            `. That money ties it to ${k.others} other launcher${k.others === 1 ? "" : "s"}, ${k.red} with a red record: ${k.red === 1 ? "it" : "they"} sold into ${k.fastExits.toLocaleString("en-US")} of ${k.launches.toLocaleString("en-US")} launch${k.launches === 1 ? "" : "es"} within an hour.`,
          ]
        : `, which also funded ${k.red} launcher${k.red === 1 ? "" : "s"} with a red record. ${k.red === 1 ? "It" : "Between them they"} sold into ${k.fastExits.toLocaleString("en-US")} of ${k.launches.toLocaleString("en-US")} launch${k.launches === 1 ? "" : "es"} within an hour.`,
      fresh ? " A fresh wallet has no record of its own, but its money does." : null,
    ),
  );
}

/** How fresh this record is: amber past three hours, when the hourly update has missed a few runs. */
function freshness(rec) {
  if (!rec.updatedAt) return null;
  const s = Math.max(0, Date.now() / 1000 - Date.parse(rec.updatedAt) / 1000);
  const stale = s > 3 * 3600;
  return h("p", { class: `fine ${stale ? "caution" : "muted"} fresh` }, h("span", { class: `lamp ${stale ? "caution" : "ok"}` }), ` Records updated ${s < 90 ? "just now" : `${ago(s)} ago`}${stale ? ": the hourly update is behind, so the newest launches and sales may be missing." : "."}`);
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
  if (!L && rec.group) {
    const g = rec.group;
    const t = g.totals;
    const net = g.network === "imd" ? "imd" : "vibevibe";
    return [
      ...head,
      reveal(
        h(
          "div",
          { class: `verdict-panel ${t.red ? "t-alarm" : "t-new"}` },
          h("div", { class: "vp-kicker" }, `${SOURCE_NAME[net]} · Funder `, h("a", { class: "addr", href: `${explorerOf(net)}/address/${q}`, target: "_blank", rel: "noopener" }, q)),
          h("div", { class: "vp-word" }, t.red ? "Funds launchers that sell fast" : "Funds launchers"),
          h(
            "div",
            { class: "vp-nums" },
            h("div", {}, h("b", { class: "tnum" }, String(t.launchers)), h("span", {}, "launchers in its group")),
            h("div", { class: t.red ? "alarm" : "" }, h("b", { class: "tnum" }, String(t.red)), h("span", {}, "with a red record")),
            h("div", {}, h("b", { class: "tnum" }, t.launches.toLocaleString("en-US")), h("span", {}, "launches between them")),
            h("div", { class: t.fastExits ? "alarm" : "" }, h("b", { class: "tnum" }, t.fastExits.toLocaleString("en-US")), h("span", {}, "sold within an hour")),
          ),
          h("p", { class: "muted" }, "This wallet launched nothing itself. ", groupSentence(t)),
        ),
      ),
      reveal(
        h(
          "section",
          { class: "check-sec" },
          h("h2", { class: "display-s" }, "Its funding group"),
          moneyMap(g, q),
          h("details", { class: "mm-list" }, h("summary", {}, "Every launcher in the group, by fast exits"), h("div", { class: "exit-board" }, ...g.launchers.map(siblingRow))),
        ),
      ),
      h(
        "div",
        { class: "vp-actions check-sec" },
        h(
          "a",
          {
            class: "btn small",
            target: "_blank",
            rel: "noopener",
            href: `https://x.com/intent/post?text=${encodeURIComponent(`${t.launchers} launchers on ${net === "imd" ? "IMD" : "vibe/vibe"}, tied together by the wallets that funded them. ${t.red} ${t.red === 1 ? "has" : "have"} a red record and sold into ${t.fastExits.toLocaleString("en-US")} of their own launches within an hour. Checked on @keptonchainn.`)}&url=${encodeURIComponent(shareUrl(q, net))}`,
          },
          icon("arrow", 14),
          "Post this",
        ),
      ),
    ];
  }
  if (!L && rec.funded?.siblings?.length) {
    const sib = rec.funded.siblings;
    const all = sumOf(sib);
    const red = sib.filter((x) => x.tone === "exits").length;
    return [
      ...head,
      reveal(
        h(
          "div",
          { class: `verdict-panel ${red ? "t-alarm" : "t-new"}` },
          h("div", { class: "vp-kicker" }, "Funder ", h("a", { class: "addr", href: `${EXPLORER}/address/${q}`, target: "_blank", rel: "noopener" }, q)),
          h("div", { class: "vp-word" }, red ? "Funds launchers that sell fast" : "Funds launchers"),
          h(
            "div",
            { class: "vp-nums" },
            h("div", {}, h("b", { class: "tnum" }, String(sib.length)), h("span", {}, "launchers funded")),
            h("div", { class: red ? "alarm" : "" }, h("b", { class: "tnum" }, String(red)), h("span", {}, "with a red record")),
            h("div", {}, h("b", { class: "tnum" }, all.launches.toLocaleString("en-US")), h("span", {}, "launches between them")),
            h("div", { class: all.fastExits ? "alarm" : "" }, h("b", { class: "tnum" }, all.fastExits.toLocaleString("en-US")), h("span", {}, "sold within an hour")),
          ),
          h(
            "p",
            { class: "muted" },
            rec.funded.bridgeOwner
              ? ["This address is where deposits from the Ethereum account ", h("a", { href: link(`/check/${rec.funded.bridgeOwner}`) }, short(rec.funded.bridgeOwner)), " arrive, and that account is one of these launchers: the same owner funded all of them. "]
              : "This wallet launched nothing itself. ",
            `It sent ETH to ${rec.funded.funded} wallet${rec.funded.funded === 1 ? "" : "s"}${rec.funded.truncated ? " in its first 200 transactions" : ""}, and ${rec.funded.siblings.length === rec.funded.funded ? "every one is" : `${rec.funded.siblings.length} are`} a launcher on vibe/vibe.`,
          ),
        ),
      ),
      reveal(h("section", { class: "check-sec" }, h("h2", { class: "display-s" }, "Launchers it funded"), h("div", { class: "exit-board" }, ...sib.map(siblingRow)))),
      h(
        "div",
        { class: "vp-actions check-sec" },
        h(
          "a",
          {
            class: "btn small",
            target: "_blank",
            rel: "noopener",
            href: `https://x.com/intent/post?text=${encodeURIComponent(`One wallet funded ${sib.length} launchers on vibe/vibe. ${red} have a red record: together they sold into ${all.fastExits.toLocaleString("en-US")} of their own launches within an hour. Checked on @keptonchainn.`)}&url=${encodeURIComponent(shareUrl(q, "vibevibe"))}`,
          },
          icon("arrow", 14),
          "Post this",
        ),
      ),
    ];
  }
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
  const shown = shownTone(rec);
  const tone = TONE_CLASS[shown];
  const share = `https://x.com/intent/post?text=${encodeURIComponent(
    imd
      ? `Checked ${lead ? `$${lead.symbol}` : short(L.address)} on @keptonchainn. Its launcher on IMD: ${s.launches} launch${s.launches === 1 ? "" : "es"}, sold into its own pool on ${s.sold}, within an hour on ${s.fastExits}.`
      : `Checked ${lead ? `$${lead.symbol}` : short(L.address)} on @keptonchainn. Its launcher: ${s.launches} launches, ${s.graduated} graduated, sold into ${s.fastExits} within an hour of launching.`,
  )}&url=${encodeURIComponent(shareUrl(q, L.source))}`;
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
        h("div", { class: "vp-word" }, TONE_WORD[shown]),
        h("div", { class: "vp-nums" }, ...nums),
        rec.linked ? linkedNote(rec.linked, L.tone === "new") : null,
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
    rec.funding && !rec.group ? fundingSection(rec.funding) : null,
    rec.group ? groupSection(rec.group, L.address, rec.funding) : null,
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
    freshness(rec),
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

// ------------------------------------------------------------------ for launchpads

/** /integrate: the badge, the card and the API for any token, with code to copy. */
export function integratePage({ example }) {
  const SITE_URL = "https://keptmd.vercel.app";
  const preview = h("div", { class: "int-preview" });
  const blocks = h("div", { class: "int-blocks" });
  const copyBtn = (text) =>
    h(
      "button",
      {
        class: "btn small",
        type: "button",
        onclick: (e) => {
          const b = e.currentTarget;
          navigator.clipboard?.writeText(text).then(() => {
            b.textContent = "Copied";
            setTimeout(() => (b.textContent = "Copy"), 1500);
          });
        },
      },
      "Copy",
    );
  const block = (title, note, code) => h("div", { class: "int-block" }, h("div", { class: "int-head" }, h("b", {}, title), copyBtn(code)), note ? h("p", { class: "muted fine" }, note) : null, h("pre", { class: "int-code" }, code));
  const render = (q) => {
    const share = `${SITE_URL}/c/${q}`;
    preview.replaceChildren(
      h("div", { class: "int-badge" }, h("span", { class: "label" }, "Badge"), h("a", { href: link(`/check/${q}`) }, h("img", { src: `${HOST}/api/record?q=${encodeURIComponent(q)}&format=svg`, alt: "KEPT record badge", height: "20" }))),
      h("div", {}, h("span", { class: "label" }, "Card"), h("a", { href: link(`/check/${q}`) }, h("img", { class: "int-card", src: `${HOST}/api/rshare?q=${encodeURIComponent(q)}&format=png`, alt: "KEPT record card", width: "600", height: "315" }))),
    );
    blocks.replaceChildren(
      block("Badge", "20 px high, in the record's colour. Links to the full record.", `<a href="${share}"><img src="${SITE_URL}/api/record?q=${q}&format=svg" alt="KEPT record" height="20"></a>`),
      block("Card", "The record as an image: the verdict, the numbers, the funding cluster.", `<a href="${share}"><img src="${SITE_URL}/api/rshare?q=${q}&format=png" alt="KEPT record" width="600"></a>`),
      block("Share link", "Posted on X, Telegram or Discord, it previews as the card.", share),
      block(
        "API",
        "JSON, no key, open to any site, cached for 5 minutes. tone is exits, sold, clean or new; facts are plain sentences; holdings says what the launcher still holds.",
        `const r = await fetch("${SITE_URL}/api/record?q=${q}").then((x) => x.json());
r.launcher?.tone;      // "exits" | "sold" | "clean" | "new"
r.launcher?.facts;     // ["Sold into its own launch within 60 minutes …", …]
r.launcher?.summary;   // launches, graduated, fastExits, …
r.holdings?.text;      // "The launcher holds 28.9% of the supply right now, …"
r.funding?.siblings;   // other launchers funded by the same wallet (vibe/vibe)
r.linked;              // set when that wallet also funded red launchers`,
      ),
    );
  };
  const input = h("input", { type: "search", value: example, placeholder: "Token, wallet or launch #", "aria-label": "Token address, wallet address or launch number", spellcheck: "false" });
  const form = h(
    "form",
    {
      class: "check-search",
      onsubmit: (e) => {
        e.preventDefault();
        const q = input.value.trim().replace(/^#/, "");
        if (/^0x[0-9a-fA-F]{40}$/.test(q) || /^\d{1,7}$/.test(q)) render(q);
        else toastLike(input);
      },
    },
    icon("search", 18),
    input,
    h("button", { class: "btn primary", type: "submit" }, "Preview", icon("arrow", 16)),
  );
  render(example);
  const template = `<!-- on every launch page: replace {{TOKEN}} with the launch's token address -->
<a href="${SITE_URL}/c/{{TOKEN}}">
  <img src="${SITE_URL}/api/record?q={{TOKEN}}&format=svg" alt="KEPT record" height="20">
</a>`;
  return [
    h(
      "div",
      { class: "check-hero" },
      h("span", { class: "eyebrow rise" }, h("span", { class: "lamp ok" }), "For launchpads and token pages"),
      h("h1", { class: "display" }, words("Show the record where people buy.", { delay: 80, accent: ["buy."] })),
      h("p", { class: "lede rise", style: { animationDelay: "380ms" } }, "Every vibe/vibe and IMD launch already has a KEPT record. Put it next to the buy button: one line of code, free, no key, nothing to sign up for. Paste a token to see it."),
      h("div", { class: "rise", style: { animationDelay: "480ms" } }, form),
    ),
    reveal(h("section", { class: "check-sec" }, preview)),
    reveal(h("section", { class: "check-sec" }, h("h2", { class: "display-s" }, "Copy and paste"), blocks)),
    reveal(
      h(
        "section",
        { class: "check-sec" },
        h("h2", { class: "display-s" }, "On every launch at once"),
        h("p", { class: "muted" }, "A launchpad adds the badge to its launch page template once, and every launch shows its launcher's record from then on, including launches made after today."),
        block("Launch page template", null, template),
      ),
    ),
    h("p", { class: "fine muted check-rule" }, "The record states facts from public chain logs and never calls anyone a scammer. The colour follows a published rule: ", h("a", { href: link("/how") }, "how it works"), ". Questions or a launchpad not covered yet: ", h("a", { href: "https://x.com/keptonchainn", target: "_blank", rel: "noopener" }, "@keptonchainn"), "."),
  ];
}

/** A small shake on an input that wasn't a token, wallet or launch number. */
function toastLike(el) {
  el.setCustomValidity("Paste a token address, a wallet address or a launch number.");
  el.reportValidity();
  setTimeout(() => el.setCustomValidity(""), 2000);
}
