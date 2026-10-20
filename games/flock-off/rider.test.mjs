// Headless tests for the rig: run with node --test games/flock-off/*.test.mjs (not part of npm test).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const dir = fileURLToPath(new URL('.', import.meta.url));
async function load(name) {
  const result = await build({ entryPoints: [`${dir}${name}.ts`], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const R = await load('rider');
const COPS = await load('cops');
const len = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const frame = { x: 300, y: 452, angle: 0 };
const drive = (over) => ({ distance: 0, speed: 250, hop: 0, hopU: 0, aim: { x: 700, y: 250 }, ...over });

test('both legs and both arms keep their bone lengths at every crank angle and aim, and the ankles ride over the pedals', () => {
  const rig = R.createRider();
  R.settleRider(rig, drive());
  let checked = 0;
  for (let distance = 0; distance < 3000; distance += 7) {
    for (const aim of [{ x: 700, y: 250 }, { x: 900, y: 50 }, { x: 320, y: 60 }, { x: 60, y: 300 }, { x: 310, y: 340 }, null]) {
      const pose = R.riderPose(rig, drive({ distance, aim }), frame);
      assert.ok(Math.abs(len(pose.hip, pose.kneeR) - R.UPPER_LEG) < 1e-6 && Math.abs(len(pose.kneeR, pose.footR) - R.LOWER_LEG) < 1e-6);
      const farHip = { x: pose.hip.x + R.FAR_HIP.x, y: pose.hip.y + R.FAR_HIP.y };
      const farShoulder = { x: pose.shoulder.x + R.FAR_SHOULDER.x, y: pose.shoulder.y + R.FAR_SHOULDER.y };
      assert.ok(Math.abs(len(farHip, pose.kneeL) - R.UPPER_LEG) < 1e-6 && Math.abs(len(pose.kneeL, pose.footL) - R.LOWER_LEG) < 1e-6);
      assert.ok(Math.abs(len(farShoulder, pose.elbowL) - R.UPPER_ARM) < 1e-6 && Math.abs(len(pose.elbowL, pose.handL) - R.LOWER_ARM) < 1e-6);
      assert.ok(Math.abs(len(pose.shoulder, pose.elbowR) - R.UPPER_ARM) < 1e-6 && Math.abs(len(pose.elbowR, pose.handR) - R.LOWER_ARM) < 1e-6);
      // The near ankle rides just over the near pedal, which turns with distance through the gearing; the knee bends forward.
      const crank = distance / R.WHEEL / R.GEAR;
      const pedal = R.toScreen(frame, { x: R.BB.x + R.CRANK * Math.cos(crank) + R.ANKLE.x, y: R.BB.y + R.CRANK * Math.sin(crank) + R.ANKLE.y });
      assert.ok(len(pose.footR, pedal) < 0.01, `the ankle is ${len(pose.footR, pedal).toFixed(2)} px off the pedal at ${distance}`);
      const mid = { x: (pose.hip.x + pose.footR.x) / 2, y: (pose.hip.y + pose.footR.y) / 2 };
      if (pose.footR.y > pose.hip.y + 30) assert.ok(pose.kneeR.x >= mid.x - 0.01, 'the knee points forward');
      // The far hand holds the grip.
      assert.ok(len(pose.handL, R.toScreen(frame, R.GRIP)) < 0.01);
      if (aim) {
        // The gun hand reaches toward the reticle and the muzzle is a gun's length further on.
        assert.ok(Math.abs(len(pose.shoulder, pose.handR) - R.REACH) < 1e-6);
        assert.ok(Math.abs(len(pose.handR, pose.muzzle) - R.GUN_LENGTH) < 1e-6);
        const toAim = Math.atan2(aim.y - pose.shoulder.y, aim.x - pose.shoulder.x);
        const toHand = Math.atan2(pose.handR.y - pose.shoulder.y, pose.handR.x - pose.shoulder.x);
        assert.ok(Math.abs(Math.atan2(Math.sin(toAim - toHand), Math.cos(toAim - toHand))) < 1e-6, 'the hand is on the line to the reticle');
      } else assert.equal(pose.gun, null);
      checked++;
    }
  }
  assert.ok(checked > 2000);
});

test('the pose is pure and continuous in distance, and the frame carries everything', () => {
  const rig = R.createRider();
  R.settleRider(rig, drive());
  const a = R.riderPose(rig, drive({ distance: 500 }), frame);
  const b = R.riderPose(rig, drive({ distance: 500 }), frame);
  assert.deepEqual(a, b);
  let last = a;
  for (let distance = 501; distance < 900; distance++) {
    const pose = R.riderPose(rig, drive({ distance }), frame);
    for (const key of ['footR', 'footL', 'kneeR', 'kneeL', 'handR', 'elbowR', 'head']) assert.ok(len(pose[key], last[key]) < 3, `${key} jumps ${len(pose[key], last[key]).toFixed(1)} px`);
    last = pose;
  }
  const lifted = R.riderPose(rig, drive({ distance: 500 }), { x: 300, y: 420, angle: -0.2 });
  assert.ok(lifted.hip.y < a.hip.y - 20, 'a hop lifts the whole rider');
  assert.ok(Math.abs(len(lifted.hip, lifted.kneeR) - R.UPPER_LEG) < 1e-6);
});

test('he sits at rest and rises into the crouch with speed', () => {
  const rig = R.createRider();
  R.settleRider(rig, drive({ speed: 0 }));
  const seated = R.riderPose(rig, drive({ speed: 0 }), frame);
  R.settleRider(rig, drive({ speed: 300 }));
  const crouched = R.riderPose(rig, drive({ speed: 300 }), frame);
  assert.ok(crouched.hip.y < seated.hip.y - 10, 'the hips come up off the saddle');
  assert.ok(crouched.hip.x > seated.hip.x + 8, 'and forward over the bottom bracket');
  for (const pose of [seated, crouched]) assert.ok(Math.abs(len(pose.hip, pose.kneeR) - R.UPPER_LEG) < 1e-6);
});

test('the springs land on the same pose at 30, 60 and 120 Hz, and a landing squats', () => {
  const results = [];
  for (const hz of [30, 60, 120]) {
    const rig = R.createRider();
    R.settleRider(rig, drive({ hop: 20, hopU: 0.5 }));
    let landed = false;
    for (let f = 0; f < 3 * hz; f++) {
      const t = f / hz;
      const hop = t < 0.3 ? 20 : 0;
      R.stepRider(rig, drive({ hop, hopU: hop ? 0.5 : 0 }), 1 / hz);
      if (rig.events.land) landed = true;
      if (f === Math.round(0.4 * hz)) assert.ok(rig.squat.x > 1, 'the landing dips the hip');
    }
    assert.ok(landed);
    results.push({ lean: rig.lean.x, squat: rig.squat.x, nod: rig.nod.x });
  }
  for (const r of results) {
    assert.ok(Math.abs(r.lean - results[0].lean) < 0.01);
    assert.ok(Math.abs(r.squat - results[0].squat) < 0.1);
    assert.ok(Math.abs(r.nod - results[0].nod) < 0.02);
  }
  // Recoil is a kick that rings down to nothing.
  const rig = R.createRider();
  R.settleRider(rig, drive());
  R.recoilRider(rig);
  assert.ok(rig.kick.v > 0);
  for (let f = 0; f < 120; f++) R.stepRider(rig, drive(), 1 / 60);
  assert.ok(Math.abs(rig.kick.x) < 0.01);
});

test('the thrown figure keeps its bone lengths and the bust is a pure function of crash time', () => {
  for (let t = 0; t < 5; t += 0.05) {
    for (const angle of [0, 1, Math.PI / 2, -Math.PI / 2, 3]) {
      const pose = COPS.ragdollPose({ x: 400, y: 300 }, angle, 1, t);
      assert.ok(Math.abs(len(pose.hip, pose.kneeR) - R.UPPER_LEG) < 1e-6 && Math.abs(len(pose.kneeR, pose.footR) - R.LOWER_LEG) < 1e-6);
      assert.ok(Math.abs(len(pose.shoulder, pose.elbowL) - R.UPPER_ARM) < 1e-6 && Math.abs(len(pose.elbowL, pose.handL) - R.LOWER_ARM) < 1e-6);
      assert.ok(len(pose.hip, pose.head) > 40 && len(pose.hip, pose.head) < 80);
    }
  }
  const a = COPS.bustFor(907, 1000, 300, 5, true, false, 200);
  const b = COPS.bustFor(907, 1000, 300, 5, true, false, 200);
  assert.deepEqual(a, b);
  assert.ok(COPS.CAUSES_SEEN === undefined);
  const causes = new Set();
  for (let x = 101; x < 400; x++) causes.add(COPS.bustFor(x, 0, 0, 0, false, false, 200).cause);
  assert.equal(causes.size, 5, 'every cause comes up');
  // The clock stands still through the freeze and crawls through the slow motion.
  assert.equal(COPS.bustClock(0.1), 0);
  assert.ok(COPS.bustClock(0.3) > 0 && COPS.bustClock(0.3) < 0.1);
  assert.ok(Math.abs(COPS.bustClock(3) - COPS.bustClock(2) - 1) < 1e-9);
  assert.ok(COPS.coast(300, 0) === 0 && COPS.coast(300, 5) < 300 / 2);
});

test('the pursuit arrives with the multiplier, settles for a late entry, and resets', () => {
  const p = COPS.createPursuit();
  assert.equal(COPS.heatLabel(p), 'NOBODY YET');
  assert.equal(COPS.stepPursuit(p, 1.1, 0), null);
  assert.equal(COPS.stepPursuit(p, 1.25, 1), 'cruiser');
  assert.equal(COPS.stepPursuit(p, 1.25, 2), null);
  assert.equal(COPS.heatLabel(p), 'ONE CRUISER');
  COPS.settlePursuit(p, 10, 0);
  assert.equal(COPS.heatLabel(p), 'THE FEDS');
  assert.ok(COPS.onRoad(p, 0) && COPS.onRoad(p, 6) && !COPS.onRoad(p, 7));
  assert.equal(COPS.stepPursuit(p, 10, 0.1), null, 'a settled pursuit replays no arrival');
  COPS.resetPursuit(p);
  assert.equal(COPS.heatLabel(p), 'NOBODY YET');
  assert.ok(COPS.leadGap(0, 0) > COPS.leadGap(0.9, 0) && COPS.leadGap(0.5, 1) < COPS.leadGap(0.5, 0));
});
