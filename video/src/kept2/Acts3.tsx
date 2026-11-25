import React from "react";
import { AbsoluteFill } from "remotion";
import { Agent, Blob, CastDefs, Coin, Confetti, Fire, Padlock, Sparkle } from "../explainer/cast";
import { Logo } from "./Acts1";
import { Stamp } from "./Acts2";
import { Card, Chip, Field, FONT, INOUT, L, LE, OUT, P, Title, enter, pop, rnd, scene, tw, useSeconds, wt } from "./kit";

// ---------------------------------------------------------------------------------- 7. live
const FEED = [
  { n: "$FROG", src: "vibe/vibe", tone: P.red, w: "sells fast" },
  { n: "$LUNA", src: "IMD", tone: P.green, w: "never sold" },
  { n: "$BOLT", src: "vibe/vibe", tone: P.grey, w: "first launch" },
  { n: "$KOI", src: "vibe/vibe", tone: P.red, w: "red money" },
  { n: "$PIXEL", src: "IMD", tone: P.amber, w: "has sold" },
  { n: "$RUSH", src: "vibe/vibe", tone: P.red, w: "sells fast" },
];

export const Live: React.FC = () => {
  const t = useSeconds();
  const sc = scene("live");
  const covers = wt("K18", "covers");
  const imd = wt("K18", "IMD");
  const watch = L("K19") - 0.2;
  const feedIn = tw(t, watch - 0.4, watch + 0.3, 0, 1, INOUT);
  const red = wt("K20", "Red");
  const alerts = wt("K20", "alerts");
  return (
    <AbsoluteFill>
      <Field base={P.cyan} glow={["rgba(255,255,255,0.6)", "rgba(47,107,255,0.5)"]} shapes={[P.yellow, P.white, P.pink, P.blue]} seed={7} />
      {/* coverage: two launchpads feed into KEPT */}
      <div style={{ opacity: 1 - feedIn, transform: `translateY(${feedIn * -120}px)` }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 90 }}>
          <Title text="Every launch." t={t} at={covers} size={150} accent={{ launch: P.yellow }} />
        </div>
        {[
          { label: "vibe/vibe", sub: "every launch", c: P.pink, x: 330, at: covers + 0.3 },
          { label: "IMD", sub: "on Robinhood Chain", c: P.yellow, x: 1190, at: imd - 0.1 },
        ].map((b, i) => (
          <div key={i} style={{ position: "absolute", left: b.x, top: 420, ...enter(t, b.at, undefined, [i ? 300 : -300, 0]) }}>
            <Card x={0} y={0} w={400} h={300} bg={b.c} style={{ transform: `rotate(${i ? 4 : -4}deg) translateY(${Math.sin(t * 2.4 + i) * 10}px)` }}>
              <div style={{ padding: 34, fontFamily: FONT.head, fontWeight: 900, fontStretch: "72%", color: P.ink }}>
                <div style={{ fontSize: 96, lineHeight: 1 }}>{b.label}</div>
                <div style={{ fontFamily: FONT.text, fontSize: 32, fontWeight: 800, marginTop: 18 }}>{b.sub}</div>
              </div>
            </Card>
          </div>
        ))}
        <svg width={1920} height={1080} style={{ position: "absolute" }}>
          <CastDefs />
          {Array.from({ length: 16 }, (_, i) => {
            const at = covers + 0.6 + i * 0.22;
            const u = ((t - at) % 1.4) / 1.4;
            if (t < at) return null;
            const fromX = i % 2 ? 1390 : 530;
            const x = fromX + (960 - fromX) * u;
            const y = 760 + Math.sin(u * Math.PI) * 140;
            return <circle key={i} cx={x} cy={y} r={14} fill={[P.yellow, P.white, P.mint][i % 3]} stroke={P.ink} strokeWidth={4} opacity={Math.sin(u * Math.PI)} />;
          })}
          <g opacity={pop(t, covers + 0.4, 0.6)}>
            <Logo x={890} y={900} s={0.6} word={false} draw={1} />
          </g>
        </svg>
      </div>
      {/* the live feed */}
      {feedIn > 0.01 ? (
        <>
          <div style={{ position: "absolute", left: 70, top: 80, width: 720, opacity: feedIn }}>
            <Title text="Checked / the moment / it lands." t={t} at={wt("K19", "watches") - 0.2} size={112} align="left" accent={{ moment: P.yellow }} out={red - 0.3} />
          </div>
          <div style={{ position: "absolute", left: 70, top: 80, width: 760 }}>
            <Title text="Red lights up." t={t} at={red - 0.1} size={130} align="left" accent={{ Red: P.red }} accentInk={P.white} />
          </div>
          {/* radar */}
          <svg width={1920} height={1080} style={{ position: "absolute", opacity: feedIn }}>
            <g transform="translate(400 760)">
              {[200, 140, 80].map((r, i) => (
                <circle key={i} r={r} fill={i === 0 ? P.white : "none"} stroke={P.ink} strokeWidth={6} opacity={i === 0 ? 1 : 0.4} />
              ))}
              <path d={`M 0 0 L ${Math.cos(t * 3) * 200} ${Math.sin(t * 3) * 200} A 200 200 0 0 0 ${Math.cos(t * 3 - 0.8) * 200} ${Math.sin(t * 3 - 0.8) * 200} Z`} fill={P.mint} opacity={0.75} />
              {[0, 1, 2, 3, 4].map((i) => {
                const a = rnd(i + 30) * Math.PI * 2;
                const d = 50 + rnd(i + 40) * 130;
                const lit = t > red && i % 2 === 0;
                return <circle key={i} cx={Math.cos(a) * d} cy={Math.sin(a) * d} r={lit ? 16 + Math.sin(t * 9) * 4 : 12} fill={lit ? P.red : P.ink} />;
              })}
              <circle r={200} fill="none" stroke={P.ink} strokeWidth={8} />
            </g>
          </svg>
          <div style={{ position: "absolute", left: 860, top: 90, ...enter(t, watch, undefined, [200, 0]) }}>
            <Card x={0} y={0} w={960} h={840}>
              <div style={{ background: P.ink, padding: "20px 30px", display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ width: 22, height: 22, borderRadius: 11, background: P.red, opacity: 0.5 + 0.5 * Math.sin(t * 8) }} />
                <div style={{ fontFamily: FONT.head, fontWeight: 900, fontStretch: "75%", fontSize: 44, color: P.white }}>LIVE FEED</div>
              </div>
              {FEED.map((f, i) => {
                const at = wt("K19", "Every") - 0.2 + i * 0.32;
                const isRed = f.tone === P.red;
                const lit = isRed && t > red + (i % 3) * 0.1;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 20,
                      height: 116,
                      padding: "0 30px",
                      borderBottom: `4px solid rgba(22,17,46,0.1)`,
                      background: lit ? `rgba(255,59,78,${0.18 + 0.08 * Math.sin(t * 8 + i)})` : "transparent",
                      ...enter(t, at, undefined, [0, -60]),
                    }}
                  >
                    <div style={{ width: 70, height: 70, borderRadius: 35, background: [P.yellow, P.mint, P.sky, P.pink, P.orange, P.lime][i], border: `5px solid ${P.ink}` }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: FONT.head, fontWeight: 900, fontStretch: "75%", fontSize: 46, color: P.ink }}>{f.n}</div>
                      <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 24, color: "rgba(22,17,46,0.6)" }}>{f.src} · just now</div>
                    </div>
                    <div style={{ opacity: pop(t, at + 0.4, 0.4) }}>
                      <Chip color={f.tone} ink={isRed ? P.white : P.ink} text={f.w} size={30} />
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
          {/* the alert */}
          {t > alerts - 0.3 ? (
            <div style={{ position: "absolute", left: 330, top: 470, ...enter(t, alerts - 0.2, undefined, [-200, 0]) }}>
              <Card x={0} y={0} w={560} h={190} bg={P.yellow} style={{ transform: "rotate(-4deg)" }}>
                <div style={{ display: "flex", gap: 22, padding: 24, alignItems: "center" }}>
                  <svg width={90} height={100} style={{ transform: `rotate(${Math.sin(t * 22) * 14 * Math.exp(-(t - alerts) * 1.5)}deg)`, transformOrigin: "50% 10%" }}>
                    <path d="M 45 12 C 18 12 16 40 16 56 L 8 76 H 82 L 74 56 C 74 40 72 12 45 12 Z" fill={P.white} stroke={P.ink} strokeWidth={7} strokeLinejoin="round" />
                    <circle cx={45} cy={88} r={9} fill={P.ink} />
                  </svg>
                  <div>
                    <div style={{ fontFamily: FONT.head, fontWeight: 900, fontStretch: "75%", fontSize: 46, color: P.ink }}>RED LAUNCHER</div>
                    <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 26, color: P.ink }}>@keptalerts · $RUSH just launched</div>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}
        </>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------- 8. telegram
