import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { capturePosters } from './capture.mjs';

async function fixture(t, scenarios) {
  const root = await mkdtemp(join(tmpdir(), 'gallery-capture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dist = join(root, 'dist'), out = join(root, 'out'), short = '1234567';
  const games = scenarios.map((_, i) => ({ slug: `game-${i}`, poster: { seconds: i + 0.125 } }));
  for (const game of games) {
    await mkdir(join(dist, game.slug), { recursive: true });
    await writeFile(join(dist, game.slug, 'index.html'), '<canvas></canvas>');
    await mkdir(join(out, short, game.slug), { recursive: true });
  }
  const state = { active: 0, peak: 0, attempts: 0, waits: [], closed: [], browserClosed: false, origin: '' };
  const browser = {
    async newPage(options) {
      const index = state.attempts++, scenario = scenarios[index], game = games[index];
      if (scenario.createError) throw new Error(scenario.createError);
      assert.deepEqual(options, { viewport: { width: 960, height: 660 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
      state.active++;
      state.peak = Math.max(state.peak, state.active);
      const page = new EventEmitter();
      let waited = false;
      page.goto = async (url, options) => {
        assert.equal(options.waitUntil, 'load');
        assert.equal(new URL(url).pathname, `/${game.slug}/index.html`);
        assert.equal(new URL(url).search, '?mode=replay');
        state.origin = new URL(url).origin;
        assert.equal(await (await fetch(url)).text(), '<canvas></canvas>');
        if (scenario.consoleError) page.emit('console', { type: () => 'error', text: () => scenario.consoleError });
      };
      page.waitForTimeout = async ms => {
        state.waits.push([game.slug, ms]);
        await (scenario.wait?.() ?? setImmediate());
        waited = true;
      };
      page.locator = selector => {
        assert.equal(selector, 'canvas');
        return {
          async waitFor() {},
          async screenshot(options) {
            assert.ok(waited, 'capture must wait for the full requested playback');
            assert.equal(options.type, 'png');
            if (scenario.screenshotError) throw new Error(scenario.screenshotError);
            return Buffer.from(game.slug);
          },
        };
      };
      page.evaluate = async (_fn, base64) => {
        assert.equal(Buffer.from(base64, 'base64').toString(), game.slug);
        return scenario.colours ?? 20;
      };
      page.close = async () => {
        assert.equal(state.browserClosed, false, 'worker must finish before browser closes');
        await assert.rejects(access(join(out, short, game.slug, 'poster.png')), { code: 'ENOENT' });
        state.active--;
        state.closed.push(game.slug);
        // Errors emitted during close must still prevent a poster from being written.
        if (scenario.pageError) page.emit('pageerror', new Error(scenario.pageError));
        scenario.onClose?.();
        if (scenario.closeError) throw new Error(scenario.closeError);
      };
      return page;
    },
    async close() {
      assert.equal(state.active, 0, 'all workers must drain before shutdown');
      state.browserClosed = true;
    },
  };
  return {
    games, state, browser,
    poster: game => join(out, short, game.slug, 'poster.png'),
    run: options => capturePosters(dist, out, short, games, { concurrency: 2, launch: async () => browser, ...options }),
  };
}

test('two workers overlap playback, respect the limit and capture every game at its own time', { timeout: 10_000 }, async t => {
  const gate = Promise.withResolvers();
  const started = Promise.withResolvers();
  let waiting = 0;
  const wait = () => { if (++waiting === 2) started.resolve(); return gate.promise; };
  const f = await fixture(t, [{ wait }, { wait }, {}, {}, {}]);
  const running = f.run();
  try {
    await started.promise;
    assert.equal(f.state.waits.length, 2, 'both pages should reach playback before either finishes');
    assert.equal(f.state.attempts, 2, 'the remaining pages wait for an available worker');
  } finally {
    gate.resolve();
    await running;
  }
  assert.equal(f.state.peak, 2);
  assert.deepEqual(f.state.waits.sort(), f.games.map(game => [game.slug, Math.round(game.poster.seconds * 1000)]));
  for (const game of f.games) assert.equal(await readFile(f.poster(game), 'utf8'), game.slug);
  assert.equal(f.state.browserClosed, true);
  await assert.rejects(fetch(f.state.origin), /fetch failed/);
});

test('explicit worker counts bound page creation, including sequential capture', async t => {
  for (const concurrency of [1, 3, 8]) await t.test(String(concurrency), async t => {
    const f = await fixture(t, [{}, {}, {}]);
    await f.run({ concurrency });
    assert.ok(f.state.peak <= Math.min(concurrency, 3));
    assert.equal(f.state.attempts, 3);
    assert.equal(f.state.closed.length, 3);
  });
});

test('page, console, blank, screenshot and close failures remain ordered and never write failed posters', async t => {
  const gate = Promise.withResolvers();
  const f = await fixture(t, [
    { wait: () => gate.promise, pageError: 'late page error' },
    { colours: 1, onClose: () => gate.resolve() },
    { consoleError: 'console failure' },
    { screenshotError: 'screenshot failure' },
    { closeError: 'close failure' },
    {},
  ]);
  await assert.rejects(f.run(), { message: 'poster capture failed for 5 of 6 games:\n  game-0: late page error\n  game-1: the poster is a single colour\n  game-2: console: console failure\n  game-3: screenshot failure\n  game-4: close failure' });
  assert.equal(f.state.attempts, 6);
  assert.equal(f.state.closed.length, 6);
  assert.equal(f.state.browserClosed, true);
  for (const game of f.games.slice(0, 5)) await assert.rejects(access(f.poster(game)), { code: 'ENOENT' });
  assert.equal(await readFile(f.poster(f.games[5]), 'utf8'), 'game-5');
});

test('page creation and output failures do not abandon the other captures or cleanup', async t => {
  const f = await fixture(t, [{ createError: 'cannot open page' }, {}, {}]);
  await rm(f.poster(f.games[1]).replace('/poster.png', ''), { recursive: true });
  await assert.rejects(f.run(), error => {
    assert.match(error.message, /^poster capture failed for 2 of 3 games:\n  game-0: cannot open page\n  game-1: ENOENT/);
    return true;
  });
  assert.equal(f.state.browserClosed, true);
  assert.equal(await readFile(f.poster(f.games[2]), 'utf8'), 'game-2');
  await assert.rejects(fetch(f.state.origin), /fetch failed/);
});

test('the static server closes even if browser shutdown fails', async t => {
  const f = await fixture(t, [{}]);
  f.browser.close = async () => { throw new Error('browser shutdown failed'); };
  await assert.rejects(f.run(), /browser shutdown failed/);
  await assert.rejects(fetch(f.state.origin), /fetch failed/);
});

test('worker configuration rejects invalid values before starting and reads the environment', async t => {
  let launches = 0;
  for (const concurrency of [0, 9, -1, 1.5, NaN, Infinity, '', '2e0', ' 2', 'many']) {
    await assert.rejects(capturePosters('', '', '', [{}], { concurrency, launch: async () => launches++ }), /integer from 1 to 8/);
  }
  assert.equal(launches, 0);
  const previous = process.env.GAME_LAB_CAPTURE_CONCURRENCY;
  try {
    delete process.env.GAME_LAB_CAPTURE_CONCURRENCY;
    const defaults = await fixture(t, [{}, {}, {}]);
    await defaults.run({ concurrency: undefined });
    assert.equal(defaults.state.peak, 2);
    process.env.GAME_LAB_CAPTURE_CONCURRENCY = '1';
    const f = await fixture(t, [{}, {}, {}]);
    await f.run({ concurrency: undefined });
    assert.equal(f.state.peak, 1);
  } finally {
    if (previous === undefined) delete process.env.GAME_LAB_CAPTURE_CONCURRENCY;
    else process.env.GAME_LAB_CAPTURE_CONCURRENCY = previous;
  }
});
