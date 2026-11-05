import React from "react";
import { AbsoluteFill } from "remotion";
import { C, F, INOUT } from "../theme";
import { Browser, Seal } from "../ui/Marks";
import { Svg } from "./ActsA";
import { Agent, Blob, Bubble, Coin, Confetti, Dust, Skin, Sparkle, Fire } from "./cast";
import { bob, Kinetic, line, pop, rnd, scene, Stage, tw, useSeconds, wt } from "./kit";
import { Evidence, Poster } from "./props";

const FLOOR = 880;
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/// A rubber stamp that slams down.
export const StampMark: React.FC<{ x: number; y: number; t: number; at: number; kind: "kept" | "broken"; s?: number }> = ({ x, y, t, at, kind, s = 1 }) => {
  if (t < at) return null;
  const u = tw(t, at, at + 0.16, 0, 1, (k) => k * k);
  const sc = lerp(3, 1, u);
  const col = kind === "kept" ? C.ok : C.alarm;
  const word = kind === "kept" ? "KEPT" : "BROKEN";
  const w = kind === "kept" ? 300 : 380;
  return (
    <g transform={`translate(${x} ${y}) rotate(${kind === "kept" ? -9 : 8}) scale(${sc * s})`} opacity={u}>
      <rect x={-w / 2} y={-56} width={w} height={112} rx={14} fill="rgba(0,0,0,0.35)" stroke={col} strokeWidth={10} />
      <text x={kind === "kept" ? -24 : -26} y={24} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={66} fill={col} letterSpacing={6}>
        {word}
      </text>
      {kind === "kept" ? (
        <path d="M 92 -6 L 108 12 L 132 -22" stroke={col} strokeWidth={11} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M 128 -20 L 160 16 M 160 -20 L 128 16" stroke={col} strokeWidth={11} fill="none" strokeLinecap="round" />
      )}
    </g>
  );
};
const shake = (t: number, at: number, amp = 18) => (t < at + 0.14 ? 0 : amp * Math.exp(-(t - at - 0.14) * 10) * Math.sin((t - at) * 70));

