import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const cues = [];
globalThis.__gameCues = cues;
async function load(name, audio = false) {
  const bundled = await build({ entryPoints: [join(dir, name + '.ts')], bundle: true, write: false, format: 'esm', platform: 'node', plugins: audio ? [{ name: 'quiet-audio', setup(b) {
    b.onResolve({ filter: /^\.\/audio$/ }, () => ({ path: 'audio', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const pageAudio=()=>({update(){},cashout(){globalThis.__gameCues.push(["cashout"])},crash(kind,quiet){globalThis.__gameCues.push(["crash",quiet])},milestone(n){globalThis.__gameCues.push(["milestone",n])},fx(name){globalThis.__gameCues.push(["fx",name])}})', loader: 'js' }));
  } }] : [] });
  return import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
}
const { createPresentation, stageAt } = await load('presentation');
const { story } = await load('content');
const { solveLimb, stepFoot, walkingFoot } = await load('ink');
const { heroPose, bystanderPose, officerPose } = await load('characters');
const { createScene } = await load('scene', true);
const { confiscation } = await load('art');
const { createHaul, MAX_ITEMS } = await load('loot');
const view = (extra = {}) => ({ phase: 'running', currentX100: 250, elapsed: 9000, crashAge: 0, stake: 50, cashoutX100: null, payout: null, ...extra });

test('police and evidence appear only after the host reveals a crash', () => {
  for (const phase of ['waiting', 'betting', 'running', 'escaped']) {
    assert.deepEqual(confiscation({ phase, outcomeAge: 180 }), { arrival: 0, drop: 0, receipt: 0 });
  }
  assert.equal(confiscation({ phase: 'crashed', outcomeAge: .1 }).drop, 0);
  assert.equal(confiscation({ phase: 'crashed', outcomeAge: 3 }).receipt, 1);
});

test('displayed multipliers and long elapsed time never decide a crash', () => {
  const next = createPresentation();
  for (let t = 0; t <= 180; t += .1) {
    const input = Object.freeze(view({ elapsed: t * 1000, currentX100: 100 * Math.pow(10, t / 30) }));
    const frame = next(input, t * 1000);
    assert.equal(frame.phase, 'running'); assert.equal(frame.cue, null);
    assert.ok(frame.stage >= 0 && frame.stage <= 7);
  }
});
test('only confirmed cashout starts an exit and later crash never overwrites it', () => {
  const next = createPresentation(); next(view(), 0);
  assert.equal(next(view(), 100).phase, 'running');
  const safe = next(view({ cashoutX100: 230, payout: 115 }), 200);
  assert.equal(safe.phase, 'escaped'); assert.equal(safe.cue, 'cashout'); assert.equal(safe.currentX100, 230);
  const later = next(view({ phase: 'crashed', currentX100: 270, crashAge: 100, cashoutX100: 230 }), 300);
  assert.equal(later.phase, 'escaped'); assert.equal(later.currentX100, 230); assert.equal(later.cue, null);
});
test('early crash, settled late entry and late accepted exit are all reachable', () => {
  const early = createPresentation(); early(view({ elapsed: 0, currentX100: 100 }), 0);
  const hit = early(view({ phase: 'crashed', elapsed: 0, currentX100: 100 }), 16);
  assert.equal(hit.phase, 'crashed'); assert.equal(hit.stage, 0); assert.equal(hit.cue, 'crash'); assert.equal(hit.quiet, false);
  const late = createPresentation()(view({ phase: 'crashed', crashAge: 5000 }), 5000);
  assert.equal(late.outcomeAge, 5); assert.equal(late.quiet, true);
  const accepted = createPresentation()(view({ cashoutX100: 180 }), 10000);
  assert.equal(accepted.phase, 'escaped'); assert.equal(accepted.outcomeAge, 4); assert.equal(accepted.cue, null);
});
test('a live ending survives waiting and betting but not a new running or instant-crash round', () => {
  const next = createPresentation(); next(view(), 0); next(view({ phase: 'crashed', crashAge: 1000 }), 16);
  assert.equal(next(view({ phase: 'waiting', currentX100: 100, elapsed: 0 }), 32).held, true);
  assert.equal(next(view({ phase: 'betting', currentX100: 100, elapsed: 0 }), 48).held, true);
  const instant = next(view({ phase: 'crashed', currentX100: 100, elapsed: 0, crashAge: 0 }), 64);
  assert.equal(instant.phase, 'crashed'); assert.equal(instant.currentX100, 100); assert.equal(instant.outcomeAge, 0);
  const fresh = next(view({ currentX100: 100, elapsed: 0 }), 80);
  assert.equal(fresh.phase, 'running'); assert.equal(fresh.held, false);
});
test('ending clock and poses are independent of 30, 60 and 120Hz frame rates', () => {
  const samples = [];
  for (const hz of [30, 60, 120]) {
    const next = createPresentation(); next(view(), 0); next(view({ cashoutX100: 250 }), 10);
    let frame; for (let i = 1; i <= hz * 2; i++) frame = next(view({ cashoutX100: 250 }), 10 + i * 1000 / hz);
    samples.push(frame.outcomeAge);
  }
  for (const age of samples) assert.ok(Math.abs(age - 2) < 1e-9);
});
test('third-minute scripts keep changing with a fixed multiplier', () => {
  const next = createPresentation(), seen = [];
  for (let seconds = 120; seconds <= 180; seconds += 6.3) seen.push(story(next(view({ currentX100: 100000, elapsed: seconds * 1000 }), seconds * 1000), 'bag').line);
  assert.ok(new Set(seen).size >= 9);
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1]);
  assert.equal(stageAt(100), 0); assert.equal(stageAt(1e8), 7);
});
test('fixed-length arms stay attached at crossed, coincident and unreachable targets', () => {
  for (const target of [{ x: 0, y: 0 }, { x: 22, y: -44 }, { x: -90, y: 120 }, { x: 900, y: -100 }]) {
    const root = { x: 0, y: 0 }, pose = solveLimb(root, target, 34, 34, -1);
    assert.ok(Math.abs(Math.hypot(pose.joint.x, pose.joint.y) - 34) < 1e-6);
    assert.ok(Math.abs(Math.hypot(pose.end.x - pose.joint.x, pose.end.y - pose.joint.y) - 34) < 1e-6);
  }
});
test('hero, bystander and officer IK rigs preserve bone lengths, elbow poles and smooth stance gaits', () => {
  const check = (limb, u, l) => {
    assert.ok(Math.abs(Math.hypot(limb.joint.x - limb.root.x, limb.joint.y - limb.root.y) - u) < 1e-5);
    assert.ok(Math.abs(Math.hypot(limb.end.x - limb.joint.x, limb.end.y - limb.joint.y) - l) < 1e-5);
  };
  const haul = createHaul().update(createPresentation()(view({ elapsed: 9000, currentX100: 500 }), 9000));
  const running = heroPose({ phase: 'running', stage: 3, outcomeAge: 0 }, haul, 4.2, 0, 290);
  check(running.left, 35, 34); check(running.right, 35, 34);
  check(running.leftLeg, 37, 35); check(running.rightLeg, 37, 35);
  assert.ok(running.left.joint.y > running.left.root.y && running.right.joint.y > running.right.root.y, 'elbows hang down under gravity');
  const surrender = heroPose({ phase: 'crashed', stage: 3, outcomeAge: 1.5 }, haul, 4.2, 0, 290);
  check(surrender.left, 35, 34); check(surrender.right, 35, 34);
  assert.ok(surrender.left.joint.x < surrender.left.root.x && surrender.right.joint.x > surrender.right.root.x, 'surrender elbows bend outward away from the skull');
  const startA = heroPose({ phase: 'escaped', stage: 3, outcomeAge: .3 }, haul, 4.2, 0, 290);
  const startB = heroPose({ phase: 'escaped', stage: 3, outcomeAge: .31 }, haul, 4.2, .5, 290);
  assert.ok(Math.hypot(startA.leftLeg.end.x - startB.leftLeg.end.x, startA.leftLeg.end.y - startB.leftLeg.end.y) < 1, 'no foot pop on walk start');
  for (let role = 0; role < 5; role++) {
    const bp = bystanderPose(role, 3.4);
    check(bp.leftArm, 28, 27); check(bp.rightArm, 28, 27);
    check(bp.leftLeg, 24, 24); check(bp.rightLeg, 24, 24);
  }
  const leftCop = officerPose(75, 1, 2.1, 1), rightCop = officerPose(75, 1, 2.1, -1);
  check(leftCop.leftArm, 26, 26); check(leftCop.rightArm, 26, 26);
  check(leftCop.leftLeg, 29, 29); check(leftCop.rightLeg, 29, 29);
  assert.equal(Math.sign(leftCop.leftLeg.joint.x - leftCop.leftLeg.root.x), -Math.sign(rightCop.leftLeg.joint.x - rightCop.leftLeg.root.x));
  const worldX0 = 10 + stepFoot(10, 92, 0, 12, 1).x, worldX1 = 35 + stepFoot(35, 92, 0, 12, 1).x;
  assert.ok(Math.abs(worldX0 - worldX1) < 1e-6, 'stance foot stays planted in world space');
  assert.deepEqual(walkingFoot(150, 150, 92, 0, 12, -1), { x: 0, y: 0 });
});
function canvasContext(portrait = false) {
  const text = []; let depth = 0;
  const canvas = { width: 960, height: 540, clientWidth: portrait ? 375 : 960, clientHeight: portrait ? 556 : 540 };
  const gradient = { addColorStop() {} };
  return new Proxy({ canvas, text, measureText: value => ({ width: String(value).length * 11 }), createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    save() { depth++; }, restore() { assert.ok(depth > 0, 'balanced canvas stack'); depth--; }, fillText: value => text.push(String(value)), getTransform() { throw Error('device-space rig'); },
  }, { get(target, key) { if (key in target) return target[key]; return (...args) => { for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), String(key) + ' received a nonfinite value'); }; } });
}
test('actual scenes draw both orientations, every outcome, long rounds and late entries without bad geometry', () => {
  for (const portrait of [false, true]) for (const input of [view({ phase: 'waiting', elapsed: 0 }), view({ phase: 'betting', elapsed: 0 }), view(), view({ currentX100: 1e8, elapsed: 180000 }), view({ phase: 'crashed', currentX100: 100, elapsed: 0, crashAge: 1200 }), view({ phase: 'crashed', currentX100: 901, crashAge: 3000 }), view({ phase: 'crashed', currentX100: 902, crashAge: 5000 }), view({ cashoutX100: 200 })]) {
    const ctx = canvasContext(portrait); const scene = createScene(); scene.draw(ctx, input, 200000); scene.draw(ctx, input, 200016);
    assert.ok(ctx.text.length > 10); assert.equal(ctx.canvas.gameScene.portrait, portrait); scene.dispose?.();
  }
});
test('live cues happen once; first-frame crashes and cashouts are quiet', () => {
  cues.length = 0; const scene = createScene(), ctx = canvasContext();
  scene.draw(ctx, view(), 0); scene.draw(ctx, view({ cashoutX100: 200 }), 16); scene.draw(ctx, view({ phase: 'crashed', cashoutX100: 200, crashAge: 100 }), 32);
  assert.deepEqual(cues.filter(c => c[0] === 'cashout'), [['cashout']]); assert.equal(cues.filter(c => c[0] === 'crash').length, 0);
  cues.length = 0; createScene().draw(ctx, view({ phase: 'crashed', crashAge: 4000 }), 4000);
  assert.deepEqual(cues, [['crash', true]]);
});


