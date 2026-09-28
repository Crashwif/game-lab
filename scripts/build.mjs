/**
 * Bundles every game into dist/<slug>/: game.generated.js from its main.ts, beside its index.html and
 * style.css. The esbuild options match the platform's remix bundler (packages/unlock-api/src/build.ts in
 * Crashwif/crashwif), and scripts/gallery/check.mjs bundles with the same options in memory.
 */
import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { GAMES } from './games.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** esbuild's options for a game's bundle, with paths relative to the repository root. */
export const bundleOptions = (game) => ({ absWorkingDir: ROOT, entryPoints: [`games/${game}/main.ts`], bundle: true, format: 'iife', platform: 'browser', outfile: `dist/${game}/game.generated.js`, minify: true, target: 'es2022', legalComments: 'none' });

if (import.meta.main) {
  process.chdir(ROOT);
  for (const game of GAMES) {
    await mkdir(`dist/${game}`, { recursive: true });
    await build(bundleOptions(game));
    for (const file of ['index.html', 'style.css']) await copyFile(`games/${game}/${file}`, `dist/${game}/${file}`);
  }
}
