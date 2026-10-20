import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const CAPTURE_REPOSITORY = 'ghcr.io/crashwif/game-lab-capture';
export const RECIPE_LABEL = 'io.crashwif.game-lab.capture.recipe';

export async function recipeHash() {
  return createHash('sha256').update(await readFile(new URL('./capture.Dockerfile', import.meta.url))).digest('hex');
}

export function requirePinnedImage(reference) {
  if (typeof reference !== 'string' || !new RegExp(`^${CAPTURE_REPOSITORY.replaceAll('.', '\\.')}@sha256:[a-f0-9]{64}$`).test(reference)) {
    throw new Error(`GAME_LAB_CAPTURE_IMAGE must pin ${CAPTURE_REPOSITORY}@sha256:<64 lowercase hex digits>; build the capture image and configure its published digest`);
  }
  return reference;
}

export function verifyCaptureImage(reference, inspected, recipe, versions) {
  requirePinnedImage(reference);
  if (!inspected.RepoDigests?.includes(reference)) throw new Error('The installed capture image does not match the configured digest');
  if (inspected.Os !== 'linux' || inspected.Architecture !== 'amd64') throw new Error('The capture image must be Linux amd64');
  const labels = inspected.Config?.Labels ?? {};
  if (labels[RECIPE_LABEL] !== recipe) throw new Error('Capture image recipe differs from the committed Dockerfile; publish the current recipe and update GAME_LAB_CAPTURE_IMAGE');
  for (const name of ['node', 'playwright']) {
    if (labels[`io.crashwif.game-lab.capture.${name}`] !== versions[name]) throw new Error(`Capture image ${name} version differs from this source commit`);
  }
}

if (import.meta.main) console.log(await recipeHash());