/// Act 7: the deadline, then nine agents check and vote.
export const SwarmAct: React.FC = () => {
  const t = useSeconds();
  const s = scene("swarm");
  const hitAt = wt("E13", "hits");
  const nobodyAt = wt("E13", "nobody");
  const wordAt = wt("E13", "word");
  const swarmAt = wt("E14", "swarm") - 0.2;
  const lookAt = wt("E14", "look") - 0.2;
  const agreeAt = wt("E14", "agree") - 0.2;
  const voteAt = (i: number) => agreeAt + 0.6 + i * 0.3;
  const votes = Array.from({ length: 9 }, (_, i) => ({ i, yes: i !== 5, at: voteAt(i) }));
  const yes = votes.filter((v) => v.yes && t >= v.at).length;
  const quorumAt = votes.filter((v) => v.yes)[6].at;
  const clockOut = tw(t, swarmAt - 0.3, swarmAt + 0.2);
  const ring = t > hitAt ? Math.sin(t * 60) * 7 * (1 - tw(t, hitAt + 1.4, hitAt + 1.8)) : 0;
  const cards = [
    { x: 480, icon: "tag" as const, title: "GitHub", sub: "release v1.0.0" },
    { x: 960, icon: "page" as const, title: "Website", sub: "is it live?" },
    { x: 1440, icon: "gauge" as const, title: "Onchain", sub: "the number" },
  ];
  const cardsOn = t > lookAt - 0.3 && t < agreeAt + 0.5;
  return (
    <AbsoluteFill>
      <Stage light="rgba(62,207,122,0.14)" at={[50, 36]} />
      <Svg>
        {/* the deadline clock */}
        <g transform={`translate(960 400) rotate(${ring}) scale(${pop(t, s.start + 0.1, 0.5) * (1 - clockOut)})`}>
          <circle r={170} fill="#f4f1e8" stroke="#16181a" strokeWidth={12} />
          <circle cx={-120} cy={-150} r={46} fill={C.alarm} />
          <circle cx={120} cy={-150} r={46} fill={C.alarm} />
          {Array.from({ length: 12 }, (_, k) => (
            <rect key={k} x={-4} y={-150} width={8} height={k % 3 ? 14 : 26} fill="#16181a" transform={`rotate(${k * 30})`} />
          ))}
          <rect x={-6} y={-120} width={12} height={124} rx={6} fill="#16181a" transform={`rotate(${tw(t, s.start, hitAt, -120, 0)})`} />
          <rect x={-5} y={-90} width={10} height={94} rx={5} fill={C.alarm} transform={`rotate(${tw(t, s.start, hitAt, -720, 0)})`} />
          <circle r={14} fill="#16181a" />
          <text x={0} y={250} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={48} fill={C.alarm} letterSpacing={8} opacity={pop(t, hitAt, 0.3)}>
            DEADLINE
          </text>
        </g>
        {t > hitAt
          ? [0, 1, 2].map((k) => {
              const u = ((t - hitAt) * 1.6 + k / 3) % 1;
              return <circle key={k} cx={960} cy={400} r={180 + u * 160} fill="none" stroke={C.alarm} strokeWidth={6} opacity={(1 - u) * 0.6 * (1 - clockOut) * (1 - tw(t, hitAt + 1.4, hitAt + 1.8))} />;
            })
          : null}
        <g opacity={1 - clockOut}>
          <Blob x={330} y={FLOOR} t={t} s={1.4} skin="team" hat mood={t > wordAt + 0.2 ? "worried" : "happy"} arms="wave" look={0.7} seed={2} />
          <Bubble x={430} y={FLOOR - 250} t={t} at={nobodyAt - 0.3} until={swarmAt} text="trust me, it's done" size={28} tail="left" />
          <g transform={`translate(430 ${FLOOR - 290}) rotate(-8) scale(${pop(t, wordAt, 0.3)})`}>
            <rect x={-110} y={-40} width={220} height={80} rx={10} fill="none" stroke={C.alarm} strokeWidth={8} />
            <text x={0} y={18} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={52} fill={C.alarm} letterSpacing={6}>
              NOPE
            </text>
          </g>
        </g>
        {/* the evidence */}
        {cardsOn
          ? cards.map((c, k) => (
              <g key={k} opacity={1 - tw(t, agreeAt, agreeAt + 0.4)}>
                <Evidence x={c.x} y={760} t={t} at={lookAt - 0.3 + k * 0.1} icon={c.icon} title={c.title} sub={c.sub} ok={t > lookAt + 1.6 + k * 0.3 ? 1 : 0} />
              </g>
            ))
          : null}
        {/* the swarm */}
        {Array.from({ length: 9 }, (_, i) => {
          const a = swarmAt + i * 0.07;
          if (t < a) return null;
          const e1 = tw(t, a, a + 0.8, 0, 1, INOUT);
          const e2 = tw(t, lookAt + i * 0.05, lookAt + 0.6 + i * 0.05, 0, 1, INOUT);
          const e3 = tw(t, agreeAt, agreeAt + 0.6, 0, 1, INOUT);
          const rowX = 240 + i * 180;
          const rowY = 300;
          const cx = cards[Math.floor(i / 3)].x + ((i % 3) - 1) * 120;
          const cy = 540;
          let x = lerp(2200 - i * 40, rowX, e1) - Math.sin(e1 * Math.PI) * 200;
          let y = lerp(-200, rowY, e1);
          x = lerp(x, cx, e2);
          y = lerp(y, cy, e2) - Math.sin(e2 * Math.PI) * 80;
          x = lerp(x, rowX, e3);
          y = lerp(y, rowY, e3);
          const v = votes[i];
          const state = t >= v.at ? (v.yes ? "yes" : "no") : e2 > 0.5 && e3 < 0.5 ? "scan" : "idle";
          const beam = e2 * (1 - e3);
          return (
            <g key={i}>
              {beam > 0.05 ? <path d={`M ${x - 14} ${y + 30} L ${x + 14} ${y + 30} L ${x + 60} 700 L ${x - 60} 700 Z`} fill={C.ok} opacity={0.12 * beam * (0.7 + 0.3 * Math.sin(t * 12 + i))} /> : null}
              <Agent x={x} y={y} t={t} s={0.95} state={state} seed={i} tilt={(1 - e1) * -20 + (e2 - e3) * 0} />
              <Sparkle x={x} y={y - 40} t={t} at={v.at} size={26} color={v.yes ? C.ok : C.alarm} />
            </g>
          );
        })}
        {/* the vote */}
        <g opacity={tw(t, agreeAt + 0.3, agreeAt + 0.7)} transform="translate(960 640)">
          {votes.map((v, i) => {
            const on = t >= v.at;
            const x = (i - 4) * 104;
            return (
              <g key={i} transform={`translate(${x} 0) scale(${on ? 1 + 0.25 * (1 - tw(t, v.at, v.at + 0.3)) : 1})`}>
                <rect x={-44} y={-44} width={88} height={88} rx={16} fill={on ? (v.yes ? C.ok : "#3a2422") : "#121614"} stroke={on ? (v.yes ? C.ok : C.alarm) : "rgba(255,255,255,0.2)"} strokeWidth={3} />
              </g>
            );
          })}
          <line x1={(6 - 4) * 104 + 52} y1={-70} x2={(6 - 4) * 104 + 52} y2={70} stroke="#fff" strokeWidth={4} strokeDasharray="8 8" opacity={0.6} />
          <text x={(6 - 4) * 104 + 52} y={-86} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={22} fill="#fff" opacity={0.7} letterSpacing={2}>
            7 NEEDED
          </text>
          <text x={0} y={150} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={96} fill={yes >= 7 ? C.ok : "#fff"}>
            {yes} / 9
          </text>
        </g>
        <g transform={`translate(960 ${FLOOR - 20}) scale(${pop(t, quorumAt, 0.4)})`}>
          <rect x={-190} y={-50} width={380} height={84} rx={42} fill={C.ok} />
          <text x={0} y={10} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={46} fill="#0b0d0c" letterSpacing={6}>
            QUORUM!
          </text>
        </g>
        <Confetti x={960} y={760} t={t} at={quorumAt} n={90} seed={21} />
      </Svg>
      <div style={{ position: "absolute", top: 60, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: t > lookAt + 0.2 && t < agreeAt + 0.2 ? 1 : 0 }}>
        <Kinetic text="9 AGENTS CHECK FOR THEMSELVES" t={t} at={lookAt + 0.2} size={56} accent={{ "9": C.ok }} out={agreeAt - 0.2} />
      </div>
    </AbsoluteFill>
  );
};

