// Level data. Units: characters are 1.2 tall and can jump 1.5.
// P(x, z, width, depth, top, thickness, kind)  -> slab whose top surface is at `top`
// B(cx, cy, cz, sx, sy, sz, kind)              -> box by centre and size
// Plates link to doors / lifts / lasers by id. Doors: mode 'all' needs every plate
// with that id held; invert:true closes while held. Lasers switch OFF while held
// (or ON with invert). Movers with loop:seconds shuttle forever.

const P = (x, z, w, d, top = 0, th = 1, c = 'floor') => ({ p: [x, top - th / 2, z], s: [w, th, d], c });
const B = (x, y, z, w, h, d, c = 'wall') => ({ p: [x, y, z], s: [w, h, d], c });

// A wall across the level at depth z with a 2-wide doorway at x, from -halfW to +halfW.
function doorWall(z, halfW, id, base = 0, extra = {}, x = 0) {
  const lw = (x - 1) + halfW, rw = halfW - (x + 1);
  return {
    statics: [
      B(-halfW + lw / 2, base + 2.75, z, lw, 7.5, 1),
      B(x + 1 + rw / 2, base + 2.75, z, rw, 7.5, 1),
      B(x, base + 4.75, z, 2, 3.5, 1),
    ],
    door: { id, p: [x, base + 1.5, z], s: [2, 3, 0.7], rise: 3.1, ...extra },
  };
}
// A laser fence across the level at depth z, with emitter posts at both ends.
function laserFence(z, halfW, id, extra = {}, base = 0) {
  return {
    statics: [B(-halfW + 0.15, base + 2.3, z, 0.3, 4.6, 0.5, 'post'), B(halfW - 0.15, base + 2.3, z, 0.3, 4.6, 0.5, 'post')],
    laser: { id, p: [0, base + 2.25, z], s: [2 * halfW - 0.6, 4.5, 0.24], ...extra },
  };
}
// A row of fragile tiles heading toward -z from zStart.
function fragRow(x, zStart, n, w = 1.6, top = 0) {
  return Array.from({ length: n }, (_, i) => ({ p: [x, top - 0.2, zStart - 0.6 - i * 1.2], s: [w, 0.4, 1.2] }));
}
// Ground around a counterweight lift: slabs leaving holes for pans at x=-2.2 and x=+2.2, plus the post.
function panRow(z0, z1) {
  const d = z1 - z0, cz = (z0 + z1) / 2;
  return [P(-4.725, cz, 2.55, d), P(0, cz, 1.9, d), P(4.725, cz, 2.55, d), B(0, 2.6, cz, 0.4, 5.2, 0.4, 'pillar')];
}
const pillars = (z, x = 5.4, top = 3.4) => [B(-x, (top - 6) / 2, z, 0.7, top + 6, 0.7, 'pillar'), B(x, (top - 6) / 2, z, 0.7, top + 6, 0.7, 'pillar')];
const merge = (...parts) => {
  const o = { statics: [], doors: [], lasers: [] };
  for (const p of parts) { if (p.statics) o.statics.push(...p.statics); if (p.door) o.doors.push(p.door); if (p.laser) o.lasers.push(p.laser); }
  return o;
};

/* ---------------- Chapter 1: Echoes ---------------- */

const holdTheDoor = (() => {
  const m = merge(doorWall(-4, 4, 'd1'));
  return {
    name: 'Hold the Door', timeskips: 3, spawn: [0, 0, 2.5],
    hint: 'Stand on the plate to open the door, then press R to TIMESKIP. Your past self will keep holding it.',
    statics: [P(0, -4, 8, 16), ...m.statics], doors: m.doors,
    plates: [{ p: [-2.2, 0, 0.5], link: 'd1' }],
    goal: [0, 0, -9.5], shard: [3, 0.6, -11],
  };
})();

const stepUp = {
  name: 'Step Up', timeskips: 2, spawn: [0, 0, 3],
  hint: 'Too high to jump. A past self standing still makes a fine stepping stone.',
  statics: [P(0, 0, 10, 10), B(0, 0.7, -7.5, 10, 3.4, 5, 'cliff')],
  goal: [0, 2.4, -8.5], shard: [-3.8, 3.3, 2],
};

