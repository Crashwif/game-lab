import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('gallery releases retain playable assets for open pages and replace the active catalog', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'gallery-sync-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const platform = join(root, 'platform');
  const exported = join(root, 'export');
  const assets = join(platform, 'apps/web/public/assets/game-lab');
  const page = join(platform, 'apps/web/src/pages/unlock/game-lab.json');
  const lab = join(platform, 'packages/game-lab');
  await mkdir(join(platform, 'apps/web/src/pages/unlock'), { recursive: true });
  await mkdir(lab, { recursive: true });
  await mkdir(join(exported, 'sources'), { recursive: true });

  const sync = async (short, slug) => {
    const commit = short.padEnd(40, '0');
    const game = { slug, name: slug, licence: 'open', royaltyBps: 0 };
    const manifest = { repository: 'https://github.com/Crashwif/game-lab', commit, assetRoot: `/assets/game-lab/${short}`, games: [game] };
    const files = { 'main.ts': `// ${slug}`, 'index.html': '<canvas></canvas>', 'style.css': 'canvas{display:block}' };
    await mkdir(join(exported, short, slug), { recursive: true });
    for (const [name, body] of Object.entries({ 'index.html': files['index.html'], 'game.generated.js': `console.log('${slug}');`, 'style.css': files['style.css'], 'poster.png': Buffer.from([137, 80, 78, 71]) })) {
      await writeFile(join(exported, short, slug, name), body);
    }
    await writeFile(join(exported, 'manifest.json'), JSON.stringify(manifest));
    await writeFile(join(exported, 'SOURCE.json'), JSON.stringify({ commit }));
    await writeFile(join(exported, 'sources', `${slug}.json`), JSON.stringify({ ...game, commit, entry: 'main.ts', files }));
    execFileSync(process.execPath, [fileURLToPath(new URL('./sync-platform.mjs', import.meta.url)), '--export', exported, '--platform', platform]);
    return { manifest, files };
  };

  await sync('1111111', 'boiler-room');
  const previous = {};
  for (const file of await readdir(join(assets, '1111111/boiler-room'))) {
    previous[file] = await readFile(join(assets, '1111111/boiler-room', file));
  }
  const current = await sync('2222222', 'thin-ice');
  // Re-exporting a commit replaces its files without touching other versions.
  await writeFile(join(assets, '2222222/thin-ice/stale.txt'), 'stale');
  await sync('2222222', 'thin-ice');

  for (const [file, bytes] of Object.entries(previous)) {
    assert.deepEqual(await readFile(join(assets, '1111111/boiler-room', file)), bytes);
  }
  assert.deepEqual((await readdir(join(assets, '2222222/thin-ice'))).sort(), Object.keys(previous).sort());
  assert.deepEqual(JSON.parse(await readFile(page, 'utf8')), current.manifest);
  assert.equal(JSON.parse(await readFile(join(assets, 'SOURCE.json'), 'utf8')).commit, current.manifest.commit);
  assert.deepEqual(await readdir(join(lab, 'origins')), ['thin-ice']);
  const catalog = JSON.parse(await readFile(join(lab, 'catalog.json'), 'utf8'));
  assert.equal(catalog.commit, current.manifest.commit);
  assert.equal(catalog.origins.length, 1);
  assert.equal(catalog.origins[0].slug, 'thin-ice');
  for (const [file, body] of Object.entries(current.files)) {
    assert.equal(await readFile(join(lab, 'origins/thin-ice', file), 'utf8'), body);
    assert.equal(catalog.origins[0].files[file], createHash('sha256').update(body).digest('hex'));
  }
});
