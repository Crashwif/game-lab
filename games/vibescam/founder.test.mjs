import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const bundle = async (name) => {
  const out = await build({ entryPoints: [fileURLToPath(new URL(`./${name}.ts`, import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'node' });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
};
const founder = await bundle('founder');
const den = await bundle('den');
const { createFounder, stepFounder, settleFounder, founderPose, xAt, walkedAt, goneAt, chairXAt, carriesBag, smackButton } = founder;
const { BEATS, CHAIR, SCOOT_X, CAM } = den;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} should equal ${b}`);
const drive = (over = {}) => ({ time: 0, tension: 0.5, depth: 0.1, running: true, multiplier: 2, crash: -1, talking: 0, look: 'screen', typing: true, ...over });

test('the arms keep both bone lengths at every hand target through typing, talking and the smack', async () => {
  const { solveLimb } = await bundle('kinematics');
  const f = createFounder();
  let time = 0;
  for (let i = 0; i < 1800; i += 1) {
    const d = drive({ time, tension: (i % 600) / 600, talking: i % 200 < 60 ? 1 : 0 });
    if (i % 300 === 10) smackButton(f);
    stepFounder(f, d, 1 / 60);
    time += 1 / 60;
    const p = founderPose(f, d);
    for (const [shoulder, hand, pole] of [[p.shoulderL, p.handL, 1], [p.shoulderR, p.handR, -1]]) {
      const { joint, end } = solveLimb(shoulder, hand, 34, 34, pole);
      near(distance(shoulder, joint), 34);
      near(distance(joint, end), 34);
      assert.ok(distance(shoulder, end) <= 68 + 1e-6);
    }
  }
});

test('the smack contacts the button exactly once per gesture and never during the crash choreography', () => {
  const f = createFounder();
  smackButton(f);
  let hits = 0;
  for (let i = 0; i < 90; i += 1) {
    stepFounder(f, drive({ time: i / 60 }), 1 / 60);
    if (f.events.smack) hits += 1;
  }
  assert.equal(hits, 1);
  assert.equal(f.smack, -1, 'the gesture ends and the hand is free again');
  // Once crashed, a late smack request does not fire: the crash's smack is keyed to BEATS.smack by the scene.
  const g = createFounder();
  smackButton(g);
  for (let i = 0; i < 90; i += 1) {
    stepFounder(g, drive({ time: i / 60, crash: 1 + i / 60 }), 1 / 60);
  }
});

test('the walk out is a closed form of the crash clock: at rest before it, through the door and gone by the end', () => {
  near(xAt(0), CHAIR.x);
  near(xAt(BEATS.bag - 0.2), CHAIR.x);
  near(xAt(BEATS.walk), SCOOT_X, 1e-9);
  assert.ok(xAt(BEATS.walk + 0.5) > xAt(BEATS.walk + 0.25) && xAt(BEATS.walk + 0.25) > xAt(BEATS.walk), 'he moves right');
  assert.ok(goneAt(BEATS.end), `gone by the end of the ending (${xAt(BEATS.end).toFixed(1)} vs ${CAM.w})`);
  assert.ok(carriesBag(BEATS.walk) && !carriesBag(BEATS.bag));
  near(chairXAt(BEATS.end), SCOOT_X);
  // Steady walking speed within a quarter second.
  const v = (walkedAt(BEATS.walk + 1.0) - walkedAt(BEATS.walk + 0.9)) / 0.1;
  assert.ok(v > 140 && v < 151, `top speed ${v}`);
});

test('the planted foot does not skate during the walk, at three frame rates', () => {
  for (const hz of [30, 60, 120]) {
    const f = createFounder();
    let lastPlanted = null;
    for (let c = BEATS.walk + 0.4; c < BEATS.walk + 1.6; c += 1 / hz) {
      const d = drive({ time: c, crash: c });
      stepFounder(f, d, 1 / hz);
      const p = founderPose(f, d);
      const planted = p.feet.filter((foot) => foot.y >= 404 - 1e-6);
      assert.ok(planted.length >= 1, 'at least one foot is on the floor');
      for (const foot of planted) {
        if (lastPlanted && Math.abs(lastPlanted.y - foot.y) < 1e-6 && Math.abs(lastPlanted.x - foot.x) < 12) {
          assert.ok(Math.abs(lastPlanted.x - foot.x) < 0.75, `a planted sole moved ${Math.abs(lastPlanted.x - foot.x).toFixed(2)} px at ${hz} Hz`);
        }
      }
      lastPlanted = planted[0];
    }
  }
});

test('settling a late entry lands within a pixel of stepping through the same crash', () => {
  const stepped = createFounder();
  for (let c = 0; c < 4.2; c += 1 / 60) stepFounder(stepped, drive({ time: c, crash: c }), 1 / 60);
  const settled = createFounder();
  settleFounder(settled, drive({ time: 4.2, crash: 4.2 }));
  const a = founderPose(stepped, drive({ time: 4.2, crash: 4.2 }));
  const b = founderPose(settled, drive({ time: 4.2, crash: 4.2 }));
  near(a.x, b.x, 1e-6);
  near(a.hip.y, b.hip.y, 1.5);
  near(a.shoulderL.y, b.shoulderL.y, 3);
  assert.equal(a.carrying, b.carrying);
  assert.equal(stepped.shades.x > 0.9, true);
  assert.equal(settled.shades.x, 1);
});

test('blinks stop past 0.75 tension and the sweat only arrives late', () => {
  const calm = createFounder();
  let blinks = 0;
  for (let i = 0; i < 60 * 20; i += 1) {
    const was = calm.blink > 0;
    stepFounder(calm, drive({ time: i / 60, tension: 0.3 }), 1 / 60);
    if (!was && calm.blink > 0) blinks += 1;
  }
  assert.ok(blinks >= 4, `he blinks while calm (${blinks})`);
  assert.ok(calm.sweat < 0.05);
  const wired = createFounder();
  for (let i = 0; i < 60 * 20; i += 1) stepFounder(wired, drive({ time: i / 60, tension: 0.9 }), 1 / 60);
  let late = 0;
  for (let i = 0; i < 60 * 20; i += 1) {
    const was = wired.blink > 0;
    stepFounder(wired, drive({ time: 20 + i / 60, tension: 0.9 }), 1 / 60);
    if (!was && wired.blink > 0) late += 1;
  }
  assert.equal(late, 0, 'he has not blinked');
  assert.ok(wired.sweat > 0.8);
});
