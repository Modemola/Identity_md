// The Swarm: IMD's agents as a sphere of points around the promise at its centre.
//
// Raw WebGL2 with no 3D library: about 8 KB, loaded after first paint. All motion lives in the
// shaders as a function of a few uniforms, so a frame costs the CPU one small matrix and about ten
// uniform writes. Events from the verdict feed drive it:
//   check asked  -> a panel of nine agents links to the core (amber)
//   kept         -> a green wave sweeps the sphere and the agents brighten
//   broken       -> red embers break away from the sphere, drift and fall back
// Every effect has a zero-crossing envelope, so nothing ever snaps.
//
// Safety, in the same spirit as the rest of the site:
// - refuses software rendering (failIfMajorPerformanceCaveat) and falls back to a static 2D frame;
// - renders only while on screen and while the tab is visible;
// - watches its own frame time and halves resolution and point count on a struggling device;
// - prefers-reduced-motion gets one still frame, no loop;
// - recovers from a lost GL context by switching to the still frame.

const TAU = Math.PI * 2;
const EVENT_SECONDS = { kept: 2.6, broken: 3.0, panel: 2.4 };

const POINT_VS = `#version 300 es
precision highp float;
in vec3 aPos;
in float aSeed;
uniform mat3 uRot;
uniform float uAspect;
uniform float uTime;
uniform float uDpr;
uniform float uSize;
uniform vec3 uWaveDir;
uniform float uWaveT;   // 0..1 progress of a kept wave, 0 when idle
uniform vec3 uEmberDir;
uniform float uEmberT;  // 0..1 progress of a broken burst, 0 when idle
out vec3 vColor;
out float vAlpha;

const vec3 INK = vec3(0.88);
const vec3 OK = vec3(0.243, 0.812, 0.478);
const vec3 ALARM = vec3(1.0, 0.42, 0.384);

vec4 project(vec3 r) {
  float z = r.z - 3.3;
  float f = 2.45; // a long lens: little distortion, the sphere fills two thirds of the height
  return vec4(r.x * f / uAspect, r.y * f, z * 1.02 + 0.2, -z);
}

void main() {
  vec3 n = normalize(aPos);
  // each agent breathes on its own phase
  vec3 p = aPos * (1.0 + 0.018 * sin(uTime * 0.8 + aSeed * 31.0));

  // kept: a ring travels from uWaveDir across the sphere; behind it the agents stay lit, fading
  float wEnv = sin(uWaveT * 3.14159);
  float ang = acos(clamp(dot(n, uWaveDir), -1.0, 1.0));
  float front = uWaveT * 3.4;
  float band = exp(-pow((ang - front) * 4.0, 2.0)) * step(0.0001, uWaveT);
  float behind = step(ang, front) * wEnv * 0.55;
  float kept = max(band, behind);
  p += n * band * 0.07;

  // broken: agents near uEmberDir lift off, drift outward and sink, then return
  float eEnv = sin(uEmberT * 3.14159);
  float near = smoothstep(1.05, 0.0, acos(clamp(dot(n, uEmberDir), -1.0, 1.0)));
  float ember = near * eEnv * step(0.0001, uEmberT);
  p += n * ember * (0.25 + 0.55 * aSeed) - vec3(0.0, ember * ember * 0.45 * aSeed, 0.0);

  vec3 r = uRot * p;
  gl_Position = project(r);
  float depth = clamp((r.z + 1.2) / 2.4, 0.0, 1.0); // 0 back, 1 front
  gl_PointSize = uSize * uDpr * (0.5 + depth * 0.95) * (1.0 + band * 1.4 + ember * 0.8);
  vColor = mix(mix(INK, OK, kept), ALARM, ember);
  vAlpha = mix(0.16, 0.95, depth) * (aSeed > 0.93 ? 1.0 : 0.82) * (1.0 - ember * 0.25);
}`;

const POINT_FS = `#version 300 es
precision mediump float;
in vec3 vColor;
in float vAlpha;
out vec4 o;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  float a = smoothstep(1.0, 0.15, d) * vAlpha;
  o = vec4(vColor * a, a);
}`;

