/**
 * Generates recorded clips for the games with ElevenLabs and writes them into games/<slug>/clips.json as
 * data URLs, which audio.ts plays instead of its synthesised music loop, crash stinger, cash-out or named
 * effects. The prompts live in scripts/audio/prompts.json (see its "defaults" for the knobs).
 *
 *   ELEVENLABS_API_KEY=... node scripts/audio/generate.mjs                 every game, every clip
 *   node scripts/audio/generate.mjs --game balloon-pump --clip crash      one game, one clip
 *   node scripts/audio/generate.mjs --dry-run                             print the requests, call nothing
 *   node scripts/audio/generate.mjs --force                               regenerate clips already cached
 *
 * Raw audio is cached in scripts/audio/cache/<slug>/<clip>.<ext> (ignored by git), so a re-run only calls
 * the API for clips that are missing, changed in the manifest, or forced; clips.json is rewritten from the
 * cache every time. Sizes are checked against the platform's remix limits (256 KB a source file, 1.5 MB a
 * bundle): a clips.json over the budget fails the run rather than the deploy.
 *
 * Endpoints (check https://elevenlabs.io/docs/api-reference if a request is refused; both take the key in
 * the xi-api-key header and return the audio bytes):
 *   effects  POST /v1/sound-generation?output_format=…   { text, duration_seconds, prompt_influence, loop }
 *   music    POST /v1/music?output_format=…              { prompt, music_length_ms, force_instrumental }
 * A music clip whose "via" is "effects" (or whose music request is refused) is made with the sound effects
 * model and loop: true instead; the effects model makes short beds and loops too.
 *
 * Commercial use of generated audio needs a paid ElevenLabs plan; the free tier is non-commercial.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MANIFEST = `${ROOT}scripts/audio/prompts.json`;
const CACHE = `${ROOT}scripts/audio/cache/`;
const API = process.env.ELEVENLABS_API_URL ?? 'https://api.elevenlabs.io';
/** The platform's limit on a source file, and the budget this keeps clips.json under, leaving room for the bundle. */
const MAX_SOURCE_FILE_BYTES = 256 * 1024;
const BUDGET_BYTES = 200 * 1024;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const dryRun = flag('--dry-run');
const force = flag('--force');
const onlyGame = option('--game');
const onlyClip = option('--clip');
const key = process.env.ELEVENLABS_API_KEY;
if (!key && !dryRun) {
  console.error('ELEVENLABS_API_KEY is not set: store it in the environment (never in the repository), or pass --dry-run to see the requests.');
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const defaults = manifest.defaults ?? {};
const games = Object.entries(manifest.games ?? {}).filter(([slug]) => !onlyGame || slug === onlyGame);
if (games.length === 0) {
  console.error(onlyGame ? `${onlyGame} is not in ${MANIFEST}` : `${MANIFEST} lists no games`);
  process.exit(2);
}

/** The media type of an output format, for the data URL. */
const mediaType = (format) => (format.startsWith('mp3') ? 'audio/mpeg' : format.startsWith('opus') ? 'audio/ogg' : format.startsWith('pcm') ? 'audio/pcm' : 'application/octet-stream');
const extension = (format) => (format.startsWith('mp3') ? 'mp3' : format.startsWith('opus') ? 'ogg' : 'bin');

/** Every clip of a game as a flat list: music, crash, cashout and the named effects. */
function clipsOf(slug, game) {
  const list = [];
  const push = (name, spec, kind) => {
    if (!spec || (onlyClip && name !== onlyClip)) return;
    list.push({ slug, name, kind, spec });
  };
  push('music', game.music, 'music');
  push('crash', game.crash, 'effect');
  push('cashout', game.cashout, 'effect');
  for (const [name, spec] of Object.entries(game.effects ?? {})) push(name, spec, 'effect');
  return list;
}

/** The request for a clip: the URL, the body and the output format, with the manifest's defaults filled in. */
function requestFor(clip) {
  const { spec, kind } = clip;
  const isMusic = kind === 'music' && (spec.via ?? defaults.music?.via ?? 'music') === 'music';
  const format = spec.format ?? (kind === 'music' ? defaults.music?.format : defaults.effects?.format) ?? 'mp3_22050_32';
  if (isMusic) {
    const seconds = spec.seconds ?? defaults.music?.seconds ?? 12;
    return { url: `${API}/v1/music?output_format=${encodeURIComponent(format)}`, format, body: { prompt: spec.prompt, music_length_ms: Math.round(seconds * 1000), force_instrumental: spec.instrumental ?? true, ...spec.request }, fallback: kind === 'music' };
  }
  const seconds = spec.seconds ?? (kind === 'music' ? defaults.music?.seconds ?? 12 : defaults.effects?.seconds);
  const body = { text: spec.prompt, prompt_influence: spec.prompt_influence ?? defaults.effects?.prompt_influence ?? 0.4, ...spec.request };
  if (seconds !== undefined) body.duration_seconds = seconds;
  if (kind === 'music' || spec.loop) body.loop = true;
  return { url: `${API}/v1/sound-generation?output_format=${encodeURIComponent(format)}`, format, body, fallback: false };
}

/** A fingerprint of the request, so a changed prompt regenerates and an unchanged one reuses the cache. */
const fingerprint = (request) => createHash('sha256').update(JSON.stringify({ url: request.url, body: request.body })).digest('hex').slice(0, 16);

async function call(request) {
  const response = await fetch(request.url, { method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: '*/*' }, body: JSON.stringify(request.body) });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const error = new Error(`${response.status} ${response.statusText}${text ? `: ${text.slice(0, 300)}` : ''}`);
    error.status = response.status;
    throw error;
  }
  return Buffer.from(await response.arrayBuffer());
}

