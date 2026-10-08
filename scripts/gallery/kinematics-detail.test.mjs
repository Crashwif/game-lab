import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { ROOT } from './pack.mjs';

const modules = new Map();
async function source(path) {
  if (!modules.has(path)) modules.set(path, (async () => {
    const result = await build({
      absWorkingDir: ROOT, entryPoints: [`games/${path}.ts`], bundle: true,
      platform: 'node', format: 'esm', write: false,
      plugins: [{ name: 'scene-observation', setup(b) {
        b.onResolve({ filter: /^\.\/audio$/ }, () => ({ path: 'audio', namespace: 'fixture' }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const pageAudio = () => ({enabled:false, update(){}, cashout(){}, crash(){}, fx(){}, milestone(){}});' }));
        if (path === 'liquidation-lane/scene') {
          b.onResolve({ filter: /^\.\/cockpit$/ }, () => ({ path: 'cockpit', namespace: 'observe' }));
          b.onLoad({ filter: /.*/, namespace: 'observe' }, () => ({ contents: 'export const drawCockpit = (ctx, view) => { ctx.car = {...view}; }; export const drawDamage = () => {};' }));
        }
      } }],
    });
    return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
  })());
  return modules.get(path);
}

test('Hello World carries position and velocity into the crash and settles late entries', async () => {
  const { circleBob } = await source('hello-world/scene');
  for (let elapsed = 0; elapsed < 3000; elapsed += 79) {
    const view = { phase: 'running', elapsed, crashAge: 0 };
    const before = circleBob(view);
    view.phase = 'crashed';
    assert.equal(circleBob(view), before);
    const epsilon = 0.001;
    const vIn = (before - circleBob({ ...view, phase: 'running', elapsed: elapsed - epsilon })) / (epsilon / 1000);
    const vOut = (circleBob({ ...view, crashAge: epsilon }) - before) / (epsilon / 1000);
    assert.ok(Math.abs(vIn - vOut) < 0.003, 'no velocity jump on impact');
    assert.ok(Math.abs(circleBob({ ...view, crashAge: 3000 })) < 1e-7);
    assert.equal(circleBob(view, true), 0);
  }
});

test('Seed Round turns into the actual bank path without snapping at acceptance or crash', async () => {
  const m = await source('seed-round/pack');
  const math = await source('seed-round/math3d');
  for (const hz of [30, 60, 120]) {
    const pack = m.createPack();
    const input = { racing: true, crashed: false, multiplier: 3, tension: 0.6 };
    for (let i = 0; i < hz * 3; i++) m.stepPack(pack, input, 1 / hz);
    const before = m.playerPose(pack);
    m.bankYou(pack);
    assert.deepEqual(m.playerPose(pack), before);
    for (let i = 0; i <= hz * 1.6; i++) {
      const previous = m.playerPose(pack);
      m.stepPack(pack, input, 1 / hz);
      const pose = m.playerPose(pack);
      assert.ok(Math.abs(math.length(pose.forward) - 1) < 1e-8);
      assert.ok(math.dot(pose.forward, previous.forward) > 0.96, 'heading changes continuously');
      const travel = math.sub(pose.position, previous.position);
      if (i > hz * 0.2 && i < hz) assert.ok(math.dot(math.normalize(travel), pose.forward) > 0.9, 'face along the path to the bank');
      if (i === Math.floor(hz / 2)) {
        input.crashed = true; input.racing = false;
        m.pilePack(pack);
        m.stepPack(pack, input, 0);
        assert.deepEqual(m.playerPose(pack), pose, 'zero-time crash cannot displace a confirmed exit');
      }
    }
    assert.equal(pack.you.mode, 'banked');
  }
});

test('Seed Round swimmers reduce effort individually when they reach the pile', async () => {
  const m = await source('seed-round/pack');
  const p = m.createPack();
  m.pilePack(p);
  const near = p.swimmers[0], far = p.swimmers[1];
  near.state = far.state = 'swim'; near.freq = far.freq = 1;
  near.rel = p.pileRel - 0.4 - near.seed * 1.6;
  far.rel = near.rel - 10;
  const a = near.phase, b = far.phase;
  m.stepPack(p, { racing: false, crashed: true, multiplier: 2, tension: 1 }, 1 / 60);
  assert.ok((far.phase - b) > (near.phase - a) * 3, 'stragglers still swim while the front settles');
});

function context() {
  const target = {};
  return new Proxy(target, {
    get(o, key) {
      if (key in o) return o[key];
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
      return (...args) => { for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(key)} receives finite geometry`); };
    },
  });
}

test('Liquidation Lane steering follows the visible bend and head inertia survives phase boundaries', async () => {
  const { createScene } = await source('liquidation-lane/scene');
  const outcomes = [];
  for (const hz of [30, 60, 120]) {
    const scene = createScene(), ctx = context();
    const view = { phase: 'running', currentX100: 200, elapsed: 0, crashAge: 0, stake: 10, cashoutX100: null, payout: null };
    for (let i = 0; i <= hz * 4; i++) { view.elapsed = i / hz * 1000; scene.draw(ctx, view, view.elapsed); }
    assert.ok(ctx.car.steering > 0.1, 'wheel follows the rightward highway bend');
    assert.ok(ctx.car.headRoll < -0.005, 'head lags outward against the turn');
    const before = ctx.car;
    view.phase = 'crashed';
    scene.draw(ctx, view, view.elapsed);
    assert.equal(ctx.car.headRoll, before.headRoll);
    assert.equal(ctx.car.headPitch, before.headPitch);
    for (let i = 1; i <= hz * 3; i++) { view.crashAge = i / hz * 1000; scene.draw(ctx, view, view.elapsed + view.crashAge); }
    assert.ok(Math.abs(ctx.car.headRoll + 0.12) < 0.002);
    assert.ok(Math.abs(ctx.car.headPitch) < 0.002);
    outcomes.push(before.headRoll);
    scene.dispose();
  }
  assert.ok(Math.max(...outcomes) - Math.min(...outcomes) < 0.002, 'consistent inertia across refresh rates');
  const reduced = createScene({ reducedMotion: true }), ctx = context();
  for (let i = 0; i < 120; i++) reduced.draw(ctx, { phase: 'running', currentX100: 600, elapsed: i * 16, crashAge: 0, stake: null, cashoutX100: null, payout: null }, i * 16);
  assert.equal(ctx.car.headRoll, 0); assert.equal(ctx.car.headPitch, 0);
  reduced.dispose();
});
