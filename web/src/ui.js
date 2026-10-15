import { h, short } from "./dom.js";
import { config } from "./config.js";
import { icon } from "./icons.js";
import { reason } from "./chain.js";

// ------------------------------------------------------------------ toasts

const stack = () => document.getElementById("toasts");

/** A small notice that stacks above the status bar; `tone` is ok, alarm or ''. */
export function toast(msg, tone = "", { ms = tone === "alarm" ? 9000 : 4500, link } = {}) {
  const el = h(
    "div",
    { class: `toast ${tone}`, role: tone === "alarm" ? "alert" : "status" },
    h("span", { class: `lamp ${tone === "alarm" ? "alarm" : tone === "ok" ? "ok" : "caution"}` }),
    h("div", { class: "toast-msg" }, msg, link ? [" ", h("a", { href: link.href, target: "_blank", rel: "noopener" }, link.text)] : null),
    h("button", { class: "toast-x", "aria-label": "Dismiss", onclick: () => close() }, "×"),
    h("i", { class: "toast-bar", style: { animationDuration: `${ms}ms` } }),
  );
  stack().append(el);
  const timer = setTimeout(close, ms);
  function close() {
    clearTimeout(timer);
    if (!el.isConnected || el.classList.contains("out")) return;
    el.classList.add("out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 600);
  }
  return close;
}

// ------------------------------------------------------------------ transaction sheet

let openSheet = null;
const txLink = (hash) => h("a", { href: `${config.explorer}/tx/${hash}`, target: "_blank", rel: "noopener" }, `tx ${short(hash)}`);

/**
 * Runs a list of on-chain steps with a live sheet: each step shows waiting, wallet, pending (with
 * its transaction), done or failed. `steps`: [{ label, run(phase) }], where `run` may resolve
 * `null` to mark itself skipped (e.g. an allowance that already covers the amount).
 * Resolves true when every step succeeded.
 */
export async function runSteps(title, steps, { button } = {}) {
  openSheet?.dismiss();
  const rows = steps.map((s) =>
    h(
      "li",
      { class: "tx-step" },
      h("span", { class: "tx-dot" }, h("span", { class: "lamp" })),
      h("div", {}, h("div", { class: "tx-label" }, s.label), h("div", { class: "tx-detail" }, "Waiting")),
    ),
  );
  const closeBtn = h("button", { class: "toast-x", "aria-label": "Close", onclick: () => dismiss() }, "×");
  const sheet = h(
    "div",
    { class: "tx-sheet", role: "dialog", "aria-live": "polite", "aria-label": title },
    h("div", { class: "tx-head" }, h("span", { class: "lamp caution blink" }), h("b", {}, title), closeBtn),
    h("ol", { class: "tx-steps" }, rows),
    h("div", { class: "tx-progress" }, h("i")),
  );
  document.body.append(sheet);
  const bar = sheet.querySelector(".tx-progress i");
  const headLamp = sheet.querySelector(".tx-head .lamp");
  function dismiss() {
    if (!sheet.isConnected || sheet.classList.contains("out")) return;
    sheet.classList.add("out");
    sheet.addEventListener("animationend", () => sheet.remove(), { once: true });
    setTimeout(() => sheet.remove(), 700);
    if (openSheet?.sheet === sheet) openSheet = null;
  }
  openSheet = { sheet, dismiss };

  const before = button ? [...button.childNodes] : null;
  if (button) {
    button.disabled = true;
    button.classList.add("busy");
  }
  const restore = () => {
    if (!button) return;
    button.disabled = false;
    button.classList.remove("busy");
    if (before) button.replaceChildren(...before);
  };

  for (let i = 0; i < steps.length; i++) {
    const row = rows[i];
    const detail = row.querySelector(".tx-detail");
    row.className = "tx-step active";
    detail.replaceChildren("Checking…");
    bar.style.transform = `scaleX(${(i + 0.35) / steps.length})`;
    try {
      const out = await steps[i].run((phase, hash) => {
        if (phase === "sign") detail.replaceChildren("Confirm in your wallet");
        if (phase === "pending") detail.replaceChildren("Waiting for the block · ", txLink(hash));
        if (phase === "confirmed") detail.replaceChildren("Confirmed · ", txLink(hash));
      });
      row.className = out === null ? "tx-step skipped" : "tx-step done";
      if (out === null) detail.replaceChildren("Not needed");
      else if (!detail.textContent.startsWith("Confirmed")) detail.replaceChildren("Done");
      row.querySelector(".tx-dot").replaceChildren(icon(out === null ? "arrow" : "check", 14));
    } catch (e) {
      row.className = "tx-step failed";
      detail.replaceChildren(friendly(e));
      row.querySelector(".tx-dot").replaceChildren(icon("cross", 14));
      headLamp.className = "lamp alarm";
      sheet.classList.add("failed");
      restore();
      return false;
    }
  }
  bar.style.transform = "scaleX(1)";
  headLamp.className = "lamp ok";
  sheet.classList.add("ok");
  restore();
  setTimeout(dismiss, 2600);
  return true;
}

/** Wallet rejections read as a choice, not an error. */
function friendly(e) {
  const r = reason(e);
  if (/user (rejected|denied)|rejected the request|denied transaction/i.test(r)) return "You cancelled in the wallet. Nothing was sent.";
  return r;
}

// ------------------------------------------------------------------ skeletons

/** Placeholder rows that shimmer while the first read is in flight (only when nothing is cached). */
export function skeletonRows(n = 3) {
  return Array.from({ length: n }, (_, i) =>
    h(
      "div",
      { class: "row sk-row", "aria-hidden": "true", style: { "--i": i } },
      h("span", { class: "sk sk-glyph" }),
      h("div", {}, h("span", { class: "sk sk-line w60" }), h("span", { class: "sk sk-line w40" }), h("span", { class: "sk sk-line w30" })),
    ),
  );
}

// ------------------------------------------------------------------ command palette

/**
 * ⌘K / Ctrl+K (or "/") opens a jump list: pages and every pledge already read. Arrow keys move,
 * Enter goes, Escape closes. `items()` is called on open so it always lists the latest cache.
 */
export function commandPalette(items) {
  let el = null;
  let sel = 0;
  let list = [];
  let returnTo = null;

  function open() {
    if (el) return;
    returnTo = document.activeElement;
    // a combobox: focus stays in the input, arrow keys move the active option, and the input
    // names it through aria-activedescendant so screen readers announce each move
    const input = h("input", { class: "cp-input", placeholder: "Jump to a pledge or page…", "aria-label": "Search pages and pledges", autocomplete: "off", spellcheck: "false", role: "combobox", "aria-expanded": "true", "aria-controls": "cp-list", "aria-autocomplete": "list" });
    const ul = h("ul", { class: "cp-list", role: "listbox", id: "cp-list", "aria-label": "Results" });
    el = h(
      "div",
      { class: "cp", role: "dialog", "aria-modal": "true", "aria-label": "Jump to" },
      h("div", { class: "cp-scrim", onclick: close }),
      h("div", { class: "cp-box" }, h("div", { class: "cp-bar" }, icon("arrow", 14), input, h("kbd", {}, "esc")), ul),
    );
    const render = () => {
      const q = input.value.trim().toLowerCase();
      list = items().filter((it) => !q || `${it.label} ${it.hint || ""}`.toLowerCase().includes(q)).slice(0, 9);
      sel = Math.min(sel, Math.max(0, list.length - 1));
      ul.replaceChildren(
        ...(list.length
          ? list.map((it, i) =>
              h(
                "li",
                { class: i === sel ? "on" : "", id: `cp-opt-${i}`, role: "option", "aria-selected": i === sel ? "true" : "false", onpointerenter: () => ((sel = i), render()), onclick: () => go(it) },
                h("span", { class: `lamp ${it.tone || ""}` }),
                h("span", { class: "cp-label" }, it.label),
                it.hint ? h("span", { class: "cp-hint" }, it.hint) : null,
              ),
            )
          : [h("li", { class: "cp-empty", role: "presentation" }, "Nothing matches.")]),
      );
      if (list.length) input.setAttribute("aria-activedescendant", `cp-opt-${sel}`);
      else input.removeAttribute("aria-activedescendant");
    };
    input.addEventListener("input", () => ((sel = 0), render()));
    // keys on the whole dialog: Escape works wherever focus is, and Tab cannot leave it
    el.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") (sel = Math.min(sel + 1, list.length - 1)), render(), e.preventDefault();
      else if (e.key === "ArrowUp") (sel = Math.max(sel - 1, 0)), render(), e.preventDefault();
      else if (e.key === "Enter" && list[sel]) go(list[sel]);
      else if (e.key === "Escape") e.preventDefault(), close();
      else if (e.key === "Tab") e.preventDefault(), input.focus();
    });
    document.body.append(el);
    render();
    input.focus();
  }
  function go(it) {
    close(false);
    location.hash = `#${it.path}`;
  }
  function close(restore = true) {
    if (!el) return;
    const node = el;
    el = null;
    if (restore && returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    node.classList.add("out");
    setTimeout(() => node.remove(), 220);
  }
  addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
      e.preventDefault();
      if (el) close();
      else open();
    }
  });
  return { open, close };
}