/** Fetches a clip's audio, from the cache when the request has not changed. */
async function produce(clip) {
  let request = requestFor(clip);
  const dir = `${CACHE}${clip.slug}/`;
  mkdirSync(dir, { recursive: true });
  const stamp = `${dir}${clip.name}.json`;
  const cached = existsSync(stamp) ? JSON.parse(readFileSync(stamp, 'utf8')) : null;
  const file = (format) => `${dir}${clip.name}.${extension(format)}`;
  if (!force && cached && cached.fingerprint === fingerprint(request) && existsSync(file(cached.format))) {
    return { bytes: readFileSync(file(cached.format)), format: cached.format, from: 'cache' };
  }
  if (dryRun) {
    console.log(`  ${clip.slug}/${clip.name}: POST ${request.url}\n    ${JSON.stringify(request.body)}`);
    return null;
  }
  let bytes;
  try {
    bytes = await call(request);
  } catch (error) {
    if (!request.fallback || !(error.status === 401 || error.status === 402 || error.status === 403 || error.status === 404 || error.status === 422)) throw error;
    console.warn(`  ${clip.slug}/${clip.name}: the music endpoint refused (${error.message}); making it with the sound effects model as a loop instead`);
    request = requestFor({ ...clip, spec: { ...clip.spec, via: 'effects' } });
    bytes = await call(request);
  }
  writeFileSync(file(request.format), bytes);
  writeFileSync(stamp, JSON.stringify({ fingerprint: fingerprint(request), format: request.format, bytes: bytes.length, prompt: request.body.text ?? request.body.prompt, at: new Date().toISOString() }, null, 2));
  return { bytes, format: request.format, from: 'api' };
}

let failed = false;
for (const [slug, game] of games) {
  const list = clipsOf(slug, game);
  if (list.length === 0) continue;
  console.log(`${slug}:`);
  const out = {};
  let total = 0;
  for (const clip of list) {
    try {
      const result = await produce(clip);
      if (!result) continue;
      const url = `data:${mediaType(result.format)};base64,${result.bytes.toString('base64')}`;
      out[clip.name] = url;
      total += url.length + clip.name.length + 8;
      console.log(`  ${clip.name}: ${(result.bytes.length / 1024).toFixed(1)} KB (${result.from})`);
    } catch (error) {
      failed = true;
      console.error(`  ${clip.name}: failed: ${error.message}`);
    }
  }
  if (dryRun) continue;
  if (Object.keys(out).length === 0) continue;
  if (total > BUDGET_BYTES) {
    failed = true;
    console.error(`  clips.json would be ${(total / 1024).toFixed(0)} KB, over the ${BUDGET_BYTES / 1024} KB budget (the platform's limit is ${MAX_SOURCE_FILE_BYTES / 1024} KB a file): shorten the loop or use a lower bit rate in the manifest`);
    continue;
  }
  const path = `${ROOT}games/${slug}/clips.json`;
  writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`  wrote games/${slug}/clips.json (${(total / 1024).toFixed(0)} KB)`);
}
if (dryRun) console.log('dry run: nothing was called or written');
if (failed) process.exit(1);
