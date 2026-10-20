/**
 * Generate ElevenLabs music and effects, preserving masters in scripts/audio/cache/<game>/.
 * Every catalog song is authored for 150 seconds by /v1/music. Music errors never fall back to SFX.
 * Runtime music is compact mono Opus so the complete soundtrack and existing effects fit clips.json.
 *
 * ELEVENLABS_API_KEY=... npm run audio -- --clip music
 * npm run audio -- --game balloon-pump --clip music --dry-run
 * npm run audio -- --game balloon-pump --clip music --force
 * FFMPEG_PATH=/path/to/ffmpeg npm run audio -- --clip music --cached-only
 *
 * Keys come only from the environment. Cached-only rebuilds need no key and make no API calls.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extension, mediaType, packMusic, serializeClips } from './pack.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export function requestFor(clip, defaults = {}, api = 'https://api.elevenlabs.io') {
  const { spec, kind } = clip;
  const format = spec.format ?? (kind === 'music' ? defaults.music?.format : defaults.effects?.format) ?? 'mp3_22050_32';
  if (kind === 'music') {
    if ((spec.via ?? defaults.music?.via ?? 'music') !== 'music') throw new Error('Music must use ElevenLabs Music; sound effects are not a full-length soundtrack.');
    const seconds = spec.seconds ?? defaults.music?.seconds ?? 150;
    return { url: `${api}/v1/music?output_format=${encodeURIComponent(format)}`, format, body: { ...spec.request, prompt: spec.prompt, music_length_ms: Math.round(seconds * 1000), force_instrumental: spec.instrumental ?? true } };
  }
  const seconds = spec.seconds ?? defaults.effects?.seconds;
  const body = { ...spec.request, text: spec.prompt, prompt_influence: spec.prompt_influence ?? defaults.effects?.prompt_influence ?? 0.4 };
  if (seconds !== undefined) body.duration_seconds = seconds;
  if (spec.loop) body.loop = true;
  return { url: `${api}/v1/sound-generation?output_format=${encodeURIComponent(format)}`, format, body };
}

export const fingerprint = (request) => createHash('sha256').update(JSON.stringify({ url: request.url, body: request.body })).digest('hex').slice(0, 16);

export async function main(args = process.argv.slice(2)) {
  const supported = new Set(['--game', '--clip', '--dry-run', '--cached-only', '--force']);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!supported.has(arg)) throw new Error(`Unknown option: ${arg}`);
    if (arg === '--game' || arg === '--clip') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${arg} requires a value`);
      i++;
    }
  }
  const flag = (name) => args.includes(name);
  const option = (name) => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : undefined; };
  const dryRun = flag('--dry-run');
  const cachedOnly = flag('--cached-only');
  const force = flag('--force');
  if (cachedOnly && force) throw new Error('--cached-only and --force cannot be used together');
  const onlyGame = option('--game');
  const onlyClip = option('--clip');
  const key = process.env.ELEVENLABS_API_KEY;
  const manifest = JSON.parse(readFileSync(`${ROOT}scripts/audio/prompts.json`, 'utf8'));
  const defaults = manifest.defaults ?? {};
  const games = Object.entries(manifest.games ?? {}).filter(([slug]) => !onlyGame || slug === onlyGame);
  if (!games.length) throw new Error(`${onlyGame ?? 'No games'} found in scripts/audio/prompts.json`);
  let failed = false;
  let selected = 0;
  for (const [slug, game] of games) {
    const list = [{ name: 'music', kind: 'music', spec: game.music }, { name: 'crash', kind: 'effect', spec: game.crash }, { name: 'cashout', kind: 'effect', spec: game.cashout }, ...Object.entries(game.effects ?? {}).map(([name, spec]) => ({ name, kind: 'effect', spec }))].filter(({ name, spec }) => spec && (!onlyClip || name === onlyClip));
    if (!list.length) continue;
    selected += list.length;
    console.log(`${slug}:`);
    const path = `${ROOT}games/${slug}/clips.json`;
    // A selected-clip regeneration must not erase the game's other recorded effects.
    const out = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
    let gameFailed = false;
    let blocked = false;
    for (const clip of list) {
      try {
        const request = requestFor(clip, defaults, process.env.ELEVENLABS_API_URL ?? 'https://api.elevenlabs.io');
        const dir = `${ROOT}scripts/audio/cache/${slug}/`;
        const stampPath = `${dir}${clip.name}.json`;
        const stamp = existsSync(stampPath) ? JSON.parse(readFileSync(stampPath, 'utf8')) : null;
        const file = `${dir}${clip.name}.${extension(request.format)}`;
        const cacheHit = !force && stamp?.fingerprint === fingerprint(request) && existsSync(file);
        if (dryRun) {
          console.log(`  ${clip.name}: ${cacheHit ? 'cached' : 'POST'} ${request.url}\n    ${JSON.stringify(request.body)}`);
          continue;
        }
        let bytes;
        if (cacheHit) bytes = readFileSync(file);
        else {
          if (cachedOnly) throw new Error('No matching cached recording; run with ELEVENLABS_API_KEY to generate it.');
          if (!key) throw Object.assign(new Error('ELEVENLABS_API_KEY is not set. Keep the key in the environment; existing audio has been preserved.'), { halt: true });
          let response;
          for (let attempt = 0; attempt < 5; attempt++) {
            response = await fetch(request.url, { method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/*' }, body: JSON.stringify(request.body), signal: AbortSignal.timeout(10 * 60 * 1000) });
            if (response.status !== 429 || attempt === 4) break;
            // A refused rate-limited request has produced no audio. Retry that refusal only;
            // never blindly retry an ambiguous timeout or a response whose generation may have succeeded.
            await response.arrayBuffer();
            const seconds = Math.min(60, 15 * (attempt + 1));
            console.warn(`  ${slug}/${clip.name}: ElevenLabs is busy; retrying in ${seconds}s`);
            await new Promise(resolve => setTimeout(resolve, seconds * 1000));
          }
          if (!response.ok) throw Object.assign(new Error(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 300)}. No sound-effects substitution was made.`), { halt: [401, 402, 403, 429].includes(response.status) });
          bytes = Buffer.from(await response.arrayBuffer());
          // Validate full-song length before accepting the cache entry.
          if (clip.kind === 'music') packMusic(bytes, { seconds: request.body.music_length_ms / 1000 });
          mkdirSync(dir, { recursive: true });
          writeFileSync(file, bytes);
          writeFileSync(stampPath, `${JSON.stringify({ fingerprint: fingerprint(request), endpoint: clip.kind === 'music' ? '/v1/music' : '/v1/sound-generation', format: request.format, bytes: bytes.length, seconds: request.body.music_length_ms ? request.body.music_length_ms / 1000 : request.body.duration_seconds, prompt: clip.spec.prompt, at: new Date().toISOString() }, null, 2)}\n`);
        }
        const packed = clip.kind === 'music' ? packMusic(bytes, { seconds: request.body.music_length_ms / 1000 }) : { bytes, format: request.format };
        out[clip.name] = `data:${mediaType(packed.format)};base64,${packed.bytes.toString('base64')}`;
        console.log(`  ${clip.name}: ${(packed.bytes.length / 1024).toFixed(1)} KiB embedded${packed.seconds ? `, ${packed.seconds}s` : ''} (${cacheHit ? 'cache' : 'ElevenLabs'})`);
      } catch (error) {
        failed = gameFailed = true;
        console.error(`  ${clip.name}: ${error.message}${error.cause?.code ? ` (${error.cause.code})` : ''}`);
        if (error.halt) { blocked = true; break; }
      }
    }
    if (blocked) {
      console.error('Generation stopped because API access, quota or concurrency is unavailable. Completed masters and existing clips were preserved.');
      process.exitCode = 1;
      return { blocked: true };
    }
    if (dryRun || gameFailed) continue;
    try {
      const json = serializeClips(out);
      writeFileSync(path, json);
      console.log(`  wrote games/${slug}/clips.json (${Buffer.byteLength(json)} bytes)`);
    } catch (error) {
      failed = true;
      console.error(`  ${error.message}`);
    }
  }
  if (!selected) throw new Error(`No clips matched ${onlyClip ?? 'the selection'}`);
  if (dryRun) console.log('dry run: nothing was called or written');
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Node fetch needs this opt-in for the caller's configured proxy.
  if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
    const again = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
    process.exit(again.status ?? 1);
  }
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
