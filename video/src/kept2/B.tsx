import React from "react";
import { AbsoluteFill } from "remotion";
import { INOUT, L, LE, OUT, scene, tw, useSeconds, wt } from "./kit";
import { Browser, Cam, cam, Cursor, focusAt, Glass, Kicker, LowerThird, Mesh, MONO, rise, SANS, SERIF, Stage3D, V, Verdict, Words } from "./mg";

const W = 1560;
const H = 900;
/// Where a page point lands on the stage for a given camera (the window sits centred, unscaled).
export function pt(v: Cam, x: number, y: number, shotH: number) {
  const VW = W;
  const VH = H - 48;
  const s = (v.z * VW) / 1440;
  const py = Math.max(0, Math.min(shotH - VH / s, v.cy - VH / (2 * s)));
  const px = v.cx - VW / (2 * s);
  const sx = (1920 - W) / 2 + (x - px) * s;
  const sy = (1080 - H) / 2 + 48 + (y - py) * s;
  return { x: 960 + (sx - 960) * WIN.scale, y: 540 + (sy - 540) * WIN.scale + WIN.y };
}
/// Every app window sits a little small and high, so the lower third has room.
export const WIN = { scale: 0.86, y: -42 };

const Num: React.FC<{ t: number; at: number; out?: number; big: string; small: string; color?: string; x: number; y: number }> = ({ t, at, out, big, small, color = V.ink, x, y }) => (
  <div style={{ position: "absolute", left: x, top: y, ...rise(t, at, out, 30) }}>
    <Glass style={{ padding: "22px 34px 24px" }}>
      <div style={{ fontFamily: SERIF, fontSize: 112, lineHeight: 1, color }}>{big}</div>
      <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 500, color: "#55505f", marginTop: 6 }}>{small}</div>
    </Glass>
  </div>
);

