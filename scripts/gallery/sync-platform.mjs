/**
 * Applies a gallery export to a checkout of the platform repository: replaces
 * apps/web/public/assets/game-lab with the export's versioned directory and
 * SOURCE.json, and writes the page manifest the Game Lab page renders from.
 *
 *   node scripts/gallery/sync-platform.mjs --export gallery-out --platform ../crashwif
 */
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const option = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const exportDir = option('export', 'gallery-out');
const platform = option('platform', '');
if (!platform) throw new Error('--platform <path to the platform checkout> is required');

const manifest = JSON.parse(await readFile(join(exportDir, 'manifest.json'), 'utf8'));
const short = manifest.commit.slice(0, 7);
await stat(join(exportDir, short));
const assets = join(platform, 'apps', 'web', 'public', 'assets', 'game-lab');
const page = join(platform, 'apps', 'web', 'src', 'pages', 'unlock', 'game-lab.json');
await mkdir(assets, { recursive: true });
for (const entry of await readdir(assets)) await rm(join(assets, entry), { recursive: true, force: true });
await cp(join(exportDir, short), join(assets, short), { recursive: true });
await cp(join(exportDir, 'SOURCE.json'), join(assets, 'SOURCE.json'));
await writeFile(page, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`synced ${manifest.games.length} games at ${short} into ${platform}`);
