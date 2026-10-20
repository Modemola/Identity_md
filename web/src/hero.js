import { h } from "./dom.js";
import { sevenSeg, liveInterval, reduced, finePointer } from "./fx.js";

// The Swarm Scope: KEPT's piece of IMD's instrument wall. A bezel around a dark screen where the
// IMD swarm floats as a sphere of agents around the promise; seven-segment KEPT/BROKEN readouts and
// one lamp per milestone sit on the glass as a HUD; a terminal underneath prints what the swarm
// decided, and every line it prints plays out in 3D (a panel links up, a green wave, red embers).
//
// The 3D layer (swarm.js) is its own chunk, fetched after first paint when the browser is idle,
// so the headline and the readouts never wait for it.

const LINES_SHOWN = 4;
const TONE_EVENT = { ok: "kept", alarm: "broken", caution: "panel", "": "panel" };

export function verdictUnit({ live }) {
  const kept = sevenSeg(3, "ok");
  const broken = sevenSeg(3, "alarm");
  const lamps = h("div", { class: "vu-lamps", role: "list", "aria-label": "Milestones" });
  const log = h("div", { class: "vu-log", "aria-live": "off" });
  const mode = h("span", { class: "vu-mode" }, live ? "LIVE" : "SAMPLE FEED");
  const agents = h("span", { class: "tnum" }, "…");
  const stage = h(
    "div",
    { class: "vu-stage" },
    h("div", { class: "vu-glow", "aria-hidden": "true" }),
    h(
      "div",
      { class: "vu-hud" },
      h("div", { class: "vu-read at-l" }, h("span", { class: "vu-k" }, "KEPT"), kept),
      h("div", { class: "vu-read at-r" }, h("span", { class: "vu-k" }, "BROKEN"), broken),
      h("div", { class: "vu-corner a", "aria-hidden": "true" }),
      h("div", { class: "vu-corner b", "aria-hidden": "true" }),
      h("div", { class: "vu-corner c", "aria-hidden": "true" }),
      h("div", { class: "vu-corner d", "aria-hidden": "true" }),
      h("div", { class: "vu-bl" }, lamps),
      h("div", { class: "vu-br" }, "AGENTS ", agents, h("br"), "PANEL 9 · QUORUM 7"),
    ),
  );

  const unit = h(
    "div",
    { class: "vu", role: "img", "aria-label": "KEPT swarm scope: the IMD swarm, and milestones kept and broken" },
    h("div", { class: "vu-head" }, h("span", { class: "lamp ok blink" }), h("span", {}, "KEPT/01 · SWARM SCOPE"), mode),
    stage,
    log,
    h(
      "div",
      { class: "vu-foot" },
      h("span", {}, "IMD ORACLE"),
      h("span", { class: "vu-dots", "aria-hidden": "true" }, h("i"), h("i"), h("i")),
      h("span", {}, "ROBINHOOD 4663"),
    ),
  );

  // ---------------------------------------------------------------- 3D, after first paint
  let swarm = null;
  let mounting = false;
  const queued = [];
  // Retried from update() until it succeeds: if the visitor leaves home before the chunk lands,
  // the next visit mounts it instead of leaving an empty screen for the rest of the session.
  const mount = () => {
    if (swarm || mounting || !unit.isConnected) return;
    mounting = true;
    import("./swarm.js")
      .then(({ mountSwarm }) => {
        mounting = false;
        if (swarm || !unit.isConnected) return;
        swarm = mountSwarm(stage, { reduced, fine: finePointer });
        const showCount = (c) => (agents.textContent = c.count ? c.count.toLocaleString("en-US") : "…");
        showCount(swarm);
        swarm.onReady = showCount;
        queued.splice(0).forEach((k) => swarm.pulse(k));
      })
      .catch(() => (mounting = false));
  };
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 120));
  // wait for the entrance animation to settle, then for an idle moment
  setTimeout(() => idle(mount, { timeout: 1200 }), 450);

  const pulse = (kind) => (swarm ? swarm.pulse(kind) : queued.length < 2 && queued.push(kind));

  // ---------------------------------------------------------------- feed
  let feed = [];
  let cursor = 0;
  let stop = null;

  function push(line, animate = true) {
    const row = h(
      "div",
      { class: `vu-line ${line.tone || ""}` },
      h("span", { class: "vu-t" }, line.t),
      h("span", { class: "vu-who" }, line.who),
      h("span", { class: "vu-what" }, line.what),
    );
    log.append(row);
    while (log.children.length > LINES_SHOWN) log.firstElementChild.remove();
    if (animate) pulse(TONE_EVENT[line.tone || ""] ?? "panel");
  }

  /** `data`: { kept, broken, lamps: ['kept'|'broken'|'open'|'checking'], feed: [{t, who, what, tone}] } */
  unit.update = (data) => {
    if (!swarm && !mounting) setTimeout(() => idle(mount, { timeout: 1200 }), 450);
    kept.set(data.kept);
    broken.set(data.broken);
    lamps.replaceChildren(
      ...data.lamps.slice(0, 12).map((cls, i) =>
        h("span", { class: `lamp ${cls}`, role: "listitem", "aria-label": `Milestone ${i + 1}: ${cls}`, style: { animationDelay: `${i * 70}ms` } }),
      ),
    );
    feed = data.feed;
    cursor = 0;
    log.replaceChildren();
    const first = Math.min(feed.length, reduced ? LINES_SHOWN : 3);
    for (; cursor < first; cursor++) push(feed[cursor], false);
    stop?.();
    if (!reduced && feed.length > first) {
      stop = liveInterval(unit, () => {
        push(feed[cursor % feed.length]);
        cursor += 1;
      }, 2600);
    }
  };

  return unit;
}

/** A believable demo feed for before KEPT is deployed. Always labelled SAMPLE FEED on screen. */
export function sampleData() {
  const t = (m) => {
    const d = new Date(Date.now() - m * 60000);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  return {
    kept: 7,
    broken: 2,
    lamps: ["kept", "kept", "checking", "open", "kept", "broken", "open", "kept"],
    feed: [
      { t: t(42), who: "pledge #1", what: "check asked · release v1.0.0", tone: "" },
      { t: t(39), who: "swarm", what: "9/9 agree · DELIVERED", tone: "ok" },
      { t: t(39), who: "vault", what: "kept · 30,000,000 released", tone: "ok" },
      { t: t(31), who: "pledge #2", what: "deadline + 3d passed · unproven", tone: "alarm" },
      { t: t(31), who: "vault", what: "broken · 20,000,000 burned", tone: "alarm" },
      { t: t(18), who: "pledge #1", what: "check asked · site shows text", tone: "" },
      { t: t(12), who: "swarm", what: "panel of 9 working…", tone: "caution" },
      { t: t(6), who: "referee", what: "+0.5 IMD rebate · promise kept", tone: "ok" },
      { t: t(2), who: "pledge #3", what: "locked 4 milestones", tone: "" },
    ],
  };
}
