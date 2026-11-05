import React from "react";
import { C, F } from "../theme";
import { Coin, Icon, IconName, Padlock } from "./cast";
import { drop, pop, rnd, tw } from "./kit";

/// The roadmap poster: drops on its pin, swings, lists the promises.
export const Poster: React.FC<{
  x: number;
  y: number;
  t: number;
  at: number;
  items: { label: string; at: number }[];
  s?: number;
  crossAt?: number;
  title?: string;
}> = ({ x, y, t, at, items, s = 1, crossAt, title = "ROADMAP" }) => {
  const land = at + 0.38;
  const dy = drop(t, at, 1100);
  const swing = t > land ? 7 * Math.exp(-(t - land) * 2.4) * Math.sin((t - land) * 7) : 0;
  const W = 500;
  const H = 150 + items.length * 84;
  const cross = crossAt === undefined ? 0 : tw(t, crossAt, crossAt + 0.5);
  return (
    <g transform={`translate(${x} ${y + dy}) rotate(${swing}) scale(${s})`}>
      <line x1={-W / 2 + 40} y1={-40} x2={0} y2={-120} stroke="#8a8f8c" strokeWidth={3} />
      <line x1={W / 2 - 40} y1={-40} x2={0} y2={-120} stroke="#8a8f8c" strokeWidth={3} />
      <rect x={-W / 2 + 10} y={-30} width={W} height={H} rx={10} fill="#000" opacity={0.35} />
      <rect x={-W / 2} y={-40} width={W} height={H} rx={10} fill="url(#paper)" />
      <circle cx={0} cy={-120} r={13} fill={C.alarm} />
      <text x={-W / 2 + 40} y={36} fontFamily={F.mono} fontWeight={600} fontSize={50} fill="#16181a" letterSpacing={2}>
        {title}
      </text>
      <rect x={-W / 2 + 40} y={50} width={160} height={8} rx={4} fill="#f0b429" />
      {items.map((it, i) => {
        const p = pop(t, it.at, 0.4);
        const yy = 120 + i * 84;
        return (
          <g key={it.label} transform={`translate(${-W / 2 + 40} ${yy})`} opacity={Math.min(1, p * 1.4)}>
            <rect x={44} y={-34} width={(it.label.length * 22 + 20) * tw(t, it.at + 0.1, it.at + 0.5)} height={42} rx={8} fill="#ffe27a" opacity={0.7} />
            <g transform={`scale(${p})`}>
              <rect x={0} y={-30} width={32} height={32} rx={6} fill="none" stroke="#16181a" strokeWidth={4} />
            </g>
            <text x={54} y={0} fontFamily={F.mono} fontWeight={500} fontSize={36} fill="#16181a">
              {it.label}
            </text>
          </g>
        );
      })}
      {cross > 0 ? (
        <g stroke={C.alarm} strokeWidth={22} strokeLinecap="round" fill="none" opacity={0.92}>
          <path d={`M ${-W / 2 + 30} ${-10} L ${W / 2 - 30} ${H - 70}`} strokeDasharray={900} strokeDashoffset={900 * (1 - tw(t, crossAt!, crossAt! + 0.25))} />
          <path d={`M ${W / 2 - 30} ${-10} L ${-W / 2 + 30} ${H - 70}`} strokeDasharray={900} strokeDashoffset={900 * (1 - tw(t, crossAt! + 0.2, crossAt! + 0.45))} />
        </g>
      ) : null}
    </g>
  );
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN"];

/// A tear-off calendar showing month `m`; fractional months are a page flying off.
export const Calendar: React.FC<{ x: number; y: number; m: number; s?: number }> = ({ x, y, m, s = 1 }) => {
  const i = Math.min(12, Math.floor(m));
  const f = m - i;
  const page = (k: number) => (
    <g>
      <rect x={-130} y={-140} width={260} height={280} rx={16} fill="url(#paper)" />
      <path d="M -130 -124 Q -130 -140 -114 -140 L 114 -140 Q 130 -140 130 -124 L 130 -70 L -130 -70 Z" fill={C.alarm} />
      <text x={0} y={-90} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={44} fill="#fff" letterSpacing={4}>
        {MONTHS[k]}
      </text>
      <text x={0} y={62} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={120} fill="#16181a">
        1
      </text>
      <text x={0} y={112} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={22} fill={C.okDeep} letterSpacing={3}>
        UNLOCK DAY
      </text>
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-122} y={-128} width={260} height={280} rx={16} fill="#000" opacity={0.35} />
      {page(Math.min(12, i + 1))}
      {f > 0 && i < 12 ? <g transform={`translate(${f * 260} ${-f * 380}) rotate(${f * 70})`} opacity={1 - f * 0.8}>{page(i)}</g> : null}
      {f === 0 || i >= 12 ? page(i) : null}
      {[-80, -26, 26, 80].map((rx) => (
        <rect key={rx} x={rx - 7} y={-156} width={14} height={34} rx={7} fill="#c9cfcc" />
      ))}
    </g>
  );
};

