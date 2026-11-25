import React from "react";
import { AbsoluteFill } from "remotion";
import { Blob, CastDefs, Coin, Confetti, Sparkle } from "../explainer/cast";
import { Card, Chip, Count, Field, FONT, INOUT, L, LE, OUT, P, Title, enter, pop, rnd, scene, tw, useSeconds, wt } from "./kit";

/// A rubber stamp that slams down with a little overshoot.
export const Stamp: React.FC<{ t: number; at: number; text: string; color: string; x: number; y: number; rot?: number; size?: number; ink?: string }> = ({ t, at, text, color, x, y, rot = -10, size = 90, ink = P.white }) => {
  if (t < at - 0.05) return null;
  const u = t - at;
  const k = u < 0.18 ? 2.2 - (u / 0.18) * 1.2 : 1 + Math.exp(-(u - 0.18) * 9) * Math.sin((u - 0.18) * 30) * 0.05;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${k})`,
        opacity: Math.min(1, u / 0.1),
        fontFamily: FONT.head,
        fontWeight: 900,
        fontStretch: "70%",
        fontSize: size,
        lineHeight: 1,
        color: ink,
        background: color,
        border: `8px solid ${P.ink}`,
        borderRadius: 22,
        padding: "8px 30px 12px",
        boxShadow: `10px 10px 0 ${P.ink}`,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

// ---------------------------------------------------------------------------------- 4. record
const LAUNCHES = [
  { name: "$FROG", sec: 63, tone: P.red },
  { name: "$GEM", sec: 41, tone: P.red },
  { name: "$CAT", sec: 120, tone: P.red },
  { name: "$SUN", sec: 88, tone: P.red },
  { name: "$AI", sec: 2400, tone: P.amber },
  { name: "$WAGMI", sec: 75, tone: P.red },
];

export const Record: React.FC = () => {
  const t = useSeconds();
  const sc = scene("record");
  const q = "2288";
  const typeAt = wt("K7", "launch") - 0.6;
  const typed = q.slice(0, Math.max(0, Math.min(q.length, Math.floor((t - typeAt) / 0.14))));
  const enterAt = typeAt + 0.75;
  const card = L("K8") - 0.2;
  const up = tw(t, card - 0.5, card + 0.2, 0, 1, INOUT);
  const verdictT = [wt("K9", "Red"), wt("K9", "Amber"), wt("K9", "Green"), wt("K9", "Grey")];
  const k10 = L("K10");
  const sixty = wt("K10", "63");
  const ninety = wt("K10", "98%");
  const right = tw(t, k10 - 0.5, k10 + 0.1, 0, 1, INOUT);
  return (
    <AbsoluteFill>
      <Field base={P.blue} glow={["rgba(124,196,255,0.7)", "rgba(123,92,255,0.6)"]} shapes={[P.yellow, P.sky, P.white, P.pink]} seed={4} />
      {/* the search bar */}
      <div style={{ position: "absolute", left: 960, top: 520 - up * 400, transform: `translate(-50%, -50%) scale(${1 - up * 0.4})`, ...{ opacity: 1 - tw(t, card + 0.4, card + 0.8) } }}>
        <div style={{ ...enter(t, L("K7") - 0.3) }}>
          <div style={{ width: 1200, height: 150, background: P.white, border: `7px solid ${P.ink}`, borderRadius: 80, boxShadow: `14px 14px 0 ${P.ink}`, display: "flex", alignItems: "center", padding: "0 30px 0 54px", boxSizing: "border-box", gap: 30 }}>
            <svg width={60} height={60}>
              <circle cx={25} cy={25} r={18} stroke={P.ink} strokeWidth={8} fill="none" />
              <path d="M 39 39 L 54 54" stroke={P.ink} strokeWidth={9} strokeLinecap="round" />
            </svg>
            <div style={{ flex: 1, fontFamily: FONT.mono, fontSize: 64, fontWeight: 600, color: typed ? P.ink : "rgba(22,17,46,0.35)" }}>
              {typed || "token, wallet or launch #"}
              {typed && t < enterAt ? <span style={{ opacity: Math.floor(t * 3) % 2 ? 1 : 0 }}>|</span> : null}
            </div>
            <div style={{ background: t > enterAt ? P.green : P.yellow, border: `6px solid ${P.ink}`, borderRadius: 60, padding: "16px 40px", fontFamily: FONT.head, fontWeight: 900, fontStretch: "75%", fontSize: 50, color: P.ink, transform: `scale(${t > enterAt && t < enterAt + 0.2 ? 0.9 : 1})` }}>CHECK</div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 130 }}>
        <Title text="Paste anything." t={t} at={L("K7") - 0.1} size={150} accent={{ anything: P.yellow }} out={card - 0.6} />
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {/* data drops in from the chain */}
        {Array.from({ length: 18 }, (_, i) => {
          const at = card + 0.1 + i * 0.12;
          const u = tw(t, at, at + 0.8, 0, 1, INOUT);
          if (u <= 0 || u >= 1) return null;
          return <rect key={i} x={160 + rnd(i) * 820} y={-60 + u * 600} width={24} height={24} rx={6} fill={[P.yellow, P.white, P.pink, P.mint][i % 4]} stroke={P.ink} strokeWidth={4} transform={`rotate(${u * 180} ${172 + rnd(i) * 820} ${-48 + u * 600})`} />;
        })}
      </svg>
      {/* the record card */}
      {t > card - 0.1 ? (
        <div style={{ position: "absolute", left: 130 + right * -20, top: 150, ...enter(t, card, undefined, [0, 160]) }}>
          <Card x={0} y={0} w={940} h={780}>
            <div style={{ background: P.red, borderBottom: `6px solid ${P.ink}`, padding: "24px 36px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 26, color: P.white, opacity: 0.85 }}>Launcher wallet</div>
                <div style={{ fontFamily: FONT.mono, fontWeight: 600, fontSize: 46, color: P.white }}>0x7a3f…e1b9</div>
              </div>
              <Chip color={P.white} text="Sells fast" size={34} style={{ opacity: pop(t, wt("K8", "sold") , 0.4), transform: `scale(${pop(t, wt("K8", "sold"), 0.5)})` }} />
            </div>
            <div style={{ display: "flex", gap: 20, padding: "26px 36px 10px" }}>
              {[
                { k: "launches", v: 41, at: card + 0.7 },
                { k: "fast exits", v: 33, at: card + 1.0 },
                { k: "of its share sold", v: 98, at: card + 1.3, pct: true },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, background: [P.yellow, P.pink, P.sky][i], border: `5px solid ${P.ink}`, borderRadius: 22, padding: "14px 20px", ...enter(t, s.at - 0.2, undefined, [0, 40]) }}>
                  <div style={{ fontFamily: FONT.head, fontWeight: 900, fontStretch: "75%", fontSize: 86, lineHeight: 1, color: P.ink }}>
                    <Count t={t} at={s.at - 0.1} to={s.v} />
                    {s.pct ? "%" : ""}
                  </div>
                  <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 24, color: P.ink }}>{s.k}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "10px 36px" }}>
              {LAUNCHES.map((r, i) => {
                const at = Math.min(wt("K8", "Every"), card + 1.8) + i * 0.22;
                const w = Math.min(1, Math.log10(r.sec) / Math.log10(3600));
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 18, height: 56, borderTop: i ? `3px solid rgba(22,17,46,0.1)` : "none", ...enter(t, at, undefined, [-80, 0]) }}>
                    <div style={{ width: 150, fontFamily: FONT.head, fontWeight: 850, fontStretch: "78%", fontSize: 34, color: P.ink }}>{r.name}</div>
                    <div style={{ flex: 1, height: 26, background: "rgba(22,17,46,0.08)", borderRadius: 13, overflow: "hidden" }}>
                      <div style={{ width: `${w * 100 * tw(t, at + 0.1, at + 0.7, 0, 1, OUT)}%`, height: "100%", background: r.tone, borderRadius: 13 }} />
                    </div>
                    <div style={{ width: 170, textAlign: "right", fontFamily: FONT.mono, fontWeight: 600, fontSize: 28, color: P.ink }}>{r.sec < 120 ? `${r.sec}s` : `${Math.round(r.sec / 60)} min`}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ position: "absolute", bottom: 18, left: 36, fontFamily: FONT.text, fontWeight: 700, fontSize: 22, color: "rgba(22,17,46,0.55)", opacity: tw(t, wt("K8", "chain"), wt("K8", "chain") + 0.4) }}>
              time to first sell · straight from the chain
            </div>
          </Card>
        </div>
      ) : null}
      {/* the four colours */}
      {t > card ? (
        <div style={{ position: "absolute", left: 1150, top: 200, width: 680, opacity: 1 - right, transform: `translateX(${right * 300}px)` }}>
          {[
            { c: P.red, w: "Red", s: "sells fast" },
            { c: P.amber, w: "Amber", s: "has sold" },
            { c: P.green, w: "Green", s: "never sold" },
            { c: P.grey, w: "Grey", s: "first launch" },
          ].map((v, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 26, marginBottom: 34, ...enter(t, verdictT[i] - 0.1, undefined, [200, 0]) }}>
              <div style={{ width: 120, height: 120, borderRadius: 60, background: v.c, border: `7px solid ${P.ink}`, boxShadow: `8px 8px 0 ${P.ink}`, transform: `rotate(${Math.sin(t * 3 + i) * 6}deg)` }} />
              <div>
                <div style={{ fontFamily: FONT.head, fontWeight: 900, fontStretch: "72%", fontSize: 84, lineHeight: 0.95, color: P.white, textShadow: `5px 5px 0 ${P.ink}`, textTransform: "uppercase" }}>{v.w}</div>
                <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 34, color: P.white }}>{v.s}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {/* 63 seconds, 98% */}
      {t > k10 - 0.6 ? (
        <svg width={1920} height={1080} style={{ position: "absolute" }}>
          <g transform={`translate(1290 ${430}) scale(${pop(t, sixty - 0.35, 0.6)})`}>
            <circle r={170} fill={P.ink} transform="translate(12 12)" />
            <circle r={170} fill={P.yellow} stroke={P.ink} strokeWidth={9} />
            <rect x={-26} y={-212} width={52} height={36} rx={8} fill={P.ink} />
            <path d={`M 0 0 L 0 -140 A 140 140 0 ${tw(t, sixty - 0.3, sixty + 0.6) > 0.5 ? 1 : 0} 1 ${Math.sin(tw(t, sixty - 0.3, sixty + 0.6) * Math.PI * 2 * 0.999) * 140} ${-Math.cos(tw(t, sixty - 0.3, sixty + 0.6) * Math.PI * 2 * 0.999) * 140} Z`} fill={P.coral} />
            <text y={40} textAnchor="middle" fontFamily={FONT.head} fontWeight={900} fontSize={120} fill={P.ink} style={{ fontStretch: "72%" }}>
              {Math.round(63 * tw(t, sixty - 0.3, sixty + 0.6))}s
            </text>
          </g>
          <g transform={`translate(1660 ${700}) scale(${pop(t, ninety - 0.3, 0.6)}) rotate(-90)`}>
            <circle r={130} fill={P.ink} transform="translate(10 -10)" />
            <circle r={130} fill={P.white} stroke={P.ink} strokeWidth={8} />
            <circle r={65} fill="none" stroke={P.red} strokeWidth={130} pathLength={100} strokeDasharray={`${98 * tw(t, ninety - 0.2, ninety + 0.8, 0, 1, OUT)} 100`} />
            <circle r={130} fill="none" stroke={P.ink} strokeWidth={8} />
          </g>
          <text x={1660} y={720} textAnchor="middle" fontFamily={FONT.head} fontWeight={900} fontSize={84} fill={P.white} stroke={P.ink} strokeWidth={14} paintOrder="stroke" opacity={pop(t, ninety, 0.5)} style={{ fontStretch: "72%" }}>
            98%
          </text>
          <text x={1290} y={660} textAnchor="middle" fontFamily={FONT.head} fontWeight={850} fontSize={44} fill={P.white} stroke={P.ink} strokeWidth={10} paintOrder="stroke" opacity={pop(t, sixty + 0.4, 0.5)} style={{ fontStretch: "78%" }}>
            AFTER LAUNCH
          </text>
          <text x={1660} y={900} textAnchor="middle" fontFamily={FONT.head} fontWeight={850} fontSize={44} fill={P.white} stroke={P.ink} strokeWidth={10} paintOrder="stroke" opacity={pop(t, ninety + 0.4, 0.5)} style={{ fontStretch: "78%" }}>
            OF ITS SHARE SOLD
          </text>
        </svg>
      ) : null}
      <Stamp t={t} at={wt("K10", "share") + 0.3} text="Sells fast" color={P.red} x={600} y={560} rot={-12} size={120} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------- 5. money
type Node = { x: number; y: number; kind: "src" | "mid" | "me" | "l"; red?: number };

export const Money: React.FC = () => {
  const t = useSeconds();
  const sc = scene("money");
  const k11 = L("K11");
  const tree = L("K13") - 0.3;
  const treeIn = tw(t, tree - 0.4, tree + 0.5, 0, 1, INOUT);
  const meX = 960;
  const meY = 840;
  // the money tree: one source, two wallets in between, nine launchers (this wallet among them)
  const mids = [
    { x: 560, y: 520 },
    { x: 1360, y: 520 },
  ];
  const ls: { x: number; y: number; parent: number; red: boolean; me?: boolean }[] = [];
  const xs = [190, 370, 550, 730, 960, 1190, 1370, 1550, 1730];
  xs.forEach((x, i) => ls.push({ x, y: 840, parent: i < 5 ? 0 : 1, red: [0, 1, 3, 5, 6, 8].includes(i), me: i === 4 }));
  const eight = wt("K14", "8");
  const six = wt("K14", "6");
  const back = wt("K13", "Two");
  const amber = wt("K15", "amber");
  // the fresh wallet before the tree
  const fresh = 1 - treeIn;
  const coinRain = L("K12") + 0.6;
  return (
    <AbsoluteFill>
      <Field base={P.pink} glow={["rgba(255,210,63,0.55)", "rgba(123,92,255,0.45)"]} shapes={[P.yellow, P.white, P.violet, P.cyan]} seed={5} />
      {/* act one: a clean, fresh wallet */}
      {fresh > 0.01 ? (
        <div style={{ opacity: fresh }}>
          <svg width={1920} height={1080} style={{ position: "absolute" }}>
            <CastDefs />
            <Blob x={560} y={920} t={t} s={1.6} skin="lilac" seed={9} mood={t > coinRain ? "worried" : "joy"} arms={t > coinRain ? "down" : "wave"} opacity={pop(t, k11 - 0.2, 0.6)} />
            {Array.from({ length: 10 }, (_, i) => {
              const at = coinRain + i * 0.12;
              const u = tw(t, at, at + 0.8, 0, 1, (x) => x * x);
              if (t < at) return null;
              return <Coin key={i} x={1330 + (rnd(i) - 0.5) * 300} y={-60 + u * 640} r={34} spin={t * 7 + i} opacity={u < 1 ? 1 : 0} />;
            })}
            <Sparkle x={1600} y={350} t={t} at={wt("K11", "Clean") } size={90} color={P.white} />
            <Sparkle x={1080} y={300} t={t} at={wt("K11", "Clean") + 0.2} size={60} color={P.yellow} />
          </svg>
          <div style={{ position: "absolute", left: 1040, top: 380, ...enter(t, wt("K11", "fresh"), undefined, [200, 0]) }}>
            <Card x={0} y={0} w={620} h={380} style={{ transform: "rotate(3deg)" }}>
              <div style={{ background: P.grey, borderBottom: `6px solid ${P.ink}`, padding: "20px 30px", fontFamily: FONT.mono, fontWeight: 600, fontSize: 40, color: P.ink }}>0xb4d1…77c0</div>
              <div style={{ padding: "26px 30px", fontFamily: FONT.head, fontWeight: 900, fontStretch: "72%", fontSize: 76, color: P.ink, lineHeight: 1.05 }}>
                <div style={{ opacity: pop(t, wt("K11", "Clean"), 0.4) }}>0 LAUNCHES</div>
                <div style={{ opacity: pop(t, wt("K11", "history"), 0.4) }}>NO HISTORY</div>
              </div>
              {t > coinRain + 0.8 ? (
                <div style={{ position: "absolute", right: 24, bottom: 20, fontFamily: FONT.head, fontWeight: 900, fontSize: 120, color: P.coral, transform: `scale(${pop(t, coinRain + 0.8, 0.5)}) rotate(12deg)` }}>?</div>
              ) : null}
            </Card>
          </div>
          <div style={{ position: "absolute", left: 80, top: 100, width: 1000 }}>
            <Title text="A fresh wallet. / Clean record." t={t} at={wt("K11", "fresh") - 0.1} size={120} align="left" accent={{ Clean: P.yellow }} out={L("K12") - 0.3} />
          </div>
          <div style={{ position: "absolute", left: 80, top: 100, width: 1100 }}>
            <Title text="It still needs / money." t={t} at={wt("K12", "needs") - 0.2} size={130} align="left" accent={{ money: P.yellow }} out={tree - 0.4} />
          </div>
        </div>
      ) : null}
      {/* act two: the money tree */}
      {treeIn > 0.01 ? (
        <svg width={1920} height={1080} style={{ position: "absolute", opacity: treeIn }}>
          <CastDefs />
          {/* edges */}
          {mids.map((m, i) => {
            const d = `M 960 250 C 960 380 ${m.x} 380 ${m.x} ${m.y - 40}`;
            const p = tw(t, tree + 0.2, tree + 0.8, 0, 1, OUT);
            const hot = i === 0 && t > back;
            return <path key={i} d={d} stroke={hot ? P.ink : P.white} strokeWidth={hot ? 16 : 10} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />;
          })}
          {ls.map((l, i) => {
            const m = mids[l.parent];
            const d = `M ${m.x} ${m.y + 40} C ${m.x} ${m.y + 160} ${l.x} ${l.y - 160} ${l.x} ${l.y - 50}`;
            const p = tw(t, tree + 0.5 + i * 0.04, tree + 1.1 + i * 0.04, 0, 1, OUT);
            const hot = l.me && t > back - 0.4;
            return <path key={i} d={d} stroke={hot ? P.ink : P.white} strokeWidth={hot ? 16 : 8} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} opacity={l.me || t < eight - 0.3 ? 1 : 0.95} />;
          })}
          {/* the trail of money, two wallets back */}
          {t > back - 0.4 && t < amber + 1
            ? Array.from({ length: 6 }, (_, i) => {
                const u = ((t - back + 0.4 + i * 0.25) % 1.5) / 1.5;
                const path = (k: number) => {
                  if (k < 0.5) {
                    const s = k / 0.5;
                    return [960 + (560 - 960) * s * s, 250 + (480 - 250) * s];
                  }
                  const s = (k - 0.5) / 0.5;
                  return [560 + (960 - 560) * s, 560 + (790 - 560) * s];
                };
                const [x, y] = path(u);
                return <Coin key={i} x={x} y={y} r={22} spin={t * 8 + i} />;
              })
            : null}
          {/* source */}
          <g transform={`translate(960 210) scale(${pop(t, tree, 0.6)})`}>
            <rect x={-130} y={-58} width={260} height={116} rx={26} fill={P.ink} transform="translate(9 9)" />
            <rect x={-130} y={-58} width={260} height={116} rx={26} fill={P.yellow} stroke={P.ink} strokeWidth={7} />
            <text y={-8} textAnchor="middle" fontFamily={FONT.head} fontWeight={900} fontSize={42} fill={P.ink} style={{ fontStretch: "75%" }}>
              THE MONEY
            </text>
            <text y={34} textAnchor="middle" fontFamily={FONT.mono} fontWeight={600} fontSize={28} fill={P.ink}>
              0x51e0…a3d2
            </text>
          </g>
          {mids.map((m, i) => (
            <g key={i} transform={`translate(${m.x} ${m.y}) scale(${pop(t, tree + 0.4 + i * 0.1, 0.6)})`}>
              <rect x={-44} y={-44} width={88} height={88} rx={20} fill={P.ink} transform="translate(7 7)" />
              <rect x={-44} y={-44} width={88} height={88} rx={20} fill={P.white} stroke={P.ink} strokeWidth={7} />
              <path d="M -20 -6 h 40 v 24 h -40 Z M -20 -6 l 6 -12 h 24" stroke={P.ink} strokeWidth={6} fill="none" strokeLinejoin="round" />
            </g>
          ))}
          {ls.map((l, i) => {
            const at = l.me ? tree + 0.9 : eight - 0.1 + i * 0.05;
            const red = l.red && t > six - 0.1 + (i % 4) * 0.06;
            const amberNow = l.me && t > amber - 0.05;
            const fill = l.me ? (amberNow ? P.amber : P.green) : red ? P.red : P.white;
            const r = l.me ? 58 : 44;
            return (
              <g key={i} transform={`translate(${l.x} ${l.y + Math.sin(t * 3 + i) * 5}) scale(${pop(t, at, 0.6)})`}>
                {red ? <circle r={r + 18 + Math.sin(t * 8 + i) * 6} fill={P.red} opacity={0.3} /> : null}
                <circle r={r} fill={P.ink} transform="translate(7 7)" />
                <circle r={r} fill={fill} stroke={P.ink} strokeWidth={7} />
                {red ? <path d="M -14 -14 L 14 14 M 14 -14 L -14 14" stroke={P.white} strokeWidth={8} strokeLinecap="round" /> : null}
                {l.me ? <path d="M -18 0 L -5 13 L 20 -14" stroke={P.white} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={amberNow ? 0 : 1} /> : null}
                {l.me && amberNow ? (
                  <text y={22} textAnchor="middle" fontFamily={FONT.head} fontWeight={900} fontSize={64} fill={P.ink}>
                    !
                  </text>
                ) : null}
              </g>
            );
          })}
          {/* THIS WALLET ring */}
          {t > tree + 1 ? (
            <g opacity={pop(t, wt("K14", "This") - 0.1, 0.5)}>
              <circle cx={meX} cy={meY} r={86 + Math.sin(t * 6) * 6} fill="none" stroke={P.ink} strokeWidth={8} strokeDasharray="18 14" transform={`rotate(${t * 40} ${meX} ${meY})`} />
              <rect x={meX - 150} y={meY - 172} width={300} height={62} rx={31} fill={P.ink} />
              <text x={meX} y={meY - 128} textAnchor="middle" fontFamily={FONT.head} fontWeight={900} fontSize={38} fill={P.white} style={{ fontStretch: "78%" }}>
                THIS WALLET
              </text>
            </g>
          ) : null}
          <Confetti x={meX} y={meY - 60} t={t} at={amber + 0.15} n={40} spread={0.8} seed={6} />
        </svg>
      ) : null}
      {treeIn > 0.01 ? (
        <>
          <div style={{ position: "absolute", left: 60, top: 60, width: 760 }}>
            <Title text="Follow the money." t={t} at={wt("K13", "follows") - 0.1} size={104} align="left" accent={{ money: P.yellow }} out={wt("K14", "never") - 0.2} />
          </div>
          <div style={{ position: "absolute", left: 1250, top: 150, ...enter(t, back - 0.1, wt("K14", "never") - 0.2, [100, 0]) }}>
            <Chip color={P.white} text="2 wallets back" size={44} />
          </div>
          <div style={{ position: "absolute", left: 60, top: 60, width: 760 }}>
            <Title text="Never sold." t={t} at={wt("K14", "never") - 0.1} size={104} align="left" accent={{ sold: P.green }} out={eight - 0.3} />
          </div>
          <div style={{ position: "absolute", left: 60, top: 60, width: 820 }}>
            <Title text="8 other launchers." t={t} at={eight - 0.1} size={104} align="left" accent={{ "8": P.white }} out={six - 0.3} />
          </div>
          <div style={{ position: "absolute", left: 60, top: 60, width: 820 }}>
            <Title text="6 sell fast." t={t} at={six - 0.1} size={124} align="left" accent={{ "6": P.red }} accentInk={P.white} out={L("K15") - 0.2} />
          </div>
          <div style={{ position: "absolute", left: 60, top: 60, width: 820 }}>
            <Title text="Fresh wallet. / Same money." t={t} at={[L("K15"), L("K15") + 0.15, wt("K15", "Same"), wt("K15", "Same"), wt("K15", "money")]} size={96} align="left" accent={{ money: P.yellow }} />
          </div>
          <Stamp t={t} at={amber} text="Amber" color={P.amber} ink={P.ink} x={1260} y={700} rot={-8} size={96} />
          <div style={{ position: "absolute", left: 1180, top: 790, ...enter(t, wt("K15", "first") - 0.1, undefined, [0, 40]) }}>
            <Chip color={P.white} text="From launch #1" size={40} />
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------- 6. groups
export const Groups: React.FC = () => {
  const t = useSeconds();
  const sc = scene("groups");
  const k16 = L("K16");
  const one = wt("K16", "One");
  const five = wt("K16", "5");
  const exits = wt("K16", "139");
  const fair = L("K17");
  const side = tw(t, fair - 0.4, fair + 0.3, 0, 1, INOUT);
  const quarter = wt("K17", "quarter");
  const red = wt("K17", "red");
  const launchers = [
    { a: "0x7a3f…e1b9", n: 52, tone: P.red },
    { a: "0x91c2…04d7", n: 38, tone: P.red },
    { a: "0xf3e8…9a2c", n: 27, tone: P.red },
    { a: "0x2b9e…c514", n: 15, tone: P.amber },
    { a: "0xb4d1…77c0", n: 7, tone: P.amber },
  ];
  return (
    <AbsoluteFill>
      <Field base={P.orange} glow={["rgba(255,210,63,0.7)", "rgba(255,93,93,0.5)"]} shapes={[P.yellow, P.white, P.violet, P.ink]} seed={6} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 70, opacity: 1 - side }}>
        <Title text="Then it groups them." t={t} at={k16 - 0.1} size={120} accent={{ groups: P.yellow }} out={fair - 0.5} />
      </div>
      {/* the group card */}
      <div style={{ position: "absolute", left: 960 - 700 - side * 260, top: 250, ...enter(t, one - 0.3, undefined, [0, 160]) }}>
        <Card x={0} y={0} w={1400} h={720} style={{ transform: `scale(${1 - side * 0.18})`, transformOrigin: "0 0" }}>
          <div style={{ background: P.ink, padding: "22px 36px", display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ width: 54, height: 54, background: P.yellow, borderRadius: 14, border: `5px solid ${P.white}` }} />
            <div style={{ fontFamily: FONT.head, fontWeight: 900, fontStretch: "75%", fontSize: 48, color: P.white }}>ONE SOURCE OF MONEY</div>
            <div style={{ fontFamily: FONT.mono, fontWeight: 600, fontSize: 34, color: P.yellow, marginLeft: "auto" }}>0x51e0…a3d2</div>
          </div>
          <div style={{ display: "flex", padding: "26px 36px", gap: 30 }}>
            <div style={{ flex: 1.5 }}>
              {launchers.map((l, i) => {
                const at = one + 0.2 + i * 0.15;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 18, height: 84, ...enter(t, at, undefined, [-120, 0]) }}>
                    <div style={{ width: 44, height: 44, borderRadius: 22, background: l.tone, border: `5px solid ${P.ink}` }} />
                    <div style={{ width: 280, fontFamily: FONT.mono, fontWeight: 600, fontSize: 30, color: P.ink }}>{l.a}</div>
                    <div style={{ flex: 1, height: 44, background: "rgba(22,17,46,0.07)", borderRadius: 22, overflow: "hidden", border: `4px solid ${P.ink}` }}>
                      <div style={{ width: `${(l.n / 52) * 100 * tw(t, exits - 0.2 + i * 0.08, exits + 0.8 + i * 0.08, 0, 1, OUT)}%`, height: "100%", background: l.tone }} />
                    </div>
                    <div style={{ width: 70, textAlign: "right", fontFamily: FONT.head, fontWeight: 900, fontStretch: "75%", fontSize: 44, color: P.ink }}>
                      <Count t={t} at={exits - 0.2 + i * 0.08} to={l.n} d={1} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
              {[
                { v: 5, k: "launchers", c: P.sky, at: five },
                { v: 139, k: "fast exits", c: P.coral, at: exits },
              ].map((s, i) => (
                <div key={i} style={{ background: s.c, border: `6px solid ${P.ink}`, borderRadius: 26, padding: "20px 30px", boxShadow: `8px 8px 0 ${P.ink}`, ...enter(t, s.at - 0.2, undefined, [80, 0]) }}>
                  <div style={{ fontFamily: FONT.head, fontWeight: 900, fontStretch: "72%", fontSize: 150, lineHeight: 0.95, color: P.ink }}>
                    <Count t={t} at={s.at - 0.15} to={s.v} d={1.2} />
                  </div>
                  <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 36, color: P.ink }}>{s.k}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
      {/* fairness: a quarter or more */}
      {side > 0.01 ? (
        <>
          <div style={{ position: "absolute", left: 1120, top: 70, width: 760, opacity: side }}>
            <Title text="Fair by rule." t={t} at={wt("K17", "fair") - 0.1} size={120} align="left" accent={{ rule: P.yellow }} />
          </div>
          <svg width={1920} height={1080} style={{ position: "absolute" }}>
            <g transform={`translate(1480 600) scale(${pop(t, quarter - 0.4, 0.6)})`}>
              <circle r={230} fill={P.ink} transform="translate(12 12)" />
              <circle r={230} fill={P.white} stroke={P.ink} strokeWidth={9} />
              <circle r={115} fill="none" stroke={P.red} strokeWidth={230} pathLength={100} strokeDasharray={`${25 * tw(t, quarter - 0.1, quarter + 0.6, 0, 1, OUT)} 100`} transform="rotate(-90)" />
              {[0, 90, 180, 270].map((a) => (
                <line key={a} x1={0} y1={0} x2={0} y2={-230} stroke={P.ink} strokeWidth={7} transform={`rotate(${a})`} />
              ))}
              <circle r={230} fill="none" stroke={P.ink} strokeWidth={9} />
              <text x={115} y={-80} textAnchor="middle" fontFamily={FONT.head} fontWeight={900} fontSize={70} fill={P.white} stroke={P.ink} strokeWidth={10} paintOrder="stroke" style={{ fontStretch: "72%" }} opacity={pop(t, quarter + 0.4, 0.4)}>
                25%
              </text>
            </g>
          </svg>
          <div style={{ position: "absolute", left: 1250, top: 900, ...enter(t, red - 0.1, undefined, [0, 40]) }}>
            <Chip color={P.red} ink={P.white} text="25%+ red = it counts" size={40} />
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
