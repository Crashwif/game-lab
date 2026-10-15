// Headless tests for the city: run with node --test games/flock-off/*.test.mjs (not part of npm test).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const dir = fileURLToPath(new URL('.', import.meta.url));
async function load(name) {
  const result = await build({ entryPoints: [`${dir}${name}.ts`], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const CITY = await load('city');
const SCRIPT = await load('script');
/** The shared default curve: tenfold every 30 s. */
const x100At = (seconds) => 100 * 10 ** (seconds / 30);
const bot = { aim: null, move: { x: 0, y: 0 }, fire: 0, reload: false, manual: false };
const holstered = { aim: null, move: { x: 0, y: 0 }, fire: 0, reload: false, manual: true };
const muzzle = { x: 334, y: 340 };

/** Rides `seconds` at `hz` from round time `from`, returning every event. */
function ride(world, seconds, { hz = 60, trigger = bot, from = 0, each } = {}) {
  const events = [];
  const frames = Math.round(seconds * hz);
  for (let f = 0; f < frames; f++) {
    const t = from + (f + 1) / hz;
    events.push(...CITY.stepWorld(world, 1 / hz, typeof trigger === 'function' ? trigger(world, t) : trigger, CITY.driveAt(x100At(t), t * 1000), muzzle));
    each?.(world, t);
  }
  return events;
}

test('the city lays cameras ahead, spaced out, from the first segments on', () => {
  let cams = 0;
  for (let seed = 1; seed <= 20; seed++) {
    for (let seconds = 0; seconds <= 150; seconds += 6) {
      const world = CITY.createWorld(seconds * 1000, seed, CITY.driveAt(x100At(seconds), seconds * 1000));
      const mounted = world.cams.filter(c => c.kind !== 'bird').sort((a, b) => a.x - b.x);
      assert.ok(mounted.length >= 2, `seed ${seed} at ${seconds} s lays ${mounted.length} cameras ahead`);
      for (let i = 1; i < mounted.length; i++) assert.ok(mounted[i].x - mounted[i - 1].x >= 100, `cameras ${mounted[i - 1].id} and ${mounted[i].id} are ${mounted[i].x - mounted[i - 1].x} px apart`);
      for (const c of mounted) assert.equal(c.y, CITY.HEAD[c.kind].y);
      cams += mounted.length;
    }
  }
  assert.ok(cams > 1500, `checked ${cams} cameras`);
  // The first camera of a fresh ride is within reach of the first few seconds.
  const fresh = CITY.createWorld(0, 7);
  assert.ok(Math.min(...fresh.cams.map(c => c.x)) < 900);
});

test('the aimbot deflocks most of the city, misses its lazy ones, and never shoots a camera behind him', () => {
  for (const seed of [1, 2, 3, 0x5a5a5a]) {
    const world = CITY.createWorld(0, seed);
    const events = ride(world, 90);
    assert.ok(world.deflocked > 40, `seed ${seed}: ${world.deflocked} deflocked`);
    assert.ok(world.seen >= 1, 'the free trial still looks at its phone now and then');
    assert.ok(world.seen / (world.seen + world.deflocked) < 0.25, `seed ${seed}: read by ${world.seen} of ${world.seen + world.deflocked}`);
    assert.ok(world.landed / world.shots > 0.6, `seed ${seed}: ${world.landed} of ${world.shots} shots landed`);
    for (const e of events) if (e.type === 'hit') assert.ok(e.x >= muzzle.x, 'hits land ahead of the muzzle');
    assert.ok(events.some(e => e.type === 'reload'), 'the magazine runs out and reloads');
  }
});

test('a gun nobody fires gets read by every camera, costs nothing but a streak, and keeps memory flat for ten minutes', () => {
  const world = CITY.createWorld(0, 9);
  let reads = 0;
  const events = ride(world, 600, {
    trigger: holstered, each: (w) => {
      assert.ok(w.cams.length <= 60 && w.holes.length <= 24, 'the course stays bounded');
      assert.equal(w.ammo, CITY.MAG);
    },
  });
  for (const e of events) if (e.type === 'read') reads++;
  assert.equal(world.deflocked, 0);
  assert.equal(world.shots, 0);
  assert.ok(reads > 300 && reads === world.seen, `${reads} reads over ten minutes`);
  assert.ok(world.streak === 0 && world.distance > 150_000);
  // Reads lunge the cruisers for a moment and fade.
  assert.ok(world.alert >= 0 && world.alert <= 1.4);
});

test('the closed-form distance matches riding at 30, 60 and 144 Hz', () => {
  for (const hz of [30, 60, 144]) {
    const world = CITY.createWorld(0, 4);
    ride(world, 120, { hz, trigger: holstered });
    const expected = CITY.rideDistance(120);
    assert.ok(Math.abs(world.distance - expected) / expected < 0.012, `${hz} Hz: ${world.distance.toFixed(0)} vs ${expected.toFixed(0)}`);
  }
  assert.equal(CITY.rideDistance(0), 0);
  assert.ok(CITY.rideDistance(1) > 0 && CITY.rideDistance(1) < CITY.BASE_SPEED);
});

test('a late arrival finds nothing live at the kerb and hears no cue for what already passed', () => {
  for (const seconds of [20, 60, 150]) {
    const drive = CITY.driveAt(x100At(seconds), seconds * 1000);
    const world = CITY.createWorld(seconds * 1000, 11, drive);
    for (const c of world.cams) if (c.kind !== 'bird' && CITY.camScreen(c, world).x < CITY.RIDER_X + 40) assert.ok(c.state === 'read' && c.age >= 9);
    assert.equal(world.seen, 0, 'a fresh arcade score');
    const events = CITY.stepWorld(world, 1 / 60, holstered, drive, muzzle);
    assert.ok(!events.some(e => e.type === 'read'), 'no read cue on the first frame');
    assert.ok(world.cams.some(c => c.state === 'live' && CITY.camScreen(c, world).x > CITY.RIDER_X + 40), 'and something to shoot ahead');
  }
});

test('a shot within a camera\'s radius kills it, a wide shot leaves a hole, a trailer takes three, and an empty magazine reloads', () => {
  const world = CITY.createWorld(0, 3);
  world.cams = [];
  world.seg = 1e9;
  const drive = CITY.driveAt(100, 5000);
  const place = (kind, x) => { const c = { id: world.cams.length + 1, kind, seg: 0, x: world.distance + x, y: CITY.HEAD[kind].y, r: CITY.HEAD[kind].r, hp: CITY.HEAD[kind].hp, hits: 0, state: 'live', age: 0, variant: 0.5, vx: 0, t0: 0, lazy: false }; world.cams.push(c); return c; };
  const pole = place('pole', 300);
  const p = CITY.camScreen(pole, world);
  world.aim = { x: p.x + pole.r - 1, y: p.y };
  let events = CITY.stepWorld(world, 1 / 60, { ...holstered, fire: 1 }, drive, muzzle);
  assert.ok(events.some(e => e.type === 'hit' && e.killed && e.id === pole.id));
  assert.equal(pole.state, 'dead');
  assert.equal(world.deflocked, 1);
  assert.equal(world.ammo, CITY.MAG - 1);
  // A wide shot.
  world.aim = { x: 700, y: 120 };
  world.cooldown = 0;
  events = CITY.stepWorld(world, 1 / 60, { ...holstered, fire: 1 }, drive, muzzle);
  assert.ok(events.some(e => e.type === 'miss'));
  assert.equal(world.holes.length, 1);
  // A trailer takes three.
  const trailer = place('trailer', 320);
  for (let k = 0; k < 3; k++) {
    const q = CITY.camScreen(trailer, world);
    world.aim = { x: q.x, y: q.y };
    world.cooldown = 0;
    events = CITY.stepWorld(world, 1 / 60, { ...holstered, fire: 1 }, drive, muzzle);
    assert.ok(events.some(e => e.type === 'hit' && e.killed === (k === 2)));
  }
  assert.equal(trailer.state, 'dead');
  // The rest of the magazine, then the reload.
  while (world.ammo > 0) { world.cooldown = 0; CITY.stepWorld(world, 1 / 60, { ...holstered, fire: 1 }, drive, muzzle); }
  assert.ok(world.reloading > 0);
  events = CITY.stepWorld(world, 1 / 60, { ...holstered, fire: 1 }, drive, muzzle);
  assert.ok(events.some(e => e.type === 'empty'));
  for (let k = 0; k < 70; k++) CITY.stepWorld(world, 1 / 60, holstered, drive, muzzle);
  assert.equal(world.ammo, CITY.MAG);
  // A camera that passes unshot reads him and resets the streak.
  const late = place('lamp', -100);
  world.streak = 4;
  events = CITY.stepWorld(world, 1 / 60, holstered, drive, muzzle);
  assert.ok(events.some(e => e.type === 'read' && e.id === late.id));
  assert.equal(world.streak, 0);
  assert.equal(world.seen, 1);
});

test('the bunny hop is a bounded, continuous function of distance over the potholes', () => {
  let hops = 0;
  let last = 0;
  for (let d = 0; d < 60_000; d += 1) {
    const { h } = CITY.hopAt(d, 5);
    assert.ok(h >= 0 && h <= CITY.HOP_HEIGHT);
    assert.ok(Math.abs(h - last) < 2, `the hop jumps ${Math.abs(h - last).toFixed(2)} px at ${d}`);
    if (h > 0 && last === 0) hops++;
    last = h;
  }
  assert.ok(hops > 40, `${hops} hops in 60,000 px`);
  // The scenery is a pure function of the segment.
  assert.deepEqual(CITY.lotFor(12, 5), CITY.lotFor(12, 5));
  assert.notDeepEqual(CITY.lotFor(12, 5), CITY.lotFor(12, 6));
});

test('the ladder, the overtime lines and the Nextdoor feed never run out', () => {
  let previous = -1;
  for (let x = 1; x < 1e6; x *= 1.05) {
    const n = SCRIPT.lineIndex(x);
    assert.ok(n >= previous, 'the line index never goes backwards');
    assert.ok(typeof SCRIPT.lineAt(n).text === 'string' && SCRIPT.lineAt(n).text.length > 0);
    previous = n;
  }
  assert.ok(previous > SCRIPT.LINES.length + 10, 'long rounds keep getting lines');
  const posts = new Set();
  for (let n = 0; n < 600; n++) posts.add(SCRIPT.feedPost(n));
  assert.ok(posts.size > 150, `${posts.size} distinct posts in 600`);
  assert.ok(SCRIPT.charges(0).length >= 4 && SCRIPT.charges(12).some(c => c.includes('FIRST DEGREE')));
});
