/**
 * Exports the Game Lab gallery from a finished build: for every game in
 * scripts/games.mjs, the three bundle files, a poster captured from its
 * recorded round, the page manifest built from games/<slug>/gallery.json, and
 * SOURCE.json with the source commit and a SHA-256 per file. Everything lands
 * in a directory named by the short commit, ready for the platform's
 * apps/web/public/assets/game-lab/.
 *
 *   node scripts/gallery/export.mjs --dist dist --out gallery-out [--commit <sha>] [--repository <url>] [--skip-posters]
 *
 * Posters need Playwright's Chromium: `npm install --no-save playwright` and
 * `npx playwright install chromium`. With --skip-posters, existing posters in
 * the output are kept and missing ones are reported.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { GAMES } from '../games.mjs';

const BUNDLE_FILES = ['index.html', 'game.generated.js', 'style.css'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png' };

function args() {
  const out = { dist: 'dist', out: 'gallery-out', commit: '', repository: 'https://github.com/Crashwif/game-lab', skipPosters: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--skip-posters') out.skipPosters = true;
    else if (a.startsWith('--')) out[a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i] ?? '';
  }
  if (!out.commit) out.commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  return out;
}

const sha256 = (path) => new Promise((done, fail) => {
  const hash = createHash('sha256');
  createReadStream(path).on('data', (chunk) => hash.update(chunk)).on('end', () => done(hash.digest('hex'))).on('error', fail);
});

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

async function capturePosters(dist, out, short, games) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error('Playwright is not installed: run `npm install --no-save playwright` and `npx playwright install chromium`, or pass --skip-posters');
  }
  const { server, port } = await serve(dist);
  const browser = await chromium.launch();
  try {
    for (const game of games) {
      const page = await browser.newPage({ viewport: { width: 960, height: 660 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
      await page.goto(`http://127.0.0.1:${port}/${game.slug}/index.html?mode=replay`, { waitUntil: 'load' });
      const canvas = page.locator('canvas');
      await canvas.waitFor();
      await page.waitForTimeout(Math.round(game.poster.seconds * 1000));
      await canvas.screenshot({ path: join(out, short, game.slug, 'poster.png'), type: 'png' });
      await page.close();
      console.log(`poster: ${game.slug} at ${game.poster.seconds}s`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

const options = args();
const short = options.commit.slice(0, 7);
const games = [];
for (const slug of GAMES) {
  const meta = JSON.parse(await readFile(`games/${slug}/gallery.json`, 'utf8'));
  for (const key of ['name', 'hook', 'tagline', 'tags', 'renderer', 'poster']) if (meta[key] === undefined) throw new Error(`games/${slug}/gallery.json lacks "${key}"`);
  for (const file of BUNDLE_FILES) await access(join(options.dist, slug, file)).catch(() => { throw new Error(`${options.dist}/${slug}/${file} is missing: run npm run build first`); });
  games.push({ slug, ...meta });
}
await rm(join(options.out, short), { recursive: true, force: true });
for (const game of games) {
  await mkdir(join(options.out, short, game.slug), { recursive: true });
  for (const file of BUNDLE_FILES) await copyFile(join(options.dist, game.slug, file), join(options.out, short, game.slug, file));
}
if (!options.skipPosters) await capturePosters(options.dist, options.out, short, games);
const files = {};
for (const game of games) {
  for (const file of (await readdir(join(options.out, short, game.slug))).sort()) files[`${short}/${game.slug}/${file}`] = await sha256(join(options.out, short, game.slug, file));
  if (!files[`${short}/${game.slug}/poster.png`]) console.warn(`warning: no poster for ${game.slug}`);
}
const manifest = {
  repository: options.repository,
  commit: options.commit,
  assetRoot: `/assets/game-lab/${short}`,
  games: games.map(({ slug, name, hook, tagline, tags, renderer }) => ({ slug, name, hook, tagline, tags, renderer })),
};
await writeFile(join(options.out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const source = {
  repository: options.repository,
  commit: options.commit,
  build: 'npm ci && npm run build',
  posters: `Canvas captures from verified replay mode at 960 × 540, taken the number of seconds after page load given by games/<slug>/gallery.json: ${games.map((g) => `${g.name} at ${g.poster.seconds}`).join(', ')}.`,
  files,
};
await writeFile(join(options.out, 'SOURCE.json'), `${JSON.stringify(source, null, 2)}\n`);
console.log(`exported ${games.length} games from ${options.commit} to ${options.out}/${short}`);
