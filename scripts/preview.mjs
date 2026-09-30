import { build } from 'esbuild';
import { copyFile, lstat, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EmulatorServer } from '../apps/emulator/dist/index.js';
import { bundleOptions } from './build.mjs';
import { GAMES } from './games.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Each preview serves one freshly built game and its relative media. */
export async function previewGame(game, { root = ROOT, games = GAMES, port = 4500 } = {}) {
  if (typeof game !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(game) || !games.includes(game)) throw new Error('Choose a game listed in scripts/games.mjs.');
  const source = join(root, 'games', game);
  if ((await lstat(source)).isSymbolicLink()) throw new Error('A preview needs a game directory inside the clone.');
  const directory = await mkdtemp(join(tmpdir(), 'game-lab-preview-'));
  const destination = join(directory, game);
  let server;
  try {
    await mkdir(destination);
    await build({ ...bundleOptions(game), absWorkingDir: root, outfile: join(destination, 'game.generated.js') });
    async function media(from, to) {
      for (const entry of await readdir(from, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'studio-lineage.json') continue;
        if (entry.isSymbolicLink()) throw new Error('Preview media cannot be symbolic links.');
        if (entry.isDirectory()) { await mkdir(join(to, entry.name)); await media(join(from, entry.name), join(to, entry.name)); }
        else if (entry.isFile() && !/\.(ts|js|md|txt)$/i.test(entry.name)) await copyFile(join(from, entry.name), join(to, entry.name));
      }
    }
    await media(source, destination);
    server = new EmulatorServer({ port, serveDir: directory, scenario: 'edge' });
    await server.listen();
    return { directory, port: server.port, close: async () => { try { await server.close(); } finally { await rm(directory, { recursive: true, force: true }); } } };
  } catch (error) {
    if (server) await server.close();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

if (import.meta.main) {
  if (process.argv.length !== 3) throw new Error('Use npm run preview -- <game>.');
  const game = process.argv[2];
  const preview = await previewGame(game);
  console.log(`${game}: http://127.0.0.1:${preview.port}/bundle/${game}/index.html?mode=replay`);
  process.on('exit', () => rmSync(preview.directory, { recursive: true, force: true }));
  let closing = false;
  const stop = () => {
    if (closing) process.exit(130);
    closing = true;
    setTimeout(() => process.exit(1), 2000).unref();
    preview.close().then(() => process.exit(0), () => process.exit(1));
  };
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
}
