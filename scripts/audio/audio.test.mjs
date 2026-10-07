import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { GAMES } from '../games.mjs';
import { main, requestFor } from './generate.mjs';
import { MAX_CLIPS_BYTES, serializeClips } from './pack.mjs';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('scripts/audio/prompts.json', root), 'utf8'));

test('all catalog games have distinct instrumental 150-second Music requests', () => {
  assert.deepEqual(Object.keys(manifest.games).sort(), [...GAMES].sort());
  const prompts = new Set();
  for (const slug of GAMES) {
    const req = requestFor({ kind: 'music', spec: manifest.games[slug].music }, manifest.defaults);
    assert.equal(new URL(req.url).pathname, '/v1/music');
    assert.equal(req.body.music_length_ms, 150_000, slug);
    assert.equal(req.body.force_instrumental, true, slug);
    assert.ok(!prompts.has(req.body.prompt), slug);
    prompts.add(req.body.prompt);
  }
  assert.throws(() => requestFor({ kind: 'music', spec: { via: 'effects', prompt: 'test' } }), /must use ElevenLabs Music/);
});

test('missing clip/game arguments cannot accidentally generate the whole catalog', async () => {
  await assert.rejects(main(['--game']), /requires a value/);
  await assert.rejects(main(['--clip', '--force']), /requires a value/);
  await assert.rejects(main(['--everything']), /Unknown option/);
});

test('complete clip serialization preserves effects and refuses oversized source files', () => {
  const clips = { music: 'data:audio/ogg;base64,AAA=', crash: 'data:audio/mpeg;base64,BBB=' };
  assert.deepEqual(JSON.parse(serializeClips(clips)), clips);
  assert.throws(() => serializeClips({ music: 'x'.repeat(MAX_CLIPS_BYTES) }), /source-file limit/);
});

test('recorded music adopts asynchronous decode, restarts for a round, stays at 1x and stops for crash', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent('<button id="sound">Sound</button>');
  await page.evaluate(() => {
    const NativeAudio = window.AudioContext;
    window.sources = [];
    window.AudioContext = class extends NativeAudio {
      createBufferSource() {
        const source = super.createBufferSource();
        const stop = source.stop.bind(source);
        source.stop = (...args) => { source.wasStopped = true; stop(...args); };
        window.sources.push(source);
        return source;
      }
      async decodeAudioData() {
        await new Promise(resolve => { window.releaseMusic = resolve; });
        return this.createBuffer(1, 150 * this.sampleRate, this.sampleRate);
      }
    };
  });
  const result = await build({ stdin: { contents: readFileSync(new URL('scripts/shell/audio.ts', root), 'utf8'), sourcefile: 'audio.ts', loader: 'ts', resolveDir: new URL('games/balloon-pump/', root).pathname }, bundle: true, format: 'iife', globalName: 'AudioUnderTest', write: false });
  await page.addScriptTag({ content: result.outputFiles[0].text });
  await page.evaluate(async () => {
    // Override each existing effect so this test delays one decoded music buffer only.
    window.audio = AudioUnderTest.pageAudio({ clips: { music: 'data:audio/wav;base64,AAAA', crash: '', cashout: '', squeak: '', yeet: '' } });
    await window.audio.toggle();
  });
  await page.waitForFunction(() => typeof window.releaseMusic === 'function');
  assert.equal(await page.evaluate(() => window.sources.filter(s => s.buffer?.duration === 150).length), 0);
  await page.evaluate(() => window.releaseMusic());
  await page.waitForFunction(() => window.sources.some(s => s.buffer?.duration === 150));
  const state = await page.evaluate(() => {
    const tracks = () => window.sources.filter(s => s.buffer?.duration === 150);
    const initial = tracks()[0];
    window.audio.update('betting', 0);
    window.audio.update('running', 1);
    const current = tracks().at(-1);
    const result = { count: tracks().length, initialStopped: initial.wasStopped, rate: current.playbackRate.value, loop: current.loop };
    window.audio.crash('pop');
    result.crashStopped = current.wasStopped;
    window.audio.close();
    return result;
  });
  assert.deepEqual(state, { count: 2, initialStopped: true, rate: 1, loop: true, crashStopped: true });
});
