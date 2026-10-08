import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { ROOT } from './pack.mjs';

const modules = new Map();
async function source(path) {
  if (!modules.has(path)) modules.set(path, build({ absWorkingDir: ROOT, entryPoints: [`games/${path}.ts`], bundle: true, format: 'esm', platform: 'node', write: false }).then(r => import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`)));
  return modules.get(path);
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const close = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${a} ≠ ${b}`);

function canvas() {
  const commands = [];
  const target = { commands, canvas: { width: 1920, height: 1080 }, measureText: text => ({ width: text.length * 8 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), getTransform() { throw new Error('Rig must not read the canvas device transform'); } };
  return new Proxy(target, { get: (obj, key) => key in obj ? obj[key] : (...args) => { for (const a of args) if (typeof a === 'number') assert.ok(Number.isFinite(a), `${String(key)} received a nonfinite coordinate`); commands.push([key, ...args]); } });
}

test('acting gait plants its stance foot and enters/exits swing with zero world velocity', async () => {
  const { stepFoot, solveLimb } = await source('family-meeting/kinematics');
  for (const stride of [24, 46, 58, 74, 84]) {
    const planted = stepFoot(stride * .1, stride, 0, 14).x + stride * .1;
    for (const phase of [.2, .4, .57]) close(stepFoot(stride * phase, stride, 0, 14).x + stride * phase, planted);
    for (const phase of [.58, 1]) {
      const d = stride * phase, epsilon = 1e-4;
      const velocity = ((d + epsilon + stepFoot(d + epsilon, stride, 0, 14).x) - (d - epsilon + stepFoot(d - epsilon, stride, 0, 14).x)) / (2 * epsilon);
      assert.ok(Math.abs(velocity) < 1e-4);
    }
  }
  for (let angle = -Math.PI; angle <= Math.PI; angle += .04) {
    const origin = { x: 3, y: -20 }, target = { x: 3 + Math.cos(angle) * 150, y: -20 + Math.sin(angle) * 150 };
    const solved = solveLimb(origin, target, 48, 38, -1);
    close(distance(origin, solved.joint), 48); close(distance(solved.joint, solved.end), 38);
  }
});

test('Andy keeps fixed elbow poles and full bone lengths throughout the startle', async () => {
  const { createAndy, computePose } = await source('andys-loud-garden/andy');
  const rig = createAndy(300); let previous;
  for (let i = 0; i <= 390; i++) {
    rig.raise.x = i / 300;
    const pose = computePose(rig);
    for (const name of ['backArm', 'frontArm']) {
      const { root, joint, end } = pose[name];
      close(distance(root, joint), 44); close(distance(joint, end), 44);
      const pole = (end.x - root.x) * (joint.y - root.y) - (end.y - root.y) * (joint.x - root.x);
      assert.ok(pole > 0, `${name} keeps its bend direction through the startle`);
      if (previous) assert.ok(distance(previous[name].joint, joint) < 2, `${name} elbow moves continuously`);
    }
    close(distance(pose.backHand, pose.backArm.end), 0);
    close(distance(pose.frontHand, pose.frontArm.end), 0);
    previous = pose;
  }
  rig.raise.x = 1;
  const pose = computePose(rig);
  for (const name of ['backArm', 'frontArm', 'backLeg', 'frontLeg', 'head']) {
    assert.deepEqual(pose[name], previous[name], 'spring overshoot cannot extend the authored startle pose');
  }
});

test('Gas Fees starts a squeezed cashout at the currently occupied position at 30/60/120 Hz', async () => {
  const m = await source('gas-fees/riders');
  for (const fps of [30, 60, 120]) {
    const s = m.createSuit(); m.settleSuit(s, 1, 1, false);
    const before = { x: s.x, depth: s.depth }; m.leaveLift(s);
    m.stepSuit(s, { running: true, tension: 1, squeeze: 1 }, 0);
    close(s.x, before.x); close(s.depth, before.depth);
    for (let i = 0; i < fps; i++) {
      const x = s.x; m.stepSuit(s, { running: false, tension: 1, squeeze: 1 }, 1 / fps);
      assert.ok(Math.abs(s.x - x) < 6, 'exit advances smoothly without restoring the unsqueezed origin');
    }
    assert.equal(s.mode, 'gone');
  }
});

test('OnlyFrens heart births follow an eight-Hz clock rather than render count', async () => {
  const m = await source('onlyfrens/stream');
  const samples = [];
  for (const fps of [30, 60, 120]) {
    const s = m.createStream();
    for (let i = 0; i < fps * 2; i++) m.stepStream(s, { running: true, tension: 1, multiplier: 5, reduced: false }, 1 / fps);
    samples.push(s.hearts.map(h => [h.life, h.size]));
  }
  assert.ok(samples[0].length > 0); assert.deepEqual(samples[0], samples[1]); assert.deepEqual(samples[1], samples[2]);
  const reduced = m.createStream();
  for (let i = 0; i < 120; i++) m.stepStream(reduced, { running: true, tension: 1, multiplier: 5, reduced: true }, 1 / 60);
  assert.equal(reduced.hearts.length, 0);
});

test('Hacked wrist is reachable and continuous around former wave/shrug thresholds', async () => {
  const { starFreeHand } = await source('i-got-hacked/mansion');
  for (const threshold of [.2, .3]) for (const time of [0, .4, 1.7]) {
    const a = starFreeHand(threshold - 1e-5, .1, time), b = starFreeHand(threshold + 1e-5, .1, time);
    assert.ok(distance(a, b) < .01);
    assert.ok(distance(starFreeHand(.9, threshold - 1e-5, time), starFreeHand(.9, threshold + 1e-5, time)) < .01);
  }
  for (let i = 0; i <= 100; i++) assert.ok(distance({ x: 50, y: -126 }, starFreeHand(i / 100, 0, 1)) <= 68);
});

test('Family Meeting slam cue crosses the authored table-contact pose', async () => {
  const m = await source('family-meeting/family');
  close(m.fistLift(.55), 0); assert.ok(m.fistLift(.45) > 0);
  for (const fps of [30, 60, 120]) {
    const parents = m.createParents(); parents[0].slamT = .54;
    const events = m.stepParents(parents, { running: false, tension: 0, time: 0, reduced: false, herLine: false, left: false }, 1 / fps);
    assert.equal(events.slam, true);
    assert.ok(m.fistLift(parents[0].slamT) < 3, 'cue occurs at contact/rebound, not maximum anticipation');
  }
});

test('Hopium doctor sockets invert correctly and render cables without using device coordinates', async () => {
  const m = await source('hopium-drip/ward'), w = m.createWard();
  for (const lunge of [0, .5, 1.1]) {
    w.lunge.x = lunge; w.doctorLean.x = .8; w.time = 17;
    for (const local of [{ x: -62, y: -142 }, { x: -6, y: -152 }]) {
      assert.ok(distance(m.doctorPoint(w, m.doctorPoint(w, local), true), local) < 1e-7);
    }
    w.paddles.x = 1;
    const c = canvas(); c.scale(2, 2); c.translate(13, -4); m.drawWard(c, w, .8, false);
    assert.ok(c.commands.some(command => command[0] === 'quadraticCurveTo'));
  }
  const origin = m.doctorPoint(w, { x: -14, y: -150 }); m.flatline(w, 500, false);
  assert.deepEqual(w.clipOrigin, origin);
});

test('Wife stairs use stationary support feet and departure survives a crash drive', async () => {
  const m = await source('wife-changing-money/trader');
  let plantedPairs = 0;
  for (let age = 2.1; age < 4.6; age += .001) for (const side of [-1, 1]) {
    const a = m.traderFoot(age, side), b = m.traderFoot(age + .001, side);
    assert.ok(distance(a, b) < 3, 'tread change occurs during the continuous swing');
    if (distance(a, b) < 1e-7) plantedPairs++;
  }
  assert.ok(plantedPairs > 2000);
  const t = m.createTrader();
  for (let i = 0; i < 420; i++) m.stepTrader(t, { running: i < 35, fear: 0, leaving: true, time: i / 60 }, 1 / 60);
  assert.equal(t.mode, 'upstairs');
});

test('Sponsor grip lifts continuously and remains in reach of a fixed sleeve/forearm', async () => {
  const { sponsorGrip } = await source('not-financial-advice/studio');
  let prior = sponsorGrip(0);
  for (let i = 1; i <= 100; i++) {
    const grip = sponsorGrip(i / 100);
    assert.ok(distance(grip, prior) < 2); assert.ok(distance(grip, { x: 232, y: 250 }) < 96);
    prior = grip;
  }
});

test('Thanksgiving cane grip stays inside Grandma arm reach through its full raise', async () => {
  const { caneGrip } = await source('thanksgiving-uncle/folks');
  for (let i = 0; i <= 100; i++) assert.ok(distance(caneGrip(i / 100), { x: -14, y: -58 }) < 61);
  const grip = caneGrip(0); close(grip.y + 70, 0);
});

test('Blanket feet have separate impulses while quilt tucks remain attached to each ankle', async () => {
  const { sleeperFeet } = await source('blanket-champ/sleepers');
  const feet = sleeperFeet({ time: 1, beat: 1, lift: .6, tension: 1, active: true, finished: false, rest: 0, tremble: 0 });
  assert.ok(new Set(feet.map(f => f.kick)).size >= 3);
  for (const foot of feet) close(distance(foot, foot.tuck), Math.hypot(14, 8));
});

test('Clown appointment transitions are continuous and a crash still renders a full rig', async () => {
  const m = await source('know-your-clown/character'), { directionAt } = await source('know-your-clown/direction');
  const pose = seconds => { const d = directionAt(seconds * 1000); return { time: seconds, tension: d.tension, stage: d.stage, level: d.level, action: d.action, x: 511, y: 427, scale: 1, reduced: false, mode: d.stage === 4 ? 'dance' : 'scan', progress: 0 }; };
  for (const at of [18, 37, 57, 78, 100, 125, 150, 174, 192, 210]) {
    const a = m.applicantRig(pose(at - 1e-6)), b = m.applicantRig(pose(at));
    for (const key of ['left', 'right', 'hip', 'chest']) assert.ok(distance(a[key], b[key]) < .01, `${at}s ${key} must not jump`);
  }
  globalThis.Path2D = class {};
  const normal = canvas(), boxed = canvas();
  m.drawApplicant(normal, pose(17)); m.drawApplicant(boxed, { ...pose(17), mode: 'boxed' });
  const bodyLines = c => c.commands.filter(command => command[0] === 'lineTo').length;
  assert.ok(bodyLines(boxed) >= bodyLines(normal), 'body and articulated limbs survive the first crash frame');
});


test('departing daughter, patient and fan ease both feet out of their standing contacts', async () => {
  for (const game of ['family-meeting', 'hopium-drip', 'i-got-hacked']) {
    const { walkingFoot } = await source(`${game}/kinematics`);
    for (const stride of [46, 74, 84]) for (const phase of [0, .5]) {
      const planted = walkingFoot(0, stride, phase, 16);
      close(planted.x, 0); close(planted.y, 0);
      assert.ok(distance(planted, walkingFoot(.001, stride, phase, 16)) < 1e-6, 'the first moving frame must grow continuously from rest');
      let previous = planted;
      for (let traveled = .25; traveled < 60; traveled += .25) {
        const foot = walkingFoot(traveled, stride, phase, 16);
        assert.ok(distance(foot, previous) < 1.5, 'entry ramp and its handoff to the full gait remain continuous');
        previous = foot;
      }
    }
  }
});


test('Wife small leg proportions remain reachable over every floor and stair support pose', async () => {
  const { createTrader, exitPose, traderStance } = await source('wife-changing-money/trader');
  const trader = createTrader(), seated = traderStance(trader);
  assert.ok(seated.upper + seated.lower < 32, 'seated projection retains the original compact silhouette');
  trader.mode = 'sneak'; let prior;
  for (let age = 0; age <= 4.85; age += .001) {
    Object.assign(trader, exitPose(age), { modeAge: age });
    const p = traderStance(trader);
    assert.ok(p.upper + p.lower <= 54, 'unfolding must not invent oversized legs');
    p.feet.forEach((foot, i) => {
      const hip = { x: trader.x + (i ? 8 : -8), y: p.rootY + p.hipY };
      assert.ok(distance(hip, foot) <= p.upper + p.lower + 1e-7, `unreachable tread at ${age}s`);
    });
    if (prior) assert.ok(Math.abs(p.rootY - prior.rootY) < 2, 'support transfer must not teleport the pelvis');
    prior = p;
  }
});


test('Wife unfolds into her first walking cycle without changing either planted sole at .25s', async () => {
  const { traderFoot } = await source('wife-changing-money/trader');
  for (const side of [-1, 1]) {
    const before = traderFoot(.25 - 1e-8, side), at = traderFoot(.25, side), after = traderFoot(.25 + 1e-8, side);
    assert.ok(distance(before, at) < 1e-6, 'unfold and walk must share exactly the same contact');
    assert.ok(distance(at, after) < 1e-6, 'the first cycle must not introduce a new foot offset');
    for (const fps of [30, 60, 120]) {
      let prior = traderFoot(.25 - 1 / fps, side);
      for (let age = .25; age <= .35; age += 1 / fps) {
        const foot = traderFoot(age, side);
        assert.ok(distance(foot, prior) < 8, `${fps}Hz entry must not hide a15px foot pop`);
        prior = foot;
      }
    }
  }
});
