import "./styles.css";
import { parseUnits, isAddress, getAddress, parseEventLogs } from "viem";
import { config, deployed } from "./config.js";
import {
  client,
  vaultAbi,
  hookAbi,
  tokenInfo,
  vaultConstants,
  loadPledge,
  loadAllPledges,
  previewQuestion,
  pledgeHistory,
  uuidFromBytes32,
  oracleRequest,
  connect,
  currentAccount,
  onAccount,
  send,
  ensureAllowance,
  balanceOf,
  reason,
} from "./chain.js";
import { h, link, short, addrLink, now, fmt, when, span, IMD_DECIMALS } from "./dom.js";
import { initTheme, toggleTheme, reveal, words, countUp, magnetic, spotlight, liveInterval } from "./fx.js";
import { icon, TEMPLATE_ICON } from "./icons.js";
import { verdictUnit, sampleData } from "./hero.js";

initTheme();

// ------------------------------------------------------------------ toasts and actions

let toastTimer;
function toast(msg, err = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `show${err ? " err" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ""), err ? 9000 : 5000);
}

async function act(button, label, fn) {
  const before = [...button.childNodes];
  button.disabled = true;
  button.replaceChildren(h("span", { class: "spin" }), ` ${label}…`);
  try {
    await fn();
    toast(`${label}: done`);
    route();
  } catch (e) {
    toast(`${label} failed: ${reason(e)}`, true);
    button.disabled = false;
    button.replaceChildren(...before);
  }
}

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
  if (t <= m.deadline + grace) return { cls: "open", chip: `Proof window · ${span(m.deadline + grace - t)} left` };
  return { cls: "broken", chip: "Unproven · burn pending" };
}

// ------------------------------------------------------------------ chrome

function header(active) {
  const acct = currentAccount();
  const nav = [
    ["/", "Pledges"],
    ["/new", "Make a pledge"],
    ["/referee", "Referee Fund"],
    ["/how", "How it works"],
  ];
  return h(
    "header",
    { class: "top" },
    h(
      "div",
      { class: "wrap" },
      h("a", { class: "logo", href: link("/"), "aria-label": "KEPT home" }, h("span", { class: "mark" }, icon("seal", 20)), h("span", { class: "word" }, "KEPT")),
      h("nav", { class: "links", "aria-label": "Main" }, nav.map(([p, l]) => h("a", { href: link(p), class: active === p ? "active" : "", "aria-current": active === p ? "page" : null }, l))),
      h("span", { class: "spacer" }),
      h("button", { class: "iconbtn", "aria-label": "Toggle light and dark", onclick: toggleTheme }, icon("moon", 18)),
      h(
        "button",
        {
          class: "btn",
          onclick: async () => {
            try {
              await connect();
            } catch (e) {
              toast(reason(e), true);
            }
          },
        },
        acct ? short(acct) : "Connect",
      ),
    ),
  );
}

function footer() {
  return h(
    "footer",
    { class: "site" },
    h(
      "div",
      { class: "wrap" },
      h("div", {}, "KEPT · promises the IMD swarm enforces"),
      h(
        "div",
        {},
        deployed ? ["Vault ", addrLink(config.vault), "   "] : null,
        config.hook ? ["Hook ", addrLink(config.hook), "   "] : null,
        h("a", { href: config.repo, target: "_blank", rel: "noopener" }, "Source"),
        "   ",
        h("a", { href: "https://imd.fun", target: "_blank", rel: "noopener" }, "IMD"),
      ),
    ),
  );
}

function page(active, ...content) {
  document.getElementById("app").replaceChildren(header(active), h("main", { class: "enter", id: "content" }, ...content), footer());
  window.scrollTo(0, 0);
}

const sec = (n, title, aside) =>
  h("div", { class: "sec" }, h("span", { class: "n" }, n), h("h2", {}, title), aside ? h("span", { class: "aside" }, aside) : null);

const notLive = () =>
  h(
    "div",
    { class: "banner" },
    h("span", { class: "lamp caution" }),
    h("div", {}, h("b", {}, "Launching on Robinhood Chain. "), h("span", { class: "muted" }, "The contracts are being audited and deployed by the IMD swarm. This page goes live with real pledges the moment they land.")),
  );

/** Shown whenever the owner has proposed a new Intake or oracle signer: it is public for 7 days first. */
function pendingBanner(c) {
  const p = c?.pendingChange;
  if (!p) return null;
  return h(
    "div",
    { class: "banner warn" },
    h("span", { class: "lamp alarm" }),
    h(
      "div",
      {},
      h("b", {}, "Protocol change pending. "),
      "The KEPT owner proposed a new oracle Intake ", addrLink(p.intake), " and signer ", addrLink(p.signer),
      `. It cannot take effect before ${when(p.readyAt)}. Every change waits seven days in public.`,
    ),
  );
}

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
    { class: "statusbar", role: "status" },
    h("div", { class: "cell" }, h("span", { class: "lamp ok blink" }), "Robinhood ", bar.block),
    h("div", { class: "cell" }, bar.pledges, " pledges"),
    h("div", { class: "cell" }, bar.kept, " kept · ", bar.broken, " broken"),
    h("div", { class: "cell" }, bar.oracle, " IMD oracle answers"),
    bar.end,
  );
  document.body.append(el);
  const refresh = async () => {
    client.getBlockNumber().then((b) => (bar.block.textContent = `#${b.toLocaleString("en-US")}`)).catch(() => {});
    fetch(`${config.imdApi}/oracle/counts`)
      .then((r) => r.json())
      .then((d) => (bar.oracle.textContent = Number(d.byStatus?.attested ?? d.total).toLocaleString("en-US")))
      .catch(() => {});
  };
  refresh();
  liveInterval(el, refresh, 15000);
}

