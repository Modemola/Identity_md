import { formatUnits } from "viem";
import { config } from "./config.js";

// Every on-chain string goes through text nodes; nothing user-supplied is ever parsed as HTML.
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  setAttrs(el, attrs);
  append(el, kids);
  return el;
}

/** Appends children to an existing element and returns it (for nodes made earlier, e.g. observed ones). */
export function fill(el, ...kids) {
  append(el, kids);
  return el;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** An SVG element. Same rules as `h`: attributes and children, never raw markup. */
export function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  setAttrs(el, attrs);
  append(el, kids);
  return el;
}

function setAttrs(el, attrs) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.setAttribute("class", v);
    else if (k === "style" && typeof v === "object")
      for (const [prop, val] of Object.entries(v)) prop.startsWith("--") ? el.style.setProperty(prop, val) : (el.style[prop] = val);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") throw new Error("no raw html");
    else el.setAttribute(k, v === true ? "" : v);
  }
}

function append(el, kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
}

// Hash-only: the browser keeps the current query string (any ?vault=… overrides) on its own, and a
// same-document link never reloads the page.
export const link = (path) => `#${path}`;
export const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
export const addrLink = (a) =>
  h("a", { class: "addr", href: `${config.explorer}/address/${a}`, target: "_blank", rel: "noopener" }, short(a));
export const now = () => BigInt(Math.floor(Date.now() / 1000));
export const IMD_DECIMALS = 18;

export function fmt(amount, decimals, max = 2) {
  const str = formatUnits(amount, decimals);
  const [i, f = ""] = str.split(".");
  const int = BigInt(i).toLocaleString("en-US");
  const frac = f.slice(0, max).replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
}

export function when(ts) {
  return new Date(Number(ts) * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function span(seconds) {
  let x = Number(seconds < 0n ? -seconds : seconds);
  const d = Math.floor(x / 86400);
  x -= d * 86400;
  const hrs = Math.floor(x / 3600);
  x -= hrs * 3600;
  const m = Math.floor(x / 60);
  if (d) return `${d}d ${hrs}h`;
  if (hrs) return `${hrs}h ${m}m`;
  return `${Math.max(m, 1)}m`;
}
