/**
 * Moon Boys' own sounds, on top of the page's shared audio (audio.ts): a
 * rumble bed that follows the thrust, and the twang of a stage wire
 * snapping. The shared engine owns the context, the bus, the Sound button
 * and the hidden-page suspend, so one button governs the music, the effects
 * and these. No audio files: the bundle stays self-contained.
 */
import type { Audio } from './audio';

export interface Sound {
  readonly enabled: boolean;
  /** Every frame: how hard the engines burn (0 to 1) and whether the round runs. */
  update(thrust: number, running: boolean): void;
  /** A plucked wire that goes slack. */
  twang(): void;
}

let shared: Sound | null = null;

/** The page's one Sound, built on the shared audio the first time a scene asks for it. */
export function pageSound(audio: Audio): Sound {
  if (shared) return shared;
  shared = createSound(audio);
  return shared;
}

export function createSound(audio: Audio): Sound {
  let context: AudioContext | null = null;
  let noise: AudioBuffer | null = null;
  let rumble: GainNode | null = null;
  let filter: BiquadFilterNode | null = null;

  function makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 7;
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      seed = (seed * 16807) % 2147483647;
      const white = (seed / 2147483647) * 2 - 1;
      // Brown-ish: integrated white noise, kept in range.
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }

  /** The bed, built on the shared bus once it exists; rebuilt if the engine's context changed. */
  function ensure(): AudioContext | null {
    const ctx = audio.context;
    const bus = audio.bus;
    if (!ctx || !bus || !audio.enabled) return null;
    if (context === ctx && noise) return ctx;
    context = ctx;
    noise = makeNoise(ctx);
    const bed = ctx.createBufferSource();
    bed.buffer = noise;
    bed.loop = true;
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 160;
    filter.Q.value = 0.8;
    rumble = ctx.createGain();
    rumble.gain.value = 0;
    bed.connect(filter).connect(rumble).connect(bus);
    bed.start();
    return ctx;
  }

  return {
    get enabled() {
      return audio.enabled;
    },
    update(thrust, running) {
      const ctx = ensure();
      if (!ctx || !rumble || !filter) return;
      const t = ctx.currentTime;
      rumble.gain.setTargetAtTime(running ? 0.02 + 0.5 * thrust : 0.0, t, 0.12);
      filter.frequency.setTargetAtTime(120 + 420 * thrust, t, 0.2);
    },
    twang() {
      const ctx = ensure();
      if (!ctx || !audio.bus) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1400, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.5);
      const wobble = ctx.createOscillator();
      wobble.type = 'sine';
      wobble.frequency.value = 18;
      const depth = ctx.createGain();
      depth.gain.value = 120;
      wobble.connect(depth).connect(osc.frequency);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(gain).connect(audio.bus);
      osc.start(t);
      wobble.start(t);
      osc.stop(t + 0.65);
      wobble.stop(t + 0.65);
    },
  };
}
