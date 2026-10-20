import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

let bundle;
async function harness() {
  bundle ??= build({
    entryPoints: [fileURLToPath(new URL('../../games/know-your-clown/scene.ts', import.meta.url))],
    bundle: true, write: false, format: 'iife', globalName: 'Kyc',
    plugins: [{ name: 'capture-audio', setup(b) {
      b.onResolve({ filter: /^\.\/audio$/ }, () => ({ path: 'audio', namespace: 'test-audio' }));
      b.onLoad({ filter: /.*/, namespace: 'test-audio' }, () => ({ contents: 'export const pageAudio = () => globalThis.audio;' }));
    } }],
  });
  const audioEvents = [], labels = [];
  const globals = {
    Path2D: class {},
    audio: { update() {}, fx(name) { audioEvents.push(name); }, cashout() { audioEvents.push('cashout'); }, crash(_, quiet) { audioEvents.push(quiet ? 'quiet-crash' : 'crash'); } },
  };
  runInNewContext((await bundle).outputFiles[0].text, globals);
  const scene = globals.Kyc.createScene();
  const canvas = { width: 750, height: 422, clientWidth: 375, clientHeight: 522 };
  const context = new Proxy({ canvas, fillText(text) { labels.push(text); }, measureText: text => ({ width: text.length * 12 }),
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
  }, { get: (object, key) => key in object ? object[key] : () => {} });
  return { canvas, audioEvents, draw(patch, now) {
    labels.length = 0;
    scene.draw(context, { phase: 'running', elapsed: 80_000, currentX100: 12000, crashAge: 0, stake: 50, cashoutX100: null, payout: null, ...patch }, now);
    return labels.join(' ');
  } };
}

test('rotating the KYC composition preserves an accepted exit through the room crash', async () => {
  const h = await harness();
  h.draw({}, 1000);
  h.draw({ elapsed: 80_100, cashoutX100: 12000 }, 1100);
  const escaped = h.draw({ elapsed: 81_500 }, 2500);
  assert.match(escaped, /EXIT \/ NO DATA REQUIRED/);
  assert.match(escaped, /120.00×/);
  h.canvas.clientHeight = 211;
  assert.match(h.draw({ phase: 'crashed', crashAge: 0 }, 2600), /PRIVACY INTACT/);
  h.canvas.clientHeight = 522;
  const text = h.draw({ phase: 'crashed', crashAge: 1000, currentX100: 16402 }, 3600);
  assert.match(text, /PRIVACY INTACT/);
  assert.match(text, /120.00×/);
  assert.doesNotMatch(text, /164.02×/);
  assert.doesNotMatch(text, /IDENTITY EXPORTED|FINAL ALLOCATION|\bSOLD\b/);
  assert.equal(h.audioEvents.filter(event => event === 'cashout').length, 1);
  assert.equal(h.audioEvents.filter(event => event === 'crash').length, 1);
});

test('a fresh portrait crash shows the settled peanut payoff without replaying its cues', async () => {
  const h = await harness();
  const text = h.draw({ phase: 'crashed', elapsed: 190_000, crashAge: 8000 }, 1000);
  assert.match(text, /YOUR ALLOCATION: 1 PEANUT/);
  assert.match(text, /THE AIRDROP WAS YOU/);
  assert.match(text, /HANDLE WITHOUT CARE/);
  h.draw({ phase: 'crashed', elapsed: 190_000, crashAge: 8500 }, 1500);
  assert.deepEqual(h.audioEvents, ['quiet-crash']);
});
