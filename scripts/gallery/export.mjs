/**
 * Exports the Game Lab gallery from a finished build: for every game in
 * scripts/games.mjs, the three bundle files, a poster captured from its
 * recorded round, a source pack (the files a remix starts from), the page
 * manifest built from games/<slug>/gallery.json, and SOURCE.json with the
 * source commit and a SHA-256 per file. The bundles and posters land in a
 * directory named by the short commit, ready for the platform's
 * apps/web/public/assets/game-lab/; the source packs land in sources/ for
 * the platform's packages/game-lab.
 *
 *   node scripts/gallery/export.mjs --dist dist --out gallery-out [--commit <sha>] [--repository <url>] [--sources git|worktree] [--skip-posters]
 *
 * gallery.json and the source packs come from the commit's blobs (--sources
 * git, the default), so untracked files, uncommitted edits and symlinks never
 * reach a pack. --sources worktree reads plain files from the working tree
 * instead, for a copy without .git; there --commit names the full SHA the copy
 * came from. The bundles and posters always come from --dist.
 *
 * Posters need Playwright's Chromium: Playwright is a dev dependency, so after
 * `npm ci` run `npx playwright install chromium`. A game whose page throws or logs an
 * error while it plays, or whose poster is a single colour, fails the export
 * and is left without a poster. With --skip-posters, posters already in the
 * output for the same short commit are kept (they came from that commit's
 * replay and passed, unless --commit was reused over changed sources) and
 * missing ones are reported.
 */
import { createHash } from 'node:crypto';
import { createReadStream, realpathSync } from 'node:fs';
import { access, copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { GAMES } from '../games.mjs';
import { ROOT, SOURCE_ENTRY, readGallery, sourcePack } from './pack.mjs';

const BUNDLE_FILES = ['index.html', 'game.generated.js', 'style.css'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png' };

function args() {
  const out = { dist: 'dist', out: 'gallery-out', commit: '', repository: 'https://github.com/Crashwif/game-lab', sources: 'git', skipPosters: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--skip-posters') out.skipPosters = true;
    else if (a.startsWith('--')) out[a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i] ?? '';
  }
  if (out.sources !== 'git' && out.sources !== 'worktree') throw new Error('--sources is git or worktree');
  out.commit = resolveCommit(out.commit || 'HEAD', out.sources);
  return out;
}

/** The full SHA of `rev`, which must be a commit this checkout has (a shallow clone has only HEAD). */
function resolveCommit(rev, sources) {
  const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  // A copy without .git inside some other repository must not take that repository's commits.
  let top = '';
  try {
    top = realpathSync(git('rev-parse', '--show-toplevel'));
  } catch { /* no git, or not a repository */ }
  if (top !== realpathSync(ROOT)) {
    if (sources === 'worktree' && /^[0-9a-f]{40}$/.test(rev)) return rev;
    throw new Error(sources === 'git'
      ? `git cannot read ${ROOT} (git is missing or this is a copy without .git): pass --sources worktree --commit <the full SHA it came from>`
      : 'without git, --commit must be the full 40-character SHA the copy came from');
  }
  try {
    return git('rev-parse', '--verify', '--end-of-options', `${rev}^{commit}`);
  } catch {
    throw new Error(`--commit ${rev} is not a commit in this checkout (a shallow clone has only HEAD: fetch it first)`);
  }
}

const sha256 = (path) => new Promise((done, fail) => {
  const hash = createHash('sha256');
  createReadStream(path).on('data', (chunk) => hash.update(chunk)).on('end', () => done(hash.digest('hex'))).on('error', fail);
});
const sha256Text = (text) => createHash('sha256').update(text).digest('hex');

/** Serves a directory on an ephemeral port for the poster captures. */
function serve(root) {
  const server = createServer(async (req, res) => {
    const path = resolve(root, `.${decodeURIComponent((req.url ?? '/').split('?')[0])}`);
    if (!path.startsWith(resolve(root))) { res.writeHead(403); res.end(); return; }
    try {
      const body = await readFile(path);
      res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404); res.end();
    }
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done({ server, port: server.address().port })));
}

/** Counts the distinct colours of a PNG, in the page, so WebGL and 2D canvases are checked alike. */
async function countColours(base64) {
  const png = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([png], { type: 'image/png' }));
  const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
  context.drawImage(bitmap, 0, 0);
  return new Set(new Uint32Array(context.getImageData(0, 0, bitmap.width, bitmap.height).data.buffer)).size;
}

