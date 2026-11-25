import React from "react";
import { AbsoluteFill } from "remotion";
import { Blob, CastDefs, Coin, Confetti, Sparkle } from "../explainer/cast";
import { Card, Chip, Field, FONT, INOUT, L, LE, OUT, P, Title, bounce, enter, pop, rnd, scene, tw, useSeconds, wt } from "./kit";

// ---------------------------------------------------------------------------------- shared art

/// A token as a coin with a face and a ticker.
export const Token: React.FC<{ x: number; y: number; s?: number; label?: string; mood?: "happy" | "sad" | "wow"; color?: string; rot?: number; opacity?: number }> = ({
  x,
  y,
  s = 1,
  label = "MOON",
  mood = "happy",
  color = P.yellow,
  rot = 0,
  opacity = 1,
}) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} opacity={opacity}>
    <circle r={78} fill={P.ink} transform="translate(9 9)" />
    <circle r={78} fill={color} stroke={P.ink} strokeWidth={8} />
    <circle r={60} fill="none" stroke={P.ink} strokeWidth={4} strokeDasharray="6 10" opacity={0.5} />
    <circle cx={-22} cy={-14} r={9} fill={P.ink} />
    <circle cx={22} cy={-14} r={9} fill={P.ink} />
    <circle cx={-19} cy={-17} r={3} fill={P.white} />
    <circle cx={25} cy={-17} r={3} fill={P.white} />
    {mood === "happy" ? <path d="M -22 12 Q 0 34 22 12" stroke={P.ink} strokeWidth={7} fill="none" strokeLinecap="round" /> : null}
    {mood === "sad" ? <path d="M -20 28 Q 0 10 20 28" stroke={P.ink} strokeWidth={7} fill="none" strokeLinecap="round" /> : null}
    {mood === "wow" ? <ellipse cx={0} cy={22} rx={11} ry={14} fill={P.ink} /> : null}
    <g transform="translate(0 112)">
      <rect x={-64} y={-22} width={128} height={44} rx={22} fill={P.white} stroke={P.ink} strokeWidth={6} />
      <text x={0} y={11} textAnchor="middle" fontFamily={FONT.head} fontWeight={850} fontSize={30} fill={P.ink} style={{ fontStretch: "75%" }}>
        ${label}
      </text>
    </g>
  </g>
);

/// The KEPT mark: an ink-outlined square with a check that draws itself, and the word.
export const Logo: React.FC<{ x: number; y: number; s?: number; draw?: number; word?: boolean; color?: string }> = ({ x, y, s = 1, draw = 1, word = true, color = P.ink }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x={-60} y={-60} width={120} height={120} rx={26} fill={P.ink} transform="translate(10 10)" />
    <rect x={-60} y={-60} width={120} height={120} rx={26} fill={P.white} stroke={P.ink} strokeWidth={9} />
    <path d="M -30 2 L -8 24 L 32 -22" stroke={P.green} strokeWidth={17} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
    {word ? (
      <text x={100} y={36} fontFamily={FONT.head} fontWeight={900} fontSize={112} fill={color} letterSpacing="0.14em" style={{ fontStretch: "100%" }}>
        KEPT
      </text>
    ) : null}
  </g>
);

const Puff: React.FC<{ x: number; y: number; t: number; at: number; n?: number; color?: string }> = ({ x, y, t, at, n = 9, color = P.white }) => {
  const u = t - at;
  if (u < 0 || u > 1.4) return null;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + rnd(i) * 0.6;
        const d = 40 + 140 * tw(u, 0, 1.2, 0, 1, OUT) * (0.6 + rnd(i + 4) * 0.6);
        const r = (26 + rnd(i + 2) * 26) * (1 - tw(u, 0.3, 1.4));
        return <circle key={i} cx={x + Math.cos(a) * d} cy={y + Math.sin(a) * d * 0.6 + u * 30} r={Math.max(0, r)} fill={color} stroke={P.ink} strokeWidth={5} />;
      })}
    </g>
  );
};

