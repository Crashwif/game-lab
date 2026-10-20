/**
 * Insider Wallets' own continuous synthesis on top of the page's shared audio (audio.ts): the outdoor rally crowd
 * murmur bed that swells with the multiplier, the approaching extraction helicopter rotor chop as the insiders queue
 * their sales, and the winch-and-downdraft roar when the candidate is yanked off the podium. No audio files.
 */
import type { Audio } from './audio';

export interface Sound {
  /** Every frame: tension (0..1), helicopter proximity (0..1), and whether the rally is live. */
  update(tension: number, heliReach: number, active: boolean): void;
  /** Winch extraction roar and rotor downdraft when the insiders dump. */
  yank(): void;
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
  let crowd: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  let rotor: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  let blade = 0;

  function makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 23;
    let brown = 0;
    for (let i = 0; i < data.length; i += 1) {
      seed = (seed * 16807) % 2147483647;
      const white = (seed / 2147483647) * 2 - 1;
      brown = (brown + 0.035 * white) / 1.035;
      data[i] = brown * 2.8 + white * 0.22;
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

    const cSrc = ctx.createBufferSource();
    cSrc.buffer = noise;
    cSrc.loop = true;
    const cFilter = ctx.createBiquadFilter();
    cFilter.type = 'bandpass';
    cFilter.frequency.value = 520;
    cFilter.Q.value = 1.4;
    const cGain = ctx.createGain();
    cGain.gain.value = 0;
    cSrc.connect(cFilter).connect(cGain).connect(bus);
    cSrc.start();
    crowd = { gain: cGain, filter: cFilter };

    const rSrc = ctx.createBufferSource();
    rSrc.buffer = noise;
    rSrc.loop = true;
    rSrc.playbackRate.value = 0.75;
    const rFilter = ctx.createBiquadFilter();
    rFilter.type = 'lowpass';
    rFilter.frequency.value = 180;
    rFilter.Q.value = 3.5;
    const rGain = ctx.createGain();
    rGain.gain.value = 0;
    rSrc.connect(rFilter).connect(rGain).connect(bus);
    rSrc.start();
    rotor = { gain: rGain, filter: rFilter };
    return ctx;
  }

  return {
    update(tension, heliReach, active) {
      const ctx = ensure();
      if (!ctx || !crowd || !rotor) return;
      const t = ctx.currentTime;
      blade += 0.38 + 0.22 * tension;
      const pulse = 0.5 + 0.5 * Math.sin(blade);
      crowd.gain.gain.setTargetAtTime(active ? 0.018 + 0.045 * tension : 0, t, 0.16);
      crowd.filter.frequency.setTargetAtTime(460 + 380 * tension + 60 * Math.sin(blade * 0.25), t, 0.1);

      const chop = Math.max(heliReach, Math.max(0, (tension - 0.55) / 0.45));
      rotor.gain.gain.setTargetAtTime(active ? chop * (0.025 + 0.065 * pulse) : 0, t, 0.04);
      rotor.filter.frequency.setTargetAtTime(120 + 220 * pulse + 90 * chop, t, 0.03);
    },
    cut() {
      const ctx = ensure();
      if (!ctx || !crowd || !rotor) return;
      const t = ctx.currentTime;
      crowd.gain.gain.setTargetAtTime(0, t, 0.03);
      rotor.gain.gain.setTargetAtTime(0, t, 0.03);
    },
    yank() {
      const ctx = ensure();
      if (!ctx || !noise || !audio.bus) return;
      const t = ctx.currentTime;
      if (crowd && rotor) {
        crowd.gain.gain.setTargetAtTime(0, t, 0.04);
        rotor.gain.gain.setTargetAtTime(0, t, 0.04);
      }
      // Winch motor whine + helicopter downdraft rush.
      const winch = ctx.createOscillator();
      winch.type = 'sawtooth';
      winch.frequency.setValueAtTime(190, t + 0.12);
      winch.frequency.exponentialRampToValueAtTime(680, t + 0.95);
      const wg = ctx.createGain();
      wg.gain.setValueAtTime(0.18, t + 0.12);
      wg.gain.exponentialRampToValueAtTime(0.001, t + 1.05);
      winch.connect(wg).connect(audio.bus);
      winch.start(t + 0.12);
      winch.stop(t + 1.1);

      const wash = ctx.createBufferSource();
      wash.buffer = noise;
      const wf = ctx.createBiquadFilter();
      wf.type = 'lowpass';
      wf.frequency.setValueAtTime(900, t);
      wf.frequency.exponentialRampToValueAtTime(140, t + 1.3);
      const wGain = ctx.createGain();
      wGain.gain.setValueAtTime(0.45, t);
      wGain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
      wash.connect(wf).connect(wGain).connect(audio.bus);
      wash.start(t);
      wash.stop(t + 1.45);
    },
  };
}
