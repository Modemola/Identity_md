import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { pt, WIN } from "./B";
import { INOUT, L, LE, OUT, scene, tw, useSeconds, wt } from "./kit";
import { Browser, Cam, cam, Cursor, focusAt, Glass, HEAD, LowerThird, Mark, Mesh, MONO, rise, SANS, SERIF, Stage3D, V, Verdict, Words } from "./mg";

// ---------------------------------------------------------------------------------- 7. live
const FEED = [
  { n: "$RUSH", src: "vibe/vibe", c: V.red, w: "Sells fast" },
  { n: "$LUNA", src: "IMD", c: V.green, w: "Never sold" },
  { n: "$BOLT", src: "vibe/vibe", c: V.grey, w: "First launch" },
  { n: "$KOI", src: "vibe/vibe", c: V.red, w: "Red money" },
  { n: "$PIXEL", src: "IMD", c: V.amber, w: "Has sold" },
  { n: "$ORBIT", src: "vibe/vibe", c: V.green, w: "Never sold" },
  { n: "$FROG", src: "vibe/vibe", c: V.red, w: "Sells fast" },
];

export const Live: React.FC = () => {
  const t = useSeconds();
  const sc = scene("live");
  const HOME = 2300;
  const vibe = wt("K18", "vibevibe");
  const imd = wt("K18", "IMD");
  const k19 = L("K19") - 0.3;
  const red = wt("K20", "Red");
  const alerts = wt("K20", "alerts");
  const views: Cam[] = [
    { t: sc.start, cx: 720, cy: 450, z: 1 },
    { t: vibe - 0.8, cx: 720, cy: 450, z: 1 },
    { t: vibe, cx: 900, cy: 200, z: 1.6 },
    { t: imd + 0.5, cx: 900, cy: 200, z: 1.6 },
    { t: imd + 1.3, cx: 720, cy: 860, z: 1.12 },
  ];
  const v = cam(t, views);
  const f = focusAt(t, [
    { t: vibe - 0.2, r: { x: 812, y: 14, w: 220, h: 45 } },
    { t: imd + 0.9, r: { x: 148, y: 789, w: 1144, h: 151 } },
    { t: k19 - 0.2, r: null },
  ]);
  const back = tw(t, k19 - 0.4, k19 + 0.6, 0, 1, INOUT);
  const sw = pt(views[2], 990, 36, HOME);
  return (
    <AbsoluteFill>
      <Mesh t={t} colors={["#00c2c7", "#2fd6a0", "#2f7cff", "#7ce0ff"]} base="#04262e" seed={13} />
      <Stage3D t={t} at={sc.start} x={-back * 420} y={WIN.y + back * 30} scale={WIN.scale * (1 - back * 0.22)} tilt={back * 5} style={{ opacity: 1 - back * 0.82, filter: back > 0.01 ? `blur(${back * 10}px)` : undefined }}>
        <Browser t={t} url="keptmd.vercel.app" shots={[{ at: sc.start, src: "home", h: HOME }]} view={v} focus={f} glow="#6ff3d6" />
      </Stage3D>
      <Cursor t={t} show={[vibe - 0.9, imd + 0.8]} keys={[{ t: vibe - 0.9, x: 1500, y: 700 }, { t: vibe - 0.1, x: sw.x, y: sw.y, click: true }, { t: imd, x: sw.x, y: sw.y, click: true }]} />
      <div style={{ position: "absolute", left: 1150, top: 150, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ ...rise(t, vibe - 0.1, k19 - 0.3, 20) }}>
          <Verdict color="#6ff3d6" text="Every vibe/vibe launch" size={26} />
        </div>
        <div style={{ ...rise(t, imd - 0.1, k19 - 0.3, 20) }}>
          <Verdict color="#ffd36e" text="Every IMD launch on Robinhood Chain" size={26} />
        </div>
      </div>
      {/* the live feed */}
      {t > k19 - 0.3 ? (
        <div style={{ position: "absolute", left: 1000, top: 140, ...rise(t, k19, undefined, 60) }}>
          <Glass style={{ width: 800, height: 760, overflow: "hidden", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "26px 32px", borderBottom: "1px solid rgba(15,13,26,0.08)" }}>
              <span style={{ width: 12, height: 12, borderRadius: 6, background: V.red, boxShadow: `0 0 14px ${V.red}`, opacity: 0.5 + 0.5 * Math.sin(t * 6) }} />
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 24, letterSpacing: "0.12em", color: V.ink }}>LIVE</span>
              <span style={{ fontFamily: SANS, fontSize: 22, color: "#77727f", marginLeft: "auto" }}>checked as they land</span>
            </div>
            {FEED.map((r, i) => {
              const at = wt("K19", "Every") - 0.6 + (FEED.length - 1 - i) * 0.42;
              const p = tw(t, at, at + 0.6, 0, 1, OUT);
              const n = FEED.filter((_, k) => t >= wt("K19", "Every") - 0.6 + (FEED.length - 1 - k) * 0.42).length;
              const slot = FEED.length - 1 - i - (FEED.length - n);
              const isRed = r.c === V.red;
              const glow = isRed ? tw(t, red - 0.1 + (i % 3) * 0.12, red + 0.4 + (i % 3) * 0.12) : 0;
              if (p <= 0) return null;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: 16,
                    right: 16,
                    top: 96 + slot * 94,
                    height: 82,
                    borderRadius: 18,
                    display: "flex",
                    alignItems: "center",
                    gap: 20,
                    padding: "0 20px",
                    opacity: p,
                    filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined,
                    transform: `translateY(${(1 - p) * -30}px)`,
                    background: glow > 0 ? `rgba(239,59,79,${0.1 * glow})` : "transparent",
                    boxShadow: glow > 0 ? `inset 0 0 0 1.5px rgba(239,59,79,${0.5 * glow})` : undefined,
                  }}
                >
                  <div style={{ width: 46, height: 46, borderRadius: 23, background: `linear-gradient(135deg, ${["#ffb36b", "#7ce0ff", "#a47bff", "#ff8fc7", "#ffd36e", "#6ff3d6", "#ff7b8c"][i]}, #ffffff)` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 26, color: V.ink }}>{r.n}</div>
                    <div style={{ fontFamily: SANS, fontSize: 18, color: "#77727f" }}>{r.src} · just now</div>
                  </div>
                  <Verdict color={r.c} text={r.w} size={20} />
                </div>
              );
            })}
          </Glass>
        </div>
      ) : null}
      {/* the alerts channel */}
      <div style={{ position: "absolute", left: 120, top: 120, ...rise(t, alerts - 0.2, sc.end - 0.5, -30) }}>
        <Glass r={30} style={{ width: 620, padding: "20px 24px", display: "flex", gap: 18, alignItems: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
            <Mark size={52} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: 20, color: "#77727f" }}>
              <span style={{ fontWeight: 700, color: V.ink }}>KEPT Alerts</span>
              <span>now</span>
            </div>
            <div style={{ fontFamily: SANS, fontSize: 22, color: V.ink, marginTop: 4 }}>Red launcher just launched $RUSH on vibe/vibe</div>
          </div>
        </Glass>
      </div>
      <div style={{ position: "absolute", left: 120, top: 300, width: 760 }}>
        <Words text="Every new launch, / checked the moment / it *lands.*" t={t} at={wt("K19", "Every") - 0.2} out={red - 0.4} size={76} color="#fff" accent="#b9fff0" align="left" />
      </div>
      <div style={{ position: "absolute", left: 120, top: 330, width: 760 }}>
        <Words text="Red lights up / the *feed.*" t={t} at={red - 0.15} out={sc.end - 0.5} size={76} color="#fff" accent="#ffb3bd" align="left" />
      </div>
      <LowerThird t={t} at={sc.start + 0.8} out={k19 - 0.2} n={4} title="Checked as they *land*" sub="Every vibe/vibe launch, and every IMD launch on Robinhood Chain." />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------- 8. telegram