// ---------------------------------------------------------------------------------- 4. record
export const Record: React.FC = () => {
  const t = useSeconds();
  const sc = scene("record");
  const typeAt = wt("K7", "launch") - 0.3;
  const go = LE("K7") + 0.25;
  const swap = go + 0.35;
  const every = wt("K8", "Every");
  const fast = wt("K8", "fast");
  const k9 = L("K9") - 0.3;
  const k10 = L("K10") - 0.4;
  const HOME = 2300;
  const REC = 1300;
  const views: Cam[] = [
    { t: sc.start, cx: 720, cy: 450, z: 1 },
    { t: sc.start + 1.2, cx: 720, cy: 450, z: 1 },
    { t: typeAt - 0.4, cx: 560, cy: 560, z: 1.3 },
    { t: swap - 0.01, cx: 560, cy: 560, z: 1.3 },
    { t: swap, cx: 720, cy: 440, z: 1 },
    { t: L("K8") + 0.2, cx: 720, cy: 470, z: 1.08 },
    { t: every - 0.4, cx: 720, cy: 470, z: 1.08 },
    { t: every + 0.4, cx: 720, cy: 590, z: 1.38 },
    { t: fast - 0.3, cx: 720, cy: 600, z: 1.38 },
    { t: fast + 0.4, cx: 720, cy: 680, z: 1.38 },
    { t: k10, cx: 720, cy: 680, z: 1.38 },
    { t: k10 + 0.9, cx: 560, cy: 980, z: 1.3 },
  ];
  const v = cam(t, views);
  const shotH = t >= swap ? REC : HOME;
  const f = focusAt(t, [
    { t: typeAt - 0.5, r: { x: 148, y: 622, w: 661, h: 78 } },
    { t: swap - 0.2, r: null },
    { t: L("K8") + 0.3, r: { x: 148, y: 183, w: 1144, h: 629 } },
    { t: every - 0.2, r: { x: 170, y: 520, w: 1100, h: 125 } },
    { t: fast - 0.1, r: { x: 170, y: 652, w: 1100, h: 70 } },
    { t: k9 - 0.2, r: null },
    { t: k10 + 0.7, r: { x: 150, y: 1010, w: 380, h: 62 } },
  ]);
  const typed = "2288".slice(0, Math.max(0, Math.min(4, Math.floor((t - typeAt) / 0.13))));
  const input = pt(views[3], 440, 661, HOME);
  const button = pt(views[3], 770, 661, HOME);
  const back = tw(t, k9 - 0.3, k9 + 0.5, 0, 1, INOUT) * (1 - tw(t, k10 - 0.2, k10 + 0.6, 0, 1, INOUT));
  const chips = [
    { w: "Red", c: V.red, s: "Sells fast" },
    { w: "Amber", c: V.amber, s: "Has sold" },
    { w: "Green", c: V.green, s: "Never sold" },
    { w: "Grey", c: V.grey, s: "First launch" },
  ];
  return (
    <AbsoluteFill>
      <Mesh t={t} colors={["#2f6bff", "#7a5cff", "#1fd1f9", "#a47bff"]} base="#0d1240" seed={7} />
      <Stage3D t={t} at={sc.start} x={-back * 300} y={WIN.y} scale={WIN.scale * (1 - back * 0.25)} tilt={back * 4}>
        <Browser
          t={t}
          url={t < swap ? "keptmd.vercel.app" : "keptmd.vercel.app/check/2288"}
          shots={[
            { at: sc.start, src: "home", h: HOME },
            { at: swap, src: "rec-red", h: REC },
          ]}
          view={v}
          focus={f}
          glow={t < swap ? "#7aa2ff" : V.red}
          overlay={(s, px, py) =>
            t < swap && t > typeAt - 0.05 ? (
              <div style={{ position: "absolute", left: (210 - px) * s, top: (636 - py) * s, width: 440 * s, height: 50 * s, background: "#fff", display: "flex", alignItems: "center", fontFamily: SANS, fontSize: 19 * s, color: V.ink }}>
                {typed}
                <span style={{ width: 2 * s, height: 24 * s, background: V.ink, marginLeft: 2, opacity: Math.floor(t * 3) % 2 ? 1 : 0.15 }} />
              </div>
            ) : null
          }
        />
      </Stage3D>
      <Cursor
        t={t}
        show={[sc.start + 1.0, swap + 0.4]}
        keys={[
          { t: sc.start + 1.0, x: 1300, y: 900 },
          { t: typeAt - 0.35, x: input.x, y: input.y, click: true },
          { t: go - 0.35, x: button.x, y: button.y },
          { t: go, x: button.x, y: button.y, click: true },
        ]}
      />
      {/* the four colours */}
      {chips.map((c, i) => {
        const at = wt("K9", c.w) - 0.15;
        return (
          <div key={i} style={{ position: "absolute", left: 1190, top: 250 + i * 150, ...rise(t, at, k10 - 0.2, 30) }}>
            <Glass dark style={{ width: 560, padding: "22px 30px", display: "flex", alignItems: "center", gap: 24 }}>
              <div style={{ width: 58, height: 58, borderRadius: 29, background: c.c, boxShadow: `0 0 40px ${c.c}` }} />
              <div>
                <div style={{ fontFamily: SERIF, fontSize: 52, lineHeight: 1, color: "#fff" }}>{c.w}</div>
                <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 500, color: "rgba(255,255,255,0.72)", marginTop: 4 }}>{c.s}</div>
              </div>
            </Glass>
          </div>
        );
      })}
      {/* 63 seconds, 98% */}
      <Num t={t} at={wt("K10", "63") - 0.1} out={sc.end - 0.6} big="63 s" small="from launch to its first sell" x={1220} y={180} />
      <Num t={t} at={wt("K10", "98%") - 0.1} out={sc.end - 0.6} big="98%" small="of its share sold into the pool" color={V.red} x={1220} y={420} />
      <LowerThird t={t} at={sc.start + 1.4} out={sc.end - 0.2} n={1} title="Check *any* launcher" sub="Paste a token, a wallet or a launch number." />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------- 5. money
