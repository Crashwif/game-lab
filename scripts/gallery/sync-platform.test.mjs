import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const SYNC = fileURLToPath(new URL('./sync-platform.mjs', import.meta.url));
const DAY_MS = 24 * 60 * 60 * 1000;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const editJson = async (path, edit) => { const value = await readJson(path); await writeFile(path, JSON.stringify(edit(value) ?? value)); };

/**
 * A minimal platform checkout and an export directory in a temp dir. write()
 * exports a release of `games` ({ slug, js, poster, seconds }, where a null
 * poster leaves it out); sync() writes one and applies it.
 */
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'gallery-sync-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const platform = join(root, 'platform');
  const exported = join(root, 'export');
  const assets = join(platform, 'apps/web/public/assets/game-lab');
  const page = join(platform, 'apps/web/src/pages/unlock/game-lab.json');
  const lab = join(platform, 'packages/game-lab');
  await mkdir(join(platform, 'apps/web/src/pages/unlock'), { recursive: true });
  await mkdir(lab, { recursive: true });

  const write = async (short, games) => {
    const commit = short.padEnd(40, '0');
    await rm(exported, { recursive: true, force: true });
    await mkdir(join(exported, 'sources'), { recursive: true });
    const manifest = { repository: 'https://github.com/Crashwif/game-lab', commit, assetRoot: `/assets/game-lab/${short}`, games: [] };
    const record = { commit, posterSeconds: {}, files: {} };
    const packs = {};
    for (const { slug, js = `console.log('${slug}');`, poster = Buffer.from(`poster of ${slug} at ${short}`), seconds = 10 } of games) {
      const game = { slug, name: slug, licence: 'open', royaltyBps: 0 };
      const files = { 'main.ts': `// ${slug}`, 'index.html': '<link rel="stylesheet" href="./style.css"><canvas></canvas><script src="./game.generated.js" defer></script>', 'style.css': 'canvas{display:block}' };
      const bundle = { 'index.html': files['index.html'], 'game.generated.js': js, 'style.css': files['style.css'], ...(poster ? { 'poster.png': poster } : {}) };
      await mkdir(join(exported, short, slug), { recursive: true });
      for (const [name, body] of Object.entries(bundle)) {
        await writeFile(join(exported, short, slug, name), body);
        record.files[`${short}/${slug}/${name}`] = sha256(body);
      }
      record.posterSeconds[slug] = seconds;
      manifest.games.push(game);
      packs[slug] = files;
      await writeFile(join(exported, 'sources', `${slug}.json`), JSON.stringify({ ...game, commit, entry: 'main.ts', files }));
    }
    await writeFile(join(exported, 'manifest.json'), JSON.stringify(manifest));
    await writeFile(join(exported, 'SOURCE.json'), JSON.stringify(record));
    return { manifest, packs };
  };
  const run = (...flags) => execFileSync(process.execPath, [SYNC, '--export', exported, '--platform', platform, ...flags], { encoding: 'utf8', stdio: 'pipe' });
  const sync = async (short, games, ...flags) => { const written = await write(short, games); return { ...written, output: run(...flags) }; };
  return { root, platform, exported, assets, page, lab, write, run, sync };
}

/** Every entry under `dir` by relative path, with a file's bytes, to show that a refused sync changed nothing. */
async function snapshot(dir) {
  const tree = {};
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    const path = join(entry.parentPath, entry.name);
    tree[relative(dir, path)] = entry.isFile() ? (await readFile(path)).toString('base64') : entry.isDirectory() ? 'directory' : 'other';
  }
  return tree;
}

/** Runs a sync that must be refused with `message`, and checks that it left the platform as it was. */
async function refused(lab, message, ...flags) {
  const before = await snapshot(lab.platform);
  assert.throws(() => lab.run(...flags), (error) => { assert.match(String(error.stderr), message); return true; });
  assert.deepEqual(await snapshot(lab.platform), before);
}

