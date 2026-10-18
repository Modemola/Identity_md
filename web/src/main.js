import "./styles.css";
import { parseUnits, isAddress, getAddress, parseEventLogs } from "viem";
import { config, deployed } from "./config.js";
import {
  client,
  vaultAbi,
  hookAbi,
  tokenInfo,
  getPledges,
  getPledge,
  getConstants,
  getHistory,
  cachedPledges,
  cachedPledge,
  cachedConstants,
  cachedHistory,
  prefetchPledge,
  previewQuestion,
  uuidFromBytes32,
  oracleRequest,
  connect,
  currentAccount,
  onAccount,
  send,
  needsAllowance,
  ensureAllowance,
  balanceOf,
  reason,
} from "./chain.js";
import { invalidate, sig } from "./store.js";
import { h, fill, link, short, addrLink, now, fmt, when, span, IMD_DECIMALS } from "./dom.js";
import { initTheme, themeSwitch, reveal, words, countUp, magnetic, spotlight, tilt, liveInterval, setInstant, canTransition, reduced } from "./fx.js";
import { icon, TEMPLATE_ICON } from "./icons.js";
import { verdictUnit, sampleData } from "./hero.js";
import { toast, runSteps, skeletonRows, commandPalette } from "./ui.js";

initTheme();

// ------------------------------------------------------------------ milestone state

const TEMPLATE_LABEL = ["GitHub release", "Page contains", "Contract deployed", "Value at least"];
const TIMEOUT = 86400n;
const ZERO32 = `0x${"0".repeat(64)}`;

function state(m, grace) {
  const t = now();
  if (m.outcome === 1) return m.settled ? { cls: "kept", chip: "Kept · released" } : { cls: "kept", chip: "Kept · ready to release" };
  if (m.outcome === 2) return { cls: "broken", chip: "Broken · burned" };
  if (m.inFlight !== ZERO32 && t < m.askedAt + TIMEOUT) return { cls: "checking", chip: "Swarm checking" };
  if (t < m.deadline) return { cls: "open", chip: `Due in ${span(m.deadline - t)}` };
  if (t <= m.deadline + grace) return { cls: "open", chip: `${m.kind === 0 ? "Proof" : "Delivery"} window · ${span(m.deadline + grace - t)} left` };
  return { cls: "broken", chip: "Unproven · burn pending" };
}

const tally = (pledges) => {
  let kept = 0;
  let broken = 0;
  for (const p of pledges)
    for (const m of p.milestones) {
      if (m.outcome === 1) kept++;
      if (m.outcome === 2) broken++;
    }
  return { kept, broken };
};

// ------------------------------------------------------------------ the shell (built once, never re-rendered)

const NAV = [
  ["/", "Pledges"],
  ["/new", "Make a pledge"],
  ["/referee", "Referee Fund"],
  ["/how", "How it works"],
];
const navLinks = NAV.map(([p, l]) => h("a", { href: link(p), "data-p": p }, l));
const navInd = h("span", { class: "nav-ind", "aria-hidden": "true" });
const navEl = h("nav", { class: "links", "aria-label": "Main" }, navInd, navLinks);
const acctBtn = h("button", { class: "btn acct", onclick: () => connect().catch((e) => toast(reason(e), "alarm")) }, icon("wallet", 16), h("span", {}, "Connect"));
const main = h("main", { id: "content" });
let activePath = null;

