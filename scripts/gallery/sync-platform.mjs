/**
 * Applies a gallery export to a checkout of the platform repository: adds
 * the export's versioned directory under apps/web/public/assets/game-lab,
 * updates SOURCE.json and the page manifest the Game Lab page renders from, and
 * replaces packages/game-lab's catalog and origin sources (what the studio's
 * remix flow starts from) with the export's source packs.
 *
 *   node scripts/gallery/sync-platform.mjs --export gallery-out --platform ../crashwif [--keep-days 7] [--keep-min 3] [--allow-missing-posters]
 *
 * The export is checked in full before anything in the platform changes: the
 * commit, every slug, source path and entry against the platform's own rules,
 * and every destination against its root. An export without a poster for
 * every game is refused unless --allow-missing-posters is passed.
 *
 * A game whose bundle files and poster moment match the previous release
 * keeps that release's poster, so an unchanged game adds nothing new to the
 * platform's history. assets/releases.json lists the release directories kept
 * for pages opened before a release: every release that was live within the
 * last --keep-days days, never fewer than the last --keep-min to go live, and
 * always the new release and the one the previous page manifest named. Other
 * short-commit directories are deleted. The first run, with no releases.json
 * yet, lists every release directory already there as retired now, so it
 * deletes none of them. Re-syncing the live release leaves the list as it is.
 */
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { SLUG, checkSources } from './pack.mjs';