export const Telegram: React.FC = () => {
  const t = useSeconds();
  const sc = scene("telegram");
  const paste = wt("K21", "paste");
  const rec = wt("K21", "record");
  const watch = wt("K21", "Watch");
  const sell = wt("K21", "sell");
  const PW = 440;
  const k = (PW - 28) / 1179;
  const SH = 2556 * k;
  // spots on the screenshot (in its own pixels)
  const spots = [
    { at: paste - 0.1, r: { x: 846, y: 581, w: 310, h: 100 } },
    { at: rec - 0.2, r: { x: 28, y: 700, w: 1024, h: 1340 } },
    { at: watch - 0.25, r: { x: 28, y: 2053, w: 510, h: 120 } },
  ];
  let cur = -1;
  spots.forEach((s, i) => t >= s.at && (cur = i));
  const dim = cur < 0 ? 0 : tw(t, spots[cur].at, spots[cur].at + 0.4) * (1 - tw(t, sell - 0.4, sell));
  const r = cur >= 0 ? spots[cur].r : spots[0].r;
  const push = tw(t, sc.start, sc.end, 0, 1, (x) => x);
  const screenTop = 540 + 20 - (SH + 28) / 2 + 14;
  const tap = { x: 960 + 260 - PW / 2 + 14 + 282 * k, y: screenTop + 2112 * k };
  return (
    <AbsoluteFill>
      <Mesh t={t} colors={["#2aa3ef", "#6a8cff", "#36d1dc", "#9bd8ff"]} base="#06243f" seed={15} />
      <div style={{ position: "absolute", left: 140, top: 230, width: 820 }}>
        <Words text="On *Telegram.*" t={t} at={L("K21") - 0.15} out={paste - 0.3} size={110} color="#fff" accent="#d4ecff" align="left" />
      </div>
      <div style={{ position: "absolute", left: 140, top: 230, width: 820 }}>
        <Words text="Paste a token. / Get the *record.*" t={t} at={paste - 0.15} out={watch - 0.35} size={100} color="#fff" accent="#d4ecff" align="left" />
      </div>
      <div style={{ position: "absolute", left: 140, top: 230, width: 820 }}>
        <Words text="Tap *Watch.* / Know when / they *sell.*" t={t} at={watch - 0.15} size={100} color="#fff" accent="#d4ecff" align="left" stagger={0.12} />
      </div>
      <div style={{ position: "absolute", left: 140, top: 820, ...rise(t, rec, undefined, 20) }}>
        <Glass dark r={999} style={{ padding: "14px 26px", fontFamily: MONO, fontSize: 26, color: "#fff" }}>t.me/kept_alerts_bot</Glass>
      </div>
      <Stage3D t={t} at={sc.start + 0.1} x={260} y={20} scale={1 + push * 0.04} tilt={-2}>
        <div style={{ width: PW, height: SH + 28, borderRadius: 70, background: "linear-gradient(145deg,#3a3d47,#15161b)", padding: 14, boxSizing: "border-box", boxShadow: "0 60px 120px rgba(0,10,40,0.5), inset 0 0 0 2px rgba(255,255,255,0.12)" }}>
          <div style={{ position: "relative", width: PW - 28, height: SH, borderRadius: 56, overflow: "hidden", background: "#000" }}>
            <Img src={staticFile("kept2/bot.jpg")} style={{ width: PW - 28, height: SH }} />
            {dim > 0 ? (
              <>
                <AbsoluteFill style={{ background: `rgba(0,0,0,${0.55 * dim})`, clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${r.y * k}px, ${r.x * k}px ${r.y * k}px, ${r.x * k}px ${(r.y + r.h) * k}px, ${(r.x + r.w) * k}px ${(r.y + r.h) * k}px, ${(r.x + r.w) * k}px ${r.y * k}px, 0 ${r.y * k}px)` }} />
                <div style={{ position: "absolute", left: r.x * k - 4, top: r.y * k - 4, width: r.w * k + 8, height: r.h * k + 8, borderRadius: 16, border: "2px solid #8fd0ff", boxShadow: "0 0 30px rgba(143,208,255,0.6)", opacity: dim }} />
              </>
            ) : null}
            {/* the sell alert drops in */}
            <div style={{ position: "absolute", left: 10, right: 10, top: 12 + (1 - tw(t, sell - 0.2, sell + 0.5, 0, 1, OUT)) * -140 }}>
              <div style={{ background: "rgba(245,245,250,0.92)", borderRadius: 22, padding: "12px 14px", display: "flex", gap: 10, alignItems: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Mark size={32} />
                </div>
                <div style={{ flex: 1, fontFamily: SANS }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b6676" }}>
                    <b style={{ color: V.ink }}>kept_alerts_bot</b>
                    <span>now</span>
                  </div>
                  <div style={{ fontSize: 14, color: V.ink, marginTop: 2 }}>
                    <span style={{ color: V.red }}>●</span> The $GPRO launcher just sold
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Stage3D>
      <Cursor t={t} show={[watch - 0.9, watch + 0.9]} keys={[{ t: watch - 0.9, x: 1500, y: 1000 }, { t: watch - 0.05, x: tap.x, y: tap.y, click: true }]} />
      <LowerThird t={t} at={sc.start + 0.6} out={sc.end - 0.2} n={5} title="The record, in your *pocket*" sub="The KEPT bot on Telegram. Free." />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------- 9. launchpads
export const Launchpads: React.FC = () => {
  const t = useSeconds();
  const sc = scene("launchpads");
  const INT = 2400;
  const badge = wt("K22", "badge");
  const share = wt("K22", "share");
  const api = wt("K22", "API");
  const views: Cam[] = [
    { t: sc.start, cx: 720, cy: 440, z: 1 },
    { t: badge - 0.9, cx: 720, cy: 460, z: 1.02 },
    { t: badge - 0.1, cx: 720, cy: 1030, z: 1.18 },
    { t: api - 0.8, cx: 720, cy: 1030, z: 1.18 },
    { t: api, cx: 720, cy: 1920, z: 1.22 },
  ];
  const v = cam(t, views);
  const f = focusAt(t, [
    { t: badge - 0.1, r: { x: 148, y: 820, w: 1144, h: 411 } },
    { t: api - 0.1, r: { x: 148, y: 1797, w: 1144, h: 241 } },
  ]);
  return (
    <AbsoluteFill>
      <Mesh t={t} colors={["#2ee6a8", "#b8f03c", "#12b886", "#6ee7ff"]} base="#06301f" seed={17} />
      <Stage3D t={t} at={sc.start} y={WIN.y} scale={WIN.scale}>
        <Browser t={t} url="keptmd.vercel.app/integrate" shots={[{ at: sc.start, src: "integrate", h: INT }]} view={v} focus={f} glow="#9dffcf" />
      </Stage3D>
      <div style={{ position: "absolute", left: 1270, top: 130, display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
        {[
          ["A free badge", badge],
          ["A share card", share],
          ["An open API, no key", api],
        ].map(([w, at], i) => (
          <div key={i} style={{ ...rise(t, (at as number) - 0.15, sc.end - 0.5, 20) }}>
            <Verdict color="#2ee6a8" text={w as string} size={26} />
          </div>
        ))}
      </div>
      <LowerThird t={t} at={sc.start + 0.6} out={sc.end - 0.2} n={6} title="Right where people *buy*" sub="Launchpads show the record on every launch page." />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------- 10. promises
export const Promises: React.FC = () => {
  const t = useSeconds();
  const sc = scene("promises");
  const PL = 1600;
  const lock = wt("K24", "Lock");
  const swarm = wt("K24", "swarm");
  const kept = wt("K25", "Kept");
  const missed = wt("K25", "Missed");
  const ours = wt("K25", "Even");
  const app = lock - 0.7;
  const views: Cam[] = [
    { t: app, cx: 720, cy: 420, z: 1 },
    { t: lock + 0.2, cx: 720, cy: 420, z: 1.08 },
    { t: swarm - 0.6, cx: 720, cy: 420, z: 1.08 },
    { t: swarm + 0.3, cx: 720, cy: 880, z: 1.12 },
    { t: kept - 0.5, cx: 720, cy: 880, z: 1.12 },
    { t: kept + 0.2, cx: 1000, cy: 870, z: 1.7 },
  ];
  const v = cam(t, views);
  const f = focusAt(t, [
    { t: lock, r: { x: 148, y: 376, w: 1144, h: 101 } },
    { t: swarm - 0.1, r: { x: 160, y: 720, w: 1130, h: 330 } },
    { t: kept - 0.1, r: { x: 1118, y: 828, w: 162, h: 92 } },
  ]);
  const away = tw(t, missed - 0.35, missed + 0.3, 0, 1, INOUT);
  const end = tw(t, ours - 0.3, ours + 0.4, 0, 1, INOUT);
  return (
    <AbsoluteFill>
      <Mesh t={t} colors={["#6a3cff", "#ff6fb5", "#ffb020", "#9b5cff"]} base="#170b33" seed={19} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 400 }}>
        <Words text="For teams with / *nothing to hide.*" t={t} at={wt("K23", "teams") - 0.3} out={app - 0.2} size={110} color="#fff" accent="#ffd36e" />
      </div>
      {t > app - 0.2 ? (
        <Stage3D t={t} at={app} out={missed - 0.35} y={WIN.y} scale={WIN.scale}>
          <Browser t={t} url="keptmd.vercel.app/pledge/1" shots={[{ at: app, src: "pledge", h: PL }]} view={v} focus={f} glow={t > kept - 0.2 ? V.green : "#ffd36e"} />
        </Stage3D>
      ) : null}
      {/* kept: unlock. missed: burn. */}
      {t > missed - 0.5 ? (
        <AbsoluteFill style={{ opacity: 1 - end * 0.85, filter: end > 0.01 ? `blur(${end * 12}px)` : undefined }}>
          <div style={{ position: "absolute", left: 300, top: 330, ...rise(t, missed - 0.3, undefined, 40) }}>
            <Glass style={{ width: 600, padding: "40px 44px" }}>
              <Verdict color={V.green} text="Kept" size={26} />
              <div style={{ fontFamily: SERIF, fontSize: 76, lineHeight: 1.05, color: V.ink, marginTop: 22 }}>
                The tokens <i style={{ color: V.green }}>unlock.</i>
              </div>
            </Glass>
          </div>
          <div style={{ position: "absolute", left: 1020, top: 330, ...rise(t, missed, undefined, 40) }}>
            <Glass dark style={{ width: 600, padding: "40px 44px", background: `linear-gradient(160deg, rgba(40,8,16,0.75), rgba(239,59,79,${0.25 + 0.1 * Math.sin(t * 7)}))` }}>
              <Verdict color={V.red} text="Missed" size={26} dark />
              <div style={{ fontFamily: SERIF, fontSize: 76, lineHeight: 1.05, color: "#fff", marginTop: 22 }}>
                They <i style={{ color: "#ff8a8a" }}>burn.</i>
              </div>
            </Glass>
          </div>
        </AbsoluteFill>
      ) : null}
      <div style={{ position: "absolute", left: 0, right: 0, top: 420 }}>
        <Words text="Even *ours.*" t={t} at={ours - 0.05} out={sc.end - 0.45} size={200} color="#fff" accent="#ffd36e" stagger={0.2} />
      </div>
      <LowerThird t={t} at={app + 0.6} out={missed - 0.35} n={7} title="Promises with *teeth*" sub="Tokens locked behind public milestones. The IMD swarm checks each one." />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------- 11. end
export const End: React.FC = () => {
  const t = useSeconds();
  const sc = scene("end");
  const k27 = L("K27");
  const logo = k27 - 0.5;
  const lp = tw(t, logo, logo + 0.9, 0, 1, OUT);
  const bloom = tw(t, logo - 0.3, logo + 2.5, 0, 1, OUT);
  return (
    <AbsoluteFill style={{ background: "#fff" }}>
      <AbsoluteFill style={{ opacity: 0.55 + bloom * 0.45 }}>
        <Mesh t={t} colors={["#ffd1b3", "#d9ccff", "#c4f5e4", "#ffd0e6"]} base="#ffffff" seed={21} grain={0.04} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 400 }}>
        <Words text="Facts from the chain. / *Never accusations.*" t={t} at={L("K26") - 0.1} out={logo - 0.5} size={100} color={V.ink} accent="#7b5cff" />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, display: "flex", justifyContent: "center", alignItems: "center", gap: 36, opacity: lp, filter: lp < 1 ? `blur(${(1 - lp) * 16}px)` : undefined, transform: `scale(${0.94 + 0.06 * lp})` }}>
        <Mark size={150} draw={tw(t, logo + 0.2, logo + 0.9, 0, 1, OUT)} />
        <div style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 136, letterSpacing: "0.16em", color: V.ink, fontStretch: "110%" }}>KEPT</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 560 }}>
        <Words text="Check before you *buy.*" t={t} at={wt("K27", "Check") - 0.05} size={84} color={V.ink} accent="#7b5cff" stagger={0.1} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 740, display: "flex", justifyContent: "center", gap: 18, ...rise(t, LE("K27") + 0.4, undefined, 16) }}>
        <Glass r={999} style={{ padding: "14px 28px", fontFamily: MONO, fontSize: 26, color: V.ink }}>keptmd.vercel.app</Glass>
        <Glass r={999} style={{ padding: "14px 28px", fontFamily: MONO, fontSize: 26, color: V.ink }}>t.me/kept_alerts_bot</Glass>
      </div>
      <AbsoluteFill style={{ background: "#fff", opacity: tw(t, sc.end - 0.7, sc.end) }} />
    </AbsoluteFill>
  );
};