const LINE_VS = `#version 300 es
precision highp float;
in vec3 aPos;
uniform mat3 uRot;
uniform float uAspect;
out float vDepth;
void main() {
  vec3 r = uRot * aPos;
  float z = r.z - 3.3;
  gl_Position = vec4(r.x * 2.45 / uAspect, r.y * 2.45, z * 1.02 + 0.2, -z);
  vDepth = clamp((r.z + 1.4) / 2.8, 0.0, 1.0);
}`;

const LINE_FS = `#version 300 es
precision mediump float;
in float vDepth;
uniform vec4 uColor;
out vec4 o;
void main() {
  float a = uColor.a * mix(0.25, 1.0, vDepth);
  o = vec4(uColor.rgb * a, a);
}`;

// ------------------------------------------------------------------ geometry

/** Points on a sphere (Fibonacci lattice), in a shuffled order so any prefix is still uniform. */
function sphere(n) {
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  const order = Array.from({ length: n }, (_, i) => i);
  let s = 1337;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let k = 0; k < n; k++) {
    const i = order[k];
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const jitter = 1 + (rnd() - 0.5) * 0.06;
    pos[k * 3] = Math.cos(th) * r * jitter;
    pos[k * 3 + 1] = y * jitter;
    pos[k * 3 + 2] = Math.sin(th) * r * jitter;
    seed[k] = rnd();
  }
  return { pos, seed };
}

/** Three tilted orbit rings and the octahedral seal at the core, as GL_LINES. */
function frame() {
  const v = [];
  const ring = (radius, tiltX, tiltZ, segs = 120) => {
    const cx = Math.cos(tiltX), sx = Math.sin(tiltX), cz = Math.cos(tiltZ), sz = Math.sin(tiltZ);
    const pt = (t) => {
      let x = Math.cos(t) * radius, y = 0, z = Math.sin(t) * radius;
      [y, z] = [y * cx - z * sx, y * sx + z * cx];
      [x, y] = [x * cz - y * sz, x * sz + y * cz];
      return [x, y, z];
    };
    for (let i = 0; i < segs; i++) v.push(...pt((i / segs) * TAU), ...pt(((i + 1) / segs) * TAU));
  };
  ring(1.22, 1.2, 0.3);
  ring(1.3, 0.35, -0.9);
  ring(1.15, -0.6, 1.25);
  const ringVerts = v.length / 3;
  const o = 0.2;
  const P = [[o, 0, 0], [-o, 0, 0], [0, o * 1.35, 0], [0, -o * 1.35, 0], [0, 0, o], [0, 0, -o]];
  const E = [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2]];
  for (const [a, b] of E) v.push(...P[a], ...P[b]);
  return { verts: new Float32Array(v), ringVerts, sealVerts: E.length * 2 };
}

// ------------------------------------------------------------------ math

function rotation(yaw, pitch, roll = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  // R = Rz(roll) * Rx(pitch) * Ry(yaw), column-major for GLSL
  const m = [
    cy, 0, -sy,
    sy * sp, cp, cy * sp,
    sy * cp, -sp, cy * cp,
  ];
  // apply roll around z
  const out = new Float32Array(9);
  for (let c = 0; c < 3; c++) {
    const x = m[c * 3], y = m[c * 3 + 1], z = m[c * 3 + 2];
    out[c * 3] = x * cr - y * sr;
    out[c * 3 + 1] = x * sr + y * cr;
    out[c * 3 + 2] = z;
  }
  return out;
}

function mul3(m, [x, y, z]) {
  return [m[0] * x + m[3] * y + m[6] * z, m[1] * x + m[4] * y + m[7] * z, m[2] * x + m[5] * y + m[8] * z];
}

/** Inverse of a rotation is its transpose: turns a camera-space direction into sphere space. */
function unrotate(m, v) {
  const [x, y, z] = v;
  return [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];
}

const norm = ([x, y, z]) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

// ------------------------------------------------------------------ GL helpers

/**
 * Starts compiling and linking without asking for the result: asking forces the driver to finish
 * synchronously, which can freeze the page for hundreds of ms. finishProgram checks it later.
 */
