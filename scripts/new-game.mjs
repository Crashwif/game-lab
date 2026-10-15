import { lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const html = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const markdown = (text) => text.replace(/[\\|\[\]]/g, '\\$&');

/** Register a copy of the starter while preserving its shell, replay proof and lineage. */
export async function newGame(slug, name, { root = ROOT } = {}) {
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64) throw new Error('Choose a slug of lowercase letters, numbers and single hyphens, up to 64 characters.');
  name ??= slug.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
  if (typeof name !== 'string' || !name.trim() || name.length > 64 || /[\r\n\x00-\x1f]/.test(name)) throw new Error('Choose a game name of 1–64 characters on one line.');
  const destination = join(root, 'games', slug), template = join(root, 'games', 'hello-world');
  try { await lstat(destination); throw new Error(`games/${slug} already exists. Choose another slug.`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const catalogPath = join(root, 'scripts/games.mjs'), readmePath = join(root, 'README.md'), promptsPath = join(root, 'scripts/audio/prompts.json');
  const [catalog, readme, promptsText] = await Promise.all([catalogPath, readmePath, promptsPath].map((path) => readFile(path, 'utf8')));
  const match = /export const GAMES = \[([^\]]*)\];/.exec(catalog);
  if (!match || !/^\s*(?:'[a-z0-9-]+'\s*,\s*)*'[a-z0-9-]+'\s*$/.test(match[1])) throw new Error('The game catalog format is unsupported; register the game manually.');
  const games = [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
  if (games.includes(slug)) throw new Error(`${slug} is already registered.`);
  const lastRow = new RegExp(`^\\| \\[[^\\n]+\\]\\(games/${games.at(-1)}\\)[^\\n]*$`, 'm');
  if (!lastRow.test(readme)) throw new Error('The README game table must match the catalog before scaffolding.');
  const prompts = JSON.parse(promptsText);
  if (!prompts.games || prompts.games[slug]) throw new Error('The audio prompt catalog already contains this slug or is invalid.');
  const entries = await readdir(template, { withFileTypes: true });
  if ((await lstat(template)).isSymbolicLink() || entries.some((entry) => !entry.isFile() || entry.name.startsWith('.'))) throw new Error('The starter must contain regular source files only.');
  const files = new Map(await Promise.all(entries.map(async (entry) => [entry.name, await readFile(join(template, entry.name), 'utf8')])));
  const gallery = JSON.parse(files.get('gallery.json'));
  gallery.name = name; gallery.hook = 'A game built from the Hello World starter';
  gallery.tagline = `Explore ${name}, a creator game built on the shared Game Lab shell.`;
  files.set('gallery.json', JSON.stringify(gallery, null, 2) + '\n');
  const replay = JSON.parse(files.get('replay.json')); replay.gameId = slug;
  files.set('replay.json', JSON.stringify(replay, null, 2) + '\n');
  files.set('index.html', files.get('index.html').replaceAll('Hello World', html(name)).replaceAll('Hello, world!', html(name)));
  files.set('scene.ts', files.get('scene.ts').replace("const GREETING = 'Hello, world!';", `const GREETING = ${JSON.stringify(name)};`));
  files.set('README.md', `# ${name}\n\nA game created from the open Hello World starter. Customize scene.ts and the game styles; keep the shared shell and audio helpers in sync.\n\nRun \`npm run preview -- ${slug}\` from the clone root. The preview rebuilds on save; refresh your browser after a successful build. Run the build, typecheck, check and test commands before submitting.\n\nThe backend supplies committed outcomes. Credits have no monetary value. The copied replay keeps its original seed, hash and result. Recorded audio is optional; clips.json uses the starter's procedural sound configuration.\n\nSee [integration](../../docs/integration.md), [animation](../../docs/animation.md) and [contributing](../../CONTRIBUTING.md).\n`);
  prompts.games[slug] = { music: { prompt: `Compose an original 150-second instrumental game score for ${name}. Develop distinct sections with space for game sound effects. No voices, lyrics, sampled speech, crash sounds or victory ending.` } };
  const replacements = [
    [catalogPath, catalog, catalog.replace(match[0], `export const GAMES = [${[...games, slug].map((game) => `'${game}'`).join(', ')}];`)],
    [readmePath, readme, readme.replace(lastRow, (row) => `${row}\n| [${markdown(name)}](games/${slug}) | Creator game from the Hello World starter | Playable |`)],
    [promptsPath, promptsText, JSON.stringify(prompts, null, 2) + '\n'],
  ];
  await mkdir(destination);
  const written = [];
  try {
    for (const [file, content] of files) await writeFile(join(destination, file), content, { flag: 'wx' });
    for (const [path, before, after] of replacements) {
      if (await readFile(path, 'utf8') !== before) throw new Error('Registration files changed while scaffolding. Try again after saving those edits.');
      await writeFile(path, after); written.push([path, before]);
    }
  } catch (error) {
    const restored = await Promise.allSettled([...written.map(([path, before]) => writeFile(path, before)), rm(destination, { recursive: true, force: true })]);
    if (restored.some((result) => result.status === 'rejected')) throw new AggregateError([error, ...restored.filter((result) => result.status === 'rejected').map((result) => result.reason)], 'Scaffolding failed and could not restore every registration file. Review the Git diff.');
    throw error;
  }
  return { slug, name, directory: destination };
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: npm run new-game -- <slug> ["Game name"]\nCreates and registers an open game from Hello World. No AI calls or audio generation.');
    else {
      if (args.length < 1 || args.length > 2) throw new Error('Use npm run new-game -- <slug> ["Game name"].');
      const game = await newGame(args[0], args[1]);
      console.log(`Created games/${game.slug}.\nEdit scene.ts, then run npm run preview -- ${game.slug}.\nReview the Git diff and run the standard validation before submitting.`);
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
