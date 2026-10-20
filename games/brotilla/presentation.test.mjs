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
const { solveLimb } = await load('ink');
const { captainPose, crewPose } = await load('cast');
const { createScene } = await load('scene', true);
const { createProduction, STUNTS } = await load('production');
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
  for (let seconds = 120; seconds <= 180; seconds += 6.3) seen.push(story(next(view({ currentX100: 100000, elapsed: seconds * 1000 }), seconds * 1000), 'live').line);
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
test('captain and supporting rigs preserve fixed bones and planted feet throughout stunts and endings', () => {
  const check = (limb, upper, lower) => {
    assert.ok(Math.abs(Math.hypot(limb.joint.x-limb.root.x,limb.joint.y-limb.root.y)-upper)<1e-6);
    assert.ok(Math.abs(Math.hypot(limb.end.x-limb.joint.x,limb.end.y-limb.joint.y)-lower)<1e-6);
  };
  for (const stunt of STUNTS) for (const phase of ['running','crashed','escaped']) for (let t=0;t<6;t+=.1) {
    const f={phase,outcomeAge:t};
    const production={weights:Object.fromEntries(STUNTS.map(s=>[s,s===stunt?1:0]))};
    const p=captainPose(20+t,f,production);
    check(p.left,40,43);check(p.right,35,35);check(p.back,32,31);check(p.front,32,31);
    assert.ok(Math.abs(p.left.end.x+39)<1e-6 && Math.abs(p.left.end.y)<1e-6,'rear foot planted');
    assert.ok(Math.abs(p.right.end.x-44)<1e-6 && Math.abs(p.right.end.y+34)<1e-6,'front foot stays on the crate');
    assert.ok(Math.abs(p.back.end.x+57)<1e-6 && Math.abs(p.back.end.y+117)<1e-6,'flag grip pinned');
  }
  for (const role of ['director','sailor','dj','bro','influencer']) for(let t=0;t<=1;t+=.05) {
    const p=crewPose(role,20+t,t);
    check(p.left,23,25);check(p.right,23,25);check(p.back,22,21);check(p.front,22,21);
  }
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


test('publicity direction blends continuously, stays bounded, and freezes on confirmed outcomes', () => {
  const controller=createProduction(), next=createPresentation();
  let production=controller.update(next(view({elapsed:1000}),1000));
  controller.choose('statement');
  production=controller.update(next(view({elapsed:1016}),1016));
  assert.equal(production.active,'statement');
  assert.equal(production.weights.live,1,'the old pose remains at the start of a blend');
  production=controller.update(next(view({elapsed:1616}),1616));
  assert.equal(production.weights.statement,1);
  controller.choose('auto');
  const seen=new Set();
  for(let ms=1700;ms<=180000;ms+=100){
    production=controller.update(next(view({elapsed:ms,currentX100:1e8}),ms));
    seen.add(production.active);
    assert.equal(Object.keys(production.weights).length,4);
    const weights=Object.values(production.weights);
    assert.ok(weights.every(n=>n>=0&&n<=1));
    assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-9);
  }
  assert.equal(seen.size,4);
  const end=controller.update(next(view({phase:'crashed',elapsed:180000,crashAge:0}),180016));
  controller.choose('drone');
  const frozen=controller.update(next(view({phase:'crashed',elapsed:180000,crashAge:1500}),181516));
  assert.equal(frozen.enabled,false);assert.deepEqual(frozen.weights,end.weights);assert.equal(frozen.choice,'auto');
  frozen.weights.live=999;
  assert.deepEqual(controller.update(next(view({phase:'crashed',elapsed:180000,crashAge:1600}),181616)).weights,end.weights,'observations are copies');
});

test('fictional party stash opens only after a revealed crash; an accepted exit is distinct', () => {
  for(const phase of ['waiting','betting','running']){
    const ctx=canvasContext(), scene=createScene();
    scene.draw(ctx,view({phase,elapsed:180000,currentX100:1e8}),180000);
    assert.equal(ctx.canvas.gameScene.ending,null);
    assert.ok(!ctx.text.includes('EMPTY'));
    scene.dispose();
  }
  const ctx=canvasContext();createScene().draw(ctx,view({phase:'crashed',crashAge:4000}),4000);
  assert.ok(ctx.text.includes('EMPTY'));
  assert.equal(ctx.canvas.gameScene.ending,'empty-morale');
  assert.ok(ctx.text.includes('FICTIONAL PARTY BOAT AUDIT'));
  const safe=canvasContext();createScene().draw(safe,view({cashoutX100:200}),4000);
  assert.equal(safe.canvas.gameScene.ending,'personal-boundaries');
  assert.ok(!safe.text.includes('EMPTY'));
});

test('scene replacement removes every keyboard and button listener', () => {
  const counts = new Map();
  const target = name => ({
    addEventListener(type, handler) { const key = name + ':' + type; const set = counts.get(key) ?? new Set(); set.add(handler); counts.set(key, set); },
    removeEventListener(type, handler) { counts.get(name + ':' + type)?.delete(handler); },
    setAttribute() {}, textContent: '',
  });
  const buttons = Object.fromEntries(['live', 'drone', 'statement', 'centre', 'auto'].map(kind => ['stunt-' + kind, target(kind)]));
  const oldDocument = globalThis.document;
  globalThis.document = { ...target('document'), getElementById: id => buttons[id] ?? null };
  try {
    for(let i = 0; i < 4; i++) {
      const ctx = canvasContext(); Object.assign(ctx.canvas, target('canvas'));
      const scene = createScene(); scene.draw(ctx, view(), i * 1000); scene.draw(ctx, view(), i * 1000 + 16);
      assert.equal([...counts.values()].reduce((n, set) => n + set.size, 0), 6);
      scene.dispose();
      assert.equal([...counts.values()].reduce((n, set) => n + set.size, 0), 0);
    }
  } finally { if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument; }
});
