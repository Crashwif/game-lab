import { context } from 'esbuild';
import { copyFile, lstat, mkdir, mkdtemp, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { rmSync, watch } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EmulatorServer } from '../apps/emulator/dist/index.js';
import { bundleOptions } from './build.mjs';
import { GAMES } from './games.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Each successful build replaces the served snapshot; a failed edit leaves the last playable one. */
export async function previewGame(game, { root = ROOT, games = GAMES, port = 4500, watch: watching = false, onRebuild = () => {} } = {}) {
  if (typeof game !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(game) || !games.includes(game)) throw new Error('Choose a game listed in scripts/games.mjs. Use --list to see the available games.');
  const source = join(root, 'games', game);
  if ((await lstat(source)).isSymbolicLink()) throw new Error('A preview needs a game directory inside the clone.');
  const directory = await mkdtemp(join(tmpdir(), 'game-lab-preview-'));
  let server, builder, watcher, timer, closing = false;
  let pending = Promise.resolve(), snapshots = [];
  async function media(from, to) {
    for (const entry of await readdir(from, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'studio-lineage.json') continue;
      if (entry.isSymbolicLink()) throw new Error('Preview media cannot be symbolic links.');
      if (entry.isDirectory()) { await mkdir(join(to, entry.name)); await media(join(from, entry.name), join(to, entry.name)); }
      else if (entry.isFile() && !/\.(ts|js|md|txt)$/i.test(entry.name)) await copyFile(join(from, entry.name), join(to, entry.name));
    }
  }
  async function buildSnapshot() {
    const result = await builder.rebuild();
    const snapshot = await mkdtemp(join(directory, '.snapshot-'));
    try {
      await media(source, snapshot);
      await writeFile(join(snapshot, 'game.generated.js'), result.outputFiles[0].contents);
      const next = join(directory, '.next');
      await symlink(snapshot, next, 'dir');
      await rename(next, join(directory, game));
      snapshots.push(snapshot);
      if (snapshots.length > 2) await rm(snapshots.shift(), { recursive: true, force: true });
    } catch (error) { await rm(snapshot, { recursive: true, force: true }); throw error; }
  }
  function rebuild() {
    if (closing) return Promise.reject(new Error('Preview is closed.'));
    const next = pending.then(buildSnapshot);
    pending = next.catch(() => {});
    return next;
  }
  async function close() {
    if (closing) return;
    closing = true;
    clearTimeout(timer);
    watcher?.close();
    await pending;
    try { await builder?.dispose(); await server?.close(); }
    finally { await rm(directory, { recursive: true, force: true }); }
  }
  try {
    builder = await context({ ...bundleOptions(game), absWorkingDir: root, outfile: join(directory, 'game.generated.js'), write: false, logLevel: 'silent' });
    await rebuild();
    server = new EmulatorServer({ port, serveDir: directory, scenario: 'edge' });
    await server.listen();
    if (watching) watcher = watch(source, { recursive: true }, (_event, filename) => {
      if (filename && /(?:^|\/)(?:\.|node_modules)|\.(?:md|txt)$/.test(filename.toString())) return;
      clearTimeout(timer);
      timer = setTimeout(() => { void rebuild().then(() => onRebuild(null), onRebuild); }, 100);
    });
    return { directory, port: server.port, rebuild, close };
  } catch (error) { await close(); throw error; }
}

export function previewArgs(args) {
  if (args.length === 1 && ['--help', '-h', '--list'].includes(args[0])) return { mode: args[0] === '--list' ? 'list' : 'help' };
  const names = args.filter((arg) => !arg.startsWith('-'));
  if (names.length !== 1 || args.some((arg) => arg.startsWith('-') && !['--watch', '--no-watch'].includes(arg))
    || (args.includes('--watch') && args.includes('--no-watch'))) throw new Error('Use npm run preview -- <game> [--no-watch], or --list / --help.');
  return { mode: 'preview', game: names[0], watching: !args.includes('--no-watch') };
}

if (import.meta.main) {
  try {
    const args = previewArgs(process.argv.slice(2));
    if (args.mode === 'help') console.log('Usage: npm run preview -- <game> [--no-watch]\nRebuilds the selected game on save. Refresh the browser to see each successful build.\nUse --list for game names.');
    else if (args.mode === 'list') console.log(GAMES.join('\n'));
    else {
      const preview = await previewGame(args.game, { watch: args.watching, onRebuild: (error) => console.log(error ? `Build failed; keeping your last playable preview.\n${error.message}` : 'Preview rebuilt. Refresh your browser.') });
      const url = `http://127.0.0.1:${preview.port}/bundle/${args.game}/index.html`;
      console.log(`Replay: ${url}?mode=replay\nLive play: ${url}${args.watching ? '\nWatching this game for edits.' : ''}`);
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
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
