import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Field } from "../trailer2/Field";
import { EndCard, Eyebrow, Finish, Glass, grad, Hud, Leaks, MONO, Obj, SANS, Space, Stamp, Title, tw } from "../trailer2/kit3d";
import { css } from "../trailer2/world";
import { cam, hit, LANE, leftCard, palette, Q, RESULT_Z, rightCard, SPEC, unlockAt, verdictAt, voteAt } from "./vesting";
import sheet from "./vesting.json";

/// Short 05: vesting and KEPT side by side through one year. Beat sheet: video/shorts/05-vesting-vs-kept.md.

const ROADMAP = ["Mobile app", "Mainnet", "Partnerships", "Token utility"];
const MILESTONES = ["Release v1.0.0", "Website live", "Contract deployed", "Pool earns 5 IMD"];

const LeftCard: React.FC<{ t: number; k: number }> = ({ t, k }) => {
  const u = unlockAt(k);
  const pct = Math.round(25 * k + 25 * tw(t, u, u + 0.4));
  return (
    <Glass t={t} at={Q.quarters[k] - 0.1} until={Q.quarters[k] + 2.3} w={560} h={340} edge={["#7b5cff", "#ff4a3d"]}>
      <div style={{ padding: "30px 36px" }}>
        <Eyebrow color="#b9a6ff">Vesting · month {3 * (k + 1)}</Eyebrow>
        <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", gap: 16 }}>
          <span style={{ fontFamily: MONO, fontSize: 84, fontWeight: 600, lineHeight: 1, ...grad("#ffd36b", "#ff9b3d") }}>{pct}%</span>
          <span style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.2em", color: "#ffd9a8" }}>UNLOCKED</span>
        </div>
        <div style={{ marginTop: 16, height: 12, borderRadius: 6, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#ffd36b,#ff9b3d)", boxShadow: "0 0 20px #ffb02e" }} />
        </div>
        <div style={{ marginTop: 26, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 30, fontWeight: 500 }}>
          {ROADMAP[k]}
          <span style={{ fontFamily: MONO, fontSize: 18, letterSpacing: "0.16em", padding: "6px 14px", borderRadius: 8, color: "#ff8a80", border: "2px solid #ff4a3d", opacity: tw(t, u + 0.3, u + 0.5) }}>NOT SHIPPED</span>
        </div>
      </div>
    </Glass>
  );
};

const RightCard: React.FC<{ t: number; k: number }> = ({ t, k }) => {
  const v = verdictAt(k);
  const kept = Q.kept[k];
  const yesCount = kept ? 8 : 2;
  const decided = t >= v;
  return (
    <Glass t={t} at={Q.quarters[k] - 0.1} until={Q.quarters[k] + 2.3} w={560} h={340} edge={decided ? (kept ? ["#39ff8e", "#34d8ff"] : ["#ff4a3d", "#ff9b3d"]) : ["#34d8ff", "#7b5cff"]}>
      <div style={{ padding: "30px 36px" }}>
        <Eyebrow color="#7fdcff">KEPT · milestone {k + 1}</Eyebrow>
        <div style={{ marginTop: 16, fontSize: 38, fontWeight: 600 }}>{MILESTONES[k]}</div>
        <div style={{ display: "flex", gap: 7, marginTop: 20 }}>
          {Array.from({ length: 9 }, (_, j) => {
            const at = voteAt(k, j);
            const on = t >= at;
            const yes = kept ? j !== 4 : j < 2;
            return <div key={j} style={{ flex: 1, height: 34, borderRadius: 8, background: on ? (yes ? "linear-gradient(180deg,#39ff8e,#1fbf6a)" : "linear-gradient(180deg,#ff6b62,#d93b33)") : "rgba(255,255,255,0.07)", boxShadow: on ? `0 0 18px ${yes ? "#39ff8e" : "#ff4a3d"}` : "none", transform: `scale(${on ? 1 + 0.25 * (1 - tw(t, at, at + 0.15)) : 1})` }} />;
          })}
        </div>
        <div style={{ marginTop: 20, fontFamily: MONO, fontSize: 26, letterSpacing: "0.08em", color: decided ? (kept ? "#39ff8e" : "#ff6b62") : "#9ab", opacity: decided ? 1 : 0.6 }}>
          {decided ? (kept ? `${yesCount}/9 · 25% PAID` : `${yesCount}/9 · 25% BURNED`) : "SWARM CHECKING…"}
        </div>
      </div>
      <Stamp t={t} at={v} until={Q.quarters[k] + 2.3} kind={kept ? "kept" : "broken"} />
    </Glass>
  );
};

const Counter: React.FC<{ t: number; side: "left" | "right" }> = ({ t, side }) => {
  const on = tw(t, Q.lanes, Q.lanes + 0.4) * (1 - tw(t, Q.result + 2.6, Q.result + 2.9));
  if (on <= 0) return null;
  const unlocked = Q.quarters.reduce((acc, _, k) => acc + 25 * tw(t, unlockAt(k), unlockAt(k) + 0.4), 0);
  const earned = Q.quarters.reduce((acc, _, k) => acc + (Q.kept[k] ? 25 * tw(t, verdictAt(k), verdictAt(k) + 0.4) : 0), 0);
  const burned = Q.quarters.reduce((acc, _, k) => acc + (!Q.kept[k] ? 25 * tw(t, verdictAt(k), verdictAt(k) + 0.4) : 0), 0);
  const shipped = Q.quarters.filter((_, k) => Q.kept[k] && t >= verdictAt(k)).length;
  const rows =
    side === "left"
      ? [
          ["UNLOCKED", `${Math.round(unlocked)}%`, "#ffd36b"],
          ["SHIPPED", "0", "#ff6b62"],
        ]
      : [
          ["EARNED", `${Math.round(earned)}%`, "#39ff8e"],
          ["BURNED", `${Math.round(burned)}%`, "#ff6b62"],
          ["SHIPPED", `${shipped}`, "#39ff8e"],
        ];
  return (
    <div style={{ position: "absolute", top: 128, [side]: 100, opacity: on, fontFamily: MONO, textAlign: side, transform: `translateY(${(1 - on) * -16}px)` } as React.CSSProperties}>
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 44, letterSpacing: "0.12em", ...(side === "left" ? grad("#b9a6ff", "#ff4a3d") : grad("#39ff8e", "#34d8ff")) }}>{side === "left" ? "VESTING" : "KEPT"}</div>
      <div style={{ fontSize: 16, letterSpacing: "0.3em", color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{side === "left" ? "PAYS FOR TIME" : "PAYS FOR PROOF"}</div>
      <div style={{ display: "flex", gap: 26, marginTop: 14, justifyContent: side === "left" ? "flex-start" : "flex-end" }}>
        {rows.map(([k, v, c]) => (
          <div key={k}>
            <div style={{ fontSize: 40, fontWeight: 600, color: c, textShadow: `0 0 18px ${c}` }}>{v}</div>
            <div style={{ fontSize: 14, letterSpacing: "0.24em", color: "rgba(255,255,255,0.7)" }}>{k}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Cards: React.FC<{ t: number }> = ({ t }) => {
  const res = tw(t, Q.result + 0.4, Q.result + 0.9);
  const resOut = tw(t, Q.timeNot - 0.3, Q.timeNot);
  return (
    <Space t={t} path={cam}>
      {/* lane labels */}
      {t > Q.lanes - 0.1 && t < Q.quarters[0] + 0.6
        ? (["left", "right"] as const).map((side) => {
            const p = tw(t, Q.lanes + (side === "right" ? 0.15 : 0), Q.lanes + 0.6);
            const o = 1 - tw(t, Q.quarters[0] + 0.2, Q.quarters[0] + 0.6);
            return (
              <Obj key={side} p={[side === "left" ? -LANE : LANE, 1.2, 2]} ry={side === "left" ? 0.2 : -0.2}>
                <div style={{ opacity: p * o, filter: `blur(${(1 - p) * 14}px)`, textAlign: "center", whiteSpace: "nowrap" }}>
                  <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 92, letterSpacing: "-0.03em", lineHeight: 1, ...(side === "left" ? grad("#b9a6ff", "#ff4a3d") : grad("#39ff8e", "#34d8ff")) }}>{side === "left" ? "VESTING" : "KEPT"}</div>
                  <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: "0.3em", color: "#fff", marginTop: 10 }}>{side === "left" ? "PAYS FOR TIME" : "PAYS FOR PROOF"}</div>
                </div>
              </Obj>
            );
          })
        : null}
      {Q.quarters.map((q, k) =>
        t > q - 0.2 && t < q + 2.4 ? (
          <React.Fragment key={k}>
            <Obj p={leftCard(k)} ry={0.28}>
              <LeftCard t={t} k={k} />
            </Obj>
            <Obj p={rightCard(k)} ry={-0.28}>
              <RightCard t={t} k={k} />
            </Obj>
          </React.Fragment>
        ) : null,
      )}
      {/* the result, side by side */}
      {t > Q.result && t < Q.timeNot ? (
        <>
          <Obj p={[-LANE * 0.85, 0.6, RESULT_Z]} ry={0.12}>
            <div style={{ opacity: res * (1 - resOut), filter: `blur(${(1 - res) * 14}px)`, textAlign: "center", whiteSpace: "nowrap" }}>
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 230, lineHeight: 1, ...grad("#ffd36b", "#ff9b3d") }}>100%</div>
              <div style={{ fontFamily: MONO, fontSize: 40, letterSpacing: "0.2em", color: "#ffd9a8", marginTop: 8 }}>UNLOCKED</div>
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 170, lineHeight: 1, marginTop: 40, ...grad("#ff6b62", "#ff4a3d") }}>0</div>
              <div style={{ fontFamily: MONO, fontSize: 40, letterSpacing: "0.2em", color: "#ffb3a8", marginTop: 8 }}>SHIPPED</div>
            </div>
          </Obj>
          <Obj p={[LANE * 0.85, 0.6, RESULT_Z]} ry={-0.12}>
            <div style={{ opacity: res * (1 - resOut), filter: `blur(${(1 - res) * 14}px)`, textAlign: "center", whiteSpace: "nowrap" }}>
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 230, lineHeight: 1, ...grad("#39ff8e", "#34d8ff") }}>75%</div>
              <div style={{ fontFamily: MONO, fontSize: 40, letterSpacing: "0.2em", color: "#b8ffd8", marginTop: 8 }}>EARNED · 25% BURNED</div>
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 170, lineHeight: 1, marginTop: 40, ...grad("#39ff8e", "#2de0c0") }}>3</div>
              <div style={{ fontFamily: MONO, fontSize: 40, letterSpacing: "0.2em", color: "#b8ffd8", marginTop: 8 }}>SHIPPED</div>
            </div>
          </Obj>
        </>
      ) : null}
    </Space>
  );
};

