import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import sheet from "../trailer/trailer.json";
import { Field } from "./Field";
import { count, EndCard, Eyebrow, Finish, Glass, grad, Hud, Leaks, MONO, Obj, SANS, Space, Stamp, Title, tw } from "./kit3d";
import { A, C, css, E, F, G, H, hitAmount, milestonePos, paletteAt, Q, W } from "./world";

/// KEPT launch trailer v2: a flight through ten coloured scenes. Beat sheet:
/// video/shorts/04-launch-trailer-v2.md. Cues: src/trailer/trailer.json (shared with the score).

const ROWS = [
  ["Mobile app", "Q1"],
  ["Mainnet", "Q2"],
  ["Partnerships", "Q3"],
  ["Token utility", "Q4"],
];
const MILESTONES = [
  { t: "Release v1.0.0", s: "on GitHub", icon: "M8 8h14l10 10-14 14L8 22z", c: ["#ffb02e", "#ff6a2e"] },
  { t: "Website live", s: "keptmd.vercel.app", icon: "M6 8h28v24H6z M6 15h28", c: ["#ffd36b", "#ff8a3d"] },
  { t: "Contract deployed", s: "code at an address", icon: "M20 5l14 8v14l-14 8-14-8V13z M6 13l14 8 14-8 M20 21v14", c: ["#ff8a3d", "#ff4fd8"] },
  { t: "Pool earns 5 IMD", s: "an onchain number", icon: "M6 28a14 14 0 1 1 28 0 M20 26l7-9", c: ["#ffb02e", "#ffd36b"] },
];
const SIG = "0x7c1f9e2a04b38d55a1fa0e93c2d7b8a1ee4f0c27d93b5a18fbe2c40d9a7b3e1f";

