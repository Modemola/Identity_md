import React from "react";
import { AbsoluteFill } from "remotion";
import { INOUT, L, LE, OUT, rnd, scene, tw, useSeconds, wt } from "./kit";
import { Glass, Kicker, Mark, Mesh, MONO, rise, SANS, SERIF, V, Words, HEAD } from "./mg";

// ---------------------------------------------------------------------------------- a clean chart
/// A price line that climbs with small wiggles; after `crash` it drops off a cliff and turns red.
const Chart: React.FC<{ t: number; at: number; until: number; crash: number; w: number; h: number; seed?: number; thin?: boolean }> = ({ t, at, until, crash, w, h, seed = 0, thin }) => {
  const n = 60;
  const p = tw(t, at, until, 0, 1, (x) => x);
  const c = tw(t, crash, crash + 0.7, 0, 1, INOUT);
  const red = tw(t, crash, crash + 0.3);
  const pts = Array.from({ length: n }, (_, i) => {
    const u = i / (n - 1);
    const y = h * 0.86 - u * h * 0.7 - Math.sin(u * 19 + seed) * h * 0.035 * (0.3 + u) - Math.sin(u * 47 + seed * 2) * h * 0.012;
    return [u * w * 0.92, y] as const;
  });
  const k = Math.max(2, Math.floor(p * n));
  const shown = pts.slice(0, k);
  const last = shown[shown.length - 1];
  const drop: [number, number][] = c > 0 ? [[last[0] + w * 0.03 * c, last[1] + (h * 0.95 - last[1]) * c]] : [];
  const all = [...shown, ...drop];
  const d = all.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const head = all[all.length - 1];
  const col = red > 0.5 ? V.red : V.green;
  const id = `g${seed}`;
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity={0.28} />
          <stop offset="100%" stopColor={col} stopOpacity={0} />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={0} x2={w} y1={h * g} y2={h * g} stroke="#0f0d1a" strokeOpacity={0.06} strokeWidth={1.5} />
      ))}
      <path d={`${d} L ${head[0]} ${h} L 0 ${h} Z`} fill={`url(#${id})`} />
      <path d={d} stroke={col} strokeWidth={thin ? 3 : 5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={head[0]} cy={head[1]} r={thin ? 6 : 10} fill={col} />
      <circle cx={head[0]} cy={head[1]} r={(thin ? 12 : 22) + Math.sin(t * 6) * 3} fill={col} opacity={0.2} />
    </svg>
  );
};

