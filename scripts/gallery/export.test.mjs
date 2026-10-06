import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { BUNDLE_FILES, digest, gameKeys, sharedInputs } from './cache.mjs';
import { exportGallery } from './export.mjs';

const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const game = (slug, code = 'draw()') => ({ slug, name: slug, hook: 'hook', tagline: 'tagline', tags: ['a', 'b', 'c'], renderer: 'Canvas 2D', interactive: false, licence: 'open', royaltyBps: 0,
  poster: { seconds: 18 }, sources: { 'main.ts': code, 'index.html': '<canvas></canvas>', 'style.css': 'canvas{}' } });

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'gallery-export-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const options = { dist: join(root, 'dist'), out: join(root, 'out'), cache: join(root, 'cache'), commit: '1'.repeat(40), repository: 'https://github.com/Crashwif/game-lab', sources: 'git', skipPosters: false };
  let games = [game('first'), game('second')]; let sharedKey = 'shared-inputs';
  let built = []; let captured = []; let failCapture = false;
  const build = async (slugs, dist) => {
    built.push(...slugs);
    for (const slug of slugs) {
      await mkdir(join(dist, slug), { recursive: true });
      const source = games.find((g) => g.slug === slug).sources;
      for (const file of BUNDLE_FILES) await writeFile(join(dist, slug, file), file === 'game.generated.js' ? source['main.ts'] : source[file]);
    }
  };
  const capture = async (_dist, out, short, selected) => {
    captured.push(...selected.map((g) => g.slug));
    if (failCapture) throw new Error('poster page failed its replay');
    for (const g of selected) await writeFile(join(out, short, g.slug, 'poster.png'), `poster:${g.slug}:${g.poster.seconds}`);
  };
  const run = async (overrides = {}) => {
    built = []; captured = [];
    // Each run starts on an empty runner; only the explicit output cache survives.
    await rm(options.dist, { recursive: true, force: true });
    const result = await exportGallery({ ...options, ...overrides }, { games, sharedKey, build, capture });
    return { ...result, built, captured };
  };
  return { root, options, run, setGames(value) { games = value; }, setShared(value) { sharedKey = value; }, failCapture() { failCapture = true; } };
}

test('cold exports build and capture every game; warm exports keep the complete catalog and fresh provenance', async (t) => {
  const f = await fixture(t);
  const cold = await f.run();
  assert.deepEqual(cold.built, ['first', 'second']); assert.deepEqual(cold.captured, cold.built);
  const commit = '2'.repeat(40);
  const warm = await f.run({ commit });
  assert.deepEqual(warm.built, []); assert.deepEqual(warm.captured, []); assert.equal(warm.total, 2);
  const manifest = await json(join(f.options.out, 'manifest.json'));
  assert.equal(manifest.commit, commit); assert.deepEqual(manifest.games.map((g) => g.slug), ['first', 'second']);
  const source = await json(join(f.options.out, 'SOURCE.json'));
  assert.equal(source.commit, commit);
  for (const slug of ['first', 'second']) {
    const pack = await json(join(f.options.out, 'sources', `${slug}.json`));
    assert.equal(pack.commit, commit);
    for (const file of [...BUNDLE_FILES, 'poster.png']) {
      const path = `${commit.slice(0, 7)}/${slug}/${file}`;
      assert.equal(source.files[path], digest(await readFile(join(f.options.out, path))));
    }
    for (const [file, text] of Object.entries(pack.files)) assert.equal(source.files[`sources/${slug}/${file}`], digest(text));
  }
});

test('one edited game and one added game leave the other game cached', async (t) => {
  const f = await fixture(t); await f.run();
  f.setGames([game('first', 'changed()'), game('second'), game('third')]);
  const result = await f.run({ commit: '2'.repeat(40) });
  assert.deepEqual(result.built, ['first', 'third']); assert.deepEqual(result.captured, result.built);
  assert.deepEqual(result.reused, ['second']);
  assert.equal(await readFile(join(f.options.out, '2222222/first/game.generated.js'), 'utf8'), 'changed()');
});

test('catalog edits and removals refresh the export without rebuilding retained games', async (t) => {
  const f = await fixture(t); await f.run();
  f.setGames([{ ...game('second'), name: 'Renamed', licence: 'all-rights-reserved' }]);
  const result = await f.run({ commit: '3'.repeat(40) });
  assert.deepEqual(result.built, []); assert.deepEqual(result.captured, []);
  assert.deepEqual(await readdir(join(f.options.out, '3333333')), ['second']);
  assert.deepEqual(await readdir(join(f.options.out, 'sources')), ['second.json']);
  assert.equal((await json(join(f.options.out, 'manifest.json'))).games[0].name, 'Renamed');
  assert.equal((await json(join(f.options.out, 'sources/second.json'))).licence, 'all-rights-reserved');
});

test('poster timing changes recapture only that poster, preserving its bundle', async (t) => {
  const f = await fixture(t); await f.run();
  f.setGames([{ ...game('first'), poster: { seconds: 25 } }, game('second')]);
  const result = await f.run();
  assert.deepEqual(result.built, []); assert.deepEqual(result.captured, ['first']);
  assert.equal(await readFile(join(f.options.out, '1111111/first/poster.png'), 'utf8'), 'poster:first:25');
});