/// The app that never ships: scaffold, a ghost of the word APP, a COMING SOON sign, cobwebs.
export const Scaffold: React.FC<{ x: number; y: number; t: number; web: number; s?: number; signAt?: number }> = ({ x, y, t, web, s = 1, signAt = 0 }) => {
  const swing = 4 * Math.sin(t * 1.6);
  const sp = pop(t, signAt, 0.5);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <text x={0} y={-90} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={210} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={3} strokeDasharray="14 12">
        APP
      </text>
      <g stroke="#6b7570" strokeWidth={9} strokeLinecap="round">
        {[-230, -80, 80, 230].map((px) => (
          <line key={px} x1={px} y1={0} x2={px} y2={-380} />
        ))}
        {[-120, -250, -380].map((py) => (
          <line key={py} x1={-250} y1={py} x2={250} y2={py} />
        ))}
      </g>
      <g stroke="#4f5854" strokeWidth={5}>
        <line x1={-230} y1={0} x2={-80} y2={-120} />
        <line x1={80} y1={-120} x2={230} y2={-250} />
        <line x1={-80} y1={-250} x2={80} y2={-380} />
      </g>
      {/* cobweb in the top left corner */}
      <g stroke="rgba(255,255,255,0.55)" strokeWidth={2} fill="none" opacity={web}>
        {[0, 1, 2, 3, 4].map((k) => {
          const a = (k / 4) * (Math.PI / 2);
          const L = 150 * web;
          return <line key={k} x1={-230} y1={-380} x2={-230 + Math.cos(a) * L} y2={-380 + Math.sin(a) * L} />;
        })}
        {[40, 80, 120].map((r) => (r < 150 * web ? <path key={r} d={`M ${-230 + r} -380 Q ${-230 + r * 0.8} ${-380 + r * 0.45} ${-230 + r * 0.7} ${-380 + r * 0.7} Q ${-230 + r * 0.45} ${-380 + r * 0.8} -230 ${-380 + r}`} /> : null))}
      </g>
      {/* sign */}
      <g transform={`translate(0 -40) rotate(${swing}) scale(${sp})`}>
        <line x1={-110} y1={40} x2={-110} y2={-10} stroke="#8a6a3c" strokeWidth={10} />
        <line x1={110} y1={40} x2={110} y2={-10} stroke="#8a6a3c" strokeWidth={10} />
        <rect x={-200} y={-120} width={400} height={120} rx={14} fill="#f0b429" stroke="#16181a" strokeWidth={6} />
        <text x={0} y={-72} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={42} fill="#16181a">
          COMING
        </text>
        <text x={0} y={-26} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={42} fill="#16181a">
          SOON
        </text>
      </g>
      {/* cone */}
      <g transform="translate(300 0)">
        <path d="M -34 0 L -10 -90 L 10 -90 L 34 0 Z" fill="#ff8a3d" />
        <path d="M -24 -38 L 24 -38 L 20 -54 L -20 -54 Z" fill="#fff" />
        <rect x={-46} y={-8} width={92} height={10} rx={4} fill="#d96a26" />
      </g>
    </g>
  );
};

export const Tumbleweed: React.FC<{ x: number; y: number; rot: number; r?: number }> = ({ x, y, rot, r = 50 }) => (
  <g transform={`translate(${x} ${y - r}) rotate(${rot})`} stroke="#b59b67" strokeWidth={3} fill="none" opacity={0.9}>
    {Array.from({ length: 9 }, (_, i) => (
      <ellipse key={i} cx={0} cy={0} rx={r * (0.6 + rnd(i) * 0.4)} ry={r * (0.35 + rnd(i + 3) * 0.5)} transform={`rotate(${i * 40})`} />
    ))}
  </g>
);

export const Meter: React.FC<{ x: number; y: number; w: number; v: number; label: string; t: number; at: number }> = ({ x, y, w, v, label, t, at }) => {
  const p = pop(t, at, 0.5);
  const col = v > 0.6 ? C.ok : v > 0.3 ? C.caution : C.alarm;
  return (
    <g transform={`translate(${x} ${y}) scale(${p})`}>
      <text x={-w / 2} y={-22} fontFamily={F.mono} fontWeight={600} fontSize={30} fill="#fff" letterSpacing={4}>
        {label}
      </text>
      <text x={w / 2} y={-22} textAnchor="end" fontFamily={F.mono} fontWeight={600} fontSize={30} fill={col}>
        {Math.round(v * 100)}%
      </text>
      <rect x={-w / 2} y={0} width={w} height={34} rx={17} fill="#1a1f1d" stroke="rgba(255,255,255,0.18)" strokeWidth={2} />
      <rect x={-w / 2 + 5} y={5} width={Math.max(0, (w - 10) * v)} height={24} rx={12} fill={col} />
    </g>
  );
};

export type Slot = { icon: IconName; label: string; open?: number; coins?: number; tint?: string; lift?: number; show?: number };

