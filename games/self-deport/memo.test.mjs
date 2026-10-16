// Headless checks on the rig: bone lengths, planted feet through stance at three frame rates, a stumble that recovers, a bounded late entry.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
async function source(path) {
  const r = await build({ absWorkingDir: ROOT, entryPoints: [`games/self-deport/${path}.ts`], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}
const memo = await source('memo');
const len = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const run = (speed, extra = {}) => ({ mode: 'run', speed, tension: 0.5, alarm: 0, age: 0, chain: false, tejana: false, ...extra });

test('both bones keep their length for every target, reachable or not', () => {
  for (const target of [{ x: 10, y: 60 }, { x: 0, y: 0 }, { x: 200, y: 200 }, { x: -3, y: 2 }, { x: 0, y: 62 }]) {
    const l = memo.solveLimb({ x: 0, y: 0 }, target, 31, 31, -1);
    assert.ok(Math.abs(len(l.root, l.joint) - 31) < 1e-6);
    assert.ok(Math.abs(len(l.joint, l.end) - 31) < 1e-6);
  }
});

test('the stance foot stays planted on the sidewalk at 30, 60 and 120 Hz', () => {
  for (const hz of [30, 60, 120]) {
    const rig = memo.createMemo();
    const drive = run(300);
    memo.settleMemo(rig, drive, 0);
    for (let i = 0; i < hz; i++) memo.stepMemo(rig, drive, 1 / hz); // one second to settle the stride
    let scroll = 0, prev = null, maxSlip = 0;
    for (let i = 0; i < hz * 2; i++) {
      memo.stepMemo(rig, drive, 1 / hz);
      scroll += 300 / hz;
      const p = memo.memoPose(rig, drive);
      for (const [k, foot] of [p.legs[0].end, p.legs[1].end].entries()) {
        const planted = foot.y >= memo.GROUND - 0.5;
        const world = foot.x + scroll;
        if (prev && prev[k] !== null && planted) maxSlip = Math.max(maxSlip, Math.abs(world - prev[k]));
        prev ??= [null, null];
        prev[k] = planted ? world : null;
      }
    }
    assert.ok(maxSlip < 300 / hz * 0.15, `${hz} Hz: a planted sole slid ${maxSlip.toFixed(2)} px in a frame`);
  }
});

test('a stumble knocks the hat off and he is back on his feet within a second', () => {
  const rig = memo.createMemo();
  const drive = run(260);
  memo.settleMemo(rig, drive, 0);
  memo.stumble(rig);
  assert.equal(rig.stumble, 0);
  assert.equal(rig.hat.off, true);
  let recovered = false;
  for (let i = 0; i < 72; i++) { memo.stepMemo(rig, drive, 1 / 60); if (rig.events.recovered) recovered = true; }
  assert.ok(recovered);
  assert.equal(rig.stumble, -1);
  assert.equal(rig.hat.off, false);
  const p = memo.memoPose(rig, drive);
  assert.equal(p.roll, 0);
});

test('a late entry at 150 s settles into a sensible running pose and the cone covers the crouch', () => {
  const rig = memo.createMemo();
  const drive = run(420);
  memo.settleMemo(rig, drive, 150 * 400);
  const p = memo.memoPose(rig, drive);
  assert.ok(p.hip.y > memo.GROUND - 70 && p.hip.y < memo.GROUND - 40);
  assert.ok(Number.isFinite(p.head.x) && Number.isFinite(p.nozzle.y));
  const cone = { ...drive, mode: 'cone' };
  memo.settleMemo(rig, cone, 0);
  const q = memo.memoPose(rig, cone);
  assert.ok(q.crouch > 0.99 && q.cone > 0.99);
  assert.ok(q.head.y > memo.GROUND - 110, 'his head stays inside the cone');
});

test('the exit walks him off to the right and the raid puts his hands up', () => {
  const rig = memo.createMemo();
  const exit = { mode: 'exit', speed: 0, tension: 0.3, alarm: 0, age: 6, chain: false, tejana: false };
  memo.settleMemo(rig, exit, 0);
  assert.ok(rig.x > memo.HERO_X + 300);
  const caught = { mode: 'caught', speed: 0, tension: 1, alarm: 0, age: 0.5, chain: false, tejana: false };
  const rig2 = memo.createMemo();
  memo.settleMemo(rig2, caught, 0);
  const p = memo.memoPose(rig2, caught);
  assert.ok(p.arms[0].end.y < p.shoulder.y && p.arms[1].end.y < p.shoulder.y);
  assert.equal(p.blower.held, false);
});
