import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { CAPTURE_REPOSITORY, RECIPE_LABEL, requirePinnedImage, verifyCaptureImage } from './capture-image.mjs';
import { captureRuntime } from './capture-runtime.mjs';

const digest = '1'.repeat(64), recipe = '2'.repeat(64);
const reference = `${CAPTURE_REPOSITORY}@sha256:${digest}`;
const versions = { node: '24.21.0', playwright: '1.63.0' };
const inspected = () => ({ RepoDigests: [reference], Os: 'linux', Architecture: 'amd64', Config: { Labels: {
  [RECIPE_LABEL]: recipe, 'io.crashwif.game-lab.capture.node': versions.node, 'io.crashwif.game-lab.capture.playwright': versions.playwright,
} } });

test('capture images require an exact digest in the designated registry repository', () => {
  assert.equal(requirePinnedImage(reference), reference);
  for (const value of [undefined, '', `${CAPTURE_REPOSITORY}:latest`, `${reference}\n`, reference.replace('crashwif/', 'another-owner/'), reference.replace(digest, 'A'.repeat(64)), `${reference};echo bad`]) {
    assert.throws(() => requirePinnedImage(value), /must pin/);
  }
});

test('installed image digest, committed recipe, architecture and toolchain must all agree', () => {
  verifyCaptureImage(reference, inspected(), recipe, versions);
  const mutations = [
    image => { image.RepoDigests = [`${CAPTURE_REPOSITORY}@sha256:${'3'.repeat(64)}`]; },
    image => { image.Config.Labels[RECIPE_LABEL] = 'wrong recipe'; },
    image => { delete image.Config.Labels; },
    image => { image.Architecture = 'arm64'; },
    image => { image.Os = 'windows'; },
    image => { image.Config.Labels['io.crashwif.game-lab.capture.node'] = '24.19.0'; },
    image => { image.Config.Labels['io.crashwif.game-lab.capture.playwright'] = '1.62.0'; },
  ];
  for (const mutate of mutations) {
    const image = inspected(); mutate(image);
    assert.throws(() => verifyCaptureImage(reference, image, recipe, versions));
  }
});

test('preinstalled Playwright is available before npm ci only with a matching runtime receipt', async t => {
  const root = await mkdtemp(join(tmpdir(), 'game-lab-runtime-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const name of ['playwright', 'playwright-core']) {
    await mkdir(join(root, 'node_modules', name), { recursive: true });
    await writeFile(join(root, 'node_modules', name, 'package.json'), JSON.stringify({ name, version: versions.playwright, main: 'index.cjs' }));
  }
  await writeFile(join(root, 'node_modules/playwright/index.cjs'), 'exports.chromium = { fixture: true };');
  const receipt = { recipe, node: process.version, playwright: versions.playwright };
  const saveReceipt = value => writeFile(join(root, 'runtime.json'), JSON.stringify(value));
  await saveReceipt(receipt);
  const previous = { root: process.env.GAME_LAB_CAPTURE_PACKAGE_ROOT, recipe: process.env.GAME_LAB_EXPECTED_CAPTURE_RECIPE };
  process.env.GAME_LAB_CAPTURE_PACKAGE_ROOT = root;
  process.env.GAME_LAB_EXPECTED_CAPTURE_RECIPE = recipe;
  try {
    assert.deepEqual((await captureRuntime()).chromium, { fixture: true });
    delete process.env.GAME_LAB_EXPECTED_CAPTURE_RECIPE;
    await assert.rejects(captureRuntime(), /receipt does not match/);
    process.env.GAME_LAB_EXPECTED_CAPTURE_RECIPE = recipe;
    await saveReceipt({ ...receipt, recipe: 'wrong' });
    await assert.rejects(captureRuntime(), /receipt does not match/);
    for (const field of ['node', 'playwright']) {
      await saveReceipt({ ...receipt, [field]: 'wrong' });
      await assert.rejects(captureRuntime(), /versions do not match/);
    }
  } finally {
    for (const [key, value] of [['GAME_LAB_CAPTURE_PACKAGE_ROOT', previous.root], ['GAME_LAB_EXPECTED_CAPTURE_RECIPE', previous.recipe]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
