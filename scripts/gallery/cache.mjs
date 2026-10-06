/** Verified, per-game build outputs. A cache miss always rebuilds from the selected source commit. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, SLUG } from './pack.mjs';

export const BUNDLE_FILES = ['index.html', 'game.generated.js', 'style.css'];
const VERSION = 1;
export const digest = (value) => createHash('sha256').update(value).digest('hex');
const key = (value) => digest(JSON.stringify(value));
const entries = (files) => Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).map(([path, content]) => [path, digest(content)]);
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** Cached builds read the exact checkout named by the source packs, including on manual rollbacks. */
export function sharedInputs(commit, root = ROOT) {
  if (git(root, 'rev-parse', 'HEAD') !== commit || git(root, 'status', '--porcelain')) {
    throw new Error('--cache requires a clean checkout of --commit; use an isolated worktree for another commit');
  }
  // Unknown shared files invalidate every game. Catalog order and prose do not change a bundle or poster.
  const shared = git(root, 'ls-tree', '-r', '-z', '--full-tree', commit).split('\0').filter(Boolean).filter((entry) => {
    const path = entry.slice(entry.indexOf('\t') + 1);
    return !path.startsWith('games/') && !path.endsWith('.md') && path !== 'scripts/games.mjs';
  });
  return key({ version: VERSION, shared, node: process.version, platform: process.platform, arch: process.arch,
    captureEnvironment: process.env.GAME_LAB_CAPTURE_ENV ?? 'local' });
}

export function gameKeys(game, shared) {
  const bundle = key({ version: VERSION, slug: game.slug, shared, sources: entries(game.sources) });
  return { bundle, poster: key({ bundle, seconds: game.poster.seconds }) };
}

async function plain(path, directory = false) {
  const stat = await lstat(path);
  if (directory ? !stat.isDirectory() : !stat.isFile()) throw new Error(`${path} is not a plain ${directory ? 'directory' : 'file'}`);
  return directory ? null : readFile(path);
}

/** Hash mismatches, missing files and unsafe cache entries count as misses, never as publishable output. */
export async function cachedGame(cache, game, keys) {
  const result = { ...game, keys, bundle: null, cachedPoster: null };
  if (!cache) return result;
  if (!SLUG.test(game.slug)) throw new Error('invalid cache slug');
  try {
    const dir = join(cache, game.slug);
    await plain(cache, true); await plain(dir, true);
    const record = JSON.parse(await plain(join(dir, 'record.json')));
    if (record.version !== VERSION || record.bundle !== keys.bundle) return result;
    const bundle = {};
    for (const file of BUNDLE_FILES) {
      const bytes = await plain(join(dir, file));
      if (digest(bytes) !== record.files?.[file]) return result;
      bundle[file] = bytes;
    }
    result.bundle = bundle;
    if (record.poster === keys.poster) {
      const poster = await plain(join(dir, 'poster.png'));
      if (digest(poster) === record.files?.['poster.png']) result.cachedPoster = poster;
    }
  } catch { /* Cache contents are optional; rebuilding supplies verified outputs. */ }
  return result;
}

export async function planGames(games, cache, shared) {
  const planned = [];
  for (const game of games) planned.push(await cachedGame(cache, game, gameKeys(game, shared)));
  return planned;
}

/** Records only complete exports whose poster capture passed. The next run also checks each file's hash. */
export async function saveGame(cache, game, directory) {
  if (!SLUG.test(game.slug)) throw new Error('invalid cache slug');
  const bytes = {};
  for (const file of [...BUNDLE_FILES, 'poster.png']) bytes[file] = await plain(join(directory, file));
  await mkdir(cache, { recursive: true });
  await plain(cache, true);
  const dir = join(cache, game.slug);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir);
  for (const [file, body] of Object.entries(bytes)) await writeFile(join(dir, file), body);
  await writeFile(join(dir, 'record.json'), JSON.stringify({ version: VERSION, ...game.keys, files: Object.fromEntries(entries(bytes)) }) + '\n');
}