function setActive(path) {
  activePath = path;
  let on = null;
  for (const a of navLinks) {
    const hit = a.dataset.p === path;
    a.classList.toggle("active", hit);
    if (hit) (on = a), a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  if (!on) return (navInd.style.opacity = "0");
  navInd.style.opacity = "1";
  // a 100px block scaled to the link: only `transform` animates, so the slide is compositor-only
  navInd.style.transform = `translateX(${on.offsetLeft}px) scaleX(${on.offsetWidth / 100})`;
}

function renderAccount(acct) {
  acctBtn.classList.toggle("on", !!acct);
  acctBtn.replaceChildren(acct ? h("span", { class: "lamp ok" }) : icon("wallet", 16), h("span", {}, acct ? short(acct) : "Connect"));
}

const palette = commandPalette(() => [
  ...NAV.map(([p, l]) => ({ path: p, label: l, hint: "page" })),
  ...(cachedPledges() || []).map((p) => {
    const t = tally([p]);
    return { path: `/pledge/${p.id}`, label: p.name, hint: `#${p.id} · ${t.kept}/${p.count} kept`, tone: t.broken ? "broken" : t.kept === p.count ? "kept" : "open" };
  }),
]);

function shell() {
  const header = h(
    "header",
    { class: "top" },
    h(
      "div",
      { class: "wrap" },
      h("a", { class: "logo", href: link("/"), "aria-label": "KEPT home" }, h("span", { class: "mark" }, icon("seal", 20)), h("span", { class: "word" }, "KEPT")),
      navEl,
      h("span", { class: "spacer" }),
      h("button", { class: "kbd-btn", "aria-label": "Jump to a pledge or page", onclick: () => palette.open() }, icon("search", 15), h("kbd", {}, "⌘K")),
      h("button", { class: "iconbtn theme-btn", "aria-label": "Toggle light and dark", onclick: (e) => themeSwitch(e) }, icon("moon", 18), icon("sun", 18)),
      acctBtn,
    ),
  );
  const footer = h(
    "footer",
    { class: "site" },
    h(
      "div",
      { class: "wrap" },
      h("div", {}, h("b", {}, "KEPT"), " · promises the IMD swarm enforces"),
      h(
        "div",
        { class: "foot-links" },
        deployed ? h("span", {}, "Vault ", addrLink(config.vault)) : null,
        config.hook ? h("span", {}, "Hook ", addrLink(config.hook)) : null,
        h("a", { href: config.repo, target: "_blank", rel: "noopener" }, "Source"),
        h("a", { href: "https://imd.fun", target: "_blank", rel: "noopener" }, "IMD"),
      ),
    ),
  );
  document.getElementById("app").replaceChildren(header, main, footer);
  // widths change once the web font lands; keep the indicator glued to its link
  new ResizeObserver(() => activePath && setActive(activePath)).observe(navEl);
  document.fonts?.ready.then(() => {
    setActive(activePath);
    requestAnimationFrame(() => navInd.classList.add("ready"));
  });
}

// ------------------------------------------------------------------ painting pages

let navToken = 0; // bumps on every navigation; stale async work checks it before painting
const onLeave = []; // stops for the current page's timers, run on every route
const whileHere = (stop) => onLeave.push(stop);
let pendingApply = null; // the newest paint waiting on a running view transition

/**
 * Paints `build()` into <main>. A navigation (not quiet) scrolls to the top and runs inside a
 * view transition. A quiet paint (fresh data for the page already on screen) keeps the scroll
 * position and open <details>, and builds with entrances switched off so nothing replays.
 */
function paint(active, build, { quiet = false } = {}) {
  const openKeys = quiet ? [...main.querySelectorAll("details[data-k][open]")].map((d) => d.dataset.k) : [];
  setInstant(quiet);
  let content;
  try {
    content = [build()].flat(Infinity).filter(Boolean);
  } finally {
    setInstant(false);
  }
  const apply = () => {
    main.replaceChildren(...content);
    main.classList.toggle("quiet", quiet);
    // without view transitions, the page itself rises in
    main.classList.remove("enter");
    if (!quiet && !canTransition()) void main.offsetWidth, main.classList.add("enter");
    for (const k of openKeys) main.querySelector(`details[data-k="${k}"]`)?.setAttribute("open", "");
    setActive(active);
    if (!quiet) window.scrollTo(0, 0);
  };
  if (pendingApply) return void (pendingApply = apply);
  if (!quiet && canTransition() && main.childElementCount) {
    pendingApply = apply;
    document.startViewTransition(() => {
      const run = pendingApply;
      pendingApply = null;
      run();
      window.scrollTo(0, 0);
    });
    return;
  }
  apply();
}

const sec = (n, title, aside) =>
  reveal(h("div", { class: "sec" }, h("span", { class: "n" }, n), h("h2", {}, title), aside ? h("span", { class: "aside" }, aside) : null));

const notLive = () =>
  h(
    "div",
    { class: "banner" },
    h("span", { class: "lamp caution blink" }),
    h("div", {}, h("b", {}, "Launching on Robinhood Chain. "), h("span", { class: "muted" }, "The contracts are being audited and deployed by the IMD swarm. This page goes live with real pledges the moment they land.")),
  );

/** Shown whenever the owner has proposed a new Intake or oracle signer: it is public for 7 days first. */
function pendingBanner(c) {
  const p = c?.pendingChange;
  if (!p) return null;
  return h(
    "div",
    { class: "banner warn" },
    h("span", { class: "lamp alarm blink" }),
    h(
      "div",
      {},
      h("b", {}, "Protocol change pending. "),
      "The KEPT owner proposed a new oracle Intake ", addrLink(p.intake), " and signer ", addrLink(p.signer),
      `. It cannot take effect before ${when(p.readyAt)}. Every change waits seven days in public.`,
    ),
  );
}

/** Runs on-chain steps with the live sheet, then marks `keys` stale and repaints the page quietly. */
async function onchain(button, title, steps, keys = []) {
  const ok = await runSteps(title, steps, { button });
  if (!ok) return false;
  invalidate("pledges", "constants", ...keys);
  route({ quiet: true });
  return true;
}

const one = (call) => [{ label: "Send the transaction", run: (ph) => send(call, ph) }];

// ------------------------------------------------------------------ status bar (IMD's bottom strip)

const bar = {
  block: h("b", { class: "tnum" }, "—"),
  pledges: h("b", { class: "tnum" }, "—"),
  kept: h("b", { class: "tnum" }, "—"),
  broken: h("b", { class: "tnum" }, "—"),
  oracle: h("b", { class: "tnum" }, "—"),
  end: h("div", { class: "cell end" }, h("span", { class: "lamp caution" }), deployed ? "Reading the vault" : "Launching"),
};

function statusbar() {
  const el = h(
    "div",
    // not a live region: the block number changes every few seconds and would be read out each time
    { class: "statusbar", "aria-label": "Network status" },
    h("div", { class: "cell" }, h("span", { class: "lamp ok blink" }), "Robinhood ", bar.block),
    h("div", { class: "cell" }, bar.pledges, " pledges"),
    h("div", { class: "cell" }, bar.kept, " kept · ", bar.broken, " broken"),
    h("div", { class: "cell" }, bar.oracle, " IMD oracle answers"),
    bar.end,
  );
  document.body.append(el);
  const tick = (el, text) => {
    if (el.textContent === text) return;
    el.textContent = text;
    el.classList.remove("tick");
    void el.offsetWidth;
    el.classList.add("tick");
  };
  const refresh = () => {
    client.getBlockNumber().then((b) => tick(bar.block, `#${b.toLocaleString("en-US")}`)).catch(() => {});
    fetch(`${config.imdApi}/oracle/counts`)
      .then((r) => r.json())
      .then((d) => tick(bar.oracle, Number(d.byStatus?.attested ?? d.total).toLocaleString("en-US")))
      .catch(() => {});
    if (deployed)
      getPledges({ maxAge: 10_000 })
        .then(setStats)
        .catch(() => bar.end.replaceChildren(h("span", { class: "lamp alarm" }), "Vault unreachable"));
  };
  const cached = cachedPledges();
  if (cached) setStats(cached);
  refresh();
  liveInterval(el, refresh, 12_000);
}

function setStats(pledges) {
  const { kept, broken } = tally(pledges);
  bar.pledges.textContent = pledges.length;
  bar.kept.textContent = kept;
  bar.broken.textContent = broken;
  bar.end.className = "cell end ok";
  bar.end.replaceChildren(h("span", { class: "lamp ok" }), "Vault live");
}

// ------------------------------------------------------------------ home

let homeUnit = null; // the swarm scope survives navigation: its GL context is made once
let lastPledgeOpened = null;

function viewHome({ quiet }) {
  const token = navToken;
  homeUnit ||= verdictUnit({ live: deployed });
  const figs = {
    pledges: h("div", { class: "v tnum" }, "—"),
    kept: h("div", { class: "v kept tnum" }, "—"),
    broken: h("div", { class: "v broken tnum" }, "—"),
    fund: h("div", { class: "v tnum" }, "—"),
  };
  const listEl = h("div", { class: "rows" });
  const banners = h("div", {});
  let lastSig = null;

  const apply = (c, pledges) => {
    const s = sig([c, pledges]);
    if (s === lastSig) return;
    const first = lastSig === null;
    lastSig = s;
    const { kept, broken } = tally(pledges);
    banners.replaceChildren(...[pendingBanner(c)].filter(Boolean));
    countUp(figs.pledges, pledges.length);
    countUp(figs.kept, kept);
    countUp(figs.broken, broken);
    countUp(figs.fund, Number(c.refereeFund) / 1e18, (n) => n.toLocaleString("en-US", { maximumFractionDigits: 2 }));
    homeUnit.update(liveData(pledges, c.grace, kept, broken));
    setInstant(!first || quiet);
    listEl.replaceChildren(
      ...(pledges.length
        ? pledges.map((p, i) => reveal(pledgeRow(p, c.grace), Math.min(i, 6) * 70))
        : [h("div", { class: "empty" }, "No pledges yet. Be the first to put your roadmap on the line.")]),
    );
    setInstant(false);
  };

  paint(
    "/",
    () =>
      h(
        "section",
        { class: "wrap" },
        h(
          "div",
          { class: "hero", "data-swarm-zone": "" },
          h(
            "div",
            { class: "hero-copy" },
            h("span", { class: "eyebrow rise", style: { animationDelay: "60ms" } }, h("span", { class: "lamp ok blink" }), "IMD oracle · Robinhood Chain"),
            h("h1", {}, words("Promises the swarm enforces.", { delay: 140, accent: ["swarm"] })),
            h(
              "p",
              { class: "lede rise", style: { animationDelay: "480ms" } },
              "A team locks its tokens behind public milestones. At each deadline the IMD swarm checks the milestone and signs a verdict onchain. ",
              h("span", { class: "k-ok" }, "Kept"),
              ": the tokens unlock to the team. ",
              h("span", { class: "k-bad" }, "Broken"),
              ": they burn.",
            ),
            h(
              "div",
              { class: "ctas rise", style: { animationDelay: "620ms" } },
              magnetic(h("a", { class: "btn primary", href: link("/new") }, "Make a pledge", icon("arrow", 16))),
              magnetic(h("a", { class: "btn", href: link("/how") }, "How it works")),
            ),
            h(
              "div",
              { class: "hero-meta rise", style: { animationDelay: "760ms" } },
              h("span", {}, h("b", {}, "0.5 IMD"), " per check"),
              h("span", {}, h("b", {}, "9"), " agents · ", h("b", {}, "7"), " must agree"),
              h("span", {}, h("b", {}, "3 days"), " to prove"),
            ),
          ),
          h("div", { class: "hero-unit rise", style: { animationDelay: "300ms" } }, homeUnit),
        ),
        banners,
        reveal(
          h(
            "div",
            { class: "figures" },
            h("div", { class: "figure" }, figs.pledges, h("div", { class: "label l" }, "Pledges")),
            h("div", { class: "figure" }, figs.kept, h("div", { class: "label l" }, "Milestones kept")),
            h("div", { class: "figure" }, figs.broken, h("div", { class: "label l" }, "Milestones broken")),
            h("div", { class: "figure" }, figs.fund, h("div", { class: "label l" }, "Referee Fund · IMD")),
          ),
        ),
        sec("01", "Live pledges", "newest first"),
        listEl,
        sec("02", "How it works"),
        stepsGrid(),
      ),
    { quiet },
  );

  if (!deployed) {
    banners.replaceChildren(notLive());
    homeUnit.update(sampleData());
    listEl.replaceChildren(h("div", { class: "empty" }, "No pledges yet. The first one will be KEPT's own roadmap, locked the day the vault deploys."));
    return;
  }

  const c0 = cachedConstants();
  const p0 = cachedPledges();
  if (c0 && p0) apply(c0, p0);
  else listEl.replaceChildren(...skeletonRows(3));

  const refresh = (maxAge) =>
    Promise.all([getConstants({ maxAge }), getPledges({ maxAge })])
      .then(([c, pledges]) => token === navToken && apply(c, pledges))
      .catch((e) => {
        if (token !== navToken || lastSig) return;
        homeUnit.update(sampleData());
        listEl.replaceChildren(h("div", { class: "empty" }, `Could not read the vault: ${reason(e)}`));
      });
  refresh(quiet ? 0 : 5_000);
  whileHere(liveInterval(listEl, () => token === navToken && refresh(0), 20_000));
}

/** The swarm scope's feed from real milestones: newest pledges first, one line per milestone. */
function liveData(pledges, grace, kept, broken) {
  const lamps = [];
  const feed = [];
  for (const p of pledges.slice(0, 4)) {
    for (const m of p.milestones) {
      const st = state(m, grace);
      lamps.push(st.cls);
      const d = new Date(Number(m.deadline) * 1000);
      feed.push({
        t: `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`,
        who: `pledge #${p.id}`,
        what: `${m.title} · ${st.chip}`,
        tone: st.cls === "kept" ? "ok" : st.cls === "broken" ? "alarm" : st.cls === "checking" ? "caution" : "",
      });
    }
  }
  return { kept, broken, lamps, feed: feed.length ? feed : sampleData().feed };
}

function pledgeRow(p, grace) {
  const { kept, broken } = tally([p]);
  const next = p.milestones.filter((m) => m.outcome === 0).sort((a, b) => Number(a.deadline - b.deadline))[0];
  const lead = broken ? "broken" : next ? state(next, grace).cls : "kept";
  const title = h("div", { class: "title" }, p.name);
  if (lastPledgeOpened === p.id) title.style.viewTransitionName = "ptitle";
  const warm = () => prefetchPledge(p.id);
  return spotlight(
    h(
      "a",
      {
        class: "row",
        href: link(`/pledge/${p.id}`),
        onpointerenter: warm,
        onfocus: warm,
        ontouchstart: warm,
        onclick: () => {
          main.querySelectorAll(".row .title").forEach((t) => (t.style.viewTransitionName = ""));
          title.style.viewTransitionName = "ptitle";
          lastPledgeOpened = p.id;
        },
      },
      h("span", { class: `glyph ${lead}` }, icon(lead === "kept" ? "seal" : lead === "broken" ? "flame" : "lock", 20)),
      h(
        "div",
        { style: { minWidth: 0 } },
        title,
        h(
          "div",
          { class: "meta" },
          h("span", { class: `chip ${lead}` }, h("span", { class: `lamp ${lead}` }), `${kept}/${p.count} kept`),
          h("span", {}, `${fmt(p.locked, p.tokenInfo.decimals)} ${p.tokenInfo.symbol} locked`),
          next ? h("span", { class: "next" }, `next: ${next.title} · ${state(next, grace).chip}`) : h("span", {}, "all settled"),
        ),
        h("div", { class: "track" }, p.milestones.map((m, i) => h("i", { class: state(m, grace).cls, title: m.title, style: { "--i": i } }))),
      ),
      h("div", { class: "right" }, h("span", { class: "pid" }, `#${p.id}`), h("span", {}, "by ", short(p.creator)), h("span", { class: "go" }, icon("arrow", 16))),
    ),
  );
}

function stepsGrid() {
  return h(
    "div",
    { class: "steps" },
    reveal(step("01", "lock", "Lock", "The team locks tokens behind up to eight milestones, each with a deadline and a check the swarm can answer."), 0),
    reveal(step("02", "pulse", "The swarm checks", "The team asks the IMD oracle. A panel of agents answers and the network signs the verdict; the vault verifies it onchain."), 90),
    reveal(step("03", "flame", "Kept or burned", "Delivered: the tranche unlocks to the team. Not proven within three days of the deadline: it burns."), 180),
  );
}

const step = (n, ic, t, p) => tilt(spotlight(h("div", { class: "step" }, h("div", { class: "n" }, n), h("span", { class: "step-ic" }, icon(ic, 24)), h("h3", {}, t), h("p", {}, p))), 4);

// ------------------------------------------------------------------ pledge page

function viewPledge(id, { quiet }) {
  const token = navToken;
  if (!deployed) return paint("/", () => h("section", { class: "wrap" }, h("a", { class: "back", href: link("/") }, "← All pledges"), notLive()), { quiet });

  let lastSig = null;
  let skeleton = false;
  const draw = (p, c, quietDraw) => {
    const s = sig([p, c, currentAccount()]);
    if (s === lastSig) return;
    lastSig = s;
    paint("/", () => pledgeContent(p, c), { quiet: quietDraw });
    const hist = cachedHistory(id);
    if (hist) fillHistory(hist);
  };

  const p0 = cachedPledge(id);
  const c0 = cachedConstants();
  if (p0 && c0) draw(p0, c0, quiet);
  else (skeleton = true), paint("/", () => pledgeSkeleton(id), { quiet });

  const refresh = (maxAge) =>
    Promise.all([getPledge(id, { maxAge }), getConstants({ maxAge: Math.max(maxAge, 30_000) })])
      // after a skeleton, the real page fades in; after cached data, it updates in place
      .then(([p, c]) => token === navToken && draw(p, c, lastSig !== null || (quiet && !skeleton)))
      .catch(() => {
        if (token !== navToken || lastSig) return;
        paint("/", () => h("section", { class: "wrap" }, h("a", { class: "back", href: link("/") }, "← All pledges"), h("div", { class: "empty" }, `Pledge #${id} not found.`)), { quiet: true });
      });
  const history = (maxAge) =>
    getHistory(id, { maxAge })
      .then((hist) => token === navToken && fillHistory(hist))
      .catch((e) => token === navToken && main.querySelectorAll(".verdicts").forEach((el) => el.replaceChildren(h("div", { class: "verdict" }, `History unavailable: ${reason(e)}`))));

  refresh(quiet ? 0 : 4_000).then(() => history(quiet ? 0 : 15_000));
  // a pledge with a check in flight is worth watching: the verdict lands on its own
  whileHere(liveInterval(main, () => token === navToken && refresh(0).then(() => history(0)), 15_000));
}

function pledgeSkeleton(id) {
  return h(
    "section",
    { class: "wrap" },
    h("a", { class: "back", href: link("/") }, "← All pledges"),
    h("div", { class: "label", style: { marginTop: "22px" } }, `Pledge #${id}`),
    h("div", { class: "sk sk-title" }),
    h("div", { class: "sk sk-line w40" }),
    h("div", { class: "kv sk-kv" }, [0, 1, 2, 3].map(() => h("div", {}, h("span", { class: "sk sk-line w40" }), h("span", { class: "sk sk-line w60" })))),
    h("div", { class: "rows", style: { marginTop: "40px" } }, skeletonRows(2)),
  );
}

let historyFill = null; // set by pledgeContent: renders history into the milestone rows on screen
function fillHistory(hist) {
  historyFill?.(hist);
}

function pledgeContent(p, c) {
  const dec = p.tokenInfo.decimals;
  const total = p.milestones.reduce((x, m) => x + m.amount, 0n);
  const keptAmt = p.milestones.filter((m) => m.outcome === 1).reduce((x, m) => x + m.amount, 0n);
  const brokenAmt = p.milestones.filter((m) => m.outcome === 2).reduce((x, m) => x + m.amount, 0n);
  const acct = currentAccount();
  const isBeneficiary = acct && p.beneficiary.toLowerCase() === acct.toLowerCase();
  const historyEls = new Map(p.milestones.map((m) => [m.index, h("div", { class: "verdicts" })]));
  historyFill = (hist) => {
    // no isConnected check: inside a view transition the rows are built before they are attached
    for (const [index, el] of historyEls) renderHistory(el, index, hist);
  };
  const title = h("h1", { class: "page-title" }, p.name);
  title.style.viewTransitionName = "ptitle";
  lastPledgeOpened = p.id;
  const pct = (x) => (total ? Number((x * 1000n) / total) / 10 : 0);

  return h(
    "section",
    { class: "wrap" },
    h("a", { class: "back", href: link("/") }, "← All pledges"),
    h("div", { class: "label", style: { marginTop: "22px" } }, `Pledge #${p.id} · locks ${p.tokenInfo.symbol}`),
    title,
    h("div", { class: "muted meta-line" }, "Token ", addrLink(p.token), " · created ", when(p.createdAt), " by ", addrLink(p.creator), " · beneficiary ", addrLink(p.beneficiary)),
    pendingBanner(c),
    reveal(
      h(
        "div",
        { class: "kv" },
        kv("Still locked", `${fmt(p.locked, dec)} ${p.tokenInfo.symbol}`, `${pct(p.locked)}%`),
        kv("Released to team", `${fmt(keptAmt, dec)} ${p.tokenInfo.symbol}`, `${pct(keptAmt)}%`, "kept"),
        kv("Burned", `${fmt(brokenAmt, dec)} ${p.tokenInfo.symbol}`, `${pct(brokenAmt)}%`, "broken"),
        kv("Check budget", `${fmt(p.budget, IMD_DECIMALS)} IMD`, ((n) => `${n} check${n === 1 ? "" : "s"}`)(Math.floor(Number(p.budget) / 5e17))),
      ),
    ),
    reveal(
      timeline(
        p.milestones.map((m) => ({ index: m.index, title: m.title, deadline: m.deadline, cls: state(m, c.grace).cls })),
        { start: p.createdAt, grace: c.grace, onPick: (i) => focusMilestone(i) },
      ),
      80,
    ),
    h("div", { class: "muted fine" }, `Panel of ${p.panelSize}, ${p.quorum} must agree · ${c.maxAttempts} checks per milestone · ${span(c.grace)} delivery grace; page and chain verdicts must be signed by the deadline`),
    sec("01", "Milestones", `${p.count - p.open}/${p.count} settled`),
    h("div", { class: "rows" }, p.milestones.map((m) => milestoneRow(p, m, c, total, isBeneficiary, historyEls.get(m.index)))),
    budgetBox(p),
  );
}

function focusMilestone(i) {
  const row = document.getElementById(`ms-${i}`);
  if (!row) return;
  row.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  row.classList.remove("flash");
  void row.offsetWidth;
  row.classList.add("flash");
}

function kv(k, v, sub, tone = "") {
  return h("div", {}, h("div", { class: "k" }, k), h("div", { class: `v tnum ${tone}`, title: v }, v), sub ? h("div", { class: "sub" }, sub) : null);
}

/**
 * The pledge on a time axis: from creation to the last proof window. Each milestone is a node at
 * its deadline with its proof window hatched after it; the elapsed part of the axis is filled and
 * a NOW marker sits on it. Nodes jump to their milestone.
 */
function timeline(items, { start, grace, onPick, compact = false }) {
  if (!items.length) return h("div", { class: "tl empty-tl" }, h("span", { class: "muted" }, "Milestones appear here on a timeline."));
  const t = now();
  const lastEnd = items.reduce((x, m) => (m.deadline + grace > x ? m.deadline + grace : x), 0n);
  const s0 = start < t ? start : t;
  const end = lastEnd > t ? lastEnd : t + 86400n;
  const span_ = Number(end - s0) || 1;
  const at = (ts) => Math.min(100, Math.max(0, (Number(ts - s0) / span_) * 100));
  const nowX = at(t);
  const nodes = [...items].sort((a, b) => Number(a.deadline - b.deadline));
  const dateOf = (ts) => new Date(Number(ts) * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const inner = h("div", { class: "tl-in" });
  // nodes closer than their own width at the current size step up onto a second row
  const xs = nodes.map((m) => at(m.deadline));
  new ResizeObserver(([e]) => {
    const w = e.contentRect.width;
    let lastX = -Infinity;
    let lastLifted = false;
    inner.querySelectorAll(".tl-node").forEach((el, i) => {
      const px = (xs[i] / 100) * w;
      const lift = px - lastX < 32 && !lastLifted;
      el.classList.toggle("lift", lift);
      lastLifted = lift;
      lastX = px;
    });
  }).observe(inner);
  return h(
    "div",
    { class: `tl${compact ? " compact" : ""}`, role: "group", "aria-label": "Milestone timeline" },
    fill(
      inner,
    h("div", { class: "tl-axis" }, h("i", { class: "tl-fill", style: { "--x": nowX / 100 } })),
    nodes.map((m) =>
      h("i", { class: `tl-grace ${m.cls}`, style: { left: `${at(m.deadline)}%`, width: `${Math.max(at(m.deadline + grace) - at(m.deadline), 0.6)}%` } }),
    ),
    h("div", { class: "tl-now", style: { left: `${nowX}%` } }, h("span", {}, "NOW")),
    nodes.map((m, i) =>
      h(
        "button",
        {
          type: "button",
          class: `tl-node ${m.cls}`,
          style: { left: `${at(m.deadline)}%`, "--i": i },
          "data-tip": `${m.title || "Untitled"} · ${dateOf(m.deadline)}`,
          "aria-label": `Milestone ${m.index + 1}: ${m.title || "untitled"}, due ${dateOf(m.deadline)}`,
          onclick: () => onPick?.(m.index),
        },
        String(m.index + 1).padStart(2, "0"),
      ),
    ),
    ),
    compact ? null : h("div", { class: "tl-ends" }, h("span", {}, dateOf(s0)), h("span", {}, dateOf(end))),
  );
}

function specLine(m) {
  const x = m.spec;
  switch (m.kind) {
    case 0:
      return ["release ", h("code", {}, x.b), " on ", h("a", { href: `https://github.com/${x.a}`, target: "_blank", rel: "noopener" }, `github.com/${x.a}`)];
    case 1:
      return ["page ", h("a", { href: x.a, target: "_blank", rel: "noopener nofollow" }, x.a), " shows ", h("code", {}, x.b)];
    case 2:
      return ["contract ", h("code", {}, short(x.target)), ` deployed on chain ${x.chainId}`];
    default:
      return [h("code", {}, x.a), " on ", h("code", {}, short(x.target)), ` (chain ${x.chainId}) ≥ `, rawValue(x.threshold)];
  }
}

function milestoneRow(p, m, c, total, isBeneficiary, historyEl) {
  const st = state(m, c.grace);
  const dec = p.tokenInfo.decimals;
  const pct = total ? Number((m.amount * 10000n) / total) / 100 : 0;
  const id = BigInt(p.id);
  const call = (functionName) => ({ address: config.vault, abi: vaultAbi, functionName, args: [id, m.index] });
  const keys = [`pledge:${p.id}`, `history:${p.id}`];
  const actions = [];
  if (m.outcome === 0 && st.cls !== "checking" && m.gate.open) {
    if (isBeneficiary && m.gate.funded) {
      actions.push(
        magnetic(
          h(
            "button",
            {
              class: "btn primary small",
              onclick: async (e) => {
                if (await onchain(e.currentTarget, "Ask the swarm", [{ label: `Send milestone ${m.index + 1} to the IMD oracle · at most 0.5 IMD`, run: (ph) => send(call("check"), ph) }], keys))
                  toast("The swarm is on it. The verdict lands here on its own, usually within minutes.", "ok");
              },
            },
            icon("pulse", 15),
            "Ask the swarm · up to 0.5 IMD",
          ),
        ),
      );
    } else if (isBeneficiary) {
      actions.push(h("span", { class: "note" }, "A check needs enough budget and an Intake price at or below 0.5 IMD."));
    } else {
      actions.push(h("span", { class: "note" }, `Only the beneficiary can ask the swarm to confirm this. Not proven by ${when(m.deadline + c.grace)}: it burns.`));
    }
  }
  const checkPending = m.inFlight !== ZERO32 && now() < m.askedAt + TIMEOUT; // the vault refuses to settle then
  if (!m.settled && (m.outcome === 1 || (m.outcome === 0 && now() > m.deadline + c.grace && !checkPending))) {
    const burning = m.outcome !== 1;
    actions.push(
      h(
        "button",
        { class: `btn small ${burning ? "danger" : "primary"}`, onclick: (e) => onchain(e.currentTarget, burning ? "Burn the tranche" : "Release the tranche", one(call("settle")), keys) },
        icon(burning ? "flame" : "check", 15),
        burning ? "Settle · burn tranche" : "Settle · release to team",
      ),
    );
  }
  if (m.inFlight !== ZERO32 && now() >= m.askedAt + TIMEOUT && m.outcome === 0) {
    actions.push(h("button", { class: "btn small", onclick: (e) => onchain(e.currentTarget, "Clear the unanswered check", one(call("clearStale")), keys) }, "Clear unanswered check"));
  }

  let bodyText = m.question;
  try {
    const b = JSON.parse(m.question);
    bodyText = `${b.question}\n\nevidence: ${b.evidence} · chain ${b.chainId} · panel ${b.panelSize}, quorum ${b.quorum}`;
  } catch {}

  const stamp = m.outcome === 1 ? h("div", { class: "stamp kept", "aria-hidden": "true" }, "KEPT ✓") : m.outcome === 2 ? h("div", { class: "stamp broken", "aria-hidden": "true" }, "BROKEN ✕") : null;

  return reveal(
    h(
      "div",
      { class: `ms ${st.cls}`, id: `ms-${m.index}` },
      h("div", { class: "num" }, String(m.index + 1).padStart(2, "0")),
      h(
        "div",
        { style: { minWidth: 0 } },
        h("div", { class: "chips" }, h("span", { class: `chip ${st.cls}` }, h("span", { class: `lamp ${st.cls}` }), st.chip), h("span", { class: "chip kind" }, icon(TEMPLATE_ICON[m.kind], 13), TEMPLATE_LABEL[m.kind])),
        h("h3", {}, m.title),
        h("div", { class: "when" }, "due ", when(m.deadline), " · ", specLine(m)),
        h("details", { class: "q", "data-k": `q${m.index}` }, h("summary", {}, "What the swarm is asked"), h("pre", {}, bodyText)),
        historyEl,
        actions.length ? h("div", { class: "actions" }, actions) : null,
      ),
      h("div", { class: "amount tnum" }, `${fmt(m.amount, dec)} ${p.tokenInfo.symbol}`, h("small", {}, `${pct}% · ${m.attempts}/${c.maxAttempts} checks`)),
      stamp,
    ),
  );
}

function renderHistory(el, index, hist) {
  const rows = [];
  const tx = (hash) => h("a", { href: `${config.explorer}/tx/${hash}`, target: "_blank", rel: "noopener" }, "tx");
  for (const log of hist.checks.filter((l) => Number(l.args.index) === index)) {
    rows.push({ block: log.blockNumber, at: log.logIndex, node: h("div", { class: "verdict" }, h("span", { class: "chip checking" }, h("span", { class: "lamp open" }), `check ${log.args.attempt}`), "asked the swarm · ", tx(log.transactionHash)) });
  }
  for (const log of hist.verdicts.filter((l) => Number(l.args.index) === index)) {
    const uuid = uuidFromBytes32(log.args.oracleRequestId);
    const jobLink = h("span", {});
    const kept = log.args.kept;
    rows.push({
      block: log.blockNumber,
      at: log.logIndex,
      node: h(
        "div",
        { class: "verdict" },
        h("span", { class: `chip ${kept ? "kept" : "broken"}` }, h("span", { class: `lamp ${kept ? "kept" : "broken"}` }), kept ? "swarm: delivered" : "swarm: not delivered"),
        h("span", { class: "agree", title: `${log.args.agreed} of ${log.args.panelSize}` }, Array.from({ length: Number(log.args.panelSize) }, (_, i) => h("i", { class: i < Number(log.args.agreed) ? (kept ? "kept" : "broken") : "" }))),
        `${log.args.agreed} of ${log.args.panelSize} agreed (quorum ${log.args.quorum}) · `,
        h("a", { href: `${config.imdApi}/oracle/requests/${uuid}/attestation`, target: "_blank", rel: "noopener" }, "signed verdict"),
        jobLink,
      ),
    });
    oracleRequest(uuid)
      .then((r) => r.jobId && jobLink.replaceChildren(" · ", h("a", { href: `${config.imdExplorer}/jobs/${r.jobId}`, target: "_blank", rel: "noopener" }, "panel on IMD explorer")))
      .catch(() => {});
  }
  for (const log of hist.rebates.filter((l) => Number(l.args.index) === index)) {
    rows.push({ block: log.blockNumber, at: log.logIndex, node: h("div", { class: "verdict" }, h("span", { class: "chip kept" }, h("span", { class: "lamp kept" }), "rebate"), `Referee Fund refunded ${fmt(log.args.amount, IMD_DECIMALS)} IMD`) });
  }
  for (const log of hist.settles.filter((l) => Number(l.args.index) === index)) {
    const kept = Number(log.args.outcome) === 1;
    rows.push({ block: log.blockNumber, at: log.logIndex, node: h("div", { class: "verdict" }, h("span", { class: `chip ${kept ? "kept" : "broken"}` }, h("span", { class: `lamp ${kept ? "kept" : "broken"}` }), kept ? "released" : "burned"), kept ? "tranche sent to the beneficiary · " : "tranche sent to 0x…dEaD · ", tx(log.transactionHash)) });
  }
  rows.sort((a, b) => Number(a.block - b.block) || a.at - b.at);
  const fresh = !el.childElementCount;
  el.replaceChildren(...rows.map((r, i) => (fresh && !reduced ? (r.node.classList.add("v-in"), r.node.style.setProperty("--i", i), r.node) : r.node)));
}

function budgetBox(p) {
  const keys = [`pledge:${p.id}`];
  if (p.open === 0) {
    if (p.budget === 0n) return null;
    return h(
      "div",
      { class: "summary inline", style: { marginTop: "28px" } },
      h("span", {}, h("b", {}, `${fmt(p.budget, IMD_DECIMALS)} IMD`), " of unused check budget is waiting for the creator."),
      h("button", { class: "btn small", onclick: (e) => onchain(e.currentTarget, "Return the budget", one({ address: config.vault, abi: vaultAbi, functionName: "withdrawBudget", args: [BigInt(p.id)] }), keys) }, "Return it to the creator"),
    );
  }
  const input = h("input", { type: "number", min: "0", step: "0.5", value: "0.5", "aria-label": "IMD to add" });
  return [
    sec("02", "Check budget"),
    reveal(
      h(
        "div",
        { class: "summary" },
        h("p", { class: "muted", style: { margin: "0 0 14px" } }, "Each check costs 0.5 IMD, paid to the IMD swarm. Anyone can add budget; whatever is left goes back to the creator once every milestone is settled."),
        h(
          "div",
          { class: "inline-form" },
          h("div", { class: "unit-input" }, input, h("span", {}, "IMD")),
          h(
            "button",
            {
              class: "btn small",
              onclick: async (e) => {
                let amount;
                try {
                  amount = parseUnits(input.value || "0", IMD_DECIMALS);
                } catch {
                  return toast("Enter an amount of IMD.", "alarm");
                }
                if (!amount) return toast("Enter an amount of IMD.", "alarm");
                const { imd } = await getConstants({ maxAge: 300_000 });
                onchain(
                  e.currentTarget,
                  "Add check budget",
                  [
                    { label: "Allow the vault to take the IMD", run: async (ph) => ((await needsAllowance(imd, config.vault, amount)) ? ensureAllowance(imd, config.vault, amount, ph) : null) },
                    { label: `Add ${fmt(amount, IMD_DECIMALS)} IMD to pledge #${p.id}`, run: (ph) => send({ address: config.vault, abi: vaultAbi, functionName: "fund", args: [BigInt(p.id), amount] }, ph) },
                  ],
                  keys,
                );
              },
            },
            "Add budget",
          ),
        ),
      ),
    ),
  ];
}

// ------------------------------------------------------------------ make a pledge

const CHAINS = [[4663, "Robinhood Chain"], [1, "Ethereum"], [8453, "Base"], [42161, "Arbitrum One"], [56, "BNB Chain"]];

let fieldSeq = 0;
/** A labelled control: the label points at the input (or the first control inside a wrapper). */
function field(label, input, hint) {
  const control = input.matches?.("input, select, textarea") ? input : input.querySelector?.("input, select, textarea");
  let id = control?.id;
  if (control && !id) control.id = id = `f${++fieldSeq}`;
  const hintEl = hint ? h("div", { class: "hint", id: `${id}-hint` }, hint) : null;
  if (control && hintEl) control.setAttribute("aria-describedby", hintEl.id);
  return h("div", { class: "field" }, h("label", { for: id }, label), input, hintEl);
}

function viewNew({ quiet }) {
  const st = { token: null, milestones: [] };
  const tokenIn = h("input", { placeholder: "0x… the token you are locking", value: config.token || "", spellcheck: "false" });
  const tokenNote = h("div", { class: "hint" }, "Use a plain ERC-20: no transfer tax, rebasing, balance decay or confiscation. Unsupported tokens can strand tranches and IMD budgets.");
  const beneficiaryIn = h("input", { placeholder: "0x… receives kept tranches (defaults to you)", spellcheck: "false" });
  const nameIn = h("input", { placeholder: "e.g. KEPT roadmap Q4", maxlength: "64" });
  const budgetIn = h("input", { type: "number", min: "0", step: "0.5", value: "1" });
  const list = h("div", { class: "ms-list" });

  // the live pledge card in the aside
  const card = {
    name: h("div", { class: "pc-name" }, "Untitled pledge"),
    token: h("span", {}, "—"),
    total: h("b", { class: "tnum" }, "0"),
    count: h("b", { class: "tnum" }, "0"),
    budget: h("b", { class: "tnum" }, "1 IMD"),
    checks: h("span", { class: "muted" }, ""),
    tl: h("div", { class: "pc-tl" }),
  };

  let tokenSeq = 0;
  async function loadToken() {
    const mine = ++tokenSeq; // only the lookup for what the field says now may set the token
    const v = tokenIn.value.trim();
    st.token = null;
    tokenNote.className = "hint";
    if (!isAddress(v)) {
      tokenNote.textContent = v ? "Not an address yet." : "Use a plain ERC-20: no transfer tax, rebasing, balance decay or confiscation. Unsupported tokens can strand tranches and IMD budgets.";
      return refresh();
    }
    tokenNote.textContent = "Reading the token…";
    try {
      const info = await tokenInfo(getAddress(v));
      if (mine !== tokenSeq) return;
      st.token = info;
      tokenNote.className = "hint good";
      tokenNote.textContent = `${st.token.symbol} · ${st.token.decimals} decimals`;
    } catch {
      if (mine !== tokenSeq) return;
      tokenNote.className = "hint bad";
      tokenNote.textContent = "Not a readable ERC-20 on this chain.";
    }
    refresh();
  }
  tokenIn.addEventListener("change", loadToken);
  tokenIn.addEventListener("input", () => isAddress(tokenIn.value.trim()) && loadToken());

  function addMilestone() {
    if (st.milestones.length >= 8) return toast("A pledge has at most 8 milestones.", "alarm");
    const m = milestoneEditor(st, refresh, (el) => {
      el.classList.add("leaving");
      refresh(); // the summary updates at once; the card animates out on its own
      const done = () => el.isConnected && (el.remove(), refresh());
      if (reduced) return done();
      el.addEventListener("animationend", (e) => e.target === el && done());
      setTimeout(done, 500);
    });
    st.milestones.push(m);
    list.append(m.el);
    refresh();
    if (st.milestones.length > 1) requestAnimationFrame(() => m.focus());
  }

  function refresh() {
    // not isConnected: during a view transition the page is built before it is attached
    st.milestones = st.milestones.filter((m) => !m.el.classList.contains("leaving"));
    st.milestones.forEach((m, i) => m.number(i + 1));
    const dec = st.token?.decimals ?? 18;
    let total = 0n;
    for (const m of st.milestones) {
      try {
        total += parseUnits(m.amount() || "0", dec);
      } catch {}
    }
    card.name.textContent = nameIn.value.trim() || "Untitled pledge";
    card.token.textContent = st.token ? st.token.symbol : "—";
    card.total.textContent = `${fmt(total, dec)} ${st.token?.symbol ?? ""}`.trim();
    card.count.textContent = String(st.milestones.length);
    const b = Number(budgetIn.value || 0);
    card.budget.textContent = `${b} IMD`;
    const checks = Math.floor(b / 0.5);
    card.checks.textContent = checks >= st.milestones.length ? `covers ${checks} check${checks === 1 ? "" : "s"}` : `only ${checks} check${checks === 1 ? "" : "s"} for ${st.milestones.length} milestones`;
    card.checks.className = checks >= st.milestones.length ? "muted" : "warn-text";
    const drafts = st.milestones.map((m, i) => ({ index: i, title: m.title(), deadline: m.deadlineTs(), cls: "open" })).filter((d) => d.deadline > 0n);
    card.tl.replaceChildren(timeline(drafts, { start: now(), grace: 3n * 86400n, compact: true, onPick: (i) => st.milestones[i]?.el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }) }));
    for (const m of st.milestones) m.preview();
  }
  nameIn.addEventListener("input", refresh);
  budgetIn.addEventListener("input", refresh);

  const submit = magnetic(
    h(
      "button",
      {
        class: "btn primary wide",
        onclick: async (e) => {
          const button = e.currentTarget;
          let acct, beneficiary, inputs, total, budget, imd;
          try {
            if (!deployed) throw new Error("KEPT is not deployed yet.");
            if (!st.token) throw new Error("Enter the token you are locking.");
            if (!st.milestones.length) throw new Error("Add at least one milestone.");
            acct = currentAccount() || (await connect());
            beneficiary = beneficiaryIn.value.trim() ? getAddress(beneficiaryIn.value.trim()) : acct;
            inputs = st.milestones.map((m) => m.input(st.token.decimals));
            total = inputs.reduce((x, i) => x + i.amount, 0n);
            budget = parseUnits(budgetIn.value || "0", IMD_DECIMALS);
            ({ imd } = await getConstants({ maxAge: 300_000 }));
            const have = await balanceOf(st.token.address, acct);
            if (have < total) throw new Error(`You hold ${fmt(have, st.token.decimals)} ${st.token.symbol}; the pledge needs ${fmt(total, st.token.decimals)}.`);
          } catch (err) {
            return toast(reason(err), "alarm");
          }
          let created = null;
          const ok = await runSteps(
            "Create the pledge",
            [
              { label: `Allow the vault to lock ${fmt(total, st.token.decimals)} ${st.token.symbol}`, run: async (ph) => ((await needsAllowance(st.token.address, config.vault, total)) ? ensureAllowance(st.token.address, config.vault, total, ph) : null) },
              { label: `Allow ${fmt(budget, IMD_DECIMALS)} IMD for checks`, run: async (ph) => ((await needsAllowance(imd, config.vault, budget)) ? ensureAllowance(imd, config.vault, budget, ph) : null) },
              {
                label: "Lock the tokens and create the pledge",
                run: async (ph) => {
                  const receipt = await send({ address: config.vault, abi: vaultAbi, functionName: "createPledge", args: [st.token.address, beneficiary, nameIn.value.trim(), inputs, budget] }, ph);
                  [created] = parseEventLogs({ abi: vaultAbi, logs: receipt.logs, eventName: "PledgeCreated" });
                  return receipt;
                },
              },
            ],
            { button },
          );
          if (!ok) return;
          invalidate("pledges", "constants");
          toast("Pledge created. Its milestones are now public and onchain.", "ok");
          if (created) location.hash = `#/pledge/${created.args.pledgeId}`;
        },
      },
      "Lock tokens and create pledge",
      icon("arrow", 16),
    ),
  );

  paint(
    "/new",
    () =>
      h(
        "section",
        { class: "wrap" },
        h("div", { class: "label", style: { marginTop: "36px" } }, "New pledge"),
        h("h1", { class: "page-title" }, words("Make a pledge", { stagger: 60 })),
        h("p", { class: "muted lead rise", style: { animationDelay: "240ms" } }, "Lock tokens behind milestones the swarm can check. Each milestone becomes one precise yes/no question, and you see it exactly as the swarm will before you sign anything."),
        deployed ? null : notLive(),
        h(
          "div",
          { class: "compose" },
          h(
            "div",
            { class: "compose-main" },
            sec("01", "Token"),
            h("div", { class: "form" }, field("Token to lock", tokenIn, "Plain ERC-20 only: no rebasing, balance decay, confiscation or transfer restrictions. These can strand tokens and IMD budgets; metadata does not verify compatibility."), tokenNote, h("div", { class: "row2" }, field("Pledge name", nameIn, "Shown on the pledge page. Up to 64 characters."), field("Beneficiary", beneficiaryIn, "Receives each kept tranche and controls the three check attempts."))),
            sec("02", "Milestones", "up to 8"),
            list,
            h("div", { style: { marginTop: "14px" } }, h("button", { class: "btn small add-ms", onclick: addMilestone }, "+ Add milestone")),
            sec("03", "Check budget"),
            h("div", { class: "form" }, field("IMD for checks", h("div", { class: "unit-input" }, budgetIn, h("span", {}, "IMD")), "Budget one check per milestone, two for a retry. Unused budget comes back when the pledge ends, and the Referee Fund refunds the check of every kept milestone when it can.")),
          ),
          h(
            "aside",
            { class: "compose-aside" },
            h(
              "div",
              { class: "pcard rise", style: { animationDelay: "320ms" } },
              h("div", { class: "pc-head" }, h("span", { class: "lamp caution blink" }), h("span", { class: "label" }, "Pledge preview")),
              card.name,
              h("div", { class: "pc-grid" }, h("span", { class: "label" }, "Token"), card.token, h("span", { class: "label" }, "Milestones"), card.count, h("span", { class: "label" }, "Locked"), card.total, h("span", { class: "label" }, "Budget"), h("span", {}, card.budget, " ", card.checks)),
              card.tl,
              submit,
              h("p", { class: "pc-fine" }, "Nothing can withdraw locked tokens. Kept milestones release to the beneficiary; missed ones burn."),
            ),
          ),
        ),
      ),
    { quiet },
  );
  addMilestone();
  if (config.token) loadToken();
}