// ---------------------------------------------------------------------------- the 3D cards
const Cards: React.FC<{ t: number }> = ({ t }) => {
  const quorum = Q.votes[7];
  const yes = Q.votes.filter((v, i) => i !== Q.no && t >= v).length;
  const burn = tw(t, Q.burn, Q.burn + 1.1, 0, 110, (x) => x);
  return (
    <Space t={t}>
      {t > Q.cardOn - 0.1 && t < Q.shatter + 0.05 ? (
        <Obj p={A}>
          <Glass t={t} at={Q.cardOn} until={Q.shatter} w={760} h={460} edge={t > Q.broken + 0.5 ? ["#ff3d5a", "#ff8a3d"] : ["#7b5cff", "#ff4fd8"]}>
            <div style={{ padding: "36px 46px", transform: t > Q.broken + 0.6 ? `translate(${Math.sin(t * 90) * 8}px, ${Math.cos(t * 70) * 4}px)` : undefined }}>
              <Eyebrow color={t > Q.broken + 0.5 ? "#ff6b7a" : "#c3adff"}>Roadmap · 2026</Eyebrow>
              {ROWS.map(([name, q], i) => {
                const st = Q.broken + 0.15 + i * 0.12;
                const struck = t > st;
                return (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: 18, marginTop: i ? 22 : 30, fontSize: 38, fontWeight: 500, color: struck ? "#ff7a72" : "#fff", position: "relative" }}>
                    <span style={{ width: 26, height: 26, borderRadius: 13, border: `3px solid ${struck ? "#ff3d5a" : "#c3adff"}` }} />
                    {name}
                    <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 22, color: "#c3adff" }}>{q}</span>
                    <span style={{ position: "absolute", left: 44, right: 60, top: "52%", height: 4, background: "#ff3d5a", boxShadow: "0 0 12px #ff3d5a", transformOrigin: "0 50%", transform: `scaleX(${tw(t, st, st + 0.2)})` }} />
                  </div>
                );
              })}
            </div>
          </Glass>
        </Obj>
      ) : null}

      {t > Q.pledge && t < Q.milestones + 0.2 ? (
        <Obj p={C}>
          <Glass t={t} at={Q.pledge + 0.2} until={Q.milestones + 0.15} w={820} h={480} edge={["#2de0c0", "#3ee6ff"]}>
            <div style={{ padding: "38px 48px" }}>
              <Eyebrow color="#2de0c0">New pledge</Eyebrow>
              {[
                ["Token", "KEPT"],
                ["Locked", count(t, Q.pledge + 0.2, 0.5, 300_000_000)],
                ["Milestones", "4"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 26, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <span style={{ fontSize: 26, color: "#9fe9df" }}>{k}</span>
                  <span style={{ fontFamily: MONO, fontSize: 42, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: 30, height: 72, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 600, color: "#02140f", background: "linear-gradient(90deg, #2de0c0, #3ecf7a)", transform: `scale(${t > Q.lockClick && t < Q.lockClick + 0.15 ? 0.95 : 1})`, boxShadow: t > Q.lockClick ? "0 0 70px #2de0c0" : "none" }}>
                {t > Q.lockClick ? "Locked in the vault ✓" : "Lock tokens"}
              </div>
            </div>
          </Glass>
        </Obj>
      ) : null}

      {t > Q.milestones && t < Q.deadline + 0.2
        ? MILESTONES.map((m, k) => {
            const mp = milestonePos(k);
            const locked = t > Q.locks[k];
            return (
              <Obj key={k} p={mp.p} ry={mp.ry}>
                <Glass t={t} at={Q.milestones + 0.25 + k * 0.08} until={Q.deadline + 0.15} w={380} h={300} edge={locked ? (m.c as [string, string]) : ["#55606a", "#2a3038"]}>
                  <div style={{ padding: 30, display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
                    <svg width={44} height={44} viewBox="0 0 40 40">
                      <path d={m.icon} fill="none" stroke={m.c[0]} strokeWidth={2.8} strokeLinejoin="round" />
                    </svg>
                    <div style={{ marginTop: 20, fontSize: 32, fontWeight: 600 }}>{m.t}</div>
                    <div style={{ marginTop: 6, fontSize: 19, color: "#ffd9a8", fontFamily: MONO }}>{m.s}</div>
                    <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 12, fontFamily: MONO, fontSize: 18, letterSpacing: "0.2em", color: locked ? m.c[0] : "#6b7580" }}>
                      <svg width={30} height={36} viewBox="0 0 40 48">
                        <path d={`M 10 ${22 - (1 - tw(t, Q.locks[k], Q.locks[k] + 0.15)) * 8} V 14 a 10 10 0 0 1 20 0 V ${22 - (1 - tw(t, Q.locks[k], Q.locks[k] + 0.15)) * 8}`} fill="none" stroke={locked ? m.c[0] : "#6b7580"} strokeWidth={4} />
                        <rect x={4} y={20} width={32} height={24} rx={6} fill={locked ? m.c[0] : "#6b7580"} />
                      </svg>
                      {locked ? "LOCKED" : "OPEN"}
                    </div>
                  </div>
                </Glass>
              </Obj>
            );
          })
        : null}

      {t > Q.deadline && t < Q.drop + 0.2 ? (
        <Obj p={E}>
          <Glass t={t} at={Q.deadline + 0.15} until={Q.drop + 0.1} w={560} h={300} edge={["#ff4a3d", "#3ecf7a"]}>
            <div style={{ padding: "34px 40px" }}>
              <Eyebrow color="#ff6b62">Deadline · now</Eyebrow>
              <div style={{ marginTop: 24, fontSize: 42, fontWeight: 600 }}>Release v1.0.0</div>
              <div style={{ marginTop: 8, fontSize: 21, color: "#9fe9c0", fontFamily: MONO }}>github.com/modemola/identity_md</div>
              <div style={{ marginTop: 24, fontSize: 23, color: "#cfe" }}>Proven or not? Nine agents decide.</div>
            </div>
          </Glass>
        </Obj>
      ) : null}

      {t > Q.drop - 0.05 && t < Q.brokenCard ? (
        <Obj p={F}>
          <Glass t={t} at={Q.drop} until={Q.brokenCard - 0.15} w={820} h={420} edge={t >= quorum ? ["#39ff8e", "#34d8ff"] : ["#34d8ff", "#ff4fd8"]}>
            <div style={{ padding: "34px 44px" }}>
              <Eyebrow color="#34d8ff">IMD oracle · live verdict</Eyebrow>
              <div style={{ marginTop: 16, fontSize: 29, color: "#e6f6ff", lineHeight: 1.35 }}>Does the KEPT repo have a published release v1.0.0?</div>
              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                {Q.votes.map((v, i) => {
                  const on = t >= v;
                  const yv = i !== Q.no;
                  return <div key={i} style={{ flex: 1, height: 46, borderRadius: 10, background: on ? (yv ? "linear-gradient(180deg,#39ff8e,#1fbf6a)" : "linear-gradient(180deg,#ff6b62,#d93b33)") : "rgba(255,255,255,0.07)", transform: `scale(${on ? 1 + 0.25 * (1 - tw(t, v, v + 0.2)) : 1})`, boxShadow: on ? `0 0 28px ${yv ? "#39ff8e" : "#ff4a3d"}` : "none" }} />;
                })}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginTop: 22 }}>
                <span style={{ fontFamily: MONO, fontSize: 76, fontWeight: 600, ...(yes >= 7 ? grad("#39ff8e", "#34d8ff") : { color: "#fff" }) }}>{yes} / 9</span>
                <span style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.22em", color: yes >= 7 ? "#39ff8e" : "#9ab" }}>{yes >= 7 ? "QUORUM REACHED" : "7 MUST AGREE"}</span>
              </div>
              <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 16, color: "#7fdcff", whiteSpace: "nowrap", overflow: "hidden" }}>{t > quorum + 0.15 ? `signed ${SIG.slice(0, Math.floor(tw(t, quorum + 0.15, quorum + 0.8, 0, SIG.length, (x) => x)))}` : ""}</div>
            </div>
            <Stamp t={t} at={Q.kept} until={Q.brokenCard - 0.15} kind="kept" />
          </Glass>
        </Obj>
      ) : null}

      {t > Q.stream && t < Q.brokenCard ? (
        <Obj p={W} ry={-0.35}>
          <Glass t={t} at={Q.stream + 0.4} until={Q.brokenCard - 0.1} w={460} h={230} edge={["#ffd36b", "#ff8a3d"]}>
            <div style={{ padding: "32px 38px" }}>
              <Eyebrow color="#ffd36b">Team wallet</Eyebrow>
              <div style={{ marginTop: 18, fontFamily: MONO, fontSize: 52, fontWeight: 600, ...grad("#fff3c4", "#ffb02e") }}>+{count(t, Q.stream + 0.5, 1.1, 50_000_000)}</div>
              <div style={{ marginTop: 4, fontSize: 22, color: "#ffd9a8" }}>KEPT released by the swarm</div>
            </div>
          </Glass>
        </Obj>
      ) : null}

      {t > Q.brokenCard && t < Q.burn + 1.4 ? (
        <Obj p={G}>
          <div style={{ WebkitMaskImage: `linear-gradient(0deg, transparent ${burn}%, #000 ${burn + 12}%)`, maskImage: `linear-gradient(0deg, transparent ${burn}%, #000 ${burn + 12}%)` }}>
            <Glass t={t} at={Q.brokenCard + 0.1} until={Q.burn + 1.3} w={760} h={360} edge={["#ff4a3d", "#ff9b3d"]}>
              <div style={{ padding: "36px 44px" }}>
                <Eyebrow color="#ff6b62">Deadline passed</Eyebrow>
                <div style={{ marginTop: 22, fontSize: 46, fontWeight: 600 }}>Pool earns 5 IMD</div>
                <div style={{ marginTop: 10, fontSize: 24, color: "#ffb3a8", fontFamily: MONO }}>2 / 9 agree · not proven</div>
                <div style={{ marginTop: 28, fontSize: 27, ...grad("#ff9b3d", "#ff4a3d") }}>150,000,000 KEPT → 0x…dEaD</div>
              </div>
              <Stamp t={t} at={Q.brokenCard + 0.25} until={Q.burn + 1.3} kind="broken" />
            </Glass>
          </div>
        </Obj>
      ) : null}

      {[
        { big: "300,000,000", small: "KEPT locked by its own team", c: ["#8fa8ff", "#c3adff"] },
        { big: "2 / 2", small: "promises confirmed by the swarm", c: ["#39ff8e", "#2de0c0"] },
        { big: "LIVE", small: "on Robinhood Chain", c: ["#ffd36b", "#ff8a3d"] },
      ].map((s, i) => {
        const a = Q.stats[i];
        const b = i < 2 ? Q.stats[i + 1] - 0.15 : Q.tagline - 0.25;
        if (t < a - 0.1 || t > b) return null;
        const p = tw(t, a, a + 0.35);
        return (
          <Obj key={i} p={H[i]}>
            <div style={{ textAlign: "center", opacity: p, filter: `blur(${(1 - p) * 14}px)`, whiteSpace: "nowrap" }}>
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 160, letterSpacing: "-0.05em", lineHeight: 1, ...grad(s.c[0], s.c[1]), filter: `drop-shadow(0 0 40px ${s.c[0]})` }}>{s.big}</div>
              <div style={{ fontFamily: MONO, fontSize: 30, letterSpacing: "0.22em", color: "#fff", textTransform: "uppercase", marginTop: 14 }}>{s.small}</div>
            </div>
          </Obj>
        );
      })}
    </Space>
  );
};

