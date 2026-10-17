import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/** The immutable image supplies Playwright before the source checkout needs npm ci. */
export async function captureRuntime() {
  const root = process.env.GAME_LAB_CAPTURE_PACKAGE_ROOT;
  const require = root ? createRequire(join(root, 'package.json')) : createRequire(import.meta.url);
  if (root) {
    const receipt = JSON.parse(await readFile(join(root, 'runtime.json'), 'utf8'));
    if (!process.env.GAME_LAB_EXPECTED_CAPTURE_RECIPE || receipt.recipe !== process.env.GAME_LAB_EXPECTED_CAPTURE_RECIPE) {
      throw new Error('The capture runtime receipt does not match the verified image recipe');
    }
    if (receipt.node !== process.version || receipt.playwright !== require('playwright/package.json').version) {
      throw new Error('The capture runtime versions do not match its receipt');
    }
  }
  return { chromium: require('playwright').chromium, corePackage: require.resolve('playwright-core/package.json') };
}
