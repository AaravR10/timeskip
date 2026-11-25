import { World, IDLE } from '../js/sim.js';
import { LEVELS } from '../js/levels.js';

// Tiny scripted "bot" that produces inputs, so we can check every level is solvable.
//  {to:[x,z], j, tol}  walk there (j: jump at the start)   {wait:n}  idle n ticks
//  {ground:1} wait until standing                           {until: w => bool}
//  {end:1} stop this run (it becomes a clone)
function play(world, script, maxTicks = 3600) {
  let i = 0, waitN = 0;
  const p = world.player, evs = [];
  script = script.map(a => ({ ...a }));
  for (let t = 0; t < maxTicks; t++) {
    let input = IDLE;
    for (;;) {
      const a = script[i];
      if (!a) break;
      if (a.end) return { rec: world.rec, evs, t };
      if (a.wait != null) { if (waitN++ >= a.wait) { i++; waitN = 0; continue; } break; }
      if (a.ground) { if (p.ground) { i++; continue; } break; }
      if (a.until) { if (a.until(world)) { i++; continue; } break; }
      if (a.to) {
        const dx = a.to[0] - p.x, dz = a.to[1] - p.z, d = Math.hypot(dx, dz);
        if (d < (a.tol ?? 0.08)) { i++; continue; }
        const s = Math.min(1, d / 0.35) / d;
        input = [Math.round(dx * s * 1000) / 1000, Math.round(dz * s * 1000) / 1000, a.j && !a._j ? 1 : 0]; a._j = true;
        break;
      }
      i++;
    }
    world.step(input);
    for (const e of world.events) evs.push({ type: e.type, t });
    world.events.length = 0;
    if (evs.some(e => e.type === 'win')) return { rec: world.rec, evs, t, win: true };
    if (evs.some(e => e.type === 'fell')) return { rec: world.rec, evs, t, fell: true };
    if (evs.some(e => e.type === 'zap')) return { rec: world.rec, evs, t, zap: true };
  }
  return { rec: world.rec, evs, t: maxTicks };
}

const br = i => w => w.bridges[i].u;
const heavyR1 = [{ to: [-2.2, -1.8] }, { to: [-2.2, -5.5] }, { to: [-3.1, -5.5] }, { to: [-3.05, -7.2], tol: 0.15 }, { wait: 10 }, { end: 1 }];
const heavyR2 = [{ to: [-1.3, -4.5] }, { to: [-1.3, -7.1], tol: 0.2 }, { wait: 10 }, { end: 1 }];

