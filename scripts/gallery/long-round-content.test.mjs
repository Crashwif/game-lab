import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { build } from 'esbuild';
import { free } from '@crashwif/crash-math';
import { ROOT } from './pack.mjs';

// Exercise the real presentation controllers without a browser, audio context or selected crash outcome.
// Use the PR 238 room curve through 180 s (1,000,000×), plus a held-multiplier case for ongoing ambient action.
const DT = 1 / 60;
const modules = new Map();
function controller(source) {
  if (!modules.has(source)) modules.set(source, (async () => {
    const output = await build({ entryPoints: [join(ROOT, 'games', `${source}.ts`)], bundle: true, platform: 'node', format: 'esm', write: false });
    return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
  })());
  return modules.get(source);
}
function advance(seconds, step, holdAt = Infinity) {
  for (let frame = 0; frame < seconds * 60; frame += 1) {
    const time = frame * DT;
    const multiplier = Math.min(holdAt, free.multiplierAtContinuousX100(time * 1000, free.DEFAULT_CURVE) / 100);
    step({ running: true, multiplier, tension: Math.min(1, Math.log2(multiplier) / 3.3), time, off: false }, DT);
  }
}

for (const [name, source, create, step, leave, settle] of [
  ['Family Meeting', 'family-meeting/kitchen', 'createKitchen', 'stepKitchen', 'sayLeaving', 'settleKitchen'],
  ['Thanksgiving Uncle', 'thanksgiving-uncle/room', 'createRoom', 'stepRoom', 'sayGrace', 'settleRoom'],
]) {
  test(`${name} keeps exchanging readable lines after two minutes, then stops on accepted cashout`, async () => {
    const api = await controller(source);
    const state = api[create]();
    const lateLines = new Set();
    advance(180, (drive, dt) => {
      api[step](state, drive, dt);
      if (drive.time > 120 && state.events.line) lateLines.add(state.events.line.text);
      assert.ok(state.bubbles.length <= 8, 'old speech bubbles must be retired');
    });
    assert.ok(lateLines.size >= 6, 'the last minute needs more than a repeated final line');
    api[leave](state);
    advance(20, (drive, dt) => {
      api[step](state, { ...drive, multiplier: 100_000, tension: 1 }, dt);
      assert.ok(!state.events.line || state.events.line.at === 0, 'only the accepted cashout choreography may speak after leaving');
    });
    // A late join skips the spent ladder but still has ongoing content.
    const late = api[create]();
    api[settle](late, 100_000, 1, false);
    let freshLines = 0;
    advance(20, (drive, dt) => {
      api[step](late, { ...drive, multiplier: 100_000, tension: 1 }, dt);
      if (late.events.line) freshLines += 1;
    });
    assert.ok(freshLines >= 2);
  });
}

test('Honeypot keeps its phone and visiting auditor active with a bounded swarm', async () => {
  const api = await controller('honeypot/picnic');
  const picnic = api.createPicnic();
  let lateTexts = 0, lateVisits = 0;
  advance(180, (drive, dt) => {
    api.stepPicnic(picnic, { ...drive, level: 0.95 }, dt);
    if (drive.time > 120 && picnic.events.msg) lateTexts += 1;
    if (drive.time > 120 && picnic.events.stamp) lateVisits += 1;
    assert.ok(picnic.bees.length <= 32 && picnic.drops.length <= 32);
  });
  assert.ok(lateTexts >= 5 && lateVisits >= 2, 'long rounds need recurring visual events');
  api.trapPicnic(picnic, true, false);
  advance(20, (drive, dt) => {
    api.stepPicnic(picnic, { ...drive, running: false, multiplier: 100_000, level: 0.95 }, dt);
    assert.equal(picnic.events.msg, false);
    assert.equal(picnic.events.stamp, false);
  });
});