/// Act 8: kept pays the team; broken burns.
export const VerdictAct: React.FC = () => {
  const t = useSeconds();
  const s = scene("verdict");
  const keptAt = wt("E15", "kept") + 0.1;
  const goAt = wt("E15", "go") - 0.2;
  const brokenAt = wt("E16", "broken") + 0.1;
  const burnAt = wt("E16", "burn") - 0.2;
  const goneAt = wt("E16", "Gone");
  const sx = shake(t, keptAt) + shake(t, brokenAt);
  const fireK = tw(t, burnAt, burnAt + 0.6) * (1 - tw(t, s.end - 1.2, s.end - 0.2));
  const card = (x: number, title: string, at: number) => {
    const p = pop(t, at, 0.5);
    return (
      <g transform={`translate(${x} 270) scale(${p})`}>
        <rect x={-270} y={-80} width={540} height={160} rx={20} fill="#0f1312" stroke="rgba(255,255,255,0.25)" strokeWidth={3} />
        <text x={-230} y={-22} fontFamily={F.mono} fontWeight={500} fontSize={22} fill="rgba(255,255,255,0.55)" letterSpacing={4}>
          MILESTONE
        </text>
        <text x={-230} y={30} fontFamily={F.mono} fontWeight={600} fontSize={44} fill="#fff">
          {title}
        </text>
      </g>
    );
  };
  return (
    <AbsoluteFill style={{ transform: `translate(${sx}px, ${sx * 0.4}px)` }}>
      <Stage light="rgba(62,207,122,0.10)" at={[25, 40]} />
      <AbsoluteFill style={{ left: 960, background: `radial-gradient(700px 600px at 50% 60%, rgba(255,107,98,${0.06 + 0.14 * fireK}), transparent 70%)` }} />
      <Svg>
        <line x1={960} y1={60} x2={960} y2={FLOOR} stroke="rgba(255,255,255,0.15)" strokeWidth={3} strokeDasharray="10 12" />
        {card(480, "Ship the app", s.start + 0.1)}
        {card(1440, "Grow the pool", s.start + 0.3)}
        <StampMark x={480} y={440} t={t} at={keptAt} kind="kept" s={0.95} />
        <StampMark x={1440} y={440} t={t} at={brokenAt} kind="broken" s={0.95} />
        {/* kept: coins rain onto the team */}
        {Array.from({ length: 14 }, (_, k) => {
          const a = goAt + k * 0.09;
          if (t < a) return null;
          const u = tw(t, a, a + 0.7, 0, 1, (x) => x);
          const x = lerp(480 + (rnd(k) - 0.5) * 300, 480 + (rnd(k + 3) - 0.5) * 140, u);
          const y = lerp(380, FLOOR - 120, u * u);
          return <Coin key={k} x={x} y={y} r={26} spin={t * 9 + k} opacity={1 - tw(t, a + 0.62, a + 0.72)} />;
        })}
        <Blob x={480} y={FLOOR - Math.max(0, t > goAt ? bob(t * 1.5) : 0) * 40} t={t} s={1.5} skin="team" hat mood={t > keptAt ? "joy" : "wow"} arms={t > keptAt ? "up" : "down"} seed={2} />
        <Confetti x={480} y={700} t={t} at={keptAt + 0.1} n={80} seed={31} />
        <Sparkle x={300} y={560} t={t} at={goAt + 0.6} size={40} color="#ffe9a3" />
        {/* broken: coins fall into the fire */}
        <path d={`M 1240 ${FLOOR} L 1280 ${FLOOR - 40} L 1600 ${FLOOR - 40} L 1640 ${FLOOR} Z`} fill="#2a1d1a" stroke="#5a3a33" strokeWidth={4} />
        {Array.from({ length: 12 }, (_, k) => {
          const a = burnAt + k * 0.1;
          if (t < a) return null;
          const u = tw(t, a, a + 0.6, 0, 1, (x) => x * x);
          const ash = tw(t, goneAt, goneAt + 0.5);
          const x = 1440 + (rnd(k + 9) - 0.5) * 300;
          const y = lerp(380, FLOOR - 60, u);
          return u < 1 ? <Coin key={k} x={x} y={y} r={24} spin={t * 7 + k} /> : <circle key={k} cx={x} cy={FLOOR - 60 - ash * 200 * rnd(k)} r={6 * (1 - ash)} fill="#555" opacity={1 - ash} />;
        })}
        <Fire x={1440} y={FLOOR - 40} t={t} k={fireK} w={320} />
        <Blob x={1760} y={FLOOR} t={t} s={1.0} skin="team" hat mood={t > brokenAt ? "worried" : "neutral"} look={-0.8} seed={2} />
        <text x={1440} y={FLOOR + 80} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={34} fill={C.alarm} letterSpacing={4} opacity={pop(t, goneAt, 0.4)}>
          GONE FOR GOOD
        </text>
        <text x={480} y={FLOOR + 80} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={34} fill={C.ok} letterSpacing={4} opacity={pop(t, goAt + 0.6, 0.4)}>
          PAID TO THE TEAM
        </text>
      </Svg>
    </AbsoluteFill>
  );
};