function startProgram(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    gl.attachShader(p, sh);
  }
  gl.linkProgram(p);
  return p;
}

function finishProgram(gl, p) {
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const logs = gl.getAttachedShaders(p).map((sh) => gl.getShaderInfoLog(sh)).join(" ");
    throw new Error(gl.getProgramInfoLog(p) || logs);
  }
  const u = {};
  const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const name = gl.getActiveUniform(p, i).name;
    u[name] = gl.getUniformLocation(p, name);
  }
  return { p, u };
}

function buffer(gl, data) {
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return b;
}

// ------------------------------------------------------------------ public

/**
 * Mounts the swarm into `host` (an element with a size). Returns a controller:
 *   pulse("kept" | "broken" | "panel"), destroy().
 * Falls back to a still 2D frame when WebGL2 is missing, software-only or lost.
 */
export function mountSwarm(host, { reduced = false, fine = true } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "swarm-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.append(canvas);

  // density follows the screen's area, so a phone and a desktop see the same texture
  const area = host.clientWidth * host.clientHeight;
  const small = !fine || area < 200_000;
  let count = Math.round(Math.min(2200, Math.max(900, area / 110)));
  let dprCap = small ? 1.5 : 2;
  const geo = sphere(count);

  let gl = null;
  try {
    gl = canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true, failIfMajorPerformanceCaveat: !/[?&]gl=force/.test(location.search), powerPreference: "default" });
  } catch {}
  if (!gl) return still(host, canvas, geo);

  // Compile in the background where the driver can (KHR_parallel_shader_compile), polling once a
  // frame; until then the controller queues pulses. Without the extension this runs at once.
  const progs = [startProgram(gl, POINT_VS, POINT_FS), startProgram(gl, LINE_VS, LINE_FS)];
  const ext = gl.getExtension("KHR_parallel_shader_compile");
  let inner = null;
  let dead = false;
  const queued = [];
  const proxy = {
    get count() {
      return inner ? inner.count : 0;
    },
    onReady: null,
    pulse(kind) {
      if (inner) inner.pulse(kind);
      else if (queued.length < 3) queued.push(kind);
    },
    destroy() {
      dead = true;
      if (inner) inner.destroy();
      else canvas.remove();
    },
  };
  const compiled = () => !ext || progs.every((p) => gl.getProgramParameter(p, ext.COMPLETION_STATUS_KHR));
  const wait = () => {
    if (dead) return;
    if (gl.isContextLost()) {
      // lost before the scene ever ran: show the still frame instead of polling forever
      canvas.remove();
      inner = still(host, document.createElement("canvas"), geo);
      return;
    }
    if (!compiled()) return void requestAnimationFrame(wait);
    inner = run();
    queued.splice(0).forEach((k) => inner.pulse(k));
    proxy.onReady?.(inner);
  };
  wait();
  return proxy;

  function run() {
  let pts, lines, vaoPts, vaoLines, vaoPanel, panelBuf, fr;
  try {
    pts = finishProgram(gl, progs[0]);
    lines = finishProgram(gl, progs[1]);
    fr = frame();

    vaoPts = gl.createVertexArray();
    gl.bindVertexArray(vaoPts);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer(gl, geo.pos));
    let loc = gl.getAttribLocation(pts.p, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer(gl, geo.seed));
    loc = gl.getAttribLocation(pts.p, "aSeed");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 0, 0);

    vaoLines = gl.createVertexArray();
    gl.bindVertexArray(vaoLines);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer(gl, fr.verts));
    loc = gl.getAttribLocation(lines.p, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);

    vaoPanel = gl.createVertexArray();
    gl.bindVertexArray(vaoPanel);
    panelBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, panelBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(9 * 2 * 3), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  } catch {
    canvas.remove();
    return still(host, document.createElement("canvas"), geo);
  }

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.DEPTH_TEST);

  // ---------------------------------------------------------------- state
  let w = 0, h = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, dprCap);
    w = Math.max(1, Math.round(host.clientWidth * dpr));
    h = Math.max(1, Math.round(host.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    if (!running) draw(last);
  };

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const events = { kept: null, broken: null, panel: null };
  let rot = rotation(0, 0.32);
  let t0 = performance.now();
  let last = 0;
  let raf = 0;
  let running = false;
  let visible = false;
  let lost = false;
  // adaptive quality: average frame time over a window; degrade once if the device struggles
  let sampleStart = 0, sampleFrames = 0, level = 0, frozen = false;

  function eventProgress(e, now) {
    if (!e) return 0;
    const k = (now - e.start) / (EVENT_SECONDS[e.kind] * 1000);
    return k >= 1 ? 0 : Math.max(k, 0.0001);
  }

  function draw(now) {
    if (lost) return;
    const t = (now - t0) / 1000;
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    const yaw = (reduced ? 0.6 : t * 0.11) + pointer.x * 0.5;
    const pitch = 0.32 + pointer.y * 0.28;
    rot = rotation(yaw, pitch, -0.08);

    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const aspect = w / h;

    // rings and seal
    gl.useProgram(lines.p);
    gl.uniformMatrix3fv(lines.u.uRot, false, rot);
    gl.uniform1f(lines.u.uAspect, aspect);
    gl.bindVertexArray(vaoLines);
    gl.uniform4f(lines.u.uColor, 0.85, 0.85, 0.85, 0.16);
    gl.drawArrays(gl.LINES, 0, fr.ringVerts);
    // the seal at the core takes the colour of the latest verdict while it plays
    const g = Math.sin(eventProgress(events.kept, now) * Math.PI);
    const b = Math.sin(eventProgress(events.broken, now) * Math.PI);
    const mix = (ink, ok, alarm) => ink + (ok - ink) * g + (alarm - ink) * b;
    gl.uniform4f(lines.u.uColor, mix(0.9, 0.243, 1.0), mix(0.9, 0.812, 0.42), mix(0.9, 0.478, 0.384), 0.8);
    gl.drawArrays(gl.LINES, fr.ringVerts, fr.sealVerts);

    // a panel of nine agents linked to the core while a check is being answered
    const pk = eventProgress(events.panel, now);
    if (pk) {
      gl.bindVertexArray(vaoPanel);
      gl.uniform4f(lines.u.uColor, 0.94, 0.71, 0.16, 0.7 * Math.sin(pk * Math.PI));
      gl.drawArrays(gl.LINES, 0, 18);
    }

    // the agents
    gl.useProgram(pts.p);
    gl.uniformMatrix3fv(pts.u.uRot, false, rot);
    gl.uniform1f(pts.u.uAspect, aspect);
    gl.uniform1f(pts.u.uTime, t);
    gl.uniform1f(pts.u.uDpr, dpr);
    gl.uniform1f(pts.u.uSize, small ? 2.8 : 3.2);
    gl.uniform3fv(pts.u.uWaveDir, events.kept?.dir ?? [0, 0, 1]);
    gl.uniform1f(pts.u.uWaveT, eventProgress(events.kept, now));
    gl.uniform3fv(pts.u.uEmberDir, events.broken?.dir ?? [0, 0, 1]);
    gl.uniform1f(pts.u.uEmberT, eventProgress(events.broken, now));
    gl.bindVertexArray(vaoPts);
    gl.drawArrays(gl.POINTS, 0, count);
  }

  function loop(now) {
    raf = 0;
    if (!running) return;
    // Quality watchdog, in 2-second windows of visible animation. A device that cannot hold
    // ~45 fps first gets half the agents at 1x resolution; if that is still too slow, the swarm
    // drops to 20 fps, which keeps the motion legible and leaves the rest of the page smooth.
    // If even that leaves the page below ~38 fps, the swarm holds still: the page matters more.
    if (level < 3) {
      if (!sampleStart) sampleStart = now;
      sampleFrames++;
      if (now - sampleStart > 2000) {
        const avg = (now - sampleStart) / sampleFrames;
        if (avg > (level < 2 ? 22 : 26)) {
          level += 1;
          if (level === 1) {
            count = Math.floor(count / 2);
            dprCap = 1;
            resize();
          }
          if (level === 3) {
            frozen = true;
            running = false;
            draw(now);
            return;
          }
        }
        sampleStart = now;
        sampleFrames = 0;
      }
    }
    if (level < 2 || now - last >= 48) {
      last = now;
      draw(now);
    }
    raf = requestAnimationFrame(loop);
  }

  function sync() {
    const should = visible && !document.hidden && !lost && !reduced && !frozen;
    if (should && !running) {
      running = true;
      sampleStart = 0;
      sampleFrames = 0;
      raf = requestAnimationFrame(loop);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    sync();
  });
  io.observe(host);
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  document.addEventListener("visibilitychange", sync);

  const onMove = (e) => {
    const r = host.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  };
  const onLeave = () => ((pointer.tx = 0), (pointer.ty = 0));
  if (fine && !reduced) {
    // the whole hero steers the swarm, not only the canvas
    const zone = host.closest("[data-swarm-zone]") || host;
    zone.addEventListener("pointermove", onMove, { passive: true });
    zone.addEventListener("pointerleave", onLeave);
  }

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    lost = true;
    sync();
    canvas.remove();
    still(host, document.createElement("canvas"), geo);
  });

  resize();
  draw(performance.now());
  requestAnimationFrame(() => canvas.classList.add("on"));

  /** A direction facing the camera (so the effect is seen), turned into sphere space. */
  function facingDir() {
    const a = Math.random() * TAU;
    const spread = 0.65;
    const cam = norm([Math.cos(a) * spread, Math.sin(a) * spread * 0.7, 1]);
    return norm(unrotate(rot, cam));
  }

  return {
    get count() {
      return count;
    },
    pulse(kind) {
      if (lost || !EVENT_SECONDS[kind]) return;
      const now = performance.now();
      const ev = { kind, start: now, dir: facingDir() };
      events[kind] = ev;
      if (kind === "panel") {
        // nine agents on the visible hemisphere answer this check
        const v = new Float32Array(18 * 3);
        for (let i = 0; i < 9; i++) {
          let best = 0;
          for (let tries = 0; tries < 12; tries++) {
            const k = Math.floor(Math.random() * count);
            const z = mul3(rot, [geo.pos[k * 3], geo.pos[k * 3 + 1], geo.pos[k * 3 + 2]])[2];
            if (z > 0.1) { best = k; break; }
            best = k;
          }
          v.set([0, 0, 0, geo.pos[best * 3], geo.pos[best * 3 + 1], geo.pos[best * 3 + 2]], i * 6);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, panelBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, v);
      }
      if (!running) draw(now);
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    },
  };
}
}

