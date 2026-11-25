import * as THREE from 'three';
import { World, DT, SPEED, IDLE } from './sim.js';
import { LEVELS, CHAPTERS } from './levels.js';

/* ---------- constants ---------- */
const PLAYER_COLOR = 0xe0474f;
const GHOST_COLORS = [0x45a6dc, 0x56c26a, 0xe8c23a, 0xa978e6, 0xf2903e, 0xe46fb2];
const KIND_COLOR = { floor: 0x737a8c, wall: 0xb39373, cliff: 0x7e8699, pillar: 0x5c6273, deck: 0x7b8295, post: 0x30364a };
const FOG = 0x9ab6d6;
const $ = id => document.getElementById(id);
const hex = c => '#' + c.toString(16).padStart(6, '0');

/* ---------- renderer / scene ---------- */
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(FOG, 45, 170);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x4d5566, 1.7));
const sun = new THREE.DirectionalLight(0xfff4e6, 2.1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

/* ---------- materials / textures ---------- */
const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...opts }));
  return matCache.get(key);
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
function glyphTex(label, w, h, bg = '#fff') {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = 'rgba(0,0,0,.42)'; g.font = `800 ${Math.round(Math.min(w, h) * 0.42)}px "Barlow Condensed", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, w / 2, h / 2 + 4);
  });
}
const pauseTex = canvasTex(128, 128, (g) => {
  g.fillStyle = 'rgba(20,28,42,.8)'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.fillRect(40, 34, 16, 60); g.fillRect(72, 34, 16, 60);
});
const crateTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(60,30,10,.45)'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
  g.lineWidth = 8; g.beginPath(); g.moveTo(10, 10); g.lineTo(w - 10, h - 10); g.stroke();
  g.lineWidth = 3; g.strokeStyle = 'rgba(60,30,10,.18)';
  for (let y = 32; y < h; y += 32) { g.beginPath(); g.moveTo(10, y); g.lineTo(w - 10, y); g.stroke(); }
});
const edgeMat = new THREE.LineBasicMaterial({ color: 0x101522, transparent: true, opacity: 0.16 });

function boxMesh(s, material, shadows = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), material);
  m.castShadow = shadows; m.receiveShadow = true;
  return m;
}
function withEdges(m) { m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), edgeMat)); return m; }

/* ---------- characters ---------- */
function makeChar(color, isGhost) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0, emissive: color, emissiveIntensity: isGhost ? 0.18 : 0.06 });
  const dark = mat(0x1c2230, { flatShading: false, roughness: 0.4 });
  const part = (geo, mm, x, y, z, parent = g) => { const p = new THREE.Mesh(geo, mm); p.position.set(x, y, z); p.castShadow = true; parent.add(p); return p; };
  part(new THREE.CapsuleGeometry(0.19, 0.22, 4, 12), m, 0, 0.74, 0);
  part(new THREE.SphereGeometry(0.165, 16, 12), m, 0, 1.04, 0);
  part(new THREE.BoxGeometry(0.2, 0.055, 0.06), dark, 0, 1.06, 0.145);
  const limb = (x, y, r, len, off) => { const pv = new THREE.Group(); pv.position.set(x, y, 0); g.add(pv); part(new THREE.CapsuleGeometry(r, len, 4, 8), m, 0, off, 0, pv); return pv; };
  const legL = limb(-0.09, 0.47, 0.072, 0.26, -0.235), legR = limb(0.09, 0.47, 0.072, 0.26, -0.235);
  const armL = limb(-0.255, 0.88, 0.058, 0.25, -0.18), armR = limb(0.255, 0.88, 0.058, 0.25, -0.18);
  g.userData = { legL, legR, armL, armR, phase: 0, face: 0 };
  return g;
}
function animChar(mesh, body, dt) {
  const u = mesh.userData;
  const sp = Math.hypot(body.vx, body.vz);
  if (sp > 0.4) {
    const target = Math.atan2(body.vx, body.vz);
    let d = target - u.face; d = Math.atan2(Math.sin(d), Math.cos(d));
    u.face += d * Math.min(1, dt * 14);
  }
  mesh.rotation.y = u.face;
  const air = !body.ground && Math.abs(body.vy) > 0.3;
  u.phase += sp * dt * 2.6;
  const k = Math.min(1, sp / SPEED);
  const s = Math.sin(u.phase) * 0.85 * k;
  const ease = (o, t) => o + (t - o) * Math.min(1, dt * 16);
  u.legL.rotation.x = ease(u.legL.rotation.x, air ? -0.5 : s);
  u.legR.rotation.x = ease(u.legR.rotation.x, air ? 0.35 : -s);
  u.armL.rotation.x = ease(u.armL.rotation.x, air ? -2.2 : -s * 0.9);
  u.armR.rotation.x = ease(u.armR.rotation.x, air ? -2.2 : s * 0.9);
  u.armL.rotation.z = ease(u.armL.rotation.z, air ? -0.3 : 0);
  u.armR.rotation.z = ease(u.armR.rotation.z, air ? 0.3 : 0);
}

/* ---------- level view ---------- */
const lerp = (a, b, t) => a + (b - a) * t;
class LevelView {
  constructor(world) {
    this.world = world;
    const def = world.def;
    this.group = new THREE.Group(); scene.add(this.group);
    const add = o => { this.group.add(o); return o; };

    this.blockers = [];
    for (const s of def.statics) {
      const m = withEdges(boxMesh(s.s, mat(KIND_COLOR[s.c] ?? KIND_COLOR.floor)));
      m.position.fromArray(s.p); add(m); this.blockers.push(m);
    }
    // a link label (I, II, ...) per door/bridge so plates and what they open are easy to match
    const linkIds = [...new Set([...(def.doors || []), ...(def.bridges || []), ...(def.lasers || [])].map(d => d.id).filter(Boolean))];
    const label = id => ROMAN[linkIds.indexOf(id)] || '';
    this.doorMeshes = world.doors.map(d => {
      const n = world.plateTotals[d.id] || 0;
      const text = label(d.id) + (d.def.mode === 'all' && n > 1 ? ` ×${n}` : '');
      const col = d.def.invert ? 0x4d7fd6 : 0xe27d38;
      const tex = glyphTex(text, 256, 384);
      const m = withEdges(boxMesh(d.s, new THREE.MeshStandardMaterial({ color: col, map: tex, roughness: 0.6, emissive: col, emissiveIntensity: 0.12 })));
      this.blockers.push(m);
      return add(m);
    });
    this.bridgeMeshes = world.bridges.map(b => add(withEdges(boxMesh(b.s, mat(b.id ? 0x9198a8 : 0xa9917a)))));
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xff3b4e });
    const sheetMat = new THREE.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false });
    this.laserViews = world.lasers.map(l => {
      const g = new THREE.Group(); const [cx, cy, cz] = l.def.p, [sx, sy] = l.def.s; g.position.set(cx, cy, cz); add(g);
      const beams = new THREE.Group(); g.add(beams);
      for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.05, 0.05), beamMat); b.position.y = -sy / 2 + 0.25 + i * (sy - 0.5) / 6; beams.add(b); }
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(sx, sy), sheetMat); beams.add(sheet);
      if (l.id) for (const side of [-1, 1]) {
        const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTex(label(l.id), 128, 128, l.def.invert ? '#9ec0ff' : '#ffb3b3') }));
        sign.scale.set(0.6, 0.6, 1); sign.position.set(side * (sx / 2 + 0.3), sy / 2 + 0.55, 0); g.add(sign);
      }
      const lights = [-1, 1].map(side => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b4e })); e.position.set(side * (sx / 2 + 0.3), sy / 2 + 0.1, 0); g.add(e); return e; });
      return { l, beams, lights, sheet };
    });
    const glassMat = () => new THREE.MeshStandardMaterial({ color: 0x9fe3ff, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.72, emissive: 0x4fb8e0, emissiveIntensity: 0.15 });
    this.fragViews = world.fragiles.map(f => {
      const m = withEdges(boxMesh(f.def.s, glassMat())); m.position.fromArray(f.def.p); add(m);
      return { f, m, fall: 0 };
    });
    this.plateMeshes = world.plates.map(p => {
      const g = new THREE.Group(); g.position.set(p.x, p.y, p.z);
      const frame = boxMesh([1.5, 0.06, 1.5], mat(0x3b4150)); frame.position.y = 0.03; g.add(frame);
      const padMat = new THREE.MeshStandardMaterial({ color: 0xe8a33a, map: glyphTex(label(p.link), 128, 128), roughness: 0.6, emissive: 0xe8a33a, emissiveIntensity: 0.15 });
      const pad = boxMesh([1.3, 0.08, 1.3], padMat); pad.position.y = 0.07; g.add(pad);
      g.userData = { pad, padMat, k: 0 };
      return add(g);
    });
    this.scaleViews = world.scales.map(sc => {
      const wood = mat(0x8d6a47);
      const a = withEdges(boxMesh(sc.a.s, wood)), b = withEdges(boxMesh(sc.b.s, wood));
      add(a); add(b);
      const pivotY = sc.rest + sc.rise + 2.35, cx = (sc.a.x + sc.b.x) / 2, cz = sc.a.z;
      const pivot = new THREE.Group(); pivot.position.set(cx, pivotY, cz); add(pivot);
      const span = sc.b.x - sc.a.x;
      const bars = [-1.1, 1.1].map(dz => { const bar = boxMesh([span + 0.5, 0.18, 0.18], wood); bar.position.z = dz; pivot.add(bar); return bar; });
      const cross = boxMesh([0.3, 0.3, 2.6], mat(0x5c6273)); cross.position.set(cx, pivotY, cz); add(cross);
      const rodGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 6);
      const rods = [];
      for (const pan of [sc.a, sc.b]) for (const dz of [-1.1, 1.1]) {
        const r = new THREE.Mesh(rodGeo, mat(0x3b4150)); r.castShadow = true; add(r); rods.push({ r, pan, dz });
      }
      return { sc, a, b, pivot, bars, rods, pivotY };
    });
    // goal
    const gp = def.goal;
    const goal = new THREE.Group(); goal.position.fromArray(gp); add(goal);
    const pillar = boxMesh([0.32, 2.0, 0.32], new THREE.MeshStandardMaterial({ color: 0x2fd0b0, emissive: 0x2fd0b0, emissiveIntensity: 0.55, roughness: 0.3 }));
    pillar.position.y = 1.0; goal.add(pillar);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32), new THREE.MeshBasicMaterial({ color: 0x5ff5d6, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; goal.add(ring);
    const glow = new THREE.PointLight(0x2fd0b0, 6, 6, 1.6); glow.position.y = 1.2; goal.add(glow);
    this.goal = { goal, pillar, ring };
    // shard (optional collectible)
    if (def.shard) {
      this.shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshStandardMaterial({ color: 0xffd43b, emissive: 0xffc400, emissiveIntensity: 0.6, roughness: 0.3, flatShading: true }));
      this.shard.castShadow = true; this.shard.position.fromArray(def.shard); add(this.shard);
    }
    this.clouds = makeClouds(def); add(this.clouds);
    this.boxMeshes = []; this.charMeshes = [];
  }

  syncBodies() {
    for (const m of [...this.boxMeshes, ...this.charMeshes]) this.group.remove(m);
    const w = this.world;
    this.boxMeshes = w.boxes.map(() => { const m = withEdges(boxMesh([1, 1, 1], new THREE.MeshStandardMaterial({ color: 0xa8743f, map: crateTex, roughness: 0.8 }))); this.group.add(m); return m; });
    this.charMeshes = w.chars.map(c => {
      const m = makeChar(c.isPlayer ? PLAYER_COLOR : GHOST_COLORS[c.ghostIndex % GHOST_COLORS.length], !c.isPlayer); this.group.add(m);
      if (!c.isPlayer) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pauseTex, transparent: true, depthTest: false }));
        sp.scale.set(0.45, 0.45, 1); sp.position.y = 1.65; sp.visible = false; sp.renderOrder = 5; m.add(sp); m.userData.pauseSprite = sp;
      }
      return m;
    });
    // keep facing consistent at spawn
    for (const m of this.charMeshes) m.userData.face = Math.PI;
  }

  update(alpha, dt, time) {
    const w = this.world;
    const P = (o, m, oy = 0) => m.position.set(lerp(o.px, o.x, alpha), lerp(o.py, o.y, alpha) + oy, lerp(o.pz, o.z, alpha));
    w.doors.forEach((d, i) => P(d, this.doorMeshes[i]));
    w.bridges.forEach((b, i) => P(b, this.bridgeMeshes[i]));
    for (const v of this.laserViews) {
      v.beams.visible = v.l.on;
      if (v.l.on) { v.beams.children.forEach((b, i) => { if (b.geometry.type === 'BoxGeometry') b.scale.y = 1 + 0.5 * Math.sin(time * 30 + i); }); v.sheet.material.opacity = 0.1 + 0.04 * Math.sin(time * 12); }
      for (const e of v.lights) e.material.color.setHex(v.l.on ? 0xff3b4e : 0x444a58);
    }
    for (const v of this.fragViews) {
      const f = v.f;
      if (f.gone) {
        v.fall = Math.min(1, v.fall + dt * 1.6);
        v.m.position.y = f.def.p[1] - v.fall * v.fall * 6; v.m.material.opacity = 0.72 * (1 - v.fall); v.m.visible = v.fall < 1;
        v.m.rotation.x = v.fall * 0.6;
      } else {
        v.fall = 0; v.m.visible = true; v.m.position.fromArray(f.def.p); v.m.rotation.x = 0; v.m.material.opacity = 0.72;
        v.m.material.color.setHex(f.touched ? 0xffc48a : 0x9fe3ff);
        if (f.touched && f.t > 0) v.m.position.x = f.def.p[0] + Math.sin(time * 70) * 0.03;
      }
    }
    w.plates.forEach((p, i) => {
      const u = this.plateMeshes[i].userData;
      u.k += ((p.pressed ? 1 : 0) - u.k) * Math.min(1, dt * 14);
      u.padMat.color.lerpColors(new THREE.Color(0xe8a33a), new THREE.Color(0x4fc76b), u.k);
      u.padMat.emissive.copy(u.padMat.color);
      u.pad.position.y = 0.07 - 0.045 * u.k;
    });
    for (const v of this.scaleViews) {
      P(v.sc.a, v.a); P(v.sc.b, v.b);
      const ta = v.a.position.y + 0.15, tb = v.b.position.y + 0.15;
      const L = v.pivotY - v.sc.rest;
      const ea = ta + L, eb = tb + L;
      const span = v.sc.b.x - v.sc.a.x;
      v.pivot.rotation.z = Math.atan2(eb - ea, span);
      v.pivot.position.y = (ea + eb) / 2;
      for (const r of v.rods) {
        const top = r.pan === v.sc.a ? ea : eb, bot = r.pan === v.sc.a ? ta : tb;
        r.r.scale.y = top - bot; r.r.position.set(r.pan.x, (top + bot) / 2, r.pan.z + r.dz);
      }
    }
    w.boxes.forEach((b, i) => { const m = this.boxMeshes[i]; m.visible = !b.gone; P(b, m, 0.5); });
    w.chars.forEach((c, i) => {
      const m = this.charMeshes[i]; m.visible = !c.gone; P(c, m); animChar(m, c, dt);
      const ps = m.userData.pauseSprite;
      if (ps) { ps.visible = c.paused; if (c.paused) ps.material.opacity = 0.65 + 0.35 * Math.sin(time * 8); }
    });
    this.goal.pillar.rotation.y = time * 0.8;
    this.goal.ring.scale.setScalar(1 + Math.sin(time * 3) * 0.08);
    if (this.shard) {
      this.shard.visible = !w.shardTaken;
      this.shard.rotation.y = time * 2; this.shard.position.y = w.def.shard[1] + Math.sin(time * 2.4) * 0.08;
    }
    this.clouds.children.forEach((c, i) => { c.position.x += Math.sin(i) * dt * 0.3; });
  }

  dispose() {
    scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
}

function makeClouds(def) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: 0.85 });
  let seed = def.name.length * 97 + 13;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Group();
    const n = 3 + Math.floor(rnd() * 3);
    for (let j = 0; j < n; j++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + rnd() * 1.6, 0), m);
      s.position.set(j * 1.8 - n, rnd() * 0.8, rnd() * 1.5); s.scale.y = 0.6; c.add(s);
    }
    const ang = rnd() * Math.PI * 2, r = 55 + rnd() * 55;
    c.position.set(Math.cos(ang) * r, -30 + rnd() * 22, -6 + Math.sin(ang) * r);
    c.scale.setScalar(1.6 + rnd() * 2);
    g.add(c);
  }
  return g;
}

/* ---------- audio (tiny synth) ---------- */
const sfx = {
  ctx: null, on: true,
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; } } if (this.ctx?.state === 'suspended') this.ctx.resume(); },
  tone(f, t0, dur, type = 'sine', vol = 0.12, f2) {
    const c = this.ctx; if (!c || !this.on) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0;
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  },
  play(k) {
    if (!this.ctx || !this.on) return;
    if (k === 'jump') this.tone(320, 0, 0.12, 'square', 0.04, 560);
    else if (k === 'plateOn') { this.tone(660, 0, 0.08, 'triangle', 0.1); this.tone(990, 0.06, 0.1, 'triangle', 0.08); }
    else if (k === 'plateOff') this.tone(420, 0, 0.1, 'triangle', 0.08, 300);
    else if (k === 'door') this.tone(110, 0, 0.35, 'sawtooth', 0.035, 70);
    else if (k === 'skip') { this.tone(900, 0, 0.6, 'sawtooth', 0.05, 80); this.tone(1800, 0.05, 0.5, 'sine', 0.05, 200); this.tone(60, 0.35, 0.4, 'sine', 0.15, 120); }
    else if (k === 'win') [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.1, 0.3, 'triangle', 0.1));
    else if (k === 'shard') [1200, 1600, 2000].forEach((f, i) => this.tone(f, i * 0.06, 0.15, 'sine', 0.07));
    else if (k === 'fail') this.tone(300, 0, 0.4, 'square', 0.05, 90);
    else if (k === 'nope') this.tone(150, 0, 0.15, 'square', 0.05);
    else if (k === 'zap') { this.tone(1400, 0, 0.25, 'sawtooth', 0.06, 100); this.tone(90, 0.05, 0.3, 'square', 0.06, 50); }
    else if (k === 'crumble') { this.tone(1800, 0, 0.08, 'triangle', 0.05, 900); this.tone(260, 0.03, 0.25, 'sawtooth', 0.03, 90); }
  },
};

/* ---------- progress ---------- */
const SAVE_KEY = 'timeskip-progress-v2';
let progress = { done: {}, shards: {}, best: {} };   // keyed by level name
try {
  const s = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (s && s.done) progress = { done: {}, shards: {}, best: {}, ...s };
  else { // migrate the first version, which keyed progress by level number
    const v1 = JSON.parse(localStorage.getItem('timeskip-progress-v1'));
    const OLD = ['Hold the Door', 'Step Up', 'Two Locks', 'Dead Weight', 'Counterweight', 'Relay', 'Drawbridge', 'All Together'];
    if (v1 && v1.done) for (const k of ['done', 'shards', 'best']) for (const i in v1[k] || {}) if (OLD[i]) progress[k][OLD[i]] = v1[k][i];
  }
} catch { /* storage unavailable */ }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch { /* ignore */ } }
const nm = i => LEVELS[i].name;
// you may skip one level you're stuck on: a level opens once either of the two before it is done
const unlocked = i => i < 2 || progress.done[nm(i)] || progress.done[nm(i - 1)] || progress.done[nm(i - 2)];

/* ---------- game state ---------- */
let state = 'title';          // title | levels | play | pause | complete
let levelIndex = 0, world = null, view = null, ghosts = [], skipsLeft = 0;
let acc = 0, jumpQueued = false, hintTimer = 0, winHold = 0;

function loadLevel(i) {
  levelIndex = i;
  if (view) view.dispose();
  world = new World(LEVELS[i]);
  view = new LevelView(world);
  ghosts = []; skipsLeft = LEVELS[i].timeskips;
  startRun(true);
}
function startRun(fresh) {
  world.reset(ghosts.map(g => g));
  view.syncBodies();
  acc = 0; jumpQueued = false;
  const sp = world.def.spawn;
  cam.target.set(sp[0], sp[1] + 1, sp[2]);
  if (fresh) { cam.yaw = 0; cam.pitch = 0.5; cam.dist = 9.5; }
  cam.cur = cam.dist;
  updateHud();
}
function enterPlay() {
  state = 'play';
  show(null);
  $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !isTouch);
}
function playLevel(i) {
  loadLevel(i);
  enterPlay();
  const b = $('banner'); $('banner-num').textContent = `Chapter ${LEVELS[i].chapter + 1} · Level ${i + 1}`; $('banner-name').textContent = LEVELS[i].name;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  showHint(true);
}
function timeskip() {
  if (state !== 'play') return;
  if (skipsLeft <= 0) { toast('No timeskips left — press T to retry this run, or restart the level'); sfx.play('nope'); const h = $('hud-skips'); h.classList.remove('bump'); void h.offsetWidth; h.classList.add('bump'); return; }
  ghosts.push(world.rec);
  skipsLeft--;
  startRun(false);
  sfx.play('skip');
  const fx = $('fx'); $('fx-text').textContent = `RUN ${ghosts.length + 1}`;
  fx.classList.remove('go'); void fx.offsetWidth; fx.classList.add('go');
}
function retryRun(msg) {
  startRun(false);
  if (msg) toast(msg);
}
function restartLevel() { ghosts = []; skipsLeft = LEVELS[levelIndex].timeskips; world.shardTaken = false; startRun(true); enterPlay(); showHint(true); }

function win() {
  state = 'complete';
  sfx.play('win');
  const i = levelIndex, runs = ghosts.length + 1;
  progress.done[nm(i)] = true;
  if (world.shardTaken) progress.shards[nm(i)] = true;
  progress.best[nm(i)] = Math.min(progress.best[nm(i)] ?? 99, runs);
  save();
  const last = i === LEVELS.length - 1;
  $('c-title').textContent = last ? 'All levels complete!' : 'Level complete';
  const def = LEVELS[i];
  $('c-stats').innerHTML = `<dt>Level</dt><dd>${i + 1}. ${def.name}</dd><dt>Runs</dt><dd>${runs}</dd><dt>Timeskips used</dt><dd>${ghosts.length} / ${def.timeskips}</dd><dt>Core</dt><dd>${world.shardTaken ? 'Found' : (progress.shards[nm(i)] ? 'Found before' : 'Missed')}</dd>`;
  $('btn-next').classList.toggle('hidden', last);
  setTimeout(() => { if (state === 'complete') { show('complete'); $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); (last ? $('btn-replay') : $('btn-next')).focus(); } }, 650);
}

/* ---------- HUD / UI ---------- */
function updateHud() {
  const def = LEVELS[levelIndex];
  const hs = $('hud-skips'); hs.textContent = `TIMESKIPS: ${skipsLeft} / ${def.timeskips}`; hs.classList.toggle('empty', skipsLeft === 0);
  $('hud-run').textContent = `RUN ${ghosts.length + 1}`;
  $('hud-level').textContent = `${levelIndex + 1}. ${def.name}`;
  $('hud-legend').innerHTML = ghosts.map((_, i) => `<span><i style="background:${hex(GHOST_COLORS[i % GHOST_COLORS.length])}"></i>Run ${i + 1}<em id="lg-${i}"></em></span>`).join('') +
    (ghosts.length ? `<span><i style="background:${hex(PLAYER_COLOR)}"></i>You</span>` : '');
  legendCache = [];
}
// show how late each clone is running (it pauses while something blocks its path)
let legendCache = [];
function updateLegend() {
  if (!world) return;
  world.ghosts.forEach((g, i) => {
    const txt = g.gone ? 'zapped' : g.paused ? 'waiting' : g.delay > 6 ? `+${(g.delay / 60).toFixed(1)}s` : '';
    if (legendCache[i] !== txt) { legendCache[i] = txt; const el = $('lg-' + i); if (el) el.textContent = txt; }
  });
}
let pauseTipShown = false;
let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
function showHint(on) { const h = $('hint'); h.textContent = LEVELS[levelIndex].hint; h.classList.toggle('off', !on); hintTimer = on ? 14 : 0; }
const screens = ['title', 'levels', 'pause', 'complete'];
function show(name) { for (const s of screens) $(s).classList.toggle('hidden', s !== name); }

function openLevels(from) {
  state = 'levels'; levelsFrom = from;
  $('hud').classList.add('hidden'); $('touch').classList.add('hidden');
  const card = (L, i) => {
    const ok = unlocked(i), done = progress.done[L.name], best = progress.best[L.name];
    return `<button class="lvl ${done ? 'done' : ''}" data-i="${i}" ${ok ? '' : 'disabled'}>
      <span class="badges">${done ? '<i class="b-done" title="Completed"></i>' : ''}<i class="b-core ${progress.shards[L.name] ? '' : 'miss'}" title="Core"></i></span>
      <span class="n">${i + 1}</span><span class="nm">${L.name}</span>
      <span class="meta">${ok ? `${L.timeskips} timeskip${L.timeskips > 1 ? 's' : ''}${best ? ` · best ${best} runs` : ''}` : 'Locked'}</span></button>`;
  };
  const doneCount = LEVELS.filter(L => progress.done[L.name]).length, coreCount = LEVELS.filter(L => progress.shards[L.name]).length;
  $('levels-summary').textContent = `${doneCount} / ${LEVELS.length} solved · ${coreCount} / ${LEVELS.length} cores`;
  $('level-grid').innerHTML = CHAPTERS.map((c, ci) => `<h3>Chapter ${ci + 1} · ${c.name}</h3><div class="chapter">${c.levels.map(L => card(L, LEVELS.indexOf(L))).join('')}</div>`).join('');
  show('levels');
  $('level-grid').querySelector('.lvl:not(:disabled)')?.focus();
}
let levelsFrom = 'title';
$('level-grid').addEventListener('click', e => { const b = e.target.closest('.lvl'); if (b && !b.disabled) { sfx.init(); playLevel(+b.dataset.i); } });
$('btn-play').onclick = () => { sfx.init(); let i = LEVELS.findIndex(L => !progress.done[L.name]); playLevel(i < 0 ? 0 : i); };
$('btn-levels').onclick = () => { sfx.init(); openLevels('title'); };
$('btn-levels-back').onclick = () => { if (levelsFrom === 'pause') { state = 'pause'; show('pause'); } else { state = 'title'; show('title'); } };
$('btn-resume').onclick = () => enterPlay();
$('btn-retry').onclick = () => { enterPlay(); retryRun(); };
$('btn-restart').onclick = () => restartLevel();
$('btn-pause-levels').onclick = () => openLevels('pause');
$('btn-sound').onclick = () => toggleSound();
$('btn-next').onclick = () => playLevel(Math.min(levelIndex + 1, LEVELS.length - 1));
$('btn-replay').onclick = () => playLevel(levelIndex);
$('btn-c-levels').onclick = () => openLevels('title');
function toggleSound() { sfx.on = !sfx.on; $('btn-sound').textContent = `Sound: ${sfx.on ? 'on' : 'off'}`; toast(`Sound ${sfx.on ? 'on' : 'off'}`); }
function pause() { if (state !== 'play') return; state = 'pause'; show('pause'); $('btn-resume').focus(); }

/* ---------- input ---------- */
const keys = new Set();
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
addEventListener('keydown', e => {
  sfx.init();
  const k = e.key.toLowerCase();
  if (state === 'play') {
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (k === ' ' && !e.repeat) jumpQueued = true;
    else if (k === 'r' && !e.repeat) timeskip();
    else if (k === 't' && !e.repeat) retryRun();
    else if (k === 'escape' || k === 'p') pause();
    else if (k === 'h') showHint($('hint').classList.contains('off'));
    else if (k === 'm') toggleSound();
    keys.add(k);
  } else if (state === 'pause' && (k === 'escape' || k === 'p')) enterPlay();
  else if (state === 'complete' && k === 'enter' && !e.repeat) { e.preventDefault(); if (levelIndex < LEVELS.length - 1) playLevel(levelIndex + 1); else playLevel(levelIndex); }
  else if (state === 'levels' && k === 'escape') $('btn-levels-back').click();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); pause(); });

const cam = { yaw: 0, pitch: 0.5, dist: 9.5, cur: 9.5, target: new THREE.Vector3() };
const joy = { x: 0, y: 0, id: null };

// mouse drag to look
let drag = null;
canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') return; drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); sfx.init(); });
canvas.addEventListener('pointermove', e => { if (!drag || e.pointerType === 'touch') return; lookBy(e.clientX - drag.x, e.clientY - drag.y); drag = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { cam.dist = Math.max(4, Math.min(18, cam.dist + e.deltaY * 0.01)); e.preventDefault(); }, { passive: false });
function lookBy(dx, dy) { cam.yaw -= dx * 0.006; cam.pitch = Math.max(0.08, Math.min(1.35, cam.pitch + dy * 0.005)); }

// touch: joystick + camera drag + buttons
const touches = new Map();
const joyEl = $('joy'), knob = $('joy-knob');
joyEl.addEventListener('touchstart', e => { e.preventDefault(); sfx.init(); const t = e.changedTouches[0]; joy.id = t.identifier; moveJoy(t); }, { passive: false });
addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) moveJoy(t);
    else if (touches.has(t.identifier)) { const p = touches.get(t.identifier); lookBy((t.clientX - p.x) * 1.3, (t.clientY - p.y) * 1.3); touches.set(t.identifier, { x: t.clientX, y: t.clientY }); }
  }
}, { passive: true });
const endTouch = e => { for (const t of e.changedTouches) { if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; } touches.delete(t.identifier); } };
addEventListener('touchend', endTouch); addEventListener('touchcancel', endTouch);
canvas.addEventListener('touchstart', e => { sfx.init(); for (const t of e.changedTouches) touches.set(t.identifier, { x: t.clientX, y: t.clientY }); }, { passive: true });
function moveJoy(t) {
  const r = joyEl.getBoundingClientRect(), R = r.width / 2;
  let dx = t.clientX - (r.left + R), dy = t.clientY - (r.top + R);
  const d = Math.hypot(dx, dy), m = R * 0.75;
  if (d > m) { dx *= m / d; dy *= m / d; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  joy.x = dx / m; joy.y = -dy / m;
}
const tbtn = (id, fn) => $(id).addEventListener('touchstart', e => { e.preventDefault(); sfx.init(); fn(); }, { passive: false });
tbtn('t-jump', () => { jumpQueued = true; });
tbtn('t-skip', timeskip);
tbtn('t-retry', () => retryRun());
tbtn('t-pause', pause);

function gatherInput() {
  let ix = 0, iy = 0;
  if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
  if (keys.has('d') || keys.has('arrowright')) ix += 1;
  if (keys.has('w') || keys.has('arrowup')) iy += 1;
  if (keys.has('s') || keys.has('arrowdown')) iy -= 1;
  if (keys.has('q')) cam.yaw += 0.04;
  if (keys.has('e')) cam.yaw -= 0.04;
  ix += joy.x; iy += joy.y;
  const len = Math.hypot(ix, iy);
  if (len > 1) { ix /= len; iy /= len; }
  const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
  // camera-relative -> world space; quantised so recordings replay exactly
  const mx = Math.round((ix * cy - iy * sy) * 1000) / 1000;
  const mz = Math.round((-ix * sy - iy * cy) * 1000) / 1000;
  const j = jumpQueued ? 1 : 0; jumpQueued = false;
  return (mx || mz || j) ? [mx, mz, j] : IDLE;
}

/* ---------- loop ---------- */
function tickOnce() {
  world.step(gatherInput());
  for (const e of world.events) {
    if (e.type === 'jump') sfx.play('jump');
    else if (e.type === 'plateOn' || e.type === 'plateOff') sfx.play(e.type);
    else if (e.type === 'mover' && e.kind === 'door') sfx.play('door');
    else if (e.type === 'shard') { sfx.play('shard'); toast('Core collected!'); }
    else if (e.type === 'crumble') sfx.play('crumble');
    else if (e.type === 'ghostZap') { sfx.play('nope'); toast(`Run ${e.g.ghostIndex + 1} walked into a laser`); }
    else if (e.type === 'fell') { sfx.play('fail'); retryRun('You fell. Run restarted.'); world.events.length = 0; return; }
    else if (e.type === 'zap') { sfx.play('zap'); retryRun('Zapped! Run restarted.'); world.events.length = 0; return; }
    else if (e.type === 'win') { win(); world.events.length = 0; return; }
  }
  world.events.length = 0;
  if (!pauseTipShown && world.ghosts.some(g => g.paused && g.delay > 20)) { pauseTipShown = true; toast('Your past self waits until you get out of its way'); }
}

let last = performance.now();
const tmp = new THREE.Vector3(), camDir = new THREE.Vector3(), ray = new THREE.Raycaster();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (state === 'play') {
    acc += dt; let n = 0;
    while (acc >= DT && n < 8 && state === 'play') { tickOnce(); acc -= DT; n++; }
    if (n === 8) acc = 0;
    if (hintTimer > 0 && (hintTimer -= dt) <= 0) $('hint').classList.add('off');
  }
  const alpha = state === 'play' ? acc / DT : 1;
  if (state === 'play') updateLegend();
  const t = now / 1000;
  if (view) view.update(alpha, dt, t);

  // camera
  if (world) {
    const p = world.player;
    if (state === 'title') { cam.yaw += dt * 0.08; cam.target.lerp(tmp.set(0, 1, -4), 0.05); }
    else {
      tmp.set(lerp(p.px, p.x, alpha), lerp(p.py, p.y, alpha) + 1.0, lerp(p.pz, p.z, alpha));
      if (p.y > -6) cam.target.lerp(tmp, 1 - Math.exp(-dt * 10));
    }
    const cp = Math.cos(cam.pitch);
    camDir.set(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp);
    // pull the camera in front of walls so it never ends up inside geometry
    let d = cam.dist;
    if (state !== 'title' && view) {
      ray.set(cam.target, camDir); ray.far = cam.dist;
      const hit = ray.intersectObjects(view.blockers, false)[0];
      if (hit) d = Math.max(1.2, hit.distance - 0.35);
    }
    cam.cur += (d - cam.cur) * (d < cam.cur ? 1 : 1 - Math.exp(-dt * 4));
    camera.position.copy(cam.target).addScaledVector(camDir, cam.cur);
    camera.lookAt(cam.target);
    sun.position.set(cam.target.x + 9, cam.target.y + 20, cam.target.z + 7);
    sun.target.position.copy(cam.target);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ---------- boot: title screen over a live view of level 1 ---------- */
// wait briefly for the web font so plate/door labels draw in it (never blocks for long)
try { await Promise.race([document.fonts.load('800 40px "Barlow Condensed"'), new Promise(r => setTimeout(r, 1200))]); } catch { /* fine */ }
loadLevel(0);
cam.dist = cam.cur = 15; cam.pitch = 0.55;
state = 'title'; show('title');
requestAnimationFrame(frame);
window.__timeskip = { get world() { return world; }, get state() { return state; }, playLevel, timeskip };
