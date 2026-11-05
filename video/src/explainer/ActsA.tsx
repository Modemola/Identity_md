import React from "react";
import { AbsoluteFill } from "remotion";
import { C, F, INOUT } from "../theme";
import { Blob, Bubble, CastDefs, Coin, Confetti, Dust, Padlock, Skin, Sparkle } from "./cast";
import { bob, drop, Kinetic, line, pop, rnd, scene, Stage, thud, tw, useSeconds, wt } from "./kit";
import { Calendar, Meter, Poster, Scaffold, Tumbleweed } from "./props";

const FLOOR = 880;
const Svg: React.FC<{ children: React.ReactNode; cam?: { x: number; y: number; z: number } }> = ({ children, cam }) => (
  <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", overflow: "visible" }}>
    <CastDefs />
    <g transform={cam ? `translate(${960 - cam.x * cam.z} ${540 - cam.y * cam.z}) scale(${cam.z})` : undefined}>{children}</g>
  </svg>
);
export { Svg };

/// Act 1: a token launches, the roadmap drops, everyone cheers.
export const Hype: React.FC = () => {
  const t = useSeconds();
  const E1 = line("E1");
  const tokenAt = 0.25;
  const teamAt = wt("E1", "team");
  const mapAt = wt("E1", "roadmap") - 0.25;
  const cheer = wt("E2", "Everyone's");
  const items = [
    { label: "Mobile app", at: wt("E2", "mobile") },
    { label: "Mainnet", at: wt("E2", "Mainnet") },
    { label: "Partnerships", at: wt("E2", "partnerships") },
    { label: "To the moon", at: cheer + 0.5 },
  ];
  // the token: drops in the middle, then steps aside for the team
  const move = tw(t, teamAt - 0.3, teamAt + 0.4, 0, 1, INOUT);
  const cx = 960 + (440 - 960) * move;
  const cy = 600 + drop(t, tokenAt, 800) + (520 - 600) * move;
  const cr = (110 - 50 * move) * (1 - tw(t, teamAt + 0.5, teamAt + 0.8, 0, 1));
  const teamUp = pop(t, teamAt, 0.5);
  const holders: { x: number; skin: Skin }[] = [
    { x: 150, skin: "pink" },
    { x: 400, skin: "lilac" },
    { x: 1520, skin: "mint" },
    { x: 1770, skin: "peach" },
  ];
  return (
    <AbsoluteFill>
      <Stage light="rgba(240,180,41,0.16)" at={[50, 34]} />
      <Svg>
        <Sparkle x={960} y={480} t={t} at={tokenAt + 0.4} size={70} color="#ffe9a3" />
        <Dust x={cx} y={710} t={t} at={tokenAt + 0.38} w={0.8} />
        {cr > 0.5 ? <Coin x={cx} y={cy} r={cr} spin={t * 3.2} /> : null}
        <Sparkle x={440} y={520} t={t} at={teamAt + 0.6} size={50} color="#ffe9a3" />
        <Poster x={1260} y={250} t={t} at={mapAt} items={items} />
        <Dust x={1260} y={FLOOR} t={t} at={mapAt + 0.38} w={1.2} />
        <Blob x={720} y={FLOOR + (1 - teamUp) * 300} t={t} s={1.6} skin="team" hat mood={t > cheer ? "joy" : "happy"} arms={t > mapAt + 0.6 ? (t > cheer ? "up" : "point") : "wave"} look={0.6} seed={2} sq={thud(t, teamAt + 0.2) + (t > cheer ? Math.max(0, bob(t)) * 0.06 : 0)} />
        <Bubble x={760} y={560} t={t} at={mapAt + 0.7} until={cheer - 0.2} text="we're so back" size={30} tail="left" />
        {holders.map((h, i) => {
          const up = pop(t, cheer + i * 0.08, 0.5);
          const hop = t > cheer ? Math.max(0, bob(t, i * 0.25)) * 26 : 0;
          return <Blob key={i} x={h.x} y={1150 + (1 - up) * 300 - hop} t={t} s={1.9} skin={h.skin} mood="joy" arms="up" seed={i * 3} look={i < 2 ? 0.7 : -0.7} />;
        })}
        <Bubble x={420} y={800} t={t} at={cheer + 0.3} text="LFG!" size={40} tail="down" />
        <Bubble x={1530} y={800} t={t} at={cheer + 0.5} text="wen moon" size={34} tail="down" />
        <Confetti x={300} y={900} t={t} at={cheer + 0.1} seed={1} />
        <Confetti x={1620} y={900} t={t} at={cheer + 0.2} seed={5} />
      </Svg>
      <div style={{ position: "absolute", top: 150, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: 1 - tw(t, teamAt - 0.4, teamAt) }}>
        <Kinetic text="NEW TOKEN!" t={t} at={E1.start} size={96} accent={{ "TOKEN!": C.caution }} />
      </div>
    </AbsoluteFill>
  );
};

