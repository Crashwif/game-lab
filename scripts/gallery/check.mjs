/**
 * The Game Lab contract, checked on the working tree before anything ships (npm test runs it through
 * check.test.mjs, after npm run build):
 *
 *   - scripts/games.mjs lists every games/<slug>/ directory, once each;
 *   - every game's gallery.json passes readGallery and its source pack the platform's remix limits;
 *   - every game bundles with scripts/build.mjs's options, and its own files import only files of its
 *     source pack, named so the platform's remix bundler resolves them to the same file, and the
 *     platform's SDK and crash maths, as a remix must;
 *   - every replay.json names its game and passes the built SDK's verifyReplay;
 *   - README.md's reference table links the games in GAMES order.
 *
 *   node scripts/gallery/check.mjs    lists every problem and exits 1
 */
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, join, posix, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { bundleOptions } from '../build.mjs';
import { GAMES } from '../games.mjs';
import { ROOT, readGallery, sourcePack } from './pack.mjs';

// Copied from the platform's packages/unlock-api/src/build.ts (Crashwif/crashwif), which bundles remixes.
/** The packages a game's own files may import; a remix gets the platform's own copies. */
export const ALLOWED_PACKAGES = ['@crashwif/game-sdk', '@crashwif/crash-math'];
/** The largest bundled script a remix may publish. */
export const MAX_OUTPUT_BYTES = 1_500_000;
/** The source pack file a remix bundle resolves a relative import to, or null when it finds none. */
function resolveRelative(files, importer, spec) {
  const base = posix.normalize(posix.join(posix.dirname(importer), spec));
  if (base.startsWith('..')) return null;
  for (const candidate of [base, `${base}.ts`, base.replace(/\.js$/, '.ts'), posix.join(base, 'index.ts')]) if (files[candidate] !== undefined) return candidate;
  return null;
}

/** Where the allowed packages live here, which their workspace symlinks in node_modules resolve to. */
const PACKAGE_DIRS = ['packages/game-sdk', 'packages/crash-math'];
const README_ROW = /^\|\s*\[[^\]]*\]\(games\/([^)]*?)\/?\)/gm;
const LOCAL = /^\.\/[^/]+$/;

/** What is wrong with GAMES against the game directories: a slug listed twice or without a directory, or a directory not listed. */
export function listProblems(games, dirs) {
  const problems = [];
  const seen = new Set();
  for (const slug of games) {
    if (seen.has(slug)) problems.push(`scripts/games.mjs lists ${slug} twice`);
    else if (!dirs.includes(slug)) problems.push(`scripts/games.mjs lists ${slug}, but games/${slug}/ does not exist`);
    seen.add(slug);
  }
  for (const dir of dirs) if (!seen.has(dir)) problems.push(`games/${dir}/ is not listed in scripts/games.mjs`);
  return problems;
}

/** The games/<slug> links in README.md's reference table, in row order; concept rows link elsewhere. */
export const readmeGames = (readme) => [...readme.matchAll(README_ROW)].map((match) => match[1]);

/** Whether README.md's reference table links exactly `games`, in order: the first row that differs, if any. */
export function readmeProblems(readme, games) {
  const rows = readmeGames(readme);
  for (let i = 0; i < Math.max(rows.length, games.length); i++) {
    if (rows[i] !== games[i]) return [`README.md's reference table links ${rows[i] ? `games/${rows[i]}` : 'no game'} as game ${i + 1}, where scripts/games.mjs lists ${games[i] ?? 'no more games'}`];
  }
  return [];
}

/** What is wrong with a game's replay.json text: it must be a round whose gameId is the slug and which passes the SDK's verifyReplay. */
export function replayProblems(slug, json, verifyReplay) {
  const file = `games/${slug}/replay.json`;
  if (json === undefined) return [`${file} is missing`];
  let round;
  try {
    round = JSON.parse(json);
  } catch (error) {
    return [`${file}: ${error.message}`];
  }
  if (!round || typeof round !== 'object' || Array.isArray(round)) return [`${file} must be a JSON object`];
  const problems = round.gameId === slug ? [] : [`${file}: gameId is ${JSON.stringify(round.gameId)}, not ${JSON.stringify(slug)}`];
  try {
    const verdict = verifyReplay(round);
    if (!verdict.ok) problems.push(...verdict.problems.map((problem) => `${file}: ${problem}`));
  } catch (error) {
    problems.push(`${file} cannot be verified: ${error.message}`);
  }
  return problems;
}