const S = {
  'Hold the Door': [
    [{ to: [-2.2, 0.5] }, { wait: 30 }, { end: 1 }],
    [{ wait: 50 }, { to: [0, -2] }, { to: [0, -9.5] }, { wait: 30 }],
  ],
  'Step Up': [
    [{ to: [0, -4.5] }, { wait: 20 }, { end: 1 }],
    [{ wait: 60 }, { to: [0, -3.0] }, { to: [0, -4.5], j: 1, tol: 0.15 }, { ground: 1 }, { wait: 5 }, { to: [0, -7], j: 1 }, { ground: 1 }, { to: [0, -8.5] }, { wait: 30 }],
  ],
  'Two Locks': [
    [{ to: [-2.2, 0.5] }, { wait: 10 }, { end: 1 }],
    [{ wait: 40 }, { to: [0, -2] }, { to: [0, -6] }, { to: [2.2, -8] }, { wait: 10 }, { end: 1 }],
    [{ wait: 140 }, { to: [0, -2] }, { to: [0, -6] }, { to: [0, -10] }, { to: [0, -17] }, { wait: 30 }],
  ],
  'Dead Weight': [
    [{ to: [-3.2, -1] }, { wait: 10 }, { end: 1 }],
    [{ to: [0.5, 1.6] }, { to: [2.4, 1.6] }, { to: [2.4, 2.7] }, { to: [3.2, 2.7] }, { to: [3.2, -0.2] }, { to: [0, -0.2] }, { to: [0, -10] }, { wait: 30 }],
  ],
  'Lift Off': [
    [{ wait: 180 }, { to: [3, 2] }, { wait: 10 }, { end: 1 }],
    [{ to: [0, -4.6] }, { to: [0, -6.3] }, { until: w => br(0)(w) > 0.99 }, { to: [0, -9] }, { to: [0, -11.5] }, { wait: 30 }],
  ],
  'Relay': [
    [{ to: [-3, 1.5] }, { wait: 10 }, { end: 1 }],
    [{ wait: 45 }, { to: [0, -2] }, { to: [0, -6] }, { to: [0, -13.4] }, { wait: 10 }, { end: 1 }],
    [{ wait: 200 }, { to: [0, -2] }, { to: [0, -11.8] }, { to: [0, -13.4], j: 1, tol: 0.2 }, { ground: 1 }, { wait: 5 }, { to: [0, -15.5], j: 1 }, { ground: 1 }, { to: [0, -16.8] }, { wait: 30 }],
  ],
  'Live Wire': [
    [{ to: [-2.5, 0.5] }, { wait: 10 }, { end: 1 }],
    [{ wait: 40 }, { to: [0, -2] }, { to: [0, -12] }, { wait: 30 }],
  ],
  'Double Seal': [
    [{ to: [-4, 0] }, { wait: 10 }, { end: 1 }],
    [{ to: [4, 0] }, { wait: 10 }, { end: 1 }],
    [{ wait: 60 }, { to: [0, -3] }, { to: [0, -11] }, { wait: 30 }],
  ],
  'Crate & Clone': [
    [{ to: [-4, -1] }, { wait: 10 }, { end: 1 }],
    [{ to: [0.7, 2.5] }, { to: [3.2, 2.5] }, { to: [3.2, 3.5] }, { to: [4, 3.5] }, { to: [4, -0.2] }, { to: [0, -0.2] }, { to: [0, -3] }, { to: [0, -11] }, { wait: 30 }],
  ],
  'Drawbridge': [
    [{ to: [-2.8, 2.8] }, { wait: 10 }, { end: 1 }],
    [{ wait: 80 }, { to: [0, -3] }, { to: [0, -12.5] }, { to: [-2, -12.8] }, { to: [-2, -16.2] }, { to: [-2, -15.4] }, { to: [-2, -17], j: 1, tol: 0.2 }, { ground: 1 }, { wait: 5 }, { to: [-2, -18.6], j: 1 }, { ground: 1 }, { to: [0, -19] }, { wait: 30 }],
  ],
  'Inverted': [
    [{ to: [-3, 1.5] }, { wait: 180 }, { to: [2, 1.5] }, { wait: 10 }, { end: 1 }],
    [{ wait: 30 }, { to: [0, -2] }, { to: [0, -7] }, { wait: 240 }, { to: [0, -16] }, { wait: 30 }],
  ],
  'Counterweight': [
    [{ to: [-2.2, -4.4] }, { to: [-2.2, -6.6] }, { wait: 10 }, { end: 1 }],
    [{ to: [-2.2, -4.4] }, { to: [-1.8, -5.8] }, { wait: 10 }, { end: 1 }],
    [{ to: [2.2, -4.4] }, { to: [2.2, -6.3] }, { wait: 200 }, { to: [2.2, -9], j: 1 }, { ground: 1 }, { to: [0, -11.5] }, { wait: 30 }],
  ],
  'Human Ladder': [
    [{ to: [0, -4.5] }, { wait: 20 }, { end: 1 }],
    [{ wait: 60 }, { to: [0, -3.0] }, { to: [0, -4.5], j: 1, tol: 0.15 }, { ground: 1 }, { wait: 5 }, { to: [0, -7], j: 1 }, { ground: 1 }, { to: [0, -9.5] }, { wait: 10 }, { end: 1 }],
    [{ wait: 300 }, { to: [0, -3.0] }, { to: [0, -4.5], j: 1, tol: 0.15 }, { ground: 1 }, { wait: 5 }, { to: [0, -7], j: 1 }, { ground: 1 }, { to: [0, -8.0] }, { to: [0, -9.5], j: 1, tol: 0.15 }, { ground: 1 }, { wait: 5 }, { to: [0, -12], j: 1 }, { ground: 1 }, { to: [0, -13.5] }, { wait: 30 }],
  ],
  'Ferry': [
    [{ to: [-2.8, 2.5] }, { wait: 10 }, { end: 1 }],
    [{ to: [0, -3.7] }, { until: w => br(0)(w) < 0.01 }, { to: [0, -5.2] }, { until: w => br(0)(w) > 0.99 }, { to: [0, -12.6] }, { to: [0, -18] }, { wait: 30 }],
  ],
  'Hot Seat': [
    [{ wait: 150 }, { to: [-2.5, 1.8] }, { wait: 10 }, { end: 1 }],
    [{ to: [0, -8] }, { to: [0, -10.5] }, { wait: 200 }, { to: [0, -17] }, { wait: 30 }],
  ],
  'All Together': [
    [{ to: [4.4, 2.6] }, { wait: 10 }, { end: 1 }],
    [{ to: [-2.2, -1.8] }, { to: [-2.2, -5.5] }, { to: [-2.6, -6.9], tol: 0.2 }, { wait: 10 }, { end: 1 }],
    [{ to: [2.2, -4.4] }, { to: [2.2, -6.3], j: 1, tol: 0.15 }, { ground: 1 }, { wait: 150 }, { to: [2.2, -9], j: 1 }, { ground: 1 }, { to: [0, -10] }, { to: [0, -15] }, { wait: 30 }],
  ],
  'Heavy Load': [
    heavyR1, heavyR2,
    [{ to: [2.2, -4.4] }, { to: [2.2, -6.3], j: 1, tol: 0.15 }, { ground: 1 }, { wait: 200 }, { to: [2.2, -9], j: 1 }, { ground: 1 }, { to: [0, -11.5] }, { wait: 30 }],
  ],
  'Burning Bridges': [
    [{ to: [0, -3.6] }, { to: [0, -13] }, { wait: 10 }, { end: 1 }],
    [{ wait: 200 }, { to: [0, 3] }, { to: [0, 6.5] }, { wait: 30 }],
  ],
  'Single File': [
    [{ to: [0, -3.6] }, { to: [0, -11.6] }, { to: [-2.5, -12.5] }, { wait: 10 }, { end: 1 }],
    [{ wait: 12 }, { to: [0, -3.6] }, { to: [0, -11.6] }, { to: [0, -13.8] }, { to: [0, -17.5] }, { wait: 30 }],
  ],
  'No Way Back': [
    [{ to: [-2.8, 1] }, { wait: 10 }, { end: 1 }],
    [{ wait: 30 }, { to: [0, -3.0] }, { to: [0, -13] }, { wait: 10 }, { end: 1 }],
    [{ wait: 250 }, { to: [0, 3] }, { to: [0, 6.5] }, { wait: 30 }],
  ],
  'Stepping Stones': [
    [{ to: [0, -3.6] }, { to: [0, -14.5] }, { wait: 10 }, { end: 1 }],
    [{ wait: 12 }, { to: [0, -3.6] }, { to: [0, -13.0] }, { wait: 30 }, { to: [0, -14.5], j: 1, tol: 0.15 }, { ground: 1 }, { wait: 5 }, { to: [0, -16], j: 1 }, { ground: 1 }, { to: [0, -16.5] }, { wait: 30 }],
  ],
  'Sky Gate': [
    [{ to: [-3.5, 3] }, { wait: 10 }, { end: 1 }],
    [{ wait: 200 }, { to: [3.5, 3] }, { wait: 10 }, { end: 1 }],
    [{ to: [0, -4.6] }, { to: [0, -6.3] }, { until: w => br(0)(w) > 0.99 }, { to: [0, -9] }, { to: [0, -12] }, { wait: 30 }],
  ],
  'Clockwork': [
    [{ to: [-2.8, 2.5] }, { wait: 10 }, { end: 1 }],
    [{ to: [0, -3.7] }, { until: w => br(0)(w) < 0.01 }, { to: [0, -5.2] }, { until: w => br(0)(w) > 0.99 }, { to: [0, -12.6] }, { to: [0, -15.5] },
     { until: w => br(1)(w) < 0.01 }, { to: [0, -17.0] }, { until: w => br(1)(w) > 0.99 }, { to: [0, -23.6] }, { to: [0, -30] }, { wait: 30 }],
  ],
  'Laser Maze': [
    [{ to: [-0.2, 2.5] }, { to: [-2.0, 2.5] }, { to: [-2.0, 3.3] }, { to: [-2.8, 3.3] }, { to: [-2.8, 2.3] }, { to: [2.8, 2.3] }, { to: [2.8, 1.5] }, { wait: 10 }, { end: 1 }],
    [{ wait: 300 }, { to: [0, -1] }, { to: [0, -6.5] }, { to: [2.5, -6.5] }, { wait: 10 }, { end: 1 }],
    [{ wait: 450 }, { to: [0, -1] }, { to: [0, -20] }, { wait: 30 }],
  ],
  'Pressure Points': [
    [{ to: [-4, -1] }, { wait: 10 }, { end: 1 }],
    [{ to: [4, -1] }, { wait: 10 }, { end: 1 }],
    [{ to: [0, 2.0] }, { to: [0, -2.2] }, { to: [1.6, -2.2] }, { to: [1.6, -4.6] }, { to: [0, -4.6] }, { to: [0, -11] }, { wait: 30 }],
  ],
  'Shoulders to the Sky': [
    [{ wait: 240 }, { to: [3.5, 3] }, { wait: 10 }, { end: 1 }],
    [{ to: [0, -4.6] }, { to: [-0.6, -6.3] }, { until: w => br(0)(w) > 0.99 }, { to: [-0.6, -9] }, { to: [0, -11.2] }, { wait: 10 }, { end: 1 }],
    [{ to: [0.6, -4.6] }, { to: [0.6, -6.3] }, { until: w => br(0)(w) > 0.99 }, { wait: 60 }, { to: [0.6, -9.0] }, { to: [0, -9.6] }, { to: [0, -11.2], j: 1, tol: 0.15 }, { ground: 1 }, { wait: 5 }, { to: [0, -12.8], j: 1 }, { ground: 1 }, { to: [0, -13] }, { wait: 30 }],
  ],
  'Finale': [
    heavyR1, heavyR2,
    [{ to: [4.4, 2.6] }, { wait: 10 }, { end: 1 }],
    [{ to: [2.2, -4.4] }, { to: [2.2, -6.3], j: 1, tol: 0.15 }, { ground: 1 }, { wait: 300 }, { to: [2.2, -9], j: 1 }, { ground: 1 }, { to: [0, -13] }, { wait: 30 }],
  ],
};

