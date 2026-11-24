// The KEPT bot's conversation: menus and buttons in a private chat. Used by alerts.mjs (once a
// pass) and listen.mjs (between passes, so replies come within seconds).
//
// Anyone can paste a token, a wallet or a launch number with no command and get the record of the
// wallet behind it. Everything else is a tap: watch a launcher, open its record, see the fastest
// exits, the funding groups, this week's report, or follow a pledge.

import { watchCommand, watchedBy, resolve } from "./watch.mjs";

const SITE = process.env.KEPT_SITE || "keptmd.vercel.app";
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const btn = (text, data) => ({ text, callback_data: data });
const url = (text, u) => ({ text, url: u });
const keyboard = (rows) => ({ inline_keyboard: rows.filter((r) => r.length) });
const home = btn("🏠 Menu", "m:menu");
const recordUrl = (q) => `https://${SITE}/#/check/${q}`;
const looksLikeQuery = (t) => /^0x[0-9a-fA-F]{40}$/.test(t) || /^#?\d{1,7}$/.test(t);

/** The commands Telegram lists under the Menu button beside the message box. */
export const BOT_COMMANDS = [
  { command: "menu", description: "Everything KEPT can do" },
  { command: "check", description: "Check a token, wallet or launch number" },
  { command: "list", description: "Your watchlist" },
  { command: "top", description: "Launchers that sell fastest" },
  { command: "groups", description: "Funding groups with red launchers" },
];

function menu(channel) {
  return {
    text: [
      "<b>KEPT</b> · check before you buy",
      "",
      "Send me any <b>token</b>, <b>wallet</b> or <b>launch number</b>. I'll show what the wallet behind it did with every launch before, and whose money it's using.",
    ].join("\n"),
    markup: keyboard([
      [btn("🔎 Check a token", "m:check"), btn("👁 Watchlist", "m:list")],
      [btn("🔥 Fastest exits", "m:top"), btn("🕸 Funding groups", "m:groups")],
      [btn("📊 This week", "m:report"), btn("📌 Pledge alerts", "m:pledges")],
      [url("🌐 Open KEPT", `https://${SITE}`), ...(channel ? [url("📣 Alerts channel", `https://t.me/${channel.replace(/^@/, "")}`)] : [])],
    ]),
  };
}

async function api(path) {
  const r = await fetch(`https://${SITE}${path}`);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return path.includes("format=text") ? r.text() : r.json();
}

const TONE = {
  exits: ["🔴", "Sells into its own launches fast"],
  sold: ["🟠", "Has sold into its own launches"],
  clean: ["🟢", "No sells into its own launches"],
  new: ["⚪", "First launch, no sells yet"],
  linked: ["🟠", "Funded by the wallet behind red launchers"],
};
const n = (x) => Number(x).toLocaleString("en-US");

