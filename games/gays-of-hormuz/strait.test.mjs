// Headless tests for the strait: run with node --test games/gays-of-hormuz/*.test.mjs (not part of npm test).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const dir = fileURLToPath(new URL('.', import.meta.url));
async function load(name) {
  const result = await build({ entryPoints: [`${dir}${name}.ts`], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const S = await load('strait');
/** The shared default curve: tenfold every 30 s. */
const x100At = (seconds) => 100 * 10 ** (seconds / 30);
const mate = { steer: 0, target: null, manual: false };
const hold = { steer: 0, target: null, manual: true };

/** Sails `seconds` at `hz` from round time `from`, returning every event. */
function sail(world, seconds, { hz = 60, helm = mate, from = 0, each } = {}) {
  const events = [];
  const frames = Math.round(seconds * hz);
  for (let f = 0; f < frames; f++) {
    const t = from + (f + 1) / hz;
    events.push(...S.stepWorld(world, 1 / hz, typeof helm === 'function' ? helm(world, t) : helm, S.driveAt(x100At(t), t * 1000)));
    each?.(world, t);
  }
  return events;
}

/** A world with nothing on the water and no rows left to lay, for staging one hazard at a time. */
function empty(depth = 0.5) {
  const world = S.createWorld(0, 1);
  world.hazards = [];
  world.pickups = [];
  world.row = 1e9;
  world.depth = depth;
  world.speed = 200;
  return world;
}
const cruise = { speed: 200, heat: 0.5, deep: 0.1, x: 2 };

test('every row leaves the helm a clear depth, and homing rows stay light', () => {
  let rows = 0;
  for (let seed = 1; seed <= 24; seed++) {
    for (let seconds = 0; seconds <= 150; seconds += 6) {
      const world = S.createWorld(seconds * 1000, seed, S.driveAt(x100At(seconds), seconds * 1000));
      const byRow = new Map();
      for (const h of world.hazards) byRow.set(h.row, [...(byRow.get(h.row) ?? []), h]);
      for (const [row, hazards] of byRow) {
        rows++;
        assert.ok(hazards.length <= 3, `row ${row} lays at most three hazards`);
        if (hazards.some(h => h.homing)) assert.ok(hazards.length <= 2, 'homing drones and boats only arrive in light rows');
        assert.ok(new Set(hazards.map(h => h.contact)).size === 1, 'a row meets the hull all at once');
        let clear = 0;
        for (let c = S.DEPTH_MIN; c <= S.DEPTH_MAX; c += 0.005) if (hazards.every(h => Math.abs(c - h.d) >= S.BEAM + S.RADIUS[h.kind])) clear += 0.005;
        assert.ok(clear >= 0.15, `seed ${seed} row ${row} leaves ${clear.toFixed(3)} of the lane clear`);
      }
    }
  }
  assert.ok(rows > 500, `checked ${rows} rows`);
});

test('the first mate dodges most of the strait and picks up castaways on the way', () => {
  for (const seed of [1, 2, 3, 0x5a5a5a]) {
    const world = S.createWorld(0, seed);
    sail(world, 90);
    const rate = world.hits / Math.max(1, world.hits + world.dodged);
    assert.ok(world.dodged > 100, `seed ${seed}: ${world.dodged} dodged`);
    assert.ok(rate < 0.12, `seed ${seed}: the first mate is hit by ${(rate * 100).toFixed(1)}% of hazards`);
    assert.ok(world.hits >= 1, 'the first mate still looks at their phone now and then');
    assert.ok(world.rescued > 10, `seed ${seed}: ${world.rescued} castaways rescued`);
  }
});

test('a ship that never steers is hit again and again, sails on, and keeps memory flat for ten minutes', () => {
  const world = S.createWorld(0, 9);
  const kinds = new Set();
  let before = 0;
  sail(world, 600, {
    helm: hold, each: (w) => {
      assert.ok(w.distance >= before, 'the voyage never goes backwards');
      before = w.distance;
      assert.ok(w.hazards.length <= 80 && w.pickups.length <= 40 && w.overboard.length <= 14 && w.scars.length <= 5, 'arrays stay capped');
    },
  }).forEach(e => { if (e.type === 'hit') kinds.add(e.kind); });
  assert.ok(world.hits > 20, `held course, she was hit ${world.hits} times`);
  assert.deepEqual([...kinds].sort(), ['boat', 'drone', 'mine', 'missile'], 'every kind of hazard can land');
  assert.ok(world.distance > 0.6 * S.straitDistance(600), 'hits slow the ship but never stop the voyage');
  assert.ok(world.guests >= 0 && Number.isFinite(world.depth) && Number.isFinite(world.speed));
  assert.ok(world.hazards.some(h => h.state === 'live'), 'the strait keeps throwing things past ten minutes');
});

test('speed follows the multiplier, and the closed-form distance matches sailing at any frame rate', () => {
  assert.equal(S.sailSpeed(1), S.BASE_SPEED);
  assert.ok(Math.abs(S.sailSpeed(2) - 246.5) < 1);
  assert.equal(S.sailSpeed(100), S.TOP_SPEED);
  const distances = [];
  for (const hz of [30, 60, 144]) {
    const world = S.createWorld(0, 4);
    // Nothing to hit, so the only drag on the ship is its engines answering the drive.
    sail(world, 60, { hz, helm: hold, each: (w) => { w.hazards = []; } });
    distances.push(world.distance);
    const expected = S.straitDistance(60);
    assert.ok(Math.abs(world.distance - expected) / expected < 0.03, `${hz} Hz: sailed ${world.distance.toFixed(0)}, closed form ${expected.toFixed(0)}`);
  }
  assert.ok(Math.max(...distances) - Math.min(...distances) < distances[0] * 0.005, 'frame rate does not change the voyage');
});

test('a late arrival finds nothing live at the hull, no launch cues to replay and a fresh score', () => {
  const late = S.createWorld(150_000, 7, S.driveAt(x100At(150), 150_000));
  assert.ok(Math.abs(late.distance - S.straitDistance(150)) < 1e-6);
  assert.equal(late.guests + late.dodged + late.hits + late.rescued, 0);
  for (const h of late.hazards) {
    if (h.contact < late.distance + 420) assert.notEqual(h.state, 'live', 'anything already at the hull is history');
    if (h.kind === 'missile' && S.strikeProgress(h, late.distance) > 0) assert.equal(h.announced, true, 'missiles already in the air make no launch sound');
  }
  const events = sail(late, 1 / 60, { from: 150 });
  assert.ok(!events.some(e => e.type === 'hit'), 'the first frame never lands a hit');
  assert.ok(late.hazards.length > 0 && late.hazards.length <= 80);
});

test('a missile takes aim where the ship is at launch: holding course is a hit, a turn of the wheel is a miss, the disco shield bounces it', () => {
  const missile = (world) => ({
    id: 1, kind: 'missile', row: 0, contact: world.distance + 700, x: world.distance + 700, d: 0.9, home: 0.9, at: 0, lead: 820,
    homing: false, state: 'live', age: 0, variant: 0.5, announced: false, warned: false, ignored: false,
  });
  const run = (world, helm) => {
    const h = missile(world);
    world.hazards.push(h);
    const events = [];
    for (let f = 0; f < 600 && h.state === 'live'; f++) events.push(...S.stepWorld(world, 1 / 60, helm, cruise));
    return { h, events };
  };
  const held = empty(0.3);
  const steady = run(held, hold);
  assert.ok(steady.events.some(e => e.type === 'launch'), 'it launches from the coast');
  assert.ok(Math.abs(steady.h.d - 0.3) < 0.05, 'the battery aims at the ship');
  assert.equal(steady.h.state, 'hit');
  assert.equal(held.hits, 1);
  assert.ok(held.shaken > 0, 'a hit slows the ship for a moment');

  const dodging = empty(0.3);
  const turned = run(dodging, (() => { let n = 0; return { get steer() { return n++ > 30 ? 1 : 0; }, target: null, manual: true }; })());
  assert.equal(turned.h.state, 'miss');
  assert.ok(turned.events.some(e => e.type === 'miss'), 'it splashes into the sea');

  const shielded = empty(0.3);
  shielded.shield = 30;
  assert.equal(run(shielded, hold).h.state, 'blocked');
  assert.equal(shielded.hits, 0);
});

test('a homing drone follows the ship until it commits, so a late turn still clears it', () => {
  const world = empty(0.5);
  const drone = {
    id: 2, kind: 'drone', row: 0, contact: world.distance + 900, x: world.distance + 900, d: 0.3, home: 0.3, at: 0, lead: 1000,
    homing: true, state: 'live', age: 0, variant: 0.2, announced: false, warned: false, ignored: false,
  };
  world.hazards.push(drone);
  let committedAt = null;
  let lastDepth = drone.d;
  for (let f = 0; f < 900 && drone.state === 'live'; f++) {
    const rem = drone.contact - world.distance;
    // Sit at 0.5 until the drone has come over, then turn hard to starboard in the last 0.9 s.
    const helm = rem / world.speed < 0.9 ? { steer: 1, target: null, manual: true } : hold;
    S.stepWorld(world, 1 / 60, helm, cruise);
    if (rem / world.speed <= S.COMMIT_S && committedAt === null) committedAt = drone.d;
    if (committedAt !== null) assert.ok(Math.abs(drone.d - committedAt) < 1e-9, 'a committed drone holds its line');
    else assert.ok(drone.d >= lastDepth - 1e-9, 'before committing it only closes on the ship');
    lastDepth = drone.d;
  }
  assert.ok(committedAt !== null && committedAt > 0.45, `it followed the ship to ${committedAt?.toFixed(2)}`);
  assert.equal(drone.state, 'miss', 'the late turn cleared it');
});

test('castaways come aboard once, and a hit sends a share of the guests overboard onto floaties', () => {
  const world = empty(0.5);
  world.pickups.push({ id: 3, kind: 'guest', contact: world.distance + 40, x: world.distance + 200, d: 0.5, count: 3, variant: 0.1, taken: false, missed: false, age: 0 });
  const events = [];
  for (let f = 0; f < 120; f++) events.push(...S.stepWorld(world, 1 / 60, hold, cruise));
  assert.equal(events.filter(e => e.type === 'rescue').length, 1);
  assert.equal(world.guests, 3);
  world.hazards.push({
    id: 4, kind: 'mine', row: 0, contact: world.distance + 30, x: world.distance + 190, d: 0.5, home: 0.5, at: 0, lead: 1,
    homing: false, state: 'live', age: 0, variant: 0, announced: false, warned: false, ignored: false,
  });
  for (let f = 0; f < 60; f++) events.push(...S.stepWorld(world, 1 / 60, hold, cruise));
  const hit = events.find(e => e.type === 'hit');
  assert.equal(hit?.lost, 1, 'a fifth of the guests, at least one, goes over');
  assert.equal(world.guests, 2);
  assert.equal(world.overboard.length, 1);
  assert.equal(world.scars.length, 1, 'the hull keeps a scorch mark');
});
