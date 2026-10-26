import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { GREY, knotPos, NA, rnd, swarmAt } from "./swarm";
import { B, camAt, E, ESPHERE, F, FOV, hitAmount, paletteAt, Q, RGB, SEAL_END, V3 } from "./world";

const ND = 5000; // dust around the camera
const BOX: V3 = [44, 26, 90];

// ---------------------------------------------------------------------------- shaders
const PVS = `
attribute vec3 color; attribute float alpha; attribute float size;
varying vec3 vColor; varying float vAlpha; varying float vBlur;
uniform float uFocus; uniform float uPx;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float d = max(0.1, -mv.z);
  float coc = clamp(abs(d - uFocus) * 0.16, 0.0, 4.0);
  vBlur = coc;
  vColor = color;
  vAlpha = alpha / (1.0 + coc * coc * 0.8);
  gl_PointSize = clamp(size * uPx / d * (1.0 + coc * 2.0), 1.0, 90.0);
  gl_Position = projectionMatrix * mv;
}`;
const PFS = `
varying vec3 vColor; varying float vAlpha; varying float vBlur;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p) * 2.0;
  if (r > 1.0) discard;
  float core = smoothstep(0.42 + vBlur * 0.15, 0.0, r);
  float halo = exp(-r * r * 3.5) * 0.55;
  float k = (core + halo) * vAlpha;
  gl_FragColor = vec4(vColor * k, k);
}`;

const points = (n: number) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute("size", new THREE.BufferAttribute(new Float32Array(n), 1));
  return g;
};
const lines = (n: number) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  return g;
};
const touch = (g: THREE.BufferGeometry) => {
  for (const k of Object.keys(g.attributes)) g.attributes[k].needsUpdate = true;
};
const lerp3 = (a: RGB, b: RGB, u: number): RGB => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const win = (t: number, a: number, b: number, f = 0.4) => Math.max(0, Math.min(1, (t - a) / f, (b - t) / f));

/// A radial glow texture for the nebula clouds.
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.35)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

const Rig: React.FC<{ t: number }> = ({ t }) => {
  const { camera } = useThree();
  const c = camAt(t);
  camera.position.set(...c.pos);
  camera.up.set(Math.sin(c.roll), Math.cos(c.roll), 0);
  camera.lookAt(...c.look);
  (camera as THREE.PerspectiveCamera).fov = FOV;
  (camera as THREE.PerspectiveCamera).far = 400;
  camera.updateProjectionMatrix();
  return null;
};

