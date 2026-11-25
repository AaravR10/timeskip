# Timeskip

A small 3D puzzle game about cooperating with your own past selves. Every time you **timeskip**, the level rewinds, and the run you just played replays as a coloured clone. Use clones to hold pressure plates and open doors, to stand still as stepping stones, and to add weight to a counterweight lift.

27 levels in 5 chapters. Mechanics: pressure plates, doors (including plate pairs that must all be held and blue doors that work in reverse), pushable crates, lifts, ferries on a timetable, laser fences, counterweights and glass tiles that crumble.

If you block a clone's path it pauses with a ❚❚ icon. Once you move, it carries on along its exact recorded route, just later. The HUD shows how far behind each clone is.

Plain HTML/CSS/JS with [three.js](https://threejs.org) included in `vendor/`. There's no build step and no CDN dependency.

## Play locally

ES modules don't load from `file://`, so serve the folder:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to GitHub Pages

1. Push this folder's contents to the root of a repository (or a `/docs` folder).
2. In the repo, open **Settings → Pages**, set **Source** to *Deploy from a branch*, then pick your branch and `/ (root)` (or `/docs`).
3. The game will be live at `https://<user>.github.io/<repo>/` within a minute.

`.nojekyll` is included so GitHub serves the files as-is.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | WASD / arrow keys | left joystick |
| Jump | Space | JUMP |
| Look | drag mouse, Q / E | drag on screen |
| Zoom | mouse wheel | — |
| Timeskip (rewind, current run becomes a clone) | R | SKIP |
| Retry this run (keeps clones) | T | ↺ |
| Menu | Esc | ❚❚ |
| Show hint / toggle sound | H / M | — |

## How it works

- `js/sim.js` is a deterministic fixed-step (60 Hz) simulation with its own AABB physics. Clones don't replay positions. They replay your recorded *inputs* through the same simulation, so they push boxes, ride lifts and stand on each other exactly as you did.
- Each clone has its own replay clock. If it runs into something that wasn't there when it was recorded (you, a later clone, a crate you moved, or an earlier clone that's running late), it pauses for that tick instead of being knocked off course. Because the rule is deterministic, the same pauses happen again on every later run.
- `js/levels.js` holds the level data, grouped into `CHAPTERS`. `P()` makes a slab and `B()` makes a box. `doorWall()`, `laserFence()` and `fragRow()` build the bigger pieces. Plates link to doors, lifts and lasers by `id`. Door options are `mode: 'all'` and `invert: true`, and movers take `loop: seconds`. A `scale` is a counterweight lift: weight on pan `a` raises pan `b`.
- `js/game.js` has the rendering, UI, input, sound (Web Audio synth) and saved progress (`localStorage`).

### Adding a level

Add an object to a chapter in `CHAPTERS` in `js/levels.js`:

```js
{
  name: 'My Level', timeskips: 2, spawn: [0, 0, 3],
  hint: 'Shown at the bottom of the screen.',
  statics: [P(0, 0, 10, 10)],                 // floor slab 10x10 with its top at y=0
  plates:  [{ p: [2, 0, 0], link: 'd1' }],
  doors:   [/* see doorWall() helper */],
  goal: [0, 0, -4],                            // teal exit pillar
  shard: [3, 1, -3],                           // optional collectible "core"
}
```

Characters are 1.2 units tall and jump 1.5. Standing on a clone's head gets you to 2.7.

## Tests

`tests/solve.mjs` plays a scripted solution for every level through the real simulation, checks that the obvious shortcuts fail, and checks that clone pause-and-resume is exact. Run it with Node 18+:

```sh
node --experimental-default-type=module tests/solve.mjs   # or add {"type":"module"} to a package.json
```