export const Telegram: React.FC = () => {
  const t = useSeconds();
  const sc = scene("telegram");
  const k = L("K21");
  const paste = wt("K21", "paste");
  const rec = wt("K21", "record");
  const tap = wt("K21", "Watch");
  const sell = wt("K21", "sell");
  const phoneIn = pop(t, sc.start + 0.4, 0.7);
  const tapK = t > tap - 0.1 && t < tap + 0.25 ? 0.92 : 1;
  const bubble = (at: number, child: React.ReactNode, mine: boolean) => (
    <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 18, ...enter(t, at, undefined, [mine ? 80 : -80, 0]) }}>{child}</div>
  );
  return (
    <AbsoluteFill>
      <Field base={P.tg} glow={["rgba(255,255,255,0.55)", "rgba(46,230,168,0.4)"]} shapes={[P.white, P.yellow, P.mint, P.ink]} seed={8} />
      <div style={{ position: "absolute", left: 1000, top: 140, width: 860 }}>
        <Title text="On Telegram." t={t} at={k - 0.2} size={140} align="left" accent={{ Telegram: P.white }} out={tap - 0.4} />
      </div>
      <div style={{ position: "absolute", left: 1000, top: 360, width: 860, opacity: 1 - tw(t, tap - 0.4, tap) }}>
        <Title text="Paste. / Get the record." t={t} at={[paste, paste, rec - 0.2, rec - 0.1, rec]} size={110} align="left" accent={{ record: P.yellow }} />
      </div>
      <div style={{ position: "absolute", left: 1000, top: 140, width: 860 }}>
        <Title text="Tap Watch. / Know when / they sell." t={t} at={[tap - 0.1, tap, tap + 0.5, tap + 0.6, tap + 0.7, sell - 0.2, sell - 0.1]} size={118} align="left" accent={{ Watch: P.yellow, sell: P.red }} />
      </div>
      {/* the phone */}
      <div style={{ position: "absolute", left: 220, top: 60 + (1 - phoneIn) * 900, transform: `rotate(${-4 + Math.sin(t * 1.4) * 1.5}deg)` }}>
        <div style={{ width: 600, height: 1040, background: P.ink, borderRadius: 80, padding: 22, boxSizing: "border-box", boxShadow: `18px 18px 0 rgba(22,17,46,0.35)` }}>
          <div style={{ width: "100%", height: "100%", background: "#e8f3ff", borderRadius: 60, overflow: "hidden", position: "relative" }}>
            <div style={{ background: P.white, padding: "52px 30px 20px", display: "flex", alignItems: "center", gap: 18, borderBottom: `4px solid rgba(22,17,46,0.1)` }}>
              <svg width={64} height={64}>
                <rect x={4} y={4} width={56} height={56} rx={14} fill={P.white} stroke={P.ink} strokeWidth={5} />
                <path d="M 18 33 L 28 43 L 46 22" stroke={P.green} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 30, color: P.ink }}>KEPT</div>
                <div style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: 22, color: P.tg }}>bot</div>
              </div>
            </div>
            <div style={{ padding: 26 }}>
              {bubble(
                paste - 0.1,
                <div style={{ background: "#d7f7c2", border: `4px solid ${P.ink}`, borderRadius: "26px 26px 6px 26px", padding: "16px 22px", fontFamily: FONT.mono, fontSize: 28, fontWeight: 600, color: P.ink }}>0x7a3f…e1b9</div>,
                true,
              )}
              {bubble(
                rec - 0.3,
                <div style={{ background: P.white, border: `4px solid ${P.ink}`, borderRadius: "26px 26px 26px 6px", padding: "18px 22px", width: 430 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 15, background: P.red, border: `4px solid ${P.ink}` }} />
                    <div style={{ fontFamily: FONT.head, fontWeight: 900, fontStretch: "75%", fontSize: 40, color: P.ink }}>SELLS FAST</div>
                  </div>
                  <div style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: 24, color: P.ink, marginTop: 10, lineHeight: 1.35 }}>
                    41 launches · 33 fast exits
                    <br />
                    first sell after 63 seconds
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    <div style={{ flex: 1, textAlign: "center", background: t > tap ? P.green : P.tg, color: P.white, borderRadius: 14, padding: "12px 0", fontFamily: FONT.text, fontWeight: 800, fontSize: 26, transform: `scale(${tapK})` }}>{t > tap ? "Watching" : "Watch"}</div>
                    <div style={{ flex: 1, textAlign: "center", background: "rgba(42,163,239,0.15)", color: P.tg, borderRadius: 14, padding: "12px 0", fontFamily: FONT.text, fontWeight: 800, fontSize: 26 }}>Full record</div>
                  </div>
                </div>,
                false,
              )}
            </div>
            {/* the notification */}
            {t > sell - 0.4 ? (
              <div style={{ position: "absolute", left: 20, right: 20, top: 20 + (1 - pop(t, sell - 0.3, 0.6)) * -200, background: P.yellow, border: `5px solid ${P.ink}`, borderRadius: 30, padding: "18px 22px", boxShadow: `8px 8px 0 ${P.ink}` }}>
                <div style={{ fontFamily: FONT.head, fontWeight: 900, fontStretch: "75%", fontSize: 36, color: P.ink }}>0x7a3f…e1b9 just sold</div>
                <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 22, color: P.ink }}>$RUSH · 58 seconds after launch</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {/* the finger */}
      {t > tap - 0.8 && t < tap + 1.2 ? (
        <svg width={1920} height={1080} style={{ position: "absolute" }}>
          <g transform={`translate(${390 + (1 - tw(t, tap - 0.8, tap - 0.1, 0, 1, OUT)) * 300} ${548 + (1 - tw(t, tap - 0.8, tap - 0.1, 0, 1, OUT)) * 300 + (t > tap - 0.1 && t < tap + 0.2 ? 14 : 0)}) rotate(-20)`} opacity={1 - tw(t, tap + 0.8, tap + 1.2)}>
            <circle r={60 * tw(t, tap - 0.1, tap + 0.4)} fill="none" stroke={P.white} strokeWidth={8} opacity={1 - tw(t, tap, tap + 0.5)} />
            <rect x={-22} y={0} width={44} height={150} rx={22} fill="#ffd4b8" stroke={P.ink} strokeWidth={6} />
            <rect x={-36} y={90} width={72} height={150} rx={30} fill="#ffd4b8" stroke={P.ink} strokeWidth={6} />
          </g>
        </svg>
      ) : null}
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <Sparkle x={820} y={180} t={t} at={sell} size={70} color={P.yellow} />
        <Sparkle x={250} y={240} t={t} at={sell + 0.2} size={50} color={P.white} />
      </svg>
      <div style={{ position: "absolute", left: 1000, top: 820, ...enter(t, rec + 0.3, undefined, [0, 40]) }}>
        <Chip color={P.white} text="@kept_alerts_bot" size={44} style={{ textTransform: "none", fontFamily: FONT.mono, fontStretch: "100%" }} />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------- 9. launchpads