function milestoneEditor(st, refresh, onRemove) {
  let kind = 0;
  const title = h("input", { placeholder: "What you are promising, in plain words", maxlength: "120" });
  const deadline = h("input", { type: "datetime-local" });
  const amount = h("input", { type: "number", min: "0", step: "any", placeholder: "Released if kept" });
  const a = h("input", { spellcheck: "false" });
  const b = h("input", { spellcheck: "false" });
  const chainSel = h("select", {}, CHAINS.map(([id, n]) => h("option", { value: id }, n)));
  const target = h("input", { placeholder: "0x… contract address", spellcheck: "false" });
  const threshold = h("input", { type: "number", min: "1", step: "1", placeholder: "Raw uint256, e.g. 1000000000000000000" });
  const params = h("div", { class: "params" });
  // polite live region: the question (or what is wrong) is read out once typing pauses
  const preview = h("div", { class: "preview", "aria-live": "polite" }, "Fill in the milestone to see the swarm's question.");
  const previewLamp = h("span", { class: "lamp" });
  const numEl = h("b", {}, "Milestone 01");
  const d = new Date(Date.now() + 14 * 86400e3);
  d.setMinutes(0, 0, 0);
  deadline.value = new Date(d.getTime() - d.getTimezoneOffset() * 60e3).toISOString().slice(0, 16);

  const tiles = TEMPLATE_LABEL.map((l, i) =>
    h(
      "button",
      {
        class: "tile",
        type: "button",
        "aria-pressed": i === 0 ? "true" : "false",
        onclick: () => {
          if (kind === i) return;
          kind = i;
          tiles.forEach((t, j) => t.setAttribute("aria-pressed", j === i ? "true" : "false"));
          layout(true);
          refresh();
        },
      },
      icon(TEMPLATE_ICON[i], 24),
      h("span", {}, l),
    ),
  );

  function layout(animate = false) {
    if (kind === 0) {
      a.placeholder = "owner/repo, e.g. kept-labs/app";
      b.placeholder = "Release tag, e.g. v1.0.0";
      params.replaceChildren(h("div", { class: "row2" }, field("GitHub repository", a), field("Release tag", b)));
    } else if (kind === 1) {
      a.placeholder = "https://…";
      b.placeholder = "Exact text the page must show (no quotes)";
      params.replaceChildren(field("Page URL", a), field("Text that must appear", b, "Up to 80 characters. Pick text that only appears once you deliver."));
    } else if (kind === 2) {
      params.replaceChildren(h("div", { class: "row2" }, field("Chain", chainSel), field("Contract address", target, "True once code exists at this address.")));
    } else {
      a.placeholder = "e.g. totalSupply()";
      params.replaceChildren(h("div", { class: "row2" }, field("Chain", chainSel), field("Contract address", target)), h("div", { class: "row2" }, field("View function (no arguments)", a), field("At least", threshold, "Compared with the raw returned uint256.")));
    }
    if (animate && !reduced) {
      params.classList.remove("swap");
      void params.offsetWidth;
      params.classList.add("swap");
    }
  }

  const deadlineTs = () => BigInt(Math.floor(new Date(deadline.value).getTime() / 1000) || 0);

  function input(decimals = 18) {
    const chainId = kind >= 2 ? BigInt(chainSel.value) : 0n;
    const tgt = kind >= 2 && isAddress(target.value.trim()) ? getAddress(target.value.trim()) : "0x0000000000000000000000000000000000000000";
    return {
      kind,
      deadline: deadlineTs(),
      amount: parseUnits(amount.value || "0", decimals),
      chainId,
      target: tgt,
      threshold: kind === 3 ? BigInt(threshold.value || "0") : 0n,
      title: title.value.trim(),
      a: kind === 2 ? "" : a.value.trim(),
      b: kind >= 2 ? "" : b.value.trim(),
    };
  }

  // previews are vault reads: debounce typing so a burst of keys costs one call
  let seq = 0;
  let timer = 0;
  function showPreview() {
    clearTimeout(timer);
    timer = setTimeout(runPreview, 220);
  }
  async function runPreview() {
    const mine = ++seq;
    let i;
    try {
      i = input(st.token?.decimals ?? 18);
    } catch {
      return;
    }
    const set = (cls, text) => {
      if (preview.textContent === text && preview.className === `preview ${cls}`) return;
      preview.className = `preview ${cls}`;
      preview.textContent = text;
      previewLamp.className = `lamp ${cls === "good" ? "ok" : cls === "bad" ? "alarm" : ""}`;
    };
    if (!deployed) return set("", "The question preview appears once KEPT is deployed: the vault itself writes it.");
    try {
      const body = await previewQuestion(i);
      if (mine !== seq) return;
      const q = JSON.parse(body);
      set("good", `${q.question}\n\nevidence: ${q.evidence} · chain ${q.chainId} · panel ${q.panelSize}, quorum ${q.quorum}`);
    } catch (e) {
      if (mine !== seq) return;
      const touched = [title, a, b, target, threshold, amount].some((x) => x.value.trim());
      if (!touched) return set("", "Fill in the milestone to see the swarm's question.");
      set("bad", explain(e, kind, i));
    }
  }

  const el = h(
    "div",
    { class: "mscard" },
    h("div", { class: "bar" }, numEl, h("button", { class: "btn small ghost", type: "button", onclick: () => onRemove(el) }, icon("cross", 14), "Remove")),
    h("div", { class: "tiles", role: "group", "aria-label": "Milestone template" }, tiles),
    field("Promise", title),
    h("div", { class: "row2" }, field("Deadline", deadline), field("Amount", amount)),
    params,
    h("div", { class: "field" }, h("div", { class: "field-title" }, previewLamp, " What the swarm will be asked"), preview),
  );
  for (const x of [title, deadline, amount, a, b, chainSel, target, threshold]) {
    x.addEventListener("input", refresh);
    x.addEventListener("change", refresh);
  }
  layout();
  return {
    el,
    input,
    title: () => title.value.trim(),
    deadlineTs,
    amount: () => amount.value,
    preview: showPreview,
    focus: () => title.focus({ preventScroll: true }),
    number: (n) => (numEl.textContent = `Milestone ${String(n).padStart(2, "0")}`),
  };
}

