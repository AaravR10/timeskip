// Deterministic fixed-step simulation. No rendering code in here.
// Ghosts replay recorded inputs through this exact same simulation, so they
// interact with the world (plates, boxes, lifts, each other) just like you did.

export const DT = 1 / 60;
export const GRAV = 32;
export const JUMP_H = 1.5;
export const JUMP_V = Math.sqrt(2 * GRAV * JUMP_H);
export const SPEED = 5.2;
export const HW = 0.3;      // character half width
export const CH = 1.2;      // character height
export const STEP = 0.36;   // auto step-up height
export const FALL_Y = -18;
export const IDLE = [0, 0, 0];
const EPS = 1e-5;

export function ov(a, b) {
  return a.x0 < b.x1 - EPS && a.x1 > b.x0 + EPS &&
         a.y0 < b.y1 - EPS && a.y1 > b.y0 + EPS &&
         a.z0 < b.z1 - EPS && a.z1 > b.z0 + EPS;
}
export function bbox(c, s) {
  return { x0: c[0] - s[0] / 2, x1: c[0] + s[0] / 2, y0: c[1] - s[1] / 2, y1: c[1] + s[1] / 2, z0: c[2] - s[2] / 2, z1: c[2] + s[2] / 2 };
}
function savePrev(o) { o.px = o.x; o.py = o.y; o.pz = o.z; }

class Static {
  constructor(d) { this.kind = 'static'; this.def = d; this.bb = bbox(d.p, d.s); this.x = this.y = this.z = this.px = this.py = this.pz = 0; }
  aabb() { return this.bb; }
}

class Door {
  constructor(d) { this.kind = 'door'; this.def = d; this.id = d.id; this.s = d.s; this.rise = d.rise ?? 3.1; this.reset(); }
  reset() { this.off = 0; this.active = false; [this.x, this.y, this.z] = this.def.p; savePrev(this); }
  aabb() { return bbox([this.x, this.y, this.z], this.s); }
  update(w) {
    const target = this.active ? this.rise : 0, sp = 7 * DT;
    if (this.off < target) this.off = Math.min(target, this.off + sp);
    else if (this.off > target) {
      const n = Math.max(target, this.off - sp), oy = this.y;
      this.y = this.def.p[1] + n;
      const bb = this.aabb();
      if (w.bodies.some(b => !b.gone && ov(b.aabb(), bb))) { this.y = oy; return; } // blocked: never crush
      this.off = n;
    }
    this.y = this.def.p[1] + this.off;
  }
}

class Bridge {
  constructor(d) {
    this.kind = 'bridge'; this.def = d; this.id = d.id; this.s = d.s; this.from = d.from; this.to = d.to;
    this.len = Math.hypot(d.to[0] - d.from[0], d.to[1] - d.from[1], d.to[2] - d.from[2]);
    this.speed = d.speed ?? 6; this.reset();
  }
  reset() { this.u = 0; this.active = false; this.place(); savePrev(this); }
  place() { const f = this.from, t = this.to, u = this.u; this.x = f[0] + (t[0] - f[0]) * u; this.y = f[1] + (t[1] - f[1]) * u; this.z = f[2] + (t[2] - f[2]) * u; }
  aabb() { return bbox([this.x, this.y, this.z], this.s); }
  update() {
    const du = this.speed * DT / this.len;
    if (this.active) this.u = Math.min(1, this.u + du); else this.u = Math.max(0, this.u - du);
    this.place();
  }
}

class Pan {
  constructor(x, z, size, th) { this.kind = 'pan'; this.x = x; this.z = z; this.y = 0; this.s = [size, th, size]; savePrev(this); }
  aabb() { return bbox([this.x, this.y, this.z], this.s); }
}

// Counterweight lift: weight on pan A lowers it and raises pan B (B ignores its own load).
class Scale {
  constructor(d) {
    this.def = d; this.need = d.need; this.rise = d.rise ?? 3; this.unit = this.rise / this.need;
    this.rest = d.rest ?? 0; this.th = 0.3; const size = d.size ?? 2.4;
    this.a = new Pan(d.a[0], d.a[1], size, this.th);
    this.b = new Pan(d.b[0], d.b[1], size, this.th);
    this.reset();
  }
  reset() { this.lift = 0; this.w = 0; this.place(); savePrev(this.a); savePrev(this.b); }
  place() { this.a.y = this.rest - this.lift - this.th / 2; this.b.y = this.rest + this.lift - this.th / 2; }
  update(w) {
    this.w = w.weightOn(this.a);
    const target = Math.min(this.w, this.need) * this.unit, sp = 2.6 * DT;
    if (this.lift < target) this.lift = Math.min(target, this.lift + sp);
    else if (this.lift > target) this.lift = Math.max(target, this.lift - sp);
    this.place();
  }
}

