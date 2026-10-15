import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { previewGame } from '../preview.mjs';

test('preview builds and serves only its selected game, including nested media', async t => {
  const root = await mkdtemp(join(tmpdir(), 'preview-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'games', 'selected', 'images'), { recursive: true });
  await mkdir(join(root, 'games', 'broken'));
  await writeFile(join(root, 'games', 'selected', 'main.ts'), 'document.title = "Selected remix";');
  await writeFile(join(root, 'games', 'selected', 'index.html'), '<html>Selected remix</html>');
  await writeFile(join(root, 'games', 'selected', 'style.css'), 'body { color: red }');
  await writeFile(join(root, 'games', 'selected', 'images', 'sprite.svg'), '<svg />');
  await writeFile(join(root, 'games', 'broken', 'main.ts'), 'this is not TypeScript');
  const preview = await previewGame('selected', { root, games: ['selected', 'broken'], port: 0 });
  t.after(() => preview.close());
  const base = `http://127.0.0.1:${preview.port}/bundle`;
  const html = await fetch(`${base}/selected/index.html?mode=replay`);
  assert.equal(html.status, 200);
  assert.match(await html.text(), /Selected remix/);
  assert.equal((await fetch(`${base}/selected/game.generated.js`)).status, 200);
  assert.equal(await (await fetch(`${base}/selected/images/sprite.svg`)).text(), '<svg />');
  assert.equal((await fetch(`${base}/broken/index.html`)).status, 404);
  await assert.rejects(access(join(root, 'dist')));
});

test('preview refuses absent games and path traversal before building', async () => {
  for (const game of ['missing', '../selected', 'selected/../../other', undefined]) {
    await assert.rejects(previewGame(game, { games: ['selected'], port: 0 }), /Choose a game/);
  }
});

test('watched edits keep the last successful snapshot on a syntax error and publish the next good build', async t => {
  const root = await mkdtemp(join(tmpdir(), 'preview-watch-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'games', 'selected');
  await mkdir(source, { recursive: true });
  await writeFile(join(source, 'main.ts'), 'document.title = "First version";');
  await writeFile(join(source, 'index.html'), '<html>First version</html>');
  await writeFile(join(source, 'style.css'), 'body { color: red }');
  const events = [];
  const preview = await previewGame('selected', { root, games: ['selected'], port: 0, watch: true, onRebuild: error => events.push(error) });
  t.after(() => preview.close());
  const url = `http://127.0.0.1:${preview.port}/bundle/selected/game.generated.js`;
  const original = await (await fetch(url)).text();
  const until = async predicate => {
    const deadline = Date.now() + 5000;
    while (!predicate()) { assert.ok(Date.now() < deadline, 'watch callback did not arrive'); await new Promise(resolve => setTimeout(resolve, 30)); }
  };
  await writeFile(join(source, 'main.ts'), 'export const broken = ;');
  await until(() => events.some(Boolean));
  assert.equal(await (await fetch(url)).text(), original);
  events.length = 0;
  await writeFile(join(source, 'main.ts'), 'document.title = "Second version";');
  await until(() => events.includes(null));
  assert.match(await (await fetch(url)).text(), /Second version/);
});