const FIELD_NAMES = [
  ["the repository (owner/repo)", "the release tag (letters, digits, . - _ +)"],
  ["the page URL (must start with https://)", "the text (1–80 characters, no quotes or backslashes)"],
  ["", "", "the contract address"],
  ["the view function, e.g. totalSupply()", "", "the contract address", "the threshold (above zero)"],
];

/** Turns the vault's validation errors into the field the user needs to fix. */
function explain(e, kind, input) {
  const data = e?.cause?.data || e?.data;
  const name = data?.errorName;
  if (name === "BadParameter") {
    const f = FIELD_NAMES[kind]?.[Number(data.args?.[0])];
    return f ? `Check ${f}.` : "One of the fields is not valid yet.";
  }
  if (name === "UnsupportedChain") return "That chain is not supported for questions.";
  if (!input.title) return "Add the promise in plain words.";
  return `Not valid yet: ${reason(e)}`;
}

// ------------------------------------------------------------------ referee fund

function viewReferee({ quiet }) {
  const token = navToken;
  const v = {
    fund: h("div", { class: "v kept tnum" }, "—"),
    collected: h("div", { class: "v tnum" }, "—"),
    pending: h("div", { class: "v tnum" }, "—"),
    fee: h("div", { class: "v tnum" }, "1%"),
  };
  const donate = h("input", { type: "number", min: "0", step: "0.5", value: "1", "aria-label": "IMD to donate" });
  const f2 = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  paint(
    "/referee",
    () =>
      h(
        "section",
        { class: "wrap" },
        h("div", { class: "label", style: { marginTop: "36px" } }, "Pool fees → verdict rebates"),
        h("h1", { class: "page-title" }, words("Referee Fund", { stagger: 60 })),
        h("p", { class: "muted lead rise", style: { animationDelay: "200ms" } }, "Every KEPT/IMD trade pays 1% of its IMD side into this fund (20% at launch, falling to 1% over the first 30 minutes). When a team keeps a milestone, the fund refunds that milestone's check. Keeping a promise costs nothing; breaking one means the team paid for its own verdict."),
        deployed ? null : notLive(),
        reveal(
          h(
            "div",
            { class: "figures" },
            h("div", { class: "figure" }, v.fund, h("div", { class: "label l" }, "Referee Fund · IMD")),
            h("div", { class: "figure" }, v.collected, h("div", { class: "label l" }, "Fees collected · IMD")),
            h("div", { class: "figure" }, v.pending, h("div", { class: "label l" }, "Waiting to sweep · IMD")),
            h("div", { class: "figure" }, v.fee, h("div", { class: "label l" }, "Fee right now")),
          ),
        ),
        reveal(flowDiagram(), 80),
        sec("01", "Act"),
        reveal(
          h(
            "div",
            { class: "summary inline" },
            config.hook
              ? magnetic(h("button", { class: "btn primary small", onclick: (e) => onchain(e.currentTarget, "Sweep pool fees", one({ address: config.hook, abi: hookAbi, functionName: "sweep" })) }, icon("fund", 15), "Sweep pool fees into the fund"))
              : null,
            h("div", { class: "unit-input" }, donate, h("span", {}, "IMD")),
            h(
              "button",
              {
                class: "btn small",
                onclick: async (e) => {
                  let amount;
                  try {
                    amount = parseUnits(donate.value || "0", IMD_DECIMALS);
                  } catch {
                    return toast("Enter an amount of IMD.", "alarm");
                  }
                  if (!amount) return toast("Enter an amount of IMD.", "alarm");
                  const { imd } = await getConstants({ maxAge: 300_000 });
                  onchain(e.currentTarget, "Donate to the Referee Fund", [
                    { label: "Allow the vault to take the IMD", run: async (ph) => ((await needsAllowance(imd, config.vault, amount)) ? ensureAllowance(imd, config.vault, amount, ph) : null) },
                    { label: `Donate ${fmt(amount, IMD_DECIMALS)} IMD`, run: (ph) => send({ address: config.vault, abi: vaultAbi, functionName: "fundReferee", args: [amount] }, ph) },
                  ]);
                },
              },
              "Donate",
            ),
          ),
        ),
      ),
    { quiet },
  );
  if (!deployed) return;
  const c0 = cachedConstants();
  if (c0) countUp(v.fund, Number(c0.refereeFund) / 1e18, f2);
  getConstants({ maxAge: quiet ? 0 : 5_000 })
    .then(async (c) => {
      if (token !== navToken) return;
      countUp(v.fund, Number(c.refereeFund) / 1e18, f2);
      if (config.hook) {
        const [col, pen, f] = await Promise.all(["collected", "pending", "feeNow"].map((fn) => client.readContract({ address: config.hook, abi: hookAbi, functionName: fn })));
        countUp(v.collected, Number(col) / 1e18, f2);
        countUp(v.pending, Number(pen) / 1e18, f2);
        v.fee.textContent = `${Number(f) / 100}%`;
      }
    })
    .catch((e) => toast(`Could not read the fund: ${reason(e)}`, "alarm"));
}

