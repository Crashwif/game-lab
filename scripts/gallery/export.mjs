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
 *   node scripts/gallery/export.mjs --dist dist --out gallery-out [--commit <sha>] [--repository <url>] [--sources git|worktree] [--skip-posters] [--cache <directory>] [--plan]
 *
 * --cache builds only missing or changed games and reuses hash-checked bundles and
 * posters. It requires a clean checkout of --commit. --plan reports that work
 * before dependency and browser installation, without building or writing an export.
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
import { access, appendFile, copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { GAMES } from '../games.mjs';
import { ROOT, SOURCE_ENTRY, readGallery, sourcePack } from './pack.mjs';
import { BUNDLE_FILES, planGames, posterKey, saveGame, sharedInputs } from './cache.mjs';
import { capturePosters } from './capture.mjs';
import { captureIdentity } from './capture-environment.mjs';

function args() {
  const out = { dist: 'dist', out: 'gallery-out', commit: '', repository: 'https://github.com/Crashwif/game-lab', sources: 'git', skipPosters: false, cache: '', plan: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--skip-posters') out.skipPosters = true;
    else if (a === '--plan') out.plan = true;
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

function readGames(options) {
  const source = options.sources === 'git' ? { from: 'git', commit: options.commit } : { from: 'worktree' };
  return GAMES.map((slug) => ({ slug, ...readGallery(slug, source), sources: sourcePack(slug, source).files }));
}

async function buildMissing(slugs, dist) {
  const { buildGames } = await import('../build.mjs');
  await buildGames(slugs, { dist });
}

/** Every export includes the entire current catalog; only its expensive build and capture work is selective. */
export async function exportGallery(options, { games = readGames(options), sharedKey, captureKey, identify = captureIdentity, build = buildMissing, capture = capturePosters } = {}) {
  if (options.plan && !options.cache) throw new Error('--plan requires --cache');
  if (options.cache && (options.sources !== 'git' || options.skipPosters)) throw new Error('--cache requires --sources git and cannot skip posters');
  let captureFingerprint = captureKey ?? null;
  if (!captureFingerprint && options.cache && !options.skipPosters) {
    try { captureFingerprint = await identify(); }
    catch (error) {
      // Planning before installation remains conservative. An actual export must
      // always verify the installed renderer, even when every bundle is cached.
      if (!options.plan) throw error;
      console.log(`capture environment unavailable during plan: ${error.message}; poster reuse needs verification after setup`);
    }
  }
  const planned = options.cache ? await planGames(games, options.cache, sharedKey ?? sharedInputs(options.commit), captureFingerprint) : games;
  const builds = options.cache ? planned.filter((g) => !g.bundle) : [];
  let posters = options.skipPosters ? [] : planned.filter((g) => !g.cachedPoster);
  const summary = { build: builds.map((g) => g.slug), posters: posters.map((g) => g.slug), reused: planned.filter((g) => g.cachedPoster).map((g) => g.slug), total: games.length };
  if (options.cache) console.log(`gallery plan: build ${builds.length}, possible capture ${posters.length}, verified reuse ${summary.reused.length} of ${games.length} games`);
  if (options.plan) {
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `incremental=true\nbuild=${builds.length > 0}\nposters=${posters.length > 0}\n`);
    return summary;
  }
  if (builds.length) await build(summary.build, options.dist);
  for (const game of planned) {
    if (game.bundle) {
      await mkdir(join(options.dist, game.slug), { recursive: true });
      for (const file of BUNDLE_FILES) await writeFile(join(options.dist, game.slug, file), game.bundle[file]);
    }
    for (const file of BUNDLE_FILES) await access(join(options.dist, game.slug, file)).catch(() => { throw new Error(`${options.dist}/${game.slug}/${file} is missing: run npm run build first`); });
    if (options.cache) {
      const bundle = {};
      for (const file of BUNDLE_FILES) bundle[file] = await readFile(join(options.dist, game.slug, file));
      game.keys.poster = posterKey(game, bundle, captureFingerprint);
      game.cachedPoster = game.candidate?.key === game.keys.poster ? game.candidate.bytes : null;
    }
  }
  posters = options.skipPosters ? [] : planned.filter((g) => !g.cachedPoster);
  summary.posters = posters.map((g) => g.slug);
  summary.reused = planned.filter((g) => g.cachedPoster).map((g) => g.slug);
  const short = options.commit.slice(0, 7);
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
  for (const game of planned) {
    await mkdir(join(options.out, short, game.slug), { recursive: true });
    for (const file of BUNDLE_FILES) await copyFile(join(options.dist, game.slug, file), join(options.out, short, game.slug, file));
    if (kept.has(game.slug)) await writeFile(join(options.out, short, game.slug, 'poster.png'), kept.get(game.slug));
    else if (game.cachedPoster) await writeFile(join(options.out, short, game.slug, 'poster.png'), game.cachedPoster);
  }
  if (posters.length) await capture(options.dist, options.out, short, posters);
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
  const entry = ({ slug, name, hook, tagline, tags, hashtags, renderer, interactive, licence, royaltyBps }) => ({ slug, name, hook, tagline, tags, hashtags, renderer, interactive, licence, royaltyBps });
  const manifest = { repository: options.repository, commit: options.commit, assetRoot: `/assets/game-lab/${short}`, games: games.map(entry) };
  await writeFile(join(options.out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const record = {
    repository: options.repository,
    commit: options.commit,
    build: options.cache ? 'npm ci; build shared packages and changed games; reuse verified bundles and posters with identical inputs' : 'npm ci && npm run build',
    posters: `Canvas captures from verified replay mode at 960 × 540, taken the number of seconds after page load given by games/<slug>/gallery.json: ${games.map((g) => `${g.name} at ${g.poster.seconds}`).join(', ')}.`,
    // Sync requires matching rendered bytes, timing and capture provenance to reuse a poster.
    posterCapture: captureFingerprint,
    posterSeconds: Object.fromEntries(games.map((g) => [g.slug, g.poster.seconds])),
    sources: `sources/<slug>.json holds each game's own .ts, .json, .html and .css files (except gallery.json), read from the commit, as the platform's remix flow starts from them; the SDK and crash maths come from the platform's own packages.`,
    files,
  };
  await writeFile(join(options.out, 'SOURCE.json'), `${JSON.stringify(record, null, 2)}\n`);
  if (options.cache) {
    for (const game of planned) await saveGame(options.cache, game, join(options.out, short, game.slug));
  }
  console.log(`gallery result: built ${summary.build.length}, captured ${summary.posters.length}, reused ${summary.reused.length} of ${games.length} games`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `## Gallery export\n\n- Build: ${summary.build.join(', ') || 'none'}\n- Capture posters: ${summary.posters.join(', ') || 'none'}\n- Reuse verified posters: ${summary.reused.join(', ') || 'none'} (${summary.reused.length} of ${games.length})\n`);
  console.log(`exported ${games.length} games from ${options.commit} (${options.sources === 'git' ? 'sources from its blobs' : 'sources from the working tree'}) to ${options.out}/${short} (source packs in ${options.out}/sources)`);
  return summary;
}

if (import.meta.main) await exportGallery(args());
