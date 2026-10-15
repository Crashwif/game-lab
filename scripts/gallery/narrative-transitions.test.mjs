import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

const games = ['the-wake', 'gender-reveal', 'repo-man', 'degen-anonymous', 'congressional-hearing', 'the-reading'];
const compiled = new Map();

async function harness(game) {
  if (!compiled.has(game)) compiled.set(game, build({
    entryPoints: [`games/${game}/scene.ts`], bundle: true, write: false, format: 'iife', globalName: 'Scene',
    plugins: [{ name: 'audio-recorder', setup(b) {
      b.onResolve({ filter: /^\.\/audio$/ }, () => ({ path: 'audio', namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const pageAudio = () => globalThis.audio;' }));
    } }],
  }));
  const events = [];
  let shown;
  const context = {
    Path2D: class { constructor() { return new Proxy({}, { get: () => () => {} }); } },
    audio: {
      context: null, bus: null,
      update(phase, tension) { shown = { phase, tension }; },
      fx(name, strength) { events.push({ name, strength }); },
      cashout() { events.push({ name: 'cashout' }); },
      milestone() {},
      crash(name, quiet) { events.push({ name: 'crash', quiet }); },
    },
  };
  runInNewContext((await compiled.get(game)).outputFiles[0].text, context);
  const scene = context.Scene.createScene();
  const gradient = () => ({ addColorStop() {} });
  const ctx = new Proxy({
    canvas: { width: 960, height: 540, clientWidth: 960, clientHeight: 540 },
    measureText: text => ({ width: String(text).length * 8 }),
    createLinearGradient: gradient, createRadialGradient: gradient,
  }, { get: (target, key) => key in target ? target[key] : () => {} });
  let now = 1000;
  const view = { phase: 'betting', currentX100: 100, elapsed: 0, crashAge: 0, stake: 50, cashoutX100: null, payout: null };
  function frame(patch = {}, dt = 1 / 30) {
    Object.assign(view, patch); now += dt * 1000;
    scene.draw(ctx, view, now);
    return shown;
  }
  function liveCrash(age = 2) {
    frame(); frame({ phase: 'running', currentX100: 200, elapsed: 9000 });
    frame({ phase: 'crashed', crashAge: 0 });
    for (let i = 1; i <= Math.round(age * 30); i++) frame({ crashAge: i * 1000 / 30 });
  }
  return { frame, liveCrash, events };
}

for (const game of games) {
  test(`${game}: ending survives waiting → betting without restarting the music`, async () => {
    const h = await harness(game); h.liveCrash();
    h.frame({ phase: 'waiting', currentX100: 100, stake: null, elapsed: 0, crashAge: 0 });
    const shown = h.frame({ phase: 'betting' });
    assert.equal(shown.phase, 'crashed');
    assert.equal(shown.tension, 0.5, 'keep the previous 2× crash while its ending plays');
  });

  test(`${game}: a new instant crash interrupts the previous ending`, async () => {
    const h = await harness(game); h.liveCrash();
    h.frame({ phase: 'betting', currentX100: 100, stake: 50, elapsed: 0, crashAge: 0 });
    h.events.length = 0;
    const shown = h.frame({ phase: 'crashed', currentX100: 100, crashAge: 0 });
    assert.equal(shown.phase, 'crashed');
    assert.equal(shown.tension, 0, 'show the new 1× crash, not the previous 2× ending');
    if (game === 'repo-man') assert.ok(h.events.some(e => e.name === 'siren' && e.strength === 0.28), 'the new repossession starts with its beacons');
    else assert.equal(h.events.filter(e => e.name === 'crash' && !e.quiet).length, 1, 'play the new crash once');
  });

  test(`${game}: new running round interrupts the ending and clears the accepted exit`, async () => {
    const h = await harness(game);
    h.frame(); h.frame({ phase: 'running', currentX100: 150, elapsed: 5000 });
    h.frame({ cashoutX100: 150, payout: 75 });
    h.frame({ phase: 'crashed', currentX100: 200, crashAge: 0 });
    h.frame({ phase: 'betting', currentX100: 100, elapsed: 0, cashoutX100: null, payout: null });
    assert.equal(h.frame({ phase: 'running' }).phase, 'running');
    h.events.length = 0;
    h.frame({ cashoutX100: 100, payout: 50 });
    assert.equal(h.events.filter(e => e.name === 'cashout').length, 1, 'the new exit must be accepted independently');
  });
}

test('Degen Anonymous: the banner and group-hug sounds continue through betting', async () => {
  const h = await harness('degen-anonymous'); h.liveCrash();
  h.frame({ phase: 'betting', currentX100: 100, crashAge: 0, elapsed: 0 });
  h.events.length = 0;
  for (let i = 0; i < 80; i++) h.frame();
  assert.ok(h.events.some(e => e.name === 'pop' && e.strength === 0.7), 'banner pins pop after the crash phase ends');
  assert.ok(h.events.some(e => e.name === 'thud' && e.strength === 0.35), 'group-hug landings retain their impacts');
});
