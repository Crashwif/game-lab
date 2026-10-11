/** Capture identity follows the renderer, fonts and loaded libraries, independent of runner orchestration. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const command = (name, args) => execFileSync(name, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const hashFile = async (path) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
};
export async function filesUnder(path, ancestors = new Set()) {
  const resolved = await realpath(path);
  const kind = await stat(resolved);
  if (kind.isFile()) return [path];
  if (!kind.isDirectory()) throw new Error(`capture input is not a file or directory: ${path}`);
  if (ancestors.has(resolved)) return [];
  const parents = new Set([...ancestors, resolved]);
  const files = [];
  // Keep logical paths: fontconfig link names and ordering select the effective configuration.
  for (const name of (await readdir(path)).sort()) files.push(...await filesUnder(join(path, name), parents));
  return files;
}

/** File identities are ordered canonically; absent inputs fail rather than sharing an incomplete key. */
export async function fingerprintFiles(files, metadata) {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(metadata));
  for (const [name, path] of [...files].sort(([a], [b]) => a.localeCompare(b))) hash.update(JSON.stringify([name, await hashFile(path)]));
  return hash.digest('hex');
}

export async function captureIdentity() {
  if (process.platform !== 'linux') throw new Error('verified poster caching requires the Linux capture environment');
  const { chromium } = await import('playwright');
  let browserRoot = dirname(chromium.executablePath());
  while (!/^chromium-\d+$/.test(basename(browserRoot))) {
    const parent = dirname(browserRoot);
    if (parent === browserRoot) throw new Error('cannot identify the installed Chromium directory');
    browserRoot = parent;
  }
  const browserManifest = JSON.parse(await readFile(new URL('browsers.json', import.meta.resolve('playwright-core/package.json')), 'utf8'));
  const shell = browserManifest.browsers.find((browser) => browser.name === 'chromium-headless-shell');
  if (!shell) throw new Error('Chromium headless shell is missing from the browser manifest');
  const browserFiles = [...await filesUnder(browserRoot), ...await filesUnder(join(dirname(browserRoot), `chromium_headless_shell-${shell.revision}`))];
  if (!browserFiles.includes(chromium.executablePath()) || !browserFiles.some((file) => /\/(?:headless_shell|chrome-headless-shell)$/.test(file))) {
    throw new Error('capture requires both installed Chromium browser variants');
  }
  const libraries = new Set();
  for (const file of browserFiles.filter((path) => /(?:\/chrome|\/headless_shell|\/chrome-headless-shell|\.so(?:\.\d+)*)$/.test(path))) {
    const output = command('ldd', [file]);
    if (/not found/.test(output)) throw new Error(`missing Chromium library for ${file}`);
    for (const match of output.matchAll(/(?:=>\s*)?(\/[^\s]+)\s+\(/g)) libraries.add(await realpath(match[1]));
  }
  const fonts = command('fc-list', ['--format', '%{file}\n']).trim().split('\n').filter(Boolean);
  if (!fonts.length) throw new Error('no fonts available for poster capture');
  const inputs = [...new Set([...browserFiles, ...libraries, ...fonts, ...await filesUnder('/etc/fonts')])].sort();
  // Browser paths contain the revision, while the runner's home path is immaterial.
  const files = inputs.map((file) => [file.startsWith(dirname(browserRoot)) ? file.slice(dirname(browserRoot).length) : file, file]);
  for (const path of ['./capture.mjs', './capture-environment.mjs']) files.push([path, fileURLToPath(new URL(path, import.meta.url))]);
  files.push(['playwright-core/package.json', fileURLToPath(import.meta.resolve('playwright-core/package.json'))]);
  return fingerprintFiles(files, { platform: process.platform, arch: process.arch,
    fontMatch: command('fc-match', ['--sort', '--format', '%{family}|%{style}|%{file}\n']) });
}
