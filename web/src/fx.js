import { h, s } from "./dom.js";

// The motion layer. Every effect here obeys the same rules:
// - it animates only `transform` and `opacity`, which the compositor runs off the main thread;
// - content is visible without JavaScript (hidden states only exist under `html.js`);
// - nothing runs off-screen or in a background tab;
// - `prefers-reduced-motion` gets the final state immediately, and coarse pointers get no
//   pointer-chasing effects (they only fire on hover, which touch screens do not have).

export const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const finePointer = matchMedia("(pointer: fine)").matches;

document.documentElement.classList.add("js");

// ------------------------------------------------------------------ theme (IMD's light/dark)

const THEME_KEY = "kept-theme";

function storedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

export function initTheme() {
  const t = storedTheme();
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
}

export function toggleTheme() {
  const root = document.documentElement;
  const current = root.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  const next = current === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {}
}

// ------------------------------------------------------------------ reveal on scroll, once

const revealed = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      revealed.unobserve(e.target);
      e.target.dispatchEvent(new Event("reveal"));
    }
  },
  { rootMargin: "0px 0px -8% 0px" },
);

// A quiet re-render (fresh data replacing cached data on the same page) must not replay entrances:
// while `instant` is on, reveals land in their final state and numbers jump straight to their value.
let instant = false;
export const setInstant = (v) => (instant = v);
export const isInstant = () => instant;

/** Marks an element to rise in when it first scrolls into view. Returns the element. */
export function reveal(el, delay = 0) {
  el.classList.add("rv");
  if (delay) el.style.setProperty("--d", `${delay}ms`);
  if (reduced || instant) el.classList.add("in");
  else revealed.observe(el);
  return el;
}

/** Runs `fn` once, when `el` first becomes visible. */
export function onSight(el, fn) {
  if (reduced) return queueMicrotask(fn);
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      io.disconnect();
      fn();
    }
  });
  io.observe(el);
}

// ------------------------------------------------------------------ headline words

/** A headline that assembles word by word on first paint. CSS only: never waits on data. */
export function words(text, { delay = 0, stagger = 70, accent = [] } = {}) {
  const parts = text.split(" ");
  return [
    h("span", { class: "sr-only" }, text),
    // The space sits between the word boxes, not inside them: inside a clipped inline-block a
    // trailing space collapses and the words run together.
    ...parts.flatMap((w, i) => [
      h(
        "span",
        { class: "wmask", "aria-hidden": "true" },
        h("span", { class: `w${accent.includes(w) ? " accent" : ""}`, style: { animationDelay: `${delay + i * stagger}ms` } }, w),
      ),
      i < parts.length - 1 ? " " : null,
    ]),
  ];
}

// ------------------------------------------------------------------ numbers

