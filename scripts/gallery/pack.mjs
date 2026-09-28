/**
 * The Game Lab contract for one game, shared by the gallery export and the
 * checks that run before it: games/<slug>/gallery.json, checked, and the
 * game's source pack (the files a remix starts from), read either from a
 * commit's blobs or from the working tree and checked against the platform's
 * remix rules. Node built-ins only, so it runs before npm ci.
 */
import { execFileSync } from 'node:child_process';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root, which games/<slug>/ is read from. */
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

// Copied byte for byte from the platform's packages/game-lab/src/index.ts (Crashwif/crashwif), which checks the synced catalog with them.
/** A game's slug: its directory under games/ and its name on the platform. */
export const SLUG = /^[a-z0-9-]{1,64}$/;
/** A source file's path: a flat name in the game's own directory. */
export const SOURCE_PATH = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

// The remix bundler's limits, copied from the platform's packages/unlock-api/src/build.ts (checkSources).
export const SOURCE_EXTENSIONS = new Set(['.ts', '.json', '.html', '.css']);
export const MAX_SOURCE_FILES = 40;
export const MAX_SOURCE_FILE_BYTES = 256 * 1024;
export const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

/** The file a remix bundle starts from. */
export const SOURCE_ENTRY = 'main.ts';
export const LICENCES = new Set(['all-rights-reserved', 'derivatives-royalty', 'open']);
/** The latest poster moment, in seconds: the deploy captures every poster within its time limit. */
export const MAX_POSTER_SECONDS = 120;

