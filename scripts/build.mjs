import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { GAMES } from './games.mjs';
for (const game of GAMES) {
  await mkdir(`dist/${game}`, { recursive: true });
  await build({ entryPoints: [`games/${game}/main.ts`], bundle: true, format: 'iife', platform: 'browser', outfile: `dist/${game}/game.generated.js`, minify: true });
  for (const file of ['index.html', 'style.css']) await copyFile(`games/${game}/${file}`, `dist/${game}/${file}`);
}