/** Where the money goes: trades → hook → fund → rebates, drawn as an instrument schematic. */
function flowDiagram() {
  const node = (ic, t, sub) => h("div", { class: "fd-node" }, icon(ic, 20), h("b", {}, t), h("span", {}, sub));
  const wire = (label) => h("div", { class: "fd-wire" }, h("i"), h("span", {}, label));
  return h(
    "div",
    { class: "flow" },
    node("pulse", "KEPT/IMD trades", "Uniswap v4 pool"),
    wire("1% of the IMD side"),
    node("cube", "KEPT hook", "collects, anyone sweeps"),
    wire("sweep"),
    node("fund", "Referee Fund", "held by the vault"),
    wire("on every kept verdict"),
    node("seal", "0.5 IMD rebate", "back to the team"),
  );
}

// ------------------------------------------------------------------ how it works

function viewHow({ quiet }) {
  const fact = (ic, t, p) => tilt(spotlight(h("div", { class: "fact" }, h("b", {}, icon(ic, 18), t), h("span", {}, p))), 3);
  paint(
    "/how",
    () =>
      h(
        "section",
        { class: "wrap" },
        h("div", { class: "label", style: { marginTop: "36px" } }, "The mechanism"),
        h("h1", { class: "page-title" }, words("How KEPT works", { stagger: 60 })),
        h("p", { class: "muted lead rise", style: { animationDelay: "220ms" } }, "Every launch hands a team most of its token supply, and buyers have to hope the team builds what it promised. KEPT turns the roadmap into a contract: the team's tokens unlock only when the IMD swarm confirms each promise."),
        sec("01", "Three steps"),
        stepsGrid(),
        sec("02", "A milestone's life", "one check, one verdict"),
        reveal(lifecycle()),
        sec("03", "Milestones the swarm can check", "four templates"),
        reveal(
          h(
            "div",
            { class: "facts" },
            fact("release", "GitHub release", "A public repository has a published release with an exact tag, by the deadline."),
            fact("page", "Page contains", "A web page responds and shows exact text in a snapshot signed by the deadline. Later changes do not undo a kept verdict."),
            fact("cube", "Contract deployed", "An address has code at the checked block, with the verdict signed by the deadline."),
            fact("gauge", "Value at least", "A view function reaches a threshold at the checked block, signed by the deadline. This does not prove the value persists."),
          ),
        ),
        sec("04", "Why you can trust it"),
        reveal(
          h(
            "div",
            { class: "facts" },
            fact("lock", "Nobody can take the tokens", "No withdrawal, pause or upgrade. Locked tokens move only on a verdict or a missed deadline."),
            fact("seal", "Verdicts are signed", "The vault checks the oracle's EIP-712 signature, the panel size and the quorum before it accepts an answer."),
            fact("pulse", "Changes wait seven days", "Intake, action and signer changes wait seven days. The owner can change future panels and ownership; existing pledges cannot exit during the notice."),
            fact("fund", "Paid in IMD, to the swarm", "Each check is 0.5 IMD to the agents who answer it. Pool fees refund the checks of teams that keep their word."),
          ),
        ),
        h("div", { class: "ctas end-ctas" }, magnetic(h("a", { class: "btn primary", href: link("/new") }, "Make a pledge", icon("arrow", 16))), magnetic(h("a", { class: "btn", href: config.repo, target: "_blank", rel: "noopener" }, "Read the contracts"))),
      ),
    { quiet },
  );
}