/** What a source pack leaves out: the game's gallery entry and README (the extension filter drops the README too). */
const SOURCE_EXCLUDED = new Set(['gallery.json', 'README.md']);
const SCRIPT = /<script\b[^>]*\bsrc=["']\.\/game\.generated\.js["']/i;
const STYLESHEET = /<link\b[^>]*\bhref=["']\.\/style\.css["']/i;
const COMMIT = /^[0-9a-f]{40}$/;
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const text = (value) => typeof value === 'string' && value.trim() !== '';

function git(args, encoding = 'utf8', input = undefined) {
  try {
    return execFileSync('git', ['-C', ROOT, ...args], { encoding, input, maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    throw new Error(`git ${args.join(' ')} failed: ${String(error.stderr ?? '').trim() || error.message}`);
  }
}

/** The bytes of each blob by object name, read in one git call. */
function blobs(objects) {
  const out = git(['cat-file', '--batch'], 'buffer', Buffer.from(`${objects.join('\n')}\n`));
  const found = new Map();
  let at = 0;
  for (const object of objects) {
    const end = out.indexOf(10, at);
    const [name, type, size] = out.subarray(at, end).toString().split(' ');
    if (name !== object || type !== 'blob') throw new Error(`git cat-file: ${object} is not a blob`);
    found.set(object, out.subarray(end + 1, end + 1 + Number(size)));
    at = end + 1 + Number(size) + 1;
  }
  return found;
}

/** The entries directly in games/<slug>/, each with whether it is a plain file and a reader for its bytes. */
function entries(slug, source) {
  if (typeof slug !== 'string' || !SLUG.test(slug)) throw new Error(`${JSON.stringify(slug)} is not a game slug (${SLUG})`);
  const dir = `games/${slug}`;
  if (source?.from === 'git') {
    if (!COMMIT.test(source.commit ?? '')) throw new Error(`${dir}: reading from git needs the full commit SHA`);
    const listed = git(['ls-tree', '-z', '--full-tree', source.commit, '--', `${dir}/`]).split('\0').filter(Boolean).map((line) => {
      const tab = line.indexOf('\t');
      const [mode, type, object] = line.slice(0, tab).split(' ');
      // A pack keeps no file modes, so an executable file is as plain as any other.
      return { name: line.slice(tab + dir.length + 2), plain: (mode === '100644' || mode === '100755') && type === 'blob', kind: `a ${type} with mode ${mode}`, object };
    });
    if (listed.length === 0) throw new Error(`${dir} is not in ${source.commit}`);
    // The first read fetches every plain file in the directory at once.
    let batch;
    const plain = listed.filter((e) => e.plain).map((e) => e.object);
    return listed.map(({ object, ...entry }) => ({ ...entry, read: () => (batch ??= blobs(plain)).get(object) }));
  }
  if (source?.from === 'worktree') {
    const base = join(ROOT, dir);
    if (!lstatSync(base, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`${dir} is not a directory`);
    return readdirSync(base).map((name) => {
      const stat = lstatSync(join(base, name));
      return { name, plain: stat.isFile(), kind: stat.isSymbolicLink() ? 'a symlink' : 'not a regular file', read: () => readFileSync(join(base, name)) };
    });
  }
  throw new Error(`the source is { from: 'git', commit } or { from: 'worktree' }, not ${JSON.stringify(source)}`);
}

function decode(slug, entry) {
  if (!entry.plain) throw new Error(`games/${slug}/${entry.name} is ${entry.kind}: only plain files are read`);
  const bytes = entry.read();
  try {
    return utf8.decode(bytes);
  } catch {
    throw new Error(`games/${slug}/${entry.name} is not UTF-8 text`);
  }
}

/**
 * Checks a source pack against the platform's remix rules (checkSources in
 * packages/unlock-api/src/build.ts) and the shell's own: flat names with a
 * source extension, 1 byte to 256 KB a file, at most 40 files and 2 MB in
 * all, the entry, index.html and style.css present, and index.html loading
 * ./game.generated.js and ./style.css. Returns the pack's byte count.
 */
export function checkSources(files, entry = SOURCE_ENTRY) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('the files are an object of path to text');
  const paths = Object.keys(files);
  if (paths.length === 0 || paths.length > MAX_SOURCE_FILES) throw new Error(`a game has 1 to ${MAX_SOURCE_FILES} source files, not ${paths.length}`);
  let total = 0;
  for (const path of paths) {
    if (!SOURCE_PATH.test(path) || !SOURCE_EXTENSIONS.has(extname(path))) throw new Error(`${JSON.stringify(path)}: source files are .ts, .json, .html or .css in the game's directory`);
    if (typeof files[path] !== 'string') throw new Error(`${path}: text content is required`);
    const bytes = Buffer.byteLength(files[path], 'utf8');
    if (bytes === 0 || bytes > MAX_SOURCE_FILE_BYTES) throw new Error(`${path}: source files are 1 byte to 256 KB, not ${bytes} bytes`);
    total += bytes;
  }
  if (total > MAX_SOURCE_BYTES) throw new Error(`a game is at most 2 MB of source, not ${total} bytes`);
  if (typeof entry !== 'string' || !Object.hasOwn(files, entry)) throw new Error(`the entry ${JSON.stringify(entry)} is missing`);
  for (const name of ['index.html', 'style.css']) if (!Object.hasOwn(files, name)) throw new Error(`${name} is missing`);
  if (!SCRIPT.test(files['index.html'])) throw new Error('index.html must load ./game.generated.js');
  if (!STYLESHEET.test(files['index.html'])) throw new Error('index.html must load ./style.css');
  return total;
}

/**
 * games/<slug>/gallery.json, checked: the copy the gallery shows (name,
 * hook, tagline, renderer and three tags), the remix licence and royalty,
 * and poster.seconds. `source` is { from: 'git', commit } or
 * { from: 'worktree' } (the default), as for sourcePack.
 */
export function readGallery(slug, source = { from: 'worktree' }) {
  const file = `games/${slug}/gallery.json`;
  const entry = entries(slug, source).find((e) => e.name === 'gallery.json');
  if (!entry) throw new Error(`${file} is missing`);
  const json = decode(slug, entry);
  let meta;
  try {
    meta = JSON.parse(json);
  } catch (error) {
    throw new Error(`${file}: ${error.message}`);
  }
  const fail = (message) => { throw new Error(`${file}: ${message}`); };
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) fail('it must be a JSON object');
  for (const key of ['name', 'hook', 'tagline', 'renderer']) if (!text(meta[key])) fail(`"${key}" must be a non-empty string`);
  if (!Array.isArray(meta.tags) || meta.tags.length !== 3 || !meta.tags.every(text)) fail('"tags" must be exactly 3 non-empty strings');
  if (!LICENCES.has(meta.licence)) fail(`licence is one of ${[...LICENCES].join(', ')}`);
  const royaltyBps = meta.royaltyBps ?? 0;
  if (!Number.isInteger(royaltyBps) || royaltyBps < 0 || royaltyBps > 1000) fail('royaltyBps is 0 to 1000');
  if (meta.licence !== 'derivatives-royalty' && royaltyBps !== 0) fail('only a derivatives-royalty licence sets a royalty');
  const seconds = meta.poster?.seconds;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_POSTER_SECONDS) fail(`"poster.seconds" must be a number above 0 and at most ${MAX_POSTER_SECONDS}`);
  return { ...meta, royaltyBps };
}

/**
 * A game's source pack, the files a remix starts from, by path in sorted
 * order: its .ts, .json, .html and .css files other than gallery.json. With
 * { from: 'git', commit } they are the commit's regular-file blobs (mode
 * 100644 or 100755) directly in games/<slug>/, so untracked files and
 * uncommitted edits never reach a pack;
 * { from: 'worktree' } (the default, for a copy without .git) reads the
 * working tree's regular files. Either way a symlink, subdirectory or other
 * entry with a source extension is refused, and the pack must pass
 * checkSources.
 */
export function sourcePack(slug, source = { from: 'worktree' }) {
  const files = {};
  for (const entry of entries(slug, source).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!SOURCE_EXTENSIONS.has(extname(entry.name)) || SOURCE_EXCLUDED.has(entry.name)) continue;
    files[entry.name] = decode(slug, entry);
  }
  try {
    checkSources(files);
  } catch (error) {
    throw new Error(`games/${slug}: ${error.message}`);
  }
  return { files };
}
