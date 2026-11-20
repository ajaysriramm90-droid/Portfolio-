/* =========================================================
   WebGL stage — a scroll-directed 3D scene.
   One persistent scene; the camera, core, rings and particles
   blend between per-section keyframes as the page scrolls.
   ========================================================= */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SIMPLEX = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

// Per-section scene keyframes.
// c* camera, l* look-at, p* core position, s core scale, amp surface turbulence,
// ring ring spread, spread particle field, grid floor opacity, hue 0=volt 1=violet.
// Morph cloud: shape = target index (ordered like the page), m* = cloud position / scale / tilt / opacity.
const KF = {
  hero:         { cx: 0,    cy: 0,    cz: 6.4, lx: 0,   ly: 0,    px: 0.9,  py: 0.2,  pz: -0.6, s: 1.0,  amp: 0.17, ring: 1.0,  spread: 1.0,  grid: 0.25, hue: 0.0,  glow: 0.9, dim: 1.0,  shape: 0, mx: 0.9,  my: 0.2,  mz: -0.6, ms: 1.0,  mt: 1.15, mo: 0.8,  wave: 0 },
  about:        { cx: -0.6, cy: 0.3,  cz: 6.0, lx: 0.2, ly: 0,    px: -2.7, py: -1.3, pz: -1.6, s: 0.58, amp: 0.13, ring: 0.8,  spread: 1.15, grid: 0.1,  hue: 0.25, glow: 0.7, dim: 0.72, shape: 1, mx: -3.5, my: 0.5,  mz: -2.4, ms: 0.85, mt: 0.18, mo: 0.5,  wave: 0 },
  process1:     { cx: 0,    cy: 0,    cz: 6.5, lx: 0.3, ly: 0,    px: 2.25, py: 0,    pz: 0,    s: 0.24, amp: 0.2,  ring: 0.4, spread: 1.3,  grid: 0.15, hue: 0.12, glow: 0.9, dim: 0.95, shape: 2, mx: 2.25, my: 0,    mz: 0,    ms: 0.9,  mt: 0.45, mo: 1.0,  wave: 0 },
  process2:     { cx: 0,    cy: 0,    cz: 6.5, lx: 0.3, ly: 0,    px: 2.25, py: 0,    pz: 0,    s: 0.24, amp: 0.3,  ring: 0.4,  spread: 1.3,  grid: 0.15, hue: 0.5,  glow: 0.9, dim: 0.95, shape: 3, mx: 2.25, my: 0,    mz: 0,    ms: 0.9,  mt: 0.3,  mo: 1.0,  wave: 0 },
  process3:     { cx: 0,    cy: 0,    cz: 6.5, lx: 0.3, ly: 0,    px: 2.25, py: 0,    pz: 0,    s: 0.28, amp: 0.22, ring: 0.45,  spread: 1.3,  grid: 0.15, hue: 0.82, glow: 1.0, dim: 0.95, shape: 4, mx: 2.25, my: 0,    mz: 0,    ms: 0.95, mt: 0.4,  mo: 1.0,  wave: 0 },
  skills:       { cx: 0,    cy: 0.2,  cz: 8.6, lx: 0,   ly: 0,    px: -2.4, py: 0.2,  pz: -1.2, s: 0.62, amp: 0.28, ring: 1.85, spread: 1.6,  grid: 0.0,  hue: 0.55, glow: 1.0, dim: 0.9,  shape: 5, mx: -2.4, my: 0.2,  mz: -1.2, ms: 1.1,  mt: 0.5,  mo: 0.75, wave: 0 },
  work:         { cx: 0.6,  cy: -0.3, cz: 7.2, lx: 0,   ly: 0,    px: 2.9,  py: 1.4,  pz: -3.2, s: 0.7,  amp: 0.12, ring: 0.6,  spread: 0.9,  grid: 0.12, hue: 0.85, glow: 0.7, dim: 0.85, shape: 6, mx: 0,    my: -1.5, mz: -4.2, ms: 2.3,  mt: 0.38, mo: 0.95,  wave: 1 },
  journey:      { cx: 0,    cy: -1.4, cz: 6.6, lx: 0,   ly: -0.9, px: 0,    py: 0.6,  pz: -4.5, s: 0.5,  amp: 0.18, ring: 1.3,  spread: 1.2,  grid: 0.9,  hue: 0.4,  glow: 0.8, dim: 0.75, shape: 7, mx: 0,    my: -0.6, mz: -2.6, ms: 1.15, mt: 0.12, mo: 0.75,  wave: 0 },
  achievements: { cx: 0.4,  cy: 0.1,  cz: 6.2, lx: 0,   ly: 0,    px: 3.7,  py: 0.9,  pz: -2.0, s: 0.72, amp: 0.24, ring: 0.95, spread: 1.35, grid: 0.2,  hue: 0.7,  glow: 0.9, dim: 0.75, shape: 8, mx: 3.7,  my: 0.9,  mz: -2.0, ms: 1.0,  mt: 0.3,  mo: 0.8,  wave: 0 },
  contact:      { cx: 0,    cy: 0,    cz: 5.6, lx: 0,   ly: 0,    px: 2.7,  py: 0.15, pz: -1.0, s: 0.95, amp: 0.3,  ring: 1.3,  spread: 0.85, grid: 0.4,  hue: 0.0,  glow: 1.1, dim: 0.95, shape: 9, mx: 2.7,  my: 0.15, mz: -1.0, ms: 0.78, mt: 1.2,  mo: 0.95, wave: 0 },
};
const KEYS = Object.keys(KF.hero);

