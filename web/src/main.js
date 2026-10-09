import "./styles.css";
import { formatUnits, parseUnits, isAddress, getAddress, parseEventLogs } from "viem";
import { config, deployed, carry } from "./config.js";
import {
  client,
  vaultAbi,
  hookAbi,
  erc20Abi,
  Kind,
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

// ------------------------------------------------------------------ tiny DOM helpers
// Every on-chain string goes through text nodes; nothing user-supplied is ever parsed as HTML.

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") throw new Error("no raw html");
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const $app = () => document.getElementById("app");
const link = (path) => `${carry}#${path}`;
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const addrLink = (a) => h("a", { class: "addr", href: `${config.explorer}/address/${a}`, target: "_blank", rel: "noopener" }, short(a));
const now = () => BigInt(Math.floor(Date.now() / 1000));
const IMD_DECIMALS = 18;

function fmt(amount, decimals, max = 2) {
  const s = formatUnits(amount, decimals);
  const [i, f = ""] = s.split(".");
  const int = BigInt(i).toLocaleString("en-US");
  const frac = f.slice(0, max).replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
}

function when(ts) {
  return new Date(Number(ts) * 1000).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function span(seconds) {
  let s = Number(seconds < 0n ? -seconds : seconds);
  const d = Math.floor(s / 86400); s -= d * 86400;
  const hrs = Math.floor(s / 3600); s -= hrs * 3600;
  const m = Math.floor(s / 60);
  if (d) return `${d}d ${hrs}h`;
  if (hrs) return `${hrs}h ${m}m`;
  return `${Math.max(m, 1)}m`;
}

let toastTimer;
function toast(msg, err = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `show${err ? " err" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ""), err ? 9000 : 5000);
}

async function act(button, label, fn) {
  const before = button.textContent;
  button.disabled = true;
  button.replaceChildren(h("span", { class: "spin" }), ` ${label}…`);
  try {
    await fn();
    toast(`${label}: done`);
    route();
  } catch (e) {
    toast(`${label} failed: ${reason(e)}`, true);
    button.disabled = false;
    button.textContent = before;
  }
}

// ------------------------------------------------------------------ milestone state

const TEMPLATE_LABEL = ["GitHub release", "Page contains", "Contract deployed", "Value at least"];
const TIMEOUT = 86400n;

function state(m, grace) {
  const t = now();
  if (m.outcome === 1) return m.settled ? { cls: "kept", chip: "Kept · released" } : { cls: "kept", chip: "Kept · ready to release" };
  if (m.outcome === 2) return { cls: "broken", chip: "Broken · burned" };
  if (m.inFlight !== `0x${"0".repeat(64)}` && t < m.askedAt + TIMEOUT) return { cls: "checking", chip: "Swarm checking" };
  if (t < m.deadline) return { cls: "open", chip: `Due in ${span(m.deadline - t)}` };
  if (t <= m.deadline + grace) return { cls: "open", chip: `Proof window · ${span(m.deadline + grace - t)} left` };
  return { cls: "broken", chip: "Unproven · burn pending" };
}

function trackClass(m, grace) {
  const s = state(m, grace).cls;
  return m.outcome === 0 && s === "broken" ? "broken" : s;
}

// ------------------------------------------------------------------ header / footer

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
      h("a", { class: "brand", href: link("/") }, h("span", { class: "seal" }, "✓"), "KEPT"),
      h("nav", { class: "links" }, nav.map(([p, l]) => h("a", { href: link(p), class: active === p ? "active" : "" }, l))),
      h(
        "button",
        {
          class: "btn small",
          onclick: async () => {
            try { await connect(); } catch (e) { toast(reason(e), true); }
          },
        },
        acct ? short(acct) : "Connect wallet",
      ),
    ),
  );
}

function footer() {
  return h(
    "footer",
    {},
    h(
      "div",
      { class: "wrap" },
      h("div", {}, "KEPT · promises the IMD swarm enforces · Robinhood Chain"),
      h(
        "div",
        {},
        deployed ? ["Vault ", addrLink(config.vault), "  "] : null,
        config.hook ? ["Hook ", addrLink(config.hook), "  "] : null,
        h("a", { href: config.repo, target: "_blank", rel: "noopener" }, "Source"),
        "  ·  ",
        h("a", { href: "https://imd.fun", target: "_blank", rel: "noopener" }, "IMD"),
      ),
    ),
  );
}

function page(active, ...content) {
  $app().replaceChildren(header(active), h("main", {}, ...content), footer());
  window.scrollTo(0, 0);
}

const notLive = () =>
  h(
    "div",
    { class: "banner" },
    h("b", {}, "KEPT is launching on Robinhood Chain. "),
    "The contracts are being built and audited by the IMD swarm. This page goes live with real pledges the moment they deploy.",
  );

/** Shown whenever the owner has proposed a new Intake or oracle signer: it is public for 7 days first. */
function pendingBanner(c) {
  const p = c?.pendingChange;
  if (!p) return null;
  return h(
    "div",
    { class: "banner warn" },
    h("b", {}, "Protocol change pending. "),
    "The KEPT owner proposed a new oracle Intake ", addrLink(p.intake), " and signer ", addrLink(p.signer),
    `. It cannot take effect before ${when(p.readyAt)}. Every change waits seven days in public.`,
  );
}

// ------------------------------------------------------------------ home

async function viewHome() {
  const hero = h(
    "section",
    { class: "hero wrap" },
    h("h1", {}, "Promises the ", h("em", {}, "swarm"), " enforces."),
    h(
      "p",
      { class: "lede" },
      "A team locks its tokens behind public milestones. At each deadline the IMD swarm checks the milestone and signs a verdict onchain. Kept: the tokens unlock to the team. Broken: they burn.",
    ),
    h(
      "div",
      { class: "ctas" },
      h("a", { class: "btn primary", href: link("/new") }, "Make a pledge"),
      h("a", { class: "btn", href: link("/how") }, "How it works"),
    ),
  );
  const statsEl = h("div", { class: "stats" });
  const listEl = h("div", {}, h("div", { class: "empty" }, h("span", { class: "spin" }), " Loading pledges…"));
  page(
    "/",
    hero,
    h("div", { class: "wrap" }, deployed ? null : notLive(), statsEl),
    h(
      "section",
      { class: "block wrap" },
      h("h2", {}, "Live pledges"),
      h("p", { class: "sub" }, "Every pledge on KEPT, newest first. Green is kept, red is broken, amber is still to prove."),
      listEl,
    ),
  );

  if (!deployed) {
    statsEl.replaceChildren(...stats(["—", "Pledges"], ["—", "Kept"], ["—", "Broken"], ["—", "Referee Fund"]));
    listEl.replaceChildren(h("div", { class: "empty" }, "No pledges yet. The first one will be KEPT's own roadmap."));
    return;
  }
  try {
    const [c, pledges] = await Promise.all([vaultConstants(), loadAllPledges()]);
    let kept = 0, broken = 0;
    for (const p of pledges) for (const m of p.milestones) {
      if (m.outcome === 1) kept++;
      if (m.outcome === 2) broken++;
    }
    const warn = pendingBanner(c);
    if (warn) statsEl.before(warn);
    statsEl.replaceChildren(
      ...stats(
        [String(pledges.length), "Pledges"],
        [String(kept), "Milestones kept", "kept"],
        [String(broken), "Milestones broken", "broken"],
        [`${fmt(c.refereeFund, IMD_DECIMALS)} IMD`, "Referee Fund"],
      ),
    );
    listEl.replaceChildren(
      pledges.length
        ? h("div", { class: "grid" }, pledges.map((p) => pledgeCard(p, c.grace)))
        : h("div", { class: "empty" }, "No pledges yet. Be the first to put your roadmap on the line."),
    );
  } catch (e) {
    listEl.replaceChildren(h("div", { class: "empty" }, `Could not read the vault: ${reason(e)}`));
  }
}

function stats(...items) {
  return items.map(([v, l, cls]) => h("div", { class: `stat ${cls || ""}` }, h("div", { class: "v" }, v), h("div", { class: "l" }, l)));
}

function pledgeCard(p, grace) {
  const kept = p.milestones.filter((m) => m.outcome === 1).length;
  const next = p.milestones.filter((m) => m.outcome === 0).sort((a, b) => Number(a.deadline - b.deadline))[0];
  return h(
    "a",
    { class: "card", href: link(`/pledge/${p.id}`) },
    h("h3", {}, p.name),
    h("div", { class: "meta" }, `${p.tokenInfo.symbol} · ${kept}/${p.count} kept · `, `${fmt(p.locked, p.tokenInfo.decimals)} still locked`),
    h("div", { class: "track" }, p.milestones.map((m) => h("i", { class: trackClass(m, grace), title: m.title }))),
    h("div", { class: "meta" }, next ? `Next: ${next.title} · ${state(next, grace).chip}` : "All milestones settled"),
  );
}

// ------------------------------------------------------------------ pledge page

async function viewPledge(id) {
  page("/", h("div", { class: "wrap pledge-head" }, h("div", { class: "empty" }, h("span", { class: "spin" }), " Loading pledge…")));
  if (!deployed) return page("/", h("div", { class: "wrap" }, notLive()));
  let p, c;
  try {
    [p, c] = await Promise.all([loadPledge(id), vaultConstants()]);
  } catch (e) {
    return page("/", h("div", { class: "wrap pledge-head" }, h("div", { class: "empty" }, `Pledge #${id} not found.`)));
  }
  const dec = p.tokenInfo.decimals;
  const total = p.milestones.reduce((s, m) => s + m.amount, 0n);
  const keptAmt = p.milestones.filter((m) => m.outcome === 1).reduce((s, m) => s + m.amount, 0n);
  const brokenAmt = p.milestones.filter((m) => m.outcome === 2).reduce((s, m) => s + m.amount, 0n);
  const acct = currentAccount();
  const isTeam = acct && [p.creator, p.beneficiary].some((a) => a.toLowerCase() === acct.toLowerCase());

  const historyEls = new Map(p.milestones.map((m) => [m.index, h("div", { class: "verdicts" })]));

  page(
    "/",
    h(
      "div",
      { class: "wrap pledge-head" },
      h("a", { href: link("/"), class: "muted" }, "← All pledges"),
      h("h1", {}, p.name),
      pendingBanner(c),
      h(
        "div",
        { class: "muted" },
        `Pledge #${p.id} · locks `, h("b", {}, p.tokenInfo.symbol), " ", addrLink(p.token),
        " · created ", when(p.createdAt), " by ", addrLink(p.creator),
      ),
      h(
        "div",
        { class: "kv" },
        kv("Still locked", `${fmt(p.locked, dec)} ${p.tokenInfo.symbol}`),
        kv("Released to team", `${fmt(keptAmt, dec)} ${p.tokenInfo.symbol}`),
        kv("Burned", `${fmt(brokenAmt, dec)} ${p.tokenInfo.symbol}`),
        kv("Check budget", `${fmt(p.budget, IMD_DECIMALS)} IMD`),
      ),
      h("div", { class: "track" }, p.milestones.map((m) => h("i", { class: trackClass(m, c.grace), title: m.title }))),
      h(
        "div",
        { class: "muted" },
        `Beneficiary `, addrLink(p.beneficiary),
        ` · panel of ${p.panelSize}, ${p.quorum} must agree · ${c.maxAttempts} checks per milestone · `,
        `${span(c.grace)} proof window after each deadline`,
      ),
    ),
    h(
      "section",
      { class: "wrap" },
      h("div", { class: "timeline" }, p.milestones.map((m) => milestoneCard(p, m, c, total, isTeam, historyEls.get(m.index)))),
      budgetBox(p),
    ),
  );

  try {
    const hist = await pledgeHistory(p.id);
    for (const [index, el] of historyEls) renderHistory(el, index, hist);
  } catch (e) {
    for (const el of historyEls.values()) el.replaceChildren(h("div", { class: "muted" }, `History unavailable: ${reason(e)}`));
  }
}

function kv(k, v) {
  return h("div", {}, h("div", { class: "k" }, k), h("div", { class: "v", title: v }, v));
}

function specLine(m) {
  const s = m.spec;
  switch (m.kind) {
    case 0: return ["Release ", h("code", {}, s.b), " on ", h("a", { href: `https://github.com/${s.a}`, target: "_blank", rel: "noopener" }, `github.com/${s.a}`)];
    case 1: return ["Page ", h("a", { href: s.a, target: "_blank", rel: "noopener nofollow" }, s.a), " shows ", h("code", {}, s.b)];
    case 2: return ["Contract ", h("code", {}, short(s.target)), ` deployed on chain ${s.chainId}`];
    default: return [h("code", {}, s.a), " on ", h("code", {}, short(s.target)), ` (chain ${s.chainId}) ≥ ${s.threshold.toLocaleString("en-US")}`];
  }
}

function milestoneCard(p, m, c, total, isTeam, historyEl) {
  const st = state(m, c.grace);
  const dec = p.tokenInfo.decimals;
  const pct = total ? Number((m.amount * 10000n) / total) / 100 : 0;
  const actions = [];
  const id = BigInt(p.id);
  if (m.outcome === 0 && st.cls !== "checking" && m.gate.open) {
    if (isTeam && m.gate.funded) {
      actions.push(h("button", { class: "btn primary small", onclick: (e) => act(e.currentTarget, "Ask the swarm", () => send({ address: config.vault, abi: vaultAbi, functionName: "check", args: [id, m.index] })) }, "Ask the swarm now · 0.5 IMD from budget"));
    } else if (isTeam) {
      actions.push(h("span", { class: "muted" }, "Top up the check budget below to ask the swarm."));
    } else {
      actions.push(h("span", { class: "muted" }, `Only the team can ask the swarm to confirm this. If it is not proven by ${when(m.deadline + c.grace)}, it burns.`));
    }
  }
  if (!m.settled && (m.outcome === 1 || (m.outcome === 0 && now() > m.deadline + c.grace))) {
    const burning = m.outcome !== 1;
    actions.push(h("button", { class: `btn small ${burning ? "danger" : "primary"}`, onclick: (e) => act(e.currentTarget, burning ? "Burn" : "Release", () => send({ address: config.vault, abi: vaultAbi, functionName: "settle", args: [id, m.index] })) }, burning ? "Settle · burn tranche" : "Settle · release to team"));
  }
  if (m.inFlight !== `0x${"0".repeat(64)}` && now() >= m.askedAt + TIMEOUT && m.outcome === 0) {
    actions.push(h("button", { class: "btn small", onclick: (e) => act(e.currentTarget, "Clear stale check", () => send({ address: config.vault, abi: vaultAbi, functionName: "clearStale", args: [id, m.index] })) }, "Clear unanswered check"));
  }

  let bodyText = m.question;
  try {
    const b = JSON.parse(m.question);
    bodyText = `${b.question}\n\nevidence: ${b.evidence} · chain ${b.chainId} · panel ${b.panelSize}, quorum ${b.quorum}`;
  } catch {}

  return h(
    "div",
    { class: `ms ${st.cls}` },
    h(
      "div",
      { class: "row" },
      h(
        "div",
        {},
        h("div", {}, h("span", { class: `chip ${st.cls}` }, st.chip), " ", h("span", { class: "chip kind" }, TEMPLATE_LABEL[m.kind])),
        h("h3", { style: "margin-top:10px" }, `${m.index + 1}. ${m.title}`),
        h("div", { class: "when" }, "Deadline ", when(m.deadline), " · ", specLine(m)),
      ),
      h("div", { class: "amount" }, `${fmt(m.amount, dec)} ${p.tokenInfo.symbol}`, h("small", {}, `${pct}% of pledge · ${m.attempts}/${c.maxAttempts} checks used`)),
    ),
    h("details", { class: "q" }, h("summary", {}, "What the swarm is asked"), h("pre", {}, bodyText)),
    historyEl,
    actions.length ? h("div", { class: "actions" }, actions) : null,
  );
}

function renderHistory(el, index, hist) {
  const rows = [];
  for (const log of hist.checks.filter((l) => Number(l.args.index) === index)) {
    rows.push({ block: log.blockNumber, at: log.logIndex, node: h("div", { class: "verdict" }, h("span", { class: "chip checking" }, `Check ${log.args.attempt}`), "Asked the swarm · ", h("a", { href: `${config.explorer}/tx/${log.transactionHash}`, target: "_blank", rel: "noopener" }, "transaction")) });
  }
  for (const log of hist.verdicts.filter((l) => Number(l.args.index) === index)) {
    const uuid = uuidFromBytes32(log.args.oracleRequestId);
    const jobLink = h("span", {});
    const row = h(
      "div",
      { class: "verdict" },
      h("span", { class: `chip ${log.args.kept ? "kept" : "broken"}` }, log.args.kept ? "Swarm: delivered" : "Swarm: not delivered"),
      `${log.args.agreed} of ${log.args.panelSize} agents agreed (quorum ${log.args.quorum}) · `,
      h("a", { href: `${config.imdApi}/oracle/requests/${uuid}/attestation`, target: "_blank", rel: "noopener" }, "signed verdict"),
      jobLink,
    );
    oracleRequest(uuid)
      .then((r) => r.jobId && jobLink.replaceChildren(" · ", h("a", { href: `${config.imdExplorer}/jobs/${r.jobId}`, target: "_blank", rel: "noopener" }, "panel on IMD explorer")))
      .catch(() => {});
    rows.push({ block: log.blockNumber, at: log.logIndex, node: row });
  }
  for (const log of hist.rebates.filter((l) => Number(l.args.index) === index)) {
    rows.push({ block: log.blockNumber, at: log.logIndex, node: h("div", { class: "verdict" }, h("span", { class: "chip kept" }, "Rebate"), `Referee Fund refunded ${fmt(log.args.amount, IMD_DECIMALS)} IMD`) });
  }
  for (const log of hist.settles.filter((l) => Number(l.args.index) === index)) {
    const kept = Number(log.args.outcome) === 1;
    rows.push({ block: log.blockNumber, at: log.logIndex, node: h("div", { class: "verdict" }, h("span", { class: `chip ${kept ? "kept" : "broken"}` }, kept ? "Released" : "Burned"), kept ? "Tranche sent to the beneficiary · " : "Tranche sent to 0x…dEaD · ", h("a", { href: `${config.explorer}/tx/${log.transactionHash}`, target: "_blank", rel: "noopener" }, "transaction")) });
  }
  rows.sort((a, b) => Number(a.block - b.block) || a.at - b.at);
  el.replaceChildren(...rows.map((r) => r.node));
}

function budgetBox(p) {
  if (p.open === 0) {
    if (p.budget === 0n) return null;
    return h(
      "div",
      { class: "summary", style: "margin-bottom:40px;display:flex;gap:12px;align-items:center;flex-wrap:wrap" },
      h("span", {}, h("b", {}, `${fmt(p.budget, IMD_DECIMALS)} IMD`), " of unused check budget is waiting for the creator."),
      h("button", { class: "btn small", onclick: (e) => act(e.currentTarget, "Return budget", () => send({ address: config.vault, abi: vaultAbi, functionName: "withdrawBudget", args: [BigInt(p.id)] })) }, "Return it to the creator"),
    );
  }
  const input = h("input", { type: "number", min: "0", step: "0.5", value: "0.5", style: "max-width:140px" });
  return h(
    "div",
    { class: "summary", style: "margin-bottom:40px" },
    h("b", {}, "Top up the check budget"),
    h("p", { class: "muted", style: "margin:4px 0 12px" }, "Each check costs 0.5 IMD, paid to the IMD swarm. Anyone can add budget; whatever is left can be returned to the creator once every milestone is settled."),
    h(
      "div",
      { style: "display:flex;gap:8px;align-items:center" },
      input,
      h("span", { class: "muted" }, "IMD"),
      h("button", {
        class: "btn small",
        onclick: (e) =>
          act(e.currentTarget, "Fund budget", async () => {
            const amount = parseUnits(input.value || "0", IMD_DECIMALS);
            const { imd } = await vaultConstants();
            if (!currentAccount()) await connect();
            await ensureAllowance(imd, config.vault, amount);
            await send({ address: config.vault, abi: vaultAbi, functionName: "fund", args: [BigInt(p.id), amount] });
          }),
      }, "Add budget"),
    ),
  );
}

// ------------------------------------------------------------------ make a pledge

const CHAINS = [[4663, "Robinhood Chain"], [1, "Ethereum"], [8453, "Base"], [42161, "Arbitrum One"], [56, "BNB Chain"]];

function field(label, input, hint) {
  return h("div", { class: "field" }, h("label", {}, label), input, hint ? h("div", { class: "hint" }, hint) : null);
}

function viewNew() {
  const state = { token: null, milestones: [] };
  const tokenIn = h("input", { placeholder: "0x… token you are locking", value: config.token || "" });
  const tokenNote = h("div", { class: "hint" }, "The ERC-20 the team is putting on the line. Taxed tokens are refused.");
  const beneficiaryIn = h("input", { placeholder: "0x… who receives kept tranches (defaults to you)" });
  const nameIn = h("input", { placeholder: "e.g. KEPT roadmap Q4", maxlength: "64" });
  const budgetIn = h("input", { type: "number", min: "0", step: "0.5", value: "1" });
  const list = h("div", { style: "display:flex;flex-direction:column;gap:12px" });
  const summary = h("div", { class: "summary" });

  async function loadToken() {
    const v = tokenIn.value.trim();
    state.token = null;
    if (!isAddress(v)) { tokenNote.textContent = "The ERC-20 the team is putting on the line. Taxed tokens are refused."; return refresh(); }
    try {
      state.token = await tokenInfo(getAddress(v));
      tokenNote.textContent = `${state.token.symbol} · ${state.token.decimals} decimals`;
    } catch { tokenNote.textContent = "Not a readable ERC-20 on this chain."; }
    refresh();
  }
  tokenIn.addEventListener("change", loadToken);

  function addMilestone() {
    if (state.milestones.length >= 8) return toast("A pledge has at most 8 milestones.", true);
    const m = milestoneEditor(state, refresh);
    state.milestones.push(m);
    list.append(m.el);
    refresh();
  }

  function refresh() {
    state.milestones = state.milestones.filter((m) => m.el.isConnected);
    const dec = state.token?.decimals ?? 18;
    let total = 0n;
    for (const m of state.milestones) { try { total += parseUnits(m.amount() || "0", dec); } catch {} }
    budgetIn.min = "0";
    summary.replaceChildren(
      h("b", {}, `${state.milestones.length} milestone${state.milestones.length === 1 ? "" : "s"} · `, `${fmt(total, dec)} ${state.token?.symbol ?? "tokens"} locked`),
      h("div", { class: "muted" }, "Each check costs 0.5 IMD from the budget. Budget for at least one check per milestone; a second gives room for a retry. Unused budget goes back to you when the pledge ends, and a kept milestone's check is refunded by the Referee Fund when it can."),
    );
    for (const m of state.milestones) m.preview();
  }

  const submit = h("button", {
    class: "btn primary",
    onclick: (e) =>
      act(e.currentTarget, "Create pledge", async () => {
        if (!deployed) throw new Error("KEPT is not deployed yet");
        if (!state.token) throw new Error("Enter the token you are locking");
        if (!state.milestones.length) throw new Error("Add at least one milestone");
        const acct = currentAccount() || (await connect());
        const beneficiary = beneficiaryIn.value.trim() ? getAddress(beneficiaryIn.value.trim()) : acct;
        const inputs = state.milestones.map((m) => m.input(state.token.decimals));
        const total = inputs.reduce((s, i) => s + i.amount, 0n);
        const budget = parseUnits(budgetIn.value || "0", IMD_DECIMALS);
        const { imd } = await vaultConstants();
        const have = await balanceOf(state.token.address, acct);
        if (have < total) throw new Error(`You hold ${fmt(have, state.token.decimals)} ${state.token.symbol}, the pledge needs ${fmt(total, state.token.decimals)}`);
        await ensureAllowance(state.token.address, config.vault, total);
        await ensureAllowance(imd, config.vault, budget);
        const receipt = await send({ address: config.vault, abi: vaultAbi, functionName: "createPledge", args: [state.token.address, beneficiary, nameIn.value.trim(), inputs, budget] });
        const [created] = parseEventLogs({ abi: vaultAbi, logs: receipt.logs, eventName: "PledgeCreated" });
        if (created) setTimeout(() => (location.hash = `#/pledge/${created.args.pledgeId}`), 300);
      }),
  }, "Lock tokens and create pledge");

  page(
    "/new",
    h(
      "section",
      { class: "wrap", style: "max-width:820px" },
      h("div", { class: "pledge-head" }, h("h1", {}, "Make a pledge"), h("p", { class: "muted" }, "Lock tokens behind milestones the swarm can check. Each milestone becomes one precise yes/no question; you see it exactly as the swarm will before you sign anything.")),
      deployed ? null : notLive(),
      h(
        "div",
        { class: "form" },
        field("Token to lock", tokenIn, null), tokenNote,
        h("div", { class: "row2" }, field("Pledge name", nameIn, "Shown on the pledge page. Up to 64 characters."), field("Beneficiary", beneficiaryIn, "Receives each kept tranche. Defaults to your wallet.")),
        h("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-top:8px" }, h("h2", { style: "margin:0;font-size:20px" }, "Milestones"), h("button", { class: "btn small", onclick: addMilestone }, "+ Add milestone")),
        list,
        field("Check budget (IMD)", budgetIn, null),
        summary,
        h("div", {}, submit),
      ),
    ),
  );
  addMilestone();
  if (config.token) loadToken();
}