const twoLocks = (() => {
  const m = merge(doorWall(-4, 4, 'd1'), doorWall(-12, 4, 'd2'));
  return {
    name: 'Two Locks', timeskips: 2, spawn: [0, 0, 2.5],
    hint: 'Each door needs its own plate held. Past selves can walk through doors other past selves opened.',
    statics: [P(0, -8, 8, 24), ...m.statics, B(-2.9, 0, -9.5, 1.2, 2, 1.2, 'cliff')], doors: m.doors,
    plates: [{ p: [-2.2, 0, 0.5], link: 'd1' }, { p: [2.2, 0, -8], link: 'd2' }],
    goal: [0, 0, -17], shard: [-2.9, 1.6, -9.5],
  };
})();

const deadWeight = (() => {
  const m = merge(doorWall(-3, 5, 'd1'), doorWall(-7, 5, 'd2'));
  return {
    name: 'Dead Weight', timeskips: 1, spawn: [0, 0, 2.8],
    hint: 'Only one timeskip. Boxes hold plates too: walk into one to push it.',
    statics: [P(0, -4, 10, 16), ...m.statics], doors: m.doors,
    plates: [{ p: [-3.2, 0, -1], link: 'd1' }, { p: [3.2, 0, -1], link: 'd2' }],
    boxes: [{ p: [1.4, 0, 1.6] }],
    goal: [0, 0, -10], shard: [-4, 0.6, -5],
  };
})();

const liftOff = {
  name: 'Lift Off', timeskips: 1, spawn: [0, 0, 3],
  hint: 'Lifts only move while their plate is held. No rush: a past self can wait before stepping on.',
  statics: [P(0, 0, 10, 10), P(0, -10.8, 10, 6.4, 4, 0.6, 'deck'), ...pillars(-10.8, 4.6)],
  bridges: [{ id: 'l1', s: [2.4, 0.4, 2.4], from: [0, -0.2, -6.3], to: [0, 3.8, -6.3], speed: 3 }],
  plates: [{ p: [3, 0, 2], link: 'l1' }],
  goal: [0, 4, -11.5], shard: [4, 4.6, -13],
};

const relay = (() => {
  const m = merge(doorWall(-4, 5, 'd1'));
  return {
    name: 'Relay', timeskips: 2, spawn: [0, 0, 2.5],
    hint: 'One of you holds the door. Another waits on the far side to lend a shoulder.',
    statics: [P(0, -5, 10, 18), ...m.statics, B(0, 0.7, -16, 10, 3.4, 4, 'cliff')], doors: m.doors,
    plates: [{ p: [-3, 0, 1.5], link: 'd1' }],
    goal: [0, 2.4, -16.8], shard: [4, 1.8, -9],
  };
})();

/* ---------------- Chapter 2: Circuits ---------------- */

const liveWire = (() => {
  const m = merge(laserFence(-4, 4, 'z1'));
  return {
    name: 'Live Wire', timeskips: 2, spawn: [0, 0, 2.5],
    hint: 'Lasers are deadly. This one switches off while its plate is held.',
    statics: [P(0, -6, 8, 20), ...m.statics], lasers: m.lasers,
    plates: [{ p: [-2.5, 0, 0.5], link: 'z1' }],
    goal: [0, 0, -12], shard: [3, 0.6, -13],
  };
})();

const doubleSeal = (() => {
  const m = merge(doorWall(-6, 6, 'd1', 0, { mode: 'all' }));
  return {
    name: 'Double Seal', timeskips: 2, spawn: [0, 0, 2.5],
    hint: 'A door marked ×2 needs both of its plates held at the same time.',
    statics: [P(0, -5, 12, 18), ...m.statics], doors: m.doors,
    plates: [{ p: [-4, 0, 0], link: 'd1' }, { p: [4, 0, 0], link: 'd1' }],
    goal: [0, 0, -11], shard: [-5, 0.6, -12],
  };
})();

const crateAndClone = (() => {
  const m = merge(doorWall(-6, 6, 'd1', 0, { mode: 'all' }));
  return {
    name: 'Crate & Clone', timeskips: 1, spawn: [0, 0, 2.5],
    hint: 'Same seal, one timeskip. Something else will have to help.',
    statics: [P(0, -5, 12, 18), ...m.statics], doors: m.doors,
    plates: [{ p: [-4, 0, -1], link: 'd1' }, { p: [4, 0, -1], link: 'd1' }],
    boxes: [{ p: [1.5, 0, 2.5] }],
    goal: [0, 0, -11], shard: [5, 0.6, -12],
  };
})();