// ---------------------------------------------------------------------------------- 1. launch
export const Launch: React.FC = () => {
  const t = useSeconds();
  const sc = scene("launch");
  const sells = wt("K2", "sells");
  const gone = wt("K2", "gone");
  const piles = wt("K1", "piles");
  const cool = tw(t, sells, sells + 1.2, 0, 1, INOUT);
  const cardOut = gone - 0.15;
  const price = 0.00041 * (1 + 52 * tw(t, wt("K1", "chart"), sells, 0, 1, (x) => x * x)) * (1 - 0.96 * tw(t, sells, sells + 0.7, 0, 1, INOUT));
  const buys = Array.from({ length: 9 }, (_, i) => ({ at: piles - 0.2 + i * 0.22, side: i % 2 ? 1 : -1, eth: (0.2 + rnd(i + 3) * 2.4).toFixed(2), y: 330 + (i % 5) * 92 }));
  return (
    <AbsoluteFill>
      <Mesh t={t} colors={["#ffb36b", "#ff6a88", "#ffd66e", "#ff8f5a"]} base="#fff4ea" seed={1} k={tw(t, 0, 1.4)} />
      <AbsoluteFill style={{ opacity: cool }}>
        <Mesh t={t} colors={["#3b1a4a", "#ff3b5c", "#5a1d3a", "#c42d4f"]} base="#1a0d1c" seed={2} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 64, display: "flex", justifyContent: "center" }}>
        <Kicker t={t} at={0.5} out={sells - 0.4} text="vibe/vibe · launched just now" dot={V.green} color="rgba(40,20,30,0.75)" />
      </div>
      {/* buyers piling in: transactions stream toward the card */}
      {buys.map((b, i) => {
        const u = tw(t, b.at, b.at + 1.1, 0, 1, OUT);
        if (t < b.at || t > sells + 0.2) return null;
        const x = b.side < 0 ? 170 + u * 260 : 1750 - u * 260 - 220;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: b.y, opacity: Math.sin(u * Math.PI) * 1.4, filter: `blur(${(1 - Math.sin(u * Math.PI)) * 4}px)` }}>
            <Glass r={999} style={{ padding: "12px 22px", fontFamily: MONO, fontSize: 22, color: V.ink, display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ color: V.green, fontWeight: 600 }}>BUY</span> +{b.eth} ETH
            </Glass>
          </div>
        );
      })}
      {/* the token card */}
      <div style={{ position: "absolute", left: 510, top: 250, ...rise(t, L("K1") - 0.3, cardOut, 60) }}>
        <Glass style={{ width: 900, height: 560, padding: "38px 46px", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 500, color: "#6b6676" }}>Moon Coin</div>
              <div style={{ fontFamily: SANS, fontSize: 52, fontWeight: 700, color: V.ink, letterSpacing: "-0.02em" }}>$MOON</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: SANS, fontSize: 48, fontWeight: 600, color: V.ink, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>${price.toFixed(5)}</div>
              <div style={{ fontFamily: SANS, fontSize: 24, fontWeight: 600, color: t > sells + 0.2 ? V.red : V.green, fontVariantNumeric: "tabular-nums" }}>
                {t > sells + 0.2 ? "−96.1%" : `+${Math.round(5200 * tw(t, wt("K1", "chart"), sells, 0, 1, (x) => x * x))}%`}
              </div>
            </div>
          </div>
          <div style={{ position: "absolute", left: 46, top: 190 }}>
            <Chart t={t} at={wt("K1", "chart") - 0.3} until={sells} crash={sells} w={810} h={320} seed={1} />
          </div>
        </Glass>
      </div>
      {/* the launcher sells */}
      <div style={{ position: "absolute", left: 1130, top: 190, ...rise(t, sells - 0.25, cardOut, 30) }}>
        <Glass dark r={999} style={{ padding: "16px 28px", fontFamily: MONO, fontSize: 24, color: "#fff", display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ width: 12, height: 12, borderRadius: 6, background: V.red, boxShadow: `0 0 16px ${V.red}` }} />
          Launcher 0x7a3f…e1b9 <span style={{ color: V.red, fontWeight: 600 }}>SELL 98%</span>
        </Glass>
      </div>
      {/* headlines */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 128 }}>
        <Words text="A new token *launches.*" t={t} at={L("K1") - 0.1} out={wt("K1", "chart") - 0.2} size={88} color={V.ink} accent="#e2456a" />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 128 }}>
        <Words text="Everyone *piles in.*" t={t} at={piles - 0.15} out={LE("K1") + 1.4} size={88} color={V.ink} accent="#e2456a" />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 860 }}>
        <Words text="Then the launcher *sells.*" t={t} at={sells - 0.35} out={gone - 0.3} size={76} color="#fff" accent="#ff7b8c" />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 400 }}>
        <Words text="*Gone.*" t={t} at={gone} out={sc.end - 0.45} size={240} color="#fff" accent="#fff" />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------- 2. again
