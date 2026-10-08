import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { ROOT } from './pack.mjs';

const loaded = new Map();
async function moduleFor(path) {
  if (!loaded.has(path)) loaded.set(path, (async () => {
    const out = await build({ absWorkingDir: ROOT, entryPoints: [`games/${path}.ts`], bundle: true, format: 'esm', platform: 'node', write: false });
    return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
  })());
  return loaded.get(path);
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (actual, expected, tolerance = 1e-6) => assert(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('Bull rider keeps two fixed bones and world rope contact through 180 seconds of spring-driven bucking', async () => {
  const m = await moduleFor('bull-run/bull');
  for (const fps of [30, 60, 120]) {
    const b = m.createBull(), r = m.createRider();
    for (let frame = 0; frame < 180 * fps; frame++) {
      const seconds = frame / fps, tension = Math.min(1, seconds / 30);
      m.stepBull(b, { running: true, tension, loose: false, seconds }, 1 / fps);
      m.stepRider(r, b, tension, 1 / fps, []);
      const a = m.riderGrip(r, b), c = Math.cos(r.lean.x), s = Math.sin(r.lean.x);
      near(distance(a.shoulder, a.elbow), 34); near(distance(a.elbow, a.hand), 38);
      near(distance({ x: r.x + a.hand.x * c - a.hand.y * s, y: r.y + a.hand.x * s + a.hand.y * c }, m.ropeGrip(b)), 0);
    }
    m.vault(r, b); assert.equal(r.mode, 'vaulting');
  }
});

test('Curl muscle cannot cover the jaw even at full growth and spring overshoot', async () => {
  const m = await moduleFor('bonding-curl/curler'), c = m.createCurler();
  for (let f = 0; f <= 180 * 60; f++) {
    const seconds = f / 60, multiplier = 10 ** (seconds / 30), growth = Math.log2(multiplier);
    m.stepCurler(c, { running: true, multiplier, growth, tension: Math.min(1, growth / 3.3), seconds }, 1 / 60);
    const muscle = m.bicepGeometry(c);
    assert(muscle.centre.y - muscle.ry >= 256, 'muscle crosses the jaw clearance');
    assert(muscle.centre.x + muscle.rx < 790, 'growth leaves the acting area');
  }
});

test('Curl forearm stops at the bicep in its way and closes in on it without snapping back', async () => {
  const m = await moduleFor('bonding-curl/curler');
  for (const fps of [30, 144]) {
    const c = m.createCurler();
    let previous = null;
    for (let f = 0; f <= 60 * fps; f++) {
      const seconds = f / fps, multiplier = 10 ** (seconds / 30);
      m.stepCurler(c, { running: true, multiplier, growth: Math.log2(multiplier), tension: 1 - 1 / multiplier, seconds }, 1 / fps);
      assert(c.curl.x <= c.reach + 1e-9, `${seconds}s the forearm passes into the bicep`);
      if (previous !== null) assert(Math.abs(c.curl.x - previous) < 4 / fps, `${seconds}s the forearm snaps`);
      previous = c.curl.x;
    }
  }
});

test('Pyramid arriving recruits plant a foot in world space and loaded feet stay on supporting hands', async () => {
  const m = await moduleFor('pyramid-scheme/pyramid');
  for (const direction of [-1, 1]) {
    const h = 50, scale = h / 60, baseX = direction * 36 * scale * .1;
    const a = m.recruitFeet(baseX, h, direction)[0], b = m.recruitFeet(baseX + direction * 2, h, direction)[0];
    near(baseX + a.x * scale, baseX + direction * 2 + b.x * scale);
    near(a.y, 0); near(b.y, 0);
  }
  for (let seconds = 42; seconds <= 180; seconds += .125) {
    for (let k = 0; k < 8; k++) for (let j = 0; j <= k; j++) {
      const upper = m.supportPose(9, k, j, seconds), left = m.supportPose(9, k + 1, j, seconds), right = m.supportPose(9, k + 1, j + 1, seconds), s = upper.h / 60;
      near(upper.x + upper.feet[0].x * s, left.x + 14 * s);
      near(upper.x + upper.feet[1].x * s, right.x - 14 * s);
      near(upper.y + upper.feet[0].y * s, left.y - 49.2 * s);
      near(upper.y + upper.feet[1].y * s, right.y - 49.2 * s);
    }
  }
});

test('Trench stride has readable cadence and a supporting foot throughout each cycle', async () => {
  const m = await moduleFor('the-trenches/squad');
  assert(30 / m.marchCadence(1) >= 13);
  for (let f = 0; f < 1000; f++) {
    const stride = f / 1000, a = m.marchFoot(stride, -1), b = m.marchFoot(stride, 1);
    assert(a.y <= 0 && b.y <= 0); assert(Math.abs(a.y) < 1e-7 || Math.abs(b.y) < 1e-7);
    assert(distance({ x: -8, y: -18 }, a) < 31); assert(distance({ x: 8, y: -18 }, b) < 31);
  }
});

test('Up Only wing joints retain bone length and the downstroke reverses without a velocity snap', async () => {
  const m = await moduleFor('up-only/shiba');
  for (let age = 0; age < 1; age += .001) {
    const p = m.wingJoints(age);
    near(distance(p.shoulder, p.elbow), 25); near(distance(p.elbow, p.wrist), 23);
  }
  for (const age of [0, .12, .44]) {
    const d = .00001;
    assert(Math.abs((m.wingBeat(age + d) - m.wingBeat(Math.max(0, age - d))) / (2 * d)) < .02);
  }
});

test('Thin Ice late entry reconstructs bounded travelled ice instead of a fresh launch point', async () => {
  const m = await moduleFor('thin-ice/ice');
  assert(m.journeyDistance(150, 16) > 40_000);
  assert(m.journeyDistance(150, 16) < 150 * 340);
  near(m.journeyDistance(0, 0), 0);
  const first = m.createIce(), second = m.createIce(), x = m.journeyDistance(150, 16);
  m.settleJourney(first, x, 350, 1, 150); m.settleJourney(second, x, 350, 1, 150);
  assert(first.cracks.length > 10 && first.cracks.length <= 160);
  assert(first.cracks.every(crack => crack.growth === 1));
  assert.deepEqual(first.cracks, second.cracks);
});
