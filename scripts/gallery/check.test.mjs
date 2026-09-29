import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { MAX_AI_INPUT_TOKENS, budgetProblems, bundle, check, importProblems, listProblems, readmeGames, readmeProblems, remixInputBound, replayProblems } from './check.mjs';
import { MAX_SOURCE_FILES, MAX_SOURCE_FILE_BYTES, ROOT, SOURCE_EXTENSIONS, checkSources } from './pack.mjs';

test('every game meets the Game Lab contract', async () => {
  assert.deepEqual(await check(), []);
});

test('GAMES must list each game directory once', () => {
  assert.deepEqual(listProblems(['a', 'b'], ['b', 'a']), []);
  assert.deepEqual(listProblems(['a', 'b', 'a'], ['a', 'b']), ['scripts/games.mjs lists a twice']);
  assert.deepEqual(listProblems(['a', 'gone'], ['a']), ['scripts/games.mjs lists gone, but games/gone/ does not exist']);
  assert.deepEqual(listProblems(['a'], ['a', 'new']), ['games/new/ is not listed in scripts/games.mjs']);
});

test('the README table must link GAMES in order', () => {
  const table = (...slugs) => ['| Reference | What to study | Status |', '| --- | --- | --- |', ...slugs.map((slug) => `| [${slug}](games/${slug}) | Springs | Playable |`), '| [Rug Coaster](docs/concepts.md#rug-coaster) | A spline track | Concept |'].join('\n');
  assert.deepEqual(readmeGames(table('a', 'b')), ['a', 'b']);
  assert.deepEqual(readmeProblems(table('a', 'b'), ['a', 'b']), []);
  assert.match(readmeProblems(table('b', 'a'), ['a', 'b'])[0], /links games\/b as game 1, where scripts\/games\.mjs lists a$/);
  assert.match(readmeProblems(table('a'), ['a', 'b'])[0], /links no game as game 2, where scripts\/games\.mjs lists b$/);
  assert.match(readmeProblems(table('a', 'b', 'c'), ['a', 'b'])[0], /links games\/c as game 3, where scripts\/games\.mjs lists no more games$/);
});

