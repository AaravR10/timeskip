// Level data. Units: characters are 1.2 tall and can jump 1.5.
// P(x, z, width, depth, top, thickness, kind)  -> slab whose top surface is at `top`
// B(cx, cy, cz, sx, sy, sz, kind)              -> box by centre and size

const P = (x, z, w, d, top = 0, th = 1, c = 'floor') => ({ p: [x, top - th / 2, z], s: [w, th, d], c });
const B = (x, y, z, w, h, d, c = 'wall') => ({ p: [x, y, z], s: [w, h, d], c });

// A wall across the level at depth z with a 2-wide doorway at x, from -halfW to +halfW.
function doorWall(z, halfW, id, base = 0, x = 0) {
  const lw = (x - 1) + halfW, rw = halfW - (x + 1);
  const statics = [
    B(-halfW + lw / 2, base + 2.75, z, lw, 7.5, 1),
    B(x + 1 + rw / 2, base + 2.75, z, rw, 7.5, 1),
    B(x, base + 4.75, z, 2, 3.5, 1),
  ];
  return { statics, door: { id, p: [x, base + 1.5, z], s: [2, 3, 0.7], rise: 3.1 } };
}

// Ground around a counterweight lift: a row of slabs leaving holes for pans at x=-2.2 and x=+2.2.
function panRow(z0, z1) {
  const d = z1 - z0, cz = (z0 + z1) / 2;
  return [
    P(-4.725, cz, 2.55, d), P(0, cz, 1.9, d), P(4.725, cz, 2.55, d),
    B(0, 2.6, cz, 0.4, 5.2, 0.4, 'pillar'), // post of the balance
  ];
}

const L1 = (() => {
  const dw = doorWall(-4, 4, 'd1');
  return {
    name: 'Hold the Door', timeskips: 3, spawn: [0, 0, 2.5],
    hint: 'Stand on the plate to open the door, then press R to TIMESKIP. Your past self will keep holding it.',
    statics: [P(0, -4, 8, 16), ...dw.statics],
    doors: [dw.door],
    plates: [{ p: [-2.2, 0, 0.5], link: 'd1' }],
    goal: [0, 0, -9.5], shard: [3, 0.6, -11],
  };
})();

const L2 = {
  name: 'Step Up', timeskips: 2, spawn: [0, 0, 3],
  hint: 'Too high to jump. A past self standing still makes a fine stepping stone.',
  statics: [P(0, 0, 10, 10), B(0, 0.7, -7.5, 10, 3.4, 5, 'cliff')],
  goal: [0, 2.4, -8.5], shard: [-3.8, 3.3, 2],
};

const L3 = (() => {
  const a = doorWall(-4, 4, 'd1'), b = doorWall(-12, 4, 'd2');
  return {
    name: 'Two Locks', timeskips: 2, spawn: [0, 0, 2.5],
    hint: 'Each door needs its own plate held. Past selves can walk through doors other past selves opened.',
    statics: [P(0, -8, 8, 24), ...a.statics, ...b.statics, B(-2.9, 0, -9.5, 1.2, 2, 1.2, 'cliff')],
    doors: [a.door, b.door],
    plates: [{ p: [-2.2, 0, 0.5], link: 'd1' }, { p: [2.2, 0, -8], link: 'd2' }],
    goal: [0, 0, -17], shard: [-2.9, 1.6, -9.5],
  };
})();

const L4 = (() => {
  const a = doorWall(-3, 5, 'd1'), b = doorWall(-7, 5, 'd2');
  return {
    name: 'Dead Weight', timeskips: 1, spawn: [0, 0, 2.8],
    hint: 'Only one timeskip. Boxes hold plates too — walk into one to push it.',
    statics: [P(0, -4, 10, 16), ...a.statics, ...b.statics],
    doors: [a.door, b.door],
    plates: [{ p: [-3.2, 0, -1], link: 'd1' }, { p: [3.2, 0, -1], link: 'd2' }],
    boxes: [{ p: [1.4, 0, 1.6] }],
    goal: [0, 0, -10], shard: [-4, 0.6, -5],
  };
})();

const L5 = {
  name: 'Counterweight', timeskips: 3, spawn: [0, 0, 3],
  hint: 'Weight on the left pan lifts the right one. It takes two of you to lift it all the way.',
  statics: [
    P(0, 0, 12, 10), ...panRow(-7.6, -5),
    P(0, -10.8, 12, 6.4, 4, 0.6, 'deck'),
    B(-5.4, -1, -10.8, 0.7, 9.4, 0.7, 'pillar'), B(5.4, -1, -10.8, 0.7, 9.4, 0.7, 'pillar'),
  ],
  scales: [{ a: [-2.2, -6.3], b: [2.2, -6.3], need: 2, rise: 3 }],
  goal: [0, 4, -11.5], shard: [-4.5, 4.6, -13],
};

const L6 = (() => {
  const dw = doorWall(-4, 5, 'd1');
  return {
    name: 'Relay', timeskips: 2, spawn: [0, 0, 2.5],
    hint: 'One of you holds the door. Another waits on the far side to lend a shoulder.',
    statics: [P(0, -5, 10, 18), ...dw.statics, B(0, 0.7, -16, 10, 3.4, 4, 'cliff')],
    doors: [dw.door],
    plates: [{ p: [-3, 0, 1.5], link: 'd1' }],
    goal: [0, 2.4, -16.8], shard: [4, 1.8, -9],
  };
})();

const L7 = {
  name: 'Drawbridge', timeskips: 2, spawn: [0, 0, 1],
  hint: 'The bridge only stays out while the plate is held. Something over there might help you climb.',
  statics: [P(0, 0, 8, 8), P(0, -16, 8, 8), B(0, 0.6, -18.75, 8, 3.2, 2.5, 'cliff')],
  bridges: [{ id: 'b1', s: [2.4, 0.4, 8], from: [0, -0.25, 0], to: [0, -0.25, -8], speed: 7 }],
  plates: [{ p: [-2.8, 0, 2.8], link: 'b1' }],
  boxes: [{ p: [-2, 0, -14] }],
  goal: [0, 2.2, -19], shard: [3, 0.6, -14.5],
};

const L8 = (() => {
  const dw = doorWall(-11.5, 6, 'd1', 4);
  return {
    name: 'All Together', timeskips: 2, spawn: [0, 0, 3.5],
    hint: 'A lift, a locked door, a box and two timeskips. Plan who does what.',
    statics: [
      P(0, 0, 12, 10), ...panRow(-7.6, -5),
      P(0, -12.3, 12, 9.4, 4, 0.6, 'deck'), ...dw.statics,
      B(-5.4, -1, -12, 0.7, 9.4, 0.7, 'pillar'), B(5.4, -1, -12, 0.7, 9.4, 0.7, 'pillar'),
    ],
    doors: [dw.door],
    scales: [{ a: [-2.2, -6.3], b: [2.2, -6.3], need: 2, rise: 3 }],
    plates: [{ p: [4.4, 0, 2.6], link: 'd1' }],
    boxes: [{ p: [-2.2, 0, -2.6] }],
    goal: [0, 4, -15], shard: [-5, 4.6, -9],
  };
})();

export const LEVELS = [L1, L2, L3, L4, L5, L6, L7, L8];
