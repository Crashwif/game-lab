/** Capture the local scene-review server through gstack. Outputs never enter game bundles. */
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { GAMES } from '../games.mjs';
const browser = process.env.GSTACK_BROWSE || `${process.env.HOME}/.claude/skills/gstack/browse/dist/browse`;
const base = process.env.REVIEW_URL || 'http://127.0.0.1:4511';
const directory = resolve(process.argv[2] || '.gstack/qa-reports/long-round/final');
await mkdir(directory, { recursive: true });
const browse = (...args) => execFileSync(browser, args, { encoding: 'utf8', timeout: 60_000 });
const results = [];
for (const game of GAMES) {
  try {
    browse('console', '--clear');
    for (const seconds of [30, 150, 180]) {
      if (process.env.REVIEW_RESUME && existsSync(`${directory}/${game}-${seconds}.png`)) continue;
      browse('goto', `${base}/${game}/index.html?seconds=${seconds}&late=1`);
      browse('screenshot', `${directory}/${game}-${seconds}.png`);
    }
    browse('goto', `${base}/${game}/index.html?seconds=150&late=1`);
    if (!(process.env.REVIEW_RESUME && ['mobile','tablet','desktop'].every(size => existsSync(`${directory}/${game}-${size}.png`)))) browse('responsive', `${directory}/${game}`);
    for (const state of ['cashout', 'crash', 'reduced']) {
      if (process.env.REVIEW_RESUME && existsSync(`${directory}/${game}-${state}.png`)) continue;
      browse('goto', `${base}/${game}/index.html?seconds=150&late=1&${state}=1`);
      browse('screenshot', `${directory}/${game}-${state}.png`);
    }
    const consoleErrors = browse('console', '--errors');
    const failures = consoleErrors.split('\n').filter(line => /\[(error|pageerror)\]/i.test(line));
    if (failures.length) throw new Error(failures.join('\n'));
    results.push({ game, passed: true, consoleErrors: [] });
    console.log(`${game}: screenshots and console passed`);
  } catch (error) {
    results.push({ game, passed: false, error: error.message });
    console.error(`${game}: ${error.message}`);
  }
  await writeFile(`${directory}/results.json`, `${JSON.stringify(results, null, 2)}\n`);
}
if (results.some(result => !result.passed)) process.exitCode = 1;
