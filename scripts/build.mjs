import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
for (const game of ['balloon-pump', 'tower-tension', 'boiler-room', 'thin-ice', 'king-of-the-hill', 'exit-liquidity', 'blanket-champ']) {
  await mkdir(`dist/${game}`, { recursive: true });
  await build({ entryPoints: [`games/${game}/main.ts`], bundle: true, format: 'iife', platform: 'browser', outfile: `dist/${game}/game.generated.js`, minify: true });
  for (const file of ['index.html', 'style.css']) await copyFile(`games/${game}/${file}`, `dist/${game}/${file}`);
}