/** The state machine of one milestone, as a row of stations with the two possible endings. */
function lifecycle() {
  const st = (cls, t, sub) => h("div", { class: `lc-st ${cls}` }, h("span", { class: `lamp ${cls}` }), h("b", {}, t), h("span", {}, sub));
  return h(
    "div",
    { class: "lifecycle" },
    st("open", "Locked", "tokens in the vault"),
    h("i", { class: "lc-arrow" }),
    st("checking", "Swarm checking", "team asks · 0.5 IMD"),
    h("i", { class: "lc-arrow" }),
    h("div", { class: "lc-fork" }, st("kept", "Kept", "tranche → team · check refunded"), st("broken", "Broken", "not proven by deadline + 3 days → burned")),
  );
}

/** A raw uint256, shortened when it is a whole number of 18-decimal units; the exact value is the tooltip. */
function rawValue(v) {
  const unit = 10n ** 18n;
  const full = v.toLocaleString("en-US");
  if (v >= unit && v % unit === 0n) return h("span", { title: full }, `${(v / unit).toLocaleString("en-US")} × 10¹⁸`);
  return full;
}

// ------------------------------------------------------------------ router

let lastPath = null;

function route({ quiet = false } = {}) {
  const path = location.hash.replace(/^#/, "") || "/";
  // same page asked again (an account change, a finished transaction): repaint in place
  if (path === lastPath && !quiet) quiet = true;
  lastPath = path;
  navToken += 1;
  onLeave.splice(0).forEach((stop) => stop());
  const m = path.match(/^\/pledge\/(\d+)$/);
  if (m) return viewPledge(Number(m[1]), { quiet });
  if (path === "/new") return viewNew({ quiet });
  if (path === "/referee") return viewReferee({ quiet });
  if (path === "/how") return viewHow({ quiet });
  return viewHome({ quiet });
}

shell();
statusbar();
renderAccount(currentAccount());
window.addEventListener("hashchange", () => route());
onAccount((acct) => {
  renderAccount(acct);
  // only pages whose actions depend on who is connected need a repaint
  if (/^\/pledge\//.test(lastPath || "")) route({ quiet: true });
});
route();