/** Bundles a game in memory with scripts/build.mjs's options, reading from `root`; the result carries esbuild's metafile. */
export const bundle = (slug, root = ROOT) => build({ ...bundleOptions(slug), absWorkingDir: root, write: false, metafile: true, logLevel: 'silent' });

/**
 * What a game's bundle reads that its remix could not. The platform bundles a source pack with only the
 * game's flat files and its own SDK and crash maths, so each file directly in games/<slug>/ may import
 * only './<file>' beside it, or an allowed package that resolves into packages/game-sdk/ or
 * packages/crash-math/ here. What those packages import in turn is their own. With the game's source
 * pack `files`, a local import must also resolve, by the remix bundler's rules, to the pack file esbuild
 * picked here. `metafile` is esbuild's, with paths relative to `root`; workspace symlinks are resolved
 * to real paths.
 */
export function importProblems(slug, metafile, root = ROOT, files) {
  const real = (path) => {
    try {
      return realpathSync(resolve(root, path));
    } catch {
      return resolve(root, path);
    }
  };
  const base = real('.');
  const game = real(join('games', slug));
  const packages = PACKAGE_DIRS.map((dir) => real(dir) + sep);
  const problems = [];
  for (const [input, { imports }] of Object.entries(metafile.inputs)) {
    const file = real(input);
    if (dirname(file) !== game) continue;
    for (const { path, original = path } of imports) {
      const target = real(path);
      const local = LOCAL.test(original) && dirname(target) === game;
      const allowed = ALLOWED_PACKAGES.some((name) => original === name || original.startsWith(`${name}/`)) && packages.some((dir) => target.startsWith(dir));
      const what = `games/${slug}/${basename(file)} imports ${JSON.stringify(original)} (${relative(base, target)})`;
      if (!local && !allowed) problems.push(`${what}: a remix can import only files beside it and ${ALLOWED_PACKAGES.join(' and ')}`);
      if (!local || !files) continue;
      const resolved = resolveRelative(files, basename(file), original);
      if (resolved === null) problems.push(`${what}, which a remix cannot find in the source pack (the game's .ts, .json, .html and .css files other than gallery.json; an import without an extension means a .ts file)`);
      else if (resolved !== basename(target)) problems.push(`${what}, which a remix resolves to ${resolved} in the source pack`);
    }
  }
  return problems;
}

const buildFailure = (error) => (error.errors?.length ? error.errors.map((e) => (e.location ? `${e.location.file}:${e.location.line}: ${e.text}` : e.text)).join('; ') : error.message);

/**
 * Runs every check on the working tree and returns the problems, each naming its file; none means the
 * games are ready for the gallery. It needs npm run build first: the bundles and verifyReplay use the
 * packages' dist.
 */
export async function check() {
  const sdk = join(ROOT, 'packages/game-sdk/dist/index.js');
  if (!existsSync(sdk)) throw new Error('packages/game-sdk/dist/index.js is missing: run npm run build first');
  const { verifyReplay } = await import(pathToFileURL(sdk).href);
  const dirs = readdirSync(join(ROOT, 'games'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const problems = listProblems(GAMES, dirs);
  const attempt = (read) => {
    try {
      return read();
    } catch (error) {
      problems.push(error.message);
    }
  };
  for (const slug of new Set(GAMES)) {
    if (!dirs.includes(slug)) continue;
    attempt(() => readGallery(slug));
    const pack = attempt(() => sourcePack(slug));
    if (pack) problems.push(...replayProblems(slug, pack.files['replay.json'], verifyReplay));
    try {
      const { metafile, outputFiles } = await bundle(slug);
      problems.push(...importProblems(slug, metafile, ROOT, pack?.files));
      for (const { path, contents } of outputFiles) if (contents.length > MAX_OUTPUT_BYTES) problems.push(`games/${slug}: the bundled ${basename(path)} is ${contents.length} bytes, over the platform's ${MAX_OUTPUT_BYTES}`);
    } catch (error) {
      problems.push(`games/${slug} does not bundle: ${buildFailure(error)}`);
    }
  }
  problems.push(...readmeProblems(readFileSync(join(ROOT, 'README.md'), 'utf8'), GAMES));
  return problems;
}

if (import.meta.main) {
  const problems = await check().catch((error) => [error.message]);
  if (problems.length) {
    console.error(`The Game Lab contract checks failed:\n${problems.map((p) => `  ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`check: ${GAMES.length} games meet the Game Lab contract`);
}
