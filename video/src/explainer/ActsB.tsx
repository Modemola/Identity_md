import React from "react";
import { AbsoluteFill } from "remotion";
import { C, F, INOUT } from "../theme";
import { Seal } from "../ui/Marks";
import { Svg } from "./ActsA";
import { Blob, Bubble, Coin, Confetti, Dust, Skin, Sparkle } from "./cast";
import { bob, drop, Kinetic, line, pop, scene, Stage, thud, tw, useSeconds, wordTimes, wt } from "./kit";
import { Meter, Slot, Vault } from "./props";

const FLOOR = 880;

/// Act 4: builders and talkers look the same from outside; trust drains.
export const Trust: React.FC = () => {
  const t = useSeconds();
  const s = scene("trust");
  const E7 = line("E7");
  const bAt = wt("E7", "builders");
  const tAt = wt("E7", "talkers");
  const sameAt = wt("E7", "same") - 0.3;
  const trustAt = wt("E8", "trust");
  const honestAt = wt("E8", "honest");
  const reveal = (a: number) => t > a && t < sameAt;
  const trust = 0.92 - 0.72 * tw(t, trustAt - 0.2, trustAt + 1.4, 0, 1, INOUT);
  const back = tw(t, trustAt, trustAt + 0.8, 0, 1, INOUT);
  const eq = pop(t, sameAt, 0.45);
  const tag = (x: number, at: number, label: string, col: string) => {
    const p = pop(t, at, 0.4);
    const q = pop(t, sameAt, 0.4);
    const showLabel = t < sameAt;
    return (
      <g transform={`translate(${x} 300)`}>
        <g transform={`scale(${showLabel ? p : q})`}>
          <rect x={-130} y={-46} width={260} height={74} rx={37} fill={showLabel ? col : "#2a302e"} />
          <text x={0} y={6} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={showLabel ? 32 : 44} fill={showLabel ? "#0b0d0c" : "#fff"} letterSpacing={3}>
            {showLabel ? label : "?"}
          </text>
        </g>
      </g>
    );
  };
  return (
    <AbsoluteFill>
      <Stage light="rgba(127,184,255,0.12)" at={[50, 40]} />
      <Svg>
        {/* two stages */}
        {[640, 1280].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={FLOOR + 6} rx={200} ry={26} fill="rgba(255,255,255,0.06)" />
            <path d={`M ${x - 150} 140 L ${x - 230} ${FLOOR} L ${x + 230} ${FLOOR} L ${x + 150} 140 Z`} fill="rgba(255,255,255,0.03)" />
          </g>
        ))}
        {t > bAt - 0.1 ? tag(640, bAt, "BUILDER", C.ok) : null}
        {t > tAt - 0.1 ? tag(1280, tAt, "TALKER", C.alarm) : null}
        <Blob x={640} y={FLOOR} t={t} s={1.6} skin="team" hat mood={t > honestAt ? "worried" : "happy"} arms={reveal(bAt) ? "none" : "wave"} holding={reveal(bAt) ? "laptop" : null} seed={2} look={0.2} sq={Math.max(0, bob(t)) * 0.04} />
        <Blob x={1280} y={FLOOR} t={t} s={1.6} skin="team" hat mood="happy" arms={reveal(tAt) ? "none" : "wave"} holding={reveal(tAt) ? "megaphone" : null} seed={2} look={-0.2} flip sq={Math.max(0, bob(t, 0.5)) * 0.04} />
        <Bubble x={640} y={520} t={t} at={E7.start + 0.2} until={bAt - 0.1} text="we're building!" size={28} tail="down" />
        <Bubble x={1280} y={520} t={t} at={E7.start + 0.35} until={tAt - 0.1} text="we're building!" size={28} tail="down" />
        <g transform={`translate(960 640) scale(${eq})`}>
          <rect x={-60} y={-34} width={120} height={22} rx={11} fill="#fff" />
          <rect x={-60} y={12} width={120} height={22} rx={11} fill="#fff" />
        </g>
        {/* the honest team pays */}
        <g transform={`translate(400 520) scale(${pop(t, honestAt + 0.2, 0.4)})`}>
          <path d="M 0 -80 L 0 40" stroke={C.alarm} strokeWidth={22} strokeLinecap="round" />
          <path d="M -46 0 L 0 52 L 46 0" stroke={C.alarm} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
        {(["pink", "lilac", "peach"] as Skin[]).map((k, i) => {
          const x = [180, 960, 1740][i] + (i === 0 ? -1 : i === 2 ? 1 : 0) * 120 * back;
          return <Blob key={k} x={x} y={1170 + 60 * back} t={t} s={1.7} skin={k} mood={t > trustAt ? "worried" : "wow"} look={Math.sin(t * 2.2 + i)} seed={i * 4} />;
        })}
      </Svg>
      <div style={{ position: "absolute", top: 40, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: pop(t, trustAt - 0.5, 0.4) }}>
        <svg width={760} height={110} viewBox="-380 -60 760 110" style={{ overflow: "visible" }}>
          <Meter x={0} y={0} w={700} v={trust} label="TRUST" t={t} at={trustAt - 0.5} />
        </svg>
      </div>
      <div style={{ position: "absolute", top: 70, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: t < trustAt - 0.6 ? 1 : 0 }}>
        <Kinetic text="WHO'S ACTUALLY BUILDING?" t={t} at={s.start + 0.3} size={64} accent={{ BUILDING: C.ok }} out={trustAt - 0.9} />
      </div>
    </AbsoluteFill>
  );
};