const VsTitle: React.FC<{ t: number }> = ({ t }) => {
  if (t > Q.lanes + 0.3) return null;
  const out = tw(t, Q.lanes - 0.1, Q.lanes + 0.3);
  const word = (s: string, at: number, style: React.CSSProperties) => {
    const p = tw(t, at, at + 0.4);
    return <span style={{ display: "inline-block", margin: "0 0.22em", opacity: p, transform: `scale(${1.4 - 0.4 * p})`, filter: `blur(${(1 - p) * 16}px) drop-shadow(0 4px 24px rgba(0,0,0,0.85))`, ...style }}>{s}</span>;
  };
  return (
    <div style={{ position: "absolute", top: 400, left: 0, right: 0, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 140, letterSpacing: "-0.03em", opacity: 1 - out, filter: `blur(${out * 12}px)` }}>
      {word("VESTING", Q.title, grad("#b9a6ff", "#ff4a3d"))}
      {word("vs", Q.title + 0.25, { fontSize: 70, fontWeight: 300, color: "#fff" })}
      {word("KEPT", Q.title + 0.45, grad("#39ff8e", "#34d8ff"))}
    </div>
  );
};

export const VestingVsKept: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const pal = palette(t);
  const h = hit(t);
  const scenes: [number, string][] = [
    [0, "VESTING vs KEPT"],
    ...Q.quarters.map((q, k) => [q, `MONTH ${3 * (k + 1)} · MILESTONE ${k + 1}`] as [number, string]),
    [Q.result, "ONE YEAR LATER"],
    [Q.timeNot, "THE DIFFERENCE"],
  ];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${1 + 0.04 * h})` }}>
        <AbsoluteFill style={{ background: `radial-gradient(1400px 900px at 50% 55%, ${css(pal.bg, 1)}, #000 75%)` }} />
        <Field spec={SPEC} />
        <Cards t={t} />
        <Leaks t={t} pal={pal} />
        <VsTitle t={t} />
        <Counter t={t} side="left" />
        <Counter t={t} side="right" />
        <Title t={t} at={Q.timeNot} until={Q.logo - 0.3} lines={["TIME ISN'T PROOF."]} size={110} y={300} colors={["#ff4a3d", "#ff9b3d"]} glitch />
        <Title t={t} at={Q.delivery} until={Q.logo - 0.3} lines={["DELIVERY IS."]} size={150} y={460} colors={["#39ff8e", "#ffd36b"]} />
        <EndCard t={t} at={Q.logo} />
      </AbsoluteFill>
      <Hud t={t} frame={frame} pal={pal} scenes={scenes} on={tw(t, 0.4, 1.0) * (1 - tw(t, Q.logo + 0.3, Q.logo + 1))} dots={Array.from({ length: 9 }, (_, j) => Q.quarters.some((_, k) => t >= voteAt(k, j)))} feed="KEPT // VESTING.DIFF" />
      <Finish t={t} frame={frame} pal={pal} hit={h} duration={sheet.duration} />
    </AbsoluteFill>
  );
};