function milestoneEditor(state, refresh) {
  const kind = h("select", {}, TEMPLATE_LABEL.map((l, i) => h("option", { value: i }, l)));
  const title = h("input", { placeholder: "What you are promising, in plain words", maxlength: "120" });
  const deadline = h("input", { type: "datetime-local" });
  const amount = h("input", { type: "number", min: "0", step: "any", placeholder: "Tokens released if kept" });
  const a = h("input", {});
  const b = h("input", {});
  const chainSel = h("select", {}, CHAINS.map(([id, n]) => h("option", { value: id }, n)));
  const target = h("input", { placeholder: "0x… contract address" });
  const threshold = h("input", { type: "number", min: "0", step: "1", placeholder: "Raw uint256, e.g. 1000000000000000000" });
  const params = h("div", { style: "display:flex;flex-direction:column;gap:12px" });
  const preview = h("div", { class: "preview" }, "Fill in the milestone to see the swarm's question.");
  const d = new Date(Date.now() + 14 * 86400e3);
  d.setMinutes(0, 0, 0);
  deadline.value = new Date(d.getTime() - d.getTimezoneOffset() * 60e3).toISOString().slice(0, 16);

  function layout() {
    const k = Number(kind.value);
    if (k === 0) {
      a.placeholder = "owner/repo, e.g. kept-labs/app"; b.placeholder = "Release tag, e.g. v1.0.0";
      params.replaceChildren(h("div", { class: "row2" }, field("GitHub repository", a), field("Release tag", b)));
    } else if (k === 1) {
      a.placeholder = "https://…"; b.placeholder = "Exact text the page must show (no quotes)";
      params.replaceChildren(field("Page URL", a), field("Text that must appear", b, "Up to 80 characters. Pick text that only appears once you deliver."));
    } else if (k === 2) {
      params.replaceChildren(h("div", { class: "row2" }, field("Chain", chainSel), field("Contract address", target, "True once code exists at this address.")));
    } else {
      a.placeholder = "e.g. totalSupply()";
      params.replaceChildren(h("div", { class: "row2" }, field("Chain", chainSel), field("Contract address", target)), h("div", { class: "row2" }, field("View function (no arguments)", a), field("At least", threshold, "Compared to the raw returned uint256.")));
    }
  }

  function input(decimals = 18) {
    const k = Number(kind.value);
    const chainId = k >= 2 ? BigInt(chainSel.value) : 0n;
    const tgt = k >= 2 && isAddress(target.value.trim()) ? getAddress(target.value.trim()) : "0x0000000000000000000000000000000000000000";
    return {
      kind: k,
      deadline: BigInt(Math.floor(new Date(deadline.value).getTime() / 1000) || 0),
      amount: parseUnits(amount.value || "0", decimals),
      chainId,
      target: tgt,
      threshold: k === 3 ? BigInt(threshold.value || "0") : 0n,
      title: title.value.trim(),
      a: k === 2 ? "" : a.value.trim(),
      b: k >= 2 ? "" : b.value.trim(),
    };
  }

  let seq = 0;
  async function showPreview() {
    const mine = ++seq;
    let i;
    try { i = input(state.token?.decimals ?? 18); } catch { return; }
    if (!deployed) {
      preview.className = "preview";
      preview.textContent = "Question preview appears once KEPT is deployed; the vault itself writes it.";
      return;
    }
    try {
      const body = await previewQuestion(i);
      if (mine !== seq) return;
      const q = JSON.parse(body);
      preview.className = "preview";
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
      preview.textContent = explain(e, Number(kind.value), i);
    }
  }

  const remove = h("button", { class: "btn small", onclick: () => { el.remove(); refresh(); } }, "Remove");
  const el = h(
    "div",
    { class: "mscard" },
    h("div", { class: "bar" }, h("b", {}, "Milestone"), remove),
    field("Promise", title),
    h("div", { class: "row3" }, field("Template", kind), field("Deadline", deadline), field("Amount", amount)),
    params,
    h("div", { class: "field" }, h("label", {}, "What the swarm will be asked"), preview),
  );
  for (const x of [kind, title, deadline, amount, a, b, chainSel, target, threshold]) {
    x.addEventListener("input", () => { if (x === kind) layout(); refresh(); });
    x.addEventListener("change", () => { if (x === kind) layout(); refresh(); });
  }
  layout();
  return { el, input, amount: () => amount.value, preview: showPreview };
}