/// Act 5: the question, then the seal drops: meet KEPT.
export const Meet: React.FC = () => {
  const t = useSeconds();
  const E10 = line("E10");
  const wts = wordTimes("E9");
  const words = line("E9").caption.split(" ");
  const cut = 5;
  const out = E10.start - 0.35;
  const sealAt = E10.start - 0.1;
  const land = sealAt + 0.38;
  const flash = tw(t, land, land + 0.05) * (1 - tw(t, land + 0.05, land + 0.5));
  return (
    <AbsoluteFill>
      <Stage light={`rgba(62,207,122,${0.12 + 0.2 * tw(t, land, land + 0.6)})`} at={[50, 42]} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: t < out + 0.4 ? 1 : 0 }}>
        <Kinetic text={words.slice(0, cut).join(" ")} t={t} at={wts.slice(0, cut)} size={84} out={out} />
        <div style={{ height: 16 }} />
        <Kinetic text={words.slice(cut).join(" ")} t={t} at={wts.slice(cut)} size={84} accent={{ kept: C.ok }} out={out} />
      </AbsoluteFill>
      <Svg>
        <Dust x={960} y={640} t={t} at={land} w={1.6} />
        <Confetti x={960} y={520} t={t} at={land} n={110} spread={1.2} seed={11} />
        <Sparkle x={1180} y={260} t={t} at={land + 0.3} size={60} />
        <Sparkle x={720} y={380} t={t} at={land + 0.5} size={40} />
        {(["pink", "mint"] as Skin[]).map((k, i) => {
          const up = pop(t, land + 0.3 + i * 0.1, 0.5);
          return <Blob key={k} x={i ? 1700 : 220} y={1180 + (1 - up) * 300 - Math.max(0, bob(t, i * 0.5)) * 24} t={t} s={2} skin={k} mood="joy" arms="up" look={i ? -0.8 : 0.8} seed={i * 7} />;
        })}
      </Svg>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 170, opacity: t > sealAt ? 1 : 0 }}>
        <div style={{ transform: `translateY(${drop(t, sealAt, 800)}px) scale(${1 + thud(t, land) * 0.6}, ${1 - thud(t, land) * 0.6})` }}>
          <Seal t={t} at={sealAt + 0.2} size={300} spin={(t - sealAt) * 8} />
        </div>
        <div style={{ marginTop: 34, display: "flex", gap: 0, fontFamily: F.mono, fontWeight: 600, fontSize: 150, letterSpacing: "0.28em", marginRight: "-0.28em", color: C.ink }}>
          {"KEPT".split("").map((ch, i) => {
            const p = pop(t, wt("E10", "KEPT") + i * 0.08, 0.45);
            return (
              <span key={i} style={{ display: "inline-block", transform: `translateY(${(1 - p) * 60}px) scale(${p})`, opacity: Math.min(1, p * 2) }}>
                {ch}
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: 8, fontFamily: F.mono, fontSize: 44, color: C.ink2, opacity: pop(t, E10.end + 0.3, 0.5), transform: `translateY(${(1 - pop(t, E10.end + 0.3, 0.5)) * 20}px)` }}>
          Promises the <span style={{ color: C.ok }}>swarm</span> enforces.
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff", opacity: flash * 0.5 }} />
    </AbsoluteFill>
  );
};

/// Act 6: the vault and its milestones.
const MILESTONES: { icon: Slot["icon"]; label: string; long: string; word: string; nth?: number }[] = [
  { icon: "tag", label: "Release", long: "Ship a release on GitHub", word: "release" },
  { icon: "page", label: "Website", long: "Put the website live", word: "website" },
  { icon: "cube", label: "Contract", long: "Deploy the contract", word: "Deploy" },
  { icon: "gauge", label: "Number", long: "Hit a number onchain", word: "number" },
];