const drawbridge = {
  name: 'Drawbridge', timeskips: 2, spawn: [0, 0, 1],
  hint: 'The bridge only stays out while the plate is held. Something over there might help you climb.',
  statics: [P(0, 0, 8, 8), P(0, -16, 8, 8), B(0, 0.6, -18.75, 8, 3.2, 2.5, 'cliff')],
  bridges: [{ id: 'b1', s: [2.4, 0.4, 8], from: [0, -0.25, 0], to: [0, -0.25, -8], speed: 7 }],
  plates: [{ p: [-2.8, 0, 2.8], link: 'b1' }],
  boxes: [{ p: [-2, 0, -14] }],
  goal: [0, 2.2, -19], shard: [3, 0.6, -14.5],
};

const inverted = (() => {
  const m = merge(doorWall(-4, 5, 'd1'), doorWall(-10, 5, 'd1', 0, { invert: true }));
  return {
    name: 'Inverted', timeskips: 1, spawn: [0, 0, 2.5],
    hint: 'Blue doors do the opposite: they shut while their plate is held. Your past self can step off, too.',
    statics: [P(0, -8, 10, 24), ...m.statics], doors: m.doors,
    plates: [{ p: [-3, 0, 1.5], link: 'd1' }],
    goal: [0, 0, -16], shard: [4, 0.6, -7],
  };
})();

const counterweight = {
  name: 'Counterweight', timeskips: 3, spawn: [0, 0, 3],
  hint: 'Weight on the left pan lifts the right one. It takes two of you to lift it all the way.',
  statics: [P(0, 0, 12, 10), ...panRow(-7.6, -5), P(0, -10.8, 12, 6.4, 4, 0.6, 'deck'), ...pillars(-10.8)],
  scales: [{ a: [-2.2, -6.3], b: [2.2, -6.3], need: 2, rise: 3 }],
  goal: [0, 4, -11.5], shard: [-4.5, 4.6, -13],
};

/* ---------------- Chapter 3: Motion ---------------- */

const humanLadder = {
  name: 'Human Ladder', timeskips: 2, spawn: [0, 0, 3],
  hint: 'Two ledges, two shoulders. Build a staircase out of yourself.',
  statics: [P(0, 0, 10, 10), B(0, 0.7, -7.5, 10, 3.4, 5, 'cliff'), B(0, 1.9, -12.5, 10, 5.8, 5, 'cliff')],
  goal: [0, 4.8, -13.5], shard: [4, 3.0, -6],
};

const ferry = (() => {
  const m = merge(doorWall(-15, 4, 'd1'));
  return {
    name: 'Ferry', timeskips: 1, spawn: [0, 0, 1.5],
    hint: 'The ferry runs on its own schedule. Board when it docks.',
    statics: [P(0, 0, 8, 8), P(0, -16, 8, 8), ...m.statics], doors: m.doors,
    bridges: [{ s: [2.4, 0.4, 2.4], from: [0, -0.2, -5.3], to: [0, -0.2, -10.7], loop: 6 }],
    plates: [{ p: [-2.8, 0, 2.5], link: 'd1' }],
    goal: [0, 0, -18], shard: [3, 0.6, -13],
  };
})();

const hotSeat = (() => {
  const m = merge(laserFence(-3, 4, 'd1', { invert: true }), doorWall(-12, 4, 'd1'));
  return {
    name: 'Hot Seat', timeskips: 1, spawn: [0, 0, 2],
    hint: 'This laser is wired backwards: the plate that opens the door switches it ON.',
    statics: [P(0, -8, 8, 24), ...m.statics], doors: m.doors, lasers: m.lasers,
    plates: [{ p: [-2.5, 0, 1.8], link: 'd1' }],
    goal: [0, 0, -17], shard: [3, 0.6, -7],
  };
})();

const allTogether = (() => {
  const m = merge(doorWall(-11.5, 6, 'd1', 4));
  return {
    name: 'All Together', timeskips: 2, spawn: [0, 0, 3.5],
    hint: 'A lift, a locked door, a box and two timeskips. Plan who does what.',
    statics: [P(0, 0, 12, 10), ...panRow(-7.6, -5), P(0, -12.3, 12, 9.4, 4, 0.6, 'deck'), ...m.statics, ...pillars(-12)],
    doors: m.doors,
    scales: [{ a: [-2.2, -6.3], b: [2.2, -6.3], need: 2, rise: 3 }],
    plates: [{ p: [4.4, 0, 2.6], link: 'd1' }],
    boxes: [{ p: [-2.2, 0, -2.6] }],
    goal: [0, 4, -15], shard: [-5, 4.6, -9],
  };
})();