/// Act 2: the team already holds a pile; vesting locks it and drips it out monthly.
const PILE = (() => {
  const out: { x: number; y: number; k: number }[] = [];
  let k = 0;
  for (let row = 0; row < 8; row++) {
    const n = 8 - row;
    for (let i = 0; i < n; i++) out.push({ x: 1180 + (i - (n - 1) / 2) * 64 + (rnd(k) - 0.5) * 8, y: FLOOR - 26 - row * 40, k: k++ });
  }
  return out;
})();

export const DayOne: React.FC = () => {
  const t = useSeconds();
  const s = scene("dayone");
  const E3 = line("E3");
  const catchOut = wt("E3", "On") - 0.1;
  const pileAt = wt("E3", "holds") - 0.3;
  const giant = wt("E3", "giant");
  const lockAt = wt("E4", "locked") - 0.1;
  const vestAt = wt("E4", "vesting");
  const monthAt = wt("E4", "month") - 0.4;
  const grow = 1 + 0.12 * pop(t, giant, 0.5) - 0.12 * tw(t, giant + 0.6, giant + 1.2);
  const lockLand = lockAt + 0.38;
  const m = tw(t, monthAt, monthAt + 0.7, 0, 1, INOUT);
  const scratch = t > E3.start && t < catchOut;
  return (
    <AbsoluteFill>
      <Stage light="rgba(240,180,41,0.13)" at={[60, 40]} />
      <Svg>
        {/* the pile */}
        <g transform={`translate(1180 ${FLOOR}) scale(${grow}) translate(-1180 ${-FLOOR})`}>
          {PILE.map((c) => {
            const at = pileAt + c.k * 0.045;
            if (t < at) return null;
            const y = c.y + drop(t, at, 700) * 0.9;
            return <Coin key={c.k} x={c.x} y={y} r={34} spin={(rnd(c.k) - 0.5) * 1.2} rot={(rnd(c.k + 1) - 0.5) * 30} />;
          })}
        </g>
        <Sparkle x={1260} y={560} t={t} at={giant + 0.2} size={60} color="#ffe9a3" />
        {/* chains and the vesting lock */}
        {t > lockAt ? (
          <g stroke="#c9cfcc" strokeWidth={14} strokeDasharray="26 12" strokeLinecap="round" fill="none" opacity={0.95}>
            <path d={`M 900 ${FLOOR - 40} L 1460 ${FLOOR - 300}`} strokeDashoffset={-600 * (1 - tw(t, lockLand, lockLand + 0.4))} />
            <path d={`M 1460 ${FLOOR - 40} L 900 ${FLOOR - 300}`} strokeDashoffset={600 * (1 - tw(t, lockLand + 0.1, lockLand + 0.5))} />
          </g>
        ) : null}
        <g transform={`translate(0 ${drop(t, lockAt, 900)})`}>
          <Padlock x={1180} y={FLOOR - 230} s={3.6} open={0} color="#f6c445" />
          <text x={1180} y={FLOOR - 140} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={30} fill="#16181a" opacity={pop(t, vestAt, 0.3)}>
            VESTING
          </text>
        </g>
        <Dust x={1180} y={FLOOR} t={t} at={lockLand} w={1.4} />
        <Calendar x={1660} y={330} s={0.75 * pop(t, monthAt - 0.4, 0.5)} m={m} />
        {[0, 1, 2].map((i) => {
          const a = monthAt + 0.6 + i * 0.18;
          if (t < a) return null;
          const u = tw(t, a, a + 0.7, 0, 1, INOUT);
          const x = 1000 + (760 - 1000) * u;
          const y = 600 - Math.sin(u * Math.PI) * 220 + (700 - 600) * u;
          return <Coin key={i} x={x} y={y} r={26} spin={t * 8} opacity={1 - tw(t, a + 0.65, a + 0.75)} />;
        })}
        <Blob x={700} y={FLOOR} t={t} s={1.6} skin="team" hat mood={t > giant ? "joy" : "happy"} arms={t > monthAt + 0.6 ? "hold" : t > giant ? "up" : "down"} look={0.7} seed={2} sq={scratch ? 0 : Math.max(0, bob(t)) * 0.04} />
        {["pink", "lilac"].map((k, i) => (
          <Blob key={k} x={150 + i * 180} y={FLOOR} t={t} s={0.95} skin={k as Skin} mood={t > pileAt + 0.6 ? "wow" : "neutral"} look={0.8} seed={i + 5} />
        ))}
      </Svg>
      <div style={{ position: "absolute", top: 120, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: scratch ? 1 : 0 }}>
        <Kinetic text="HERE'S THE CATCH." t={t} at={E3.start - 0.05} size={110} accent={{ CATCH: C.alarm }} out={catchOut - 0.3} />
      </div>
      <div style={{ position: "absolute", left: 1180 - 260, top: 260, width: 520, textAlign: "center", fontFamily: F.mono, fontWeight: 600, fontSize: 30, letterSpacing: "0.18em", color: C.caution, opacity: pop(t, giant, 0.4) * (1 - tw(t, lockAt - 0.3, lockAt)) }}>
        THE TEAM'S TOKENS
      </div>
      <div style={{ position: "absolute", left: 470, top: 300, width: 460, textAlign: "center", opacity: pop(t, wt("E3", "day"), 0.4) * (1 - tw(t, s.end - 0.8, s.end - 0.4)) }}>
        <span style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 40, padding: "8px 22px", borderRadius: 999, background: C.caution, color: "#16181a" }}>DAY 1</span>
      </div>
    </AbsoluteFill>
  );
};

