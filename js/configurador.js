// Configurador 3D de puerta de seguridad Mult Security.
// Lee el estado de window.MSCFG (lo maneja el script de la página) y dibuja la puerta.
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';

const cfg = window.MSCFG;
let lastInput = 0;
let running = false, visible = false, last = performance.now(), idle = 0;
const stage = document.querySelector('.cfg-stage');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Medidas en metros
const W = 0.9, H = 2.05, D = 0.07, JAMB = 0.085, JD = 0.16, GAP = 0.004;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const canvas = renderer.domElement;
canvas.setAttribute('aria-hidden', 'true');
stage.prepend(canvas);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
const target = new THREE.Vector3(0, 1.02, 0);

scene.add(new THREE.HemisphereLight(0xf2f0ff, 0x231f3f, 1.15));
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2.5, 3.5, 3); scene.add(key);
const rim = new THREE.DirectionalLight(0x9fe6aa, 0.9); rim.position.set(-3, 2, -1.5); scene.add(rim);
const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-2, 1.2, 3); scene.add(fill);

// ---------- Texturas dibujadas a mano (canvas) ----------
function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function grain(g, w, h, base, dark, seed) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const r = rnd(seed);
  for (let i = 0; i < 260; i++) {
    const x = r() * w, a = 0.04 + r() * 0.12, amp = 2 + r() * 6, f = 0.004 + r() * 0.01;
    g.strokeStyle = `rgba(${dark},${a})`; g.lineWidth = 0.6 + r() * 1.8; g.beginPath();
    for (let y = 0; y <= h; y += 16) g.lineTo(x + Math.sin(y * f + i) * amp, y);
    g.stroke();
  }
}
const finishes = {
  nogal: tex(512, 1024, (g, w, h) => {
    grain(g, w, h, '#5b3a22', '30,16,8', 7);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(w * 0.82, 0, 6, h); // canal de la manija vertical
  }),
  rustica: tex(512, 1024, (g, w, h) => {
    grain(g, w, h, '#8a5832', '45,24,10', 11);
    for (let i = 1; i < 6; i++) { g.fillStyle = 'rgba(30,15,5,.55)'; g.fillRect((w / 6) * i - 2, 0, 4, h); }
    [0.12, 0.47, 0.82].forEach(p => {
      const y = h * p; g.fillStyle = '#6e4423'; g.fillRect(0, y, w, 70);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y + 66, w, 4);
      g.fillStyle = '#2a1a0e'; for (let x = 24; x < w; x += 48) { g.beginPath(); g.arc(x, y + 12, 4, 0, 7); g.arc(x, y + 58, 4, 0, 7); g.fill(); }
    });
  }),
  blanca: tex(512, 1024, (g, w, h) => {
    g.fillStyle = '#eeeef2'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,40,60,.18)'; g.lineWidth = 3;
    [[0.15, 0.30], [0.35, 0.47], [0.62, 0.70], [0.82, 0.88]].forEach(([a, b]) => {
      g.beginPath(); g.moveTo(0, h * a); g.lineTo(w * 0.55, h * (a + b) / 2); g.lineTo(w, h * b); g.stroke();
    });
  })
};
const edgeColor = { nogal: 0x4a2f1b, rustica: 0x6e4423, blanca: 0xdcdce3 };
const honey = tex(512, 1024, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(111,211,127,.9)'; g.lineWidth = 3;
  const s = 26, dx = s * Math.sqrt(3), dy = s * 1.5;
  for (let row = -1, y = 0; y < h + s * 2; row++, y += dy) {
    for (let x = (row % 2) * dx / 2 - dx; x < w + dx; x += dx) {
      g.beginPath();
      for (let k = 0; k < 7; k++) { const a = Math.PI / 3 * k + Math.PI / 6; g.lineTo(x + s * Math.cos(a), y + s * Math.sin(a)); }
      g.stroke();
    }
  }
});
const concrete = tex(256, 256, (g, w, h) => {
  g.fillStyle = '#3b3564'; g.fillRect(0, 0, w, h); const r = rnd(3);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.06})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
}, [4, 4]);

// ---------- Pared, piso y marco ----------
const steel = new THREE.MeshStandardMaterial({ color: 0x9c99b8, metalness: 0.7, roughness: 0.38, transparent: true });
const wallMat = new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.95 });
function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); scene.add(m); return m; }
const WW = 3.4, WH = 2.9, side = (WW - W - 2 * JAMB - 2 * GAP) / 2;
box(side, WH, 0.24, wallMat, -(W / 2 + JAMB + GAP + side / 2), WH / 2, -0.04);
box(side, WH, 0.24, wallMat, (W / 2 + JAMB + GAP + side / 2), WH / 2, -0.04);
box(W + 2 * JAMB + 2 * GAP, WH - H - JAMB - GAP, 0.24, wallMat, 0, (WH + H + JAMB + GAP) / 2, -0.04);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ color: 0x1b1830, roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.z = 1.5; scene.add(floor);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.9), new THREE.MeshBasicMaterial({
  map: tex(256, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }),
  transparent: true, depthWrite: false
}));
shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.002, 0.25); scene.add(shadow);
const jambs = [
  box(JAMB, H + JAMB + GAP, JD, steel, -(W / 2 + GAP + JAMB / 2), (H + JAMB + GAP) / 2, 0),
  box(JAMB, H + JAMB + GAP, JD, steel, (W / 2 + GAP + JAMB / 2), (H + JAMB + GAP) / 2, 0),
  box(W + 2 * JAMB + 2 * GAP, JAMB, JD, steel, 0, H + GAP + JAMB / 2, 0)
];