const heavyLoad = {
  name: 'Heavy Load', timeskips: 2, spawn: [0, 0, 3.5],
  hint: 'This counterweight needs three. You only get two timeskips.',
  statics: [P(0, 0, 12, 10), ...panRow(-7.6, -5), P(0, -10.8, 12, 6.4, 4, 0.6, 'deck'), ...pillars(-10.8)],
  scales: [{ a: [-2.2, -6.3], b: [2.2, -6.3], need: 3, rise: 3 }],
  boxes: [{ p: [-2.2, 0, -2.6] }],
  goal: [0, 4, -11.5], shard: [4.5, 4.6, -13],
};

/* ---------------- Chapter 4: Crumble ---------------- */

const burningBridges = (() => {
  const m = merge(doorWall(4, 4, 'd1'));
  return {
    name: 'Burning Bridges', timeskips: 1, spawn: [0, 0, 1.5],
    hint: 'Glass tiles crumble once everyone has stepped off them. The goal is behind you.',
    statics: [P(0, 2, 8, 12), P(0, -13, 6, 6), ...m.statics], doors: m.doors,
    fragile: fragRow(0, -4, 5),
    plates: [{ p: [0, 0, -13], link: 'd1' }],
    goal: [0, 0, 6.5], shard: [2, 0.6, -15],
  };
})();

const singleFile = (() => {
  const m = merge(doorWall(-15, 4, 'd1'));
  return {
    name: 'Single File', timeskips: 1, spawn: [0, 0, 2],
    hint: 'The glass only survives one crossing. Stay close behind.',
    statics: [P(0, 0, 8, 8), P(0, -15, 8, 8), ...m.statics], doors: m.doors,
    fragile: fragRow(0, -4, 6),
    plates: [{ p: [-2.5, 0, -12.5], link: 'd1' }],
    goal: [0, 0, -17.5], shard: [3, 0.6, -17.5],
  };
})();

const noWayBack = (() => {
  const m = merge(doorWall(4, 4, 'd1'), laserFence(-3.6, 4, 'z1'));
  return {
    name: 'No Way Back', timeskips: 2, spawn: [0, 0, 1.5],
    hint: 'Someone has to cross the glass, and someone has to let them.',
    statics: [P(0, 2, 8, 12), P(0, -13, 6, 6), ...m.statics], doors: m.doors, lasers: m.lasers,
    fragile: fragRow(0, -4, 5),
    plates: [{ p: [-2.8, 0, 1], link: 'z1' }, { p: [0, 0, -13], link: 'd1' }],
    goal: [0, 0, 6.5], shard: [-2, 0.6, -15],
  };
})();

const stepping = {
  name: 'Stepping Stones', timeskips: 1, spawn: [0, 0, 2.5],
  hint: 'The far ledge is too high, and the glass will not wait for you.',
  statics: [P(0, 0, 8, 8), P(0, -14, 8, 6), B(0, 0.7, -16, 8, 3.4, 2, 'cliff')],
  fragile: fragRow(0, -4, 6, 2.4),
  goal: [0, 2.4, -16.5], shard: [-3, 1.8, -12],
};

/* ---------------- Chapter 5: Mastery ---------------- */

const skyGate = (() => {
  const m = merge(laserFence(-9.6, 5, 'z1', {}, 4));
  return {
    name: 'Sky Gate', timeskips: 2, spawn: [0, 0, 3],
    hint: 'Up the lift, through the laser. Two plates down here, and only you can be up there.',
    statics: [P(0, 0, 10, 10), P(0, -10.8, 10, 6.4, 4, 0.6, 'deck'), ...pillars(-10.8, 4.6), ...m.statics], lasers: m.lasers,
    bridges: [{ id: 'l1', s: [2.4, 0.4, 2.4], from: [0, -0.2, -6.3], to: [0, 3.8, -6.3], speed: 3 }],
    plates: [{ p: [3.5, 0, 3], link: 'l1' }, { p: [-3.5, 0, 3], link: 'z1' }],
    goal: [0, 4, -12], shard: [-4, 4.6, -8.5],
  };
})();

