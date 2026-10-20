/**
 * Vibescam's own continuous synthesis on top of the page's shared audio (audio.ts): the laptop cooling fan and
 * GPU coil whine that climb from a quiet desk hum into a screaming thermal-throttling jet turbine as the AI
 * context window fills up, plus the capacitor spin-down when the stream cuts out. No audio files.
 */
import type { Audio } from './audio';

export interface Sound {
  /** Every frame: tension (0..1) and whether the stream is live. */
  update(tension: number, streaming: boolean): void;
  /** Laptop fan spin-down and coil drop when the stream crashes. */
  powerDown(): void;
  /** Silence the continuous beds at once. */
  cut(): void;
}

let shared: Sound | null = null;

export function pageSound(audio: Audio): Sound {
  shared ??= createSound(audio);
  return shared;
}

function createSound(audio: Audio): Sound {
  let context: AudioContext | null = null;
  let noise: AudioBuffer | null = null;
  let fan: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  let coil: { osc: OscillatorNode; gain: GainNode } | null = null;
  let wobble = 0;

  function makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 41;
    let brown = 0;
    for (let i = 0; i < data.length; i += 1) {
      seed = (seed * 16807) % 2147483647;
      const white = (seed / 2147483647) * 2 - 1;
      brown = (brown + 0.05 * white) / 1.05;
      data[i] = brown * 2.2 + white * 0.35;
    }
    return buffer;
  }

  function ensure(): AudioContext | null {
    const ctx = audio.context;
    const bus = audio.bus;
    if (!ctx || !bus || !audio.enabled) return null;
    if (context === ctx && noise) return ctx;
    context = ctx;
    noise = makeNoise(ctx);

    const fSrc = ctx.createBufferSource();
    fSrc.buffer = noise;
    fSrc.loop = true;
    const fFilter = ctx.createBiquadFilter();
    fFilter.type = 'bandpass';
    fFilter.frequency.value = 420;
    fFilter.Q.value = 2.6;
    const fGain = ctx.createGain();
    fGain.gain.value = 0;
    fSrc.connect(fFilter).connect(fGain).connect(bus);
    fSrc.start();
    fan = { gain: fGain, filter: fFilter };

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 520;
    const cGain = ctx.createGain();
    cGain.gain.value = 0;
    osc.connect(cGain).connect(bus);
    osc.start();
    coil = { osc, gain: cGain };
    return ctx;
  }

  return {
    update(tension, streaming) {
      const ctx = ensure();
      if (!ctx || !fan || !coil) return;
      const t = ctx.currentTime;
      wobble += 0.09;
      fan.gain.gain.setTargetAtTime(streaming ? 0.015 + 0.065 * tension : 0, t, 0.15);
      fan.filter.frequency.setTargetAtTime(380 + 1450 * tension + 55 * Math.sin(wobble * 2.3), t, 0.08);

      const throttle = Math.min(1, Math.max(0, (tension - 0.35) / 0.6));
      coil.gain.gain.setTargetAtTime(streaming ? 0.018 * throttle : 0, t, 0.12);
      coil.osc.frequency.setTargetAtTime(680 + 1100 * tension + 25 * Math.sin(wobble * 4.1), t, 0.07);
    },
    cut() {
      const ctx = ensure();
      if (!ctx || !fan || !coil) return;
      const t = ctx.currentTime;
      fan.gain.gain.setTargetAtTime(0, t, 0.02);
      coil.gain.gain.setTargetAtTime(0, t, 0.02);
    },
    powerDown() {
      const ctx = ensure();
      if (!ctx || !audio.bus) return;
      const t = ctx.currentTime;
      if (fan && coil) {
        fan.gain.gain.setTargetAtTime(0, t, 0.03);
        coil.gain.gain.setTargetAtTime(0, t, 0.03);
      }
      const drop = ctx.createOscillator();
      drop.type = 'triangle';
      drop.frequency.setValueAtTime(980, t);
      drop.frequency.exponentialRampToValueAtTime(65, t + 0.75);
      const dg = ctx.createGain();
      dg.gain.setValueAtTime(0.24, t);
      dg.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      drop.connect(dg).connect(audio.bus);
      drop.start(t);
      drop.stop(t + 0.85);
    },
  };
}