export const VaultAct: React.FC = () => {
  const t = useSeconds();
  const s = scene("vault");
  const E11 = line("E11");
  const dropAt = s.start + 0.15;
  const land = dropAt + 0.38;
  const throwAt = wt("E11", "locks") - 0.1;
  const splitAt = wt("E11", "split");
  const checkAt = wt("E11", "anyone");
  const msAt = MILESTONES.map((m) => wt("E12", m.word) - 0.15);
  const W = 760;
  const sw = 150;
  const gap = (W - 80 - 4 * sw) / 3;
  const slotX = (i: number) => 960 - W / 2 + 40 + i * (sw + gap) + sw / 2;
  const throws = Array.from({ length: 12 }, (_, k) => ({ k, slot: k % 4, at: throwAt + k * 0.12 }));
  const cur = msAt.reduce((acc, a, i) => (t >= a ? i : acc), -1);
  const slots: Slot[] = MILESTONES.map((m, i) => {
    const landed = throws.filter((th) => th.slot === i && t > th.at + 0.55).length;
    return {
      icon: m.icon,
      label: m.label,
      coins: 1 + landed,
      open: 1 - tw(t, splitAt + i * 0.15, splitAt + i * 0.15 + 0.25),
      show: pop(t, msAt[i], 0.4),
      lift: 18 * pop(t, msAt[i], 0.3) * (1 - tw(t, msAt[i] + 0.5, msAt[i] + 0.9)),
      tint: cur === i ? C.ok : undefined,
    };
  });
  return (
    <AbsoluteFill>
      <Stage light="rgba(62,207,122,0.14)" at={[50, 46]} />
      <Svg>
        <Vault x={960} y={FLOOR + drop(t, dropAt, 900)} t={t} s={1} slots={slots} wheel={t * 40} />
        <Dust x={960} y={FLOOR} t={t} at={land} w={2} />
        {throws.map(({ k, slot, at }) => {
          if (t < at || t > at + 0.6) return null;
          const u = tw(t, at, at + 0.55, 0, 1, (x) => x);
          const x0 = 330, y0 = 700, x1 = slotX(slot), y1 = 600;
          return <Coin key={k} x={x0 + (x1 - x0) * u} y={y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * 300} r={26} spin={t * 10 + k} />;
        })}
        <Blob x={300} y={FLOOR} t={t} s={1.4} skin="team" hat mood="happy" arms={t > throwAt && t < throwAt + 1.6 ? (Math.floor((t - throwAt) / 0.12) % 2 ? "wave" : "point") : "down"} look={0.8} seed={2} />
        <Blob x={1640 - 40 * pop(t, checkAt, 0.5)} y={FLOOR} t={t} s={1.3} skin="blue" mood="happy" arms="none" holding="glass" flip look={-0.8} seed={9} opacity={pop(t, checkAt - 0.1, 0.3)} />
        <Bubble x={1640} y={FLOOR - 230} t={t} at={checkAt + 0.3} until={msAt[0] - 0.2} text="I can check!" size={28} tail="down" />
        {MILESTONES.map((m, i) => (
          <Sparkle key={i} x={slotX(i)} y={490} t={t} at={msAt[i] + 0.1} size={36} />
        ))}
      </Svg>
      <div style={{ position: "absolute", top: 70, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: t < msAt[0] - 0.3 ? 1 : 0 }}>
        <Kinetic text="LOCK IT. SPLIT IT. CHECK IT." t={t} at={[E11.start + 0.1, E11.start + 0.2, splitAt, splitAt + 0.1, checkAt, checkAt + 0.1]} size={70} accent={{ "CHECK": C.ok }} out={msAt[0] - 0.6} />
      </div>
      {MILESTONES.map((m, i) => {
        const on = pop(t, msAt[i], 0.4) * (1 - tw(t, (msAt[i + 1] ?? s.end) - 0.25, msAt[i + 1] ?? s.end));
        if (on <= 0.001) return null;
        return (
          <div key={i} style={{ position: "absolute", top: 120, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: Math.min(1, on * 1.5) }}>
            <div style={{ transform: `scale(${on})`, display: "flex", alignItems: "center", gap: 22, padding: "18px 34px", borderRadius: 999, background: "#0d1110", border: `3px solid ${C.ok}`, boxShadow: "0 0 40px rgba(62,207,122,0.3)" }}>
              <span style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 30, color: "#0b0d0c", background: C.ok, borderRadius: 999, width: 52, height: 52, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
              <span style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 54, color: C.ink }}>{m.long}</span>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
