import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { INOUT, OUT, tw, useSeconds } from "./kit";
import { ACC, Browser, Cam, cam, focusAt, Glass, HEAD, Mark, Mesh, MONO, rise, SERIF, Stage3D, V, Verdict, Words } from "./mg";

/// KEPT 2.0, the 15 second teaser: no voice, cut to the beat (120 bpm), the real app in between.
export const TEASER = { fps: 30, duration: 15 };

const CUTS = [0, 2.0, 3.5, 6.0, 8.5, 10.0, 15.2];
const X = 0.35;

const Part: React.FC<{ t: number; i: number; children: React.ReactNode }> = ({ t, i, children }) => {
  const a = CUTS[i];
  const b = CUTS[i + 1];
  if (t < a - 0.01 || t > b + X) return null;
  const p = i === 0 ? 1 : tw(t, a, a + X, 0, 1, INOUT);
  return <AbsoluteFill style={{ opacity: p, filter: p < 1 ? `blur(${(1 - p) * 20}px)` : undefined, transform: p < 1 ? `scale(${1.03 - 0.03 * p})` : undefined }}>{children}</AbsoluteFill>;
};

export const Teaser: React.FC = () => {
  const t = useSeconds();
  // 1: a new token, a new wallet
  const s1 = (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 440 }}>
        <Words text="A new *token.*" t={t} at={0.2} out={0.95} size={130} color={V.ink} accent={V.ink} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 440 }}>
        <Words text="A new *wallet.*" t={t} at={1.05} size={130} color={V.ink} accent={V.ink} />
      </div>
    </>
  );
  // 2: the same launcher
  const s2 = (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 330 }}>
        <Words text="Same *launcher.*" t={t} at={2.05} size={150} color={V.ink} accent={V.red} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 600, display: "flex", justifyContent: "center", gap: 18 }}>
        {["0x7a3f…e1b9", "0x91c2…04d7", "0xf3e8…9a2c"].map((w, i) => (
          <div key={i} style={{ ...rise(t, 2.5 + i * 0.25, undefined, 20) }}>
            <Glass r={999} style={{ padding: "14px 26px", fontFamily: MONO, fontSize: 26, color: V.ink, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 11, height: 11, borderRadius: 6, background: V.red }} />
              {w}
            </Glass>
          </div>
        ))}
      </div>
    </>
  );
  // 3: the record
  const v3: Cam[] = [
    { t: 3.5, cx: 720, cy: 440, z: 1 },
    { t: 4.3, cx: 720, cy: 440, z: 1 },
    { t: 5.4, cx: 540, cy: 400, z: 1.45 },
  ];
  const s3 = (
    <>
      <Stage3D t={t} at={3.4} y={-20} scale={0.9}>
        <Browser t={t} url="keptmd.vercel.app/check/2288" shots={[{ at: 0, src: "rec-red", h: 1300 }]} view={cam(t, v3)} focus={focusAt(t, [{ t: 4.3, r: { x: 148, y: 183, w: 1144, h: 629 } }])} glow={V.red} />
      </Stage3D>
      <div style={{ position: "absolute", left: 1290, top: 110, ...rise(t, 4.6, undefined, 20) }}>
        <Verdict color={V.red} text="Sells fast · 63 s after launch" size={26} />
      </div>
    </>
  );
  // 4: the money
  const v4: Cam[] = [
    { t: 6.0, cx: 720, cy: 1500, z: 0.98 },
    { t: 8.3, cx: 720, cy: 1576, z: 1.15 },
  ];
  const s4 = (
    <>
      <Stage3D t={t} at={5.9} y={-20} scale={0.9}>
        <Browser t={t} url="keptmd.vercel.app/check/0xdce3…7036" shots={[{ at: 0, src: "rec-amber", h: 1950 }]} view={cam(t, v4)} focus={focusAt(t, [{ t: 6.5, r: { x: 149, y: 1300, w: 1142, h: 560 } }])} glow={V.amber} />
      </Stage3D>
      <div style={{ position: "absolute", left: 1230, top: 110, ...rise(t, 6.9, undefined, 20) }}>
        <Verdict color={V.amber} text="Fresh wallet. Same money." size={26} />
      </div>
    </>
  );
  // 5: in your pocket
  const PW = 400;
  const k = (PW - 24) / 1179;
  const s5 = (
    <>
      <Stage3D t={t} at={8.4} x={260} scale={1 + tw(t, 8.5, 10.2) * 0.05}>
        <div style={{ width: PW, height: 2556 * k + 24, borderRadius: 64, background: "linear-gradient(145deg,#3a3d47,#15161b)", padding: 12, boxSizing: "border-box", boxShadow: "0 50px 110px rgba(20,8,40,0.25)" }}>
          <div style={{ width: PW - 24, height: 2556 * k, borderRadius: 52, overflow: "hidden" }}>
            <Img src={staticFile("kept2/bot.jpg")} style={{ width: PW - 24, height: 2556 * k }} />
          </div>
        </div>
      </Stage3D>
      <div style={{ position: "absolute", left: 160, top: 430, width: 600 }}>
        <Words text="On *Telegram,* / too." t={t} at={8.7} size={96} color={V.ink} accent={ACC} align="left" />
      </div>
    </>
  );
  // 6: KEPT 2.0
  const lp = tw(t, 10.1, 10.8, 0, 1, OUT);
  const up = tw(t, 12.0, 12.6, 0, 1, INOUT);
  const s6 = (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 410 - up * 90, display: "flex", justifyContent: "center", alignItems: "center", gap: 38, opacity: lp, filter: lp < 1 ? `blur(${(1 - lp) * 16}px)` : undefined, transform: `scale(${0.92 + 0.08 * lp})` }}>
        <Mark size={180} draw={tw(t, 10.3, 10.9, 0, 1, OUT)} />
        <div style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 160, letterSpacing: "0.16em", color: V.ink, fontStretch: "110%" }}>KEPT</div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 180, marginLeft: -16, color: ACC, opacity: tw(t, 10.9, 11.4), filter: `blur(${(1 - tw(t, 10.9, 11.4)) * 12}px)` }}>2.0</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 610 }}>
        <Words text="Check before you *buy.*" t={t} at={12.3} size={92} color={V.ink} accent={ACC} stagger={0.12} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 790, display: "flex", justifyContent: "center", ...rise(t, 13.2, undefined, 14) }}>
        <Glass r={999} style={{ padding: "14px 30px", fontFamily: MONO, fontSize: 28, color: V.ink }}>keptmd.vercel.app</Glass>
      </div>
    </>
  );
  const parts = [s1, s2, s3, s4, s5, s6];
  return (
    <AbsoluteFill>
      <Mesh t={t} />
      {parts.map((p, i) => (
        <Part key={i} t={t} i={i}>
          {p}
        </Part>
      ))}
      <AbsoluteFill style={{ background: "#f8f7f3", opacity: tw(t, 0, 0.25, 1, 0) + tw(t, 14.6, 15) }} />
    </AbsoluteFill>
  );
};
