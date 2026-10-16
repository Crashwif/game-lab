/**
 * Gays of Hormuz's own continuous synthesis on top of the page's shared audio (audio.ts): the bow wake and ocean
 * surf wash that swells with hull speed, the Pride Air helicopter rotor chop during a confirmed cash-out airlift,
 * and the hull groan + water rush when the ship is struck. No audio files.
 */
import type { Audio } from './audio';

export interface Sound {
  /** Every frame: hull speed (0..1), tension (0..1), airlift proximity (0..1), and whether the voyage is live. */
  update(speedNorm: number, tension: number, airlift: number, sailing: boolean): void;
  /** Hull groan and water rush when struck. */
  sink(): void;
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
  let wake: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  let rotor: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  let phase = 0;

  function makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 31;
    let brown = 0;
    for (let i = 0; i < data.length; i += 1) {
      seed = (seed * 16807) % 2147483647;
      const white = (seed / 2147483647) * 2 - 1;
      brown = (brown + 0.04 * white) / 1.04;
      data[i] = brown * 2.9 + white * 0.24;
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

    const wSrc = ctx.createBufferSource();
    wSrc.buffer = noise;
    wSrc.loop = true;
    const wFilter = ctx.createBiquadFilter();
    wFilter.type = 'lowpass';
    wFilter.frequency.value = 360;
    wFilter.Q.value = 1.8;
    const wGain = ctx.createGain();
    wGain.gain.value = 0;
    wSrc.connect(wFilter).connect(wGain).connect(bus);
    wSrc.start();
    wake = { gain: wGain, filter: wFilter };

    const rSrc = ctx.createBufferSource();
    rSrc.buffer = noise;
    rSrc.loop = true;
    rSrc.playbackRate.value = 0.72;
    const rFilter = ctx.createBiquadFilter();
    rFilter.type = 'bandpass';
    rFilter.frequency.value = 170;
    rFilter.Q.value = 3.2;
    const rGain = ctx.createGain();
    rGain.gain.value = 0;
    rSrc.connect(rFilter).connect(rGain).connect(bus);
    rSrc.start();
    rotor = { gain: rGain, filter: rFilter };
    return ctx;
  }

  return {
    update(speedNorm, tension, airlift, sailing) {
      const ctx = ensure();
      if (!ctx || !wake || !rotor) return;
      const t = ctx.currentTime;
      phase += 0.36;
      const swell = 0.5 + 0.5 * Math.sin(phase * 0.14);
      wake.gain.gain.setTargetAtTime(sailing ? 0.022 + 0.042 * speedNorm + 0.015 * swell : 0, t, 0.14);
      wake.filter.frequency.setTargetAtTime(280 + 420 * speedNorm + 180 * tension + 90 * swell, t, 0.08);

      const chop = 0.5 + 0.5 * Math.sin(phase * 1.1);
      rotor.gain.gain.setTargetAtTime(sailing && airlift > 0.02 ? airlift * (0.02 + 0.06 * chop) : 0, t, 0.04);
      rotor.filter.frequency.setTargetAtTime(130 + 210 * chop, t, 0.03);
    },
    cut() {
      const ctx = ensure();
      if (!ctx || !wake || !rotor) return;
      const t = ctx.currentTime;
      wake.gain.gain.setTargetAtTime(0, t, 0.03);
      rotor.gain.gain.setTargetAtTime(0, t, 0.03);
    },
    sink() {
      const ctx = ensure();
      if (!ctx || !noise || !audio.bus) return;
      const t = ctx.currentTime;
      if (wake && rotor) {
        wake.gain.gain.setTargetAtTime(0, t, 0.04);
        rotor.gain.gain.setTargetAtTime(0, t, 0.04);
      }
      // Hull groan + rushing water intake.
      const groan = ctx.createOscillator();
      groan.type = 'sawtooth';
      groan.frequency.setValueAtTime(92, t + 0.15);
      groan.frequency.exponentialRampToValueAtTime(34, t + 1.5);
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(0.24, t + 0.15);
      gg.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
      groan.connect(gg).connect(audio.bus);
      groan.start(t + 0.15);
      groan.stop(t + 1.65);

      const rush = ctx.createBufferSource();
      rush.buffer = noise;
      const rf = ctx.createBiquadFilter();
      rf.type = 'lowpass';
      rf.frequency.setValueAtTime(1200, t);
      rf.frequency.exponentialRampToValueAtTime(160, t + 1.8);
      const rg = ctx.createGain();
      rg.gain.setValueAtTime(0.42, t);
      rg.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
      rush.connect(rf).connect(rg).connect(audio.bus);
      rush.start(t);
      rush.stop(t + 1.95);
    },
  };
}