/** A record as a card: the verdict, the numbers, why, and the money behind it. */
function card(r, q) {
  const L = r.launcher;
  if (!L) {
    if (r.group) {
      const t = r.group.totals;
      return [`🕸 <b>A funder, not a launcher</b>`, `<code>${short(q)}</code> launched nothing itself. Its money ties together <b>${t.launchers}</b> launchers: <b>${t.red}</b> red, ${n(t.fastExits)} launches sold into within an hour.`].join("\n");
    }
    return `⚪ <b>No launches on record</b>\n<code>${esc(q)}</code> hasn't launched on vibe/vibe or IMD. No record isn't proof of safety: it may be new, or launching from another wallet.`;
  }
  const imd = L.source === "imd";
  const shown = r.linked && (L.tone === "new" || L.tone === "clean") ? "linked" : L.tone;
  const [dot, word] = TONE[shown] ?? TONE.new;
  const lead = r.matches?.[0] && L.recent.find((l) => l.token === r.matches[0].token);
  const s = L.summary;
  const lines = [
    `${dot} <b>${word.toUpperCase()}</b>`,
    [lead ? `<b>$${esc(lead.symbol)}</b>` : null, lead ? `launch #${lead.id}` : null, imd ? "IMD · Robinhood Chain" : "vibe/vibe"].filter(Boolean).join(" · "),
    `Launcher <code>${short(L.address)}</code>`,
    "",
    imd
      ? `<b>${s.launches}</b> IMD launch${s.launches === 1 ? "" : "es"} · <b>${s.sold}</b> sold into its pool · <b>${s.fastExits}</b> within an hour`
      : `<b>${n(s.launches)}</b> launch${s.launches === 1 ? "" : "es"} · <b>${n(s.graduated)}</b> graduated · <b>${n(s.fastExits)}</b> sold within an hour`,
    "",
    ...L.facts.slice(0, 3).map((f) => `· ${esc(f)}`),
  ];
  const k = r.linked;
  if (k) lines.push("", `⚠️ <b>Red money:</b> ${k.others ? `its funding ties it to ${k.others} other launchers, <b>${k.red}</b> red` : `its funder also funded <b>${k.red}</b> red launcher${k.red === 1 ? "" : "s"}`}. ${n(k.fastExits)} launches sold into within an hour between them.`);
  else if (r.group) lines.push("", `🕸 Funding group: ${r.group.totals.launchers} launchers, ${r.group.totals.red} red.`);
  if (r.holdings?.text) lines.push("", `📦 ${esc(r.holdings.text)}`);
  return lines.join("\n");
}