/// The KEPT vault: a steel safe with one compartment per milestone.
export const Vault: React.FC<{ x: number; y: number; t: number; s?: number; slots: Slot[]; wheel?: number }> = ({ x, y, t, s = 1, slots, wheel = 0 }) => {
  const W = 760;
  const H = 470;
  const n = slots.length;
  const sw = 150;
  const gap = (W - 80 - n * sw) / (n - 1);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={6} rx={W * 0.55} ry={18} fill="#000" opacity={0.5} />
      <rect x={-W / 2 + 30} y={-14} width={40} height={20} rx={4} fill="#151a18" />
      <rect x={W / 2 - 70} y={-14} width={40} height={20} rx={4} fill="#151a18" />
      <rect x={-W / 2} y={-H} width={W} height={H - 10} rx={34} fill="url(#steel)" stroke="#55615c" strokeWidth={5} />
      <rect x={-W / 2 + 16} y={-H + 16} width={W - 32} height={H - 42} rx={24} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) => (
        <circle key={i} cx={a * (W / 2 - 34)} cy={-H / 2 - 5 + b * (H / 2 - 40)} r={7} fill="#6b7570" />
      ))}
      {/* the seal on the lintel */}
      <g transform={`translate(0 ${-H + 62})`}>
        <rect x={-120} y={-30} width={240} height={60} rx={12} fill="#0b0f0d" stroke="rgba(62,207,122,0.6)" strokeWidth={2} />
        <rect x={-102} y={-16} width={32} height={32} rx={3} fill="none" stroke="#fff" strokeWidth={4} />
        <path d="M -95 0 L -88 7 L -76 -8" stroke={C.ok} strokeWidth={5} fill="none" strokeLinecap="square" />
        <text x={-54} y={11} fontFamily={F.mono} fontWeight={600} fontSize={32} fill="#fff" letterSpacing={9}>
          KEPT
        </text>
      </g>
      {/* the wheel */}
      <g transform={`translate(${W / 2 - 4} ${-H / 2}) rotate(${wheel})`}>
        {[0, 60, 120].map((a) => (
          <rect key={a} x={-4} y={-46} width={8} height={92} rx={4} fill="#8a9590" transform={`rotate(${a})`} />
        ))}
        <circle r={20} fill="#3a4541" stroke="#8a9590" strokeWidth={4} />
      </g>
      {slots.map((sl, i) => {
        const sx = -W / 2 + 40 + i * (sw + gap);
        const sy = -H + 120 - (sl.lift ?? 0);
        const open = sl.open ?? 0;
        const tint = sl.tint ?? "#f6c445";
        return (
          <g key={i} transform={`translate(${sx} ${sy})`}>
            <rect x={0} y={0} width={sw} height={300} rx={18} fill="#050706" stroke={sl.tint ? sl.tint : "rgba(255,255,255,0.14)"} strokeWidth={sl.tint ? 4 : 2} />
            <g opacity={sl.show ?? 1} transform={`translate(${sw / 2} 52) scale(${0.5 + 0.5 * (sl.show ?? 1)}) translate(${-sw / 2} -52)`}>
              <Icon name={sl.icon} x={sw / 2} y={52} s={1.05} color="#fff" />
            </g>
            <text x={sw / 2} y={62} textAnchor="middle" fontFamily={F.mono} fontWeight={600} fontSize={48} fill="rgba(255,255,255,0.3)" opacity={1 - (sl.show ?? 1)}>
              ?
            </text>
            <text opacity={sl.show ?? 1} x={sw / 2} y={110} textAnchor="middle" fontFamily={F.mono} fontWeight={500} fontSize={19} fill="rgba(255,255,255,0.75)">
              {sl.label}
            </text>
            {Array.from({ length: Math.round(sl.coins ?? 4) }, (_, k) => (
              <g key={k} transform={`translate(${sw / 2 + (k % 2 ? 3 : -3)} ${232 - k * 13})`}>
                <path d="M -40 0 L -40 9 A 40 12 0 0 0 40 9 L 40 0 Z" fill="#b77b08" />
                <ellipse cx={0} cy={0} rx={40} ry={12} fill="url(#coin)" stroke="#fff3c4" strokeOpacity={0.4} strokeWidth={2} />
              </g>
            ))}
            <Padlock x={sw / 2} y={262} s={0.9} open={open} color={tint} />
          </g>
        );
      })}
    </g>
  );
};

/// A small evidence card the swarm inspects.
export const Evidence: React.FC<{ x: number; y: number; t: number; at: number; icon: IconName; title: string; sub: string; ok?: number }> = ({ x, y, t, at, icon, title, sub, ok = 0 }) => {
  const p = pop(t, at, 0.5);
  return (
    <g transform={`translate(${x} ${y}) scale(${p})`}>
      <rect x={-170} y={-70} width={340} height={140} rx={18} fill="#0d1110" stroke={ok > 0 ? C.ok : "rgba(255,255,255,0.2)"} strokeWidth={3} />
      <Icon name={icon} x={-112} y={0} s={1.2} color={ok > 0 ? C.ok : "#fff"} />
      <text x={-62} y={-8} fontFamily={F.mono} fontWeight={600} fontSize={28} fill="#fff">
        {title}
      </text>
      <text x={-62} y={28} fontFamily={F.mono} fontWeight={400} fontSize={20} fill="rgba(255,255,255,0.6)">
        {sub}
      </text>
    </g>
  );
};