test('entering just before impact stays quiet through the impact frame', () => {
  cues.length = 0;
  const scene = createScene(), ctx = canvasContext();
  scene.draw(ctx, view({ phase: 'crashed', crashAge: 1250 }), 5000);
  scene.draw(ctx, view({ phase: 'crashed', crashAge: 1320 }), 5070);
  assert.deepEqual(cues, [['crash', true]]);
});


test('loot choice changes only future cosmetic pickups and remains bounded after three minutes', () => {
  const inventory = createHaul(), next = createPresentation();
  inventory.choose('coat');
  let haul = inventory.update(next(view({ elapsed: 0 }), 0));
  assert.deepEqual(haul.items, ['coat']);
  inventory.choose('shoe');
  haul = inventory.update(next(view({ elapsed: 2300 }), 2300));
  assert.deepEqual(haul.items, ['coat', 'shoe']);
  inventory.choose('auto');
  for(let time = 2400; time <= 180000; time += 100) {
    haul = inventory.update(next(view({ elapsed: time, currentX100: 1e8 }), time));
    assert.ok(haul.items.length <= MAX_ITEMS);
  }
  assert.ok(new Set(haul.items).size === 4);
  const crash = inventory.update(next(view({ phase: 'crashed', elapsed: 180000, crashAge: 300 }), 180100));
  inventory.choose('watch');
  assert.deepEqual(inventory.update(next(view({ phase: 'crashed', elapsed: 180000, crashAge: 800 }), 180600)), crash);
  const reset = inventory.update(next(view({ elapsed: 0 }), 180700));
  assert.equal(reset.items.length, 1);
  assert.equal(reset.enabled, true);
  assert.equal(reset.choice, 'auto');
});