const VOLT = new THREE.Color(0xc8ff3e);
const VIOLET = new THREE.Color(0x8f7dff);
const BG = 0x060608;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

export async function createScene(canvas, { tier = 'high' } = {}) {
  const mobile = tier === 'mobile';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: !mobile, alpha: false, powerPreference: 'high-performance', stencil: false,
  });
  let dprCap = mobile ? 1.5 : 1.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setClearColor(BG, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(BG, 0.05);
  const camera = new THREE.PerspectiveCamera(mobile ? 52 : 38, innerWidth / innerHeight, 0.1, 120);
  camera.position.set(0, 0, 8);

  // Studio environment map gives the chrome its reflections without any texture downloads.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();

  // ---------- Lighting (cinematic key + coloured kickers) ----------
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 4, 5);
  scene.add(key);
  const kickA = new THREE.PointLight(0xc8ff3e, 26, 14, 2);
  const kickB = new THREE.PointLight(0x8f7dff, 30, 14, 2);
  scene.add(kickA, kickB);

  // ---------- Core: displaced iridescent chrome ----------
  const world = new THREE.Group();
  scene.add(world);
  const coreGroup = new THREE.Group();
  world.add(coreGroup);

  const coreUniforms = { uTime: { value: 0 }, uAmp: { value: 0.22 }, uFreq: { value: 1.05 } };
  const coreGeo = new THREE.IcosahedronGeometry(1.25, mobile ? 16 : 32);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0x9c9cab, metalness: 1, roughness: 0.16,
    clearcoat: 1, clearcoatRoughness: 0.1,
    iridescence: 1, iridescenceIOR: 1.4, iridescenceThicknessRange: [160, 640],
    envMapIntensity: 1.05,
  });
  coreMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, coreUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uAmp; uniform float uFreq;
        ${SIMPLEX}
        vec3 displaceP(vec3 p){
          vec3 n = normalize(p);
          float d = snoise(n * uFreq + vec3(uTime * 0.16, uTime * 0.11, -uTime * 0.09));
          d += 0.22 * snoise(n * uFreq * 2.1 - vec3(uTime * 0.21));
          return p + n * d * uAmp;
        }`)
      .replace('#include <beginnormal_vertex>', `
        vec3 dispPos = displaceP(position);
        vec3 nrm0 = normalize(position);
        vec3 tng = normalize(abs(nrm0.y) > 0.95 ? cross(nrm0, vec3(1.0, 0.0, 0.0)) : cross(nrm0, vec3(0.0, 1.0, 0.0)));
        vec3 btg = normalize(cross(nrm0, tng));
        vec3 pa = displaceP(position + tng * 0.012);
        vec3 pb = displaceP(position + btg * 0.012);
        vec3 objectNormal = normalize(cross(pa - dispPos, pb - dispPos));
        if (dot(objectNormal, nrm0) < 0.0) objectNormal = -objectNormal;
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = dispPos;
        #ifdef USE_ALPHAHASH
          vPosition = vec3(position);
        #endif`);
  };
  const core = new THREE.Mesh(coreGeo, coreMat);
  coreGroup.add(core);

  // Atmospheric rim glow (back-face fresnel shell)
  const rimMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: VOLT.clone() }, uIntensity: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uIntensity; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 4.0); gl_FragColor = vec4(uColor * f * uIntensity * 0.55, f * 0.6); }`,
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const rim = new THREE.Mesh(new THREE.SphereGeometry(1.5, 48, 32), rimMat);
  coreGroup.add(rim);

  // ---------- Orbital rings ----------
  const rings = new THREE.Group();
  coreGroup.add(rings);
  const glowRingMat = new THREE.MeshBasicMaterial({ color: VOLT.clone().multiplyScalar(2.2), toneMapped: false, transparent: true, opacity: 0.9 });
  const chromeRingMat = new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 1, roughness: 0.22, envMapIntensity: 1.2 });
  const ringDefs = [
    { r: 1.95, tube: 0.0065, mat: glowRingMat, rot: [1.25, 0.15, 0], speed: 0.22 },
    { r: 2.4, tube: 0.016, mat: chromeRingMat, rot: [1.5, -0.35, 0.45], speed: -0.14 },
    { r: 2.95, tube: 0.0045, mat: glowRingMat, rot: [0.95, 0.55, -0.3], speed: 0.1 },
  ];
  const ringItems = ringDefs.map((d) => {
    const pivot = new THREE.Group();
    pivot.rotation.set(...d.rot);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(d.r, d.tube, 8, mobile ? 120 : 220), d.mat);
    const sat = new THREE.Mesh(new THREE.SphereGeometry(d.tube * 7 + 0.03, 20, 16), d.mat === glowRingMat ? glowRingMat : chromeRingMat);
    sat.position.x = d.r;
    ring.add(sat);
    pivot.add(ring);
    rings.add(pivot);
    return { pivot, ring, d };
  });

  // ---------- Floating debris (instanced metallic shards) ----------
  const debrisCount = mobile ? 12 : 28;
  const debris = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.11, 0),
    new THREE.MeshStandardMaterial({ color: 0xcfcfd8, metalness: 1, roughness: 0.28, envMapIntensity: 1.4, flatShading: true }),
    debrisCount,
  );
  const dummy = new THREE.Object3D();
  const debrisData = Array.from({ length: debrisCount }, () => {
    const radius = 3.2 + Math.random() * 6;
    const theta = Math.random() * Math.PI * 2;
    return {
      base: new THREE.Vector3(Math.cos(theta) * radius, (Math.random() - 0.5) * 6, Math.min(Math.sin(theta) * radius * 0.4 - 2.6, 0.6)),
      spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(1.2),
      phase: Math.random() * Math.PI * 2,
      scale: 0.6 + Math.random() * 1.6,
    };
  });
  world.add(debris);

  // ---------- Particle field ----------
  const pCount = mobile ? 1300 : 4200;
  const pPos = new Float32Array(pCount * 3);
  const pSeed = new Float32Array(pCount);
  for (let i = 0; i < pCount; i++) {
    const r = 3.5 + Math.pow(Math.random(), 0.7) * 16;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
    pPos[i * 3 + 2] = r * Math.cos(ph) - 3;
    pSeed[i] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(pSeed, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uSpread: { value: 1 }, uPR: { value: renderer.getPixelRatio() },
      uSize: { value: mobile ? 2.6 : 2.2 }, uAccent: { value: VOLT.clone() }, uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uSpread; uniform float uPR; uniform float uSize;
      attribute float aSeed; varying float vA; varying float vMix;
      void main(){
        vec3 p = position * uSpread;
        p.x += cos(uTime * 0.12 + aSeed * 31.0) * 0.4;
        p.y += sin(uTime * 0.18 + aSeed * 17.0) * 0.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float depth = -mv.z;
        gl_PointSize = uSize * uPR * (0.6 + aSeed * 1.2) * (8.0 / depth);
        vA = (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.3 + aSeed * 60.0))) * smoothstep(30.0, 5.0, depth) * smoothstep(0.5, 2.5, depth);
        vMix = step(0.86, aSeed);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uAccent; uniform float uOpacity; varying float vA; varying float vMix;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 col = mix(vec3(0.92, 0.91, 0.88), uAccent * 1.6, vMix);
        gl_FragColor = vec4(col, a * a * vA * uOpacity);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // ---------- Wireframe cage (counter-rotating geodesic shell) ----------
  const cageMat = new THREE.LineBasicMaterial({ color: VOLT.clone(), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const cage = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.72, 1)), cageMat);
  coreGroup.add(cage);

  // ---------- Shockwave pulse (section changes, taps) ----------
  const shockMat = new THREE.MeshBasicMaterial({ color: VOLT.clone().multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), shockMat);
  shock.visible = false;
  scene.add(shock);
  const pulse = { t: 1 };

  // ---------- Shooting stars ----------
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0xffffff) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uColor; varying vec2 vUv; void main(){ float a = pow(vUv.x, 3.0) * (1.0 - abs(vUv.y - 0.5) * 2.0); gl_FragColor = vec4(uColor * 2.0, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const starGeo = new THREE.PlaneGeometry(2.2, 0.025);
  const stars = Array.from({ length: mobile ? 2 : 5 }, () => {
    const m = new THREE.Mesh(starGeo, starMat);
    const st = { m, v: new THREE.Vector3(), wait: Math.random() * 6 };
    m.visible = false;
    scene.add(m);
    return st;
  });
  function spawnStar(st) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    st.m.position.set(-dir * (9 + Math.random() * 4), 2 + Math.random() * 5, -6 - Math.random() * 8);
    st.v.set(dir * (10 + Math.random() * 8), -(3 + Math.random() * 3), 0);
    st.m.rotation.z = Math.atan2(st.v.y, st.v.x);
    st.m.visible = true;
  }

  // ---------- Morphing particle sculpture ----------
  // Every section owns a target shape; all targets live in one float texture and the
  // vertex shader blends between neighbours as the scroll position moves through the page.
  const R = Math.random;
  const gauss = () => (R() + R() + R() - 1.5) / 1.5;
  const TAU = Math.PI * 2;
  const SHAPES = [
    // 0 hero — three-armed spiral galaxy
    (i) => { const arm = i % 3; const t = R(); const r = 0.55 + Math.pow(t, 0.85) * 3.9; const a = arm * 2.094 + r * 1.05 + gauss() * 0.3; return [Math.cos(a) * r, gauss() * 0.14 * (1.3 - t), Math.sin(a) * r]; },
    // 1 about — DNA double helix
    (i) => {
      const y = (R() - 0.5) * 6.4; const tw = y * 1.45;
      if (R() < 0.72) { const o = i % 2 ? Math.PI : 0; return [Math.cos(tw + o) * 0.95 + gauss() * 0.05, y, Math.sin(tw + o) * 0.95 + gauss() * 0.05]; }
      const yy = Math.round(y / 0.32) * 0.32; const k = R() * 2 - 1; return [Math.cos(yy * 1.45) * 0.95 * k, yy + gauss() * 0.02, Math.sin(yy * 1.45) * 0.95 * k];
    },
    // 2 process / architect — wireframe lattice cube
    (i) => { const g = [-1.3, 0, 1.3]; const ax = i % 3; const a = g[(R() * 3) | 0], b = g[(R() * 3) | 0]; const t = (R() * 2 - 1) * 1.3; const j = () => gauss() * 0.02; return ax === 0 ? [t, a + j(), b + j()] : ax === 1 ? [a + j(), t, b + j()] : [a + j(), b + j(), t]; },
    // 3 process / engineer — torus knot
    (i) => { const t = R() * TAU; const Rr = 1.3, r = 0.55; const c = Rr + r * Math.cos(3 * t); const k = 0.17 * Math.sqrt(R()); const u = R() * TAU; return [c * Math.cos(2 * t) + Math.cos(u) * k, c * Math.sin(2 * t) + Math.sin(u) * k, r * Math.sin(3 * t) + Math.cos(u + 1.3) * k]; },
    // 4 process / ship — wire globe
    (i) => {
      const Rr = 1.9; const q = R();
      if (q < 0.35) { const lat = (Math.round(R() * 8) / 8 - 0.5) * Math.PI * 0.92; const lon = R() * TAU; return [Math.cos(lat) * Math.cos(lon) * Rr, Math.sin(lat) * Rr, Math.cos(lat) * Math.sin(lon) * Rr]; }
      if (q < 0.65) { const lon = (Math.round(R() * 12) / 12) * TAU; const lat = (R() - 0.5) * Math.PI; return [Math.cos(lat) * Math.cos(lon) * Rr, Math.sin(lat) * Rr, Math.cos(lat) * Math.sin(lon) * Rr]; }
      const u = R() * 2 - 1, th = R() * TAU, sq = Math.sqrt(1 - u * u), rr = Rr * (0.97 + R() * 0.06); return [sq * Math.cos(th) * rr, u * rr, sq * Math.sin(th) * rr];
    },
    // 5 skills — atomic orbital shells
    (i) => {
      const k = i % 4; const tilts = [[0.2, 0], [1.15, 0], [1.15, 2.1], [1.15, 4.2]];
      const r = 1.9 + k * 0.1 + gauss() * 0.05; const a = R() * TAU;
      const x = Math.cos(a) * r, y = gauss() * 0.03, z = Math.sin(a) * r; const [tx, ry] = tilts[k];
      const y2 = y * Math.cos(tx) - z * Math.sin(tx), z2 = y * Math.sin(tx) + z * Math.cos(tx);
      return [x * Math.cos(ry) + z2 * Math.sin(ry), y2, -x * Math.sin(ry) + z2 * Math.cos(ry)];
    },
    // 6 work — wireframe terrain disc (waves animate in the shader)
    (i) => { const r = Math.sqrt(R()) * 3.6; const a = R() * TAU; let x = Math.cos(a) * r, z = Math.sin(a) * r; if (i % 2) x = Math.round(x / 0.3) * 0.3; else z = Math.round(z / 0.3) * 0.3; return [x, Math.sin(x * 0.9) * 0.22 + Math.cos(z * 1.2) * 0.18, z]; },
    // 7 journey — rising vortex
    (i) => { const t = R(); const y = (t - 0.5) * 6.4; const r = 0.22 + Math.pow(t, 1.8) * 2.3 + gauss() * 0.05; const a = (i % 5) * 1.2566 + y * 1.8 + gauss() * 0.22; return [Math.cos(a) * r, y, Math.sin(a) * r]; },
    // 8 achievements — starburst
    (i) => { const n = 34; const k = i % n; const yv = 1 - (k / (n - 1)) * 2; const rr = Math.sqrt(1 - yv * yv); const ph = k * 2.39996; const len = 0.35 + Math.pow(R(), 1.5) * 2.5; return [Math.cos(ph) * rr * len + gauss() * 0.02, yv * len + gauss() * 0.02, Math.sin(ph) * rr * len + gauss() * 0.02]; },
    // 9 contact — accretion halo
    (i) => { const r = 1.85 + Math.pow(R(), 1.5) * 1.7 + gauss() * 0.05; const a = R() * TAU; return [Math.cos(a) * r, gauss() * 0.05 * (r - 1.4), Math.sin(a) * r]; },
  ];
  const MW = 128;
  const mCount = mobile ? 2560 : 6144;
  const mRows = Math.ceil(mCount / MW);
  const mData = new Float32Array(MW * mRows * SHAPES.length * 4);
  SHAPES.forEach((fn, si) => {
    for (let i = 0; i < mCount; i++) {
      const [x, y, z] = fn(i);
      const o = ((si * mRows + Math.floor(i / MW)) * MW + (i % MW)) * 4;
      mData[o] = x; mData[o + 1] = y; mData[o + 2] = z; mData[o + 3] = 1;
    }
  });
  const mTex = new THREE.DataTexture(mData, MW, mRows * SHAPES.length, THREE.RGBAFormat, THREE.FloatType);
  mTex.needsUpdate = true;

  const mGeo = new THREE.BufferGeometry();
  const mIdx = new Float32Array(mCount), mSeed = new Float32Array(mCount), mRand = new Float32Array(mCount * 3);
  for (let i = 0; i < mCount; i++) {
    mIdx[i] = i; mSeed[i] = R();
    const u = R() * 2 - 1, th = R() * TAU, sq = Math.sqrt(1 - u * u), l = 0.6 + R() * 1.4;
    mRand[i * 3] = sq * Math.cos(th) * l; mRand[i * 3 + 1] = u * l; mRand[i * 3 + 2] = sq * Math.sin(th) * l;
  }
  mGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(mCount * 3), 3));
  mGeo.setAttribute('aIndex', new THREE.BufferAttribute(mIdx, 1));
  mGeo.setAttribute('aSeed', new THREE.BufferAttribute(mSeed, 1));
  mGeo.setAttribute('aRand', new THREE.BufferAttribute(mRand, 3));
  const mMat = new THREE.ShaderMaterial({
    uniforms: {
      uTargets: { value: mTex }, uRows: { value: mRows }, uCount: { value: SHAPES.length }, uShape: { value: 0 },
      uTime: { value: 0 }, uSpin: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uSize: { value: mobile ? 2.8 : 2.6 },
      uWave: { value: 0 }, uScatter: { value: 0.9 }, uKick: { value: 0 }, uOpacity: { value: 0 },
      uColA: { value: VOLT.clone() }, uColB: { value: VIOLET.clone() },
    },
    vertexShader: /* glsl */ `
      uniform sampler2D uTargets; uniform float uRows; uniform float uCount; uniform float uShape;
      uniform float uTime; uniform float uSpin; uniform float uPR; uniform float uSize;
      uniform float uWave; uniform float uScatter; uniform float uKick;
      attribute float aIndex; attribute float aSeed; attribute vec3 aRand;
      varying float vA; varying float vSeed;
      vec3 shapePos(float s){
        int i = int(aIndex); int rows = int(uRows);
        return texelFetch(uTargets, ivec2(i - (i / 128) * 128, int(s) * rows + i / 128), 0).xyz;
      }
      void main(){
        float f = floor(uShape);
        float fn = min(f + 1.0, uCount - 1.0);
        float t = clamp((uShape - f) * 1.6 - aSeed * 0.6, 0.0, 1.0);
        t = t * t * (3.0 - 2.0 * t);
        vec3 p = mix(shapePos(f), shapePos(fn), t);
        p += aRand * (sin(t * 3.14159) * uScatter + uKick);
        p.y += sin(p.x * 1.3 + uTime * 1.1) * cos(p.z * 1.1 + uTime * 0.8) * 0.3 * uWave;
        p += aRand * 0.025 * sin(uTime * 1.8 + aSeed * 40.0);
        float c = cos(uSpin), s = sin(uSpin);
        p = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPR * (0.45 + aSeed * 1.1) * (6.5 / -mv.z);
        vA = smoothstep(0.3, 2.0, -mv.z) * (0.55 + 0.45 * sin(uTime * 1.6 + aSeed * 50.0));
        vSeed = aSeed;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColA; uniform vec3 uColB; uniform float uOpacity; varying float vA; varying float vSeed;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d);
        vec3 col = mix(uColA, uColB, smoothstep(0.45, 1.0, vSeed));
        col = mix(col, vec3(1.0), step(0.94, vSeed) * 0.75);
        gl_FragColor = vec4(col * 1.5, a * vA * uOpacity);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const morph = new THREE.Points(mGeo, mMat);
  morph.frustumCulled = false;
  const morphGroup = new THREE.Group();
  morphGroup.add(morph);
  world.add(morphGroup);
  let mSpin = 0;

  // ---------- Architectural grid floor ----------
  const gridMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uColor: { value: VOLT.clone() }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; uniform vec3 uColor; uniform float uTime; varying vec3 vW;
      void main(){
        vec2 uv = vW.xz * 0.6 + vec2(0.0, uTime * 0.15);
        vec2 g = abs(fract(uv - 0.5) - 0.5) / fwidth(uv);
        float line = 1.0 - min(min(g.x, g.y), 1.0);
        float fade = smoothstep(16.0, 1.0, length(vW.xz - cameraPosition.xz));
        vec3 col = mix(vec3(0.6), uColor, 0.6);
        gl_FragColor = vec4(col, line * fade * uOpacity * 0.32);
      }`,
    transparent: true, depthWrite: false,
  });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(70, 70, 1, 1), gridMat);
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = -2.7;
  scene.add(grid);

  // ---------- Post-processing (desktop tier only, lazy-loaded) ----------
  let composer = null;
  let bloom = null;
  let rgbShift = null;
  if (!mobile) {
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { ShaderPass }] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
        import('three/addons/postprocessing/ShaderPass.js'),
      ]);
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.42, 0.7, 0.86);
      composer.addPass(bloom);
      // Lens-style RGB split that intensifies with scroll speed.
      rgbShift = new ShaderPass({
        uniforms: { tDiffuse: { value: null }, uAmount: { value: 0.0015 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform sampler2D tDiffuse; uniform float uAmount; varying vec2 vUv;
          void main(){
            vec2 d = vUv - 0.5; vec2 off = d * uAmount * (0.4 + dot(d, d) * 3.0);
            vec4 c = texture2D(tDiffuse, vUv);
            c.r = texture2D(tDiffuse, vUv + off).r;
            c.b = texture2D(tDiffuse, vUv - off).b;
            gl_FragColor = c;
          }`,
      });
      composer.addPass(rgbShift);
      composer.addPass(new OutputPass());
    } catch (e) {
      composer = null;
    }
  }

  // ---------- State ----------
  const cur = { ...KF.hero };
  const tgt = { ...KF.hero };
  let anchors = [];
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let velocity = 0;
  let sVel = 0;
  const intro = { v: 0 };
  let time = 0;
  let spinAccum = 0;
  let w = innerWidth, h = innerHeight;
  let baseFov = 38;

  function refresh() {
    const sy = window.scrollY;
    anchors = Array.from(document.querySelectorAll('[data-scene]'))
      .map((el) => ({ key: el.dataset.scene, top: el.getBoundingClientRect().top + sy }))
      .filter((a) => KF[a.key])
      .sort((a, b) => a.top - b.top);
  }

  let sectionIdx = -1;
  function firePulse() { if (!reduce) pulse.t = 0; }
  function computeTarget(y) {
    for (const k of KEYS) tgt[k] = KF.hero[k];
    let idx = 0;
    const vh = h;
    for (let i = 1; i < anchors.length; i++) {
      const a = anchors[i];
      const t = clamp((y - (a.top - vh)) / (vh * 0.9), 0, 1);
      if (t <= 0) break;
      const e = t * t * (3 - 2 * t);
      const kf = KF[a.key];
      for (const k of KEYS) tgt[k] += (kf[k] - tgt[k]) * e;
      if (t > 0.55) idx = i;
    }
    if (idx !== sectionIdx) { if (sectionIdx !== -1) firePulse(); sectionIdx = idx; }
    if (mobile) {
      // Mobile: keep the hero object centred behind content and quieter.
      tgt.px *= 0.18;
      tgt.py = tgt.py * 0.5 + 0.9;
      tgt.pz -= 1.4;
      tgt.cx *= 0.4;
      tgt.dim *= 0.8;
      tgt.mx *= 0.15;
      tgt.my = tgt.my * 0.5 + 1.0;
      tgt.mz -= 1.2;
      tgt.mo *= 0.6;
    }
  }

  function resize() {
    w = innerWidth; h = innerHeight;
    camera.aspect = w / h;
    baseFov = w / h < 0.8 ? 58 : mobile ? 50 : 38;
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(Math.min(renderer.getPixelRatio(), 1.25)); composer.setSize(w, h); }
    pMat.uniforms.uPR.value = renderer.getPixelRatio();
    mMat.uniforms.uPR.value = renderer.getPixelRatio();
    refresh();
  }

  const tmpColor = new THREE.Color();
  const look = new THREE.Vector3();
  let frames = 0, perfAcc = 0, qLevel = 0;

  function frame(dt) {
    time += reduce ? 0 : dt;

    computeTarget(window.scrollY);
    const lambda = reduce ? 30 : 3.2;
    for (const k of KEYS) cur[k] = damp(cur[k], tgt[k], lambda, dt);

    pointer.sx = damp(pointer.sx, pointer.x, 3, dt);
    pointer.sy = damp(pointer.sy, pointer.y, 3, dt);
    sVel = damp(sVel, velocity, 4, dt);
    const vAbs = Math.min(Math.abs(sVel), 60);

    // Camera
    camera.position.set(cur.cx + pointer.sx * 0.38, cur.cy - pointer.sy * 0.26, cur.cz);
    look.set(cur.lx + pointer.sx * 0.12, cur.ly - pointer.sy * 0.08, 0);
    camera.lookAt(look);
    // Cinematic speed feel: FOV opens and the camera banks slightly with scroll velocity.
    camera.fov = baseFov + Math.min(vAbs * 0.14, 7);
    camera.updateProjectionMatrix();
    camera.rotation.z += clamp(sVel * 0.0012, -0.05, 0.05);

    // Core
    const introEase = intro.v;
    coreGroup.position.set(cur.px, cur.py + Math.sin(time * 0.6) * 0.06, cur.pz);
    const s = cur.s * (0.35 + 0.65 * introEase);
    coreGroup.scale.setScalar(s);
    spinAccum += dt * (0.12 + vAbs * 0.004);
    core.rotation.y = spinAccum + window.scrollY * 0.0006 + (1 - introEase) * -2.4;
    core.rotation.x = Math.sin(time * 0.2) * 0.25 + pointer.sy * 0.25;
    core.rotation.z = pointer.sx * -0.15;
    coreUniforms.uTime.value = time;
    coreUniforms.uAmp.value = cur.amp + vAbs * 0.0045 + (1 - introEase) * 0.5;

    renderer.toneMappingExposure = 1.0 * cur.dim * (0.6 + 0.4 * introEase);
    if (bloom) bloom.strength = 0.42 * cur.dim;

    // Colour grade between volt and violet
    tmpColor.copy(VOLT).lerp(VIOLET, cur.hue);
    rimMat.uniforms.uColor.value.copy(tmpColor);
    rimMat.uniforms.uIntensity.value = cur.glow * cur.dim * introEase;
    glowRingMat.color.copy(tmpColor).multiplyScalar(2.2);
    pMat.uniforms.uAccent.value.copy(tmpColor);
    gridMat.uniforms.uColor.value.copy(tmpColor);
    kickA.color.copy(tmpColor);

    // Rings: spread + spin, react to scroll velocity
    ringItems.forEach((it, i) => {
      const spread = 1 + (cur.ring - 1) * (0.6 + i * 0.35);
      it.ring.scale.setScalar(spread * (0.6 + 0.4 * introEase));
      it.ring.rotation.z += dt * it.d.speed * (1 + vAbs * 0.06);
      it.pivot.rotation.x = it.d.rot[0] + Math.sin(time * 0.3 + i) * 0.08 + window.scrollY * 0.00012 * (i + 1);
    });

    // Lights orbit the core for moving highlights
    kickA.position.set(cur.px + Math.cos(time * 0.5) * 3.2, cur.py + 1.6, cur.pz + Math.sin(time * 0.5) * 3.2);
    kickB.position.set(cur.px + Math.cos(time * 0.37 + 2.4) * 3.4, cur.py - 1.4, cur.pz + Math.sin(time * 0.37 + 2.4) * 3.4);

    // Debris
    for (let i = 0; i < debrisCount; i++) {
      const d = debrisData[i];
      dummy.position.copy(d.base);
      dummy.position.y += Math.sin(time * 0.5 + d.phase) * 0.35 - window.scrollY * 0.0004 * (1 + (i % 3));
      dummy.position.y = ((dummy.position.y + 6) % 12 + 12) % 12 - 6;
      dummy.rotation.set(time * d.spin.x + d.phase, time * d.spin.y, time * d.spin.z);
      dummy.scale.setScalar(d.scale * introEase);
      dummy.updateMatrix();
      debris.setMatrixAt(i, dummy.matrix);
    }
    debris.instanceMatrix.needsUpdate = true;

    // Pulse
    let pk = 0;
    if (pulse.t < 1) {
      pulse.t = Math.min(1, pulse.t + dt / 1.3);
      const e = 1 - Math.pow(1 - pulse.t, 3);
      pk = Math.pow(1 - pulse.t, 2);
      shock.visible = true;
      shock.position.copy(coreGroup.position);
      shock.quaternion.copy(camera.quaternion);
      shock.scale.setScalar(cur.s * (1.3 + e * 3.6));
      shockMat.opacity = pk * 0.6;
      shockMat.color.copy(tmpColor).multiplyScalar(2);
    } else shock.visible = false;
    coreUniforms.uAmp.value += pk * 0.35;

    // Cage
    cage.rotation.y = -spinAccum * 0.6;
    cage.rotation.x = time * 0.07;
    cage.scale.setScalar((1 + (cur.ring - 1) * 0.35) * (1 + pk * 0.4));
    cageMat.color.copy(tmpColor);
    cageMat.opacity = (0.16 + pk * 0.5) * introEase * cur.dim;

    // Shooting stars
    for (const st of stars) {
      if (!st.m.visible) { st.wait -= dt; if (st.wait <= 0 && introEase > 0.9) spawnStar(st); continue; }
      st.m.position.addScaledVector(st.v, dt);
      if (Math.abs(st.m.position.x) > 16 || st.m.position.y < -8) { st.m.visible = false; st.wait = 2 + Math.random() * 7; }
    }

    // Morph sculpture
    mSpin += dt * (0.12 + vAbs * 0.006);
    morphGroup.position.set(cur.mx, cur.my, cur.mz);
    morphGroup.scale.setScalar(cur.ms * (0.4 + 0.6 * introEase));
    morphGroup.rotation.x = cur.mt + pointer.sy * 0.12;
    morphGroup.rotation.z = pointer.sx * -0.08;
    mMat.uniforms.uShape.value = clamp(cur.shape, 0, SHAPES.length - 1);
    mMat.uniforms.uSpin.value = mSpin;
    mMat.uniforms.uTime.value = time;
    mMat.uniforms.uWave.value = cur.wave;
    mMat.uniforms.uKick.value = Math.min(vAbs * 0.006, 0.35) + pk * 0.6;
    mMat.uniforms.uOpacity.value = cur.mo * cur.dim * introEase;
    mMat.uniforms.uColA.value.copy(tmpColor);
    mMat.uniforms.uColB.value.copy(VIOLET).lerp(VOLT, cur.hue);
    if (rgbShift) rgbShift.uniforms.uAmount.value = 0.0015 + Math.min(vAbs * 0.0005, 0.02);

    // Particles & grid
    pMat.uniforms.uTime.value = time;
    pMat.uniforms.uSpread.value = cur.spread + vAbs * 0.002;
    pMat.uniforms.uOpacity.value = introEase;
    particles.rotation.y = time * 0.015 + window.scrollY * 0.00008;
    gridMat.uniforms.uOpacity.value = cur.grid * introEase;
    gridMat.uniforms.uTime.value = time;

    if (composer) composer.render(dt); else renderer.render(scene, camera);

    // Adaptive quality: keep sampling; shed cost in steps while frames run slow.
    if (introEase > 0.9 && qLevel < 3) {
      frames++; perfAcc += dt;
      if (frames >= 120) {
        const avg = perfAcc / frames;
        frames = 0; perfAcc = 0;
        if (avg > 1 / 48) {
          qLevel++;
          if (qLevel === 1) { rgbShift = null; if (composer && composer.passes[2]) composer.passes[2].enabled = false; dprCap = 1.25; }
          if (qLevel === 2) { composer = null; dprCap = 1; }
          if (qLevel === 3) { pMat.uniforms.uSize.value *= 0.8; debris.visible = false; }
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
          resize();
        }
      }
    }
  }

  const clock = new THREE.Clock();
  let running = false;
  function loop() { frame(Math.min(clock.getDelta(), 1 / 20)); }
  function start() { if (!running) { running = true; clock.getDelta(); renderer.setAnimationLoop(loop); } }
  function stop() { running = false; renderer.setAnimationLoop(null); }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  window.addEventListener('resize', resize, { passive: true });
  resize();

  // Compile shaders up front so the first visible frame doesn't hitch.
  renderer.compile(scene, camera);
  frame(1 / 60);
  start();

  return {
    refresh,
    setPointer(x, y) { pointer.x = x; pointer.y = y; },
    setVelocity(v) { velocity = v; },
    pulse: firePulse,
    playIntro() {
      if (reduce || !window.gsap) { intro.v = 1; return; }
      window.gsap.to(intro, { v: 1, duration: 2.6, ease: 'expo.out' });
      window.gsap.delayedCall(0.5, firePulse);
    },
  };
}