/// Act 9: it's live; the real numbers.
export const Real: React.FC = () => {
  const t = useSeconds();
  const s = scene("real");
  const E17 = line("E17");
  const lockedAt = wt("E17", "locked");
  const chainAt = wt("E17", "Robinhood");
  const twoAt = wt("E17", "two");
  const count = Math.round(300_000_000 * tw(t, lockedAt, lockedAt + 1.4, 0, 1, INOUT));
  const card = pop(t, s.start + 0.6, 0.6);
  return (
    <AbsoluteFill>
      <Stage light="rgba(62,207,122,0.16)" at={[35, 45]} />
      <div style={{ position: "absolute", top: 70, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Kinetic text="AND IT'S REAL." t={t} at={E17.start - 0.05} size={80} accent={{ "REAL": C.ok }} />
      </div>
      <div style={{ position: "absolute", left: 90, top: 240, perspective: 1600 }}>
        <div style={{ transform: `rotateY(${14 - 4 * card}deg) rotateX(4deg) scale(${0.6 + 0.4 * card}) translateY(${(1 - card) * 200}px)`, opacity: Math.min(1, card * 1.4), transformOrigin: "50% 50%" }}>
          <Browser src="shots/pledge-full.png" width={900} pageH={1912} cam={{ x: 720, y: 520 + 60 * tw(t, s.start + 1, s.end, 0, 1, (x) => x), zoom: 1.15 }} url="keptmd.vercel.app/#/pledge/1" />
        </div>
      </div>
      <div style={{ position: "absolute", left: 1090, top: 250, width: 760, fontFamily: F.mono }}>
        {[
          { at: lockedAt, big: count.toLocaleString("en-US"), small: "KEPT LOCKED BY ITS OWN TEAM", col: C.ink },
          { at: chainAt, big: "Robinhood Chain", small: "LIVE ONCHAIN, TODAY", col: C.caution },
          { at: twoAt, big: "2 / 2", small: "PROMISES CONFIRMED BY THE SWARM", col: C.ok },
        ].map((row, i) => {
          const p = pop(t, row.at, 0.5);
          return (
            <div key={i} style={{ marginBottom: 46, opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * 80}px) scale(${0.85 + 0.15 * p})`, transformOrigin: "0 50%" }}>
              <div style={{ fontSize: i === 1 ? 64 : 86, fontWeight: 600, color: row.col, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{row.big}</div>
              <div style={{ fontSize: 24, letterSpacing: "0.18em", color: C.dim, marginTop: 4 }}>{row.small}</div>
            </div>
          );
        })}
      </div>
      <Svg>
        {[0, 1].map((k) => (
          <g key={k} transform={`translate(${1500 + k * 190} ${640}) rotate(${-8 + k * 6}) scale(${pop(t, twoAt + 0.4 + k * 0.25, 0.35) * 0.55})`}>
            <rect x={-150} y={-56} width={300} height={112} rx={14} fill="rgba(0,0,0,0.35)" stroke={C.ok} strokeWidth={10} />
            <text x={-24} y={24} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={66} fill={C.ok} letterSpacing={6}>
              KEPT
            </text>
            <path d="M 92 -6 L 108 12 L 132 -22" stroke={C.ok} strokeWidth={11} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
        <Confetti x={1600} y={640} t={t} at={twoAt + 0.6} n={60} seed={41} />
        {[0, 1, 2].map((k) => (
          <Agent key={k} x={1200 + k * 150} y={880} t={t} s={0.7 * pop(t, twoAt + 0.2 + k * 0.1, 0.4)} state={t > twoAt + 0.5 ? "yes" : "idle"} seed={k + 3} />
        ))}
      </Svg>
    </AbsoluteFill>
  );
};

/// Act 10: don't trust the roadmap, check it.
export const End: React.FC = () => {
  const t = useSeconds();
  const E18 = line("E18");
  const E19 = line("E19");
  const mapAt = E18.start - 0.5;
  const checkAt = wt("E18", "Check") - 0.1;
  const logoAt = E19.start - 0.2;
  const posterOut = tw(t, logoAt - 0.6, logoAt - 0.1, 0, 1, INOUT);
  const cast: { kind: "blob" | "agent"; skin?: Skin; x: number }[] = [
    { kind: "blob", skin: "pink", x: 170 },
    { kind: "agent", x: 380 },
    { kind: "blob", skin: "team", x: 590 },
    { kind: "agent", x: 1330 },
    { kind: "blob", skin: "lilac", x: 1540 },
    { kind: "blob", skin: "mint", x: 1750 },
  ];
  return (
    <AbsoluteFill>
      <Stage light={`rgba(62,207,122,${0.12 + 0.1 * tw(t, logoAt, logoAt + 1)})`} at={[50, 40]} />
      <Svg>
        <g opacity={1 - posterOut} transform={`translate(${-200 * posterOut} 0)`}>
          <Poster x={600} y={330} t={t} at={mapAt} s={0.9} crossAt={wt("E18", "roadmap") + 0.1} items={[{ label: "Mobile app", at: mapAt + 0.4 }, { label: "Mainnet", at: mapAt + 0.5 }, { label: "Partnerships", at: mapAt + 0.6 }]} />
        </g>
        <Dust x={600} y={FLOOR} t={t} at={mapAt + 0.38} />
        {cast.map((c, i) => {
          const up = pop(t, logoAt + 0.3 + i * 0.07, 0.5);
          const hop = Math.max(0, bob(t, i * 0.3)) * 22;
          const y = FLOOR + 40 + (1 - up) * 400 - hop;
          return c.kind === "blob" ? (
            <Blob key={i} x={c.x} y={y} t={t} s={1.15} skin={c.skin!} hat={c.skin === "team"} mood="joy" arms="up" seed={i * 5} look={c.x < 960 ? 0.6 : -0.6} />
          ) : (
            <Agent key={i} x={c.x} y={y - 120} t={t} s={0.9} state="yes" seed={i} />
          );
        })}
        <Confetti x={960} y={420} t={t} at={logoAt + 0.5} n={120} spread={1.3} seed={51} />
      </Svg>
      <div style={{ position: "absolute", top: 90, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: 1 - posterOut }}>
        <Kinetic text="DON'T TRUST THE ROADMAP." t={t} at={E18.start - 0.05} size={70} accent={{ "DON'T": C.alarm }} />
      </div>
      <div style={{ position: "absolute", top: 400, left: 960, width: 900, display: "flex", justifyContent: "center", opacity: 1 - posterOut }}>
        <Kinetic text="CHECK IT." t={t} at={checkAt} size={160} accent={{ "CHECK": C.ok }} />
      </div>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 110, opacity: tw(t, logoAt - 0.1, logoAt + 0.3) }}>
        <div style={{ transform: `scale(${pop(t, logoAt, 0.6)})` }}>
          <Seal t={t} at={logoAt} size={230} spin={(t - logoAt) * 6} />
        </div>
        <div style={{ marginTop: 24, fontFamily: F.mono, fontWeight: 600, fontSize: 130, letterSpacing: "0.28em", marginRight: "-0.28em", color: C.ink, opacity: pop(t, wt("E19", "KEPT"), 0.4) }}>KEPT</div>
        <div style={{ fontFamily: F.mono, fontSize: 42, color: C.ink2, opacity: pop(t, wt("E19", "Promises"), 0.5) }}>
          Promises the <span style={{ color: C.ok }}>swarm</span> enforces.
        </div>
        <div style={{ marginTop: 34, display: "flex", gap: 30, fontFamily: F.mono, fontSize: 30, opacity: pop(t, E19.end + 0.2, 0.5) }}>
          <span style={{ color: "#0b0d0c", background: C.ok, padding: "8px 22px", borderRadius: 999, fontWeight: 600 }}>keptmd.vercel.app</span>
          <span style={{ color: C.ink, padding: "8px 0" }}>@keptonchainn</span>
        </div>
      </AbsoluteFill>
      <Sparks t={t} at={logoAt + 0.4} />
    </AbsoluteFill>
  );
};

const Sparks: React.FC<{ t: number; at: number }> = ({ t, at }) => (
  <Svg>
    <Sparkle x={700} y={220} t={t} at={at} size={44} />
    <Sparkle x={1240} y={300} t={t} at={at + 0.3} size={34} color={C.ok} />
    <Sparkle x={820} y={520} t={t} at={at + 0.6} size={30} color="#ffe9a3" />
    <Dust x={960} y={FLOOR} t={t} at={at} />
  </Svg>
);