// ---------- Hoja de la puerta ----------
const faceMat = new THREE.MeshStandardMaterial({ map: finishes.nogal, roughness: 0.6, transparent: true });
const sideMat = new THREE.MeshStandardMaterial({ color: edgeColor.nogal, roughness: 0.7, transparent: true });
const door = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [sideMat, sideMat, sideMat, sideMat, faceMat, faceMat]);
door.position.set(0, H / 2, 0); scene.add(door);
const honeyMat = new THREE.MeshBasicMaterial({ map: honey, transparent: true, opacity: 0, depthWrite: false });
const core = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.06, H - 0.06), honeyMat);
core.position.set(0, H / 2, 0.001); scene.add(core);
const coreFrame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W - 0.02, H - 0.02, D * 0.8)),
  new THREE.LineBasicMaterial({ color: 0x6fd37f, transparent: true, opacity: 0 }));
coreFrame.position.copy(door.position); scene.add(coreFrame);

// ---------- Cerraduras ----------
const black = new THREE.MeshStandardMaterial({ color: 0x16151c, metalness: 0.4, roughness: 0.35 });
const chrome = new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.9, roughness: 0.2 });
const ledMat = new THREE.MeshBasicMaterial({ color: 0x6fd37f });
function rounded(w, h, d, r) {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
}
const locks = {
  huella() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(rounded(0.075, 0.19, 0.022, 0.03), black));
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 32), chrome);
    knob.rotation.x = Math.PI / 2; knob.position.set(0, -0.055, 0.035); g.add(knob);
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.008, 16), ledMat); led.position.set(0, 0.07, 0.023); g.add(led);
    return g;
  },
  manija() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(rounded(0.055, 0.32, 0.022, 0.02), black));
    const lever = new THREE.Mesh(rounded(0.14, 0.022, 0.02, 0.01), black); lever.position.set(-0.06, -0.05, 0.035); g.add(lever);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 24), black); hub.rotation.x = Math.PI / 2; hub.position.set(0, -0.05, 0.03); g.add(hub);
    const led = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.003), ledMat); led.position.set(0, 0.12, 0.023); g.add(led);
    return g;
  },
  vertical() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(rounded(0.065, 0.46, 0.026, 0.03), black));
    const grip = new THREE.Mesh(rounded(0.03, 0.2, 0.03, 0.012), black); grip.position.set(0, -0.08, 0.028); g.add(grip);
    const led = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.003), ledMat); led.position.set(0, 0.17, 0.027); g.add(led);
    return g;
  }
};
let lockObj = null;
function setLock(type) {
  if (lockObj) { scene.remove(lockObj); lockObj.traverse(o => o.geometry && o.geometry.dispose()); }
  lockObj = locks[type](); lockObj.position.set(W / 2 - 0.11, 1.05, D / 2 + 0.001); scene.add(lockObj);
}

// ---------- Pasadores ----------
const boltMat = new THREE.MeshStandardMaterial({ color: 0xf2f1f8, metalness: 0.85, roughness: 0.22, emissive: 0x6fd37f, emissiveIntensity: 0 });
const BL = 0.14, BR = 0.021, TRAVEL = 0.078;
let bolts = [];
function buildBolts(lat, top, locked) {
  bolts.forEach(b => { scene.remove(b.m); b.m.geometry.dispose(); });
  bolts = [];
  const geo = () => new THREE.CylinderGeometry(BR, BR, BL, 20);
  for (let i = 0; i < lat; i++) {
    const y = H * (0.14 + 0.72 * (lat === 1 ? 0.5 : i / (lat - 1)));
    [-1, 1].forEach((s, k) => {
      const m = new THREE.Mesh(geo(), boltMat); m.rotation.z = Math.PI / 2; m.position.y = y; scene.add(m);
      bolts.push({ m, axis: 'x', s, base: s * (W / 2 - BL / 2 + 0.005), p: 0, t: locked ? 1 : 0, delay: (i * 2 + k) * 0.05 });
    });
  }
  const xs = top === 1 ? [0] : top === 2 ? [-0.2, 0.2] : top === 3 ? [-0.28, 0, 0.28] : [];
  xs.forEach((x, i) => {
    const m = new THREE.Mesh(geo(), boltMat); m.position.x = x; scene.add(m);
    bolts.push({ m, axis: 'y', s: 1, base: H - BL / 2 + 0.005, p: 0, t: locked ? 1 : 0, delay: 0.2 + i * 0.06 });
  });
  bolts.forEach(placeBolt);
}
function smooth(q) { return q * q * (3 - 2 * q); }
function placeBolt(b) { const off = b.base + b.s * TRAVEL * smooth(b.p); if (b.axis === 'x') b.m.position.x = off; else b.m.position.y = off; }
let animT = 0;
function lockTo(on) { animT = 0; bolts.forEach(b => { b.t = on ? 1 : 0; }); if (reduce) bolts.forEach(b => { b.p = b.t; placeBolt(b); }); kick(); }