export class Body {
  constructor(kind, p, opts = {}) {
    this.kind = kind;
    this.hw = kind === 'box' ? 0.5 : HW;
    this.h = kind === 'box' ? 1 : CH;
    this.spawn = p; this.rec = opts.rec || null; this.isPlayer = !!opts.isPlayer; this.ghostIndex = opts.ghostIndex ?? -1;
    this.x = p[0]; this.y = p[1]; this.z = p[2]; savePrev(this);
    this.vx = this.vy = this.vz = 0; this.ground = null; this.coyote = 0; this.jumpBuf = 0; this.gone = false; this.canStep = false;
  }
  aabb() { return { x0: this.x - this.hw, x1: this.x + this.hw, y0: this.y, y1: this.y + this.h, z0: this.z - this.hw, z1: this.z + this.hw }; }

  moveAxis(axis, d, w, canPush) {
    if (d === 0) return null;
    const lo = axis + '0', hi = axis + '1';
    const before = this.kind === 'char' ? this.aabb() : null;
    this[axis] += d;
    let hit = null;
    for (const s of w.all) {
      if (s === this || s.gone) continue;
      let sb = s.aabb();
      if (!ov(this.aabb(), sb)) continue;
      // characters that already overlap (e.g. everyone spawning on the same spot) pass through each other until they separate
      if (s.kind === 'char' && before && ov(before, sb)) continue;
      if (axis !== 'y') {
        if (this.kind === 'char' && this.canStep) {
          const rise = sb.y1 - this.y;
          if (rise > 0 && rise <= STEP) { const oy = this.y; this.y = sb.y1; if (w.isFree(this)) continue; this.y = oy; }
        }
        // corner slide: if we only clip the edge of something, nudge sideways through the gap
        if (this.kind === 'char' && s.kind !== 'char' && s.kind !== 'box') {
          const o = axis === 'x' ? 'z' : 'x', bb = this.aabb();
          const nl = bb[o + '1'] - sb[o + '0'], nr = sb[o + '1'] - bb[o + '0'];
          const shift = nl < 0.24 ? -nl : nr < 0.24 ? nr : 0;
          if (shift) { this[o] += shift; if (w.isFree(this)) continue; this[o] -= shift; }
        }
        if (canPush && s.kind === 'box') {
          const bb = this.aabb();
          const pen = d > 0 ? bb[hi] - sb[lo] : sb[hi] - bb[lo];
          s.pushed(axis, d > 0 ? pen : -pen, w, this);
          sb = s.aabb();
          if (!ov(this.aabb(), sb)) continue;
        }
      }
      if (axis === 'y') {
        if (d < 0) { this.y = sb.y1; this.ground = s; } else { this.y = sb.y0 - this.h; }
        this.vy = 0;
      } else {
        this[axis] = d > 0 ? sb[lo] - this.hw : sb[hi] + this.hw;
      }
      hit = s;
    }
    return hit;
  }

  pushed(axis, amt, w, pusher) {
    const lo = axis + '0', hi = axis + '1';
    this[axis] += amt;
    for (const s of w.all) {
      if (s === this || s === pusher || s.gone) continue;
      const sb = s.aabb();
      if (!ov(this.aabb(), sb)) continue;
      this[axis] = amt > 0 ? sb[lo] - this.hw : sb[hi] + this.hw;
    }
  }

  carry(w) {
    const g = this.ground;
    if (!g || g.gone) return;
    const dx = g.x - g.px, dy = g.y - g.py, dz = g.z - g.pz;
    if (dy) this.y += dy;
    if (dx) this.moveAxis('x', dx, w, false);
    if (dz) this.moveAxis('z', dz, w, false);
  }

  stepBox(w) {
    this.carry(w);
    this.vy = Math.max(this.vy - GRAV * DT, -28);
    this.ground = null;
    this.moveAxis('y', this.vy * DT, w, false);
  }

  stepChar(input, w) {
    const mx = input[0], mz = input[1], jp = input[2];
    this.carry(w);
    const grounded = !!this.ground;
    this.canStep = grounded;
    if (grounded) this.coyote = 6; else if (this.coyote > 0) this.coyote--;
    if (jp) this.jumpBuf = 8; else if (this.jumpBuf > 0) this.jumpBuf--;
    const k = Math.min(1, (grounded ? 20 : 8) * DT);
    this.vx += (mx * SPEED - this.vx) * k;
    this.vz += (mz * SPEED - this.vz) * k;
    this.jumped = false;
    if (this.jumpBuf > 0 && this.coyote > 0) { this.vy = JUMP_V; this.jumpBuf = 0; this.coyote = 0; this.jumped = true; }
    this.vy = Math.max(this.vy - GRAV * DT, -28);
    this.ground = null;
    this.moveAxis('y', this.vy * DT, w, false);
    if (this.moveAxis('x', this.vx * DT, w, true)) this.vx *= 0.5;
    if (this.moveAxis('z', this.vz * DT, w, true)) this.vz *= 0.5;
  }
}

function onPlate(b, p) {
  if (b.gone) return false;
  const m = b.kind === 'box' ? 0.45 : 0.15, half = 0.65;
  return Math.abs(b.x - p.x) < half + m && Math.abs(b.z - p.z) < half + m && b.y > p.y - 0.2 && b.y < p.y + 0.3;
}

