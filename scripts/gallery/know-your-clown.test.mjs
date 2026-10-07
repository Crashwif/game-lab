import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { directionAt, multiplierLabel } from '../../games/know-your-clown/direction.ts';

test('Know Your Clown introduces distinct physical acts beyond two minutes', () => {
  const earlier = [0, 18_000, 37_000, 57_000, 78_000].map(directionAt);
  const late = [100_000, 125_000, 150_000].map(directionAt);
  assert.equal(new Set(late.map((act) => act.stage)).size, 3);
  for (const act of late) {
    assert.ok(earlier.every((before) => before.stage !== act.stage), `${act.title} has its own late physical act`);
    assert.ok(act.demand.length > 0);
    assert.equal(act.age, 0);
  }
  assert.equal(directionAt(124_999).stage, late[0].stage);
  assert.equal(directionAt(149_999).stage, late[1].stage);
});

test('Know Your Clown continues changing appointments throughout exceptionally long rounds', () => {
  const appointments = [174_000, 192_000, 210_000, 600_000].map(directionAt);
  assert.equal(new Set(appointments.map((act) => act.serial)).size, appointments.length);
  assert.equal(new Set(appointments.map((act) => act.title)).size, appointments.length);
  assert.ok(appointments.every((act) => act.serial > directionAt(150_000).serial));
  assert.equal(appointments[0].age, 0);
  assert.equal(appointments[1].age, 0);
  assert.equal(appointments[2].age, 0);
  assert.ok(appointments[3].age < 18);

  const first = directionAt(174_000);
  const recurring = directionAt(282_000);
  assert.equal(recurring.title, first.title);
  assert.ok(recurring.serial > first.serial, 'a returning procedure has another appointment identity');
  assert.equal(recurring.age, 0);
});

test('Know Your Clown keeps bounded changing motion after the authored acts', () => {
  for (const start of [150_000, 240_000, 600_000, 3_600_000, 60_000_000]) {
    const frames = Array.from({ length: 48 }, (_, index) => directionAt(start + index * 100));
    for (const frame of frames) {
      for (const field of ['seconds', 'stage', 'serial', 'age', 'cycle', 'action', 'tension']) {
        assert.ok(Number.isFinite(frame[field]), `${field} is finite at ${frame.seconds}s`);
      }
      assert.ok(frame.tension >= 0 && frame.tension < 1, `tension leaves headroom at ${frame.seconds}s`);
      assert.ok(frame.action >= 0 && frame.action < 1, `motion stays within its cycle at ${frame.seconds}s`);
      assert.ok(frame.age >= 0);
    }
    const tensions = frames.map((frame) => frame.tension);
    assert.ok(Math.max(...tensions) - Math.min(...tensions) > 0.01, `tension still breathes after ${start / 1000}s`);
    assert.ok(new Set(frames.map((frame) => frame.action)).size > 20, `apparatus remains in motion after ${start / 1000}s`);
  }
});

test('Know Your Clown seeks directly to the same act and action regardless of frame history', () => {
  const sampleTimes = [0, 57_123, 124_999, 125_000, 173_999, 174_000, 193_200, 604_321];
  const firstPass = sampleTimes.map(directionAt);
  for (let elapsed = 0; elapsed < 610_000; elapsed += 1_000) directionAt(elapsed);
  for (let index = sampleTimes.length - 1; index >= 0; index--) {
    assert.deepEqual(directionAt(sampleTimes[index]), firstPass[index]);
  }
  const sought = directionAt(193_200);
  assert.ok(Math.abs(sought.age - 1.2) < 1e-9);
  assert.ok(Math.abs(sought.action - 0.25) < 1e-9);
  for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.deepEqual(directionAt(invalid), directionAt(0));
  }
});

test('Know Your Clown displays full high multipliers with their supplied hundredths', () => {
  assert.equal(multiplierLabel(100), '1.00×');
  assert.equal(multiplierLabel(133_943), '1339.43×');
  assert.equal(multiplierLabel(810_308), '8103.08×');
  assert.equal(multiplierLabel(4_294_967_295), '42949672.95×');
  assert.equal(multiplierLabel(1_234_567_890_123), '12345678901.23×');
});

test('Know Your Clown has a verified replay that reaches every authored act', async () => {
  const { replayTimeline, verifyReplay } = await import('../../packages/game-sdk/dist/index.js');
  const { free } = await import('../../packages/crash-math/dist/index.js');
  const replay = JSON.parse(await readFile(new URL('../../games/know-your-clown/replay.json', import.meta.url), 'utf8'));
  assert.equal(replay.gameId, 'know-your-clown');
  assert.deepEqual(verifyReplay(replay), { ok: true, problems: [] });
  assert.ok(free.msToReach(replay.crashX100) > 150_000, 'the committed replay runs through the final authored act');
  const timeline = replayTimeline(replay);
  const lateFrame = timeline.find(({ event }) => event.type === 'tick' && event.elapsedMs >= 150_000);
  assert.ok(lateFrame, 'replay playback contains the late act, beyond poster capture time');
  assert.equal(directionAt(lateFrame.event.elapsedMs).stage, directionAt(150_000).stage);
  const crashed = timeline.at(-1).event;
  assert.equal(crashed.type, 'round.crashed');
  assert.equal(crashed.result.crashX100, replay.crashX100);
  assert.equal(crashed.durationMs, free.msToReach(replay.crashX100));
});