/** One still frame on a 2D canvas: the same sphere, projected once. No loop, no GPU needed. */
function still(host, canvas, geo) {
  canvas.className = "swarm-canvas on";
  if (!canvas.isConnected) host.append(canvas);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = (canvas.width = Math.max(1, host.clientWidth * dpr));
  const H = (canvas.height = Math.max(1, host.clientHeight * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) return { count: 0, pulse() {}, destroy() {} };
  const m = rotation(0.6, 0.32, -0.08);
  const n = geo.pos.length / 3;
  const f = 2.45;
  const pts = [];
  for (let k = 0; k < n; k++) {
    const [x, y, z] = mul3(m, [geo.pos[k * 3], geo.pos[k * 3 + 1], geo.pos[k * 3 + 2]]);
    const d = 3.3 - z;
    pts.push([W / 2 + ((x * f) / d) * (H / 2), H / 2 - ((y * f) / d) * (H / 2), (z + 1.2) / 2.4]);
  }
  pts.sort((a, b) => a[2] - b[2]);
  for (const [x, y, depth] of pts) {
    ctx.fillStyle = `rgba(225,225,225,${0.16 + depth * 0.75})`;
    ctx.beginPath();
    ctx.arc(x, y, (0.5 + depth) * 1.3 * dpr, 0, TAU);
    ctx.fill();
  }
  return { count: n, pulse() {}, destroy() { canvas.remove(); } };
}
