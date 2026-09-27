/**
 * Applies a gallery export to a checkout of the platform repository: adds
 * the export's versioned directory under apps/web/public/assets/game-lab,
 * updates SOURCE.json and the page manifest the Game Lab page renders from, and
 * replaces packages/game-lab's catalog and origin sources (what the studio's
 * remix flow starts from) with the export's source packs.
 *
 *   node scripts/gallery/sync-platform.mjs --export gallery-out --platform ../crashwif
 */
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
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
const lab = join(platform, 'packages', 'game-lab');
await mkdir(assets, { recursive: true });
// Open pages keep the asset root from their loaded manifest across gallery releases.
await rm(join(assets, short), { recursive: true, force: true });
await cp(join(exportDir, short), join(assets, short), { recursive: true });
await cp(join(exportDir, 'SOURCE.json'), join(assets, 'SOURCE.json'));
await writeFile(page, `${JSON.stringify(manifest, null, 2)}\n`);

// The origin catalog and sources: one directory per game with its files as they are, so changes review as diffs.
await stat(lab).catch(() => { throw new Error(`${lab} is missing: the platform checkout is too old for source packs`); });
await rm(join(lab, 'origins'), { recursive: true, force: true });
const origins = [];
for (const game of manifest.games) {
  const pack = JSON.parse(await readFile(join(exportDir, 'sources', `${game.slug}.json`), 'utf8'));
  const files = {};
  for (const [path, content] of Object.entries(pack.files)) {
    await mkdir(join(lab, 'origins', game.slug), { recursive: true });
    await writeFile(join(lab, 'origins', game.slug, path), content);
    files[path] = createHash('sha256').update(content).digest('hex');
  }
  origins.push({ ...game, entry: pack.entry, files });
}
await writeFile(join(lab, 'catalog.json'), `${JSON.stringify({ repository: manifest.repository, commit: manifest.commit, origins }, null, 2)}\n`);
console.log(`synced ${manifest.games.length} games at ${short} into ${platform} (web assets, page manifest, packages/game-lab)`);
