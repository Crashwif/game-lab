// Headless tests for the ship's frame and the sinking: run with node --test games/gays-of-hormuz/*.test.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const dir = fileURLToPath(new URL('.', import.meta.url));
async function load(name) {
  const result = await build({ entryPoints: [`${dir}${name}.ts`], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const ship = await load('ship');

/** The affine matrix applyFrame leaves on a context, composed by hand: [a, b, c, d, e, f]. */
function frameMatrix(frame) {
  let m = [1, 0, 0, 1, 0, 0];
  const mul = (n) => { m = [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]; };
  const calls = [];
  ship.applyFrame({
    translate: (x, y) => calls.push([1, 0, 0, 1, x, y]),
    scale: (x, y) => calls.push([x, 0, 0, y, 0, 0]),
    rotate: (a) => calls.push([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]),
  }, frame);
  calls.forEach(mul);
  return m;
}

test('toScreen puts a hull point exactly where applyFrame draws it', () => {
  for (const frame of [
    { x: 300, y: 380, scale: 0.92, angle: 0, pivot: 0, drop: 0 },
    { x: 410, y: 420, scale: 1, angle: 0.37, pivot: 55, drop: 120 },
    { x: 150, y: 520, scale: 0.68, angle: -0.42, pivot: -40, drop: 260 },
  ]) {
    const m = frameMatrix(frame);
    for (const [lx, ly] of [[0, 0], [150, -50], [-149, -101], [102, -50], [-6, -121]]) {
      const p = ship.toScreen(frame, lx, ly);
      assert.ok(Math.abs(p.x - (m[0] * lx + m[2] * ly + m[4])) < 1e-9 && Math.abs(p.y - (m[1] * lx + m[3] * ly + m[5])) < 1e-9, `(${lx}, ${ly})`);
    }
  }
});

test('the sinking is a pure, continuous function of crash time that ends with her under', () => {
  for (const impact of [-110, -20, 0, 60, 130]) {
    let previous = ship.sinkPose(0, impact);
    assert.deepEqual(previous, ship.sinkPose(0, impact), 'the same moment draws the same pose');
    assert.ok(Math.abs(previous.angle) < 1e-9 && previous.drop === 0, 'the first frame is the last sailing pose');
    for (let t = 1 / 60; t <= 9; t += 1 / 60) {
      const pose = ship.sinkPose(t, impact);
      assert.ok(Math.abs(pose.angle - previous.angle) < 0.03, `no snap in the pitch at ${t.toFixed(2)} s`);
      assert.ok(pose.drop - previous.drop > -0.5 && pose.drop - previous.drop < 8, `she settles smoothly at ${t.toFixed(2)} s`);
      assert.ok(pose.flood >= previous.flood - 1e-12 && pose.flood <= 1, 'the flooding only rises');
      previous = pose;
    }
    const end = ship.sinkPose(ship.SINK_SECONDS, impact);
    assert.ok(end.drop > 260, 'she is under by the end of the ending');
    assert.ok(end.flood > 0.999);
    // Hit forward, she goes bow first and the stern lifts; hit aft, the other way round.
    assert.equal(Math.sign(ship.sinkPose(3, impact).angle), impact >= 0 ? 1 : -1);
    // The stern flag, the highest point aft, is the last thing to go under when she goes bow first.
    if (impact > 0) {
      const frame = { x: 300, y: 400, scale: 1, ...ship.sinkPose(2.6, impact) };
      assert.ok(ship.toScreen(frame, -149, -101).y < ship.toScreen(frame, 156, -74).y, 'the stern rides higher than the bow');
    }
  }
});

test('every dancer and the player stand on a deck of the ship', () => {
  for (const [x, y] of [...ship.DANCE_SPOTS, ship.YOU_SPOT]) {
    assert.ok(x > -150 && x < 158, `x ${x} is on the hull`);
    assert.ok([-88, -50, -51, -45].includes(y), `y ${y} is a deck`);
  }
  assert.equal(ship.LIFEBOATS.length, 6, 'one lifeboat per pride stripe');
});