test('a replay must verify for its own game', async () => {
  const { verifyReplay } = await import(pathToFileURL(join(ROOT, 'packages/game-sdk/dist/index.js')).href);
  const round = JSON.parse(await readFile(join(ROOT, 'games/balloon-pump/replay.json'), 'utf8'));
  const replay = (edit = {}) => JSON.stringify({ ...round, ...edit });
  assert.deepEqual(replayProblems('balloon-pump', replay(), verifyReplay), []);
  assert.deepEqual(replayProblems('thin-ice', replay(), verifyReplay), ['games/thin-ice/replay.json: gameId is "balloon-pump", not "thin-ice"']);
  assert.match(replayProblems('balloon-pump', replay({ crashX100: round.crashX100 + 1 }), verifyReplay).join('\n'), /crash point doesn't follow from the seed/);
  assert.match(replayProblems('balloon-pump', replay({ serverSeedHash: '0'.repeat(64) }), verifyReplay).join('\n'), /doesn't hash to the hash announced/);
  assert.match(replayProblems('balloon-pump', replay({ bets: undefined }), verifyReplay).join('\n'), /cannot be verified/);
  assert.deepEqual(replayProblems('balloon-pump', undefined, verifyReplay), ['games/balloon-pump/replay.json is missing']);
  assert.match(replayProblems('balloon-pump', '{"gameId":', verifyReplay)[0], /^games\/balloon-pump\/replay\.json: /);
  assert.deepEqual(replayProblems('balloon-pump', '[]', verifyReplay), ['games/balloon-pump/replay.json must be a JSON object']);
});

/**
 * Bundles games/demo/ in a small repository in a temp dir and returns its import problems against the
 * source pack sourcePack would read from it. `files` are written by path from games/demo/. The SDK,
 * crash maths and emulator packages are reached through workspace symlinks, as npm links them, and the
 * SDK imports a third-party package of its own.
 */
async function imports(t, files) {
  const root = await mkdtemp(join(tmpdir(), 'gallery-check-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (path, body) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), body);
  };
  await put('node_modules/dep/package.json', JSON.stringify({ name: 'dep', type: 'module', main: 'index.js' }));
  await put('node_modules/dep/index.js', 'export const dep = 1;');
  await mkdir(join(root, 'node_modules/@crashwif'), { recursive: true });
  for (const [dir, name, body] of [['packages/game-sdk', '@crashwif/game-sdk', "export { dep as sdk } from 'dep';"], ['packages/crash-math', '@crashwif/crash-math', 'export const maths = 2;'], ['apps/emulator', '@crashwif/emulator', 'export const emulator = 3;']]) {
    await put(`${dir}/package.json`, JSON.stringify({ name, type: 'module', main: 'index.js' }));
    await put(`${dir}/index.js`, body);
    await symlink(join('..', '..', dir), join(root, 'node_modules', name));
  }
  for (const [path, body] of Object.entries(files)) await put(join('games/demo', path), body);
  const pack = Object.fromEntries(Object.entries(files).filter(([path]) => !path.includes('/') && SOURCE_EXTENSIONS.has(extname(path)) && path !== 'gallery.json'));
  return importProblems('demo', (await bundle('demo', root)).metafile, root, pack);
}

test('a game may import only files beside it and the two platform packages', async (t) => {
  assert.deepEqual(await imports(t, {
    'main.ts': "import { sdk } from '@crashwif/game-sdk';\nimport { maths } from '@crashwif/crash-math';\nimport { helper } from './helper';\nimport { more } from './more.js';\nimport replay from './replay.json';\nconsole.log(sdk, maths, helper, more, replay);\n",
    'helper.ts': 'export const helper = 4;\n',
    'more.ts': 'export const more = 8;\n',
    'replay.json': '{"gameId":"demo"}',
  }), []);
  const refused = async (line, extra) => {
    const problems = await imports(t, { 'main.ts': `${line}\nconsole.log(x);\n`, ...extra });
    assert.equal(problems.length, 1, problems.join('\n'));
    return problems[0];
  };
  assert.match(await refused("import { x } from '../shared/util';", { '../shared/util.ts': 'export const x = 5;' }), /^games\/demo\/main\.ts imports "\.\.\/shared\/util" \(games\/shared\/util\.ts\): a remix can import only/);
  assert.match(await refused("import { emulator as x } from '@crashwif/emulator';"), /imports "@crashwif\/emulator" \(apps\/emulator\/index\.js\)/);
  assert.match(await refused("import { dep as x } from 'dep';"), /imports "dep" \(node_modules\/dep\/index\.js\)/);
  assert.match(await refused("import { x } from './lib/x';", { 'lib/x.ts': 'export const x = 6;' }), /imports "\.\/lib\/x" \(games\/demo\/lib\/x\.ts\)/);
  assert.match(await refused("import { x } from '../demo/x';", { 'x.ts': 'export const x = 7;' }), /imports "\.\.\/demo\/x" \(games\/demo\/x\.ts\)/);
  assert.match(await refused("import { sdk as x } from '../../packages/game-sdk/index.js';"), /imports "\.\.\/\.\.\/packages\/game-sdk\/index\.js"/);
  // Files beside it that esbuild finds here but the remix bundler does not, from the source pack alone.
  const unpacked = /, which a remix cannot find in the source pack/;
  assert.match(await refused("import x from './gallery.json';", { 'gallery.json': '{}' }), /imports "\.\/gallery\.json" \(games\/demo\/gallery\.json\), which a remix cannot find/);
  assert.match(await refused("import { x } from './util.js';", { 'util.js': 'export const x = 9;' }), unpacked);
  assert.match(await refused("import x from './notes.txt';", { 'notes.txt': 'notes' }), unpacked);
  assert.match(await refused("import x from './data';", { 'data.json': '{"x":10}' }), /imports "\.\/data" \(games\/demo\/data\.json\), which a remix cannot find/);
  assert.match(await refused("import x from './data.js';", { 'data.js': 'export default 11;', 'data.ts': 'export default 12;' }), /imports "\.\/data\.js" \(games\/demo\/data\.js\), which a remix resolves to data\.ts in the source pack$/);
});

test('a game listed as remixable in the browser must fit the platform\'s AI input budget', () => {
  // The bound counts the system prompt, each file under its header in path order, clips.json by its clip names, the request header and the allowance.
  const small = { 'main.ts': 'export {};', 'index.html': '<script src="./game.generated.js"></script>', 'clips.json': '{"music":"data:,x","broken":1}' };
  const message = '=== clips.json ===\n(recorded clips, not shown: music)\n\n=== index.html ===\n<script src="./game.generated.js"></script>\n\n=== main.ts ===\nexport {};\n\n=== request ===\n';
  assert.equal(remixInputBound(small), 2_639 + Buffer.byteLength(message) + 2_048);
  assert.equal(remixInputBound({ ...small, 'clips.json': 'not json' }), remixInputBound({ ...small, 'clips.json': '{}' }));
  assert.equal(remixInputBound({ 'a.ts': 'é' }) - remixInputBound({ 'a.ts': 'e' }), 1);
  assert.deepEqual(budgetProblems('demo', small), []);
  const big = { ...small, 'scene.ts': 'x'.repeat(MAX_AI_INPUT_TOKENS) };
  assert.match(budgetProblems('demo', big)[0], /^games\/demo: a remix step would send \d+ tokens by the platform's bound, over the browser Studio's 120000, yet scripts\/games\.mjs lists it in BROWSER_REMIX$/);
});

test('a source pack must fit the platform remix limits', () => {
  const html = '<link rel="stylesheet" href="./style.css"><canvas></canvas><script src="./game.generated.js" defer></script>';
  const pack = (extra = {}) => ({ 'main.ts': 'export {};', 'index.html': html, 'style.css': 'canvas{}', ...extra });
  assert.equal(checkSources(pack()), Buffer.byteLength(Object.values(pack()).join('')));
  const many = Object.fromEntries(Array.from({ length: MAX_SOURCE_FILES - 2 }, (_, i) => [`part${i}.ts`, 'export {};']));
  assert.throws(() => checkSources(pack(many)), /1 to 40 source files, not 41/);
  assert.throws(() => checkSources(pack({ 'big.ts': 'x'.repeat(MAX_SOURCE_FILE_BYTES + 1) })), /big\.ts: source files are 1 byte to 256 KB/);
  assert.throws(() => checkSources(pack({ 'lib/x.ts': 'export {};' })), /"lib\/x\.ts": source files are/);
  assert.throws(() => checkSources(pack({ 'index.html': '<canvas></canvas>' })), /index\.html must load \.\/game\.generated\.js/);
  const { 'style.css': _, ...unstyled } = pack();
  assert.throws(() => checkSources(unstyled), /style\.css is missing/);
});

test('an executable source file packs the same from a commit as from the working tree', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'gallery-pack-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  // pack.mjs reads the games/ beside its own copy, so the copy goes in a repository of its own.
  await mkdir(join(root, 'scripts/gallery'), { recursive: true });
  await copyFile(join(ROOT, 'scripts/gallery/pack.mjs'), join(root, 'scripts/gallery/pack.mjs'));
  await mkdir(join(root, 'games/demo'), { recursive: true });
  const html = '<link rel="stylesheet" href="./style.css"><canvas></canvas><script src="./game.generated.js" defer></script>';
  for (const [name, body] of Object.entries({ 'main.ts': 'export {};\n', 'index.html': html, 'style.css': 'canvas{}' })) await writeFile(join(root, 'games/demo', name), body);
  await chmod(join(root, 'games/demo/main.ts'), 0o755);
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'user.name=test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-q');
  git('add', '-A');
  // Where core.fileMode is off the index would not take the bit from the file.
  git('update-index', '--chmod=+x', 'games/demo/main.ts');
  git('commit', '-qm', 'demo');
  assert.match(git('ls-files', '-s', 'games/demo/main.ts'), /^100755 /);
  const { sourcePack } = await import(pathToFileURL(join(root, 'scripts/gallery/pack.mjs')).href);
  assert.deepEqual(sourcePack('demo', { from: 'git', commit: git('rev-parse', 'HEAD') }), sourcePack('demo'));
});