export const Again: React.FC = () => {
  const t = useSeconds();
  const sc = scene("again");
  const hits = [L("K3") + 0.1, wt("K3", "again", 1) - 0.1, wt("K3", "wallet") - 0.3];
  const wallets = ["0x7a3f…e1b9", "0x91c2…04d7", "0xf3e8…9a2c"];
  const tickers = ["$MOON", "$PEPE2", "$ROCKET"];
  const grid = L("K4") - 0.4;
  const g = tw(t, grid - 0.5, grid + 0.3, 0, 1, INOUT);
  return (
    <AbsoluteFill>
      <Mesh t={t} colors={["#7b5cff", "#d35cff", "#3f7cff", "#ff6fb5"]} base="#1b1033" seed={3} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 150 }}>
        <Words text="Again. And *again.*" t={t} at={wt("K3", "again") - 0.2} out={grid - 0.4} size={110} color="#fff" accent="#ffc2ef" stagger={0.18} />
      </div>
      {/* three launches, three wallets, the same ending */}
      <div style={{ opacity: 1 - g, filter: g > 0.01 ? `blur(${g * 14}px)` : undefined }}>
        {hits.map((at, i) => (
          <div key={i} style={{ position: "absolute", left: 150 + i * 560, top: 400, ...rise(t, at, undefined, 50) }}>
            <Glass style={{ width: 500, height: 380, padding: "28px 32px", boxSizing: "border-box" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontFamily: SANS, fontSize: 36, fontWeight: 700, color: V.ink }}>{tickers[i]}</div>
                <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 600, color: t > at + 1.2 ? V.red : V.green, marginTop: 8 }}>{t > at + 1.2 ? "rugged" : "live"}</div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 20, color: "#6b6676", marginTop: 6 }}>new wallet {wallets[i]}</div>
              <div style={{ position: "absolute", left: 32, top: 130 }}>
                <Chart t={t} at={at + 0.1} until={at + 1.1} crash={at + 1.15} w={436} h={210} seed={i + 4} thin />
              </div>
            </Glass>
          </div>
        ))}
      </div>
      {/* launch day: every token looks the same */}
      {t > grid - 0.3 ? (
        <>
          {Array.from({ length: 15 }, (_, i) => {
            const col = i % 5;
            const row = Math.floor(i / 5);
            const at = grid + 0.05 + (col + row) * 0.06;
            const sweep = tw(t, wt("K4", "Every") - 0.3, sc.end - 0.6);
            const lit = Math.abs(sweep * 6 - (col + row * 0.5)) < 0.6;
            return (
              <div key={i} style={{ position: "absolute", left: 150 + col * 336, top: 360 + row * 190, ...rise(t, at, undefined, 40) }}>
                <Glass r={22} style={{ width: 300, height: 160, padding: "20px 24px", boxSizing: "border-box", background: lit ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.7)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 20, background: "linear-gradient(135deg,#d9d6e4,#f3f1f8)" }} />
                    <div>
                      <div style={{ width: 120, height: 14, borderRadius: 7, background: "#d9d6e4" }} />
                      <div style={{ width: 80, height: 10, borderRadius: 5, background: "#e9e7ef", marginTop: 8 }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 26, fontFamily: SANS, fontSize: 18, color: "#8a8594" }}>
                    <span>launched just now</span>
                    <span style={{ fontWeight: 700, color: "#b7b3c2" }}>?</span>
                  </div>
                </Glass>
              </div>
            );
          })}
          <div style={{ position: "absolute", left: 0, right: 0, top: 150 }}>
            <Words text="No way to *tell.*" t={t} at={wt("K4", "way") - 0.2} size={110} color="#fff" accent="#ffc2ef" />
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
  const intro = tw(t, sc.start + 0.3, sc.start + 1.1, 0, 1, OUT);
  const logoP = tw(t, kept - 0.15, kept + 0.6, 0, 1, OUT);
  const up = tw(t, check - 0.5, check + 0.2, 0, 1, INOUT);
  const bloom = tw(t, kept - 0.2, kept + 1.6, 0, 1, OUT);
  return (
    <AbsoluteFill style={{ background: "#ffffff" }}>
      {/* a bloom of colour behind the mark */}
      <AbsoluteFill style={{ opacity: bloom * 0.95, transform: `scale(${0.6 + 0.4 * bloom})` }}>
        <Mesh t={t} colors={["#ffb36b", "#7b5cff", "#2ee6a8", "#ff6fb5"]} base="#ffffff" seed={5} grain={0} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(700px 520px at 50% 48%, rgba(255,255,255,0.92), rgba(255,255,255,0) 75%)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 500, opacity: intro * (1 - tw(t, kept - 0.6, kept - 0.1)), filter: `blur(${(1 - intro) * 10 + tw(t, kept - 0.6, kept - 0.1) * 10}px)`, textAlign: "center", fontFamily: SERIF, fontSize: 54, color: V.ink, letterSpacing: "0.01em" }}>
        Introducing
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 380 - up * 90, display: "flex", justifyContent: "center", alignItems: "center", gap: 40, opacity: logoP, filter: `blur(${(1 - logoP) * 18}px)`, transform: `scale(${0.92 + 0.08 * logoP})` }}>
        <Mark size={190} draw={tw(t, kept + 0.1, kept + 0.8, 0, 1, OUT)} />
        <div style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 168, letterSpacing: "0.16em", color: V.ink, fontStretch: "110%" }}>KEPT</div>
        <div
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: 190,
            marginLeft: -20,
            background: "linear-gradient(120deg,#ff6a88,#7b5cff 50%,#19b46b)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            opacity: tw(t, two - 0.1, two + 0.5),
            filter: `blur(${(1 - tw(t, two - 0.1, two + 0.5)) * 14}px)`,
            transform: `translateX(${(1 - tw(t, two - 0.1, two + 0.6, 0, 1, OUT)) * 40}px)`,
          }}
        >
          2.0
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 640 }}>
        <Words text="Check before you *buy.*" t={t} at={check - 0.1} size={92} color={V.ink} accent="#7b5cff" stagger={0.1} />
      </div>
    </AbsoluteFill>
  );
};
