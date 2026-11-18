// The record: who is behind a token and what they did with their other launches.
// Reads /api/record, which serves the launcher index (scripts/records/indexer.mjs).

import { h, link, short, when } from "./dom.js";
import { reveal, words, countUp, magnetic, reduced } from "./fx.js";
import { icon } from "./icons.js";
import { load } from "./store.js";

const HOST = /(^|\.)vercel\.app$/.test(location.hostname) ? location.origin : "https://keptmd.vercel.app";
const EXPLORER = "https://explorer.testnet.chain.robinhood.com";

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
export const getRecord = (q) => getJSON(`${HOST}/api/record?q=${encodeURIComponent(q)}`, `record:${q.toLowerCase()}`, 120_000);
export const getTop = () => getJSON(`${HOST}/api/record?view=top&limit=12`, "record:top", 300_000);

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
const ex = (kind, v) => h("a", { class: "addr", href: `${EXPLORER}/${kind}/${v}`, target: "_blank", rel: "noopener" }, short(v));

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

// ------------------------------------------------------------------ home

export function checkHome({ examples }) {
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
      h("span", { class: "eyebrow rise" }, h("span", { class: "lamp alarm blink" }), "Live record · every vibe/vibe launch"),
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
        h("div", {}, stats.launches, h("span", {}, "launches on record")),
        h("div", { class: "alarm" }, stats.exiters, h("span", {}, "launchers sold into their own launch within an hour")),
        h("div", {}, stats.out, h("span", {}, "taken out by launchers selling their own tokens")),
        h("div", {}, stats.graduated, h("span", {}, "of launches ever graduated")),
      ),
    ),
    reveal(
      h(
        "section",
        { class: "exit-sec" },
        h("div", { class: "sec-head" }, h("h2", { class: "display-s" }, "Fastest exits"), h("p", { class: "muted" }, "Launchers that most often sold into their own launch within an hour of creating it. Every number links to its record, and every record links to the chain."), updated),
        board,
      ),
    ),
  ];
}

// ------------------------------------------------------------------ one record

function launchCard(l, { lead = false } = {}) {
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
          h("div", {}, h("b", {}, `Launch #${asked[0].id} exists on both vibe/vibe factories. `), "Showing the current factory. The first factory's #", String(asked[1].id), ": ", h("a", { href: link(`/check/${asked[1].token}`) }, short(asked[1].token)), "."),
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
        h("p", {}, /^0x/i.test(q) ? "This address hasn't launched a token on vibe/vibe, and isn't a vibe/vibe token. A wallet with no record isn't proven safe: it may be new, or launching from another wallet." : `No vibe/vibe launch #${q} on record yet.`),
      ),
    ];
  }
  const s = L.summary;
  const tone = TONE_CLASS[L.tone];
  const share = `https://x.com/intent/post?text=${encodeURIComponent(
    `Checked ${lead ? `$${lead.symbol}` : short(L.address)} on @keptonchainn. Its launcher: ${s.launches} launches, ${s.graduated} graduated, sold into ${s.fastExits} within an hour of launching.`,
  )}&url=${encodeURIComponent(`https://keptmd.vercel.app/#/check/${q}`)}`;
  const badge = `<img src="https://keptmd.vercel.app/api/record?q=${q}&format=svg" alt="KEPT record">`;
  return [
    ...head,
    reveal(
      h(
        "div",
        { class: `verdict-panel ${tone}` },
        h("div", { class: "vp-kicker" }, lead ? `$${lead.symbol} · launch #${lead.id} · launched by ` : "Launcher ", h("a", { class: "addr", href: `${EXPLORER}/address/${L.address}`, target: "_blank", rel: "noopener" }, L.address)),
        h("div", { class: "vp-word" }, TONE_WORD[L.tone]),
        h(
          "div",
          { class: "vp-nums" },
          h("div", {}, h("b", { class: "tnum" }, s.launches.toLocaleString("en-US")), h("span", {}, s.launches === 1 ? "launch" : "launches")),
          h("div", {}, h("b", { class: "tnum" }, s.graduated.toLocaleString("en-US")), h("span", {}, "graduated")),
          h("div", { class: s.fastExits ? "alarm" : "" }, h("b", { class: "tnum" }, s.fastExits.toLocaleString("en-US")), h("span", {}, "sold within an hour")),
          h("div", { class: Number(s.creatorOutEth.replace(/[<,]/g, "")) > 0 ? "alarm" : "" }, h("b", { class: "tnum" }, s.creatorOutEth), h("span", {}, "ETH out to the launcher")),
        ),
        h("ul", { class: "vp-facts" }, ...L.facts.map((f) => h("li", {}, f))),
        h(
          "div",
          { class: "vp-actions" },
          h("a", { class: "btn small", href: share, target: "_blank", rel: "noopener" }, icon("arrow", 14), "Post this record"),
          h("button", { class: "btn small", type: "button", onclick: (e) => navigator.clipboard?.writeText(badge).then(() => (e.currentTarget.textContent = "Badge code copied")) }, "Copy badge for a launch page"),
        ),
      ),
    ),
    lead ? reveal(h("section", { class: "check-sec" }, h("h2", { class: "display-s" }, "This launch"), launchCard(lead, { lead: true }))) : null,
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
    h("p", { class: "fine muted check-rule" }, rec.rule, " Facts from vibe/vibe's public event logs on Robinhood Chain testnet. A clean record isn't a promise: a launcher can use a fresh wallet. ", h("a", { href: link("/teams") }, "Teams that want to prove themselves lock tokens on KEPT"), "."),
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