const BUNDLE_FILES = ['index.html', 'game.generated.js', 'style.css'];
const COMMIT = /^[0-9a-f]{40}$/;
/** A release directory's name; nothing else under the assets directory is ever deleted. */
const RELEASE = /^[0-9a-f]{7}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const argv = process.argv.slice(2);
const option = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const exportDir = option('export', 'gallery-out');
const platform = option('platform', '');
if (!platform) throw new Error('--platform <path to the platform checkout> is required');
const keepDays = Number(option('keep-days', '7'));
const keepMin = Number(option('keep-min', '3'));
if (!Number.isFinite(keepDays) || keepDays < 0) throw new Error('--keep-days is a number of days, 0 or more');
if (!Number.isInteger(keepMin) || keepMin < 0) throw new Error('--keep-min is a whole number, 0 or more');
const allowMissingPosters = argv.includes('--allow-missing-posters');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const missing = (error) => { if (error.code === 'ENOENT') return null; throw error; };
async function readJson(path) {
  const text = await readFile(path, 'utf8');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${path}: ${error.message}`);
  }
}
/** Resolves `parts` under `root`, refusing anything that lands outside it. */
function inside(root, ...parts) {
  const base = resolve(root);
  const path = resolve(base, ...parts);
  if (!path.startsWith(base + sep)) throw new Error(`${parts.join('/')} escapes ${root}`);
  return path;
}
/** A plain file's bytes, or null for a missing file that is optional; symlinks and directories are refused. */
async function plainFile(path, required = true) {
  const stat = await lstat(path).catch(missing);
  if (!stat) {
    if (required) throw new Error(`${path} is missing`);
    return null;
  }
  if (!stat.isFile()) throw new Error(`${path} is not a plain file`);
  return readFile(path);
}
const isDate = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
/**
 * A releases.json entry: `at` is when the release went live and `retiredAt` when the next one replaced
 * it. Only a directory that was already there when the list began has no `commit`.
 */
const isRelease = (r) => typeof r?.short === 'string' && RELEASE.test(r.short)
  && (r.commit === undefined || (typeof r.commit === 'string' && COMMIT.test(r.commit) && r.commit.startsWith(r.short)))
  && isDate(r.at) && (r.retiredAt === undefined || isDate(r.retiredAt));

// Check the export in full before anything in the platform changes.
const manifest = await readJson(join(exportDir, 'manifest.json'));
if (typeof manifest.commit !== 'string' || !COMMIT.test(manifest.commit)) throw new Error('manifest.json: commit must be a full 40-character SHA');
if (typeof manifest.repository !== 'string' || !manifest.repository.startsWith('https://')) throw new Error('manifest.json: repository must be an https URL');
if (!Array.isArray(manifest.games) || manifest.games.length === 0) throw new Error('manifest.json: games must be a non-empty list');
const short = manifest.commit.slice(0, 7);
const assets = join(platform, 'apps', 'web', 'public', 'assets', 'game-lab');
const page = join(platform, 'apps', 'web', 'src', 'pages', 'unlock', 'game-lab.json');
const lab = join(platform, 'packages', 'game-lab');
const release = inside(assets, short);
const source = await readJson(join(exportDir, 'SOURCE.json'));
if (source.commit !== manifest.commit) throw new Error('SOURCE.json and manifest.json name different commits');
const games = [];
for (const game of manifest.games) {
  const slug = game?.slug;
  if (typeof slug !== 'string' || !SLUG.test(slug)) throw new Error(`manifest.json: ${JSON.stringify(slug)} is not a game slug`);
  if (games.some((g) => g.slug === slug)) throw new Error(`manifest.json: ${slug} is listed twice`);
  const pack = await readJson(join(exportDir, 'sources', `${slug}.json`));
  if (pack.slug !== slug) throw new Error(`sources/${slug}.json is the pack for ${JSON.stringify(pack.slug)}`);
  try {
    checkSources(pack.files, pack.entry);
  } catch (error) {
    throw new Error(`sources/${slug}.json: ${error.message}`);
  }
  const origin = inside(lab, 'origins', slug);
  for (const path of Object.keys(pack.files)) inside(origin, path);
  const bundle = {};
  for (const file of BUNDLE_FILES) bundle[file] = await plainFile(join(exportDir, short, slug, file));
  games.push({ slug, game, pack, origin, dir: inside(release, slug), bundle, poster: await plainFile(join(exportDir, short, slug, 'poster.png'), false) });
}
const posterless = games.filter((g) => !g.poster).map((g) => g.slug);
if (posterless.length && !allowMissingPosters) throw new Error(`the export has no poster for ${posterless.join(', ')}: capture them, or pass --allow-missing-posters to publish without`);
await lstat(dirname(page)).catch(() => { throw new Error(`${dirname(page)} is missing: --platform must be a checkout of the platform`); });
await lstat(lab).catch(() => { throw new Error(`${lab} is missing: the platform checkout is too old for source packs`); });

// What the platform serves now: the previous page manifest, its SOURCE.json and the kept releases.
const previousPage = await readJson(page).catch(missing);
const previousShort = /^\/assets\/game-lab\/([0-9a-f]{7})$/.exec(previousPage?.assetRoot ?? '')?.[1];
const previous = previousShort && COMMIT.test(previousPage.commit ?? '') && previousPage.commit.startsWith(previousShort) ? { short: previousShort, commit: previousPage.commit } : null;
const previousSource = await readJson(join(assets, 'SOURCE.json')).catch(missing);
const listed = await readJson(join(assets, 'releases.json')).catch(missing);
if (listed !== null && (!Array.isArray(listed) || !listed.every(isRelease))) throw new Error(`${assets}/releases.json must be a list of { short, commit, at, retiredAt }: fix it, or delete it to list every release directory there again`);
// With no releases.json yet, the release directories already there: the run that starts the list keeps them all.
const unlisted = listed ? [] : ((await readdir(assets, { withFileTypes: true }).catch(missing)) ?? []).filter((e) => e.isDirectory() && RELEASE.test(e.name)).map((e) => e.name).sort();

// Reuse the previous release's poster for a game whose bundle files and poster moment are unchanged.
const reused = [];
const before = COMMIT.test(previousSource?.commit ?? '') ? previousSource.commit.slice(0, 7) : null;
for (const g of games) {
  if (!before || typeof source.posterSeconds?.[g.slug] !== 'number' || previousSource.posterSeconds?.[g.slug] !== source.posterSeconds[g.slug]) continue;
  if (!BUNDLE_FILES.every((file) => previousSource.files?.[`${before}/${g.slug}/${file}`] === sha256(g.bundle[file]))) continue;
  const poster = await plainFile(join(assets, before, g.slug, 'poster.png'), false);
  if (!poster) continue;
  g.poster = poster;
  source.files = { ...source.files, [`${short}/${g.slug}/poster.png`]: sha256(poster) };
  reused.push(g.slug);
}

const now = Date.now();
const stamp = new Date(now).toISOString();
// Each release once, keeping the first of any repeat. The first run starts the list with the directories already there, retired now.
const seen = new Set();
const all = (listed ?? unlisted.filter((name) => name !== previous?.short).map((name) => ({ short: name, at: stamp, retiredAt: stamp }))).filter((r) => !seen.has(r.short) && seen.add(r.short));
// Re-syncing the live release keeps its entry as it is; any other release goes last, live from now.
const live = previous?.short === short ? all.find((r) => r.short === short) : undefined;
const releases = all.filter((r) => r.short !== short);
if (previous && previous.short !== short) {
  // The release this one replaces ages from now, when pages stop opening on it.
  const i = releases.findIndex((r) => r.short === previous.short);
  if (i < 0) releases.push({ ...previous, at: stamp, retiredAt: stamp });
  else releases[i] = { ...releases[i], retiredAt: stamp };
}
releases.push(live ?? { short, commit: manifest.commit, at: stamp });
const age = (r) => Date.parse(r.retiredAt ?? r.at);
const kept = releases.filter((r, i) => i >= releases.length - keepMin || age(r) >= now - keepDays * DAY_MS || r.short === short || r.short === previous?.short);

// Apply it.
await mkdir(assets, { recursive: true });
// Open pages keep the asset root from their loaded manifest across gallery releases.
await rm(release, { recursive: true, force: true });
for (const g of games) {
  await mkdir(g.dir, { recursive: true });
  for (const file of BUNDLE_FILES) await writeFile(join(g.dir, file), g.bundle[file]);
  if (g.poster) await writeFile(join(g.dir, 'poster.png'), g.poster);
}
await writeFile(join(assets, 'SOURCE.json'), `${JSON.stringify(source, null, 2)}\n`);
await writeFile(page, `${JSON.stringify({ repository: manifest.repository, commit: manifest.commit, assetRoot: `/assets/game-lab/${short}`, games: manifest.games }, null, 2)}\n`);

// The origin catalog and sources: one directory per game with its files as they are, so changes review as diffs.
await rm(join(lab, 'origins'), { recursive: true, force: true });
const origins = [];
for (const { game, pack, origin } of games) {
  const files = {};
  await mkdir(origin, { recursive: true });
  for (const [path, content] of Object.entries(pack.files)) {
    await writeFile(join(origin, path), content);
    files[path] = sha256(content);
  }
  origins.push({ ...game, entry: pack.entry, files });
}
await writeFile(join(lab, 'catalog.json'), `${JSON.stringify({ repository: manifest.repository, commit: manifest.commit, origins }, null, 2)}\n`);

await writeFile(join(assets, 'releases.json'), `${JSON.stringify(kept, null, 2)}\n`);
const pruned = [];
for (const entry of await readdir(assets, { withFileTypes: true })) {
  if (!entry.isDirectory() || !RELEASE.test(entry.name) || kept.some((r) => r.short === entry.name)) continue;
  await rm(join(assets, entry.name), { recursive: true, force: true });
  pruned.push(entry.name);
}
console.log(`synced ${games.length} games at ${short} into ${platform} (web assets, page manifest, packages/game-lab)`);
if (reused.length) console.log(`reused ${reused.length} unchanged posters from ${before}: ${reused.join(', ')}`);
const unposted = games.filter((g) => !g.poster).map((g) => g.slug);
if (unposted.length) console.warn(`warning: published without a poster: ${unposted.join(', ')}`);
console.log(`releases kept: ${kept.map((r) => r.short).join(', ')}${pruned.length ? `; pruned: ${pruned.sort().join(', ')}` : ''}`);
