import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist/balloon-pump', { recursive: true });
await build({ entryPoints: ['games/balloon-pump/main.ts'], bundle: true, format: 'iife', platform: 'browser', outfile: 'dist/balloon-pump/game.generated.js', minify: true });
for (const file of ['index.html', 'style.css']) await copyFile(`games/balloon-pump/${file}`, `dist/balloon-pump/${file}`);
