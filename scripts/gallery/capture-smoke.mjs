/** Real browser/caching smoke check for a candidate capture image. Run after the shared package build. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, readGallery, sourcePack } from './pack.mjs';
import { exportGallery } from './export.mjs';

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const source = { from: 'git', commit };
const games = ['hello-world', 'seed-round'].map(slug => ({ slug, ...readGallery(slug, source), sources: sourcePack(slug, source).files }));
await mkdir(join(ROOT, 'gallery-out'), { recursive: true });
const root = await mkdtemp(join(ROOT, 'gallery-out/.runtime-smoke-'));
const options = { commit, repository: 'https://github.com/Crashwif/game-lab', sources: 'git', cache: join(root, 'cache'), dist: join(root, 'dist'), out: join(root, 'export'), skipPosters: false };
const started = performance.now();
const cold = await exportGallery(options, { games });
assert.deepEqual(cold.build, games.map(game => game.slug));
assert.deepEqual(cold.posters, cold.build);
const hashes = async () => Promise.all(games.map(async game => [game.slug, createHash('sha256').update(await readFile(join(options.out, commit.slice(0, 7), game.slug, 'poster.png'))).digest('hex')]));
const before = await hashes();
const plan = await exportGallery({ ...options, plan: true }, { games });
assert.deepEqual(plan.build, []); assert.deepEqual(plan.posters, []);
const warm = await exportGallery(options, { games });
assert.deepEqual(warm.build, []); assert.deepEqual(warm.posters, []);
assert.equal(warm.reused.length, games.length);
assert.deepEqual(await hashes(), before);
console.log(JSON.stringify({ smoke: 'passed', commit, seconds: (performance.now() - started) / 1000, artifacts: root, posterHashes: before, warmBuilds: 0, warmCaptures: 0 }));