/** The status bar's KEPT figures, read once at startup on every page, and refreshed with the bar. */
async function loadStats() {
  if (!deployed) return;
  try {
    const pledges = await loadAllPledges();
    let kept = 0;
    let broken = 0;
    for (const p of pledges)
      for (const m of p.milestones) {
        if (m.outcome === 1) kept++;
        if (m.outcome === 2) broken++;
      }
    setStats(pledges.length, kept, broken);
  } catch {
    bar.end.replaceChildren(h("span", { class: "lamp alarm" }), "Vault unreachable");
  }
}

function setStats(pledges, kept, broken) {
  bar.pledges.textContent = pledges;
  bar.kept.textContent = kept;
  bar.broken.textContent = broken;
  bar.end.className = "cell end ok";
  bar.end.replaceChildren(h("span", { class: "lamp ok" }), "Vault live");
}

// ------------------------------------------------------------------ home

async function viewHome() {
  const unit = verdictUnit({ live: deployed });
  const figs = {
    pledges: h("div", { class: "v tnum" }, "—"),
    kept: h("div", { class: "v kept tnum" }, "—"),
    broken: h("div", { class: "v broken tnum" }, "—"),
    fund: h("div", { class: "v tnum" }, "—"),
  };
  const listEl = h("div", { class: "rows" }, h("div", { class: "empty" }, h("span", { class: "spin" }), " Reading pledges from Robinhood Chain…"));
  const banners = h("div", {});

  page(
    "/",
    h(
      "section",
      { class: "wrap" },
      h(
        "div",
        { class: "hero" },
        h(
          "div",
          {},
          h("span", { class: "eyebrow rise", style: { animationDelay: "80ms" } }, h("span", { class: "lamp ok" }), "IMD oracle · Robinhood Chain"),
          h("h1", {}, words("Promises the swarm enforces.", { delay: 160, accent: ["swarm"] })),
          h(
            "p",
            { class: "lede rise", style: { animationDelay: "520ms" } },
            "A team locks its tokens behind public milestones. At each deadline the IMD swarm checks the milestone and signs a verdict onchain. Kept: the tokens unlock to the team. Broken: they burn.",
          ),
          h(
            "div",
            { class: "ctas rise", style: { animationDelay: "680ms" } },
            magnetic(h("a", { class: "btn primary", href: link("/new") }, "Make a pledge", icon("arrow", 16))),
            h("a", { class: "btn", href: link("/how") }, "How it works"),
          ),
        ),
        h("div", { class: "rise", style: { animationDelay: "380ms" } }, unit),
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
  );

  if (!deployed) {
    banners.replaceChildren(notLive());
    unit.update(sampleData());
    listEl.replaceChildren(h("div", { class: "empty" }, "No pledges yet. The first one will be KEPT's own roadmap, locked the day the vault deploys."));
    return;
  }
  try {
    const [c, pledges] = await Promise.all([vaultConstants(), loadAllPledges()]);
    let kept = 0;
    let broken = 0;
    for (const p of pledges)
      for (const m of p.milestones) {
        if (m.outcome === 1) kept++;
        if (m.outcome === 2) broken++;
      }
    const warn = pendingBanner(c);
    if (warn) banners.replaceChildren(warn);
    countUp(figs.pledges, pledges.length);
    countUp(figs.kept, kept);
    countUp(figs.broken, broken);
    countUp(figs.fund, Number(c.refereeFund) / 1e18, (n) => n.toLocaleString("en-US", { maximumFractionDigits: 2 }));
    setStats(pledges.length, kept, broken);
    unit.update(liveData(pledges, c.grace, kept, broken));
    listEl.replaceChildren(
      ...(pledges.length
        ? pledges.map((p, i) => reveal(pledgeRow(p, c.grace), Math.min(i, 6) * 60))
        : [h("div", { class: "empty" }, "No pledges yet. Be the first to put your roadmap on the line.")]),
    );
  } catch (e) {
    unit.update(sampleData());
    listEl.replaceChildren(h("div", { class: "empty" }, `Could not read the vault: ${reason(e)}`));
  }
}

/** The verdict unit's feed from real milestones: newest pledges first, one line per milestone. */
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
  const kept = p.milestones.filter((m) => m.outcome === 1).length;
  const broken = p.milestones.filter((m) => m.outcome === 2).length;
  const next = p.milestones.filter((m) => m.outcome === 0).sort((a, b) => Number(a.deadline - b.deadline))[0];
  const lead = broken ? "broken" : next ? state(next, grace).cls : "kept";
  return spotlight(
    h(
      "a",
      { class: "row", href: link(`/pledge/${p.id}`) },
      h("span", { class: "glyph" }, icon("lock", 20)),
      h(
        "div",
        { style: { minWidth: 0 } },
        h("div", { class: "title" }, p.name),
        h(
          "div",
          { class: "meta" },
          h("span", { class: `chip ${lead}` }, h("span", { class: `lamp ${lead}` }), `${kept}/${p.count} kept`),
          h("span", {}, `${fmt(p.locked, p.tokenInfo.decimals)} ${p.tokenInfo.symbol} locked`),
          next ? h("span", {}, `next: ${next.title} · ${state(next, grace).chip}`) : h("span", {}, "all settled"),
        ),
        h("div", { class: "track" }, p.milestones.map((m) => h("i", { class: state(m, grace).cls, title: m.title }))),
      ),
      h("div", { class: "right" }, `#${p.id}`, h("br"), "by ", short(p.creator)),
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

const step = (n, ic, t, p) => spotlight(h("div", { class: "step" }, h("div", { class: "n" }, n), icon(ic, 26), h("h3", {}, t), h("p", {}, p)));

// ------------------------------------------------------------------ pledge page

async function viewPledge(id) {
  page("/", h("div", { class: "wrap" }, h("div", { class: "empty" }, h("span", { class: "spin" }), ` Reading pledge #${id}…`)));
  if (!deployed) return page("/", h("div", { class: "wrap" }, notLive()));
  let p, c;
  try {
    [p, c] = await Promise.all([loadPledge(id), vaultConstants()]);
  } catch {
    return page("/", h("div", { class: "wrap" }, h("a", { class: "back", href: link("/") }, "← All pledges"), h("div", { class: "empty" }, `Pledge #${id} not found.`)));
  }
  const dec = p.tokenInfo.decimals;
  const total = p.milestones.reduce((x, m) => x + m.amount, 0n);
  const keptAmt = p.milestones.filter((m) => m.outcome === 1).reduce((x, m) => x + m.amount, 0n);
  const brokenAmt = p.milestones.filter((m) => m.outcome === 2).reduce((x, m) => x + m.amount, 0n);
  const acct = currentAccount();
  const isTeam = acct && [p.creator, p.beneficiary].some((a) => a.toLowerCase() === acct.toLowerCase());
  const historyEls = new Map(p.milestones.map((m) => [m.index, h("div", { class: "verdicts" })]));

  page(
    "/",
    h(
      "section",
      { class: "wrap" },
      h("a", { class: "back", href: link("/") }, "← All pledges"),
      h("div", { class: "label", style: { marginTop: "22px" } }, `Pledge #${p.id} · locks ${p.tokenInfo.symbol}`),
      h("h1", { class: "page-title" }, p.name),
      h("div", { class: "muted" }, "Token ", addrLink(p.token), " · created ", when(p.createdAt), " by ", addrLink(p.creator), " · beneficiary ", addrLink(p.beneficiary)),
      pendingBanner(c),
      h(
        "div",
        { class: "kv" },
        kv("Still locked", `${fmt(p.locked, dec)} ${p.tokenInfo.symbol}`),
        kv("Released to team", `${fmt(keptAmt, dec)} ${p.tokenInfo.symbol}`),
        kv("Burned", `${fmt(brokenAmt, dec)} ${p.tokenInfo.symbol}`),
        kv("Check budget", `${fmt(p.budget, IMD_DECIMALS)} IMD`),
      ),
      h("div", { class: "track", style: { maxWidth: "none" } }, p.milestones.map((m) => h("i", { class: state(m, c.grace).cls, title: m.title }))),
      h("div", { class: "muted", style: { marginTop: "10px", fontSize: "12.5px" } }, `Panel of ${p.panelSize}, ${p.quorum} must agree · ${c.maxAttempts} checks per milestone · ${span(c.grace)} proof window after each deadline`),
      sec("01", "Milestones", `${p.count - p.open}/${p.count} settled`),
      h("div", { class: "rows" }, p.milestones.map((m) => milestoneRow(p, m, c, total, isTeam, historyEls.get(m.index)))),
      budgetBox(p),
    ),
  );

  try {
    const hist = await pledgeHistory(p.id);
    for (const [index, el] of historyEls) renderHistory(el, index, hist);
  } catch (e) {
    for (const el of historyEls.values()) el.replaceChildren(h("div", { class: "verdict" }, `History unavailable: ${reason(e)}`));
  }
}

function kv(k, v) {
  return h("div", {}, h("div", { class: "k" }, k), h("div", { class: "v tnum", title: v }, v));
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
      return [h("code", {}, x.a), " on ", h("code", {}, short(x.target)), ` (chain ${x.chainId}) ≥ ${x.threshold.toLocaleString("en-US")}`];
  }
}

function milestoneRow(p, m, c, total, isTeam, historyEl) {
  const st = state(m, c.grace);
  const dec = p.tokenInfo.decimals;
  const pct = total ? Number((m.amount * 10000n) / total) / 100 : 0;
  const id = BigInt(p.id);
  const actions = [];
  if (m.outcome === 0 && st.cls !== "checking" && m.gate.open) {
    if (isTeam && m.gate.funded) {
      actions.push(magnetic(h("button", { class: "btn primary small", onclick: (e) => act(e.currentTarget, "Ask the swarm", () => send({ address: config.vault, abi: vaultAbi, functionName: "check", args: [id, m.index] })) }, "Ask the swarm · 0.5 IMD")));
    } else if (isTeam) {
      actions.push(h("span", { class: "note" }, "Top up the check budget below to ask the swarm."));
    } else {
      actions.push(h("span", { class: "note" }, `Only the team can ask the swarm to confirm this. Not proven by ${when(m.deadline + c.grace)}: it burns.`));
    }
  }
  if (!m.settled && (m.outcome === 1 || (m.outcome === 0 && now() > m.deadline + c.grace))) {
    const burning = m.outcome !== 1;
    actions.push(h("button", { class: `btn small ${burning ? "danger" : "primary"}`, onclick: (e) => act(e.currentTarget, burning ? "Burn" : "Release", () => send({ address: config.vault, abi: vaultAbi, functionName: "settle", args: [id, m.index] })) }, burning ? "Settle · burn tranche" : "Settle · release to team"));
  }
  if (m.inFlight !== ZERO32 && now() >= m.askedAt + TIMEOUT && m.outcome === 0) {
    actions.push(h("button", { class: "btn small", onclick: (e) => act(e.currentTarget, "Clear stale check", () => send({ address: config.vault, abi: vaultAbi, functionName: "clearStale", args: [id, m.index] })) }, "Clear unanswered check"));
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
      { class: `ms ${st.cls}` },
      h("div", { class: "num" }, String(m.index + 1).padStart(2, "0")),
      h(
        "div",
        { style: { minWidth: 0 } },
        h("div", {}, h("span", { class: `chip ${st.cls}` }, h("span", { class: `lamp ${st.cls}` }), st.chip), " ", h("span", { class: "chip kind" }, icon(TEMPLATE_ICON[m.kind], 13), TEMPLATE_LABEL[m.kind])),
        h("h3", {}, m.title),
        h("div", { class: "when" }, "due ", when(m.deadline), " · ", specLine(m)),
        h("details", { class: "q" }, h("summary", {}, "What the swarm is asked"), h("pre", {}, bodyText)),
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
  el.replaceChildren(...rows.map((r) => r.node));
}

function budgetBox(p) {
  if (p.open === 0) {
    if (p.budget === 0n) return null;
    return h(
      "div",
      { class: "summary", style: { marginTop: "28px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" } },
      h("span", {}, h("b", {}, `${fmt(p.budget, IMD_DECIMALS)} IMD`), " of unused check budget is waiting for the creator."),
      h("button", { class: "btn small", onclick: (e) => act(e.currentTarget, "Return budget", () => send({ address: config.vault, abi: vaultAbi, functionName: "withdrawBudget", args: [BigInt(p.id)] })) }, "Return it to the creator"),
    );
  }
  const input = h("input", { type: "number", min: "0", step: "0.5", value: "0.5", style: { maxWidth: "140px" }, "aria-label": "IMD to add" });
  return [
    sec("02", "Check budget"),
    h(
      "div",
      { class: "summary" },
      h("p", { class: "muted", style: { margin: "0 0 12px" } }, "Each check costs 0.5 IMD, paid to the IMD swarm. Anyone can add budget; whatever is left goes back to the creator once every milestone is settled."),
      h(
        "div",
        { class: "field", style: { flexDirection: "row", alignItems: "center", gap: "10px" } },
        input,
        h("span", { class: "muted" }, "IMD"),
        h(
          "button",
          {
            class: "btn small",
            onclick: (e) =>
              act(e.currentTarget, "Fund budget", async () => {
                const amount = parseUnits(input.value || "0", IMD_DECIMALS);
                const { imd } = await vaultConstants();
                if (!currentAccount()) await connect();
                await ensureAllowance(imd, config.vault, amount);
                await send({ address: config.vault, abi: vaultAbi, functionName: "fund", args: [BigInt(p.id), amount] });
              }),
          },
          "Add budget",
        ),
      ),
    ),
  ];
}

// ------------------------------------------------------------------ make a pledge

const CHAINS = [[4663, "Robinhood Chain"], [1, "Ethereum"], [8453, "Base"], [42161, "Arbitrum One"], [56, "BNB Chain"]];

function field(label, input, hint) {
  return h("div", { class: "field" }, h("label", {}, label), input, hint ? h("div", { class: "hint" }, hint) : null);
}

function viewNew() {
  const st = { token: null, milestones: [] };
  const tokenIn = h("input", { placeholder: "0x… the token you are locking", value: config.token || "" });
  const tokenNote = h("div", { class: "hint" }, "The ERC-20 the team is putting on the line. Taxed tokens are refused.");
  const beneficiaryIn = h("input", { placeholder: "0x… receives kept tranches (defaults to you)" });
  const nameIn = h("input", { placeholder: "e.g. KEPT roadmap Q4", maxlength: "64" });
  const budgetIn = h("input", { type: "number", min: "0", step: "0.5", value: "1" });
  const list = h("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } });
  const summary = h("div", { class: "summary" });

  async function loadToken() {
    const v = tokenIn.value.trim();
    st.token = null;
    if (!isAddress(v)) {
      tokenNote.textContent = "The ERC-20 the team is putting on the line. Taxed tokens are refused.";
      return refresh();
    }
    try {
      st.token = await tokenInfo(getAddress(v));
      tokenNote.textContent = `${st.token.symbol} · ${st.token.decimals} decimals`;
    } catch {
      tokenNote.textContent = "Not a readable ERC-20 on this chain.";
    }
    refresh();
  }
  tokenIn.addEventListener("change", loadToken);

  function addMilestone() {
    if (st.milestones.length >= 8) return toast("A pledge has at most 8 milestones.", true);
    const m = milestoneEditor(st, refresh);
    st.milestones.push(m);
    list.append(m.el);
    refresh();
  }

  function refresh() {
    st.milestones = st.milestones.filter((m) => m.el.isConnected);
    st.milestones.forEach((m, i) => m.number(i + 1));
    const dec = st.token?.decimals ?? 18;
    let total = 0n;
    for (const m of st.milestones) {
      try {
        total += parseUnits(m.amount() || "0", dec);
      } catch {}
    }
    summary.replaceChildren(
      h("b", {}, `${st.milestones.length} milestone${st.milestones.length === 1 ? "" : "s"} · ${fmt(total, dec)} ${st.token?.symbol ?? "tokens"} locked`),
      h("div", { class: "muted", style: { marginTop: "6px" } }, "Each check costs 0.5 IMD from the budget. Budget one check per milestone, two for a retry. Unused budget comes back when the pledge ends, and a kept milestone's check is refunded by the Referee Fund when it can."),
    );
    for (const m of st.milestones) m.preview();
  }

  const submit = magnetic(
    h(
      "button",
      {
        class: "btn primary",
        onclick: (e) =>
          act(e.currentTarget, "Create pledge", async () => {
            if (!deployed) throw new Error("KEPT is not deployed yet");
            if (!st.token) throw new Error("Enter the token you are locking");
            if (!st.milestones.length) throw new Error("Add at least one milestone");
            const acct = currentAccount() || (await connect());
            const beneficiary = beneficiaryIn.value.trim() ? getAddress(beneficiaryIn.value.trim()) : acct;
            const inputs = st.milestones.map((m) => m.input(st.token.decimals));
            const total = inputs.reduce((x, i) => x + i.amount, 0n);
            const budget = parseUnits(budgetIn.value || "0", IMD_DECIMALS);
            const { imd } = await vaultConstants();
            const have = await balanceOf(st.token.address, acct);
            if (have < total) throw new Error(`You hold ${fmt(have, st.token.decimals)} ${st.token.symbol}, the pledge needs ${fmt(total, st.token.decimals)}`);
            await ensureAllowance(st.token.address, config.vault, total);
            await ensureAllowance(imd, config.vault, budget);
            const receipt = await send({ address: config.vault, abi: vaultAbi, functionName: "createPledge", args: [st.token.address, beneficiary, nameIn.value.trim(), inputs, budget] });
            const [created] = parseEventLogs({ abi: vaultAbi, logs: receipt.logs, eventName: "PledgeCreated" });
            if (created) setTimeout(() => (location.hash = `#/pledge/${created.args.pledgeId}`), 300);
          }),
      },
      "Lock tokens and create pledge",
      icon("arrow", 16),
    ),
  );

  page(
    "/new",
    h(
      "section",
      { class: "wrap", style: { maxWidth: "860px" } },
      h("h1", { class: "page-title", style: { marginTop: "42px" } }, "Make a pledge"),
      h("p", { class: "muted", style: { maxWidth: "640px" } }, "Lock tokens behind milestones the swarm can check. Each milestone becomes one precise yes/no question, and you see it exactly as the swarm will before you sign anything."),
      deployed ? null : notLive(),
      sec("01", "Token"),
      h("div", { class: "form" }, field("Token to lock", tokenIn), tokenNote, h("div", { class: "row2" }, field("Pledge name", nameIn, "Shown on the pledge page. Up to 64 characters."), field("Beneficiary", beneficiaryIn, "Receives each kept tranche."))),
      sec("02", "Milestones", "up to 8"),
      list,
      h("div", { style: { marginTop: "14px" } }, h("button", { class: "btn small", onclick: addMilestone }, "+ Add milestone")),
      sec("03", "Check budget"),
      h("div", { class: "form" }, field("IMD for checks", budgetIn), summary, h("div", {}, submit)),
    ),
  );
  addMilestone();
  if (config.token) loadToken();
}

function milestoneEditor(st, refresh) {
  let kind = 0;
  const title = h("input", { placeholder: "What you are promising, in plain words", maxlength: "120" });
  const deadline = h("input", { type: "datetime-local" });
  const amount = h("input", { type: "number", min: "0", step: "any", placeholder: "Released if kept" });
  const a = h("input", {});
  const b = h("input", {});
  const chainSel = h("select", {}, CHAINS.map(([id, n]) => h("option", { value: id }, n)));
  const target = h("input", { placeholder: "0x… contract address" });
  const threshold = h("input", { type: "number", min: "1", step: "1", placeholder: "Raw uint256, e.g. 1000000000000000000" });
  const params = h("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } });
  const preview = h("div", { class: "preview" }, "Fill in the milestone to see the swarm's question.");
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
          kind = i;
          tiles.forEach((t, j) => t.setAttribute("aria-pressed", j === i ? "true" : "false"));
          layout();
          refresh();
        },
      },
      icon(TEMPLATE_ICON[i], 26),
      l,
    ),
  );

  function layout() {
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
  }

  function input(decimals = 18) {
    const chainId = kind >= 2 ? BigInt(chainSel.value) : 0n;
    const tgt = kind >= 2 && isAddress(target.value.trim()) ? getAddress(target.value.trim()) : "0x0000000000000000000000000000000000000000";
    return {
      kind,
      deadline: BigInt(Math.floor(new Date(deadline.value).getTime() / 1000) || 0),
      amount: parseUnits(amount.value || "0", decimals),
      chainId,
      target: tgt,
      threshold: kind === 3 ? BigInt(threshold.value || "0") : 0n,
      title: title.value.trim(),
      a: kind === 2 ? "" : a.value.trim(),
      b: kind >= 2 ? "" : b.value.trim(),
    };
  }

  let seq = 0;
  async function showPreview() {
    const mine = ++seq;
    let i;
    try {
      i = input(st.token?.decimals ?? 18);
    } catch {
      return;
    }
    if (!deployed) {
      preview.className = "preview";
      preview.textContent = "The question preview appears once KEPT is deployed: the vault itself writes it.";
      return;
    }
    try {
      const body = await previewQuestion(i);
      if (mine !== seq) return;
      const q = JSON.parse(body);
      preview.className = "preview good";
      preview.textContent = `${q.question}\n\nevidence: ${q.evidence} · chain ${q.chainId} · panel ${q.panelSize}, quorum ${q.quorum}`;
    } catch (e) {
      if (mine !== seq) return;
      const touched = [title, a, b, target, threshold, amount].some((x) => x.value.trim());
      if (!touched) {
        preview.className = "preview";
        preview.textContent = "Fill in the milestone to see the swarm's question.";
        return;
      }
      preview.className = "preview bad";
      preview.textContent = explain(e, kind, i);
    }
  }

  const remove = h("button", { class: "btn small", type: "button", onclick: () => (el.remove(), refresh()) }, "Remove");
  const el = h(
    "div",
    { class: "mscard" },
    h("div", { class: "bar" }, numEl, remove),
    h("div", { class: "tiles", role: "group", "aria-label": "Milestone template" }, tiles),
    field("Promise", title),
    h("div", { class: "row2" }, field("Deadline", deadline), field("Amount", amount)),
    params,
    h("div", { class: "field" }, h("label", {}, "What the swarm will be asked"), preview),
  );
  for (const x of [title, deadline, amount, a, b, chainSel, target, threshold]) {
    x.addEventListener("input", refresh);
    x.addEventListener("change", refresh);
  }
  layout();
  return {
    el,
    input,
    amount: () => amount.value,
    preview: showPreview,
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

async function viewReferee() {
  const v = {
    fund: h("div", { class: "v kept tnum" }, "—"),
    collected: h("div", { class: "v tnum" }, "—"),
    pending: h("div", { class: "v tnum" }, "—"),
    fee: h("div", { class: "v tnum" }, "1%"),
  };
  const donate = h("input", { type: "number", min: "0", step: "0.5", value: "1", style: { maxWidth: "140px" }, "aria-label": "IMD to donate" });
  page(
    "/referee",
    h(
      "section",
      { class: "wrap" },
      h("h1", { class: "page-title", style: { marginTop: "42px" } }, "Referee Fund"),
      h("p", { class: "muted", style: { maxWidth: "720px" } }, "Every KEPT/IMD trade pays 1% of its IMD side into this fund (20% at launch, falling to 1% over the first 30 minutes). When a team keeps a milestone, the fund refunds that milestone's check. Keeping a promise costs nothing; breaking one means the team paid for its own verdict."),
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
      sec("01", "Act"),
      h(
        "div",
        { class: "summary", style: { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" } },
        config.hook ? magnetic(h("button", { class: "btn primary small", onclick: (e) => act(e.currentTarget, "Sweep pool fees", () => send({ address: config.hook, abi: hookAbi, functionName: "sweep" })) }, "Sweep pool fees into the fund")) : null,
        h("span", { class: "muted" }, "Donate"),
        donate,
        h("span", { class: "muted" }, "IMD"),
        h(
          "button",
          {
            class: "btn small",
            onclick: (e) =>
              act(e.currentTarget, "Donate", async () => {
                const amount = parseUnits(donate.value || "0", IMD_DECIMALS);
                const { imd } = await vaultConstants();
                if (!currentAccount()) await connect();
                await ensureAllowance(imd, config.vault, amount);
                await send({ address: config.vault, abi: vaultAbi, functionName: "fundReferee", args: [amount] });
              }),
          },
          "Donate",
        ),
      ),
    ),
  );
  if (!deployed) return;
  try {
    const c = await vaultConstants();
    const imdNum = (x) => Number(x) / 1e18;
    const f2 = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
    countUp(v.fund, imdNum(c.refereeFund), f2);
    if (config.hook) {
      const [col, pen, f] = await Promise.all(["collected", "pending", "feeNow"].map((fn) => client.readContract({ address: config.hook, abi: hookAbi, functionName: fn })));
      countUp(v.collected, imdNum(col), f2);
      countUp(v.pending, imdNum(pen), f2);
      v.fee.textContent = `${Number(f) / 100}%`;
    }
  } catch (e) {
    toast(`Could not read the fund: ${reason(e)}`, true);
  }
}

// ------------------------------------------------------------------ how it works

function viewHow() {
  const fact = (ic, t, p) => spotlight(h("div", { class: "fact" }, h("b", {}, icon(ic, 18), t), h("span", {}, p)));
  page(
    "/how",
    h(
      "section",
      { class: "wrap" },
      h("h1", { class: "page-title", style: { marginTop: "42px" } }, "How KEPT works"),
      h("p", { class: "muted", style: { maxWidth: "720px" } }, "Every launch hands a team most of its token supply, and buyers have to hope the team builds what it promised. KEPT turns the roadmap into a contract: the team's tokens unlock only when the IMD swarm confirms each promise."),
      sec("01", "Three steps"),
      stepsGrid(),
      sec("02", "Milestones the swarm can check", "four templates"),
      reveal(
        h(
          "div",
          { class: "facts" },
          fact("release", "GitHub release", "A public repository has a published release with an exact tag, by the deadline."),
          fact("page", "Page contains", "A web page responds and shows an exact piece of text."),
          fact("cube", "Contract deployed", "An address has code on Ethereum, Robinhood Chain, Base, Arbitrum or BNB Chain."),
          fact("gauge", "Value at least", "A contract's view function returns at least a number: supply burned, liquidity, holders."),
        ),
      ),
      sec("03", "Why you can trust it"),
      reveal(
        h(
          "div",
          { class: "facts" },
          fact("lock", "Nobody can take the tokens", "No withdrawal, pause or upgrade. Locked tokens move only on a verdict or a missed deadline."),
          fact("seal", "Verdicts are signed", "The vault checks the oracle's EIP-712 signature, the panel size and the quorum before it accepts an answer."),
          fact("pulse", "Changes wait seven days", "The only admin setting is the oracle address, and every change sits in public for seven days first."),
          fact("fund", "Paid in IMD, to the swarm", "Each check is 0.5 IMD to the agents who answer it. Pool fees refund the checks of teams that keep their word."),
        ),
      ),
      h("div", { class: "ctas", style: { display: "flex", gap: "10px", flexWrap: "wrap", margin: "36px 0 0" } }, magnetic(h("a", { class: "btn primary", href: link("/new") }, "Make a pledge", icon("arrow", 16))), h("a", { class: "btn", href: config.repo, target: "_blank", rel: "noopener" }, "Read the contracts")),
    ),
  );
}

// ------------------------------------------------------------------ router

function route() {
  const path = location.hash.replace(/^#/, "") || "/";
  const m = path.match(/^\/pledge\/(\d+)$/);
  if (m) return viewPledge(Number(m[1]));
  if (path === "/new") return viewNew();
  if (path === "/referee") return viewReferee();
  if (path === "/how") return viewHow();
  return viewHome();
}

statusbar();
loadStats();
window.addEventListener("hashchange", route);
onAccount(() => route());
route();