export class World {
  constructor(def) {
    this.def = def;
    this.statics = def.statics.map(s => new Static(s));
    this.doors = (def.doors || []).map(d => new Door(d));
    this.bridges = (def.bridges || []).map(d => new Bridge(d));
    this.scales = (def.scales || []).map(d => new Scale(d));
    this.pans = this.scales.flatMap(s => [s.a, s.b]);
    this.plates = (def.plates || []).map(p => ({ def: p, x: p.p[0], y: p.p[1], z: p.p[2], link: p.link, pressed: false }));
    this.movers = [...this.doors, ...this.bridges, ...this.pans];
    this.linked = [...this.doors, ...this.bridges];
    const g = def.goal;
    this.goalBB = { x0: g[0] - 0.6, x1: g[0] + 0.6, y0: g[1], y1: g[1] + 2.2, z0: g[2] - 0.6, z1: g[2] + 0.6 };
    this.shardTaken = false;
  }

  reset(recs) {
    for (const d of this.linked) d.reset();
    for (const s of this.scales) s.reset();
    for (const p of this.plates) p.pressed = false;
    this.boxes = (this.def.boxes || []).map(b => new Body('box', b.p));
    this.chars = recs.map((r, i) => new Body('char', this.def.spawn, { rec: r, ghostIndex: i }));
    this.player = new Body('char', this.def.spawn, { isPlayer: true });
    this.chars.push(this.player);
    this.bodies = [...this.boxes, ...this.chars];
    this.all = [...this.statics, ...this.movers, ...this.bodies];
    this.tick = 0; this.rec = []; this.events = [];
  }

  isFree(b) {
    const bb = b.aabb();
    for (const s of this.all) { if (s === b || s.gone || s.kind === 'char') continue; if (ov(bb, s.aabb())) return false; }
    return true;
  }

  weightOn(ref, depth = 0) {
    if (depth > 8) return 0;
    let w = 0;
    for (const b of this.bodies) if (!b.gone && b.ground === ref) w += 1 + this.weightOn(b, depth + 1);
    return w;
  }

  pushOut(b, m) {
    const bb = b.aabb(), mb = m.aabb();
    const up = mb.y1 - bb.y0, movedUp = m.y - m.py;
    if (movedUp > 0 && up <= movedUp + 0.3) { b.y = mb.y1; if (b.vy < 0) b.vy = 0; b.ground = m; return; }
    const opts = [['x', mb.x1 - bb.x0], ['x', -(bb.x1 - mb.x0)], ['z', mb.z1 - bb.z0], ['z', -(bb.z1 - mb.z0)], ['y', up]];
    let best = opts[0];
    for (const o of opts) if (Math.abs(o[1]) < Math.abs(best[1])) best = o;
    b[best[0]] += best[1];
  }

  step(input) {
    const ev = this.events;
    for (const m of this.movers) savePrev(m);
    for (const b of this.bodies) savePrev(b);

    const active = new Set();
    for (const p of this.plates) {
      const was = p.pressed;
      p.pressed = this.bodies.some(b => onPlate(b, p));
      if (p.pressed !== was) ev.push({ type: p.pressed ? 'plateOn' : 'plateOff' });
      if (p.pressed) active.add(p.link);
    }
    for (const d of this.linked) {
      const was = d.active; d.active = active.has(d.id);
      if (was !== d.active) ev.push({ type: 'mover', on: d.active, kind: d.kind });
    }
    for (const d of this.doors) d.update(this);
    for (const b of this.bridges) b.update(this);
    for (const s of this.scales) s.update(this);

    for (const b of this.bodies) {
      if (b.gone) continue;
      for (const m of this.movers) if (ov(b.aabb(), m.aabb())) this.pushOut(b, m);
    }
    for (const box of this.boxes) if (!box.gone) box.stepBox(this);
    for (const c of this.chars) {
      if (c.gone) continue;
      const inp = c.isPlayer ? input : (c.rec[this.tick] || IDLE);
      c.stepChar(inp, this);
    }
    this.rec.push(input);
    this.tick++;

    for (const b of this.bodies) if (!b.isPlayer && !b.gone && b.y < -60) b.gone = true;
    const pl = this.player;
    if (pl.jumped) ev.push({ type: 'jump' });
    if (pl.y < FALL_Y) ev.push({ type: 'fell' });
    if (ov(pl.aabb(), this.goalBB)) ev.push({ type: 'win' });
    const sh = this.def.shard;
    if (sh && !this.shardTaken) {
      const bb = pl.aabb(), r = 0.3;
      if (sh[0] > bb.x0 - r && sh[0] < bb.x1 + r && sh[1] > bb.y0 - r && sh[1] < bb.y1 + r && sh[2] > bb.z0 - r && sh[2] < bb.z1 + r) {
        this.shardTaken = true; ev.push({ type: 'shard' });
      }
    }
  }
}
