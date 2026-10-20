/**
 * Flock Off's own continuous synthesis on top of the page's shared audio (audio.ts): the BMX freehub and chain
 * whirr that rises with road speed and buzzes during bunny hops, the distant Doppler police wail that closes in
 * with the heat, and the tire-skid + taser crack when the pursuit catches him. No audio files.
 */
import type { Audio } from './audio';

export interface Sound {
  /** Every frame: road speed (0..1), tension (0..1), whether a hop is airborne, and whether the ride is live. */
  update(speedNorm: number, tension: number, hopping: boolean, riding: boolean): void;
  /** Tire skid and taser crack on the bust frame. */
  bust(): void;
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
  let chain: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  let wail: { osc: OscillatorNode; gain: GainNode } | null = null;
  let phase = 0;

  function makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 19;
    let prev = 0;
    for (let i = 0; i < data.length; i += 1) {
      seed = (seed * 16807) % 2147483647;
      const white = (seed / 2147483647) * 2 - 1;
      // Crisp ratchet comb + road hiss for the BMX freehub.
      const tooth = (i % 180) < 14 ? 0.85 : 0.15;
      prev = 0.65 * prev + 0.35 * white * tooth;
      data[i] = prev;
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
    const bed = ctx.createBufferSource();
    bed.buffer = noise;
    bed.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 3.2;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    bed.connect(filter).connect(gain).connect(bus);
    bed.start();
    chain = { gain, filter };

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 640;
    const wg = ctx.createGain();
    wg.gain.value = 0;
    osc.connect(wg).connect(bus);
    osc.start();
    wail = { osc, gain: wg };
    return ctx;
  }

  return {
    update(speedNorm, tension, hopping, riding) {
      const ctx = ensure();
      if (!ctx || !chain || !wail) return;
      const t = ctx.currentTime;
      phase += 0.08 + 0.14 * tension;
      const chainGain = riding ? (hopping ? 0.055 : 0.024 + 0.045 * speedNorm) : 0;
      const chainFreq = hopping ? 2100 : 850 + 1150 * speedNorm + 140 * Math.sin(phase * 2.4);
      chain.gain.gain.setTargetAtTime(chainGain, t, 0.08);
      chain.filter.frequency.setTargetAtTime(chainFreq, t, 0.06);

      // Distant Doppler siren creeps in after 1.35× (tension > 0.25).
      const heat = Math.min(1, Math.max(0, (tension - 0.24) / 0.65));
      wail.gain.gain.setTargetAtTime(riding ? 0.032 * heat : 0, t, 0.14);
      wail.osc.frequency.setTargetAtTime(620 + 440 * (0.5 + 0.5 * Math.sin(phase * 1.15)), t, 0.07);
    },
    cut() {
      const ctx = ensure();
      if (!ctx || !chain || !wail) return;
      const t = ctx.currentTime;
      chain.gain.gain.setTargetAtTime(0, t, 0.02);
      wail.gain.gain.setTargetAtTime(0, t, 0.02);
    },
    bust() {
      const ctx = ensure();
      if (!ctx || !noise || !audio.bus) return;
      const t = ctx.currentTime;
      if (chain && wail) {
        chain.gain.gain.setTargetAtTime(0, t, 0.02);
        wail.gain.gain.setTargetAtTime(0, t, 0.02);
      }
      // Tire skid + taser crack.
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 4.5;
      filter.frequency.setValueAtTime(2400, t);
      filter.frequency.exponentialRampToValueAtTime(320, t + 0.65);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      src.connect(filter).connect(gain).connect(audio.bus);
      src.start(t);
      src.stop(t + 0.75);

      const zap = ctx.createOscillator();
      zap.type = 'sawtooth';
      zap.frequency.setValueAtTime(140, t + 0.05);
      zap.frequency.exponentialRampToValueAtTime(52, t + 0.45);
      const zg = ctx.createGain();
      zg.gain.setValueAtTime(0.32, t + 0.05);
      zg.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
      zap.connect(zg).connect(audio.bus);
      zap.start(t + 0.05);
      zap.stop(t + 0.5);
    },
  };
}
