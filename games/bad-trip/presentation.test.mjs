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
const { playerPose, raverPose, djPose } = await load('art');
const { createScene } = await load('scene', true);
const view = (extra = {}) => ({ phase: 'running', currentX100: 250, elapsed: 9000, crashAge: 0, stake: 50, cashoutX100: null, payout: null, ...extra });

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
  for (let seconds = 120; seconds <= 180; seconds += 6.3) seen.push(story(next(view({ currentX100: 100000, elapsed: seconds * 1000 }), seconds * 1000)).line);
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
test('player, raver and DJ IK rigs preserve bone lengths, outward elbow poles and smooth stance gaits', () => {
  const check = (limb, u, l) => {
    assert.ok(Math.abs(Math.hypot(limb.joint.x - limb.root.x, limb.joint.y - limb.root.y) - u) < 1e-5);
    assert.ok(Math.abs(Math.hypot(limb.end.x - limb.joint.x, limb.end.y - limb.joint.y) - l) < 1e-5);
  };
  for (let u = 0; u <= 1; u += .05) {
    const p = playerPose(3.5, .6, u, u * 180, 180);
    check(p.leftArm, 34, 34); check(p.rightArm, 34, 34);
    check(p.leftLeg, 36, 36); check(p.rightLeg, 36, 36);
    assert.ok(p.leftArm.joint.x < p.leftArm.root.x, 'left elbow stays outward');
    assert.ok(p.rightArm.joint.x > p.rightArm.root.x, 'consumption swing keeps right elbow outward without flipping across throat');
  }
  for (let i = 0; i < 6; i++) {
    const rp = raverPose(2.4, i, .7);
    check(rp.leftArm, 25, 25); check(rp.rightArm, 25, 25);
    check(rp.leftLeg, 23, 23); check(rp.rightLeg, 23, 23);
  }
  const dj = djPose(4.1, .8);
  check(dj.leftArm, 16, 16); check(dj.rightArm, 16, 16);
  assert.ok(Math.abs((12 + stepFoot(12, 52, 0, 11).x) - (26 + stepFoot(26, 52, 0, 11).x)) < 1e-6);
  assert.deepEqual(walkingFoot(180, 180, 52, 0, 11), { x: 0, y: 0 });
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
  scene.draw(ctx, view({ phase: 'crashed', crashAge: 1050 }), 5000);
  scene.draw(ctx, view({ phase: 'crashed', crashAge: 1120 }), 5070);
  assert.deepEqual(cues, [['crash', true]]);
});
