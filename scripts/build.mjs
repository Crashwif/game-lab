/**
 * Bundles every game into dist/<slug>/: game.generated.js from its main.ts, beside its index.html and
 * style.css. The esbuild options match the platform's remix bundler (packages/unlock-api/src/build.ts in
 * Crashwif/crashwif), and scripts/gallery/check.mjs bundles with the same options in memory.
 */
import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { GAMES } from './games.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** esbuild's options for a game's bundle, with paths relative to the repository root. */
export const bundleOptions = (game) => ({ absWorkingDir: ROOT, entryPoints: [`games/${game}/main.ts`], bundle: true, format: 'iife', platform: 'browser', outfile: `dist/${game}/game.generated.js`, minify: true, target: 'es2022', legalComments: 'none' });

export async function buildGames(games = GAMES, { root = ROOT, dist = join(root, 'dist') } = {}) {
  for (const game of games) {
    if (!GAMES.includes(game)) throw new Error(`Unknown game: ${game}`);
    const destination = resolve(dist, game);
    await mkdir(destination, { recursive: true });
    await build({ ...bundleOptions(game), absWorkingDir: root, outfile: join(destination, 'game.generated.js') });
    for (const file of ['index.html', 'style.css']) await copyFile(join(root, 'games', game, file), join(destination, file));
  }
}

if (import.meta.main) await buildGames();
