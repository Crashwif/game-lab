/** Run only trusted, committed export tooling in a verified immutable capture environment. */
import { execFileSync, spawn } from 'node:child_process';
import { appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { recipeHash, requirePinnedImage, verifyCaptureImage } from './capture-image.mjs';

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

export async function runCapture(args = process.argv.slice(2)) {
  const image = requirePinnedImage(process.env.GAME_LAB_CAPTURE_IMAGE);
  const recipe = await recipeHash();
  const root = resolve(process.cwd());
  const sourcePackage = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  // The workflow's toolchain also serves rollbacks to commits predating .nvmrc.
  const versions = { node: (await readFile(new URL('../../.nvmrc', import.meta.url), 'utf8')).trim(), playwright: sourcePackage.devDependencies?.playwright ?? '1.63.0' };
  let inspected;
  try { inspected = JSON.parse(execFileSync('docker', ['image', 'inspect', image], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))[0]; }
  catch { docker('pull', image); inspected = JSON.parse(docker('image', 'inspect', image))[0]; }
  verifyCaptureImage(image, inspected, recipe, versions);
  console.log(`capture runtime: ${image}; recipe ${recipe}`);
  if (args.length === 1 && args[0] === '--verify') return;
  const scratch = await mkdtemp(join(tmpdir(), 'game-lab-capture-runtime-'));
  try {
    const command = ['run', '--rm', '--init', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--user', `${process.getuid()}:${process.getgid()}`, '--pids-limit', '1024', '--shm-size', '1g',
      '--tmpfs', '/tmp:rw,nosuid,nodev,size=512m', '--env', 'HOME=/tmp', '--env', 'GIT_OPTIONAL_LOCKS=0',
      '--mount', `type=bind,src=${root},dst=/work`, '--mount', `type=bind,src=${scratch},dst=/actions`,
      '--env', `GAME_LAB_EXPECTED_CAPTURE_RECIPE=${recipe}`, '--env', 'GITHUB_OUTPUT=/actions/output', '--env', 'GITHUB_STEP_SUMMARY=/actions/summary',
      '--env', 'GAME_LAB_CAPTURE_MANIFEST=/actions/capture-environment.json',
      '--env', `GAME_LAB_CAPTURE_CONCURRENCY=${process.env.GAME_LAB_CAPTURE_CONCURRENCY ?? '2'}`];
    // A linked worktree's .git pointer must resolve inside the container too.
    // Only its shared Git metadata needs an additional, read-only mount.
    const common = resolve(root, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim());
    if (common !== root && !common.startsWith(`${root}${sep}`)) command.push('--mount', `type=bind,src=${common},dst=${common},readonly`);
    if (args.length === 1 && args[0] === '--smoke') command.push(image, 'node', 'scripts/gallery/capture-smoke.mjs');
    else command.push(image, 'node', 'scripts/gallery/export.mjs', ...args);
    const status = await new Promise((done, fail) => {
      const child = spawn('docker', command, { stdio: 'inherit' });
      child.once('error', fail); child.once('exit', (code, signal) => done({ code, signal }));
    });
    // Preserve diagnostics even for a failed export, but never publish partial action outputs.
    const manifest = await readFile(join(scratch, 'capture-environment.json')).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
    if (manifest && process.env.GAME_LAB_CAPTURE_MANIFEST) await writeFile(process.env.GAME_LAB_CAPTURE_MANIFEST, manifest);
    if (status.code !== 0) throw new Error(`capture container failed (${status.signal ?? status.code})`);
    for (const [name, target] of [['output', process.env.GITHUB_OUTPUT], ['summary', process.env.GITHUB_STEP_SUMMARY]]) {
      if (target) await appendFile(target, await readFile(join(scratch, name)).catch(error => { if (error.code !== 'ENOENT') throw error; return ''; }));
    }
  } finally { await rm(scratch, { recursive: true, force: true }); }
}

if (import.meta.main) await runCapture();