const World: React.FC<{ t: number; height: number; gain: number }> = ({ t, height, gain }) => {
  const g = React.useMemo(
    () => ({
      swarm: points(NA),
      dust: points(ND),
      streak: lines(ND),
      grid: lines(260),
      tunnel: lines(40 * 64),
      beams: lines(64),
      rays: (() => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(36 * 9), 3));
        geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(36 * 9), 3));
        return geo;
      })(),
      tex: glowTexture(),
    }),
    [],
  );
  const pmat = React.useMemo(() => new THREE.ShaderMaterial({ vertexShader: PVS, fragmentShader: PFS, uniforms: { uFocus: { value: 12 }, uPx: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const lmat = React.useMemo(() => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const rmat = React.useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), []);
  const smats = React.useMemo(() => [0, 1, 2, 3, 4].map(() => new THREE.SpriteMaterial({ map: g.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })), [g.tex]);

  const pal = paletteAt(t);
  const cam = camAt(t);
  const prev = camAt(t - 1 / 30);
  const vel: V3 = [(cam.pos[0] - prev.pos[0]) * 30, (cam.pos[1] - prev.pos[1]) * 30, (cam.pos[2] - prev.pos[2]) * 30];
  const speed = Math.hypot(...vel);
  const fwd = new THREE.Vector3(cam.look[0] - cam.pos[0], cam.look[1] - cam.pos[1], cam.look[2] - cam.pos[2]).normalize();
  const focus = Math.hypot(cam.look[0] - cam.pos[0], cam.look[1] - cam.pos[1], cam.look[2] - cam.pos[2]);
  pmat.uniforms.uFocus.value = focus;
  pmat.uniforms.uPx.value = height / (2 * Math.tan(((FOV / 2) * Math.PI) / 180));
  const beat = t > Q.pledge ? Math.exp(-((t % 0.5) / 0.5) * 5) : 0;
  const hit = hitAmount(t);

  // the swarm, in the scene's colours
  const s = swarmAt(t);
  {
    const P = g.swarm.attributes.position.array as Float32Array;
    const Cc = g.swarm.attributes.color.array as Float32Array;
    const Al = g.swarm.attributes.alpha.array as Float32Array;
    const Sz = g.swarm.attributes.size.array as Float32Array;
    P.set(s.p);
    for (let i = 0; i < NA; i++) {
      const r = s.c[i * 3], gg = s.c[i * 3 + 1], b = s.c[i * 3 + 2];
      const grey = Math.abs(r - GREY[0]) < 0.02 && Math.abs(gg - GREY[1]) < 0.02 && Math.abs(b - GREY[2]) < 0.02;
      let col: RGB = [r, gg, b];
      if (grey) {
        const u = (rnd(i + 21) + 0.18 * Math.sin(t * 0.8 + s.p[i * 3] * 0.35 + s.p[i * 3 + 1] * 0.2)) % 1;
        col = rnd(i + 31) > 0.9 ? pal.c : lerp3(pal.a, pal.b, Math.abs(u));
        if (rnd(i + 41) > 0.93) col = [1, 1, 1];
      }
      Cc[i * 3] = col[0];
      Cc[i * 3 + 1] = col[1];
      Cc[i * 3 + 2] = col[2];
      Al[i] = s.a[i] * gain * (1 + 0.6 * hit + 0.25 * beat);
      Sz[i] = 0.036 + ((i * 7919) % 13) * 0.002;
    }
    touch(g.swarm);
  }

  // dust that wraps around the camera, drawn as points and as streaks along the flight
  {
    const P = g.dust.attributes.position.array as Float32Array;
    const Cc = g.dust.attributes.color.array as Float32Array;
    const Al = g.dust.attributes.alpha.array as Float32Array;
    const Sz = g.dust.attributes.size.array as Float32Array;
    const LP = g.streak.attributes.position.array as Float32Array;
    const LC = g.streak.attributes.color.array as Float32Array;
    const stretch = Math.min(1.6, speed * 0.018);
    const sAlpha = Math.min(1, Math.max(0, speed - 6) / 30);
    for (let i = 0; i < ND; i++) {
      const p: V3 = [0, 0, 0];
      for (let d = 0; d < 3; d++) {
        const base = rnd(i * 3 + d + 90000) * BOX[d] * 7;
        const m = (((base - cam.pos[d]) % BOX[d]) + BOX[d]) % BOX[d];
        p[d] = cam.pos[d] + m - BOX[d] / 2;
      }
      P.set(p, i * 3);
      const col = rnd(i + 5) > 0.7 ? pal.b : rnd(i + 6) > 0.5 ? pal.a : ([0.75, 0.8, 0.85] as RGB);
      Cc.set(col, i * 3);
      Al[i] = (0.25 + 0.45 * rnd(i + 7)) * gain;
      Sz[i] = 0.03 + 0.03 * rnd(i + 8);
      LP.set(p, i * 6);
      LP.set([p[0] - vel[0] * 0.05 * stretch, p[1] - vel[1] * 0.05 * stretch, p[2] - vel[2] * 0.05 * stretch], i * 6 + 3);
      const k = sAlpha * (0.4 + 0.6 * rnd(i + 9)) * gain;
      LC.set([col[0] * k, col[1] * k, col[2] * k], i * 6);
      LC.set([0, 0, 0], i * 6 + 3);
    }
    touch(g.dust);
    touch(g.streak);
  }

  // the grid floor, glued to the world, fading with distance and pulsing on the beat
  const gridOn = 1 - win(t, 3.95, 6.1, 0.3);
  {
    const LP = g.grid.attributes.position.array as Float32Array;
    const LC = g.grid.attributes.color.array as Float32Array;
    const y = cam.pos[1] - 4.2 - (t > Q.deadline - 0.3 && t < Q.drop ? 0 : 0);
    const step = 2.5;
    const x0 = Math.floor(cam.pos[0] / step) * step, z0 = Math.floor(cam.pos[2] / step) * step;
    let n = 0;
    const segs: [V3, V3][] = [];
    for (let k = -50; k <= 50 && segs.length < 130; k++) segs.push([[x0 + k * step, y, z0 + 10], [x0 + k * step, y, z0 - 60]]);
    for (let k = -4; k < 26 && segs.length < 160; k++) segs.push([[x0 - 125, y, z0 + 10 - k * step], [x0 + 125, y, z0 + 10 - k * step]]);
    for (const [a, b] of segs) {
      LP.set(a, n * 6);
      LP.set(b, n * 6 + 3);
      const da = Math.abs(a[2] - cam.pos[2]), db = Math.abs(b[2] - cam.pos[2]);
      const fa = Math.exp(-da / 16) * (0.45 + beat * 0.5 + hit * 0.6) * gridOn * gain, fb = Math.exp(-db / 16) * (0.45 + beat * 0.5 + hit * 0.6) * gridOn * gain;
      LC.set([pal.a[0] * fa, pal.a[1] * fa, pal.a[2] * fa], n * 6);
      LC.set([pal.a[0] * fb, pal.a[1] * fb, pal.a[2] * fb], n * 6 + 3);
      n++;
    }
    touch(g.grid);
  }

  // the tunnel to the swarm
  const tunnelOn = win(t, 3.85, 6.25, 0.3);
  {
    const LP = g.tunnel.attributes.position.array as Float32Array;
    const LC = g.tunnel.attributes.color.array as Float32Array;
    for (let r = 0; r < 40; r++) {
      const z = 2 - r * 1.05;
      const rad = 4.4 + Math.sin(r * 0.6 + t * 3) * 0.25;
      const col = lerp3(pal.a, pal.b, (r / 40 + t * 0.5) % 1);
      const k = tunnelOn * gain * (0.35 + 0.65 * Math.exp(-(((r * 1.05 + t * 25) % 42) / 6)));
      for (let s2 = 0; s2 < 64; s2++) {
        const a1 = (s2 / 64) * Math.PI * 2 + r * 0.08 + t * 0.6, a2 = ((s2 + 1) / 64) * Math.PI * 2 + r * 0.08 + t * 0.6;
        const i = r * 64 + s2;
        LP.set([Math.cos(a1) * rad, Math.sin(a1) * rad, z], i * 6);
        LP.set([Math.cos(a2) * rad, Math.sin(a2) * rad, z], i * 6 + 3);
        const kk = s2 % 8 < 5 ? k : k * 0.15;
        LC.set([col[0] * kk, col[1] * kk, col[2] * kk], i * 6);
        LC.set([col[0] * kk, col[1] * kk, col[2] * kk], i * 6 + 3);
      }
    }
    touch(g.tunnel);
  }

  // beams: the swarm reaching the release, the agents reaching the vote card
  {
    const LP = g.beams.attributes.position.array as Float32Array;
    const LC = g.beams.attributes.color.array as Float32Array;
    LP.fill(0);
    LC.fill(0);
    let n = 0;
    const deadline = win(t, Q.beam, Q.drop - 0.05, 0.3);
    if (deadline > 0)
      for (let k = 0; k < 6; k++) {
        const o: V3 = [ESPHERE[0] + Math.cos(k) * 0.6, ESPHERE[1] - 1.6, ESPHERE[2] + Math.sin(k) * 0.6];
        const tgt: V3 = [E[0] + 2.6 - k * 0.15, E[1] + 1.0 - k * 0.3, E[2]];
        LP.set(o, n * 6);
        LP.set(tgt, n * 6 + 3);
        const c = 0.9 * deadline * gain;
        LC.set([0.24 * c, 1 * c, 0.56 * c], n * 6);
        LC.set([0.24 * c, 1 * c, 0.56 * c], n * 6 + 3);
        n++;
      }
    for (let k = 0; k < 9; k++) {
      const v = Q.votes[k];
      const on = win(t, v, Q.kept, 0.15);
      if (on <= 0) continue;
      const yes = k !== Q.no;
      const o = knotPos(k, t);
      const flare = 1 + 2.5 * Math.exp(-(t - v) * 8);
      const c = on * flare * 0.6 * gain;
      const col: RGB = yes ? [0.24, 1, 0.56] : [1, 0.3, 0.25];
      LP.set(o, n * 6);
      LP.set(F, n * 6 + 3);
      LC.set([col[0] * c, col[1] * c, col[2] * c], n * 6);
      LC.set([col[0] * c * 0.2, col[1] * c * 0.2, col[2] * c * 0.2], n * 6 + 3);
      n++;
    }
    touch(g.beams);
  }

  // light rays behind the seal and the mark
  const raysOn = Math.max(win(t, Q.seal - 0.05, Q.pledge + 0.1, 0.25), win(t, Q.logo - 0.05, 31, 0.4));
  const rayAt: V3 = t > Q.tagline ? SEAL_END : B;
  {
    const P = g.rays.attributes.position.array as Float32Array;
    const Cc = g.rays.attributes.color.array as Float32Array;
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2 + t * 0.25;
      const w = 0.012 + 0.012 * rnd(k);
      const L = 9 + 7 * rnd(k + 3);
      P.set([0, 0, -0.3, Math.cos(a - w) * L, Math.sin(a - w) * L, -0.3, Math.cos(a + w) * L, Math.sin(a + w) * L, -0.3], k * 9);
      const col = k % 3 === 0 ? pal.c : pal.a;
      const c = raysOn * gain * (0.06 + 0.08 * rnd(k + 5)) * (1 + 1.2 * hit);
      Cc.set([col[0] * c, col[1] * c, col[2] * c, 0, 0, 0, 0, 0, 0], k * 9);
    }
    touch(g.rays);
  }

  // nebula clouds: big coloured glows ahead of the camera
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const clouds = [0, 1, 2, 3, 4].map((k) => {
    const off = right.clone().multiplyScalar(Math.sin(k * 2.1 + t * 0.05) * 28).add(new THREE.Vector3(0, Math.cos(k * 1.7) * 10 - 4, 0));
    const p = new THREE.Vector3(...cam.pos).add(fwd.clone().multiplyScalar(70 + k * 12)).add(off);
    const col = [pal.a, pal.b, pal.c, pal.b, pal.a][k];
    smats[k].color.setRGB(col[0], col[1], col[2]);
    smats[k].opacity = (0.1 + 0.04 * Math.sin(t * 0.7 + k)) * gain;
    return { p, s: 55 + k * 12 };
  });

  return (
    <>
      <Rig t={t} />
      {clouds.map((c, k) => (
        <sprite key={k} material={smats[k]} position={c.p} scale={[c.s, c.s, 1]} />
      ))}
      <lineSegments geometry={g.grid} material={lmat} frustumCulled={false} />
      <lineSegments geometry={g.tunnel} material={lmat} frustumCulled={false} />
      <lineSegments geometry={g.streak} material={lmat} frustumCulled={false} />
      <lineSegments geometry={g.beams} material={lmat} frustumCulled={false} />
      <mesh geometry={g.rays} material={rmat} position={rayAt} frustumCulled={false} />
      <points geometry={g.dust} material={pmat} frustumCulled={false} />
      <points geometry={g.swarm} material={pmat} frustumCulled={false} />
    </>
  );
};

/// The world, plus a quarter-resolution blurred copy screened on top for bloom.
export const Field: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const cam = { fov: FOV, position: [0, 0, 12] as V3, near: 0.1, far: 400 };
  return (
    <>
      <ThreeCanvas width={width} height={height} style={{ position: "absolute", inset: 0 }} camera={cam}>
        <World t={t} height={height} gain={1} />
      </ThreeCanvas>
      <div style={{ position: "absolute", left: 0, top: 0, width: width / 4, height: height / 4, transform: "scale(4)", transformOrigin: "0 0", filter: "blur(3px) brightness(1.5)", mixBlendMode: "screen", opacity: 0.65 }}>
        <ThreeCanvas width={width / 4} height={height / 4} camera={cam}>
          <World t={t} height={height / 4} gain={1.2} />
        </ThreeCanvas>
      </div>
    </>
  );
};
