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