// ---------------------------------------------------------------------------- overlays
const SCENES: [number, string][] = [
  [0, "01 PROMISE"],
  [Q.sphere, "02 SWARM"],
  [Q.pledge, "03 PLEDGE"],
  [Q.milestones, "04 MILESTONES"],
  [Q.deadline, "05 DEADLINE"],
  [Q.drop, "06 VERDICT"],
  [Q.kept, "07 PAYOUT"],
  [Q.brokenCard, "08 BURN"],
  [Q.stats[0], "09 PROOF"],
  [Q.tagline, "10 KEPT"],
];
/// Titles: screen-space, in the scene's gradient.
const Titles: React.FC<{ t: number }> = ({ t }) => (
  <>
    <Title t={t} at={Q.promise} until={Q.cardForm + 0.15} lines={["EVERY ROADMAP", "IS A PROMISE."]} size={118} y={360} colors={["#c3adff", "#ff4fd8"]} />
    <Title t={t} at={Q.broken} until={Q.shatter + 0.1} lines={["MOST GET BROKEN."]} size={92} y={140} colors={["#ff3d5a", "#ff8a3d"]} glitch />
    <Title t={t} at={Q.introducing} until={Q.seal - 0.2} lines={["INTRODUCING"]} size={40} y={515} colors={["#3ee6ff", "#7fb8ff"]} tracking="0.55em" weight={500} />
    <Title t={t} at={Q.seal + 0.05} until={Q.pledge - 0.05} lines={["KEPT"]} size={170} y={720} colors={["#ffffff", "#9dffcf"]} tracking="0.3em" />
    <Title t={t} at={Q.milestones + 0.15} until={Q.deadline} lines={["LOCKED BEHIND MILESTONES"]} size={62} y={120} colors={["#ffd36b", "#ff6a2e"]} />
    <Title t={t} at={Q.deadline + 0.1} until={Q.drop - 0.05} lines={["THE DEADLINE HITS.", "THE SWARM CHECKS."]} size={64} y={110} colors={["#3ecf7a", "#3ee6ff"]} />
    <Title t={t} at={Q.kept + 0.25} until={Q.brokenCard - 0.1} lines={["KEPT? PAID."]} size={80} y={110} colors={["#ffd36b", "#39ff8e"]} />
    <Title t={t} at={Q.burn - 0.2} until={Q.stats[0] - 0.15} lines={["BROKEN? BURNED."]} size={84} y={110} colors={["#ff4a3d", "#ffb02e"]} glitch />
    <Title t={t} at={Q.tagline} until={Q.logo - 0.35} lines={["PROMISES THE", "SWARM ENFORCES."]} size={124} y={340} colors={["#c3adff", "#3ecf7a"]} />
  </>
);

export const Trailer2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const pal = paletteAt(t);
  const hit = hitAmount(t);
  const punch = 1 + 0.04 * hit;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${punch})` }}>
        <AbsoluteFill style={{ background: `radial-gradient(1400px 900px at 50% 55%, ${css(pal.bg, 1)}, #000 75%)` }} />
        <Field />
        <Cards t={t} />
        <Leaks t={t} pal={pal} />
        <Titles t={t} />
        <EndCard t={t} at={Q.logo} />
      </AbsoluteFill>
      <Hud t={t} frame={frame} pal={pal} scenes={SCENES} on={tw(t, 0.4, 1.0) * (1 - tw(t, Q.logo + 0.5, Q.logo + 1.2))} dots={Q.votes.map((v) => t > v)} />
      <Finish t={t} frame={frame} pal={pal} hit={hit} duration={sheet.duration} />
    </AbsoluteFill>
  );
};