/// Act 3: the calendar runs, the work never starts.
export const Soon: React.FC = () => {
  const t = useSeconds();
  const s = scene("soon");
  const E5 = line("E5");
  const E6 = line("E6");
  const calAt = wt("E5", "calendar");
  const neverAt = wt("E5", "never");
  const yearAt = wt("E6", "later");
  const appAt = wt("E6", "app");
  const soonAt = wt("E6", "coming") - 0.2;
  // months: one on "calendar", then the year flies by before E6
  const m = Math.min(12, tw(t, calAt, calAt + 0.6, 0, 1, INOUT) + tw(t, E5.end + 0.1, yearAt, 0, 11, (x) => x * x * (3 - 2 * x)));
  const push = tw(t, appAt - 0.3, appAt + 0.7, 0, 1, INOUT);
  const cam = { x: 960 + 480 * push, y: 540 + 40 * push, z: 1 + 0.45 * push };
  const flips = Array.from({ length: 12 }, (_, k) => k);
  // when the page for month k flips, a coin flies to the team's bag
  const flipTime = (k: number) => {
    // invert m(t): sample
    for (let tt = s.start; tt < s.end; tt += 1 / 30) {
      const mm = Math.min(12, tw(tt, calAt, calAt + 0.6, 0, 1, INOUT) + tw(tt, E5.end + 0.1, yearAt, 0, 11, (x) => x * x * (3 - 2 * x)));
      if (mm >= k + 0.5) return tt;
    }
    return 1e9;
  };
  const tumble = tw(t, E6.end + 0.2, s.end + 0.4, 0, 1, (x) => x);
  return (
    <AbsoluteFill>
      <Stage light="rgba(255,107,98,0.10)" at={[50, 40]} />
      <Svg cam={cam}>
        <line x1={960} y1={120} x2={960} y2={FLOOR} stroke="rgba(255,255,255,0.18)" strokeWidth={3} strokeDasharray="10 12" />
        <Calendar x={480} y={400} s={1.0 * pop(t, s.start + 0.2, 0.5)} m={m} />
        <Meter x={480} y={640} w={560} v={m / 12} label="UNLOCKED" t={t} at={s.start + 0.5} />
        {flips.map((k) => {
          const a = flipTime(k);
          if (t < a || t > a + 0.8) return null;
          const u = tw(t, a, a + 0.7, 0, 1, INOUT);
          return <Coin key={k} x={560 + (250 - 560) * u} y={330 - Math.sin(u * Math.PI) * 160 + (760 - 330) * u} r={24} spin={t * 9} opacity={1 - tw(t, a + 0.62, a + 0.72)} />;
        })}
        <Blob x={200} y={FLOOR} t={t} s={1.1} skin="team" hat mood="joy" arms="none" holding="bag" seed={2} sq={Math.max(0, bob(t)) * 0.05} />
        <Scaffold x={1440} y={FLOOR} t={t} s={0.82} web={tw(t, s.start + 1, s.end, 0, 1, (x) => x)} signAt={soonAt} />
        <g transform={`translate(1440 380) rotate(-12) scale(${pop(t, neverAt, 0.35) * (1 - tw(t, soonAt - 0.4, soonAt))})`}>
          <rect x={-230} y={-50} width={460} height={100} rx={10} fill="none" stroke={C.alarm} strokeWidth={8} />
          <text x={0} y={18} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={52} fill={C.alarm} letterSpacing={6}>
            UNCHECKED
          </text>
        </g>
        {[1180, 1700].map((x, i) => (
          <g key={x}>
            <Blob x={x} y={FLOOR} t={t} s={0.95} skin={i ? "mint" : "blue"} mood={t > yearAt ? "sleep" : "neutral"} look={i ? -0.6 : 0.6} seed={i + 8} rot={t > yearAt ? (i ? 6 : -6) * tw(t, yearAt, yearAt + 1) : 0} />
            {t > yearAt + 0.6
              ? [0, 1, 2].map((z) => {
                  const u = ((t - yearAt + z * 0.6) % 1.8) / 1.8;
                  return (
                    <text key={z} x={x + 40 + u * 40} y={FLOOR - 140 - u * 90} fontFamily={F.mono} fontWeight={600} fontSize={26 + u * 16} fill="#fff" opacity={1 - u}>
                      z
                    </text>
                  );
                })
              : null}
          </g>
        ))}
        <Bubble x={1220} y={FLOOR - 170} t={t} at={appAt + 0.1} until={s.end} text="wen app?" size={28} tail="left" />
        {tumble > 0 ? <Tumbleweed x={980 + tumble * 1000} y={FLOOR + 4 - Math.abs(Math.sin(tumble * 14)) * 30} rot={tumble * 900} r={48} /> : null}
      </Svg>
      <div style={{ position: "absolute", top: 70, left: 0, width: 960, display: "flex", justifyContent: "center", opacity: pop(t, s.start + 0.2, 0.4) * (1 - push) }}>
        <Label text="THE CALENDAR" color={C.ok} />
      </div>
      <div style={{ position: "absolute", top: 70, left: 960, width: 960, display: "flex", justifyContent: "center", opacity: pop(t, s.start + 0.4, 0.4) * (1 - push) }}>
        <Label text="THE WORK" color={C.alarm} />
      </div>
    </AbsoluteFill>
  );
};

export const Label: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 14, fontFamily: F.mono, fontWeight: 600, fontSize: 34, letterSpacing: "0.2em", color }}>
    <span style={{ width: 14, height: 14, borderRadius: 7, background: color, boxShadow: `0 0 16px ${color}` }} />
    {text}
  </div>
);