export const Money: React.FC = () => {
  const t = useSeconds();
  const sc = scene("money");
  const app = L("K13") - 0.7;
  const AMB = 1950;
  const never = wt("K14", "never");
  const eight = wt("K14", "8");
  const six = wt("K14", "6");
  const k15 = L("K15");
  const amber = wt("K15", "amber");
  const MAP = { cx: 720, cy: 1576, z: 1.05 };
  const views: Cam[] = [
    { t: app, ...MAP, z: 0.98 },
    { t: app + 1.2, ...MAP },
    { t: never - 0.5, ...MAP },
    { t: never + 0.3, cx: 720, cy: 650, z: 1.34 },
    { t: eight - 0.6, cx: 720, cy: 650, z: 1.34 },
    { t: eight + 0.2, ...MAP },
    { t: k15 - 0.2, ...MAP },
    { t: k15 + 0.7, cx: 520, cy: 470, z: 1.5 },
  ];
  const v = cam(t, views);
  const f = focusAt(t, [
    { t: wt("K13", "money") - 0.2, r: { x: 149, y: 1300, w: 1142, h: 560 } },
    { t: never - 0.3, r: { x: 170, y: 595, w: 1100, h: 130 } },
    { t: eight - 0.3, r: { x: 149, y: 1300, w: 1142, h: 560 } },
    { t: k15 + 0.1, r: { x: 175, y: 290, w: 650, h: 300 } },
  ]);
  const node = pt(v, 626, 1645, AMB);
  const intro = 1 - tw(t, app - 0.4, app + 0.4, 0, 1, INOUT);
  const fund = L("K12") + 0.5;
  return (
    <AbsoluteFill>
      <Mesh t={t} colors={["#ff4fa3", "#ff8a4c", "#a64cff", "#ff5e7e"]} base="#2a0b25" seed={9} />
      {/* a fresh wallet: clean, and it still needs money */}
      {intro > 0.01 ? (
        <AbsoluteFill style={{ opacity: intro, filter: intro < 1 ? `blur(${(1 - intro) * 16}px)` : undefined }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 150 }}>
            <Words text="A fresh wallet. *Clean* record." t={t} at={wt("K11", "fresh") - 0.2} out={L("K12") - 0.4} size={92} color="#fff" accent="#ffd0ea" />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 150 }}>
            <Words text="It still needs *money.*" t={t} at={wt("K12", "needs") - 0.2} size={92} color="#fff" accent="#ffd0ea" />
          </div>
          {/* the money arriving from somewhere above */}
          <svg width={1920} height={1080} style={{ position: "absolute" }}>
            <defs>
              <linearGradient id="mline" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fff" stopOpacity={0} />
                <stop offset="100%" stopColor="#fff" stopOpacity={0.9} />
              </linearGradient>
            </defs>
            <path d="M 960 -20 L 960 420" stroke="url(#mline)" strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - tw(t, fund, fund + 0.9, 0, 1, OUT)} />
            {t > fund ? <circle cx={960} cy={-20 + ((t - fund) * 340) % 440} r={9} fill="#fff" opacity={0.9} /> : null}
          </svg>
          <div style={{ position: "absolute", left: 660, top: 420, ...rise(t, wt("K11", "fresh") - 0.1, undefined, 50) }}>
            <Glass style={{ width: 600, padding: "34px 40px", boxSizing: "border-box" }}>
              <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 600, letterSpacing: "0.14em", color: "#8a8594" }}>LAUNCHER</div>
              <div style={{ fontFamily: MONO, fontSize: 36, color: V.ink, marginTop: 6 }}>0xdce3…7036</div>
              <div style={{ display: "flex", gap: 40, marginTop: 30 }}>
                {[
                  ["0", "launches", wt("K11", "Clean")],
                  ["0", "sells", wt("K11", "record")],
                  ["none", "history", wt("K11", "history")],
                ].map(([a, b, at], i) => (
                  <div key={i} style={{ ...rise(t, (at as number) - 0.1, undefined, 16) }}>
                    <div style={{ fontFamily: SERIF, fontSize: 64, lineHeight: 1, color: V.ink }}>{a}</div>
                    <div style={{ fontFamily: SANS, fontSize: 20, color: "#6b6676", marginTop: 4 }}>{b}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 26, ...rise(t, wt("K11", "Clean") - 0.1, undefined, 10) }}>
                <Verdict color={V.green} text="Looks clean" size={22} />
              </div>
            </Glass>
          </div>
        </AbsoluteFill>
      ) : null}
      {t > app - 0.2 ? (
        <Stage3D t={t} at={app - 0.2} y={WIN.y} scale={WIN.scale}>
          <Browser
            t={t}
            url="keptmd.vercel.app/check/0xdce3…7036"
            shots={[{ at: app, src: "rec-amber", h: AMB }]}
            view={v}
            focus={f}
            glow={t > k15 ? V.amber : "#ff8fc7"}
            overlay={(s, px, py) => (
              <div style={{ position: "absolute", left: (626 - px) * s - 34 * s, top: (1645 - py) * s - 34 * s, width: 68 * s, height: 68 * s, borderRadius: "50%", border: `${2.5 * s}px solid ${V.ink}`, opacity: tw(t, wt("K13", "follows"), wt("K13", "follows") + 0.4) * (0.5 + 0.5 * Math.sin(t * 5)), transform: `scale(${1 + 0.12 * Math.sin(t * 5)})` }} />
            )}
          />
        </Stage3D>
      ) : null}
      {/* what the map says */}
      <div style={{ position: "absolute", left: 1290, top: 140, ...rise(t, wt("K13", "Two") - 0.1, never - 0.4, 20) }}>
        <Glass r={999} style={{ padding: "14px 26px", fontFamily: SANS, fontSize: 24, fontWeight: 600, color: V.ink }}>Traced two wallets back</Glass>
      </div>
      <div style={{ position: "absolute", left: 1290, top: 140, ...rise(t, never - 0.1, eight - 0.4, 20) }}>
        <Verdict color={V.green} text="This wallet never sold" size={24} />
      </div>
      <div style={{ position: "absolute", left: 1290, top: 140, ...rise(t, eight - 0.1, k15 - 0.3, 20) }}>
        <Verdict color="#8a8594" text="Same money as 8 other launchers" size={24} />
      </div>
      <div style={{ position: "absolute", left: 1290, top: 210, ...rise(t, six - 0.1, k15 - 0.3, 20) }}>
        <Verdict color={V.red} text="6 of them sell fast" size={24} />
      </div>
      <div style={{ position: "absolute", left: 1160, top: 140, ...rise(t, amber - 0.15, sc.end - 0.6, 20) }}>
        <Verdict color={V.amber} text="Amber, from its first launch" size={28} />
      </div>
      <LowerThird t={t} at={app + 0.4} out={sc.end - 0.2} n={2} title="Follow the *money*" sub="A fresh wallet is traced two funders back." />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------- 6. groups
