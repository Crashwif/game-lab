/** Decode all embedded catalog scores in the same browser used for previews. No API calls. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { GAMES } from '../games.mjs';
import { MAX_CLIPS_BYTES } from './pack.mjs';
import { fingerprint, requestFor } from './generate.mjs';
const root = new URL('../../', import.meta.url);
const args = process.argv.slice(2);
let reportPath;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--available') continue;
  if (args[i] === '--report' && args[i + 1] && !args[i + 1].startsWith('--')) reportPath = args[++i];
  else throw new Error('Usage: node scripts/audio/verify.mjs [--available] [--report path.json]');
}
const manifest = JSON.parse(readFileSync(new URL('scripts/audio/prompts.json', root), 'utf8'));
const records = [];
const targets = process.argv.includes('--available') ? GAMES.filter(slug => {
  const path = new URL(`scripts/audio/cache/${slug}/music.json`, root);
  return existsSync(path) && JSON.parse(readFileSync(path, 'utf8')).endpoint === '/v1/music';
}) : GAMES;
assert.ok(targets.length, 'No full-length generated music is available');
const browser = await chromium.launch({ headless: true });
const hashes = new Set();
try {
  const page = await browser.newPage();
  for (const slug of targets) {
    const json = readFileSync(new URL(`games/${slug}/clips.json`, root), 'utf8');
    assert.ok(Buffer.byteLength(json) <= MAX_CLIPS_BYTES, `${slug}: oversized clips`);
    const { music } = JSON.parse(json);
    assert.ok(music, `${slug}: no recorded music`);
    const hash = createHash('sha256').update(music).digest('hex');
    assert.ok(!hashes.has(hash), `${slug}: duplicated music`);
    hashes.add(hash);
    const data = await page.evaluate(async (url) => {
      const ctx = new AudioContext();
      try {
        const buffer = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
        const pcm = buffer.getChannelData(0);
        const sectionRms = [];
        for (let section = 0; section < 6; section++) {
          let power = 0;
          const start = Math.floor(section * 25 * buffer.sampleRate);
          const end = Math.min(pcm.length, start + 25 * buffer.sampleRate);
          for (let i = start; i < end; i++) power += pcm[i] ** 2;
          sectionRms.push(Math.sqrt(power / (end - start)));
        }
        return { seconds: buffer.duration, channels: buffer.numberOfChannels, sectionRms };
      } finally { await ctx.close(); }
    }, music);
    assert.ok(Math.abs(data.seconds - 150) < 0.25, `${slug}: duration ${data.seconds}`);
    assert.ok(data.sectionRms.every(level => Number.isFinite(level) && level > 0.001), `${slug}: silent section`);
    const stamp = JSON.parse(readFileSync(new URL(`scripts/audio/cache/${slug}/music.json`, root), 'utf8'));
    assert.equal(stamp.endpoint, '/v1/music', `${slug}: not an ElevenLabs Music master`);
    assert.equal(stamp.seconds, 150, `${slug}: not authored for 150s`);
    assert.equal(stamp.fingerprint, fingerprint(requestFor({ kind: 'music', spec: manifest.games[slug].music }, manifest.defaults)), `${slug}: master does not match the current music prompt`);
    const master = readFileSync(new URL(`scripts/audio/cache/${slug}/music.mp3`, root));
    records.push({ masterBytes: master.length, masterSha256: createHash('sha256').update(master).digest('hex'), game: slug, status: 'complete', durationSeconds: Number(data.seconds.toFixed(6)), clipsBytes: Buffer.byteLength(json), clipsPath: `games/${slug}/clips.json`, masterPath: `scripts/audio/cache/${slug}/music.mp3`, endpoint: stamp.endpoint, musicSha256: hash, sectionRms: data.sectionRms.map(level => Number(level.toFixed(5))) });
    console.log(`${slug}: ${data.seconds.toFixed(2)}s, ${Buffer.byteLength(json)} bytes, six audible 25s sections`);
  }
  console.log(`Verified ${targets.length}/${GAMES.length} distinct complete ElevenLabs Music scores.`);
  if (targets.length < GAMES.length) console.log(`Still pending generation: ${GAMES.filter(slug => !targets.includes(slug)).join(', ')}`);
  if (reportPath) {
    const games = GAMES.map(slug => records.find(record => record.game === slug) ?? { game: slug, status: 'pending', durationSeconds: null, clipsBytes: readFileSync(new URL(`games/${slug}/clips.json`, root)).length, clipsPath: `games/${slug}/clips.json`, masterPath: null });
    writeFileSync(reportPath, `${JSON.stringify({ verifiedAt: new Date().toISOString(), provider: 'ElevenLabs Music', requestedDurationSeconds: 150, encoding: 'Opus, mono, 8000 bits/s; higher-quality MP3 masters retained separately', complete: records.length, total: GAMES.length, sourceFileLimitBytes: MAX_CLIPS_BYTES, games }, null, 2)}\n`);
    console.log(`Wrote ${reportPath}`);
  }
} finally { await browser.close(); }
