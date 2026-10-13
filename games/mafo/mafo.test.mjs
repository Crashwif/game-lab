// Headless checks for MAFO, beside the game (not part of the source pack): node --test games/mafo/mafo.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

const here = (name) => fileURLToPath(new URL(`./${name}.ts`, import.meta.url));
const bundle = async (name) => {
  const out = await build({ entryPoints: [here(name)], bundle: true, write: false, format: 'esm', platform: 'node' });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a, b, tolerance = 1e-6, what = '') => assert.ok(Math.abs(a - b) <= tolerance, `${what} ${a} should be within ${tolerance} of ${b}`);

// ─── The whole scene in a VM, with a canvas that draws nothing and an audio that records its cues ───
let compiled = null;
async function harness() {
  compiled ??= build({
    entryPoints: [here('scene')], bundle: true, write: false, format: 'iife', globalName: 'Scene',
    plugins: [{ name: 'audio-recorder', setup(b) {
      b.onResolve({ filter: /^\.\/audio$/ }, () => ({ path: 'audio', namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const pageAudio = () => globalThis.audio;' }));
    } }],
  });
  const events = [];
  let shown;
  const context = {
    Path2D: class { constructor() { return new Proxy({}, { get: () => () => {} }); } },
    audio: {
      context: null, bus: null, enabled: false,
      update(phase, tension) { shown = { phase, tension }; },
      fx(name, strength) { events.push({ name, strength }); },
      cashout() { events.push({ name: 'cashout' }); },
      milestone(n) { events.push({ name: 'milestone', n }); },
      crash(name, quiet) { events.push({ name: 'crash', kind: name, quiet }); },
    },
  };
  runInNewContext((await compiled).outputFiles[0].text, context);
  const scene = context.Scene.createScene();
  const gradient = () => ({ addColorStop() {} });
  // Every text the last frame drew, so a test can see which lines are up.
  const texts = new Set();
  const ctx = new Proxy({
    canvas: { width: 960, height: 540, clientWidth: 960, clientHeight: 540 },
    measureText: (text) => ({ width: String(text).length * 8 }),
    createLinearGradient: gradient, createRadialGradient: gradient,
    fillText: (text) => texts.add(String(text)),
  }, { get: (target, key) => (key in target ? target[key] : () => {}), set: (target, key, value) => { target[key] = value; return true; } });
  let now = 1000;
  const view = { phase: 'betting', currentX100: 100, elapsed: 0, crashAge: 0, stake: 50, cashoutX100: null, payout: null };
  function frame(patch = {}, dt = 1 / 30) {
    Object.assign(view, patch);
    now += dt * 1000;
    texts.clear();
    scene.draw(ctx, view, now);
    return shown;
  }
  /** Runs the round along the default curve (tenfold every 30 s) to `seconds`. */
  function runTo(seconds, dt = 1 / 30) {
    if (view.phase !== 'running') frame({ phase: 'running', elapsed: 0, currentX100: 100 });
    while (view.elapsed < seconds * 1000) {
      const elapsed = view.elapsed + dt * 1000;
      frame({ elapsed, currentX100: Math.floor(100 * 10 ** (elapsed / 30000)) }, dt);
    }
  }
  function liveCrash(age = 2) {
    frame();
    frame({ phase: 'running', currentX100: 200, elapsed: 9000 });
    frame({ phase: 'crashed', crashAge: 0 });
    for (let i = 1; i <= Math.round(age * 30); i += 1) frame({ crashAge: (i * 1000) / 30 });
  }
  return { frame, runTo, liveCrash, events, view, texts };
}

test('an ending seen live survives waiting → betting without restarting the music', async () => {
  const h = await harness();
  h.liveCrash();
  h.frame({ phase: 'waiting', currentX100: 100, stake: null, elapsed: 0, crashAge: 0 });
  const shown = h.frame({ phase: 'betting' });
  assert.equal(shown.phase, 'crashed');
  assert.equal(shown.tension, 0.5, 'keep the previous 2× crash while its ending plays');
});

test('a new instant crash interrupts the previous ending and plays once', async () => {
  const h = await harness();
  h.liveCrash();
  h.frame({ phase: 'betting', currentX100: 100, stake: 50, elapsed: 0, crashAge: 0 });
  h.events.length = 0;
  const shown = h.frame({ phase: 'crashed', currentX100: 100, crashAge: 0 });
  assert.equal(shown.phase, 'crashed');
  assert.equal(shown.tension, 0, 'show the new 1× crash, not the previous 2× ending');
  assert.equal(h.events.filter((e) => e.name === 'crash' && !e.quiet).length, 1, 'play the new crash once');
});

test('a new running round interrupts the ending and clears the accepted exit', async () => {
  const h = await harness();
  h.frame();
  h.frame({ phase: 'running', currentX100: 150, elapsed: 5000 });
  h.frame({ cashoutX100: 150, payout: 75 });
  h.frame({ phase: 'crashed', currentX100: 200, crashAge: 0 });
  h.frame({ phase: 'betting', currentX100: 100, elapsed: 0, cashoutX100: null, payout: null });
  assert.equal(h.frame({ phase: 'running' }).phase, 'running');
  h.events.length = 0;
  h.frame({ cashoutX100: 100, payout: 50 });
  assert.equal(h.events.filter((e) => e.name === 'cashout').length, 1, 'the new exit must be accepted independently');
});

test('a scene opened after the crash settles quietly: no stinger, no cues', async () => {
  const h = await harness();
  h.frame({ phase: 'crashed', currentX100: 412, elapsed: 18000, crashAge: 2500 });
  for (let i = 0; i < 90; i += 1) h.frame({ crashAge: 2500 + i * 33 });
  const crashes = h.events.filter((e) => e.name === 'crash');
  assert.equal(crashes.length, 1);
  assert.equal(crashes[0].quiet, true);
  assert.equal(h.events.filter((e) => e.name !== 'crash').length, 0, `no cues for an aftermath met late: ${h.events.map((e) => e.name).join(', ')}`);
});

test('a live crash plays the record scratch, then the boom on the crash clock, once', async () => {
  const h = await harness();
  h.frame();
  h.runTo(9);
  h.events.length = 0;
  h.frame({ phase: 'crashed', crashAge: 0 });
  for (let i = 1; i <= 120; i += 1) h.frame({ crashAge: (i * 1000) / 30 });
  assert.equal(h.events.filter((e) => e.name === 'crash' && !e.quiet && e.kind === 'scratch').length, 1);
  const booms = h.events.filter((e) => e.name === 'boom' && e.strength === 1);
  assert.equal(booms.length, 1, 'one blast');
});

test('the show keeps talking in the third minute, and a long round stays bounded', async () => {
  const h = await harness();
  h.frame();
  h.runTo(120);
  h.events.length = 0;
  h.runTo(180);
  const lines = h.events.filter((e) => e.name === 'pop' || e.name === 'beep').length;
  assert.ok(lines >= 6, `lines said between 120 s and 180 s: ${lines}`);
  assert.ok(h.view.currentX100 > 100000, 'the default curve passes 1,000×');
});

test('the aftermath speaks in order, a beat apart, and all of it before the ending is done', async () => {
  // The crash point seeds the landing: 1.53× the pool, 1.44× the truck, 1.51× the tree, 70× the saucer.
  const cases = [
    { x100: 153, order: ['cuz', 'junior', 'darlene'] },
    { x100: 144, order: ['cuz', 'junior', 'darlene'] },
    { x100: 151, order: ['cuz', 'junior', 'darlene'] },
    { x100: 7000, order: ['junior', 'cuz', 'darlene'] },
    { x100: 420, exit: 300, order: ['cuz', 'junior', 'darlene'] },
  ];
  const says = {
    cuz: (t) => t.includes('go get ice') || t === 'Got the ice.',
    junior: (t) => /^\.\.\.(Nailed it|Mamaw's gonna kill me|Same time next week)\.$/.test(t) || t === "TELL MAMAW I'LL BE LATE!",
    darlene: (t) => t === 'I GOT IT ON VIDEO!',
  };
  for (const { x100, exit, order } of cases) {
    const h = await harness();
    h.frame();
    if (exit) {
      h.frame({ phase: 'running', currentX100: exit, elapsed: 9000 });
      h.frame({ cashoutX100: exit, payout: 150 });
    }
    h.frame({ phase: 'running', currentX100: x100, elapsed: 12000 });
    h.frame({ phase: 'crashed', crashAge: 0 });
    const first = {};
    for (let i = 1; i <= Math.round(5.4 * 30); i += 1) {
      h.frame({ crashAge: (i * 1000) / 30 });
      for (const [who, match] of Object.entries(says)) if (first[who] === undefined && [...h.texts].some(match)) first[who] = i / 30;
    }
    for (const who of order) assert.ok(first[who] !== undefined, `${x100}: ${who} speaks before the ending is done`);
    for (let k = 1; k < order.length; k += 1) {
      const gap = first[order[k]] - first[order[k - 1]];
      assert.ok(gap >= 0.6, `${x100}: ${order[k]} speaks a beat after ${order[k - 1]} (${gap.toFixed(2)} s)`);
    }
  }
});

test('the cash-out walks him out the door, down the steps and behind the truck, without a teleport', async () => {
  const { exitSpot, EXIT_DONE, doorAt, cuzPose } = await bundle('cuz');
  const { HIDE, DOOR } = await bundle('layout');
  let last = exitSpot(0);
  let doorOpened = false;
  for (let e = 0; e <= EXIT_DONE + 1; e += 1 / 60) {
    const spot = exitSpot(e);
    assert.ok(Math.abs(spot.x - last.x) < 10 && Math.abs(spot.ground - last.ground) < 10, `a jump at ${e.toFixed(2)} s`);
    if (doorAt(e) > 0.9) doorOpened = true;
    last = spot;
    const p = cuzPose({ time: e, tension: 0.4, multiplier: 2, exit: e, talking: 0, sip: -1, duck: -1 });
    assert.ok(Number.isFinite(p.head.x) && Number.isFinite(p.head.y));
  }
  assert.ok(doorOpened, 'the front door opens as he reaches it');
  near(doorAt(EXIT_DONE + 1), 0, 1e-6, 'and shuts behind him');
  near(exitSpot(EXIT_DONE + 1).x, HIDE.x, 1e-6, 'he ends behind the truck');
  assert.ok(exitSpot(EXIT_DONE + 1).phase === 'hid');
  assert.ok(DOOR.x0 < DOOR.x1);
});

test("Junior's arms keep their bone lengths at every target, and the stirring hand reaches the paddle", async () => {
  const { solveLimb } = await bundle('kinematics');
  const J = await bundle('junior');
  const S = await bundle('still');
  const still = S.createStill();
  S.ignite(still);
  const j = J.createJunior();
  let time = 0;
  for (let i = 0; i < 60 * 40; i += 1) {
    const tension = (i % 900) / 900;
    const d = { time, tension, depth: 0.1, multiplier: 1 / (1 - tension), running: true, crash: -1, talking: i % 400 < 90 ? 1 : 0, look: 'pot', trigger: null, landing: null };
    if (i % 600 === 30) J.gestureFree(j, 'pour', i % 1200 === 30 ? 'xxx' : 'mystery');
    if (i % 600 === 300) J.gestureFree(j, 'sip');
    if (i % 700 === 100) J.gestureStir(j, 'tap');
    if (i % 1100 === 500) J.gestureStir(j, 'swap');
    J.stepJunior(j, d, 1 / 60, true);
    S.stepStill(still, { time, tension, depth: 0.1, multiplier: d.multiplier, running: true, crash: -1, held: J.holding(j, d) }, 1 / 60);
    time += 1 / 60;
    const p = J.juniorPose(j, d, still);
    for (const [shoulder, hand, pole] of [[p.shoulderL, p.free, 1], [p.shoulderR, p.stirHand, -1]]) {
      const { joint, end } = solveLimb(shoulder, hand, J.UPPER, J.LOWER, pole);
      near(distance(shoulder, joint), J.UPPER, 1e-6, 'upper arm');
      near(distance(joint, end), J.LOWER, 1e-6, 'forearm');
    }
    if (!j.stir) assert.ok(distance(p.shoulderR, p.stirHand) <= J.UPPER + J.LOWER + 1e-6, `the paddle is out of reach at ${time.toFixed(2)} s`);
  }
});

test('the pour tips the jug so its mouth sits over the funnel, within his reach', async () => {
  const S = await bundle('still');
  const { FUNNEL, JUNIOR } = await bundle('layout');
  const J = await bundle('junior');
  const mouth = { x: FUNNEL.x + 2, y: FUNNEL.y - 24 };
  const hand = S.handForSpout(mouth, 1.25);
  const spout = S.spoutOf(hand.x, hand.y, 1.25);
  near(spout.x, mouth.x, 1e-9);
  near(spout.y, mouth.y, 1e-9);
  const shoulder = { x: JUNIOR.x - 56, y: JUNIOR.shoulder + 4 };
  assert.ok(distance(shoulder, hand) < J.UPPER + J.LOWER, 'the free hand reaches the pour');
});

test('the flights are closed forms that end exactly where they land', async () => {
  const J = await bundle('junior');
  for (const landing of ['pool', 'truck', 'tree', 'ufo']) {
    const T = J.landTime(landing);
    let last = J.flightAt(landing, 0);
    for (let u = 1 / 120; u < T; u += 1 / 120) {
      const f = J.flightAt(landing, u);
      assert.ok(distance(f, last) < 80, `${landing}: a jump at ${u.toFixed(3)} s`);
      last = f;
    }
    assert.equal(J.flightAt(landing, T + 0.01).landed, true);
  }
  const { chairFlight, CHAIR_LAND } = await bundle('cuz');
  for (const slot of [0, 1, 2]) {
    const before = chairFlight(slot, CHAIR_LAND - 1e-6);
    const after = chairFlight(slot, CHAIR_LAND + 1e-6);
    assert.ok(distance(before, after) < 1, `the chair lands where it flew (slot ${slot})`);
  }
});

test('the blast is the same every time for the same crash point, and every piece comes to rest', async () => {
  const B = await bundle('blast');
  const a = B.createBlast(907);
  const b = B.createBlast(907);
  assert.deepEqual(a.pieces, b.pieces);
  const c = B.createBlast(908);
  assert.notDeepEqual(a.pieces.map((p) => p.vx), c.pieces.map((p) => p.vx));
  for (const p of a.pieces) {
    const late = B.pieceAt(p, 12);
    const later = B.pieceAt(p, 13);
    near(late.x, later.x, 1e-6, `${p.kind} x`);
    near(late.y, later.y, 1e-6, `${p.kind} y`);
    assert.equal(late.down, true, `${p.kind} is down`);
  }
});

test('the gauge and the jars follow the multiplier', async () => {
  const S = await bundle('still');
  assert.equal(S.gaugeLevelAt(1), 0);
  assert.equal(S.gaugeLevelAt(3.99), 0);
  assert.equal(S.gaugeLevelAt(4), 1);
  assert.equal(S.gaugeLevelAt(40), 2);
  assert.equal(S.gaugeLevelAt(400), 3);
  assert.equal(S.psiAt(4), S.gaugeMax(0), 'the tire gauge pins exactly when it is swapped');
  assert.equal(Math.floor(S.jarsAt(1)), 0);
  assert.ok(Math.floor(S.jarsAt(2)) === 2);
});
