import { config } from "./config.js";

// Stale-while-revalidate for chain reads. A view paints at once from whatever is cached (memory
// first, then this tab's sessionStorage, so a reload is instant too), then the fresh read lands and
// the view updates in place only if something changed. In-flight reads are shared, so hovering a
// row and then clicking it never fetches twice.

const NS = `kept:${config.chainId}:${(config.vault || "none").toLowerCase()}:`;
const mem = new Map(); // key -> { value, at }
const inflight = new Map(); // key -> Promise

// bigint-safe JSON
const enc = (v) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? { $b: x.toString() } : x));
const dec = (s) => JSON.parse(s, (_, x) => (x && typeof x === "object" && "$b" in x ? BigInt(x.$b) : x));

function fromSession(key) {
  try {
    const raw = sessionStorage.getItem(NS + key);
    if (!raw) return undefined;
    const entry = dec(raw);
    mem.set(key, entry);
    return entry;
  } catch {
    return undefined;
  }
}

function toSession(key, entry) {
  try {
    sessionStorage.setItem(NS + key, enc(entry));
  } catch {}
}

/** The cached value for `key`, however old, or undefined. Never fetches. */
export function peek(key) {
  return (mem.get(key) ?? fromSession(key))?.value;
}

/** Age in ms of the cached value, or Infinity. */
export function age(key) {
  const e = mem.get(key) ?? fromSession(key);
  return e ? Date.now() - e.at : Infinity;
}

/** Stores a value as fresh (used when one read also yields other keys, e.g. the list yields each pledge). */
export function put(key, value, persist = true) {
  const entry = { value, at: Date.now() };
  mem.set(key, entry);
  if (persist) toSession(key, entry);
  return value;
}

/** Fetches `key` unless a value younger than `maxAge` ms is cached. Concurrent calls share one read. */
export function load(key, loader, { maxAge = 0, persist = true } = {}) {
  if (age(key) < maxAge) return Promise.resolve(peek(key));
  if (inflight.has(key)) return inflight.get(key);
  const p = loader()
    .then((v) => put(key, v, persist))
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Marks keys stale (after a transaction) so the next load reads the chain. Values stay for painting. */
export function invalidate(...keys) {
  for (const k of keys) {
    const e = mem.get(k) ?? fromSession(k);
    if (e) e.at = 0;
  }
}

/** A cheap structural signature, to skip re-rendering when a refresh returns the same data. */
export const sig = (v) => enc(v);
