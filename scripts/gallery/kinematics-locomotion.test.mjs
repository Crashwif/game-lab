import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { join } from 'node:path';
import { ROOT } from './pack.mjs';

const modules = new Map();
async function load(source) {
  if (!modules.has(source)) modules.set(source, (async () => {
    const output = await build({ entryPoints: [join(ROOT, 'games', `${source}.ts`)], bundle: true, format: 'esm', platform: 'node', write: false,
      plugins: [{ name: 'presentation-host', setup(b) {
        b.onResolve({ filter: /^\.\/(audio|portrait)$/ }, args => ({ path: args.path, namespace: 'host' }));
        b.onLoad({ filter: /.*/, namespace: 'host' }, args => ({ contents: args.path.endsWith('audio') ? 'export const pageAudio=()=>new Proxy({}, {get:()=>()=>{}})' : 'export const portrait=draw=>draw' }));
      } }],
    });
    return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
  })());
  return modules.get(source);
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
// Record the actual renderer's transformed primitives, not just a parallel solver.
function canvas() {
  let m = [1, 0, 0, 1, 0, 0]; const stack = [], records = [];
  const point = (x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
  const target = { records, globalAlpha: 1, fillStyle: '', strokeStyle: '',
    save() { stack.push({ m: [...m], fillStyle: this.fillStyle, strokeStyle: this.strokeStyle }); },
    restore() { const s = stack.pop(); m = s.m; this.fillStyle = s.fillStyle; this.strokeStyle = s.strokeStyle; },
    translate(x, y) { const p = point(x, y); m[4] = p.x; m[5] = p.y; },
    scale(x, y) { m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; },
    rotate(a) { const [u, v, w, z] = m; m[0] = u * Math.cos(a) + w * Math.sin(a); m[1] = v * Math.cos(a) + z * Math.sin(a); m[2] = -u * Math.sin(a) + w * Math.cos(a); m[3] = -v * Math.sin(a) + z * Math.cos(a); },
    measureText() { return { width: 30 }; }, createLinearGradient() { return { addColorStop() {} }; }, createRadialGradient() { return { addColorStop() {} }; },
  };
  return new Proxy(target, { get(t, key) { if (key in t) return t[key]; return (...args) => { if (['moveTo', 'lineTo', 'arc', 'ellipse', 'roundRect', 'fillRect', 'quadraticCurveTo'].includes(key)) records.push({ kind: key, ...point(args[0], args[1]), args, scale: Math.hypot(m[0], m[1]), fill: t.fillStyle, stroke: t.strokeStyle }); }; } });
}
const hasPoint = (ctx, kind, p) => ctx.records.some(r => r.kind === kind && distance(r, p) < 1e-5);

test('Bull Run draws its rope grip and retains the release pose; vaults meet the fence at any frame rate', async () => {
  const api = await load('bull-run/bull'); const b = api.createBull(), r = api.createRider();
  for (let n = 0; n < 1200; n++) {
    api.stepBull(b, { running: true, tension: 1, loose: false, seconds: n / 60 }, 1 / 60);
    api.stepRider(r, b, 1, 1 / 60, []);
    if (n % 20) continue;
    const c = canvas(); api.drawRider(c, r, 1, false, b);
    assert.ok(hasPoint(c, 'lineTo', api.ropeGrip(b)), 'the visible arm must terminate at the visible rope');
    const grip = api.riderGrip(r, b); near(distance(grip.shoulder, grip.elbow), 34); near(distance(grip.elbow, grip.hand), 38);
  }
  const before = canvas(); api.drawRider(before, r, 0, false, b);
  const grip = api.ropeGrip(b); api.vault(r, b);
  const after = canvas(); api.drawRider(after, r, 0, false, b); assert.ok(hasPoint(after, 'lineTo', grip), 'release begins at the last grip');
  for (const hz of [30, 60, 120]) {
    const rider = api.createRider(); api.stepRider(rider, b, 1, 0, []); api.vault(rider, b);
    for (let t = 0; t < .75 - 1e-8; t += 1 / hz) api.stepRider(rider, b, 1, Math.min(1 / hz, .75 - t), []);
    near(rider.x, api.RAIL.x); near(rider.y, api.RAIL.y); near(rider.angle, 0);
  }
});

test('Balloon Pump keeps crash wrists within both bone lengths and renders the projected endpoint', async () => {
  const api = await load('balloon-pump/pumper'); const r = api.createPumper();
  const drive = { pumping: true, rate: 2.5, fear: 1, fallen: false, crying: false, smug: false, laser: 0, gauge: 1, gaze: { x: 600, y: 100 } };
  for (let i = 0; i < 360; i++) { if (i === 180) drive.fallen = true; api.stepPumper(r, drive, 1 / 120); const p = api.pumperPose(r, drive);
    for (const [hand, root] of [[p.frontHand, { x: p.shoulder.x + 10, y: p.shoulder.y + 4 }], [p.backHand, { x: p.shoulder.x - 12, y: p.shoulder.y + 8 }]]) {
      const elbow = api.bendJoint(root, hand, 62, 66, 1); near(distance(root, elbow), 62); near(distance(elbow, hand), 66);
    }
    if (i % 30 === 0) { const c = canvas(); api.drawPumper(c, r, drive); assert.ok(hasPoint(c, 'lineTo', p.frontHand)); }
  }
});

test('Thin Ice toe-off is continuous and support blades remain in the ice frame', async () => {
  const api = await load('thin-ice/skater'); const s = api.createSkater(); s.mode = 'skating'; s.speed = 320;
  assert.ok(distance(api.legPose(.65 - 1e-8), api.legPose(.65 + 1e-8)) < 1e-4);
  for (let n = 0; n < 100; n++) {
    s.stride = n / 100; const pose = api.skaterFooting(s); const c = canvas(); api.drawSkater(c, s, { x: 0, y: 0, scale: 1 }, false);
    for (const [depth, i] of pose.order.entries()) {
      const foot = pose.feet[i]; assert.ok(distance({ x: depth ? 4 : -4, y: pose.hip.y }, foot) < 68);
      assert.ok(hasPoint(c, 'lineTo', foot)); if (pose.legs[i].onIce) near(api.footScreen(s, i, 0, 0, 1).y, 0);
    }
  }
  s.mode = 'toShore'; s.depth = .2; api.iceBroke(s); assert.equal(s.mode, 'toShore'); near(s.depth, .2);
});

test('Pump and Dump draws fingers at the forearm endpoint through release and preserves both rigs at handoff', async () => {
  const api = await load('pump-and-dump/bench'); const b = api.createBench(); b.mode = 'lifting'; b.dumped = true; b.dumpAge = .4;
  for (const grip of [.8, .501, .499, .2, 0]) { b.hands.x = grip; const c = canvas(); api.drawBench(c, b);
    for (const side of [-1, 1]) { const p = api.benchArmPose(b, 'chad', side); near(distance(p.shoulder, p.elbow), 84); near(distance(p.elbow, p.hand), 84); assert.ok(hasPoint(c, 'lineTo', p.hand)); assert.ok(hasPoint(c, 'roundRect', { x: p.hand.x - 13, y: p.hand.y - 9 })); }
  }
  b.dumped = false; b.hands.x = 1; b.mode = 'racking'; b.modeAge = .7;
  const before = api.benchFigurePose(b, 'chad'); api.stepBench(b, { running: true, multiplier: 3, growth: 1, tension: .3 }, 1e-6); assert.deepEqual(api.benchFigurePose(b, 'chad'), before);
  b.modeAge = 2.2; const chad = api.benchFigurePose(b, 'chad'), bro = api.benchFigurePose(b, 'bro'); api.stepBench(b, { running: true, multiplier: 3, growth: 1, tension: .3 }, 1e-6);
  near(api.benchFigurePose(b, 'chad').x, chad.x, 1e-3); near(api.benchFigurePose(b, 'chad').footY, chad.footY); assert.deepEqual(api.benchFigurePose(b, 'bro'), bro);
  const mode = b.mode; api.dumpBar(b, 1, false); assert.equal(b.mode, mode, 'a crash must not teleport the accepted lifter');
});

test('Bonding Curl releases its held weight at the hand, lands it on its lowest corner once, and topples it flat', async () => {
  const api = await load('bonding-curl/curler');
  for (const curl of [0, .3, .7, 1]) {
    const c = api.createCurler(); c.mode = 'curling'; c.curl.x = curl; c.curl.v = .5;
    const held = api.curlerArm(c); api.poseCurler(c); near(distance(c.dumbbell, held.hand), 0); near(c.dumbbell.angle, held.bar); assert.equal(c.events.dropped, false);
    let contacts = 0;
    for (let n = 0; n < 240; n++) { api.stepCurler(c, { running: true, multiplier: 3, growth: 1, tension: 0, seconds: n / 120 }, 1 / 120); if (c.events.dropped) { contacts++; near(c.dumbbell.y + api.dumbbellDepth(c.dumbbell.angle), 510); } }
    assert.equal(contacts, 1);
    // At rest it lies flat on both plates, not balanced on a rim.
    near(Math.sin(c.dumbbell.angle), 0, 0.01); near(c.dumbbell.y, 490, 0.5);
  }
});

test('King gait walks backward without replanting support feet, while camera bounds include the ape', async () => {
  const [api, gaitApi, hill] = await Promise.all([load('king-of-the-hill/ape'), load('king-of-the-hill/gait'), load('king-of-the-hill/hill')]);
  const gait = gaitApi.createGait(); gaitApi.stepGait(gait, 3000, true, 0);
  let steps = 0;
  for (let n = 1; n < 180; n++) { const before = gait.feet.map(f => ({ ...f })); gaitApi.stepGait(gait, 3000 - n * 1.5, true, 1 / 60); gait.feet.forEach((f, i) => { if (before[i].phase === 1 && f.phase === 1) near(f.x, before[i].x); if (f.phase === 0) steps++; }); }
  assert.ok(steps > 4);
  for (const x of [0, 1000, 5000, 20000]) {
    const r = 100, angle = hill.slopeAngle(x); const anchor = { contactX: x, r, centre: { x: x - Math.sin(angle) * r, y: hill.heightAt(x) + Math.cos(angle) * r } }; const ape = api.createApe(); api.stepApe(ape, { anchor, walking: true, fear: 1, bump: false }, 0);
    const cam = api.frameApe({ x: x - 300, y: hill.heightAt(x) - 300 }, ape, anchor); const feet = api.apeFooting(ape, anchor).feet;
    for (const foot of feet) { const p = hill.toScreen(cam, foot.sole); assert.ok(p.y < 500 && p.y > 50, `foot outside viewport: ${p.y}`); }
    const before = api.apeHandPose(ape, anchor); api.brace(ape, anchor); assert.deepEqual(api.apeHandPose(ape, anchor), before);
  }
});

test('The Trenches captures drawn marching scale and squash before either exit', async () => {
  const api = await load('the-trenches/squad');
  for (const exit of ['dive', 'flung']) { const s = api.createSquad(); s.over.x = 1; s.act = 3; s.effort = .8; s.frogs.forEach(f => { f.mode = 'marching'; f.squash.x = .1; });
    if (exit === 'dive') api.diveBack(s, .7); else api.killSquad(s, false, .7);
    const f = s.frogs.find(f => f.mode === (exit === 'dive' ? 'diving' : 'flung')); near(f.diveFrom.scale, 1 - .45 * .7); near(f.diveFrom.squash, .82);
    const c = canvas(); api.drawSquad(c, s, .7, .2, false); assert.ok(c.records.some(r => Math.abs(r.scale - f.diveFrom.scale) < 1e-6), 'renderer retains captured scale');
  }
});

test('Rug Rails solves two fixed legs above stable track contacts under bob, lean and hover', async () => {
  const api = await load('rug-rails/runner');
  for (let n = 0; n < 60; n++) { const p = { X: 100, Y: 300, s: 130 / .7, stride: n / 60, lean: .8, air: false, vh: 0, slide: .2, stumble: .2, down: 0, audit: -1, bag: 0, drip: new Set(), hover: n / 60, fall: 0, magnet: false, double: false, time: n / 60, reduced: false };
    const legs = api.runnerLegs(p).legs, c = canvas(); api.drawFrog(c, p);
    for (const leg of legs) { const point = a => ({ x: a[0], y: a[1] }); near(distance(point(leg.hip), point(leg.knee)), 30); near(distance(point(leg.knee), point(leg.foot)), 30); assert.ok(hasPoint(c, 'lineTo', { x: p.X + leg.contact.x, y: p.Y + leg.contact.y })); }
  }
});

test('Rug Piste preserves an airborne skier at chair arrival and finishes at the full-size seat', async () => {
  const [api, art] = await Promise.all([load('rug-piste/lift-rig'), load('rug-piste/art')]);
  const source = { jump: 1, lean: .8, stumble: .5 }, p = api.liftPose(0, source); near(p.skierY, -46); near(p.lean, .8); near(p.stumble, .5); near(p.depart, 0);
  const before = canvas(), after = canvas(); art.drawSkier(before, 0, 0, { ...source, jump: 46, time: 0, shadow: false }); art.drawSkier(after, 0, p.skierY, { lean: p.lean, jump: 0, stumble: p.stumble, seated: p.seated, time: 0, shadow: false }); assert.deepEqual(after.records, before.records);
  const end = api.liftPose(3, source); near(end.skierY, end.chairY - 8); near(end.seated, 1);
});

test('Pyramid Scheme keeps the top figure size and support pose at accepted release', async () => {
  const api = await load('pyramid-scheme/scene'); const scene = api.createScene(); const view = { phase: 'running', currentX100: 100000, elapsed: 150000, crashAge: 0, stake: 100, cashoutX100: null, payout: null };
  const a = canvas(); scene.draw(a, view, 1000); const b = canvas(); scene.draw(b, { ...view, cashoutX100: 100000, payout: 100000 }, 1000);
  const top = c => c.records.find(r => r.kind === 'roundRect' && r.fill === '#d5fb6d'); assert.ok(top(a)); assert.ok(top(b)); near(top(a).scale, top(b).scale); near(distance(top(a), top(b)), 0);
});

test('Up Only keeps visible wing joints continuous during a repeated gameplay flap', async () => {
  const [api, art] = await Promise.all([load('up-only/sky'), load('up-only/shiba')]); const w = api.createWorld(7), drive = { running: true, multiplier: 1, tension: 0, off: false }; w.bird.y = 250; w.bird.grace = 10;
  api.stepWorld(w, 1, drive, 0);
  for (let n = 0; n < 12; n++) api.stepWorld(w, 0, drive, .01);
  const motion = () => ({ beat: w.bird.wing.x, lag: w.bird.wingLag.x, feather: w.bird.feather.x });
  const before = art.wingJoints(w.bird.flapAge, motion()); api.stepWorld(w, 1, drive, 0); const after = art.wingJoints(w.bird.flapAge, motion()); assert.deepEqual(after, before); assert.equal(w.bird.vy, -470);
  const c = canvas(); art.drawShiba(c, { x: 0, y: 0, tilt: 0, flapAge: w.bird.flapAge, wingMotion: motion(), stun: 0, bag: 0, drip: new Set(), rocket: false, magnet: false, fall: 0, struck: 0, time: 0, reduced: false }); assert.ok(hasPoint(c, 'lineTo', { x: after.wrist.x + 2, y: after.wrist.y - 12 }));
});

test('King support constraints survive the actual 180-second endurance curve at 30/60/120 Hz', async () => {
  const [apeApi, coinApi] = await Promise.all([load('king-of-the-hill/ape'), load('king-of-the-hill/coin')]);
  for (const hz of [30, 60, 120]) {
    const ape = apeApi.createApe(), coin = coinApi.createCoin();
    for (let frame = 0; frame < 180 * hz; frame++) {
      const seconds = frame / hz, growth = Math.min(Math.log2(100000), seconds * .06 / Math.LN2);
      coinApi.stepCoin(coin, { seconds, x: 60 + 620 * growth, radius: 40 + 50 * (1 - Math.exp(-growth / 2)), growth, running: true }, 1 / hz);
      const p = coinApi.coinPose(coin), anchor = { contactX: p.contact.x, centre: p.centre, r: p.r };
      apeApi.stepApe(ape, { anchor, walking: true, fear: Math.min(1, growth / 3), bump: coin.events.bump }, 1 / hz);
      const { hip, feet, add } = apeApi.apeFooting(ape, anchor);
      for (const [i, foot] of feet.entries()) assert.ok(distance(add(hip, i ? 6 : -6, 0), foot.ankle) < 88, `stretched leg at ${seconds}s / ${hz}Hz`);
      if (frame % (hz * 6) === 0) {
        const camera = apeApi.frameApe({ x: p.centre.x - 75, y: p.centre.y - 15 }, ape, anchor), c = canvas(); apeApi.drawApe(c, camera, ape, anchor);
        for (const foot of feet) assert.ok(hasPoint(c, 'lineTo', { x: 480 + foot.ankle.x - camera.x, y: 300 - foot.ankle.y + camera.y }), 'constrained ankle must reach the drawn leg');
      }
    }
  }
});

test('Pump shared sockets retain phone, syringe, shades and the KO face after the hands release', async () => {
  const api = await load('pump-and-dump/bench'); const b = api.createBench(); b.mode = 'lifting';
  const before = canvas(); api.drawBench(before, b);
  assert.ok(before.records.some(r => r.kind === 'roundRect' && r.fill === '#1b1b1f' && Math.abs(r.args[2] - 22 * .78) < 1e-6), 'phone stays between the spotter hands');
  assert.ok(before.records.some(r => r.kind === 'roundRect' && r.fill === 'rgba(232, 242, 255, 0.92)'), 'syringe remains behind the ear');
  api.dumpBar(b, 1, false); b.dumpAge = 1; b.hands.x = 0;
  const ko = canvas(); api.drawBench(ko, b);
  assert.ok(hasPoint(ko, 'lineTo', { x: 480 - 11 + 5, y: 372 - 4 }), 'X eyes remain after hands have left the bar');
  api.resetBench(b); api.settleBench(b, 10, true); const safe = canvas(); api.drawBench(safe, b);
  assert.ok(safe.records.some(r => r.kind === 'fillRect' && r.fill === '#1c1f26' && r.args[2] === 18 && r.args[3] === 11), 'accepted Chad keeps his shades');
});

test('Up Only preserves airborne position when the scene removes a cashout/crashed bird from play', async () => {
  const api = await load('up-only/sky'), w = api.createWorld(17); w.bird.y = 210; w.bird.vy = -120;
  api.stepWorld(w, 0, { running: false, off: true, multiplier: 3, tension: 1 }, 1 / 60); near(w.bird.y, 210);
  api.stepWorld(w, 0, { running: false, off: false, multiplier: 1, tension: 0 }, 1 / 60); near(w.bird.y, api.PAD_Y);
});