test('Hopium Drip supplies additional doses and replacement IV bags after the original tray', async () => {
  const monitorApi = await controller('hopium-drip/monitor');
  const wardApi = await controller('hopium-drip/ward');
  const monitor = monitorApi.createMonitor(), ward = wardApi.createWard();
  let lateDoses = 0, lateFill = 0;
  advance(180, (drive, dt) => {
    if (monitorApi.stepMonitor(monitor, drive, dt)) {
      wardApi.dose(ward, monitor.doseIndex);
      if (drive.time > 120) lateDoses += 1;
    }
    wardApi.stepWard(ward, drive, dt);
    if (drive.time > 120) lateFill = Math.max(lateFill, ward.level.x);
    assert.ok(Number.isFinite(monitor.bpm.x) && Number.isFinite(monitor.fill.x));
    assert.ok(ward.drops.length < 24 && ward.petals.length <= 24);
  });
  assert.ok(lateDoses >= 2 && lateFill > 0.7, 'the late round needs fresh bags, not an empty drip');
  assert.ok(monitor.goal > 1_000_000 && monitor.doseIndex < 32, 'dose work grows logarithmically on the three-minute curve');
  assert.ok(monitor.samples.length <= 320, 'the heart trace must remain a fixed ring buffer');
  monitorApi.flatlineMonitor(monitor, 10_000_000, true);
  advance(20, (drive, dt) => assert.equal(monitorApi.stepMonitor(monitor, { ...drive, running: false, multiplier: 100_000 }, dt), false));
});

test('Moon Boys keeps camera gags varied and spaces repeated wink cues', async () => {
  const api = await controller('moon-boys/world');
  const world = api.createWorld();
  const late = new Set();
  let winks = 0;
  advance(180, (drive, dt) => {
    api.stepWorld(world, drive.multiplier, true, dt);
    for (const event of world.events) {
      if (event === 'wink') winks += 1;
      if (drive.time > 120 && ['mic', 'bird', 'glove'].includes(event)) late.add(event);
    }
    assert.ok(world.sweat.length < 32);
  });
  assert.equal(late.size, 3, 'all three crew mishaps should remain in the late rotation');
  assert.ok(winks >= 3 && winks <= 20, 'the moon must not retrigger a ding every animation cycle');
  api.snapWires(world);
  advance(20, (_drive, dt) => {
    api.stepWorld(world, 100_000, false, dt);
    assert.deepEqual(world.events, []);
  });
});

test('Bull Run varies its movement through the last minute without losing finite rig positions', async () => {
  const api = await controller('bull-run/bull');
  const bull = api.createBull();
  let left = Infinity, right = -Infinity;
  advance(180, (drive, dt) => {
    api.stepBull(bull, { ...drive, loose: false, seconds: drive.time }, dt);
    for (const value of [bull.x.x, bull.pitch.x, bull.hop, bull.kick]) assert.ok(Number.isFinite(value));
    if (drive.time > 120) { left = Math.min(left, bull.x.x); right = Math.max(right, bull.x.x); }
  });
  assert.ok(right - left > 60, 'the late ride must include travelling bucks');
});

for (const [name, source, obstacles] of [['Rug Rails', 'rug-rails/course', 'obstacles'], ['Up Only', 'up-only/sky', 'candles']]) {
  test(`${name} continues generating a bounded course for three minutes at high multipliers`, async () => {
    const api = await controller(source);
    const world = api.createWorld(42);
    let atTwoMinutes = 0;
    advance(180, (drive, dt) => {
      api.stepWorld(world, api.autopilot(world, dt), drive, dt);
      if (drive.time < 120) atTwoMinutes = world.distance;
      assert.ok(Number.isFinite(world.distance));
      assert.ok(world[obstacles].length < 100 && world.pickups.length < 200, 'offscreen course objects must be removed');
    });
    assert.ok(world.distance > atTwoMinutes * 1.2, 'the course must still be moving after two minutes');
    assert.ok(world[obstacles].length > 0 && world.pickups.length > 0, 'new course content must still be present');
  });
}

test('ambient long-round action continues when the displayed multiplier holds at 100000×', async () => {
  const api = await controller('family-meeting/kitchen');
  const state = api.createKitchen();
  let heldLines = 0;
  advance(180, (drive, dt) => {
    api.stepKitchen(state, drive, dt);
    if (drive.time > 150 && state.events.line) heldLines += 1;
    assert.ok(state.bubbles.length <= 8);
  }, 100_000);
  assert.ok(heldLines >= 4, 'a held display must not exhaust dialogue');
});
