import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { directionAt, multiplierLabel } from '../../games/know-your-clown/direction.ts';

let compiledScene;

async function sceneHarness(options = {}) {
  compiledScene ??= build({
    entryPoints: [fileURLToPath(new URL('../../games/know-your-clown/scene.ts', import.meta.url))],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'KycScene',
    plugins: [{
      name: 'record-scene-audio',
      setup(bundler) {
        bundler.onResolve({ filter: /^\.\/audio$/ }, () => ({ path: 'audio', namespace: 'record-scene-audio' }));
        bundler.onLoad({ filter: /.*/, namespace: 'record-scene-audio' }, () => ({ contents: 'export const pageAudio = () => globalThis.sceneAudio;' }));
      },
    }],
  });
  const events = [];
  const labels = [];
  const context = {
    Path2D: class {},
    sceneAudio: {
      update() {},
      fx(name, strength) { events.push({ type: 'fx', name, strength }); },
      cashout() { events.push({ type: 'cashout' }); },
      crash(name, quiet) { events.push({ type: 'crash', name, quiet }); },
    },
  };
  runInNewContext((await compiledScene).outputFiles[0].text, context);
  const scene = context.KycScene.createScene(options);
  const gradient = () => ({ addColorStop() {} });
  const canvas = new Proxy({
    canvas: { width: 960, height: 540 },
    fillText(text) { labels.push(text); },
    measureText(text) { return { width: text.length * 10 }; },
    createLinearGradient: gradient,
    createRadialGradient: gradient,
  }, { get: (target, key) => key in target ? target[key] : () => {} });
  return {
    events,
    draw(patch, now) {
      labels.length = 0;
      scene.draw(canvas, { phase: 'waiting', currentX100: 100, elapsed: 0, crashAge: 0, stake: 50, cashoutX100: null, payout: null, ...patch }, now);
      return labels.join(' ');
    },
  };
}

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

test('an accepted KYC exit remains an escape when the room later crashes', async () => {
  const game = await sceneHarness();
  const cashoutX100 = 4_294_967_295;
  game.draw({ phase: 'running', elapsed: 290_000, currentX100: cashoutX100 }, 0);
  game.draw({ phase: 'running', elapsed: 290_100, currentX100: cashoutX100, cashoutX100 }, 100);
  game.draw({ phase: 'running', elapsed: 291_500, currentX100: cashoutX100, cashoutX100 }, 1_500);
  assert.equal(game.events.filter(({ type }) => type === 'cashout').length, 1);

  for (const [crashAge, now] of [[0, 1_600], [3_000, 4_600]]) {
    const text = game.draw({ phase: 'crashed', elapsed: 300_000, currentX100: 5_000_000_000, crashAge }, now);
    assert.match(text, /PRIVACY INTACT/);
    assert.match(text, /CLAIM ABANDONED/);
    assert.match(text, /CASHED OUT 42949672\.95×/);
    assert.doesNotMatch(text, /CLAIM REJECTED|IDENTITY EXPORTED|\bSOLD\b/);
  }
});

test('a KYC scene opened after the crash settles quietly into the final aftermath', async () => {
  const game = await sceneHarness();
  const view = { phase: 'crashed', elapsed: 160_000, currentX100: 1_476_478, crashAge: 8_000 };
  const text = game.draw(view, 1_000);
  assert.match(text, /IDENTITY EXPORTED/);
  assert.match(text, /THE AIRDROP WAS YOU/);
  assert.match(text, /HANDLE WITHOUT CARE/);
  assert.doesNotMatch(text, /CLAIM REJECTED/);
  game.draw({ ...view, crashAge: 8_500 }, 1_500);
  assert.deepEqual(game.events, [{ type: 'crash', name: 'slam', quiet: true }]);
});

test('joining or resuming a long KYC audit does not replay historical cues', async () => {
  const game = await sceneHarness();
  const text = game.draw({ phase: 'running', elapsed: 600_000 }, 1_000);
  assert.match(text, /FINALITY REASSESSMENT/);
  game.draw({ phase: 'running', elapsed: 600_016 }, 1_016);
  game.draw({ phase: 'running', elapsed: 900_000 }, 5_000);
  game.draw({ phase: 'running', elapsed: 900_016 }, 5_016);
  assert.deepEqual(game.events, []);

  const beginning = await sceneHarness();
  beginning.draw({ phase: 'running', elapsed: 0 }, 0);
  beginning.draw({ phase: 'running', elapsed: 1_300 }, 1_300);
  assert.deepEqual(beginning.events.map(({ type, name }) => ({ type, name })), [{ type: 'fx', name: 'beep' }]);
});

test('the next KYC betting phase clears an accepted exit before an instant crash', async () => {
  const game = await sceneHarness();
  const escaped = game.draw({ phase: 'running', elapsed: 30_000, cashoutX100: 250 }, 1_000);
  assert.match(escaped, /PRIVACY INTACT/);
  const betting = game.draw({ phase: 'betting' }, 1_016);
  assert.doesNotMatch(betting, /PRIVACY INTACT|CLAIM ABANDONED|CASHED OUT/);
  const crashed = game.draw({ phase: 'crashed', crashAge: 0 }, 1_032);
  assert.match(crashed, /CLAIM REJECTED/);
  assert.match(crashed, /IDENTITY EXPORTED/);
  assert.doesNotMatch(crashed, /PRIVACY INTACT|CLAIM ABANDONED|CASHED OUT/);
  assert.deepEqual(game.events, [{ type: 'crash', name: 'slam', quiet: false }]);
});

test('reduced-motion KYC crashes present the packed aftermath immediately', async () => {
  const game = await sceneHarness({ reducedMotion: true });
  game.draw({ phase: 'running', elapsed: 150_000 }, 1_000);
  const crashed = game.draw({ phase: 'crashed', elapsed: 150_000, crashAge: 0 }, 1_016);
  assert.match(crashed, /HANDLE WITHOUT CARE/);
  assert.match(crashed, /\bSOLD\b/);
  assert.match(crashed, /CLAIM REJECTED/);
  assert.deepEqual(game.events, [{ type: 'crash', name: 'slam', quiet: false }]);
});
