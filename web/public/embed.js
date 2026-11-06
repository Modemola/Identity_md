/* KEPT embed: shows a team's live promise record from one tag.
 *
 *   <script src="https://keptmd.vercel.app/embed.js" data-token="0x…" async></script>
 *
 * Use data-token (a project's token), data-team (its beneficiary address) or data-pledge (a pledge
 * number). Optional: data-theme="light" or "dark" (default: the viewer's system setting) and
 * data-width (default 380). The card is an iframe, so it never touches the host page's styles.
 */
(function () {
  var ORIGIN = "https://keptmd.vercel.app";
  var scripts = document.querySelectorAll('script[src$="/embed.js"]:not([data-kept-done])');
  for (var i = 0; i < scripts.length; i++) {
    var s = scripts[i];
    s.setAttribute("data-kept-done", "");
    var q = [];
    var token = s.getAttribute("data-token");
    var team = s.getAttribute("data-team");
    var pledge = s.getAttribute("data-pledge");
    if (token) q.push("token=" + encodeURIComponent(token));
    else if (team) q.push("team=" + encodeURIComponent(team));
    else if (pledge) q.push("pledge=" + encodeURIComponent(pledge));
    var theme = s.getAttribute("data-theme");
    if (theme) q.push("theme=" + encodeURIComponent(theme));
    var width = parseInt(s.getAttribute("data-width") || "380", 10) || 380;
    var f = document.createElement("iframe");
    f.src = ORIGIN + "/api/embed?" + q.join("&");
    f.title = "KEPT promise record";
    f.loading = "lazy";
    f.width = String(width);
    f.height = "128";
    f.style.cssText = "border:0;max-width:100%;width:" + width + "px;height:128px;display:block;color-scheme:normal";
    f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    f.setAttribute("sandbox", "allow-popups allow-popups-to-escape-sandbox");
    s.parentNode.insertBefore(f, s.nextSibling);
  }
})();
