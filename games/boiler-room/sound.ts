/**
 * Procedural sound, opt-in: nothing is created until the player turns it on
 * with a click, which also satisfies autoplay rules. A looped noise bed hisses
 * with the pressure, a whistle joins in the red, each piston reversal chuffs,
 * a rivet pings when a seam gives, and the blow-out is a swept blast. No
 * audio files: the bundle stays self-contained.
 */

export interface Sound {
  readonly enabled: boolean;
  toggle(): Promise<boolean>;
  update(pressure: number, running: boolean): void;
  chuff(strength: number): void;
  ping(): void;
  blast(): void;
  close(): void;
}

export function createSound(): Sound {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let hiss: GainNode | null = null;
  let whistle: { osc: OscillatorNode; gain: GainNode } | null = null;
  let enabled = false;

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

  function ensure(): AudioContext {
    if (context && master && noise) return context;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    noise = makeNoise(context);
    const bed = context.createBufferSource();
    bed.buffer = noise;
    bed.loop = true;
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 1800;
    hiss = context.createGain();
    hiss.gain.value = 0;
    bed.connect(highpass).connect(hiss).connect(master);
    bed.start();
    const osc = context.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 900;
    const gain = context.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(master);
    osc.start();
    whistle = { osc, gain };
    return context;
  }

  /** A burst of filtered noise with an exponential decay. */
  function burst(frequency: number, q: number, peak: number, decay: number, type: BiquadFilterType, sweepTo?: number): void {
    if (!context || !master || !noise) return;
    const t = context.currentTime;
    const src = context.createBufferSource();
    src.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, t);
    if (sweepTo !== undefined) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + decay);
    filter.Q.value = q;
    const gain = context.createGain();
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
    src.stop(t + decay + 0.05);
  }

  return {
    get enabled() {
      return enabled;
    },
    async toggle() {
      if (enabled) {
        enabled = false;
        if (context && master) master.gain.setTargetAtTime(0, context.currentTime, 0.05);
        return false;
      }
      const ctx = ensure();
      await ctx.resume();
      master!.gain.setTargetAtTime(0.6, ctx.currentTime, 0.05);
      enabled = true;
      return true;
    },
    update(pressure, running) {
      if (!enabled || !context || !hiss || !whistle) return;
      const t = context.currentTime;
      hiss.gain.setTargetAtTime(running ? 0.01 + 0.16 * pressure * pressure : 0.004, t, 0.15);
      const red = pressure > 0.7 ? (pressure - 0.7) / 0.3 : 0;
      whistle.gain.gain.setTargetAtTime(0.05 * red, t, 0.1);
      whistle.osc.frequency.setTargetAtTime(900 + 700 * pressure, t, 0.2);
    },
    chuff(strength) {
      if (!enabled) return;
      burst(420 + 300 * strength, 0.9, 0.2 * strength, 0.14, 'bandpass');
    },
    ping() {
      if (!enabled || !context || !master) return;
      const t = context.currentTime;
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2600, t);
      osc.frequency.exponentialRampToValueAtTime(1900, t + 0.3);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 0.4);
    },
    blast() {
      if (!enabled || !context || !master || !hiss) return;
      const t = context.currentTime;
      burst(6000, 0.5, 0.9, 1.6, 'lowpass', 120);
      const thump = context.createOscillator();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(55, t);
      thump.frequency.exponentialRampToValueAtTime(30, t + 0.7);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      thump.connect(gain).connect(master);
      thump.start(t);
      thump.stop(t + 0.75);
      hiss.gain.setValueAtTime(0.25, t + 0.2);
      hiss.gain.setTargetAtTime(0.004, t + 0.5, 1.5);
    },
    close() {
      void context?.close();
      context = null;
      master = null;
      noise = null;
      hiss = null;
      whistle = null;
      enabled = false;
    },
  };
}
