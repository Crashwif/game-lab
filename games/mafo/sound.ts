/**
 * MAFO's own sounds on top of the page's shared audio (audio.ts): the turkey fryer's rolling boil, the burner's
 * roar with the flame, and a pressure whistle that comes in around 2× and climbs with the multiplier, plus the
 * blast's low thump and its long hiss. The shared engine owns the context, the bus, the Sound button and the
 * hidden-page suspend, so one button governs the music, the effects and these. No audio files.
 */
import type { Audio } from './audio';

export interface Sound {
  /** Every frame: the pressure (the tension), the flame, and whether anything is cooking. */
  update(pressure: number, flame: number, cooking: boolean): void;
  /** The trailer going: everything bubbling stops, a thump and a long hiss. */
  blast(): void;
  /** Silence the bed at once (the record scratch). */
  cut(): void;
}

let shared: Sound | null = null;

/** The page's one Sound, built on the shared audio the first time a scene asks for it. */
export function pageSound(audio: Audio): Sound {
  shared ??= createSound(audio);
  return shared;
}

function createSound(audio: Audio): Sound {
  let context: AudioContext | null = null;
  let noise: AudioBuffer | null = null;
  let boil: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  let roar: GainNode | null = null;
  let whistle: { osc: OscillatorNode; gain: GainNode } | null = null;
  let wobble = 0;

  function makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 7;
    let brown = 0;
    for (let i = 0; i < data.length; i += 1) {
      seed = (seed * 16807) % 2147483647;
      const white = (seed / 2147483647) * 2 - 1;
      // A little brown in it: a boil rumbles more than it hisses.
      brown = (brown + 0.04 * white) / 1.04;
      data[i] = brown * 3 + white * 0.25;
    }
    return buffer;
  }

  /** The beds and the whistle, built on the shared bus once it exists; rebuilt if the engine's context changed. */
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
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 4;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    bed.connect(filter).connect(gain).connect(bus);
    bed.start();
    boil = { gain, filter };
    const bed2 = ctx.createBufferSource();
    bed2.buffer = noise;
    bed2.loop = true;
    bed2.playbackRate.value = 0.6;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 180;
    roar = ctx.createGain();
    roar.gain.value = 0;
    bed2.connect(band).connect(roar).connect(bus);
    bed2.start();
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 1100;
    const wg = ctx.createGain();
    wg.gain.value = 0;
    osc.connect(wg).connect(bus);
    osc.start();
    whistle = { osc, gain: wg };
    return ctx;
  }

  return {
    update(pressure, flame, cooking) {
      const ctx = ensure();
      if (!ctx || !boil || !roar || !whistle) return;
      const t = ctx.currentTime;
      wobble += 0.11;
      boil.gain.gain.setTargetAtTime(cooking ? 0.03 + 0.12 * pressure : 0, t, 0.2);
      boil.filter.frequency.setTargetAtTime(300 + 900 * pressure + 120 * Math.sin(wobble * 3.1), t, 0.05);
      roar.gain.setTargetAtTime(cooking ? 0.05 * Math.min(1.5, flame) : 0, t, 0.25);
      // 1 − 1/x: the whistle creeps in near 2× and is shrill by 5×.
      const whistling = Math.min(1, Math.max(0, (pressure - 0.45) / 0.5));
      whistle.gain.gain.setTargetAtTime(cooking ? 0.045 * whistling : 0, t, 0.12);
      whistle.osc.frequency.setTargetAtTime(1100 + 1300 * pressure + 40 * Math.sin(wobble * 5), t, 0.08);
    },
    cut() {
      const ctx = ensure();
      if (!ctx || !boil || !roar || !whistle) return;
      const t = ctx.currentTime;
      boil.gain.gain.setTargetAtTime(0, t, 0.02);
      roar.gain.setTargetAtTime(0, t, 0.02);
      whistle.gain.gain.setTargetAtTime(0, t, 0.02);
    },
    blast() {
      const ctx = ensure();
      if (!ctx || !noise || !audio.bus) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(5000, t);
      filter.frequency.exponentialRampToValueAtTime(90, t + 2.2);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
      src.connect(filter).connect(gain).connect(audio.bus);
      src.start(t);
      src.stop(t + 2.5);
      const thump = ctx.createOscillator();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(70, t);
      thump.frequency.exponentialRampToValueAtTime(26, t + 0.9);
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0.7, t);
      tg.gain.exponentialRampToValueAtTime(0.001, t + 1);
      thump.connect(tg).connect(audio.bus);
      thump.start(t);
      thump.stop(t + 1.05);
    },
  };
}
