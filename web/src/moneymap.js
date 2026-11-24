// The money map: a funding group drawn as a tree. The wallet the money starts from sits at the
// top, wallets in between below it, launchers at the leaves, coloured by their record. The path
// from the wallet being checked back to the money is drawn in ink.
//
// Pure SVG built with `s` (no raw markup), sized by its viewBox so it scales to any width.

import { s, h, link, short } from "./dom.js";

const W = 1000;
const ROW = 118;
const TOP = 46;
/** More nodes than this and the map keeps the path, the funders and the red launchers first. */
const MAX_NODES = 42;
const TONE_WORD = { exits: "sells fast", sold: "has sold", clean: "no sells", new: "first launch" };

/**
 * @param {object} group  /api/record's `group`: launchers (with `funder`), funderList, totals
 * @param {string} self   the address being checked (a launcher or a funder), drawn larger
 */
export function moneyMap(group, self) {
  const me = (self || "").toLowerCase();
  const nodes = new Map();
  for (const f of group.funderList || []) nodes.set(f.address, { addr: f.address, kind: "funder", parent: f.funder, funded: f.funded });
  for (const l of group.launchers || []) nodes.set(l.address, { addr: l.address, kind: "launcher", parent: l.funder, tone: l.tone, launches: l.launches, fastExits: l.fastExits });
  // a parent outside what we were sent is drawn as a root
  for (const n of nodes.values()) if (!nodes.has(n.parent)) n.parent = null;

  // which nodes to draw: the path to the checked wallet, every funder, red launchers, then the rest
  const keep = new Set();
  const up = (a) => {
    for (let x = a, i = 0; x && nodes.has(x) && i < 12; x = nodes.get(x).parent, i++) keep.add(x);
  };
  up(me);
  for (const n of nodes.values()) if (n.kind === "funder") up(n.addr);
  const launchers = [...nodes.values()].filter((n) => n.kind === "launcher").sort((a, b) => (b.tone === "exits") - (a.tone === "exits") || b.fastExits - a.fastExits);
  for (const n of launchers) {
    if (keep.size >= MAX_NODES && !keep.has(n.addr)) continue;
    up(n.addr);
  }
  const shown = [...keep].map((a) => nodes.get(a));
  const hidden = (group.totals?.launchers ?? launchers.length) - shown.filter((n) => n.kind === "launcher").length;

  // depth from the root, then rows ordered so children sit under their parents
  const depth = (n, seen = 0) => (n.parent && keep.has(n.parent) && seen < 12 ? depth(nodes.get(n.parent), seen + 1) + 1 : 0);
  for (const n of shown) n.depth = depth(n);
  const layers = [];
  for (const n of shown) (layers[n.depth] ??= []).push(n);
  const size = new Map();
  const sub = (a) => {
    if (size.has(a)) return size.get(a);
    const v = 1 + shown.filter((n) => n.parent === a).reduce((t, n) => t + sub(n.addr), 0);
    size.set(a, v);
    return v;
  };
  layers[0]?.sort((a, b) => sub(b.addr) - sub(a.addr));
  const pos = new Map();
  let y = TOP;
  layers.forEach((layer, d) => {
    if (d > 0) {
      const order = (n) => [...pos.keys()].indexOf(n.parent);
      layer.sort((a, b) => order(a) - order(b) || (a.kind === "funder") - (b.kind === "funder") || (b.tone === "exits") - (a.tone === "exits"));
    }
    // a crowded row staggers into two lines so the nodes never touch
    const stagger = layer.length > 22;
    layer.forEach((n, i) => pos.set(n.addr, { x: ((i + 0.5) * W) / layer.length, y: y + (stagger && i % 2 ? 38 : 0) }));
    y += ROW + (stagger ? 38 : 0);
  });
  const H = y - ROW + 64;

  const dense = (n) => (layers[n.depth]?.length ?? 0) > 12;
  const labelled = (n) => n.addr === me || n.kind === "funder" || !dense(n);
  const onPath = new Set();
  for (let x = me, i = 0; x && keep.has(x) && i < 12; x = nodes.get(x).parent, i++) onPath.add(x);

  const edges = shown
    .filter((n) => n.parent && pos.has(n.parent))
    .map((n, i) => {
      const a = pos.get(n.parent);
      const b = pos.get(n.addr);
      const my = (a.y + b.y) / 2;
      const hot = onPath.has(n.addr) && onPath.has(n.parent);
      return s("path", {
        class: `mm-edge${hot ? " hot" : ""}${n.tone === "exits" ? " red" : ""}`,
        // an edge leaves below its parent's label, so lines never cross the text
        d: `M${a.x.toFixed(1)} ${(a.y + (labelled(nodes.get(n.parent)) ? 36 : 12)).toFixed(1)} C${a.x.toFixed(1)} ${(my + 10).toFixed(1)} ${b.x.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${(b.y - (n.addr === me ? 30 : 12)).toFixed(1)}`,
        pathLength: "1",
        style: { "--d": `${(n.depth * 0.18 + (i % 12) * 0.015).toFixed(2)}s` },
      });
    });

  const nodesSvg = shown.map((n) => {
    const p = pos.get(n.addr);
    const isMe = n.addr === me;
    const title = n.kind === "funder" ? `${n.addr}\nfunding wallet${n.funded ? `, funded ${n.funded} wallets` : ""}` : `${n.addr}\nlauncher: ${TONE_WORD[n.tone] ?? n.tone}, ${n.fastExits} of ${n.launches} launch${n.launches === 1 ? "" : "es"} sold within an hour`;
    const shape =
      n.kind === "funder"
        ? s("rect", { class: "mm-funder", x: p.x - 11, y: p.y - 11, width: 22, height: 22, rx: 6 })
        : s("circle", { class: `mm-dot t-${n.tone}`, cx: p.x, cy: p.y, r: isMe ? 13 : dense(n) ? 8 : 10 });
    const label = labelled(n) ? s("text", { class: "mm-label", x: p.x, y: p.y + (isMe ? 32 : 28), "text-anchor": "middle" }, short(n.addr)) : null;
    return s(
      "a",
      { href: link(`/check/${n.addr}`), class: `mm-node${isMe ? " me" : ""}${onPath.has(n.addr) ? " on-path" : ""}`, style: { "--d": `${(0.1 + n.depth * 0.18).toFixed(2)}s` } },
      s("title", {}, title),
      isMe ? s("circle", { class: "mm-ring", cx: p.x, cy: p.y, r: 21 }) : null,
      n.tone === "exits" && !isMe ? s("circle", { class: "mm-glow", cx: p.x, cy: p.y, r: 16 }) : null,
      shape,
      label,
      isMe ? s("text", { class: "mm-me", x: p.x, y: p.y - 26, "text-anchor": "middle" }, "THIS WALLET") : null,
    );
  });

  const t = group.totals || {};
  let scroller;
  // a scrolled map opens on the checked wallet, once it's on the page
  const focus = pos.get(me);
  if (focus)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (scroller && scroller.scrollWidth > scroller.clientWidth) scroller.scrollLeft = (focus.x / W) * scroller.scrollWidth - scroller.clientWidth / 2;
      }),
    );
  return h(
    "div",
    { class: "mm" },
    h(
      "div",
      { class: "mm-top" },
      h("div", { class: "mm-key" }, ...[
        ["funder", "funding wallet"],
        ["t-exits", "sells fast"],
        ["t-sold", "has sold"],
        ["t-clean", "no sells"],
        ["t-new", "first launch"],
      ].map(([c, w]) => h("span", {}, h("i", { class: `k-${c}` }), w))),
      h("span", { class: "mm-sum tnum" }, `${t.launchers ?? "?"} launchers · ${t.red ?? 0} red · ${(t.fastExits ?? 0).toLocaleString("en-US")} fast exits`),
    ),
    // on a phone the map keeps a readable size and scrolls sideways
    (scroller = h(
      "div",
      { class: "mm-scroll" },
      s("svg", { class: "mm-svg", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Funding map: ${t.launchers ?? ""} launchers tied by the wallets that funded them` }, s("g", {}, ...edges), s("g", {}, ...nodesSvg)),
    )),
    h("p", { class: "mm-swipe faint" }, "Swipe to see the whole map"),
    hidden > 0 ? h("p", { class: "mm-more faint" }, `${hidden} more launcher${hidden === 1 ? "" : "s"} in this group aren't drawn: the map keeps the funders, the red launchers and this wallet's path.`) : null,
  );
}
