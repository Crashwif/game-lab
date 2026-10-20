import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARM_LENGTH, ENDING_SECONDS, YETI_SCALE, jacketGrip, solveArm, yetiPose } from './yeti-rig.ts';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`);
const placements = [-31, 0, 31].flatMap(skierOffsetX => [0, 46].flatMap(jumpHeight =>
  [-0.4, 0, 0.4].map(angle => ({ skierOffsetX, jumpHeight, angle }))));

function fixedBones(arm, label) {
  for (const joint of [arm.shoulder, arm.elbow, arm.wrist]) {
    assert.ok(Number.isFinite(joint.x) && Number.isFinite(joint.y), `${label}: every joint is finite`);
  }
  near(distance(arm.shoulder, arm.elbow), ARM_LENGTH, `${label}: upper arm`);
  near(distance(arm.elbow, arm.wrist), ARM_LENGTH, `${label}: forearm`);
}

test('two-bone IK keeps both bone lengths for reachable, unreachable and coincident targets', () => {
  const shoulder = { x: 17, y: -83 };
  for (const side of [-1, 1]) {
    for (const target of [
      shoulder,
      { x: 17, y: -83 + 1e-10 },
      { x: 17, y: -140 },
      { x: -28, y: -83 },
      { x: 17, y: 1_000_000 },
      { x: -1_000_000, y: -1_000_000 },
    ]) {
      const arm = solveArm(shoulder, target, side, 1);
      fixedBones(arm, `target ${JSON.stringify(target)}, side ${side}`);
      assert.ok(distance(shoulder, arm.wrist) <= ARM_LENGTH * 2, 'an unreachable target never stretches the chain');
      if (distance(shoulder, target) > 0.001 && distance(shoulder, target) < ARM_LENGTH * 2 - 0.001) {
        near(distance(arm.wrist, target), 0, 'a reachable target is touched');
      }
    }
  }
});

test('arm lengths remain fixed through emergence, airborne reach, grab, turn, feeding and release', () => {
  for (const options of placements) {
    for (let frame = 0; frame <= (ENDING_SECONDS + 0.5) * 120; frame++) {
      const age = frame / 120;
      for (const arm of yetiPose(age, options).arms) {
        fixedBones(arm, `age ${age}, placement ${JSON.stringify(options)}, side ${arm.side}`);
        assert.ok(arm.grip >= 0 && arm.grip <= 1, 'finger closure remains bounded');
      }
    }
  }
});

test('both closed hands stay on the jacket throughout the grab, turn, front hold, lift and feeding', () => {
  for (const options of placements) {
    for (let centisecond = 116; centisecond <= 382; centisecond++) {
      const pose = yetiPose(centisecond / 100, options);
      assert.equal(pose.skier.visible, true, 'the carried skier is still present');
      for (const arm of pose.arms) {
        near(arm.grip, 1, 'the hand is closed');
        near(distance(arm.wrist, jacketGrip(pose.skier, arm.side)), 0, 'wrist stays attached to the jacket');
      }
    }
  }
});

test('the skier retains full height, with width foreshortening only while turning', () => {
  for (const options of placements) {
    for (let frame = 0; frame <= (ENDING_SECONDS + 0.5) * 120; frame++) {
      const pose = yetiPose(frame / 120, options);
      near(pose.skier.scale * YETI_SCALE, 1, 'the yeti transform preserves full skier height');
      assert.ok(pose.skier.width >= 0.35 && pose.skier.width <= 1, 'foreshortening stays readable');
      if (pose.turn === 0 || pose.turn === 1) near(pose.skier.width, 1, 'the front and back poses retain normal width');
    }
    assert.ok(yetiPose(1.725, options).skier.width < 0.4, 'the middle of the turn presents a clear profile');
  }
});

test('the yeti emerges, closes its hands, turns to face us, then visibly hoists and feeds the skier', () => {
  for (const options of placements) {
    const hidden = yetiPose(0, options);
    const emerged = yetiPose(0.55, options);
    const grabbed = yetiPose(1.2, options);
    const profile = yetiPose(1.725, options);
    const facing = yetiPose(2.25, options);
    const raised = yetiPose(3.2, options);
    const feeding = yetiPose(3.8, options);
    assert.equal(hidden.rise, 0, 'the yeti begins inside the hole');
    assert.equal(emerged.rise, 1, 'the yeti emerges before closing its hands');
    assert.ok(emerged.arms.every(arm => arm.grip === 0), 'the reaching hands are initially open');
    assert.ok(grabbed.arms.every(arm => arm.grip === 1), 'the jacket is held before the turn');
    assert.equal(grabbed.turn, 0, 'grabbing happens while the yeti still faces away');
    assert.equal(grabbed.skier.behind, true, 'the skier begins on the far side of the yeti');
    assert.ok(profile.turn > 0.45 && profile.turn < 0.55, 'turning includes a clear intermediate profile');
    assert.equal(facing.turn, 1, 'the yeti faces us before the lift');
    assert.equal(facing.skier.behind, false, 'the carried skier becomes visible in front');
    assert.equal(raised.turn, 1, 'the yeti stays facing us throughout the lift');
    assert.ok((facing.skier.torso.y - raised.skier.torso.y) * YETI_SCALE >= 45,
      'the front-facing hoist visibly raises the skier at least 45 slope pixels');
    assert.equal(raised.skier.clipMouth, false, 'the raised skier is fully visible above the mouth');
    assert.equal(raised.mouth, 1, 'the mouth is open before feeding begins');
    assert.ok(feeding.skier.torso.y > raised.skier.torso.y, 'feeding lowers the skier into the mouth');
    assert.equal(feeding.skier.clipMouth, true, 'the mouth begins occluding the skier only during feeding');
    for (let centisecond = 215; centisecond <= 235; centisecond++) {
      const hold = yetiPose(centisecond / 100, options);
      near(hold.turn, 1, 'the turn completes before the front-facing hold');
      near(hold.skier.torso.y, facing.skier.torso.y, 'the skier pauses in front before being hoisted');
    }
    for (const arm of grabbed.arms) {
      const start = emerged.arms.find(other => other.side === arm.side);
      assert.ok(distance(start.wrist, arm.wrist) * YETI_SCALE >= 40,
        'each hand makes a clearly visible reaching gesture after emergence');
    }
  }
});

test('a late crash visit reconstructs the settled pose without advancing earlier frames', () => {
  for (const options of placements) {
    const settled = yetiPose(10, options);
    assert.equal(settled.skier.visible, false);
    assert.equal(settled.captionReady, true);
    assert.equal(settled.mouth, 0);
    assert.equal(settled.chew, 0);
    assert.ok(settled.arms.every(arm => arm.grip === 0));
    assert.deepEqual(yetiPose(60 * 60, options), settled, 'the post-animation pose stays settled');
    for (const age of [1.7, 0, 2.2, 0.7]) yetiPose(age, options);
    assert.deepEqual(yetiPose(10, options), settled, 'seeking other ages cannot mutate a previously visited pose');
  }
});

test('an escaped skier is never grabbed, redrawn or chewed by the yeti', () => {
  for (const options of placements) {
    for (let frame = 0; frame <= (ENDING_SECONDS + 0.5) * 120; frame++) {
      const pose = yetiPose(frame / 120, { ...options, escaped: true });
      assert.equal(pose.skier.visible, false);
      assert.equal(pose.chew, 0);
      for (const arm of pose.arms) {
        assert.equal(arm.grip, 0);
        fixedBones(arm, 'escaped arm');
      }
    }
  }
});