test('late entry reconstructs a bounded haul without replaying old pickups', () => {
  const inventory = createHaul(), frame = createPresentation()(view({ elapsed: 3600000, currentX100: 1e12 }), 3600000);
  const haul = inventory.update(frame);
  assert.equal(haul.items.length, MAX_ITEMS);
  assert.equal(new Set(haul.items).size, 4);
  const old = [...haul.items]; haul.items[0] = 'tampered';
  assert.deepEqual(inventory.update(frame).items, old, 'diagnostic copies cannot mutate the internal inventory');
});

test('the revealed outcome freezes the pickup pose without moving the held item', () => {
  const inventory = createHaul(), next = createPresentation();
  const live = inventory.update(next(view({ elapsed: 1650 }), 1650));
  const crash = inventory.update(next(view({ phase: 'crashed', elapsed: 1650, crashAge: 0 }), 1666));
  assert.equal(crash.progress, live.progress);
  assert.deepEqual(crash.items, live.items);
});

test('scene replacement removes keyboard, pointer and button listeners', () => {
  const counts = new Map();
  const target = name => ({
    addEventListener(type, handler) { const key = name + ':' + type; const set = counts.get(key) ?? new Set(); set.add(handler); counts.set(key, set); },
    removeEventListener(type, handler) { counts.get(name + ':' + type)?.delete(handler); },
    setAttribute() {}, textContent: '',
  });
  const buttons = Object.fromEntries(['bag', 'watch', 'shoe', 'coat', 'auto'].map(kind => ['loot-' + kind, target(kind)]));
  const oldDocument = globalThis.document;
  globalThis.document = { ...target('document'), getElementById: id => buttons[id] ?? null };
  try {
    for(let i = 0; i < 4; i++) {
      const ctx = canvasContext(); Object.assign(ctx.canvas, target('canvas'));
      const scene = createScene(); scene.draw(ctx, view(), i * 1000); scene.draw(ctx, view(), i * 1000 + 16);
      assert.equal([...counts.values()].reduce((n, set) => n + set.size, 0), 7);
      scene.dispose();
      assert.equal([...counts.values()].reduce((n, set) => n + set.size, 0), 0);
    }
  } finally { if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument; }
});