// ---------- Vista por dentro / por fuera ----------
let xray = 1, xrayT = 1;
function applyXray(v) {
  const o = 1 - v * 0.82;
  faceMat.opacity = sideMat.opacity = o; faceMat.depthWrite = sideMat.depthWrite = v < 0.5;
  steel.opacity = 1 - v * 0.6; steel.depthWrite = v < 0.5;
  honeyMat.opacity = v * 0.55; coreFrame.material.opacity = v * 0.9;
  boltMat.emissiveIntensity = v * 0.55;
  if (lockObj) lockObj.visible = v < 0.85;
}

// ---------- Cámara y controles ----------
const controls = new OrbitControls(camera, canvas);
controls.target.copy(target); controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 2.6; controls.maxDistance = 6.5; controls.minPolarAngle = 0.95; controls.maxPolarAngle = 1.62;
controls.minAzimuthAngle = -1.15; controls.maxAzimuthAngle = 1.15; controls.rotateSpeed = 0.7;
let dist = 3.7;
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  dist = camera.aspect < 0.9 ? 5.0 : camera.aspect < 1.2 ? 4.2 : 3.7;
  camera.updateProjectionMatrix(); kick();
}
camera.position.set(1.35, 1.35, 4.2); controls.update();
new ResizeObserver(resize).observe(stage); resize();
{ const dir = camera.position.clone().sub(target).normalize(); camera.position.copy(target).addScaledVector(dir, dist); controls.update(); }

let touched = 0;
controls.addEventListener('start', () => { touched = performance.now(); stage.classList.add('used'); });
controls.addEventListener('change', () => { lastInput = performance.now(); kick(); });

// ---------- Reloj único ----------
function kick() { lastInput = performance.now(); if (!running && visible) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  let busy = false;
  animT += dt;
  bolts.forEach(b => {
    if (b.p !== b.t) {
      busy = true;
      if (animT < b.delay) return;
      const step = dt / 0.55; b.p = b.t > b.p ? Math.min(b.t, b.p + step) : Math.max(b.t, b.p - step);
      placeBolt(b);
    }
  });
  if (Math.abs(xrayT - xray) > 0.001) { xray += (xrayT - xray) * Math.min(1, dt * 7); applyXray(xray); busy = true; } else if (xray !== xrayT) { xray = xrayT; applyXray(xray); }
  // Movimiento en reposo: un vaivén lento mientras nadie toca la puerta
  if (!reduce && now - touched > 4000) { idle += dt; const a = Math.sin(idle * 0.35) * 0.32; const r = camera.position.clone().sub(target); const len = Math.hypot(r.x, r.z); camera.position.x = target.x + Math.sin(a + 0.32) * len; camera.position.z = target.z + Math.cos(a + 0.32) * len; busy = true; }
  controls.update();
  renderer.render(scene, camera);
  if ((busy || now - lastInput < 800) && visible) requestAnimationFrame(frame); else running = false;
}
new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }, { threshold: 0.05 }).observe(stage);

// ---------- Conexión con los controles de la página ----------
let prev = {};
function sync(s, first) {
  if (first || s.finish !== prev.finish) { faceMat.map = finishes[s.finish]; sideMat.color.setHex(edgeColor[s.finish]); faceMat.needsUpdate = true; }
  if (first || s.lock !== prev.lock) setLock(s.lock);
  if (first || s.lat !== prev.lat || s.top !== prev.top) buildBolts(s.lat, s.top, s.locked && !first);
  if (first) { applyXray(xray); }
  if (!first && s.locked !== prev.locked) lockTo(s.locked);
  if (!first && s.xray !== prev.xray) xrayT = s.xray ? 1 : 0;
  if (!first && (s.lat !== prev.lat || s.top !== prev.top) && s.locked) { animT = 0; bolts.forEach(b => { b.p = 0; b.t = 1; }); }
  prev = { ...s }; kick();
}
xrayT = xray = cfg.state.xray ? 1 : 0;
sync(cfg.state, true);
cfg.on(s => sync(s));
document.documentElement.classList.add('has3d');
// Primera vez que aparece: los pasadores entran al marco
const firstLook = new IntersectionObserver(es => {
  if (!es[0].isIntersecting) return; firstLook.disconnect();
  setTimeout(() => cfg.set({ locked: true }), reduce ? 0 : 500);
}, { threshold: 0.4 });
firstLook.observe(stage);
