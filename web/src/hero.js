import { h, s } from "./dom.js";
import { sevenSeg, liveInterval, reduced } from "./fx.js";

// The Verdict Unit: KEPT's piece of IMD's instrument wall. A bezel, a dark screen, two
// seven-segment readouts (kept, broken), one lamp per milestone, a scope trace and a terminal
// that prints what the swarm decided.
//
// It is drawn with SVG and CSS, not WebGL: it cannot fail on a blocked GPU, costs nothing to
// load, and every moving part is a transform or an opacity change on the compositor. Its only
// timer is a visibility-aware interval that stops off-screen and in background tabs.

const LINES_SHOWN = 7;

export function verdictUnit({ live }) {
  const kept = sevenSeg(3, "ok");
  const broken = sevenSeg(3, "alarm");
  const lamps = h("div", { class: "vu-lamps", role: "list", "aria-label": "Milestones" });
  const log = h("div", { class: "vu-log", "aria-live": "off" });
  const mode = h("span", { class: "vu-mode" }, live ? "LIVE" : "SAMPLE FEED");
  const scope = s(
    "svg",
    { class: "vu-scope", viewBox: "0 0 400 60", preserveAspectRatio: "none", "aria-hidden": "true" },
    s(
      "g",
      { class: "vu-trace" },
      // Two copies of one period side by side: translating by exactly one period loops seamlessly.
      s("path", { d: tracePath(0) }),
      s("path", { d: tracePath(400) }),
    ),
  );

  const unit = h(
    "div",
    { class: "vu", role: "img", "aria-label": "KEPT verdict unit: milestones kept and broken" },
    h(
      "div",
      { class: "vu-head" },
      h("span", { class: "lamp ok blink" }),
      h("span", {}, "KEPT/01 · VERDICT UNIT"),
      mode,
    ),
    h(
      "div",
      { class: "vu-screen" },
      h(
        "div",
        { class: "vu-readouts" },
        h("div", { class: "vu-read" }, h("span", { class: "vu-k" }, "KEPT"), kept),
        h("div", { class: "vu-read" }, h("span", { class: "vu-k" }, "BROKEN"), broken),
      ),
      lamps,
      scope,
      log,
    ),
    h(
      "div",
      { class: "vu-foot" },
      h("span", {}, "IMD ORACLE"),
      h("span", { class: "vu-dots", "aria-hidden": "true" }, h("i"), h("i"), h("i")),
      h("span", {}, "ROBINHOOD 4663"),
    ),
  );

  let feed = [];
  let cursor = 0;
  let stop = null;

  function push(line) {
    const row = h(
      "div",
      { class: `vu-line ${line.tone || ""}` },
      h("span", { class: "vu-t" }, line.t),
      h("span", { class: "vu-who" }, line.who),
      h("span", { class: "vu-what" }, line.what),
    );
    log.append(row);
    while (log.children.length > LINES_SHOWN) log.firstElementChild.remove();
  }

  /** `data`: { kept, broken, lamps: ['kept'|'broken'|'open'|'checking'], feed: [{t, who, what, tone}] } */
  unit.update = (data) => {
    kept.set(data.kept);
    broken.set(data.broken);
    lamps.replaceChildren(
      ...data.lamps.slice(0, 12).map((cls, i) =>
        h("span", { class: `lamp big ${cls}`, role: "listitem", "aria-label": `Milestone ${i + 1}: ${cls}`, style: { animationDelay: `${i * 90}ms` } }),
      ),
    );
    feed = data.feed;
    cursor = 0;
    log.replaceChildren();
    const first = Math.min(feed.length, reduced ? feed.length : 3);
    for (; cursor < first; cursor++) push(feed[cursor]);
    stop?.();
    if (!reduced && feed.length > first) {
      stop = liveInterval(unit, () => {
        push(feed[cursor % feed.length]);
        cursor += 1;
      }, 1700);
    }
  };

  return unit;
}

/** One period of a slow heartbeat on a quiet baseline, offset by `x`. */
function tracePath(x) {
  const y = 34;
  const pts = [
    [0, y], [70, y], [80, y - 2], [90, y], [150, y], [158, y + 6], [166, y - 24], [174, y + 14],
    [182, y], [250, y], [262, y - 5], [276, y], [400, y],
  ];
  return pts.map(([px, py], i) => `${i ? "L" : "M"}${px + x} ${py}`).join(" ");
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