test('shared build inputs invalidate every game, including when returning to another source version', async (t) => {
  const f = await fixture(t); await f.run();
  f.setShared('another-sdk');
  assert.deepEqual((await f.run()).built, ['first', 'second']);
  f.setShared('shared-inputs');
  assert.deepEqual((await f.run()).built, ['first', 'second']);
});

test('corrupt bundles rebuild; missing or corrupt posters recapture without rebuilding', async (t) => {
  const f = await fixture(t); await f.run();
  await writeFile(join(f.options.cache, 'first/game.generated.js'), 'corrupted');
  let result = await f.run(); assert.deepEqual(result.built, ['first']); assert.deepEqual(result.captured, ['first']);
  await writeFile(join(f.options.cache, 'second/poster.png'), 'corrupted');
  result = await f.run(); assert.deepEqual(result.built, []); assert.deepEqual(result.captured, ['second']);
  await rm(join(f.options.cache, 'first/poster.png'));
  result = await f.run(); assert.deepEqual(result.built, []); assert.deepEqual(result.captured, ['first']);
  await writeFile(join(f.options.cache, 'first/record.json'), '{');
  result = await f.run(); assert.deepEqual(result.built, ['first']); assert.deepEqual(result.captured, ['first']);
});

test('symlinks and another slug’s cache entries cannot supply published bytes', async (t) => {
  const f = await fixture(t); await f.run();
  await rm(join(f.options.cache, 'first/game.generated.js'));
  await symlink(join(f.options.cache, 'second/game.generated.js'), join(f.options.cache, 'first/game.generated.js'));
  assert.deepEqual((await f.run()).built, ['first']);
  await writeFile(join(f.options.cache, 'first/record.json'), await readFile(join(f.options.cache, 'second/record.json')));
  assert.deepEqual((await f.run()).built, ['first']);
});

test('planning reports work without building, capturing or writing outputs; cache loss is a full build', async (t) => {
  const f = await fixture(t);
  const plan = await f.run({ plan: true });
  assert.deepEqual(plan.build, ['first', 'second']); assert.deepEqual(plan.built, []); assert.deepEqual(plan.captured, []);
  await assert.rejects(readdir(f.options.out), { code: 'ENOENT' });
  await f.run();
  const warm = await f.run({ plan: true }); assert.deepEqual(warm.build, []); assert.deepEqual(warm.posters, []);
  await rm(f.options.cache, { recursive: true });
  assert.deepEqual((await f.run()).built, ['first', 'second']);
});

test('failed capture supplies no reusable cache, and cached exports cannot skip poster verification', async (t) => {
  const f = await fixture(t); f.failCapture();
  await assert.rejects(f.run(), /poster page failed/);
  await assert.rejects(readdir(f.options.cache), { code: 'ENOENT' });
  await assert.rejects(f.run({ skipPosters: true }), /cannot skip posters/);
  await assert.rejects(f.run({ sources: 'worktree' }), /requires --sources git/);
});

test('shared fingerprints require a clean matching checkout and cover toolchain, dependency and build changes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'gallery-inputs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const put = async (path, body) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), body); };
  git('init', '-q'); git('config', 'user.name', 'test'); git('config', 'user.email', 'test@example.invalid');
  await put('package-lock.json', '{}'); await put('scripts/build.mjs', 'build()'); await put('games/first/main.ts', 'draw()');
  const commit = () => { git('add', '.'); git('commit', '-qm', 'snapshot'); return git('rev-parse', 'HEAD'); };
  let sha = commit(); const initial = sharedInputs(sha, root);
  await put('README.md', '# Copy'); await put('docs/integration.md', '# Integration'); await put('scripts/games.mjs', "['first', 'second']"); await put('games/first/README.md', '# Game');
  sha = commit(); assert.equal(sharedInputs(sha, root), initial);
  for (const file of ['package-lock.json', '.nvmrc', 'packages/game-sdk/src/index.ts', 'scripts/build.mjs', '.github/workflows/game-lab-deploy.yml', 'unrecognised-config.json', 'docs/runtime.json']) {
    const before = sharedInputs(sha, root); await put(file, `input:${file}`); sha = commit();
    assert.notEqual(sharedInputs(sha, root), before, file);
  }
  const captureEnvironment = process.env.GAME_LAB_CAPTURE_ENV;
  const environmentKey = sharedInputs(sha, root);
  try {
    process.env.GAME_LAB_CAPTURE_ENV = 'another-runner-image';
    assert.notEqual(sharedInputs(sha, root), environmentKey);
  } finally {
    if (captureEnvironment === undefined) delete process.env.GAME_LAB_CAPTURE_ENV;
    else process.env.GAME_LAB_CAPTURE_ENV = captureEnvironment;
  }
  await put('games/first/main.ts', 'uncommitted()'); assert.throws(() => sharedInputs(sha, root), /clean checkout/);
  sha = commit(); assert.throws(() => sharedInputs('1'.repeat(40), root), /clean checkout/);
  await put('untracked.ts', 'imported()'); assert.throws(() => sharedInputs(sha, root), /clean checkout/);
  assert.notEqual(gameKeys(game('first'), initial).bundle, gameKeys(game('second'), initial).bundle);
});