let ok = true;
const byName = n => LEVELS.find(l => l.name === n);
function solve(def, runs) {
  const world = new World(def);
  const recs = [];
  let res;
  runs.forEach((script, ri) => { world.reset(recs.slice()); res = play(world, script); if (ri < runs.length - 1) recs.push(res.rec); });
  return { res, world };
}
LEVELS.forEach((def, li) => {
  const runs = S[def.name];
  if (!runs) { console.log(`L${li + 1} ${def.name}: NO SOLUTION SCRIPT`); ok = false; return; }
  const { res, world } = solve(def, runs);
  const pass = res.win && runs.length - 1 <= def.timeskips;
  if (!pass) ok = false;
  const pl = world.player;
  const why = res.fell ? ' FELL' : res.zap ? ' ZAPPED' : '';
  const paused = world.ghosts.reduce((a, g) => a + g.delay, 0);
  console.log(`${String(li + 1).padStart(2)} ${def.name.padEnd(22)} ${pass ? 'PASS' : 'FAIL'} runs=${runs.length}/${def.timeskips + 1} t=${res.t}${paused ? ' clonePause=' + paused : ''} end=(${pl.x.toFixed(1)},${pl.y.toFixed(1)},${pl.z.toFixed(1)})${why}`);
});

// Shortcuts that must NOT work
const neg = (label, name, runs) => {
  const { res } = solve(byName(name), runs);
  console.log(`  no-shortcut ${label}: ${res.win ? 'SOLVABLE (bad)' : 'blocked (good)'}`);
  if (res.win) ok = false;
};
console.log('Shortcut checks:');
neg('Step Up alone', 'Step Up', [[{ to: [0, -4.5], j: 1 }, { ground: 1 }, { to: [0, -7], j: 1 }, { ground: 1 }, { to: [0, -8.5] }, { wait: 30 }]]);
neg('Counterweight alone', 'Counterweight', [[{ to: [2.2, -4.4] }, { to: [2.2, -6.3] }, { wait: 200 }, { to: [2.2, -9], j: 1 }, { ground: 1 }, { to: [0, -11.5] }, { wait: 30 }]]);
neg('Counterweight one clone', 'Counterweight', [S['Counterweight'][0], S['Counterweight'][2]]);
neg('Live Wire run through', 'Live Wire', [[{ to: [-2.5, 0.5] }, { to: [0, -2] }, { to: [0, -12] }, { wait: 30 }]]);
neg('Hot Seat alone', 'Hot Seat', [[{ to: [-2.5, 1.8] }, { wait: 30 }, { to: [0, -10.5] }, { to: [0, -17] }, { wait: 30 }]]);
neg('Inverted alone', 'Inverted', [[{ to: [-3, 1.5] }, { wait: 40 }, { to: [0, -2] }, { to: [0, -16] }, { wait: 30 }]]);
neg('Burning Bridges alone', 'Burning Bridges', [[{ to: [0, -3.6] }, { to: [0, -13] }, { wait: 30 }, { to: [0, -3] }, { to: [0, 6.5] }, { wait: 30 }]]);
neg('Heavy Load box + 1 clone', 'Heavy Load', [heavyR1, S['Heavy Load'][2]]);
neg('Stepping Stones clone crosses first', 'Stepping Stones', [S['Stepping Stones'][0], [{ wait: 300 }, ...S['Stepping Stones'][1].slice(1)]]);