const FIELD_NAMES = [
  ["the repository (owner/repo)", "the release tag (letters, digits, . - _ +)"],
  ["the page URL (must start with https://)", "the text (1–80 characters, no quotes or backslashes)"],
  ["", "", "the contract address"],
  ["the view function, e.g. totalSupply()", "", "the contract address"],
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
  const body = h("div", { class: "stats" });
  const donate = h("input", { type: "number", min: "0", step: "0.5", value: "1", style: "max-width:140px" });
  page(
    "/referee",
    h(
      "section",
      { class: "wrap" },
      h("div", { class: "pledge-head" }, h("h1", {}, "Referee Fund"), h("p", { class: "muted", style: "max-width:700px" }, "Every KEPT/IMD trade pays 1% of its IMD side into this fund (20% at launch, falling to 1% over the first 30 minutes). When a team keeps a milestone, the fund refunds that milestone's check. Keeping a promise is free; breaking one means the team paid for its own verdict.")),
      deployed ? null : notLive(),
      body,
      h(
        "div",
        { class: "summary", style: "margin:18px 0 60px;display:flex;gap:10px;flex-wrap:wrap;align-items:center" },
        config.hook ? h("button", { class: "btn primary small", onclick: (e) => act(e.currentTarget, "Sweep hook fees", () => send({ address: config.hook, abi: hookAbi, functionName: "sweep" })) }, "Sweep pool fees into the fund") : null,
        h("span", { class: "muted", style: "margin-left:8px" }, "Donate"),
        donate,
        h("span", { class: "muted" }, "IMD"),
        h("button", {
          class: "btn small",
          onclick: (e) =>
            act(e.currentTarget, "Donate", async () => {
              const amount = parseUnits(donate.value || "0", IMD_DECIMALS);
              const { imd } = await vaultConstants();
              if (!currentAccount()) await connect();
              await ensureAllowance(imd, config.vault, amount);
              await send({ address: config.vault, abi: vaultAbi, functionName: "fundReferee", args: [amount] });
            }),
        }, "Donate"),
      ),
    ),
  );
  if (!deployed) return body.replaceChildren(...stats(["—", "Referee Fund"], ["—", "Fees collected"], ["—", "Waiting to sweep"], ["1%", "Steady fee"]));
  try {
    const c = await vaultConstants();
    let collected = "—", pending = "—", fee = "—";
    if (config.hook) {
      const [col, pen, f] = await Promise.all(["collected", "pending", "feeNow"].map((fn) => client.readContract({ address: config.hook, abi: hookAbi, functionName: fn })));
      collected = `${fmt(col, IMD_DECIMALS)} IMD`;
      pending = `${fmt(pen, IMD_DECIMALS)} IMD`;
      fee = `${Number(f) / 100}%`;
    }
    body.replaceChildren(...stats([`${fmt(c.refereeFund, IMD_DECIMALS)} IMD`, "Referee Fund", "kept"], [collected, "Fees collected"], [pending, "Waiting to sweep"], [fee, "Fee right now"]));
  } catch (e) {
    body.replaceChildren(h("div", { class: "empty" }, `Could not read the fund: ${reason(e)}`));
  }
}

