import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { CAM_Z, dustAt, FOV, NA, NB, Q, swarmAt } from "./particles";

/// The camera: a slow drift, a push on every big moment. The HTML layer follows the z = 0 plane
/// with `planeTransform`, so cards stay glued to the particles that draw them.
export function cam(t: number) {
  const push = (at: number, amt: number, len = 2.4) => (t < at ? 0 : amt * Math.sin(Math.min(1, (t - at) / len) * Math.PI * 0.5) * Math.exp(-Math.max(0, t - at - len) * 0.8));
  return {
    x: Math.sin(t * 0.21) * 0.12,
    y: Math.cos(t * 0.17) * 0.08,
    z: CAM_Z - (t * 0.04 + push(Q.seal, 1.2) + push(Q.drop, 0.9, 3) + push(Q.logo, 1.0, 3.5) - push(Q.pledge, 0.6, 1.5)),
  };
}
const K = (2 * CAM_Z * Math.tan(((FOV / 2) * Math.PI) / 180)) / 1080;
export function planeTransform(t: number) {
  const c = cam(t);
  const s = CAM_Z / c.z;
  return `translate(${(-c.x / K) * s}px, ${(c.y / K) * s}px) scale(${s})`;
}

const VS = `
attribute vec3 color; attribute float alpha; attribute float size;
varying vec3 vColor; varying float vAlpha; varying float vBlur;
uniform float uFocus; uniform float uPx;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float d = -mv.z;
  float coc = clamp(abs(d - uFocus) * 0.22, 0.0, 4.0);
  vBlur = coc;
  vColor = color;
  vAlpha = alpha / (1.0 + coc * coc * 0.9);
  gl_PointSize = max(1.0, size * uPx / d * (1.0 + coc * 2.2));
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
varying vec3 vColor; varying float vAlpha; varying float vBlur;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p) * 2.0;
  if (r > 1.0) discard;
  float core = smoothstep(0.42 + vBlur * 0.15, 0.0, r);
  float halo = exp(-r * r * 3.5) * 0.5;
  float k = (core + halo) * vAlpha;
  gl_FragColor = vec4(vColor * k, k);
}`;

function cloud(n: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute("size", new THREE.BufferAttribute(new Float32Array(n), 1));
  return g;
}

const Scene: React.FC<{ t: number; height: number; gain: number }> = ({ t, height, gain }) => {
  const swarm = React.useMemo(() => cloud(NA), []);
  const dust = React.useMemo(() => cloud(NB), []);
  const mat = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VS,
        fragmentShader: FS,
        uniforms: { uFocus: { value: CAM_Z }, uPx: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  mat.uniforms.uPx.value = height / (2 * Math.tan(((FOV / 2) * Math.PI) / 180));
  const c = cam(t);
  mat.uniforms.uFocus.value = c.z;

  const f = swarmAt(t);
  (swarm.attributes.position.array as Float32Array).set(f.p);
  (swarm.attributes.color.array as Float32Array).set(f.c);
  const sa = swarm.attributes.alpha.array as Float32Array;
  const ss = swarm.attributes.size.array as Float32Array;
  for (let i = 0; i < NA; i++) {
    sa[i] = f.a[i] * gain;
    ss[i] = 0.034 + ((i * 7919) % 13) * 0.0018;
  }
  const d = dustAt(t);
  (dust.attributes.position.array as Float32Array).set(d.p);
  const dc = dust.attributes.color.array as Float32Array;
  const da = dust.attributes.alpha.array as Float32Array;
  const ds = dust.attributes.size.array as Float32Array;
  for (let i = 0; i < NB; i++) {
    dc[i * 3] = 0.6;
    dc[i * 3 + 1] = 0.75;
    dc[i * 3 + 2] = 0.7;
    da[i] = d.a[i] * gain;
    ds[i] = 0.05;
  }
  for (const g of [swarm, dust]) for (const k of ["position", "color", "alpha", "size"]) g.attributes[k].needsUpdate = true;

  return (
    <>
      <PerspectiveCam x={c.x} y={c.y} z={c.z} />
      <points geometry={dust} material={mat} frustumCulled={false} />
      <points geometry={swarm} material={mat} frustumCulled={false} />
    </>
  );
};

const PerspectiveCam: React.FC<{ x: number; y: number; z: number }> = ({ x, y, z }) => {
  const { camera } = useThree();
  camera.position.set(x, y, z);
  camera.lookAt(x, y, 0);
  (camera as THREE.PerspectiveCamera).fov = FOV;
  camera.updateProjectionMatrix();
  return null;
};

/// The particle field plus a low-resolution blurred copy screened on top: the bloom.
export const Field: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  return (
    <>
      <ThreeCanvas width={width} height={height} style={{ position: "absolute", inset: 0 }} camera={{ fov: FOV, position: [0, 0, CAM_Z], near: 0.1, far: 100 }}>
        <Scene t={t} height={height} gain={1} />
      </ThreeCanvas>
      <div style={{ position: "absolute", left: 0, top: 0, width: width / 4, height: height / 4, transform: "scale(4)", transformOrigin: "0 0", filter: "blur(2.5px) brightness(1.8)", mixBlendMode: "screen", opacity: 0.85 }}>
        <ThreeCanvas width={width / 4} height={height / 4} camera={{ fov: FOV, position: [0, 0, CAM_Z], near: 0.1, far: 100 }}>
          <Scene t={t} height={height / 4} gain={1.6} />
        </ThreeCanvas>
      </div>
    </>
  );
};