// Determinism: replaying a recording alone reproduces it exactly
{
  const def = byName('All Together');
  const w = new World(def); w.reset([]);
  const r = play(w, S['All Together'][1]);
  const w2 = new World(def); w2.reset([]);
  play(w2, S['All Together'][1]);
  const w3 = new World(def); w3.reset([r.rec]);
  for (let t = 0; t < r.rec.inputs.length; t++) w3.step(IDLE);
  const g = w3.ghosts[0];
  const same = g.x === w2.player.x && g.y === w2.player.y && g.z === w2.player.z;
  console.log('Determinism:', same ? 'exact' : 'DIFF');
  if (!same) ok = false;
}

// Pause-and-resume: block a clone mid-path, then step aside; it must end exactly where an undisturbed replay ends
{
  const def = byName('Hold the Door');
  const w = new World(def); w.reset([]);
  const r1 = play(w, [{ to: [-2.2, 0.5] }, { to: [-2.2, -2.5] }, { to: [2, -2.5] }, { wait: 10 }, { end: 1 }]);
  w.reset([r1.rec]); play(w, [{ to: [3.5, 3.5] }, { wait: 1200 }, { end: 1 }]);
  const want = [w.ghosts[0].x, w.ghosts[0].y, w.ghosts[0].z];
  w.reset([r1.rec]);
  const r2 = play(w, [{ to: [0.5, -1.0] }, { to: [0, -2.5] }, { wait: 150 }, { to: [0, -0.8] }, { to: [1, 1.5] }, { wait: 400 }, { end: 1 }]);
  const g = w.ghosts[0];
  const exact = g.x === want[0] && g.y === want[1] && g.z === want[2];
  console.log(`Pause/resume: delay=${g.delay} ticks, end ${exact ? 'exact' : 'OFF'}`);
  if (!exact || g.delay < 30) ok = false;
  const d2 = g.delay, want2 = [w.player.x, w.player.z];
  w.reset([r1.rec, r2.rec]);
  play(w, [{ wait: 1200 }, { end: 1 }]);
  const [a, b] = w.ghosts;
  const same = a.delay === d2 && a.x === want[0] && a.z === want[2] && b.x === want2[0] && b.z === want2[1];
  console.log(`Replay consistency: clone1 delay=${a.delay} (was ${d2}), ${same ? 'identical' : 'DIVERGED'}`);
  if (!same) ok = false;
}
console.log(ok ? '\nALL OK' : '\nFAILURES');
process.exit(ok ? 0 : 1);
