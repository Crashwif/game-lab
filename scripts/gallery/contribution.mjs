/**
 * What a pull request changes, by the repository's boundaries, so CI can tell its author and its reviewer
 * what a contribution touches and the Merge approved games workflow can decide whether a maintainer's
 * approval merges it on its own. Node built-ins only, so it runs before npm ci and from a sparse checkout.
 *
 *   - game files: games/<slug>/..., grouped by slug;
 *   - contribution files: the files adding a game also edits, scripts/games.mjs, README.md,
 *     CONTRIBUTING.md and docs/;
 *   - platform files: everything else (the shell, the build, the checks, the workflows, the packages,
 *     the lockfile). A pull request from a fork that changes them waits for a maintainer to merge it by
 *     hand, with --cross-repository a problem.
 *
 * Problems, which exit 1: a change under a path UPSTREAM.json snapshots (the SDK, the crash maths and the
 * emulator) without a change to UPSTREAM.json, since those packages are synchronised from the platform.
 *
 *   node scripts/gallery/contribution.mjs --base <ref>         the paths HEAD changes since its merge base with ref
 *   node scripts/gallery/contribution.mjs --files <file>       the changed paths, one per line (- for stdin)
 *     --cross-repository      the pull request comes from a fork: platform changes are a problem
 *     --summary <file>        append the Markdown report (GITHUB_STEP_SUMMARY)
 *     --output <file>         append games=<slugs> platform=<true|false> problems=<count> (GITHUB_OUTPUT)
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SLUG } from './pack.mjs';

/** The files, beside a game's own directory, that adding or renaming a game edits. */
export const CONTRIBUTION_FILES = new Set(['scripts/games.mjs', 'README.md', 'CONTRIBUTING.md']);
/** The directories whose files count with CONTRIBUTION_FILES. */
const CONTRIBUTION_DIRS = ['docs/'];
const UPSTREAM = 'UPSTREAM.json';

/** The paths UPSTREAM.json snapshots from the platform, each with a trailing slash. */
export function upstreamPaths(json = readFileSync(join(ROOT, UPSTREAM), 'utf8')) {
  const { paths } = JSON.parse(json);
  if (!Array.isArray(paths) || !paths.every((p) => typeof p === 'string' && p !== '')) throw new Error(`${UPSTREAM}: paths must be a list of paths`);
  return paths.map((p) => `${p.replace(/\/+$/, '')}/`);
}

/**
 * The changed paths sorted into games (slug to its files), contribution files, platform files and
 * problems. `snapshots` is upstreamPaths(); `crossRepository` adds a problem for platform changes.
 */
export function classify(paths, { snapshots, crossRepository = false }) {
  const games = new Map();
  const contribution = [];
  const platform = [];
  const problems = [];
  const unique = [...new Set(paths.map((p) => p.trim()).filter(Boolean))].sort();
  for (const path of unique) {
    const game = /^games\/([^/]+)\/(.+)$/.exec(path);
    if (game && SLUG.test(game[1])) {
      if (!games.has(game[1])) games.set(game[1], []);
      games.get(game[1]).push(path);
      if (game[2].includes('/')) problems.push(`${path}: a game's files sit directly in games/${game[1]}/, with no subdirectories (the platform's remix bundler reads a flat source pack)`);
    } else if (game) {
      platform.push(path);
      problems.push(`${path}: a game's slug is lower-case letters, digits and hyphens, up to 64 characters`);
    } else if (CONTRIBUTION_FILES.has(path) || CONTRIBUTION_DIRS.some((dir) => path.startsWith(dir))) contribution.push(path);
    else platform.push(path);
  }
  const snapshot = platform.filter((path) => snapshots.some((dir) => path.startsWith(dir)));
  if (snapshot.length > 0 && !platform.includes(UPSTREAM)) problems.push(`${snapshot.join(', ')}: ${snapshots.map((d) => d.slice(0, -1)).join(', ')} are snapshots of the platform (${UPSTREAM}), synchronised from there; a change to them records the platform commit in ${UPSTREAM}`);
  if (crossRepository && platform.length > 0) problems.push(`a pull request from a fork changes platform files (${platform.join(', ')}): a maintainer reviews those as the platform's own code and merges by hand`);
  return { games, contribution, platform, problems };
}

const code = (s) => `\`${s}\``;

/** The report as Markdown, for a job summary. */
export function markdown({ games, contribution, platform, problems }) {
  const lines = ['## What this pull request changes', ''];
  if (games.size === 0) lines.push('- Games: none');
  else for (const [slug, files] of games) lines.push(`- Game ${code(slug)}: ${files.length} file${files.length === 1 ? '' : 's'}`);
  lines.push(`- Game list, README, contributing guide and docs: ${contribution.length > 0 ? contribution.map(code).join(', ') : 'none'}`);
  lines.push(`- Platform files: ${platform.length > 0 ? platform.map(code).join(', ') : 'none'}`);
  if (platform.length > 0) lines.push('', 'Platform files are the shell, the build, the checks, the workflows and the packages. A maintainer reviews them as the platform\'s own code, and a pull request from a fork that changes them is merged by hand rather than on approval.');
  if (problems.length > 0) lines.push('', '### Problems', '', ...problems.map((p) => `- ${p}`));
  else lines.push('', games.size > 0 && platform.length === 0 ? 'A game contribution: once CI passes and a maintainer approves it, it merges and deploys on its own.' : 'No contract problems with the changed paths.');
  return `${lines.join('\n')}\n`;
}

/** The report as GITHUB_OUTPUT lines. */
export function outputs({ games, platform, problems }) {
  return `games=${[...games.keys()].join(',')}\nplatform=${platform.length > 0}\nproblems=${problems.length}\n`;
}

/** The paths HEAD changes since its merge base with `base`, renames as a deletion and an addition. */
export function changedSince(base, root = ROOT) {
  return execFileSync('git', ['-C', root, 'diff', '--name-only', '--no-renames', `${base}...HEAD`], { encoding: 'utf8' }).split('\n');
}

function parseArgs(argv) {
  const out = { crossRepository: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--cross-repository') out.crossRepository = true;
    else if (['--base', '--files', '--summary', '--output'].includes(arg)) out[arg.slice(2)] = argv[++i];
    else throw new Error(`unknown argument ${arg}`);
  }
  if ((out.base === undefined) === (out.files === undefined)) throw new Error('pass --base <ref> or --files <file>');
  return out;
}

if (import.meta.main) {
  const args = parseArgs(process.argv.slice(2));
  const paths = args.base !== undefined ? changedSince(args.base) : readFileSync(args.files === '-' ? 0 : args.files, 'utf8').split('\n');
  const report = classify(paths, { snapshots: upstreamPaths(), crossRepository: args.crossRepository });
  const text = markdown(report);
  process.stdout.write(text);
  if (args.summary) appendFileSync(args.summary, text);
  if (args.output) appendFileSync(args.output, outputs(report));
  process.exitCode = report.problems.length > 0 ? 1 : 0;
}