// ------------------------------------------------------------------ how it works

function viewHow() {
  page(
    "/how",
    h(
      "section",
      { class: "wrap" },
      h("div", { class: "pledge-head" }, h("h1", {}, "How KEPT works"), h("p", { class: "muted", style: "max-width:700px" }, "Every launch hands a team most of its token supply, and buyers have to hope the team builds what it promised. KEPT turns the roadmap into a contract: the team's tokens unlock only when the IMD swarm confirms each promise.")),
      h(
        "div",
        { class: "steps" },
        step("01", "Lock", "The team locks tokens in the KEPT vault, split across up to eight milestones, each with a deadline and a check the swarm can answer."),
        step("02", "The swarm checks", "The team asks the IMD oracle to confirm each milestone. A panel of agents answers and the network signs the verdict for the KEPT contract, which verifies it onchain."),
        step("03", "Kept or burned", "Delivered: that tranche goes to the team. Not proven within three days of the deadline: it is burned. Unproven means broken."),
      ),
      h("section", { class: "block" },
        h("h2", {}, "Milestones the swarm can actually check"),
        h("p", { class: "sub" }, "Vague promises are what make oracle panels disagree, so KEPT only accepts four precise templates."),
        h("div", { class: "facts" },
          fact("GitHub release", "A public repository has a published release with an exact tag, by the deadline."),
          fact("Page contains", "A web page responds and shows an exact piece of text."),
          fact("Contract deployed", "An address has code on Ethereum, Robinhood Chain, Base, Arbitrum or BNB Chain."),
          fact("Value at least", "A contract's view function returns at least a number: supply burned, liquidity, holders."),
        ),
      ),
      h("section", { class: "block" },
        h("h2", {}, "Why you can trust it"),
        h("div", { class: "facts" },
          fact("Nobody can take the tokens", "There is no withdrawal, pause or upgrade. Locked tokens move only on a verdict or a missed deadline."),
          fact("Verdicts are signed", "The contract checks the oracle's EIP-712 signature, the panel size and the quorum before it accepts an answer."),
          fact("Changes wait seven days", "The only admin setting is the oracle address, and every change sits in public for seven days first."),
          fact("Paid in IMD, to the swarm", "Each check is 0.5 IMD to the agents who answer it. Pool fees refund the checks of teams that keep their word."),
        ),
      ),
      h("div", { style: "margin:10px 0 60px" }, h("a", { class: "btn primary", href: link("/new") }, "Make a pledge"), " ", h("a", { class: "btn", href: config.repo, target: "_blank", rel: "noopener" }, "Read the contracts")),
    ),
  );
}

const step = (n, t, p) => h("div", { class: "step" }, h("div", { class: "n" }, n), h("h3", {}, t), h("p", {}, p));
const fact = (t, p) => h("div", { class: "fact" }, h("b", {}, t), h("span", {}, p));

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

window.addEventListener("hashchange", route);
onAccount(() => route());
route();
