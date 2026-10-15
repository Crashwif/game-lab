import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newGame } from '../new-game.mjs';
import { previewArgs } from '../preview.mjs';

const source = new URL('../../games/hello-world/', import.meta.url);
test('scaffold registers the game and preserves shared source, replay proof and ancestry', async t => {
  const root = await mkdtemp(join(tmpdir(), 'new-game-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'games'), { recursive: true });
  await cp(source, join(root, 'games/hello-world'), { recursive: true });
  await writeFile(join(root, 'games/hello-world/studio-lineage.json'), '{"ancestor":"example"}');
  await mkdir(join(root, 'scripts/audio'), { recursive: true });
  await writeFile(join(root, 'scripts/games.mjs'), "export const GAMES = ['hello-world'];\nexport const BROWSER_REMIX = ['hello-world'];\n");
  await writeFile(join(root, 'scripts/audio/prompts.json'), '{"games":{}}\n');
  await writeFile(join(root, 'README.md'), '| Reference | What to study | Status |\n| --- | --- | --- |\n| [Hello World](games/hello-world) | Starter | Playable |\n');
  const result = await newGame('my-game', 'My <Game>', { root });
  const read = file => readFile(join(result.directory, file), 'utf8');
  for (const file of ['main.ts', 'audio.ts', 'style.css', 'clips.json', 'studio-lineage.json']) {
    assert.equal(await read(file), await readFile(join(root, 'games/hello-world', file), 'utf8'));
  }
  const original = JSON.parse(await readFile(new URL('replay.json', source), 'utf8'));
  assert.deepEqual(JSON.parse(await read('replay.json')), { ...original, gameId: 'my-game' });
  assert.match(await read('index.html'), /My &lt;Game&gt;/);
  assert.equal(JSON.parse(await read('gallery.json')).name, 'My <Game>');
  assert.match(await readFile(join(root, 'scripts/games.mjs'), 'utf8'), /GAMES = \['hello-world', 'my-game'\]/);
  assert.match(await readFile(join(root, 'README.md'), 'utf8'), /games\/my-game/);
  const before = await read('scene.ts');
  await assert.rejects(newGame('my-game', 'Overwrite', { root }), /already exists/);
  assert.equal(await read('scene.ts'), before);
  await assert.rejects(newGame('../outside', 'Outside', { root }), /slug/);
});

test('preview CLI gives help, names and an explicit watch choice', () => {
  assert.deepEqual(previewArgs(['--help']), { mode: 'help' });
  assert.deepEqual(previewArgs(['--list']), { mode: 'list' });
  assert.deepEqual(previewArgs(['hello-world']), { mode: 'preview', game: 'hello-world', watching: true });
  assert.deepEqual(previewArgs(['hello-world', '--no-watch']), { mode: 'preview', game: 'hello-world', watching: false });
  assert.throws(() => previewArgs(['hello-world', '--bad']), /Use npm/);
});