export const Groups: React.FC = () => {
  const t = useSeconds();
  const sc = scene("groups");
  const GR = 1500;
  const one = wt("K16", "One");
  const five = wt("K16", "5");
  const exits = wt("K16", "139");
  const fair = L("K17");
  const views: Cam[] = [
    { t: sc.start, cx: 720, cy: 440, z: 1 },
    { t: one - 0.6, cx: 720, cy: 460, z: 1.02 },
    { t: one + 0.4, cx: 720, cy: 1100, z: 1.3 },
  ];
  const v = cam(t, views);
  const f = focusAt(t, [{ t: one + 0.1, r: { x: 149, y: 1071, w: 1142, h: 59 } }]);
  const q = wt("K17", "quarter");
  const ring = tw(t, q - 0.2, q + 0.9, 0, 1, OUT);
  return (
    <AbsoluteFill>
      <Mesh t={t} colors={["#ff8a2a", "#ffcf3f", "#ff5d5d", "#ffb020"]} base="#3a1306" seed={11} />
      <Stage3D t={t} at={sc.start} out={fair - 0.4} y={WIN.y} scale={WIN.scale}>
        <Browser t={t} url="keptmd.vercel.app/groups" shots={[{ at: sc.start, src: "groups", h: GR }]} view={v} focus={f} glow={V.red} />
      </Stage3D>
      <div style={{ position: "absolute", left: 1150, top: 170, display: "flex", gap: 22 }}>
        <div style={{ ...rise(t, five - 0.1, fair - 0.4, 24) }}>
          <Glass style={{ padding: "18px 30px" }}>
            <div style={{ fontFamily: SERIF, fontSize: 96, lineHeight: 1, color: V.ink }}>5</div>
            <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 500, color: "#55505f" }}>launchers, one source</div>
          </Glass>
        </div>
        <div style={{ ...rise(t, exits - 0.1, fair - 0.4, 24) }}>
          <Glass style={{ padding: "18px 30px" }}>
            <div style={{ fontFamily: SERIF, fontSize: 96, lineHeight: 1, color: V.red }}>139</div>
            <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 500, color: "#55505f" }}>fast exits</div>
          </Glass>
        </div>
      </div>
      {/* the fairness rule */}
      {t > fair - 0.5 ? (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 130 }}>
            <Words text="And it's *fair.*" t={t} at={wt("K17", "fair") - 0.25} size={96} color="#fff" accent="#fff3c4" />
          </div>
          <svg width={1920} height={1080} style={{ position: "absolute", ...rise(t, fair + 0.2, undefined, 40) }}>
            <g transform="translate(960 560) rotate(-90)">
              <circle r={190} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={34} />
              <circle r={190} fill="none" stroke={V.red} strokeWidth={34} strokeLinecap="round" pathLength={100} strokeDasharray={`${25 * ring} 100`} style={{ filter: `drop-shadow(0 0 18px ${V.red})` }} />
            </g>
            <text x={960} y={590} textAnchor="middle" fontFamily={SERIF} fontSize={110} fill="#fff" opacity={ring}>
              25%
            </text>
          </svg>
          <div style={{ position: "absolute", left: 0, right: 0, top: 820 }}>
            <Words text="A group counts against you only when / *a quarter or more* of it is red." t={t} at={q - 0.2} size={50} color="#fff" accent="#ffe08a" stagger={0.05} />
          </div>
        </>
      ) : null}
      <LowerThird t={t} at={sc.start + 0.8} out={fair - 0.4} n={3} title="One source, *many* launchers" sub="Launchers tied by the same money, ranked by fast exits." />
    </AbsoluteFill>
  );
};
