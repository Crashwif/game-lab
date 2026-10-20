/**
 * Congressional Hearing's own continuous synthesis on top of the page's shared audio (audio.ts): the committee
 * chamber's fluorescent/HVAC hum and the gallery's hushed murmur bed that swells as the questioning heats up,
 * plus the PA microphone feedback ring when the gavel slams on the crash. No audio files.
 */
import type { Audio } from './audio';

export interface Sound {
  /** Every frame: tension (0..1) and whether the hearing is in session. */
  update(tension: number, inSession: boolean): void;
  /** PA microphone feedback ring and chamber hush when the gavel slams on the crash. */
  feedback(): void;
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
  let murmur: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  let ballast: { osc: OscillatorNode; gain: GainNode } | null = null;
  let phase = 0;

  function makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 53;
    let brown = 0;
    for (let i = 0; i < data.length; i += 1) {
      seed = (seed * 16807) % 2147483647;
      const white = (seed / 2147483647) * 2 - 1;
      brown = (brown + 0.035 * white) / 1.035;
      data[i] = brown * 2.6 + white * 0.18;
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

    const mSrc = ctx.createBufferSource();
    mSrc.buffer = noise;
    mSrc.loop = true;
    const mFilter = ctx.createBiquadFilter();
    mFilter.type = 'bandpass';
    mFilter.frequency.value = 440;
    mFilter.Q.value = 1.6;
    const mGain = ctx.createGain();
    mGain.gain.value = 0;
    mSrc.connect(mFilter).connect(mGain).connect(bus);
    mSrc.start();
    murmur = { gain: mGain, filter: mFilter };

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 120;
    const bGain = ctx.createGain();
    bGain.gain.value = 0;
    osc.connect(bGain).connect(bus);
    osc.start();
    ballast = { osc, gain: bGain };
    return ctx;
  }

  return {
    update(tension, inSession) {
      const ctx = ensure();
      if (!ctx || !murmur || !ballast) return;
      const t = ctx.currentTime;
      phase += 0.07;
      murmur.gain.gain.setTargetAtTime(inSession ? 0.014 + 0.042 * tension : 0, t, 0.18);
      murmur.filter.frequency.setTargetAtTime(410 + 340 * tension + 45 * Math.sin(phase * 1.9), t, 0.1);
      ballast.gain.gain.setTargetAtTime(inSession ? 0.008 + 0.012 * tension : 0, t, 0.2);
    },
    cut() {
      const ctx = ensure();
      if (!ctx || !murmur || !ballast) return;
      const t = ctx.currentTime;
      murmur.gain.gain.setTargetAtTime(0, t, 0.02);
      ballast.gain.gain.setTargetAtTime(0, t, 0.02);
    },
    feedback() {
      const ctx = ensure();
      if (!ctx || !audio.bus) return;
      const t = ctx.currentTime;
      if (murmur && ballast) {
        murmur.gain.gain.setTargetAtTime(0, t, 0.03);
        ballast.gain.gain.setTargetAtTime(0, t, 0.03);
      }
      // Brief PA gooseneck mic feedback ring on the gavel slam.
      const ring = ctx.createOscillator();
      ring.type = 'sine';
      ring.frequency.setValueAtTime(1720, t + 0.03);
      ring.frequency.exponentialRampToValueAtTime(1660, t + 0.45);
      const rg = ctx.createGain();
      rg.gain.setValueAtTime(0.14, t + 0.03);
      rg.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
      ring.connect(rg).connect(audio.bus);
      ring.start(t + 0.03);
      ring.stop(t + 0.5);
    },
  };
}
