var e=Math.PI*2,t={kept:2.6,broken:3,panel:2.4},n=`#version 300 es
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
}`,r=`#version 300 es
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
}`,i=`#version 300 es
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
}`,a=`#version 300 es
precision mediump float;
in float vDepth;
uniform vec4 uColor;
out vec4 o;
void main() {
  float a = uColor.a * mix(0.25, 1.0, vDepth);
  o = vec4(uColor.rgb * a, a);
}`;function o(e){let t=new Float32Array(e*3),n=new Float32Array(e),r=Array.from({length:e},(e,t)=>t),i=1337,a=()=>(i=i*16807%2147483647)/2147483647;for(let t=e-1;t>0;t--){let e=Math.floor(a()*(t+1));[r[t],r[e]]=[r[e],r[t]]}let o=Math.PI*(3-Math.sqrt(5));for(let i=0;i<e;i++){let s=r[i],c=1-s/(e-1)*2,l=Math.sqrt(1-c*c),u=o*s,d=1+(a()-.5)*.06;t[i*3]=Math.cos(u)*l*d,t[i*3+1]=c*d,t[i*3+2]=Math.sin(u)*l*d,n[i]=a()}return{pos:t,seed:n}}function s(){let t=[],n=(n,r,i,a=120)=>{let o=Math.cos(r),s=Math.sin(r),c=Math.cos(i),l=Math.sin(i),u=e=>{let t=Math.cos(e)*n,r=0,i=Math.sin(e)*n;return[r,i]=[r*o-i*s,r*s+i*o],[t,r]=[t*c-r*l,t*l+r*c],[t,r,i]};for(let n=0;n<a;n++)t.push(...u(n/a*e),...u((n+1)/a*e))};n(1.22,1.2,.3),n(1.3,.35,-.9),n(1.15,-.6,1.25);let r=t.length/3,i=.2,a=[[i,0,0],[-.2,0,0],[0,i*1.35,0],[0,-.27,0],[0,0,i],[0,0,-.2]],o=[[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,4],[4,3],[3,5],[5,2]];for(let[e,n]of o)t.push(...a[e],...a[n]);return{verts:new Float32Array(t),ringVerts:r,sealVerts:o.length*2}}function c(e,t,n=0){let r=Math.cos(e),i=Math.sin(e),a=Math.cos(t),o=Math.sin(t),s=Math.cos(n),c=Math.sin(n),l=[r,0,-i,i*o,a,r*o,i*a,-o,r*a],u=new Float32Array(9);for(let e=0;e<3;e++){let t=l[e*3],n=l[e*3+1],r=l[e*3+2];u[e*3]=t*s-n*c,u[e*3+1]=t*c+n*s,u[e*3+2]=r}return u}function l(e,[t,n,r]){return[e[0]*t+e[3]*n+e[6]*r,e[1]*t+e[4]*n+e[7]*r,e[2]*t+e[5]*n+e[8]*r]}function u(e,t){let[n,r,i]=t;return[e[0]*n+e[1]*r+e[2]*i,e[3]*n+e[4]*r+e[5]*i,e[6]*n+e[7]*r+e[8]*i]}var d=([e,t,n])=>{let r=Math.hypot(e,t,n)||1;return[e/r,t/r,n/r]};function f(e,t,n){let r=e.createProgram();for(let[i,a]of[[e.VERTEX_SHADER,t],[e.FRAGMENT_SHADER,n]]){let t=e.createShader(i);e.shaderSource(t,a),e.compileShader(t),e.attachShader(r,t)}return e.linkProgram(r),r}function p(e,t){if(!e.getProgramParameter(t,e.LINK_STATUS)){let n=e.getAttachedShaders(t).map(t=>e.getShaderInfoLog(t)).join(` `);throw Error(e.getProgramInfoLog(t)||n)}let n={},r=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let i=0;i<r;i++){let r=e.getActiveUniform(t,i).name;n[r]=e.getUniformLocation(t,r)}return{p:t,u:n}}function m(e,t){let n=e.createBuffer();return e.bindBuffer(e.ARRAY_BUFFER,n),e.bufferData(e.ARRAY_BUFFER,t,e.STATIC_DRAW),n}function h(h,{reduced:_=!1,fine:v=!0}={}){let y=document.createElement(`canvas`);y.className=`swarm-canvas`,y.setAttribute(`aria-hidden`,`true`),h.append(y);let b=h.clientWidth*h.clientHeight,x=!v||b<2e5,S=Math.round(Math.min(2200,Math.max(900,b/110))),C=x?1.5:2,w=o(S),T=null;try{T=y.getContext(`webgl2`,{antialias:!0,alpha:!0,premultipliedAlpha:!0,failIfMajorPerformanceCaveat:!/[?&]gl=force/.test(location.search),powerPreference:`default`})}catch{}if(!T)return g(h,y,w);let E=[f(T,n,r),f(T,i,a)],D=T.getExtension(`KHR_parallel_shader_compile`),O=null,k=!1,A=[],j={get count(){return O?O.count:0},onReady:null,pulse(e){O?O.pulse(e):A.length<3&&A.push(e)},destroy(){k=!0,O?O.destroy():y.remove()}},M=()=>!D||E.every(e=>T.getProgramParameter(e,D.COMPLETION_STATUS_KHR)),N=()=>{if(!k){if(T.isContextLost())y.remove(),O=g(h,document.createElement(`canvas`),w);else{if(!M())return void requestAnimationFrame(N);O=P(),A.splice(0).forEach(e=>O.pulse(e)),j.onReady?.(O)}}};return N(),j;function P(){let n,r,i,a,o,f,b;try{n=p(T,E[0]),r=p(T,E[1]),b=s(),i=T.createVertexArray(),T.bindVertexArray(i),T.bindBuffer(T.ARRAY_BUFFER,m(T,w.pos));let e=T.getAttribLocation(n.p,`aPos`);T.enableVertexAttribArray(e),T.vertexAttribPointer(e,3,T.FLOAT,!1,0,0),T.bindBuffer(T.ARRAY_BUFFER,m(T,w.seed)),e=T.getAttribLocation(n.p,`aSeed`),T.enableVertexAttribArray(e),T.vertexAttribPointer(e,1,T.FLOAT,!1,0,0),a=T.createVertexArray(),T.bindVertexArray(a),T.bindBuffer(T.ARRAY_BUFFER,m(T,b.verts)),e=T.getAttribLocation(r.p,`aPos`),T.enableVertexAttribArray(e),T.vertexAttribPointer(e,3,T.FLOAT,!1,0,0),o=T.createVertexArray(),T.bindVertexArray(o),f=T.createBuffer(),T.bindBuffer(T.ARRAY_BUFFER,f),T.bufferData(T.ARRAY_BUFFER,new Float32Array(54),T.DYNAMIC_DRAW),T.enableVertexAttribArray(e),T.vertexAttribPointer(e,3,T.FLOAT,!1,0,0),T.bindVertexArray(null)}catch{return y.remove(),g(h,document.createElement(`canvas`),w)}T.enable(T.BLEND),T.blendFunc(T.ONE,T.ONE_MINUS_SRC_ALPHA),T.disable(T.DEPTH_TEST);let D=0,O=0,k=1,A=()=>{k=Math.min(devicePixelRatio||1,C),D=Math.max(1,Math.round(h.clientWidth*k)),O=Math.max(1,Math.round(h.clientHeight*k)),(y.width!==D||y.height!==O)&&(y.width=D,y.height=O),L||G(F)},j={x:0,y:0,tx:0,ty:0},M={kept:null,broken:null,panel:null},N=c(0,.32),P=performance.now(),F=0,I=0,L=!1,R=!1,z=!1,B=0,V=0,H=0,U=!1;function W(e,n){if(!e)return 0;let r=(n-e.start)/(t[e.kind]*1e3);return r>=1?0:Math.max(r,1e-4)}function G(e){if(z)return;let t=(e-P)/1e3;j.x+=(j.tx-j.x)*.06,j.y+=(j.ty-j.y)*.06,N=c((_?.6:t*.11)+j.x*.5,.32+j.y*.28,-.08),T.viewport(0,0,D,O),T.clearColor(0,0,0,0),T.clear(T.COLOR_BUFFER_BIT);let s=D/O;T.useProgram(r.p),T.uniformMatrix3fv(r.u.uRot,!1,N),T.uniform1f(r.u.uAspect,s),T.bindVertexArray(a),T.uniform4f(r.u.uColor,.85,.85,.85,.16),T.drawArrays(T.LINES,0,b.ringVerts);let l=Math.sin(W(M.kept,e)*Math.PI),u=Math.sin(W(M.broken,e)*Math.PI),d=(e,t,n)=>e+(t-e)*l+(n-e)*u;T.uniform4f(r.u.uColor,d(.9,.243,1),d(.9,.812,.42),d(.9,.478,.384),.8),T.drawArrays(T.LINES,b.ringVerts,b.sealVerts);let f=W(M.panel,e);f&&(T.bindVertexArray(o),T.uniform4f(r.u.uColor,.94,.71,.16,.7*Math.sin(f*Math.PI)),T.drawArrays(T.LINES,0,18)),T.useProgram(n.p),T.uniformMatrix3fv(n.u.uRot,!1,N),T.uniform1f(n.u.uAspect,s),T.uniform1f(n.u.uTime,t),T.uniform1f(n.u.uDpr,k),T.uniform1f(n.u.uSize,x?2.8:3.2),T.uniform3fv(n.u.uWaveDir,M.kept?.dir??[0,0,1]),T.uniform1f(n.u.uWaveT,W(M.kept,e)),T.uniform3fv(n.u.uEmberDir,M.broken?.dir??[0,0,1]),T.uniform1f(n.u.uEmberT,W(M.broken,e)),T.bindVertexArray(i),T.drawArrays(T.POINTS,0,S)}function K(e){if(I=0,L){if(H<3&&(B||=e,V++,e-B>2e3)){if((e-B)/V>(H<2?22:26)&&(H+=1,H===1&&(S=Math.floor(S/2),C=1,A()),H===3)){U=!0,L=!1,G(e);return}B=e,V=0}(H<2||e-F>=48)&&(F=e,G(e)),I=requestAnimationFrame(K)}}function q(){let e=R&&!document.hidden&&!z&&!_&&!U;e&&!L?(L=!0,B=0,V=0,I=requestAnimationFrame(K)):!e&&L&&(L=!1,cancelAnimationFrame(I),I=0)}let J=new IntersectionObserver(([e])=>{R=e.isIntersecting,q()});J.observe(h);let Y=new ResizeObserver(A);Y.observe(h),document.addEventListener(`visibilitychange`,q);let X=e=>{let t=h.getBoundingClientRect();j.tx=((e.clientX-t.left)/t.width-.5)*2,j.ty=((e.clientY-t.top)/t.height-.5)*2},Z=()=>(j.tx=0,j.ty=0);if(v&&!_){let e=h.closest(`[data-swarm-zone]`)||h;e.addEventListener(`pointermove`,X,{passive:!0}),e.addEventListener(`pointerleave`,Z)}y.addEventListener(`webglcontextlost`,e=>{e.preventDefault(),z=!0,q(),y.remove(),g(h,document.createElement(`canvas`),w)}),A(),G(performance.now()),requestAnimationFrame(()=>y.classList.add(`on`));function Q(){let t=Math.random()*e,n=.65,r=d([Math.cos(t)*n,Math.sin(t)*n*.7,1]);return d(u(N,r))}return{get count(){return S},pulse(e){if(z||!t[e])return;let n=performance.now(),r={kind:e,start:n,dir:Q()};if(M[e]=r,e===`panel`){let e=new Float32Array(54);for(let t=0;t<9;t++){let n=0;for(let e=0;e<12;e++){let e=Math.floor(Math.random()*S);if(l(N,[w.pos[e*3],w.pos[e*3+1],w.pos[e*3+2]])[2]>.1){n=e;break}n=e}e.set([0,0,0,w.pos[n*3],w.pos[n*3+1],w.pos[n*3+2]],t*6)}T.bindBuffer(T.ARRAY_BUFFER,f),T.bufferSubData(T.ARRAY_BUFFER,0,e)}L||G(n)},destroy(){L=!1,cancelAnimationFrame(I),J.disconnect(),Y.disconnect(),document.removeEventListener(`visibilitychange`,q),T.getExtension(`WEBGL_lose_context`)?.loseContext(),y.remove()}}}}function g(t,n,r){n.className=`swarm-canvas on`,n.isConnected||t.append(n);let i=Math.min(devicePixelRatio||1,2),a=n.width=Math.max(1,t.clientWidth*i),o=n.height=Math.max(1,t.clientHeight*i),s=n.getContext(`2d`);if(!s)return{count:0,pulse(){},destroy(){}};let u=c(.6,.32,-.08),d=r.pos.length/3,f=2.45,p=[];for(let e=0;e<d;e++){let[t,n,i]=l(u,[r.pos[e*3],r.pos[e*3+1],r.pos[e*3+2]]),s=3.3-i;p.push([a/2+t*f/s*(o/2),o/2-n*f/s*(o/2),(i+1.2)/2.4])}p.sort((e,t)=>e[2]-t[2]);for(let[t,n,r]of p)s.fillStyle=`rgba(225,225,225,${.16+r*.75})`,s.beginPath(),s.arc(t,n,(.5+r)*1.3*i,0,e),s.fill();return{count:d,pulse(){},destroy(){n.remove()}}}export{h as mountSwarm};