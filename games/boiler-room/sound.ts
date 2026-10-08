/**
 * Boiler Room's own sounds, on top of the page's shared audio (audio.ts): a
 * looped noise bed that hisses with the pressure, a whistle that comes in
 * from 1.4× and climbs with it, shrieking as the valve goes, a chuff on each
 * piston reversal, a rivet ping when a seam gives, and the swept blast. The shared engine owns the context, the bus, the Sound
 * button and the hidden-page suspend, so one button governs the music, the
 * effects and these. No audio files: the bundle stays self-contained.
 */
import type { Audio } from './audio';

export interface Sound {
  readonly enabled: boolean;
  /** `shriek` (0..1) is the fuse before the blow-out: the whistle screams over everything. */
  update(pressure: number, running: boolean, shriek?: number): void;
  chuff(strength: number): void;
  ping(): void;
  blast(): void;
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
  let hiss: GainNode | null = null;
  let whistle: { osc: OscillatorNode; gain: GainNode } | null = null;

  function makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 1;
    for (let i = 0; i < data.length; i += 1) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
    return buffer;
  }

  /** The bed and the whistle, built on the shared bus once it exists; rebuilt if the engine's context changed. */
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
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 1800;
    hiss = ctx.createGain();
    hiss.gain.value = 0;
    bed.connect(highpass).connect(hiss).connect(bus);
    bed.start();
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(bus);
    osc.start();
    whistle = { osc, gain };
    return ctx;
  }

  /** A burst of filtered noise with an exponential decay. */
  function burst(frequency: number, q: number, peak: number, decay: number, type: BiquadFilterType, sweepTo?: number): void {
    const ctx = ensure();
    if (!ctx || !noise || !audio.bus) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, t);
    if (sweepTo !== undefined) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + decay);
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    src.connect(filter).connect(gain).connect(audio.bus);
    src.start(t);
    src.stop(t + decay + 0.05);
  }

  return {
    get enabled() {
      return audio.enabled;
    },
    update(pressure, running, shriek = 0) {
      const ctx = ensure();
      if (!ctx || !hiss || !whistle) return;
      const t = ctx.currentTime;
      hiss.gain.setTargetAtTime(running ? 0.01 + 0.16 * pressure * pressure : 0.004, t, 0.15);
      // The pressure follows 1 − 1/x, so the whistle comes in around 1.4× and is plainly there by 2×.
      const whistling = Math.min(1, Math.max(0, (pressure - 0.3) / 0.7));
      whistle.gain.gain.setTargetAtTime(Math.max(0.055 * whistling, 0.16 * shriek), t, shriek > 0 ? 0.02 : 0.1);
      whistle.osc.frequency.setTargetAtTime(900 + 700 * pressure + 1300 * shriek, t, shriek > 0 ? 0.03 : 0.2);
    },
    chuff(strength) {
      burst(420 + 300 * strength, 0.9, 0.2 * strength, 0.14, 'bandpass');
    },
    ping() {
      const ctx = ensure();
      if (!ctx || !audio.bus) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2600, t);
      osc.frequency.exponentialRampToValueAtTime(1900, t + 0.3);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain).connect(audio.bus);
      osc.start(t);
      osc.stop(t + 0.4);
    },
    blast() {
      const ctx = ensure();
      if (!ctx || !hiss || !audio.bus) return;
      const t = ctx.currentTime;
      burst(6000, 0.5, 0.9, 1.6, 'lowpass', 120);
      const thump = ctx.createOscillator();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(55, t);
      thump.frequency.exponentialRampToValueAtTime(30, t + 0.7);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      thump.connect(gain).connect(audio.bus);
      thump.start(t);
      thump.stop(t + 0.75);
      hiss.gain.setValueAtTime(0.25, t + 0.2);
      hiss.gain.setTargetAtTime(0.004, t + 0.5, 1.5);
    },
  };
}
