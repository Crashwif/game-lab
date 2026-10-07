/** Audio packing for sandboxed, text-only source packs. No network or outcome logic. */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const MAX_CLIPS_BYTES = 256 * 1024;
export const MUSIC_SECONDS = 150;
export const MUSIC_BITRATE = 8000;

export const mediaType = (format) => format.startsWith('mp3') ? 'audio/mpeg' : format.startsWith('opus') ? 'audio/ogg' : 'application/octet-stream';
export const extension = (format) => format.startsWith('mp3') ? 'mp3' : format.startsWith('opus') ? 'ogg' : 'bin';

export function serializeClips(clips) {
  const json = `${JSON.stringify(clips, null, 2)}\n`;
  const size = Buffer.byteLength(json);
  if (size > MAX_CLIPS_BYTES) throw new Error(`clips.json would be ${size} bytes; the source-file limit is ${MAX_CLIPS_BYTES}. Existing clips were preserved.`);
  return json;
}

/** Read the decoded duration, then encode one complete song (never repeat a short loop to meet it). */
export function packMusic(bytes, { ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg', seconds = MUSIC_SECONDS } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'game-lab-music-'));
  try {
    const input = join(dir, 'input.mp3');
    const output = join(dir, 'music.ogg');
    writeFileSync(input, bytes);
    const result = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-i', input, '-vn', '-af', 'apad', '-t', String(seconds), '-ac', '1', '-c:a', 'libopus', '-b:a', String(MUSIC_BITRATE), '-vbr', 'off', '-application', 'audio', '-frame_duration', '60', '-y', output], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    if (result.error) throw new Error(`ffmpeg is required to pack full-length music; install it or set FFMPEG_PATH (${result.error.code})`);
    if (result.status !== 0) throw new Error(`ffmpeg could not encode music: ${result.stderr.slice(-600)}`);
    const duration = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(result.stderr);
    if (!duration) throw new Error('ffmpeg did not report the source music duration');
    const decodedSeconds = Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
    if (Math.abs(decodedSeconds - seconds) > 0.25) throw new Error(`Music is ${decodedSeconds}s, expected ${seconds}s. Refusing to stretch or loop an incomplete track.`);
    return { bytes: readFileSync(output), format: 'opus_48000_8', seconds, sourceSeconds: decodedSeconds, bitrate: MUSIC_BITRATE };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
