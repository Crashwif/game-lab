/**
 * The study's own sound on top of the page's shared audio (audio.ts): rain on the window as a filtered noise
 * bed that swells with the tension and stops at the end of the crash, and the fire's crackle, which thins as the
 * fire burns down. The shared engine owns the context, the bus, the Sound button and the hidden-page suspend,
 * so one button governs the music, the effects and these. No audio files.
 */
import type { Audio } from './audio';

export interface Weather {
  /** `rain` and `fire` are 0..1; called every frame. Returns true when a crackle is due. */
  update(rain: number, fire: number, dt: number): boolean;
}

let shared: Weather | null = null;

/** The page's one rain bed, built on the shared audio the first time a scene asks for it. */
export function pageWeather(audio: Audio): Weather {
  shared ??= createWeather(audio);
  return shared;
}

function createWeather(audio: Audio): Weather {
  let context: AudioContext | null = null;
  let level: GainNode | null = null;
  let crackle = 0;
  let seed = 7;
  const random = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  /** The bed, built on the shared bus once it exists; rebuilt if the engine's context changed. */
  function ensure(): AudioContext | null {
    const ctx = audio.context;
    const bus = audio.bus;
    if (!ctx || !bus || !audio.enabled) return null;
    if (context === ctx && level) return ctx;
    context = ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < data.length; i += 1) {
      // Mostly white with a little brown under it: rain on glass, not a radio.
      brown = (brown + 0.02 * (random() * 2 - 1)) / 1.02;
      data[i] = (random() * 2 - 1) * 0.6 + brown * 3;
    }
    const bed = ctx.createBufferSource();
    bed.buffer = buffer;
    bed.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 2600;
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 380;
    level = ctx.createGain();
    level.gain.value = 0;
    bed.connect(low).connect(high).connect(level).connect(bus);
    bed.start();
    return ctx;
  }

  return {
    update(rain, fire, dt) {
      const ctx = ensure();
      if (ctx && level) level.gain.setTargetAtTime(audio.mode === 'off' ? 0 : 0.045 * rain, ctx.currentTime, 0.4);
      // The fire crackles at random, less as it burns down.
      if (fire < 0.15) return false;
      crackle -= dt;
      if (crackle > 0) return false;
      crackle = 0.25 + random() * (1.4 - fire);
      return true;
    },
  };
}