/** Rolls a number up to `value` when it comes into view, then on every later change. */
export function countUp(el, value, format = (n) => Math.round(n).toLocaleString("en-US"), ms = 900) {
  const from = Number(el.dataset.v ?? 0);
  el.dataset.v = value;
  if (reduced || instant || from === value) {
    el.textContent = format(value);
    return;
  }
  const run = () => {
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min((t - t0) / ms, 1);
      const eased = 1 - Math.pow(1 - k, 4);
      el.textContent = format(from + (value - from) * eased);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (el.isConnected && el.dataset.seen) run();
  else onSight(el, () => ((el.dataset.seen = "1"), run()));
}

// ------------------------------------------------------------------ seven-segment readout

// Segments a–g as polygons in a 20×34 cell, the way a lab instrument draws them.
const SEG = {
  a: "3,1 17,1 14,4 6,4",
  b: "18,2 18,16 15,14 15,5",
  c: "18,18 18,32 15,29 15,20",
  d: "3,33 17,33 14,30 6,30",
  e: "2,18 5,20 5,29 2,32",
  f: "2,2 5,5 5,14 2,16",
  g: "3,17 6,15 14,15 17,17 14,19 6,19",
};
const DIGIT = {
  0: "abcdef",
  1: "bc",
  2: "abdeg",
  3: "abcdg",
  4: "bcfg",
  5: "acdfg",
  6: "acdefg",
  7: "abc",
  8: "abcdefg",
  9: "abcdfg",
  "-": "g",
  " ": "",
};

/** A seven-segment number display. `set(n)` updates it; unlit segments stay faintly visible. */
export function sevenSeg(digits = 3, tone = "ok") {
  const cells = [];
  const root = s("svg", { class: `seg seg-${tone}`, viewBox: `0 0 ${digits * 24} 34`, "aria-hidden": "true" });
  for (let i = 0; i < digits; i++) {
    const g = s("g", { transform: `translate(${i * 24 + 2},0)` });
    const segs = {};
    for (const [k, pts] of Object.entries(SEG)) {
      const p = s("polygon", { points: pts, class: "s" });
      segs[k] = p;
      g.append(p);
    }
    cells.push(segs);
    root.append(g);
  }
  const label = h("span", { class: "sr-only" }, "");
  const wrap = h("span", { class: "segwrap" }, root, label);
  const show = (str) => {
    const padded = str.padStart(digits, " ").slice(-digits);
    [...padded].forEach((ch, i) => {
      const on = DIGIT[ch] ?? "";
      for (const [k, p] of Object.entries(cells[i])) p.classList.toggle("on", on.includes(k));
    });
  };
  wrap.set = (value) => {
    if (value === null || value === undefined) {
      show("-".repeat(digits));
      label.textContent = "unknown";
      return;
    }
    label.textContent = String(value);
    const target = Math.max(0, Math.round(value));
    if (reduced || instant || wrap.dataset.v === String(target)) return (wrap.dataset.v = String(target)), show(String(target));
    wrap.dataset.v = String(target);
    // A short counter roll: cheap (a few dozen attribute flips) and only when visible.
    onSight(wrap, () => {
      let n = 0;
      const steps = Math.min(target, 18);
      const tick = () => {
        n += 1;
        show(String(Math.round((target * n) / Math.max(steps, 1))));
        if (n < steps) setTimeout(tick, 45);
      };
      if (steps === 0) show(String(target));
      else tick();
    });
  };
  show("-".repeat(digits));
  return wrap;
}

// ------------------------------------------------------------------ pointer effects

/** Buttons that lean toward the cursor. Desktop pointers only; one rAF per frame at most. */
export function magnetic(el, strength = 0.22) {
  if (reduced || !finePointer) return el;
  let raf = 0;
  let tx = 0;
  let ty = 0;
  // `translate`, not `transform`: CSS keeps `scale` free for the press effect, and both compose.
  const apply = () => {
    raf = 0;
    el.style.translate = `${tx}px ${ty}px`;
  };
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    tx = (e.clientX - r.left - r.width / 2) * strength;
    ty = (e.clientY - r.top - r.height / 2) * strength;
    if (!raf) raf = requestAnimationFrame(apply);
  });
  el.addEventListener("pointerleave", () => {
    tx = ty = 0;
    if (!raf) raf = requestAnimationFrame(apply);
  });
  el.classList.add("magnet");
  return el;
}

/** A soft light that follows the cursor across a panel (CSS variables only, no layout). */
export function spotlight(el) {
  if (reduced || !finePointer) return el;
  el.classList.add("spot");
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
  return el;
}

/** A card that tilts toward the cursor in 3D, a few degrees at most. Desktop pointers only. */
export function tilt(el, max = 5) {
  if (reduced || !finePointer) return el;
  let raf = 0;
  let rx = 0;
  let ry = 0;
  const apply = () => {
    raf = 0;
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  };
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    ry = ((e.clientX - r.left) / r.width - 0.5) * 2 * max;
    rx = -((e.clientY - r.top) / r.height - 0.5) * 2 * max;
    if (!raf) raf = requestAnimationFrame(apply);
  });
  el.addEventListener("pointerleave", () => {
    rx = ry = 0;
    if (!raf) raf = requestAnimationFrame(apply);
  });
  el.classList.add("tilt");
  return el;
}

// ------------------------------------------------------------------ view transitions

export const canTransition = () => !!document.startViewTransition && !reduced;

/**
 * The theme flips inside a view transition, revealed as a circle growing from the toggle.
 * Without the API (or with reduced motion) it just flips.
 */
export function themeSwitch(e) {
  const root = document.documentElement;
  if (!canTransition()) return toggleTheme();
  const x = e?.clientX || innerWidth - 60;
  const y = e?.clientY || 36;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add("vt-theme");
  const t = document.startViewTransition(toggleTheme);
  t.ready
    .then(() =>
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 720, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
      ),
    )
    .catch(() => {});
  t.finished.finally(() => root.classList.remove("vt-theme"));
}

// ------------------------------------------------------------------ visibility-aware timers

/**
 * setInterval that only ticks while `el` is on screen and the tab is visible, and stops for good
 * once `el` leaves the document. Returns a stop function.
 */
export function liveInterval(el, fn, ms) {
  let visible = false;
  let timer = 0;
  const sync = () => {
    const run = visible && !document.hidden && el.isConnected;
    if (run && !timer) timer = setInterval(() => (el.isConnected ? fn() : stop()), ms);
    if (!run && timer) {
      clearInterval(timer);
      timer = 0;
    }
  };
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    sync();
  });
  io.observe(el);
  document.addEventListener("visibilitychange", sync);
  function stop() {
    clearInterval(timer);
    timer = 0;
    io.disconnect();
    document.removeEventListener("visibilitychange", sync);
  }
  return stop;
}