const releasesOf = async (assets) => (await readJson(join(assets, 'releases.json'))).map((r) => r.short);
const directories = async (assets) => (await readdir(assets, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();

test('gallery releases retain playable assets for open pages and replace the active catalog', async (t) => {
  const { assets, page, lab, sync } = await fixture(t);
  await sync('1111111', [{ slug: 'boiler-room' }]);
  const previous = {};
  for (const file of await readdir(join(assets, '1111111/boiler-room'))) {
    previous[file] = await readFile(join(assets, '1111111/boiler-room', file));
  }
  const current = await sync('2222222', [{ slug: 'thin-ice' }]);
  // Re-exporting a commit replaces its files without touching other versions.
  await writeFile(join(assets, '2222222/thin-ice/stale.txt'), 'stale');
  await sync('2222222', [{ slug: 'thin-ice' }]);

  for (const [file, bytes] of Object.entries(previous)) {
    assert.deepEqual(await readFile(join(assets, '1111111/boiler-room', file)), bytes);
  }
  assert.deepEqual((await readdir(join(assets, '2222222/thin-ice'))).sort(), Object.keys(previous).sort());
  assert.deepEqual(await readJson(page), current.manifest);
  assert.equal((await readJson(join(assets, 'SOURCE.json'))).commit, current.manifest.commit);
  assert.deepEqual(await readdir(join(lab, 'origins')), ['thin-ice']);
  const catalog = await readJson(join(lab, 'catalog.json'));
  assert.equal(catalog.commit, current.manifest.commit);
  assert.equal(catalog.origins.length, 1);
  assert.equal(catalog.origins[0].slug, 'thin-ice');
  for (const [file, body] of Object.entries(current.packs['thin-ice'])) {
    assert.equal(await readFile(join(lab, 'origins/thin-ice', file), 'utf8'), body);
    assert.equal(catalog.origins[0].files[file], sha256(body));
  }
});

test('the asset root comes from the commit, not from the export manifest', async (t) => {
  const lab = await fixture(t);
  await lab.write('1111111', [{ slug: 'boiler-room' }]);
  await editJson(join(lab.exported, 'manifest.json'), (m) => { m.assetRoot = '/assets/game-lab/../../../index.html'; });
  lab.run();
  assert.equal((await readJson(lab.page)).assetRoot, '/assets/game-lab/1111111');
});

test('old releases are pruned by when they stopped being live while the newest few and the live one stay', async (t) => {
  const lab = await fixture(t);
  const { assets, page, sync } = lab;
  // A platform from before releases.json: the live release, an older one and a directory that is not a release.
  for (const dir of ['0aaaaaa/boiler-room', '0bbbbbb/boiler-room', 'fonts']) await mkdir(join(assets, dir), { recursive: true });
  await writeFile(join(assets, 'fonts/impact.woff2'), 'font');
  await writeFile(page, JSON.stringify({ commit: '0aaaaaa'.padEnd(40, '0'), assetRoot: '/assets/game-lab/0aaaaaa', games: [] }));

  // The first run lists every release directory already there, the live one last, and deletes none.
  await sync('1111111', [{ slug: 'boiler-room' }]);
  assert.deepEqual(await releasesOf(assets), ['0bbbbbb', '0aaaaaa', '1111111']);
  assert.deepEqual(await directories(assets), ['0aaaaaa', '0bbbbbb', '1111111', 'fonts']);

  for (const short of ['2222222', '3333333', '4444444']) await sync(short, [{ slug: 'boiler-room' }]);
  assert.deepEqual(await directories(assets), ['0aaaaaa', '0bbbbbb', '1111111', '2222222', '3333333', '4444444', 'fonts']);

  // Days since each release went live and since the next one retired it; 4444444 is still live.
  const days = { '0bbbbbb': [60, 50], '0aaaaaa': [50, 40], '1111111': [40, 30], '2222222': [30, 20], '3333333': [20, 10], '4444444': [10] };
  const ago = (d) => new Date(Date.now() - d * DAY_MS).toISOString();
  await editJson(join(assets, 'releases.json'), (list) => {
    assert.deepEqual(list.filter((r) => r.retiredAt).map((r) => r.short), ['0bbbbbb', '0aaaaaa', '1111111', '2222222', '3333333']);
    return list.map((r) => { const [at, retiredAt] = days[r.short]; return { ...r, at: ago(at), ...(retiredAt ? { retiredAt: ago(retiredAt) } : {}) }; });
  });
  // Only 4444444, which this sync retires, and the new release fall inside the seven-day window, so keeping the newest three also keeps 3333333.
  const { output } = await sync('5555555', [{ slug: 'boiler-room' }]);
  assert.match(output, /pruned: 0aaaaaa, 0bbbbbb, 1111111, 2222222/);
  assert.deepEqual(await releasesOf(assets), ['3333333', '4444444', '5555555']);
  assert.deepEqual(await directories(assets), ['3333333', '4444444', '5555555', 'fonts']);

  // With no window and one kept release, the release the old page manifest named still stays.
  await sync('6666666', [{ slug: 'boiler-room' }], '--keep-days', '0', '--keep-min', '1');
  assert.deepEqual(await releasesOf(assets), ['5555555', '6666666']);
  assert.deepEqual(await directories(assets), ['5555555', '6666666', 'fonts']);
  assert.equal(await readFile(join(assets, 'fonts/impact.woff2'), 'utf8'), 'font');

  await lab.write('7777777', [{ slug: 'boiler-room' }]);
  for (const list of [[{ short: '../../x' }], [{ short: '6666666', at: new Date().toISOString(), retiredAt: 'soon' }]]) {
    await writeFile(join(assets, 'releases.json'), JSON.stringify(list));
    await refused(lab, /releases\.json must be a list/);
  }
});

test('the first sync with no releases.json keeps every release directory already there', async (t) => {
  const { assets, page, sync } = await fixture(t);
  const live = '0dddddd'.padEnd(40, '0');
  for (const short of ['0aaaaaa', '0bbbbbb', '0cccccc', '0dddddd']) await mkdir(join(assets, short, 'boiler-room'), { recursive: true });
  await writeFile(page, JSON.stringify({ commit: live, assetRoot: '/assets/game-lab/0dddddd', games: [] }));

  const { output } = await sync('1111111', [{ slug: 'boiler-room' }], '--keep-min', '1');
  assert.doesNotMatch(output, /pruned/);
  assert.deepEqual(await directories(assets), ['0aaaaaa', '0bbbbbb', '0cccccc', '0dddddd', '1111111']);
  const list = await readJson(join(assets, 'releases.json'));
  assert.deepEqual(list.map((r) => r.short), ['0aaaaaa', '0bbbbbb', '0cccccc', '0dddddd', '1111111']);
  // Only the live release's full commit is known for a directory from before the list.
  assert.deepEqual(list.map((r) => r.commit), [undefined, undefined, undefined, live, '1111111'.padEnd(40, '0')]);
});

test('a release ages from when it stopped being live, not from when it went live', async (t) => {
  const { assets, sync } = await fixture(t);
  await sync('1111111', [{ slug: 'boiler-room' }]);
  // 1111111 went live ten days ago; three releases then land close together.
  await editJson(join(assets, 'releases.json'), (list) => list.map((r) => ({ ...r, at: new Date(Date.now() - 10 * DAY_MS).toISOString() })));
  for (const short of ['2222222', '3333333', '4444444']) await sync(short, [{ slug: 'boiler-room' }]);
  assert.deepEqual(await releasesOf(assets), ['1111111', '2222222', '3333333', '4444444']);
  assert.deepEqual(await directories(assets), ['1111111', '2222222', '3333333', '4444444']);
});

test('re-syncing the live release changes nothing, and releases.json lists each release once', async (t) => {
  const { assets, platform, sync } = await fixture(t);
  // A re-run for the live release whose poster capture came out different keeps what is there.
  await sync('1111111', [{ slug: 'boiler-room' }]);
  let before = await snapshot(platform);
  await sync('1111111', [{ slug: 'boiler-room', poster: Buffer.from('another capture') }]);
  assert.deepEqual(await snapshot(platform), before);

  await sync('2222222', [{ slug: 'boiler-room', js: 'console.log("changed");' }]);
  before = await snapshot(platform);
  await sync('2222222', [{ slug: 'boiler-room', js: 'console.log("changed");' }]);
  assert.deepEqual(await snapshot(platform), before);
  assert.deepEqual(await releasesOf(assets), ['1111111', '2222222']);

  // A list with repeats keeps the first of each.
  await editJson(join(assets, 'releases.json'), (list) => [list[0], ...list, list[1]]);
  await sync('3333333', [{ slug: 'boiler-room' }]);
  assert.deepEqual(await releasesOf(assets), ['1111111', '2222222', '3333333']);
});

test('an unchanged game keeps the previous release poster byte for byte', async (t) => {
  const { assets, sync } = await fixture(t);
  await sync('1111111', [{ slug: 'boiler-room' }, { slug: 'thin-ice' }]);
  const first = await readFile(join(assets, '1111111/boiler-room/poster.png'));

  const { output } = await sync('2222222', [{ slug: 'boiler-room' }, { slug: 'thin-ice', js: 'console.log("changed");' }]);
  assert.match(output, /reused 1 unchanged posters from 1111111: boiler-room/);
  assert.deepEqual(await readFile(join(assets, '2222222/boiler-room/poster.png')), first);
  assert.equal(await readFile(join(assets, '2222222/thin-ice/poster.png'), 'utf8'), 'poster of thin-ice at 2222222');
  const source = await readJson(join(assets, 'SOURCE.json'));
  assert.equal(source.files['2222222/boiler-room/poster.png'], sha256(first));
  assert.equal(source.files['2222222/thin-ice/poster.png'], sha256('poster of thin-ice at 2222222'));

  // A new poster moment means a new poster, even with the same bundle.
  await sync('3333333', [{ slug: 'boiler-room', seconds: 12 }, { slug: 'thin-ice', js: 'console.log("changed");' }]);
  assert.equal(await readFile(join(assets, '3333333/boiler-room/poster.png'), 'utf8'), 'poster of boiler-room at 3333333');
  assert.equal(await readFile(join(assets, '3333333/thin-ice/poster.png'), 'utf8'), 'poster of thin-ice at 2222222');
});

test('an export without every poster is refused unless --allow-missing-posters', async (t) => {
  const lab = await fixture(t);
  const { assets, write } = lab;
  await lab.sync('1111111', [{ slug: 'boiler-room' }, { slug: 'thin-ice' }]);
  await write('2222222', [{ slug: 'boiler-room', poster: null }, { slug: 'thin-ice', js: 'console.log("changed");', poster: null }]);
  await refused(lab, /no poster for boiler-room, thin-ice/);

  const output = lab.run('--allow-missing-posters');
  assert.match(output, /reused 1 unchanged posters from 1111111: boiler-room/);
  assert.deepEqual(await readFile(join(assets, '2222222/boiler-room/poster.png')), await readFile(join(assets, '1111111/boiler-room/poster.png')));
  assert.deepEqual((await readdir(join(assets, '2222222/thin-ice'))).sort(), ['game.generated.js', 'index.html', 'style.css']);
});

test('a crafted export is refused before anything in the platform changes', async (t) => {
  const lab = await fixture(t);
  await lab.sync('1111111', [{ slug: 'boiler-room' }]);
  const manifest = join(lab.exported, 'manifest.json');
  const pack = join(lab.exported, 'sources/boiler-room.json');
  const cases = [
    ['a path out of the origin', /"\.\.\/\.\.\/x": source files are/, () => editJson(pack, (p) => { p.files['../../x'] = 'x'; })],
    ['a traversing slug', /"\.\.\/\.\.\/x" is not a game slug/, () => editJson(manifest, (m) => { m.games[0].slug = '../../x'; })],
    ['a bad commit', /commit must be a full 40-character SHA/, () => editJson(manifest, (m) => { m.commit = '../../../../x'.padEnd(40, 'a'); })],
    ['another game\'s pack', /is the pack for "thin-ice"/, () => editJson(pack, (p) => { p.slug = 'thin-ice'; })],
    ['a slug listed twice', /boiler-room is listed twice/, () => editJson(manifest, (m) => { m.games.push(m.games[0]); })],
    ['a missing entry', /the entry "engine\.ts" is missing/, () => editJson(pack, (p) => { p.entry = 'engine.ts'; })],
    ['an entry outside the pack', /the entry "\.\.\/main\.ts" is missing/, () => editJson(pack, (p) => { p.entry = '../main.ts'; })],
    ['a symlinked bundle file', /game\.generated\.js is not a plain file/, async () => {
      await rm(join(lab.exported, '1111111/boiler-room/game.generated.js'));
      await symlink(SYNC, join(lab.exported, '1111111/boiler-room/game.generated.js'));
    }],
  ];
  for (const [name, message, craft] of cases) {
    await t.test(name, async () => {
      await lab.write('1111111', [{ slug: 'boiler-room', poster: Buffer.from('a new poster') }]);
      await craft();
      await refused(lab, message);
    });
  }
});
