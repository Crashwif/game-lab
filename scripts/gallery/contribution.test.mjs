import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { CONTRIBUTION_FILES, changedSince, classify, markdown, outputs, upstreamPaths } from './contribution.mjs';
import { ROOT } from './pack.mjs';

const snapshots = ['packages/game-sdk/', 'packages/crash-math/', 'apps/emulator/'];
const options = { snapshots };

test('UPSTREAM.json names the snapshot paths', async () => {
  assert.deepEqual(upstreamPaths(), snapshots);
  assert.deepEqual(upstreamPaths('{"paths":["a/","b"]}'), ['a/', 'b/']);
  assert.throws(() => upstreamPaths('{"paths":"a"}'), /paths must be a list/);
});

test('a game contribution is its directory, the game list and the README', () => {
  const report = classify(['games/new-game/scene.ts', 'games/new-game/gallery.json', 'README.md', 'scripts/games.mjs', 'docs/concepts.md', '', ' games/new-game/scene.ts '], options);
  assert.deepEqual([...report.games], [['new-game', ['games/new-game/gallery.json', 'games/new-game/scene.ts']]]);
  assert.deepEqual(report.contribution, ['README.md', 'docs/concepts.md', 'scripts/games.mjs']);
  assert.deepEqual(report.platform, []);
  assert.deepEqual(report.problems, []);
  assert.ok(CONTRIBUTION_FILES.has('CONTRIBUTING.md'));
  assert.match(markdown(report), /merges and deploys on its own/);
  assert.equal(outputs(report), 'games=new-game\nplatform=false\nproblems=0\n');
});

test('everything outside the games is a platform file', () => {
  const report = classify(['scripts/shell/main.ts', '.github/workflows/ci.yml', 'package-lock.json', 'games/tsconfig.json', 'games/a/scene.ts'], options);
  assert.deepEqual(report.platform, ['.github/workflows/ci.yml', 'games/tsconfig.json', 'package-lock.json', 'scripts/shell/main.ts']);
  assert.deepEqual([...report.games.keys()], ['a']);
  assert.deepEqual(report.problems, []);
  assert.match(markdown(report), /merged by hand rather than on approval/);
  assert.equal(outputs(report), 'games=a\nplatform=true\nproblems=0\n');
});

test('a fork may not change platform files on approval alone', () => {
  assert.deepEqual(classify(['games/a/scene.ts'], { ...options, crossRepository: true }).problems, []);
  const [problem] = classify(['scripts/shell/main.ts', 'games/a/scene.ts'], { ...options, crossRepository: true }).problems;
  assert.match(problem, /^a pull request from a fork changes platform files \(scripts\/shell\/main\.ts\)/);
});

test('a snapshot changes only with UPSTREAM.json', () => {
  const [problem] = classify(['packages/game-sdk/src/index.ts', 'apps/emulator/src/server.ts'], options).problems;
  assert.match(problem, /^apps\/emulator\/src\/server\.ts, packages\/game-sdk\/src\/index\.ts: packages\/game-sdk, packages\/crash-math, apps\/emulator are snapshots/);
  assert.deepEqual(classify(['packages/game-sdk/src/index.ts', 'UPSTREAM.json'], options).problems, []);
  assert.match(markdown(classify(['packages/crash-math/src/index.ts'], options)), /### Problems\n\n- packages\/crash-math/);
});

test('a game keeps a flat directory under a valid slug', () => {
  const report = classify(['games/Bad_Slug/scene.ts', 'games/a/parts/arm.ts'], options);
  assert.deepEqual(report.platform, ['games/Bad_Slug/scene.ts']);
  assert.deepEqual([...report.games], [['a', ['games/a/parts/arm.ts']]]);
  assert.deepEqual(report.problems.map((p) => p.split(': ')[0]), ['games/Bad_Slug/scene.ts', 'games/a/parts/arm.ts']);
  assert.match(report.problems[0], /slug is lower-case letters/);
  assert.match(report.problems[1], /no subdirectories/);
});

test('changedSince lists the paths a branch changes since its merge base', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'contribution-'));
  try {
    const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
    git('init', '-q', '-b', 'main');
    await writeFile(join(dir, 'a'), '1');
    git('add', '.');
    git('commit', '-q', '-m', 'a');
    git('checkout', '-q', '-b', 'topic');
    await writeFile(join(dir, 'b'), '1');
    git('add', '.');
    git('commit', '-q', '-m', 'b');
    git('mv', 'a', 'c');
    git('commit', '-q', '-m', 'c');
    git('checkout', '-q', 'main');
    await writeFile(join(dir, 'd'), '1');
    git('add', '.');
    git('commit', '-q', '-m', 'd');
    git('checkout', '-q', 'topic');
    assert.deepEqual(changedSince('main', dir).filter(Boolean).sort(), ['a', 'b', 'c']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the command reports, writes the summary and the outputs, and exits 1 on a problem', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'contribution-'));
  try {
    const run = (paths) => {
      try {
        return { status: 0, stdout: execFileSync(process.execPath, [join(ROOT, 'scripts/gallery/contribution.mjs'), '--files', '-', '--summary', join(dir, 'summary.md'), '--output', join(dir, 'out.txt')], { input: paths.join('\n'), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }) };
      } catch (error) {
        return { status: error.status, stdout: error.stdout };
      }
    };
    const ok = run(['games/a/scene.ts', 'scripts/games.mjs']);
    assert.equal(ok.status, 0);
    assert.match(ok.stdout, /- Game `a`: 1 file\n/);
    assert.equal(await readFile(join(dir, 'summary.md'), 'utf8'), ok.stdout);
    assert.equal(await readFile(join(dir, 'out.txt'), 'utf8'), 'games=a\nplatform=false\nproblems=0\n');
    const bad = run(['packages/game-sdk/src/index.ts']);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /### Problems/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