async function capturePosters(dist, out, short, games) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error('Playwright is not installed: run `npm ci` and `npx playwright install chromium`, or pass --skip-posters');
  }
  const { server, port } = await serve(dist);
  const browser = await chromium.launch();
  const failures = [];
  try {
    for (const game of games) {
      const page = await browser.newPage({ viewport: { width: 960, height: 660 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
      // Listen before loading: a bad replay throws while the deferred script runs, before the load event.
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
      let png;
      try {
        await page.goto(`http://127.0.0.1:${port}/${game.slug}/index.html?mode=replay`, { waitUntil: 'load' });
        const canvas = page.locator('canvas');
        await canvas.waitFor();
        await page.waitForTimeout(Math.round(game.poster.seconds * 1000));
        png = await canvas.screenshot({ type: 'png' });
        const colours = await page.evaluate(countColours, png.toString('base64'));
        if (colours < 2) errors.push('the poster is a single colour');
      } catch (error) {
        errors.push(error.message);
      } finally {
        await page.close();
      }
      // Errors can arrive until the page closes; only then is the poster known to pass, and written.
      if (errors.length) failures.push(`${game.slug}: ${errors.join('; ')}`);
      else {
        await writeFile(join(out, short, game.slug, 'poster.png'), png);
        console.log(`poster: ${game.slug} at ${game.poster.seconds}s`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures.length) throw new Error(`poster capture failed for ${failures.length} of ${games.length} games:\n  ${failures.join('\n  ')}`);
}

const options = args();
const short = options.commit.slice(0, 7);
const source = options.sources === 'git' ? { from: 'git', commit: options.commit } : { from: 'worktree' };
const games = [];
for (const slug of GAMES) {
  const meta = readGallery(slug, source);
  for (const file of BUNDLE_FILES) await access(join(options.dist, slug, file)).catch(() => { throw new Error(`${options.dist}/${slug}/${file} is missing: run npm run build first`); });
  games.push({ slug, ...meta, sources: sourcePack(slug, source).files });
}
// --skip-posters keeps the posters this short commit already has in the output.
const kept = new Map();
if (options.skipPosters) {
  for (const game of games) {
    const poster = await readFile(join(options.out, short, game.slug, 'poster.png')).catch((error) => { if (error.code === 'ENOENT') return null; throw error; });
    if (poster) kept.set(game.slug, poster);
  }
}
await rm(join(options.out, short), { recursive: true, force: true });
await rm(join(options.out, 'sources'), { recursive: true, force: true });
for (const game of games) {
  await mkdir(join(options.out, short, game.slug), { recursive: true });
  for (const file of BUNDLE_FILES) await copyFile(join(options.dist, game.slug, file), join(options.out, short, game.slug, file));
  if (kept.has(game.slug)) await writeFile(join(options.out, short, game.slug, 'poster.png'), kept.get(game.slug));
}
if (!options.skipPosters) await capturePosters(options.dist, options.out, short, games);
else if (kept.size) console.log(`kept ${kept.size} posters already exported for ${short}`);
const files = {};
for (const game of games) {
  for (const file of (await readdir(join(options.out, short, game.slug))).sort()) files[`${short}/${game.slug}/${file}`] = await sha256(join(options.out, short, game.slug, file));
  if (!files[`${short}/${game.slug}/poster.png`]) console.warn(`warning: no poster for ${game.slug}`);
}
await mkdir(join(options.out, 'sources'), { recursive: true });
for (const game of games) {
  const pack = { slug: game.slug, name: game.name, repository: options.repository, commit: options.commit, entry: SOURCE_ENTRY, licence: game.licence, royaltyBps: game.royaltyBps, files: game.sources };
  await writeFile(join(options.out, 'sources', `${game.slug}.json`), `${JSON.stringify(pack, null, 2)}\n`);
  for (const [path, content] of Object.entries(game.sources)) files[`sources/${game.slug}/${path}`] = sha256Text(content);
}
const entry = ({ slug, name, hook, tagline, tags, renderer, licence, royaltyBps }) => ({ slug, name, hook, tagline, tags, renderer, licence, royaltyBps });
const manifest = { repository: options.repository, commit: options.commit, assetRoot: `/assets/game-lab/${short}`, games: games.map(entry) };
await writeFile(join(options.out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const record = {
  repository: options.repository,
  commit: options.commit,
  build: 'npm ci && npm run build',
  posters: `Canvas captures from verified replay mode at 960 × 540, taken the number of seconds after page load given by games/<slug>/gallery.json: ${games.map((g) => `${g.name} at ${g.poster.seconds}`).join(', ')}.`,
  // The platform sync reuses a poster only while the game's bundle files and this moment are unchanged.
  posterSeconds: Object.fromEntries(games.map((g) => [g.slug, g.poster.seconds])),
  sources: `sources/<slug>.json holds each game's own .ts, .json, .html and .css files (except gallery.json), read from the commit, as the platform's remix flow starts from them; the SDK and crash maths come from the platform's own packages.`,
  files,
};
await writeFile(join(options.out, 'SOURCE.json'), `${JSON.stringify(record, null, 2)}\n`);
console.log(`exported ${games.length} games from ${options.commit} (${options.sources === 'git' ? 'sources from its blobs' : 'sources from the working tree'}) to ${options.out}/${short} (source packs in ${options.out}/sources)`);