export const Launchpads: React.FC = () => {
  const t = useSeconds();
  const sc = scene("launchpads");
  const badge = wt("K22", "badge");
  const share = wt("K22", "share");
  const api = wt("K22", "API");
  const win = pop(t, sc.start + 0.3, 0.7);
  return (
    <AbsoluteFill>
      <Field base={P.lime} glow={["rgba(255,255,255,0.6)", "rgba(46,230,168,0.5)"]} shapes={[P.ink, P.white, P.pink, P.violet]} seed={9} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 50 }}>
        <Title text="Right where people buy." t={t} at={L("K22") - 0.1} size={110} accent={{ buy: P.white }} />
      </div>
      {/* a launchpad's token page */}
      <div style={{ position: "absolute", left: 160, top: 230 + (1 - win) * 800 }}>
        <Card x={0} y={0} w={1060} h={760}>
          <div style={{ background: "#efe9ff", borderBottom: `6px solid ${P.ink}`, height: 62, display: "flex", alignItems: "center", gap: 12, padding: "0 24px" }}>
            {[P.coral, P.yellow, P.green].map((c) => (
              <div key={c} style={{ width: 22, height: 22, borderRadius: 11, background: c, border: `4px solid ${P.ink}` }} />
            ))}
            <div style={{ marginLeft: 20, flex: 1, height: 36, background: P.white, borderRadius: 18, border: `4px solid ${P.ink}`, fontFamily: FONT.mono, fontSize: 22, display: "flex", alignItems: "center", padding: "0 18px", color: P.ink }}>yourlaunchpad.xyz/token/rush</div>
          </div>
          <div style={{ display: "flex", padding: 34, gap: 30 }}>
            <div style={{ width: 220, height: 220, borderRadius: 110, background: P.orange, border: `6px solid ${P.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.head, fontWeight: 900, fontSize: 90, color: P.ink }}>R</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT.head, fontWeight: 900, fontStretch: "75%", fontSize: 80, color: P.ink }}>$RUSH</div>
              <div style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: 28, color: "rgba(22,17,46,0.6)" }}>launched 2 minutes ago</div>
              <div style={{ display: "flex", gap: 16, marginTop: 30 }}>
                <div style={{ background: P.green, border: `5px solid ${P.ink}`, borderRadius: 20, padding: "16px 50px", fontFamily: FONT.head, fontWeight: 900, fontStretch: "75%", fontSize: 48, color: P.ink }}>BUY</div>
                <div style={{ background: "#f1f1f6", border: `5px solid ${P.ink}`, borderRadius: 20, padding: "16px 40px", fontFamily: FONT.head, fontWeight: 900, fontStretch: "75%", fontSize: 48, color: P.ink }}>SELL</div>
              </div>
            </div>
          </div>
          <svg width={1060} height={300} style={{ position: "absolute", left: 0, bottom: 0 }}>
            <path d={`M 30 250 ${Array.from({ length: 24 }, (_, i) => `L ${30 + i * 43} ${220 - i * 6 - Math.sin(i * 1.7) * 26}`).join(" ")}`} stroke={P.violet} strokeWidth={9} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </Card>
      </div>
      {/* the KEPT badge slaps on */}
      {t > badge - 0.2 ? (
        <div style={{ position: "absolute", left: 640, top: 600, transform: `rotate(${-8 + (1 - pop(t, badge - 0.1, 0.5)) * 40}deg) scale(${1 + (1 - pop(t, badge - 0.1, 0.5)) * 1.4})`, opacity: Math.min(1, (t - badge + 0.2) * 6) }}>
          <div style={{ background: P.white, border: `7px solid ${P.ink}`, borderRadius: 30, boxShadow: `12px 12px 0 ${P.ink}`, padding: "20px 28px", display: "flex", alignItems: "center", gap: 20 }}>
            <svg width={70} height={70}>
              <rect x={4} y={4} width={62} height={62} rx={16} fill={P.white} stroke={P.ink} strokeWidth={6} />
              <path d="M 18 36 L 30 48 L 52 22" stroke={P.green} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 24, color: "rgba(22,17,46,0.6)" }}>KEPT record</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 15, background: P.red, border: `4px solid ${P.ink}` }} />
                <div style={{ fontFamily: FONT.head, fontWeight: 900, fontStretch: "75%", fontSize: 52, color: P.ink }}>SELLS FAST</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <CastDefs />
        <Confetti x={820} y={650} t={t} at={badge + 0.05} n={40} spread={0.7} seed={11} />
      </svg>
      {/* share card and the API */}
      <div style={{ position: "absolute", left: 1310, top: 240, ...enter(t, share - 0.1, undefined, [300, 0]) }}>
        <Card x={0} y={0} w={500} h={330} bg={P.violet} style={{ transform: `rotate(5deg) translateY(${Math.sin(t * 2) * 8}px)` }}>
          <div style={{ padding: 30 }}>
            <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 26, color: P.white }}>SHARE CARD</div>
            <div style={{ fontFamily: FONT.head, fontWeight: 900, fontStretch: "72%", fontSize: 86, color: P.white, lineHeight: 1 }}>41 LAUNCHES</div>
            <div style={{ fontFamily: FONT.head, fontWeight: 900, fontStretch: "72%", fontSize: 86, color: P.yellow, lineHeight: 1 }}>33 FAST EXITS</div>
          </div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: 1290, top: 650, ...enter(t, api - 0.15, undefined, [300, 0]) }}>
        <Card x={0} y={0} w={540} h={250} bg={P.ink} style={{ transform: "rotate(-3deg)" }}>
          <div style={{ padding: "26px 30px", fontFamily: FONT.mono, fontSize: 30, lineHeight: 1.5, color: P.white }}>
            <span style={{ color: P.lime }}>GET</span> /api/record
            <br />
            <span style={{ color: P.pink }}>"tone"</span>: <span style={{ color: P.yellow }}>"exits"</span>
            <br />
            <span style={{ color: P.pink }}>"fastExits"</span>: <span style={{ color: P.cyan }}>33</span>
          </div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: 1530, top: 930, ...enter(t, api + 0.2, undefined, [0, 40]) }}>
        <Chip color={P.yellow} text="free and open" size={36} />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------- 10. promises
export const Promises: React.FC = () => {
  const t = useSeconds();
  const sc = scene("promises");
  const k23 = L("K23");
  const lock = wt("K24", "Lock");
  const swarm = wt("K24", "swarm");
  const kept = wt("K25", "Kept");
  const missed = wt("K25", "Missed");
  const burn = wt("K25", "burn");
  const ours = wt("K25", "Even");
  const vaultIn = tw(t, lock - 0.5, lock + 0.2, 0, 1, INOUT);
  const team = 1 - vaultIn;
  const slots = [
    { label: "Ship v1", c: P.mint },
    { label: "1,000 holders", c: P.yellow },
    { label: "Audit", c: P.pink },
  ];
  return (
    <AbsoluteFill>
      <Field base={P.grape} glow={["rgba(255,111,181,0.55)", "rgba(31,209,249,0.45)"]} shapes={[P.yellow, P.pink, P.mint, P.white]} seed={10} />
      {/* honest teams */}
      {team > 0.01 ? (
        <div style={{ opacity: team }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 110 }}>
            <Title text="Nothing to hide?" t={t} at={wt("K23", "nothing") - 0.2} size={150} accent={{ hide: P.yellow }} />
          </div>
          <svg width={1920} height={1080} style={{ position: "absolute" }}>
            <CastDefs />
            {[
              { x: 620, skin: "mint" as const, s: 1.4 },
              { x: 960, skin: "peach" as const, s: 1.6 },
              { x: 1300, skin: "blue" as const, s: 1.4 },
            ].map((b, i) => (
              <Blob key={i} x={b.x} y={900 - Math.abs(Math.sin(t * 4 + i)) * 20} t={t} s={b.s} skin={b.skin} seed={i + 20} mood="joy" arms={i === 1 ? "wave" : "up"} hat={i === 1} opacity={pop(t, k23 + i * 0.15, 0.6)} />
            ))}
          </svg>
        </div>
      ) : null}
      {/* the vault of promises */}
      {vaultIn > 0.01 ? (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 50, opacity: vaultIn }}>
            <Title text="Lock tokens behind / public promises." t={t} at={lock - 0.1} size={100} accent={{ promises: P.yellow }} out={kept - 0.4} />
          </div>
          <div style={{ position: "absolute", left: 360, top: 300 + (1 - vaultIn) * 700 }}>
            <Card x={0} y={0} w={1200} h={600} bg={P.sky} r={44}>
              <div style={{ display: "flex", gap: 30, padding: 40, justifyContent: "center" }}>
                {slots.map((s, i) => {
                  const isKept = i < 2;
                  const at = isKept ? kept + i * 0.15 : missed;
                  const done = t > at;
                  return (
                    <div key={i} style={{ width: 330, height: 500, background: done ? (isKept ? P.mint : "#3a1020") : P.white, border: `6px solid ${P.ink}`, borderRadius: 30, position: "relative", overflow: "hidden", transition: "none" }}>
                      <div style={{ padding: "26px 0", textAlign: "center", fontFamily: FONT.head, fontWeight: 900, fontStretch: "75%", fontSize: 50, color: done && !isKept ? P.white : P.ink, background: s.c, borderBottom: `6px solid ${P.ink}` }}>{s.label}</div>
                      <svg width={330} height={380} style={{ position: "absolute", left: 0, top: 110 }}>
                        <CastDefs />
                        {Array.from({ length: 5 }, (_, k) => {
                          const fly = isKept ? tw(t, at + 0.1 + k * 0.06, at + 0.9 + k * 0.06, 0, 1, OUT) : 0;
                          const melt = !isKept ? tw(t, burn - 0.1 + k * 0.05, burn + 0.6 + k * 0.05) : 0;
                          return <Coin key={k} x={165 + (k % 2 ? 10 : -10) + fly * (k - 2) * 60} y={300 - k * 30 - fly * 300} r={44} spin={fly * 10 + k} opacity={(1 - melt) * (1 - tw(fly, 0.7, 1))} />;
                        })}
                        <Padlock x={165} y={150} s={1.6} open={isKept ? tw(t, at - 0.05, at + 0.3, 0, 1, OUT) : 0} color={done ? (isKept ? P.green : P.red) : P.yellow} />
                        {!isKept ? <Fire x={165} y={370} t={t} k={tw(t, burn - 0.2, burn + 0.4) * (1 - tw(t, sc.end - 0.3, sc.end + 0.5))} w={260} /> : null}
                      </svg>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
          {/* the swarm checks each promise */}
          <svg width={1920} height={1080} style={{ position: "absolute" }}>
            <CastDefs />
            {[0, 1, 2].map((i) => {
              const at = swarm - 0.2 + i * 0.15;
              const x = 595 + i * 365 + Math.sin(t * 2 + i) * 30;
              const done = i < 2 ? t > kept + i * 0.15 : t > missed;
              return <Agent key={i} x={x} y={240 + Math.sin(t * 3 + i) * 12} t={t} s={1.1} seed={i} state={done ? (i < 2 ? "yes" : "no") : "scan"} opacity={pop(t, at, 0.5) * (1 - tw(t, ours - 0.3, ours))} />;
            })}
            <Confetti x={780} y={500} t={t} at={kept + 0.1} n={80} spread={1.2} seed={12} />
          </svg>
          <Stamp t={t} at={kept} text="Kept" color={P.green} x={560} y={860} rot={-10} size={110} />
          <Stamp t={t} at={missed} text="Burn" color={P.red} x={1360} y={860} rot={8} size={110} />
          {t > ours - 0.4 ? (
            <AbsoluteFill style={{ background: `rgba(22,17,46,${0.55 * tw(t, ours - 0.3, ours + 0.2)})` }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 360 }}>
                <Title text="Even ours." t={t} at={ours - 0.05} size={260} accent={{ ours: P.yellow }} stagger={0.18} />
              </div>
            </AbsoluteFill>
          ) : null}
        </>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------- 11. end
export const End: React.FC = () => {
  const t = useSeconds();
  const sc = scene("end");
  const k27 = L("K27");
  const logo = k27 - 0.6;
  const facts = tw(t, logo - 0.4, logo, 0, 1, INOUT);
  const stripes = [P.coral, P.orange, P.yellow, P.lime, P.mint, P.cyan, P.blue, P.violet, P.pink];
  return (
    <AbsoluteFill style={{ background: P.cream }}>
      {/* rainbow stripes that sweep in */}
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {stripes.map((c, i) => {
          const p = tw(t, sc.start + 0.1 + i * 0.05, sc.start + 0.9 + i * 0.05, 0, 1, OUT);
          const w = 2600;
          return <rect key={i} x={-300 + (1 - p) * -w} y={-200 + i * 70} width={w} height={70} fill={c} transform={`rotate(-14 960 540) translate(0 ${-420 + (t - sc.start) * 4})`} />;
        })}
        {stripes.map((c, i) => {
          const p = tw(t, sc.start + 0.3 + i * 0.05, sc.start + 1.1 + i * 0.05, 0, 1, OUT);
          const w = 2600;
          return <rect key={`b${i}`} x={-300 + (1 - p) * w} y={-200 + i * 70} width={w} height={70} fill={stripes[stripes.length - 1 - i]} transform={`rotate(-14 960 540) translate(0 ${1040 - (t - sc.start) * 4})`} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 340, opacity: 1 - facts }}>
        <Title text="Facts from the chain. / Never accusations." t={t} at={L("K26") - 0.1} size={124} color={P.ink} shadow={null} accent={{ chain: P.mint, accusations: P.yellow }} />
      </div>
      {t > logo - 0.1 ? (
        <>
          <svg width={1920} height={1080} style={{ position: "absolute" }}>
            <CastDefs />
            <g transform={`translate(960 400) scale(${pop(t, logo, 0.7)}) translate(-960 -400)`}>
              <Logo x={612} y={400} s={1.6} draw={tw(t, logo + 0.2, logo + 0.7)} />
            </g>
            <Confetti x={960} y={300} t={t} at={logo + 0.2} n={110} spread={1.6} seed={14} />
            <Sparkle x={560} y={300} t={t} at={logo + 0.6} size={60} color={P.yellow} />
            <Sparkle x={1440} y={480} t={t} at={logo + 0.8} size={50} color={P.pink} />
          </svg>
          <div style={{ position: "absolute", left: 0, right: 0, top: 590 }}>
            <Title text="Check before you buy." t={t} at={wt("K27", "Check") - 0.05} size={110} color={P.ink} shadow={null} accent={{ buy: P.yellow }} />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 800, display: "flex", justifyContent: "center", gap: 34 }}>
            <div style={{ ...enter(t, LE("K27") + 0.3, undefined, [0, 40]) }}>
              <Chip color={P.white} text="keptmd.vercel.app" size={44} style={{ textTransform: "none", fontFamily: FONT.mono, fontStretch: "100%" }} />
            </div>
            <div style={{ ...enter(t, LE("K27") + 0.55, undefined, [0, 40]) }}>
              <Chip color={P.tg} ink={P.white} text="@kept_alerts_bot" size={44} style={{ textTransform: "none", fontFamily: FONT.mono, fontStretch: "100%" }} />
            </div>
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