/** A launcher's record, with buttons to watch it and open it. */
async function check(q, chat, state) {
  let text;
  let wallet;
  try {
    const r = await api(`/api/record?q=${encodeURIComponent(q)}&source=imd`);
    text = card(r, q);
    wallet = r.launcher?.address;
  } catch {
    // the site is the source of truth; the bot's own reading of the records is the fallback
    text = String(await watchCommand("/check", q, chat, state))
      .replace(/\n\nWatch this wallet: \/watch \S+$/, "")
      .split("\n")
      .filter((l) => !/^https?:\/\//.test(l))
      .join("\n");
    wallet = (await resolve(q).catch(() => null))?.wallet;
  }
  const watching = wallet && watchedBy(state, chat).includes(wallet);
  return {
    text,
    markup: keyboard([
      [...(wallet ? [watching ? btn("✖ Unwatch", `u:${wallet}`) : btn("👁 Watch", `w:${wallet}`)] : []), url("🔗 Full record", recordUrl(q))],
      [btn("🔎 Check another", "m:check"), home],
    ]),
  };
}

/** A command reply with its bare links turned into a button. */
const tidy = (html) => {
  const links = String(html).match(/https?:\/\/\S+/g) || [];
  const text = String(html)
    .split("\n")
    .filter((l) => !/^https?:\/\//.test(l.trim()))
    .join("\n")
    .trim()
    // full addresses wrap on a phone: the record behind the button has them in full
    .replace(/<code>(0x[0-9a-fA-F]{40})<\/code>/g, (_, a) => `<code>${short(a)}</code>`);
  return { text, link: links[0] };
};

async function watchlist(chat, state) {
  const wallets = watchedBy(state, chat);
  const pledges = state.follows?.[chat] ?? [];
  if (!wallets.length && !pledges.length)
    return {
      text: "<b>Your watchlist is empty.</b>\n\nSend me a token or wallet, then tap <b>Watch</b>. You'll hear when that launcher sells into its own launch, moves its share, or launches again.",
      markup: keyboard([[btn("🔎 Check a token", "m:check"), home]]),
    };
  const lines = ["<b>👁 Your watchlist</b>", ""];
  if (wallets.length) lines.push(`Launchers (${wallets.length}):`, ...wallets.map((w) => `· <code>${short(w)}</code>`), "");
  if (pledges.length) lines.push(`Pledges: ${pledges.map((x) => `#${x}`).join(", ")}`, "");
  lines.push("Tap a launcher to open its record, or ✖ to stop.");
  return {
    text: lines.join("\n"),
    markup: keyboard([
      ...wallets.slice(0, 20).map((w) => [url(`🔗 ${short(w)}`, recordUrl(w)), btn("✖", `u:${w}`)]),
      ...pledges.map((p) => [url(`📌 Pledge #${p}`, `https://${SITE}/#/pledge/${p}`), btn("✖", `uf:${p}`)]),
      [home],
    ]),
  };
}

async function top() {
  const t = await api("/api/record?view=top&limit=8");
  const lines = ["<b>🔥 Fastest exits on vibe/vibe</b>", "Launchers that most often sold into their own launch within an hour.", ""];
  t.leaders.slice(0, 8).forEach((l, i) => lines.push(`${i + 1}. <code>${short(l.creator)}</code>  <b>${l.fastExits}</b> of ${l.launches} launches`));
  return {
    text: lines.join("\n"),
    markup: keyboard([...chunk(t.leaders.slice(0, 8).map((l, i) => url(`${i + 1}. ${short(l.creator)}`, recordUrl(l.creator))), 2), [url("🌐 All on KEPT", `https://${SITE}`), home]]),
  };
}

async function groups() {
  const g = await api("/api/record?view=groups&limit=6");
  const lines = ["<b>🕸 Funding groups</b>", "Fresh wallets, the same money. Groups where a quarter or more of the launchers sell fast.", ""];
  g.groups.slice(0, 6).forEach((x, i) => lines.push(`${i + 1}. Money from <code>${short(x.root)}</code>: <b>${x.red} of ${x.launchers}</b> red, ${x.fastExits} fast exits`));
  return {
    text: lines.join("\n"),
    markup: keyboard([...chunk(g.groups.slice(0, 6).map((x, i) => url(`${i + 1}. ${short(x.root)}`, recordUrl(x.root))), 2), [url("🕸 All groups", `https://${SITE}/#/groups`), home]]),
  };
}

async function report() {
  const t = await api("/api/report?format=text");
  return { text: `<b>📊 This week</b>\n\n${esc(t.replace(/\n*Check before you buy: \S+$/, ""))}`, markup: keyboard([[url("📊 Report card", `https://${SITE}/#/report`), home]]) };
}

function pledgeMenu(chat, state) {
  const ids = state.pledgeIds?.length ? state.pledgeIds : [1];
  const mine = state.follows?.[chat] ?? [];
  return {
    text: "<b>📌 Pledge alerts</b>\n\nTeams lock tokens behind milestones the IMD swarm checks. Follow a pledge to hear its due dates, verdicts and burns.",
    markup: keyboard([
      ...ids.slice(-8).map((id) => [mine.includes(id) ? btn(`✖ Stop pledge #${id}`, `uf:${id}`) : btn(`📌 Follow pledge #${id}`, `f:${id}`), url("Open", `https://${SITE}/#/pledge/${id}`)]),
      [url("🌐 Every pledge", `https://${SITE}/#/board`), home],
    ]),
  };
}

const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

function follow(chat, state, id, on) {
  const ids = state.pledgeIds?.length ? state.pledgeIds : [1];
  if (!ids.includes(id)) return `There is no pledge #${id}.`;
  const mine = (state.follows[chat] ??= []);
  if (on && !mine.includes(id)) mine.push(id);
  if (!on) state.follows[chat] = mine.filter((x) => x !== id);
  if (!state.follows[chat]?.length) delete state.follows[chat];
  return on ? `📌 Following pledge #${id}. You'll get its due dates, verdicts and burns here.` : `Stopped following pledge #${id}.`;
}

/**
 * Handles one Telegram update (a message or a button tap) in a private chat.
 * `tg(method, body)` calls the Bot API; `channel` is the public alerts channel, if any.
 */
export async function handleUpdate(u, { tg, state, channel }) {
  const send = (chat_id, view) => tg("sendMessage", { chat_id, text: view.text, parse_mode: "HTML", reply_markup: view.markup, link_preview_options: { is_disabled: true } });
  const failed = { text: "KEPT's records are updating. Try again in a minute.", markup: keyboard([[home]]) };
  const run = async (f) => {
    try {
      return await f();
    } catch {
      return failed;
    }
  };

  // a button tap
  if (u.callback_query) {
    const q = u.callback_query;
    const chat = String(q.message?.chat?.id ?? q.from.id);
    const [kind, arg] = String(q.data || "").split(/:(.*)/s);
    let toast = "";
    let view = null;
    if (kind === "m") {
      if (arg === "check") view = { text: "🔎 Send me a <b>token</b>, a <b>wallet</b> or a <b>launch number</b>.", markup: keyboard([[home]]) };
      else if (arg === "list") view = await run(() => watchlist(chat, state));
      else if (arg === "top") view = await run(top);
      else if (arg === "groups") view = await run(groups);
      else if (arg === "report") view = await run(report);
      else if (arg === "pledges") view = pledgeMenu(chat, state);
      else view = menu(channel);
    } else if (kind === "w" || kind === "u") {
      const reply = await watchCommand(kind === "w" ? "/watch" : "/unwatch", arg, chat, state).catch(() => null);
      toast = kind === "w" ? `Watching ${short(arg)}` : `Stopped watching ${short(arg)}`;
      const t = reply && tidy(reply);
      view = t ? { text: t.text, markup: keyboard([[kind === "w" ? btn("✖ Unwatch", `u:${arg}`) : btn("👁 Watch again", `w:${arg}`), btn("👁 Watchlist", "m:list")], [url("🔗 Full record", recordUrl(arg)), home]]) } : failed;
    } else if (kind === "f" || kind === "uf") {
      toast = follow(chat, state, Number(arg), kind === "f");
      view = pledgeMenu(chat, state);
    }
    await tg("answerCallbackQuery", { callback_query_id: q.id, ...(toast ? { text: toast } : {}) }).catch(() => {});
    if (view) await send(q.message?.chat?.id ?? q.from.id, view);
    return;
  }

  // a message
  const msg = u.message;
  if (!msg?.text || msg.chat?.type !== "private") return;
  const chat = String(msg.chat.id);
  const text = msg.text.trim();
  let [cmd, arg] = text.split(/\s+/);
  cmd = cmd.replace(/@\w+$/, "").toLowerCase();
  // links from the site: t.me/<bot>?start=watch_0x… and ?start=follow_1
  if (cmd === "/start" && /^watch_/.test(arg || "")) [cmd, arg] = ["/watch", arg.slice(6)];
  if (cmd === "/start" && /^follow_\d+$/.test(arg || "")) [cmd, arg] = ["/follow", arg.slice(7)];
  // a pasted token, wallet or launch number is a check
  if (looksLikeQuery(text)) [cmd, arg] = ["/check", text.replace(/^#/, "")];

  let view;
  if (cmd === "/check") view = arg ? await run(() => check(arg, chat, state)) : { text: "🔎 Send me a <b>token</b>, a <b>wallet</b> or a <b>launch number</b>.", markup: keyboard([[home]]) };
  else if (cmd === "/watch" || cmd === "/unwatch") {
    const reply = arg ? await watchCommand(cmd, arg, chat, state).catch(() => null) : null;
    const t = reply && tidy(reply);
    view = t ? { text: t.text, markup: keyboard([[btn("👁 Watchlist", "m:list"), ...(t.link ? [url("🔗 Full record", t.link)] : [])], [home]]) } : { text: "Send a token or wallet after the command, e.g. /watch 0x…", markup: keyboard([[home]]) };
  } else if (cmd === "/follow" || cmd === "/unfollow") view = { text: follow(chat, state, Number(arg), cmd === "/follow"), markup: pledgeMenu(chat, state).markup };
  else if (cmd === "/list") view = await run(() => watchlist(chat, state));
  else if (cmd === "/top") view = await run(top);
  else if (cmd === "/groups") view = await run(groups);
  else if (cmd === "/report") view = await run(report);
  else view = menu(channel);
  await send(msg.chat.id, view);
}