// ---------------------------------------------------------------------------------- 1. launch
export const Launch: React.FC = () => {
  const t = useSeconds();
  const s0 = scene("launch").start;
  const rug = wt("K2", "sells");
  const gone = wt("K2", "gone");
  const lift = tw(t, s0 + 0.2, s0 + 1.3, 0, 1, OUT);
  const tokY = 1250 - lift * 700 + Math.sin(t * 3) * 8 * lift;
  const chartP = tw(t, wt("K1", "chart"), rug, 0, 1, (x) => x);
  const crash = tw(t, rug + 0.15, rug + 0.9, 0, 1, INOUT);
  const red = tw(t, rug, rug + 0.6);
  // the chart: a climb with wiggles, then the cliff
  const pts = Array.from({ length: 40 }, (_, i) => {
    const u = i / 39;
    const y = 300 - u * 230 - Math.sin(u * 22) * 14 * u;
    return [40 + u * 620, y] as const;
  });
  const shown = Math.max(2, Math.floor(chartP * 40));
  const path = pts.slice(0, shown).map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ");
  const last = pts[shown - 1];
  const crashPath = crash > 0 ? `${path} L ${last[0] + 20} ${last[1] + crash * 300}` : path;
  const price = 0.0012 * (1 + chartP * 46) * (1 - crash * 0.97);
  const buyers: { x: number; skin: "blue" | "pink" | "mint" | "peach" | "lilac"; seed: number; side: number }[] = [
    { x: 240, skin: "blue", seed: 1, side: -1 },
    { x: 420, skin: "pink", seed: 2, side: -1 },
    { x: 600, skin: "mint", seed: 3, side: -1 },
    { x: 1330, skin: "peach", seed: 4, side: 1 },
    { x: 1500, skin: "lilac", seed: 5, side: 1 },
  ];
  const pile = wt("K1", "piles");
  const launcherIn = wt("K2", "wallet");
  const zoom = tw(t, gone, gone + 0.8, 0, 1, INOUT);
  return (
    <AbsoluteFill>
      <Field base={P.yellow} glow={["rgba(255,255,255,0.55)", "rgba(255,138,42,0.45)"]} shapes={[P.orange, P.white, P.ink, P.pink]} seed={1} />
      <AbsoluteFill style={{ background: P.coral, opacity: red * 0.92 }} />
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <CastDefs />
        {/* rocket trail */}
        {lift < 1 ? <path d={`M 960 1100 L 960 ${tokY + 80}`} stroke={P.ink} strokeWidth={10} strokeDasharray="20 18" opacity={0.6} /> : null}
        <Puff x={960} y={1060} t={t} at={s0 + 0.15} n={11} />
        {/* buyers pile in */}
        {buyers.map((b, i) => {
          const at = pile - 0.4 + i * 0.12;
          const p = pop(t, at, 0.6);
          const x = b.x + (1 - p) * 700 * b.side;
          const sad = t > rug + 0.3;
          return <Blob key={i} x={x} y={900 - Math.abs(Math.sin((t - at) * 8)) * 26 * (t < rug ? bounce(t, i * 0.2) : 0.2)} t={t} s={1.05} skin={b.skin} seed={b.seed} mood={sad ? "sad" : "joy"} arms={sad ? "down" : "up"} opacity={p} />;
        })}
        {/* coins flying in while buying, out when sold */}
        {Array.from({ length: 14 }, (_, i) => {
          const at = pile + i * 0.16;
          const u = tw(t, at, at + 0.7, 0, 1, INOUT);
          if (t < at || t > rug + 2.2) return null;
          const fromX = buyers[i % 5].x;
          const out = tw(t, rug + 0.1 + i * 0.05, rug + 0.9 + i * 0.05, 0, 1, INOUT);
          const x = fromX + (960 - fromX) * u + (1700 - 960) * out;
          const y = 820 - Math.sin(u * Math.PI) * 260 + (tokY - 820) * u + (760 - tokY) * out - Math.sin(out * Math.PI) * 200;
          return <Coin key={i} x={x} y={y} r={20} spin={t * 6 + i} opacity={u < 1 || out > 0 ? 1 : 0} />;
        })}
        <Token x={960 - crash * 40} y={tokY + crash * 30} s={1.15 - crash * 0.15} mood={t > rug + 0.2 ? "sad" : t > pile ? "wow" : "happy"} rot={crash * -14 + Math.sin(t * 2) * 3 * (1 - crash)} />
        {/* the launcher: a sly blob with a big bag, then gone */}
        {t > launcherIn - 0.5 ? (
          <g>
            <Blob
              x={1720 + (1 - pop(t, launcherIn - 0.3, 0.6)) * 400 + tw(t, gone - 0.2, gone + 0.6, 0, 1, INOUT) * 700}
              y={900}
              t={t}
              s={1.25}
              skin="lilac"
              seed={9}
              mood={t > rug ? "joy" : "happy"}
              arms={t > rug ? "up" : "hold"}
              holding="bag"
              look={-1}
            />
            {t > rug && t < gone + 0.6 ? (
              <text x={1720} y={620} textAnchor="middle" fontFamily={FONT.head} fontWeight={900} fontSize={60} fill={P.ink} opacity={pop(t, rug, 0.4)} style={{ fontStretch: "75%" }}>
                SOLD!
              </text>
            ) : null}
          </g>
        ) : null}
        <Sparkle x={1640} y={700} t={t} at={rug + 0.9} size={60} color={P.white} />
      </svg>
      {/* the chart card */}
      <div style={{ position: "absolute", left: 1180, top: 120, ...enter(t, wt("K1", "chart") - 0.4, undefined, [200, 0]) }}>
        <Card x={0} y={0} w={700} h={420} style={{ transform: `rotate(${2 - crash * 8}deg) translateY(${zoom * 900}px)` }}>
          <div style={{ padding: "22px 30px", display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: FONT.head, fontWeight: 850, fontStretch: "75%" }}>
            <span style={{ fontSize: 44, color: P.ink }}>$MOON</span>
            <span style={{ fontSize: 52, color: crash > 0.05 ? P.red : P.green, fontVariantNumeric: "tabular-nums" }}>${price.toFixed(4)}</span>
          </div>
          <svg width={700} height={330} style={{ position: "absolute", left: 0, top: 80 }}>
            {[80, 160, 240].map((y) => (
              <line key={y} x1={30} x2={670} y1={y} y2={y} stroke={P.ink} strokeOpacity={0.08} strokeWidth={3} />
            ))}
            <path d={`${path} L ${last[0]} 320 L 40 320 Z`} fill={crash > 0.05 ? P.red : P.green} opacity={0.16} />
            <path d={crashPath} stroke={crash > 0.05 ? P.red : P.green} strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={last[0] + (crash > 0 ? 20 : 0)} cy={last[1] + crash * 300} r={13} fill={crash > 0.05 ? P.red : P.green} stroke={P.ink} strokeWidth={5} />
          </svg>
        </Card>
      </div>
      {/* headlines */}
      <div style={{ position: "absolute", left: 80, top: 110, width: 1000 }}>
        <Title text="A new token" t={t} at={L("K1")} size={130} align="left" out={wt("K1", "chart") + 0.1} />
      </div>
      <div style={{ position: "absolute", left: 80, top: 110, width: 1000 }}>
        <Title text="Up only." t={t} at={wt("K1", "chart")} size={150} align="left" accent={{ only: P.green }} out={rug - 0.3} />
      </div>
      <div style={{ position: "absolute", left: 80, top: 110, width: 1050 }}>
        <Title text="Then the launcher sells." t={t} at={rug - 0.2} size={128} align="left" accent={{ sells: P.white }} accentInk={P.red} out={gone - 0.15} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 300 }}>
        <Title text="Gone." t={t} at={gone} size={330} out={scene("launch").end - 0.2} />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------- 2. again