const clockwork = (() => {
  const m = merge(doorWall(-27, 4, 'd1'));
  return {
    name: 'Clockwork', timeskips: 1, spawn: [0, 0, 1.5],
    hint: 'Two ferries, out of step with each other. Mind the timetable.',
    statics: [P(0, 0, 8, 8), P(0, -14, 6, 4), P(0, -28, 8, 10), ...m.statics], doors: m.doors,
    bridges: [
      { s: [2.4, 0.4, 2.4], from: [0, -0.2, -5.3], to: [0, -0.2, -10.7], loop: 5 },
      { s: [2.4, 0.4, 2.4], from: [0, -0.2, -17.3], to: [0, -0.2, -21.7], loop: 4, phase: 0.5 },
    ],
    plates: [{ p: [-2.8, 0, 2.5], link: 'd1' }],
    goal: [0, 0, -30], shard: [2.4, 0.6, -14],
  };
})();

const laserMaze = (() => {
  const m = merge(laserFence(-3, 4, 'a'), laserFence(-9, 4, 'b'), laserFence(-14, 4, 'c'));
  return {
    name: 'Laser Maze', timeskips: 2, spawn: [0, 0, 1],
    hint: 'Three lasers, three plates, one crate. One plate sits between the fences.',
    statics: [P(0, -10, 8, 28), ...m.statics], lasers: m.lasers,
    plates: [{ p: [-2.8, 0, 1.5], link: 'a' }, { p: [2.8, 0, 1.5], link: 'b' }, { p: [2.5, 0, -6.5], link: 'c' }],
    boxes: [{ p: [-1, 0, 2.5] }],
    goal: [0, 0, -20], shard: [-3, 0.6, -11.5],
  };
})();

const pressurePoints = (() => {
  const m = merge(doorWall(-6, 6, 'd1', 0, { mode: 'all' }));
  return {
    name: 'Pressure Points', timeskips: 2, spawn: [0, 0, 3.2],
    hint: 'Three plates, one door. Count your helpers.',
    statics: [P(0, -5, 12, 18), ...m.statics], doors: m.doors,
    plates: [{ p: [-4, 0, -1], link: 'd1' }, { p: [4, 0, -1], link: 'd1' }, { p: [0, 0, -3], link: 'd1' }],
    boxes: [{ p: [0, 0, 1.2] }],
    goal: [0, 0, -11], shard: [-5, 0.6, 3],
  };
})();

const shoulders = {
  name: 'Shoulders to the Sky', timeskips: 2, spawn: [0, 0, 3],
  hint: 'The lift takes two. Ride up together, then climb.',
  statics: [P(0, 0, 10, 10), P(0, -10.8, 10, 6.4, 4, 0.6, 'deck'), ...pillars(-10.8, 4.6), B(0, 4.9, -12.75, 10, 3, 2.5, 'cliff')],
  bridges: [{ id: 'l1', s: [2.4, 0.4, 2.4], from: [0, -0.2, -6.3], to: [0, 3.8, -6.3], speed: 3 }],
  plates: [{ p: [3.5, 0, 3], link: 'l1' }],
  goal: [0, 6.4, -13], shard: [-4, 5.2, -8.5],
};

const finale = (() => {
  const m = merge(laserFence(-9.4, 6, 'z1', {}, 4));
  return {
    name: 'Finale', timeskips: 3, spawn: [0, 0, 3.5],
    hint: 'Everything you have learned. Three timeskips, three plates of work.',
    statics: [P(0, 0, 12, 10), ...panRow(-7.6, -5), P(0, -11.3, 12, 7.4, 4, 0.6, 'deck'), ...pillars(-11.5), ...m.statics],
    lasers: m.lasers,
    scales: [{ a: [-2.2, -6.3], b: [2.2, -6.3], need: 3, rise: 3 }],
    plates: [{ p: [4.4, 0, 2.6], link: 'z1' }],
    boxes: [{ p: [-2.2, 0, -2.6] }],
    goal: [0, 4, -13], shard: [5, 4.6, -14],
  };
})();

export const CHAPTERS = [
  { name: 'Echoes', levels: [holdTheDoor, stepUp, twoLocks, deadWeight, liftOff, relay] },
  { name: 'Circuits', levels: [liveWire, doubleSeal, crateAndClone, drawbridge, inverted, counterweight] },
  { name: 'Motion', levels: [humanLadder, ferry, hotSeat, allTogether, heavyLoad] },
  { name: 'Crumble', levels: [burningBridges, singleFile, noWayBack, stepping] },
  { name: 'Mastery', levels: [skyGate, clockwork, laserMaze, pressurePoints, shoulders, finale] },
];
export const LEVELS = CHAPTERS.flatMap((c, ci) => c.levels.map(l => Object.assign(l, { chapter: ci })));
