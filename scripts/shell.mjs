/**
 * Keeps the shared page shell in step across the games. Every games/<slug>/main.ts is a copy of
 * scripts/shell/main.ts, every games/<slug>/style.css starts with scripts/shell/style.css (a game's own
 * tokens follow its closing marker line), and every index.html carries the elements the shell drives.
 * Remix source packs hold only a game's own directory, so the shell is copied into each game, not imported.
 *
 *   node scripts/shell.mjs          check (npm test and CI): lists every game that drifted and exits 1
 *   node scripts/shell.mjs --write  copies the canonical main.ts and style block into every game
 */
import { readFile as readRaw, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { GAMES } from './games.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MARKER = '/* game */\n';
/** What main.ts looks up in index.html; each must appear in every game's page. */
const REQUIRED = [
  ['the status line', /<p id="status" role="status">/],
  ['the readout', /<p id="readout">/],
  ['the notice', /<p id="notice" role="alert" hidden>/],
  ['Join round', /<button id="bet" aria-disabled="true" aria-keyshortcuts="Space">/],
  ['Cash out', /<button id="cashout" aria-disabled="true" aria-keyshortcuts="Space">/],
  ['the replay button', /<button id="restart" hidden>/],
  ['a labelled canvas', /<canvas aria-label="[^"]+">/],
  ['the stylesheet', /<link rel="stylesheet" href="\.\/style\.css">/],
  ['the bundle', /<script src="\.\/game\.generated\.js" defer><\/script>/],
];

/** Reads as LF: a Windows checkout with core.autocrlf has CRLF files, which match once normalised. */
const readFile = async (path) => (await readRaw(path, 'utf8')).replace(/\r\n/g, '\n');
const write = process.argv.includes('--write');
const main = await readFile(`${ROOT}scripts/shell/main.ts`);
const block = await readFile(`${ROOT}scripts/shell/style.css`);
if (!block.endsWith(MARKER)) throw new Error(`scripts/shell/style.css must end with the marker line ${MARKER.trim()}`);

const problems = [];
for (const slug of GAMES) {
  const dir = `${ROOT}games/${slug}`;
  const css = await readFile(`${dir}/style.css`);
  const at = css.indexOf(MARKER);
  if (write) {
    if (at < 0) throw new Error(`games/${slug}/style.css has no ${MARKER.trim()} marker: add the shell block by hand once`);
    await writeFile(`${dir}/main.ts`, main);
    await writeFile(`${dir}/style.css`, block + css.slice(at + MARKER.length));
    continue;
  }
  if ((await readFile(`${dir}/main.ts`)) !== main) problems.push(`games/${slug}/main.ts differs from scripts/shell/main.ts`);
  if (!css.startsWith(block)) problems.push(`games/${slug}/style.css does not start with the block in scripts/shell/style.css`);
  const html = await readFile(`${dir}/index.html`);
  for (const [name, pattern] of REQUIRED) if (!pattern.test(html)) problems.push(`games/${slug}/index.html lacks ${name} (${pattern.source})`);
}
if (write) console.log(`shell copied into ${GAMES.length} games`);
else if (problems.length) {
  console.error(`The game shells drifted (run npm run shell -- --write after editing scripts/shell/):\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
} else console.log(`shell: ${GAMES.length} games match scripts/shell/`);