const Disguise: React.FC<{ kind: number }> = ({ kind }) => {
  if (kind === 0)
    return (
      <g>
        <rect x={-48} y={-84} width={40} height={26} rx={8} fill={P.ink} />
        <rect x={8} y={-84} width={40} height={26} rx={8} fill={P.ink} />
        <path d="M -8 -72 H 8" stroke={P.ink} strokeWidth={6} />
      </g>
    );
  if (kind === 1)
    return (
      <g>
        <path d="M -70 -112 Q 0 -150 70 -112 L 54 -104 Q 0 -128 -54 -104 Z" fill={P.ink} />
        <rect x={-46} y={-168} width={92} height={62} rx={12} fill={P.ink} />
        <rect x={-46} y={-122} width={92} height={12} fill={P.coral} />
      </g>
    );
  return (
    <g>
      <path d="M -40 -44 Q -20 -30 0 -40 Q 20 -30 40 -44 Q 30 -22 0 -28 Q -30 -22 -40 -44 Z" fill={P.ink} />
      <circle cx={-22} cy={-72} r={17} fill="none" stroke={P.ink} strokeWidth={6} />
      <circle cx={22} cy={-72} r={17} fill="none" stroke={P.ink} strokeWidth={6} />
    </g>
  );
};

export const Again: React.FC = () => {
  const t = useSeconds();
  const sc = scene("again");
  const swaps = [L("K3") + 0.2, wt("K3", "again", 1), wt("K3", "wallet")];
  const k = swaps.filter((a) => t >= a).length - 1;
  const wallets = ["0x7a3f…e1b9", "0x91c2…04d7", "0xf3e8…9a2c"];
  const grid = L("K4") - 0.2;
  const gridIn = tw(t, grid, grid + 0.6, 0, 1, INOUT);
  const look = wt("K4", "tell");
  return (
    <AbsoluteFill>
      <Field base={P.violet} glow={["rgba(255,111,181,0.5)", "rgba(47,107,255,0.45)"]} shapes={[P.pink, P.yellow, P.white, P.mint]} seed={2} />
      {/* the repeat launcher, a new disguise each time */}
      <div style={{ opacity: 1 - gridIn, transform: `translateY(${gridIn * -200}px)` }}>
        <svg width={1920} height={1080} style={{ position: "absolute" }}>
          <CastDefs />
          {[0, 1, 2].map((i) => {
            const at = swaps[i];
            const p = pop(t, at, 0.5);
            const fall = tw(t, at + 0.55, at + 1.3, 0, 1, INOUT);
            if (t < at) return null;
            return (
              <g key={i} opacity={p}>
                <Token x={420 + i * 540} y={360 + fall * 120} s={0.8 * p} label={["MOON", "PEPE2", "ROCKET"][i]} mood={fall > 0.3 ? "sad" : "happy"} rot={fall * 18} color={[P.yellow, P.mint, P.orange][i]} />
                <path d={`M ${470 + i * 540} 250 l 90 ${70 * fall} l 30 ${120 * fall}`} stroke={P.red} strokeWidth={12} fill="none" strokeLinecap="round" opacity={fall} />
              </g>
            );
          })}
          <g transform={`translate(${960 + Math.sin(t * 2) * 30} 900)`}>
            <g transform={`scale(${1 + 0.15 * (1 - pop(t, swaps[Math.max(0, k)], 0.4))} ${1 - 0.15 * (1 - pop(t, swaps[Math.max(0, k)], 0.4))})`}>
              <Blob x={0} y={0} t={t} s={1.3} skin="lilac" seed={9} mood="happy" arms="wave" />
              <g transform="scale(1.3)">{k >= 0 ? <Disguise kind={k % 3} /> : null}</g>
            </g>
          </g>
        </svg>
        {k >= 0 ? (
          <div style={{ position: "absolute", left: 1140, top: 690, ...enter(t, swaps[k], undefined, [0, 30]) }}>
            <Chip color={P.white} text={`NEW WALLET ${wallets[k]}`} size={30} style={{ fontFamily: FONT.mono, fontStretch: "100%", textTransform: "none" }} />
          </div>
        ) : null}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 80 }}>
        <Title text="Again. And again." t={t} at={[wt("K3", "again"), wt("K3", "again"), wt("K3", "And"), wt("K3", "again", 1)]} size={150} accent={{ again: P.yellow }} out={grid - 0.4} />
      </div>
      {/* every token looks the same */}
      {t > grid - 0.1 ? (
        <>
          <svg width={1920} height={1080} style={{ position: "absolute" }}>
            {Array.from({ length: 10 }, (_, i) => {
              const col = i % 5;
              const row = Math.floor(i / 5);
              const at = grid + 0.1 + i * 0.07;
              const p = pop(t, at, 0.5);
              return <Token key={i} x={330 + col * 315} y={420 + row * 300 + Math.sin(t * 3 + i) * 6} s={0.72 * p} label={["DOGE3", "MOON", "CAT", "PEPE2", "AI", "FROG", "GEM", "SUN", "ROCKET", "WAGMI"][i]} color={[P.yellow, P.mint, P.orange, P.pink, P.sky][i % 5]} />;
            })}
            {/* the magnifier sweeps, finds nothing */}
            {t > look - 0.6 ? (
              <g transform={`translate(${330 + tw(t, look - 0.5, sc.end - 0.6, 0, 1, INOUT) * 1260} ${470 + Math.sin(t * 4) * 60})`}>
                <circle r={90} fill="rgba(255,255,255,0.25)" stroke={P.ink} strokeWidth={14} />
                <path d="M 64 64 L 150 150" stroke={P.ink} strokeWidth={30} strokeLinecap="round" />
                <text x={0} y={30} textAnchor="middle" fontFamily={FONT.head} fontWeight={900} fontSize={90} fill={P.ink}>
                  ?
                </text>
              </g>
            ) : null}
          </svg>
          <div style={{ position: "absolute", left: 0, right: 0, top: 80 }}>
            <Title text="No way to tell." t={t} at={wt("K4", "way") - 0.15} size={140} accent={{ tell: P.yellow }} />
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------- 3. meet
export const Meet: React.FC = () => {
  const t = useSeconds();
  const sc = scene("meet");
  const kept = wt("K5", "KEPT");
  const two = wt("K5", "2.0");
  const check = L("K6");
  const land = pop(t, kept - 0.1, 0.55);
  const squash = t > kept + 0.3 ? Math.exp(-(t - kept - 0.3) * 7) * Math.cos((t - kept - 0.3) * 20) * 0.12 : 0;
  const rays = 16;
  const lift = tw(t, check - 0.4, check + 0.3, 0, 1, INOUT);
  return (
    <AbsoluteFill>
      <Field base={P.mint} glow={["rgba(255,255,255,0.6)", "rgba(47,107,255,0.3)"]} shapes={[P.yellow, P.white, P.pink, P.ink, P.blue]} seed={3} n={26} />
      {/* a sunburst that turns */}
      <svg width={1920} height={1080} style={{ position: "absolute", opacity: 0.55 * tw(t, sc.start + 0.2, sc.start + 1) }}>
        <g transform={`translate(960 ${500 - lift * 120}) rotate(${t * 12})`}>
          {Array.from({ length: rays }, (_, i) => {
            const a0 = (i / rays) * Math.PI * 2;
            const a1 = a0 + Math.PI / rays;
            return <path key={i} d={`M 0 0 L ${Math.cos(a0) * 1500} ${Math.sin(a0) * 1500} L ${Math.cos(a1) * 1500} ${Math.sin(a1) * 1500} Z`} fill={[P.yellow, P.white, P.sky, P.pink][i % 4]} opacity={0.55} />;
          })}
        </g>
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 120 }}>
        <Title text="Until now." t={t} at={L("K5")} size={150} out={kept - 0.25} />
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <CastDefs />
        <g transform={`translate(0 ${-lift * 150})`}>
          <g transform={`translate(960 ${520 - (1 - land) * 700}) scale(${(1 + squash) * (0.6 + 0.4 * land)} ${(1 - squash) * (0.6 + 0.4 * land)}) translate(-960 -520)`} opacity={Math.min(1, land * 2)}>
            <Logo x={606} y={520} s={1.7} draw={tw(t, kept + 0.2, kept + 0.7)} />
          </g>
          {/* the 2.0 sticker spins on */}
          {t > two - 0.2 ? (
            <g transform={`translate(1600 ${330}) rotate(${(1 - pop(t, two - 0.1, 0.6)) * -260 + 12}) scale(${pop(t, two - 0.1, 0.6)})`}>
              <circle r={110} fill={P.ink} transform="translate(10 10)" />
              <circle r={110} fill={P.coral} stroke={P.ink} strokeWidth={9} />
              <text y={34} textAnchor="middle" fontFamily={FONT.head} fontWeight={900} fontSize={104} fill={P.white} style={{ fontStretch: "75%" }}>
                2.0
              </text>
            </g>
          ) : null}
        </g>
        <Confetti x={960} y={420} t={t} at={kept + 0.25} n={90} spread={1.6} seed={3} />
        <Confetti x={1600} y={330} t={t} at={two + 0.3} n={50} spread={1.1} seed={8} />
        <Sparkle x={560} y={330} t={t} at={kept + 0.4} size={70} color={P.white} />
        <Sparkle x={1600} y={620} t={t} at={two + 0.5} size={60} color={P.yellow} />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 650 }}>
        <Title text="Check before you buy." t={t} at={check} size={150} accent={{ buy: P.yellow }} stagger={0.11} />
      </div>
    </AbsoluteFill>
  );
};
