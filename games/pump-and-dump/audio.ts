/**
 * The page's sound: procedural music and effects, opt-in. This file is the same in every game directory:
 * the canonical copy is scripts/shell/audio.ts, `npm run shell -- --write` copies it into each game, and CI
 * fails when a copy drifts. (Remix source packs carry only a game's own directory, so it is copied, not
 * imported.) A game flavours it through the options it passes to pageAudio and the cues it calls.
 *
 * Nothing is created until the player turns it on with the Sound button (the user gesture autoplay rules
 * want); the choice is remembered, and a remembered "on" starts with the next click or key on the page. No
 * audio files: the bundle stays self-contained, and everything below is synthesised with the Web Audio API.
 *
 * Music is a step sequencer scheduled a little ahead of the audio clock, so it never stutters when a frame
 * is slow. A Style names a genre: its drum pattern, chords, scale, tempo and instruments. Tension, from the
 * multiplier, brings layers in (hats, arpeggio, lead, a riser), raises the tempo and opens the filter, so a
 * round tightens as it climbs. A cash-out is a register and a fanfare over the music; the crash is a tape
 * stop with a stinger the game chooses. Everything routes through one bus, which a game's own module
 * (Boiler Room's sound.ts) can build on, so one button governs it all.
 */

export type Style = 'phonk' | 'chiptune' | 'eurodance' | 'trap' | 'lofi' | 'techno' | 'synthwave' | 'dnb' | 'hardstyle' | 'elevator' | 'casino' | 'ambient' | 'military' | 'club' | 'hospital';
/** The crash stinger: what the game's crash sounds like. */
export type Crash = 'boom' | 'pop' | 'splash' | 'shatter' | 'thud' | 'flatline' | 'trombone' | 'scratch' | 'crowd' | 'static' | 'slam' | 'siren';
/** One-shot effects a game can fire from its own events. */
export type Effect = 'airhorn' | 'kaching' | 'coin' | 'pop' | 'thud' | 'whoosh' | 'click' | 'tick' | 'ding' | 'boom' | 'splash' | 'shatter' | 'bubble' | 'squeak' | 'creak' | 'beep' | 'buzz' | 'clang' | 'crowd' | 'cheer' | 'boo' | 'gasp' | 'scream' | 'laugh' | 'heartbeat' | 'stomp' | 'punch' | 'siren' | 'phone' | 'door' | 'engine' | 'bell' | 'whistle' | 'zap' | 'ratchet' | 'spray' | 'glug' | 'chuff' | 'hiss' | 'notify' | 'camera' | 'yeet';

export interface AudioOptions {
  /** The genre the music plays in. */
  style?: Style;
  /** Beats per minute at rest; tension adds up to `tempoRise` on top (default 0.35). */
  bpm?: number;
  tempoRise?: number;
  /** The root as a MIDI note (default the style's). */
  root?: number;
  /** The crash stinger; `crash()` can name another. */
  crash?: Crash;
  /** Music level (0 to 1, default 0.8) and effects level (default 1). */
  music?: number;
  effects?: number;
  /**
   * Recorded clips as data: URLs (or any URL the sandbox can reach) that play instead of the synthesised
   * music loop, crash or cash-out when given. Base64 in a .json beside the game keeps the pack self-contained;
   * a 10 s loop at 64 kb/s is about 110 KB of text.
   */
  clips?: { music?: string; crash?: string; cashout?: string };
}

export interface Audio {
  /** off, or on, or effects only (no music). */
  readonly mode: 'off' | 'on' | 'fx';
  readonly enabled: boolean;
  /** The context and the bus every sound routes through, once the player has turned sound on; a game's own module builds on them. */
  readonly context: AudioContext | null;
  readonly bus: GainNode | null;
  /** Cycles off → on → fx → off. Resolves to the new mode. */
  toggle(): Promise<'off' | 'on' | 'fx'>;
  /** Called every frame: the round's phase and the tension, 0 (the start) to 1 (the stratosphere). */
  update(phase: 'waiting' | 'betting' | 'running' | 'crashed', tension: number): void;
  /** Fires a one-shot effect. `strength` scales its level and, for some, its pitch (default 1). */
  fx(effect: Effect, strength?: number): void;
  /** A milestone stinger: a rising ding, and from the third an airhorn. */
  milestone(index: number): void;
  /** The register and the fanfare of an accepted cash-out. */
  cashout(): void;
  /** The tape stop and the stinger; `quiet` (a crash met late) skips the stinger and just stops the music. */
  crash(kind?: Crash, quiet?: boolean): void;
  /** Suspends the audio while the page can't be seen and resumes it after, keeping the player's choice. */
  setHidden(hidden: boolean): void;
  close(): void;
}

let shared: Audio | null = null;

/**
 * The page's one Audio, wired up the first time a scene asks for it: the #sound button turns it on and off,
 * it goes quiet while the page is hidden or the picture is scrolled out of view, and it closes on pagehide.
 * A scene the shell recreates mid-round gets the same one back, so the player's choice and the music
 * carry over. The options of the first call count.
 */
export function pageAudio(options: AudioOptions = {}): Audio {
  if (shared) return shared;
  const audio = createAudio(options);
  shared = audio;
  const button = document.querySelector<HTMLButtonElement>('#sound');
  const labels = { off: 'Sound: off', on: 'Sound: on', fx: 'Sound: fx only' } as const;
  const show = () => {
    if (button) button.textContent = labels[audio.mode];
  };
  if (button) {
    button.onclick = async () => {
      try {
        await audio.toggle();
      } catch (error) {
        console.warn('Sound could not start:', error);
      }
      show();
      remember(audio.mode);
    };
  }
  // A remembered choice waits for the first gesture on the page (a click into the frame, Join, Space), which is
  // the user activation autoplay rules want; the button itself is a gesture too.
  const wanted = remembered();
  if (wanted !== 'off') {
    const arm = async () => {
      document.removeEventListener('pointerdown', arm, true);
      document.removeEventListener('keydown', arm, true);
      if (audio.mode !== 'off') return;
      try {
        const next = await audio.toggle();
        if (wanted === 'fx' && next === 'on') await audio.toggle();
      } catch (error) {
        console.warn('Sound could not start:', error);
      }
      show();
    };
    document.addEventListener('pointerdown', arm, true);
    document.addEventListener('keydown', arm, true);
  }
  let offScreen = false;
  const hide = () => audio.setHidden(document.hidden || offScreen);
  document.addEventListener('visibilitychange', hide);
  const canvas = document.querySelector('canvas');
  if (canvas && typeof IntersectionObserver !== 'undefined') {
    new IntersectionObserver((entries) => {
      offScreen = !entries[entries.length - 1]!.isIntersecting;
      hide();
    }).observe(canvas);
  }
  window.addEventListener('pagehide', () => audio.close());
  return audio;
}

const STORAGE_KEY = 'game-lab-sound';
function remembered(): 'off' | 'on' | 'fx' {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'on' || value === 'fx' ? value : 'off';
  } catch {
    return 'off';
  }
}
function remember(mode: 'off' | 'on' | 'fx'): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage may be blocked in the frame; the choice then lasts the page.
  }
}

// ---- Music theory -----------------------------------------------------------------------------------------

/** Scale degrees in semitones. */
const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  pentatonic: [0, 3, 5, 7, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
} as const;
type Scale = keyof typeof SCALES;

const midiHz = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

/** A 16-step drum pattern: kick, snare, closed hat, open hat and a percussion voice, 0 silent, 1 hit, 2 accent. */
interface Drums { kick: string; snare: string; hat: string; open: string; perc: string }
interface StylePreset {
  bpm: number;
  root: number;
  scale: Scale;
  /** Chord roots as scale degrees, one per bar, and the chord's degrees stacked over each. */
  progression: number[];
  chord: number[];
  drums: Drums;
  /** Which instruments the style has, in the order tension brings them in (0 always plays). */
  bass: 'sub' | 'saw' | 'square' | 'pluck' | 'reese' | 'none';
  pad: 'saw' | 'triangle' | 'organ' | 'none';
  lead: 'square' | 'saw' | 'sine' | 'triangle' | 'none';
  arp: 'square' | 'saw' | 'triangle' | 'pluck' | 'none';
  /** The bass pattern: one character a step, `.` rest, `x` root, `o` octave, `5` fifth, `3` third. */
  bassline: string;
  /** Arpeggio order of chord tones (index into chord) per 16th; `.` rests. */
  arpeggio: string;
  swing: number;
  /** Extras: a cowbell riff (phonk), vinyl crackle (lofi), sidechain pump (club). */
  cowbell?: string;
  crackle?: boolean;
  pump?: number;
  /** The effect kick and snare take: distortion and a room. */
  drive: number;
  room: number;
}

const STYLES: Record<Style, StylePreset> = {
  phonk: {
    bpm: 134, root: 45, scale: 'phrygian', progression: [0, 0, 5, 3], chord: [0, 2, 4],
    drums: { kick: '2..1..2...1..2..', snare: '....2.......2..1', hat: '1.1.1.1.1.1.1.11', open: '..............1.', perc: '................' },
    bass: 'reese', pad: 'none', lead: 'none', arp: 'none', bassline: 'x..x..x...x.x...', arpeggio: '', swing: 0.08,
    cowbell: '0.0.3.0.5.0.3.0.', drive: 0.7, room: 0.3,
  },
  chiptune: {
    bpm: 150, root: 57, scale: 'minor', progression: [0, 5, 3, 4], chord: [0, 2, 4],
    drums: { kick: '1...1...1...1.1.', snare: '....1.......1...', hat: '1.1.1.1.1.1.1.1.', open: '......1.......1.', perc: '................' },
    bass: 'square', pad: 'none', lead: 'square', arp: 'square', bassline: 'xoxoxoxox5x5x3x3', arpeggio: '0120212021202120', swing: 0,
    drive: 0.2, room: 0.1,
  },
  eurodance: {
    bpm: 140, root: 53, scale: 'minor', progression: [0, 5, 3, 4], chord: [0, 2, 4, 6],
    drums: { kick: '1...1...1...1...', snare: '....1.......1...', hat: '..1...1...1...1.', open: '..1...1...1...1.', perc: '.1...1...1...1..' },
    bass: 'saw', pad: 'saw', lead: 'saw', arp: 'saw', bassline: 'x.xox.xox.xox.xo', arpeggio: '0.1.2.3.2.1.0.2.', swing: 0,
    pump: 0.5, drive: 0.3, room: 0.25,
  },
  trap: {
    bpm: 140, root: 41, scale: 'harmonic', progression: [0, 0, 3, 4], chord: [0, 2, 4],
    drums: { kick: '1.....1...1.....', snare: '....1.......1...', hat: '1.1.1.1.1.1.1111', open: '.......1........', perc: '..............1.' },
    bass: 'sub', pad: 'triangle', lead: 'sine', arp: 'pluck', bassline: 'x.....x...5.....', arpeggio: '0..2..1..0..2..1', swing: 0,
    drive: 0.5, room: 0.35,
  },
  lofi: {
    bpm: 82, root: 50, scale: 'dorian', progression: [0, 3, 1, 4], chord: [0, 2, 4, 6],
    drums: { kick: '1.....1...1.....', snare: '....1.......1...', hat: '1.1.1.1.1.1.1.1.', open: '..............1.', perc: '................' },
    bass: 'pluck', pad: 'organ', lead: 'sine', arp: 'pluck', bassline: 'x.......5...3...', arpeggio: '0.2.1.3.2.1.0.2.', swing: 0.18,
    crackle: true, drive: 0.1, room: 0.5,
  },
  techno: {
    bpm: 132, root: 43, scale: 'minor', progression: [0, 0, 0, 3], chord: [0, 2, 4],
    drums: { kick: '1...1...1...1...', snare: '................', hat: '..1...1...1...1.', open: '..1...1...1...1.', perc: '1..1..1...1.1...' },
    bass: 'saw', pad: 'none', lead: 'saw', arp: 'saw', bassline: 'x.x.x.x.x.x.x.xo', arpeggio: '0.0.2.0.1.0.2.2.', swing: 0,
    pump: 0.6, drive: 0.4, room: 0.3,
  },
  synthwave: {
    bpm: 108, root: 48, scale: 'minor', progression: [0, 5, 3, 4], chord: [0, 2, 4, 6],
    drums: { kick: '1.......1.......', snare: '....1.......1...', hat: '1.1.1.1.1.1.1.1.', open: '................', perc: '................' },
    bass: 'saw', pad: 'saw', lead: 'saw', arp: 'triangle', bassline: 'xxxxxxxxxxxxxxxo', arpeggio: '0123012301230123', swing: 0,
    drive: 0.2, room: 0.5,
  },
  dnb: {
    bpm: 172, root: 45, scale: 'minor', progression: [0, 0, 5, 3], chord: [0, 2, 4],
    drums: { kick: '1.........1.....', snare: '....1.......1...', hat: '1.1.1.1.1.1.1.1.', open: '......1.........', perc: '.......1.....1..' },
    bass: 'reese', pad: 'saw', lead: 'sine', arp: 'none', bassline: 'x...x.....x.5...', arpeggio: '', swing: 0,
    drive: 0.5, room: 0.3,
  },
  hardstyle: {
    bpm: 150, root: 41, scale: 'phrygian', progression: [0, 0, 1, 0], chord: [0, 2, 4],
    drums: { kick: '1...1...1...1...', snare: '....1.......1...', hat: '..1...1...1...1.', open: '................', perc: '................' },
    bass: 'saw', pad: 'none', lead: 'saw', arp: 'none', bassline: '.x.x.x.x.x.x.x.x', arpeggio: '', swing: 0,
    pump: 0.7, drive: 0.9, room: 0.2,
  },
  elevator: {
    bpm: 96, root: 60, scale: 'major', progression: [0, 3, 4, 0], chord: [0, 2, 4, 6],
    drums: { kick: '................', snare: '................', hat: '1.1.1.1.1.1.1.1.', open: '................', perc: '....1.......1...' },
    bass: 'pluck', pad: 'organ', lead: 'sine', arp: 'pluck', bassline: 'x...5...x...5...', arpeggio: '0.1.2.3.', swing: 0.3,
    drive: 0, room: 0.6,
  },
  casino: {
    bpm: 124, root: 55, scale: 'major', progression: [0, 3, 4, 3], chord: [0, 2, 4],
    drums: { kick: '1...1...1...1...', snare: '....1.......1...', hat: '1.1.1.1.1.1.1.1.', open: '..............1.', perc: '..1...1...1...1.' },
    bass: 'pluck', pad: 'organ', lead: 'triangle', arp: 'triangle', bassline: 'x.5.x.5.x.5.x.5.', arpeggio: '0.1.2.1.', swing: 0.12,
    drive: 0, room: 0.4,
  },
  ambient: {
    bpm: 70, root: 48, scale: 'dorian', progression: [0, 2, 3, 4], chord: [0, 2, 4, 6],
    drums: { kick: '................', snare: '................', hat: '................', open: '................', perc: '1...............' },
    bass: 'sub', pad: 'triangle', lead: 'sine', arp: 'triangle', bassline: 'x...............', arpeggio: '0...1...2...3...', swing: 0,
    drive: 0, room: 0.8,
  },
  military: {
    bpm: 116, root: 43, scale: 'minor', progression: [0, 0, 3, 4], chord: [0, 2, 4],
    drums: { kick: '1.......1.......', snare: '1.111.111.111.11', hat: '................', open: '................', perc: '....1.......1...' },
    bass: 'square', pad: 'none', lead: 'square', arp: 'none', bassline: 'x.......5.......', arpeggio: '', swing: 0,
    drive: 0.3, room: 0.5,
  },
  club: {
    bpm: 128, root: 41, scale: 'minor', progression: [0, 3, 5, 4], chord: [0, 2, 4, 6],
    drums: { kick: '1...1...1...1...', snare: '....1.......1...', hat: '..1...1...1...1.', open: '..1...1...1...1.', perc: '...1.....1..1...' },
    bass: 'sub', pad: 'saw', lead: 'saw', arp: 'pluck', bassline: 'x..x..x.x..x..x.', arpeggio: '0.2.1.3.', swing: 0,
    pump: 0.8, drive: 0.4, room: 0.3,
  },
  hospital: {
    bpm: 72, root: 52, scale: 'minor', progression: [0, 5, 3, 4], chord: [0, 2, 4],
    drums: { kick: '................', snare: '................', hat: '................', open: '................', perc: '1...1...1...1...' },
    bass: 'sub', pad: 'triangle', lead: 'sine', arp: 'triangle', bassline: 'x.......x.......', arpeggio: '0.1.2...', swing: 0,
    drive: 0, room: 0.7,
  },
};

// ---- The engine -------------------------------------------------------------------------------------------

const LOOKAHEAD_S = 0.12;
const TICK_MS = 30;

function createAudio(options: AudioOptions): Audio {
  const preset = STYLES[options.style ?? 'phonk'];
  const baseBpm = options.bpm ?? preset.bpm;
  const tempoRise = options.tempoRise ?? 0.35;
  const root = options.root ?? preset.root;
  const defaultCrash: Crash = options.crash ?? 'boom';
  const musicLevel = options.music ?? 0.8;
  const fxLevel = options.effects ?? 1;

  let context: AudioContext | null = null;
  let bus: GainNode | null = null;
  let musicBus: GainNode | null = null;
  let fxBus: GainNode | null = null;
  let filter: BiquadFilterNode | null = null;
  let drive: WaveShaperNode | null = null;
  let room: ConvolverNode | null = null;
  let roomSend: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  /** Bends every music oscillator at once (cents): the tape stop. */
  let bend: ConstantSourceNode | null = null;
  let pump: GainNode | null = null;
  let crackle: AudioBufferSourceNode | null = null;
  let riser: { osc: OscillatorNode; gain: GainNode; noise: GainNode; filter: BiquadFilterNode } | null = null;
  let clipMusic: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  const clipBuffers: Partial<Record<'music' | 'crash' | 'cashout', AudioBuffer>> = {};

  let mode: 'off' | 'on' | 'fx' = 'off';
  let hidden = false;
  let timer = 0;
  let phase: 'waiting' | 'betting' | 'running' | 'crashed' = 'waiting';
  let tension = 0;
  let tempo = baseBpm;
  let stepAt = 0;
  let stopped = false;
  let bar = 0;
  let step = 0;
  let lastMilestone = 0;

  function makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 7;
    for (let i = 0; i < data.length; i += 1) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
    return buffer;
  }

  /** A short exponentially decaying noise burst: the room. */
  function makeRoom(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c += 1) {
      const data = buffer.getChannelData(c);
      let seed = 3 + c;
      for (let i = 0; i < length; i += 1) {
        seed = (seed * 16807) % 2147483647;
        data[i] = ((seed / 2147483647) * 2 - 1) * Math.pow(1 - i / length, 2.6);
      }
    }
    return buffer;
  }

  function makeDrive(amount: number): Float32Array<ArrayBuffer> {
    const n = 512;
    const curve = new Float32Array(n);
    const k = 2 + amount * 40;
    for (let i = 0; i < n; i += 1) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  function ensure(): AudioContext {
    if (context && bus) return context;
    const ctx = new AudioContext();
    context = ctx;
    bus = ctx.createGain();
    bus.gain.value = 0;
    // A gentle limiter keeps a stacked stinger from clipping.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    bus.connect(limiter).connect(ctx.destination);
    noise = makeNoise(ctx);
    room = ctx.createConvolver();
    room.buffer = makeRoom(ctx, 1.6);
    roomSend = ctx.createGain();
    roomSend.gain.value = preset.room * 0.5;
    roomSend.connect(room).connect(bus);
    fxBus = ctx.createGain();
    fxBus.gain.value = fxLevel;
    fxBus.connect(bus);
    fxBus.connect(roomSend);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    pump = ctx.createGain();
    pump.gain.value = 1;
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.8;
    drive = ctx.createWaveShaper();
    drive.curve = makeDrive(preset.drive);
    drive.oversample = '2x';
    musicBus.connect(filter).connect(drive).connect(pump).connect(bus);
    pump.connect(roomSend);
    bend = ctx.createConstantSource();
    bend.offset.value = 0;
    bend.start();
    if (preset.crackle) {
      crackle = ctx.createBufferSource();
      crackle.buffer = noise;
      crackle.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3000;
      const g = ctx.createGain();
      g.gain.value = 0.02;
      crackle.connect(hp).connect(g).connect(musicBus);
      crackle.start();
    }
    const rOsc = ctx.createOscillator();
    rOsc.type = 'sawtooth';
    rOsc.frequency.value = midiHz(root);
    const rGain = ctx.createGain();
    rGain.gain.value = 0;
    const rNoise = ctx.createBufferSource();
    rNoise.buffer = noise;
    rNoise.loop = true;
    const rFilter = ctx.createBiquadFilter();
    rFilter.type = 'bandpass';
    rFilter.frequency.value = 800;
    rFilter.Q.value = 1.2;
    const rNoiseGain = ctx.createGain();
    rNoiseGain.gain.value = 0;
    rOsc.connect(rGain).connect(musicBus);
    rNoise.connect(rFilter).connect(rNoiseGain).connect(musicBus);
    rOsc.start();
    rNoise.start();
    riser = { osc: rOsc, gain: rGain, noise: rNoiseGain, filter: rFilter };
    void loadClips(ctx);
    return ctx;
  }

  async function loadClips(ctx: AudioContext): Promise<void> {
    const clips = options.clips;
    if (!clips) return;
    for (const key of ['music', 'crash', 'cashout'] as const) {
      const url = clips[key];
      if (!url) continue;
      try {
        const bytes = await (await fetch(url)).arrayBuffer();
        clipBuffers[key] = await ctx.decodeAudioData(bytes);
      } catch (error) {
        console.warn(`The ${key} clip could not be decoded; the synthesised one plays instead.`, error);
      }
    }
  }

  // ---- Instruments ----------------------------------------------------------------------------------------

  /** An oscillator on the music bus that the tape stop bends. */
  function voice(ctx: AudioContext, type: OscillatorType, hz: number, detune = 0): OscillatorNode {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = hz;
    osc.detune.value = detune;
    bend!.connect(osc.detune);
    return osc;
  }

  function envelope(ctx: AudioContext, t: number, peak: number, attack: number, decay: number, sustain = 0, hold = 0, release = 0.05): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain), t + attack + decay);
    if (hold > 0) g.gain.setValueAtTime(Math.max(0.0001, peak * sustain), t + attack + decay + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay + hold + release);
    return g;
  }

  function kick(ctx: AudioContext, t: number, accent: number, out: AudioNode): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150 + 60 * accent, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = envelope(ctx, t, 0.9 * accent, 0.002, 0.22, 0, 0, 0.08);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.4);
    const click = ctx.createBufferSource();
    click.buffer = noise;
    const cg = envelope(ctx, t, 0.25 * accent, 0.001, 0.02);
    click.connect(cg).connect(out);
    click.start(t);
    click.stop(t + 0.05);
  }

  function snare(ctx: AudioContext, t: number, accent: number, out: AudioNode): void {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.7;
    const g = envelope(ctx, t, 0.5 * accent, 0.001, 0.16, 0, 0, 0.08);
    src.connect(bp).connect(g).connect(out);
    src.start(t);
    src.stop(t + 0.3);
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(220, t);
    body.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    const bg = envelope(ctx, t, 0.35 * accent, 0.001, 0.09);
    body.connect(bg).connect(out);
    body.start(t);
    body.stop(t + 0.15);
  }

  function hat(ctx: AudioContext, t: number, accent: number, open: boolean, out: AudioNode): void {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = envelope(ctx, t, (open ? 0.22 : 0.16) * accent, 0.001, open ? 0.28 : 0.045);
    src.connect(hp).connect(g).connect(out);
    src.start(t);
    src.stop(t + (open ? 0.4 : 0.08));
  }

  function perc(ctx: AudioContext, t: number, accent: number, out: AudioNode): void {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(500, t + 0.05);
    const g = envelope(ctx, t, 0.16 * accent, 0.001, 0.07);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  function cowbell(ctx: AudioContext, t: number, semis: number, out: AudioNode): void {
    // Two square waves a tritone-ish apart through a bandpass: the 808 cowbell that phonk lives on.
    const base = midiHz(root + 24 + semis);
    const g = envelope(ctx, t, 0.3, 0.001, 0.18, 0, 0, 0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = base * 2.2;
    bp.Q.value = 1.5;
    for (const ratio of [1, 1.48]) {
      const osc = voice(ctx, 'square', base * ratio);
      osc.connect(bp);
      osc.start(t);
      osc.stop(t + 0.3);
    }
    bp.connect(g).connect(out);
  }

  function bassNote(ctx: AudioContext, t: number, hz: number, length: number, out: AudioNode): void {
    const kind = preset.bass;
    if (kind === 'none') return;
    if (kind === 'sub') {
      const osc = voice(ctx, 'sine', hz);
      osc.frequency.setValueAtTime(hz * 1.5, t);
      osc.frequency.exponentialRampToValueAtTime(hz, t + 0.06);
      const g = envelope(ctx, t, 0.6, 0.005, 0.1, 0.8, length, 0.12);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + length + 0.4);
      return;
    }
    if (kind === 'reese') {
      const g = envelope(ctx, t, 0.28, 0.01, 0.1, 0.7, length, 0.1);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 500 + 1500 * tension;
      for (const d of [-12, 12]) {
        const osc = voice(ctx, 'sawtooth', hz, d);
        osc.connect(lp);
        osc.start(t);
        osc.stop(t + length + 0.3);
      }
      lp.connect(g).connect(out);
      return;
    }
    const type: OscillatorType = kind === 'square' ? 'square' : kind === 'saw' ? 'sawtooth' : 'triangle';
    const osc = voice(ctx, type, hz);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(kind === 'pluck' ? 1400 : 700 + 1600 * tension, t);
    if (kind === 'pluck') lp.frequency.exponentialRampToValueAtTime(300, t + 0.2);
    const g = envelope(ctx, t, kind === 'pluck' ? 0.5 : 0.35, 0.005, kind === 'pluck' ? 0.25 : 0.08, kind === 'pluck' ? 0 : 0.6, kind === 'pluck' ? 0 : length, 0.08);
    osc.connect(lp).connect(g).connect(out);
    osc.start(t);
    osc.stop(t + length + 0.4);
  }

  function padChord(ctx: AudioContext, t: number, notes: number[], length: number, level: number, out: AudioNode): void {
    const kind = preset.pad;
    if (kind === 'none' || level <= 0.01) return;
    const g = envelope(ctx, t, 0.09 * level, 0.25, 0.3, 0.8, length, 0.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600 + 2400 * tension;
    for (const n of notes) {
      const detunes = kind === 'saw' ? [-9, 9] : [0];
      for (const d of detunes) {
        const osc = voice(ctx, kind === 'saw' ? 'sawtooth' : kind === 'organ' ? 'sine' : 'triangle', midiHz(n), d);
        osc.connect(lp);
        osc.start(t);
        osc.stop(t + length + 1);
        if (kind === 'organ') {
          const over = voice(ctx, 'sine', midiHz(n + 12));
          const og = ctx.createGain();
          og.gain.value = 0.4;
          over.connect(og).connect(lp);
          over.start(t);
          over.stop(t + length + 1);
        }
      }
    }
    lp.connect(g).connect(out);
  }

  function arpNote(ctx: AudioContext, t: number, hz: number, level: number, out: AudioNode): void {
    const kind = preset.arp;
    if (kind === 'none' || level <= 0.01) return;
    const osc = voice(ctx, kind === 'square' ? 'square' : kind === 'saw' ? 'sawtooth' : 'triangle', hz);
    const g = envelope(ctx, t, 0.12 * level, 0.002, kind === 'pluck' ? 0.16 : 0.1, 0, 0, 0.04);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.2);
    osc.connect(lp).connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  function leadNote(ctx: AudioContext, t: number, hz: number, length: number, level: number, out: AudioNode): void {
    const kind = preset.lead;
    if (kind === 'none' || level <= 0.01) return;
    const g = envelope(ctx, t, 0.14 * level, 0.01, 0.1, 0.7, length, 0.08);
    const detunes = kind === 'saw' ? [-7, 7] : [0];
    for (const d of detunes) {
      const osc = voice(ctx, kind === 'saw' ? 'sawtooth' : kind === 'square' ? 'square' : kind === 'sine' ? 'sine' : 'triangle', hz, d);
      // A little vibrato after the attack.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(6, t + 0.15);
      lfo.connect(lg).connect(osc.detune);
      lfo.start(t);
      lfo.stop(t + length + 0.2);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + length + 0.2);
    }
    g.connect(out);
  }

  // ---- The sequencer --------------------------------------------------------------------------------------

  const degreeToMidi = (degree: number, octave = 0): number => {
    const scale = SCALES[preset.scale];
    const n = scale.length;
    const oct = Math.floor(degree / n) + octave;
    return root + scale[((degree % n) + n) % n]! + 12 * oct;
  };

  const chordAt = (barIndex: number): number[] => {
    const base = preset.progression[barIndex % preset.progression.length]!;
    return preset.chord.map((d) => degreeToMidi(base + d, 1));
  };

  /** Seeded, so a lead phrase repeats each 4 bars rather than wandering. */
  const hash = (n: number): number => {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  function playStep(ctx: AudioContext, t: number, b: number, s: number, secs: number): void {
    const out = musicBus!;
    const layers = tension;
    const hatsIn = phase === 'running' ? 1 : 0.5;
    const arpIn = clampNum((layers - 0.15) / 0.3, 0, 1);
    const leadIn = clampNum((layers - 0.45) / 0.3, 0, 1);
    const padIn = phase === 'running' ? 0.6 + 0.4 * layers : 0.9;
    const d = preset.drums;
    const accent = (c: string): number => (c === '2' ? 1.15 : c === '1' ? 0.85 : 0);
    // Betting and waiting play a thinned beat: no kick, so the drop lands with the round.
    const beatIn = phase === 'running' ? 1 : phase === 'crashed' ? 0 : 0.35;
    if (beatIn > 0) {
      const k = accent(d.kick[s]!);
      if (k && (phase === 'running' || b % 2 === 1)) {
        kick(ctx, t, k * (0.8 + 0.3 * layers), out);
        if (pump && preset.pump) {
          pump.gain.cancelScheduledValues(t);
          pump.gain.setValueAtTime(1 - preset.pump * 0.7, t);
          pump.gain.linearRampToValueAtTime(1, t + secs * 3);
        }
      }
      const sn = accent(d.snare[s]!);
      if (sn && phase === 'running') snare(ctx, t, sn, out);
      // Snare rolls near the top: every step in the last bar of four once tension is high.
      if (phase === 'running' && layers > 0.7 && b % 4 === 3 && s >= 8) snare(ctx, t, 0.35 + 0.5 * ((s - 8) / 8), out);
      const h = accent(d.hat[s]!);
      if (h && hatsIn > 0) hat(ctx, t, h * hatsIn * (0.7 + 0.5 * layers), false, out);
      const o = accent(d.open[s]!);
      if (o && phase === 'running' && layers > 0.25) hat(ctx, t, o, true, out);
      const p = accent(d.perc[s]!);
      if (p && layers > 0.1) perc(ctx, t, p, out);
    }
    if (preset.cowbell) {
      const c = preset.cowbell[s]!;
      if (c !== '.' && (phase === 'running' || s % 4 === 0)) cowbell(ctx, t, Number(c), out);
    }
    const chord = chordAt(b);
    const bassRoot = chord[0]! - 24;
    const bl = preset.bassline[s] ?? '.';
    if (bl !== '.' && phase !== 'crashed') {
      const semis = bl === 'o' ? 12 : bl === '5' ? 7 : bl === '3' ? (preset.scale === 'major' ? 4 : 3) : 0;
      let len = 1;
      while (s + len < 16 && (preset.bassline[s + len] ?? '.') === '.') len += 1;
      bassNote(ctx, t, midiHz(bassRoot + semis), secs * Math.min(len, 4) * 0.9, out);
    }
    if (s === 0 && phase !== 'crashed') padChord(ctx, t, chord, secs * 16, padIn, out);
    if (preset.arpeggio && arpIn > 0) {
      const a = preset.arpeggio[s % preset.arpeggio.length]!;
      if (a !== '.') {
        const idx = Number(a) % chord.length;
        const octave = layers > 0.75 && s % 2 === 0 ? 12 : 0;
        arpNote(ctx, t, midiHz(chord[idx]! + 12 + octave), arpIn, out);
      }
    }
    if (leadIn > 0 && s % 4 === 0 && phase === 'running') {
      const r = hash(b * 16 + s + root);
      if (r < 0.55 + 0.4 * layers) {
        const degree = Math.floor(hash(b * 4 + s / 4 + 3) * 5) + preset.progression[b % preset.progression.length]!;
        const octave = layers > 0.6 && r > 0.5 ? 3 : 2;
        const len = r < 0.3 ? secs * 2 : secs * 4;
        leadNote(ctx, t, midiHz(degreeToMidi(degree, octave)), len * 0.9, leadIn, out);
      }
    }
  }

  function schedule(): void {
    if (!context || mode !== 'on' || hidden || stopped) return;
    const ctx = context;
    // The tempo follows tension smoothly: each step's length is read when it is scheduled.
    tempo = baseBpm * (1 + tempoRise * (phase === 'running' ? tension : phase === 'crashed' ? 0 : -0.08));
    const secs = 60 / tempo / 4;
    if (clipMusic) return; // a recorded loop plays instead of the sequencer
    while (stepAt < ctx.currentTime + LOOKAHEAD_S) {
      if (stepAt < ctx.currentTime - 0.5) stepAt = ctx.currentTime; // fell behind (a suspended tab): skip ahead
      const swing = step % 2 === 1 ? preset.swing * secs : 0;
      playStep(ctx, stepAt + swing, bar, step, secs);
      step += 1;
      if (step >= 16) {
        step = 0;
        bar += 1;
      }
      stepAt += secs;
    }
  }

  function startMusic(): void {
    if (!context || !musicBus) return;
    const ctx = context;
    stopped = false;
    if (bend) {
      bend.offset.cancelScheduledValues(ctx.currentTime);
      bend.offset.setValueAtTime(0, ctx.currentTime);
    }
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(musicLevel, ctx.currentTime, 0.4);
    if (clipBuffers.music && !clipMusic) {
      const source = ctx.createBufferSource();
      source.buffer = clipBuffers.music;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 1;
      source.connect(gain).connect(musicBus);
      source.start();
      clipMusic = { source, gain };
    }
    stepAt = Math.max(stepAt, ctx.currentTime + 0.05);
    if (!timer) timer = window.setInterval(schedule, TICK_MS);
    schedule();
  }

  function stopMusic(tapeStop: boolean): void {
    if (!context || !musicBus) return;
    const ctx = context;
    const t = ctx.currentTime;
    stopped = true;
    if (tapeStop && bend) {
      bend.offset.cancelScheduledValues(t);
      bend.offset.setValueAtTime(0, t);
      bend.offset.linearRampToValueAtTime(-2400, t + 0.55);
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setValueAtTime(musicBus.gain.value, t);
      musicBus.gain.linearRampToValueAtTime(0.0001, t + 0.6);
      if (clipMusic) {
        clipMusic.source.playbackRate.setValueAtTime(1, t);
        clipMusic.source.playbackRate.linearRampToValueAtTime(0.05, t + 0.55);
        clipMusic.source.stop(t + 0.7);
        clipMusic = null;
      }
    } else {
      musicBus.gain.setTargetAtTime(0.0001, t, 0.15);
      if (clipMusic) {
        clipMusic.source.stop(t + 0.5);
        clipMusic = null;
      }
    }
    if (riser) {
      riser.gain.gain.setTargetAtTime(0, t, 0.05);
      riser.noise.gain.setTargetAtTime(0, t, 0.05);
    }
  }

  // ---- Effects --------------------------------------------------------------------------------------------

  function burst(ctx: AudioContext, t: number, out: AudioNode, hz: number, q: number, peak: number, decay: number, type: BiquadFilterType, sweepTo?: number): void {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(hz, t);
    if (sweepTo !== undefined) f.frequency.exponentialRampToValueAtTime(sweepTo, t + decay);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + decay + 0.05);
  }

  function tone(ctx: AudioContext, t: number, out: AudioNode, type: OscillatorType, hz: number, peak: number, attack: number, decay: number, sweepTo?: number, sustain = 0, hold = 0): OscillatorNode {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, t);
    if (sweepTo !== undefined) osc.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + decay + hold);
    const g = envelope(ctx, t, peak, attack, decay, sustain, hold, 0.08);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + attack + decay + hold + 0.15);
    return osc;
  }

  function airhorn(ctx: AudioContext, t: number, out: AudioNode, k: number): void {
    // The MLG airhorn: a detuned sawtooth stack that scoops up into its note, three times.
    for (let i = 0; i < 3; i += 1) {
      const at = t + i * 0.32;
      const len = i === 2 ? 0.55 : 0.22;
      const g = envelope(ctx, at, 0.22 * k, 0.02, 0.05, 0.9, len, 0.06);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 0.6;
      for (const d of [-15, 0, 15, 1200, 1900]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(330, at);
        osc.frequency.exponentialRampToValueAtTime(392, at + 0.07);
        osc.detune.value = d;
        osc.connect(bp);
        osc.start(at);
        osc.stop(at + len + 0.3);
      }
      bp.connect(g).connect(out);
    }
  }

  function kaching(ctx: AudioContext, t: number, out: AudioNode, k: number): void {
    burst(ctx, t, out, 3200, 2, 0.5 * k, 0.08, 'bandpass');
    for (const [hz, at, len] of [[2637, 0.06, 0.5], [3520, 0.1, 0.7]] as const) {
      tone(ctx, t + at, out, 'sine', hz, 0.22 * k, 0.002, len);
      tone(ctx, t + at, out, 'triangle', hz * 2.01, 0.06 * k, 0.002, len * 0.6);
    }
    burst(ctx, t + 0.02, out, 6000, 1, 0.2 * k, 0.25, 'highpass');
  }

  function trombone(ctx: AudioContext, t: number, out: AudioNode, k: number): void {
    // Wah wah wah waaah: four descending notes with a slow vibrato, the last one drooping.
    const notes = [62, 61, 60, 59];
    let at = t;
    notes.forEach((n, i) => {
      const last = i === 3;
      const len = last ? 1.4 : 0.4;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(midiHz(n) * 1.02, at);
      osc.frequency.exponentialRampToValueAtTime(midiHz(n), at + 0.08);
      if (last) osc.frequency.exponentialRampToValueAtTime(midiHz(n - 3), at + len);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = last ? 4 : 6;
      const lg = ctx.createGain();
      lg.gain.value = last ? 30 : 12;
      lfo.connect(lg).connect(osc.detune);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(600, at);
      lp.frequency.linearRampToValueAtTime(1600, at + 0.12);
      lp.frequency.linearRampToValueAtTime(500, at + len);
      const g = envelope(ctx, at, 0.28 * k, 0.03, 0.08, 0.85, len - 0.15, 0.1);
      osc.connect(lp).connect(g).connect(out);
      osc.start(at);
      lfo.start(at);
      osc.stop(at + len + 0.2);
      lfo.stop(at + len + 0.2);
      at += len + 0.05;
    });
  }

  function scream(ctx: AudioContext, t: number, out: AudioNode, k: number): void {
    // A cartoon scream: a wide vibrato on a sawtooth that climbs and falls through a formant filter.
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(760, t + 0.25);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.9);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 14;
    const lg = ctx.createGain();
    lg.gain.value = 90;
    lfo.connect(lg).connect(osc.detune);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1400;
    f.Q.value = 1.4;
    const g = envelope(ctx, t, 0.3 * k, 0.03, 0.2, 0.8, 0.5, 0.2);
    osc.connect(f).connect(g).connect(out);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 1.1);
    lfo.stop(t + 1.1);
  }

  function crowd(ctx: AudioContext, t: number, out: AudioNode, k: number, kind: 'cheer' | 'boo' | 'gasp' | 'laugh'): void {
    const len = kind === 'gasp' ? 0.5 : 1.6;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(kind === 'boo' ? 500 : kind === 'gasp' ? 1500 : 1000, t);
    bp.frequency.exponentialRampToValueAtTime(kind === 'boo' ? 300 : kind === 'gasp' ? 600 : 1400, t + len);
    bp.Q.value = kind === 'gasp' ? 2 : 0.8;
    const g = envelope(ctx, t, (kind === 'gasp' ? 0.35 : 0.45) * k, kind === 'gasp' ? 0.03 : 0.25, 0.3, 0.7, len - 0.6, 0.4);
    src.connect(bp).connect(g).connect(out);
    src.start(t);
    src.stop(t + len + 0.6);
    // Voices under the noise: a few detuned oscillators with a vowel filter.
    if (kind !== 'gasp') {
      const base = kind === 'boo' ? 180 : kind === 'laugh' ? 260 : 330;
      for (let i = 0; i < 4; i += 1) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(base * (1 + i * 0.13), t);
        osc.frequency.exponentialRampToValueAtTime(base * (kind === 'boo' ? 0.7 : 1.3) * (1 + i * 0.13), t + len);
        if (kind === 'laugh') {
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 6 + i;
          const lg = ctx.createGain();
          lg.gain.value = 200;
          lfo.connect(lg).connect(osc.detune);
          lfo.start(t);
          lfo.stop(t + len);
        }
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = kind === 'boo' ? 700 : 1100;
        f.Q.value = 2;
        const vg = envelope(ctx, t + i * 0.05, 0.05 * k, 0.2, 0.3, 0.7, len - 0.6, 0.4);
        osc.connect(f).connect(vg).connect(out);
        osc.start(t);
        osc.stop(t + len + 0.6);
      }
    }
  }

  function effect(ctx: AudioContext, t: number, out: AudioNode, name: Effect, k: number): void {
    switch (name) {
      case 'airhorn': airhorn(ctx, t, out, k); break;
      case 'kaching': kaching(ctx, t, out, k); break;
      case 'coin':
        tone(ctx, t, out, 'square', 988, 0.12 * k, 0.001, 0.08);
        tone(ctx, t + 0.08, out, 'square', 1319, 0.12 * k, 0.001, 0.4);
        break;
      case 'pop':
        tone(ctx, t, out, 'sine', 700 * k, 0.4, 0.001, 0.06, 120 * k);
        burst(ctx, t, out, 2500, 1, 0.3, 0.05, 'bandpass');
        break;
      case 'thud':
        tone(ctx, t, out, 'sine', 120 * k, 0.6, 0.002, 0.18, 40);
        burst(ctx, t, out, 300, 1, 0.3, 0.12, 'lowpass');
        break;
      case 'whoosh': burst(ctx, t, out, 300, 1.5, 0.35 * k, 0.4, 'bandpass', 3000); break;
      case 'click': burst(ctx, t, out, 4000, 3, 0.25 * k, 0.03, 'bandpass'); break;
      case 'tick': tone(ctx, t, out, 'square', 2000, 0.08 * k, 0.001, 0.02); break;
      case 'ding':
        tone(ctx, t, out, 'sine', 1760 * k, 0.2, 0.002, 0.6);
        tone(ctx, t, out, 'sine', 1760 * k * 2.76, 0.06, 0.002, 0.3);
        break;
      case 'boom':
        burst(ctx, t, out, 5000, 0.5, 0.9 * k, 1.4, 'lowpass', 100);
        tone(ctx, t, out, 'sine', 60, 0.7 * k, 0.002, 0.7, 28);
        break;
      case 'splash':
        burst(ctx, t, out, 1200, 0.8, 0.5 * k, 0.5, 'bandpass', 300);
        burst(ctx, t + 0.05, out, 4000, 1, 0.25 * k, 0.6, 'highpass');
        tone(ctx, t, out, 'sine', 180, 0.25 * k, 0.005, 0.2, 60);
        break;
      case 'shatter':
        for (let i = 0; i < 7; i += 1) {
          const at = t + i * 0.03 + hash(i) * 0.05;
          tone(ctx, at, out, 'triangle', 2800 + hash(i * 7) * 3500, 0.12 * k, 0.001, 0.25 + hash(i * 3) * 0.4);
        }
        burst(ctx, t, out, 5000, 0.7, 0.5 * k, 0.35, 'highpass');
        break;
      case 'bubble':
        tone(ctx, t, out, 'sine', 300 * k, 0.15, 0.01, 0.12, 900 * k);
        break;
      case 'squeak':
        tone(ctx, t, out, 'triangle', 1800 * k, 0.12, 0.01, 0.12, 2600 * k);
        break;
      case 'creak': {
        const osc = tone(ctx, t, out, 'sawtooth', 90 * k, 0.12, 0.05, 0.4, 70 * k);
        const lfo = ctx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 22;
        const lg = ctx.createGain();
        lg.gain.value = 60;
        lfo.connect(lg).connect(osc.detune);
        lfo.start(t);
        lfo.stop(t + 0.6);
        break;
      }
      case 'beep': tone(ctx, t, out, 'square', 1000 * k, 0.12, 0.002, 0.08); break;
      case 'buzz': {
        const osc = tone(ctx, t, out, 'sawtooth', 110, 0.2 * k, 0.005, 0.3);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 400;
        osc.disconnect();
        const g = envelope(ctx, t, 0.25 * k, 0.005, 0.3);
        osc.connect(lp).connect(g).connect(out);
        break;
      }
      case 'clang':
        for (const ratio of [1, 1.5, 2.13, 3.4]) tone(ctx, t, out, 'triangle', 620 * k * ratio, 0.16 / ratio, 0.001, 0.9 / ratio);
        burst(ctx, t, out, 3000, 1, 0.3 * k, 0.1, 'bandpass');
        break;
      case 'crowd': crowd(ctx, t, out, k, 'cheer'); break;
      case 'cheer': crowd(ctx, t, out, k, 'cheer'); airhorn(ctx, t + 0.2, out, k * 0.5); break;
      case 'boo': crowd(ctx, t, out, k, 'boo'); break;
      case 'gasp': crowd(ctx, t, out, k, 'gasp'); break;
      case 'laugh': crowd(ctx, t, out, k, 'laugh'); break;
      case 'scream': scream(ctx, t, out, k); break;
      case 'heartbeat':
        tone(ctx, t, out, 'sine', 70, 0.45 * k, 0.005, 0.12, 40);
        tone(ctx, t + 0.18, out, 'sine', 60, 0.3 * k, 0.005, 0.14, 35);
        break;
      case 'stomp':
        tone(ctx, t, out, 'sine', 90, 0.5 * k, 0.002, 0.12, 30);
        burst(ctx, t, out, 600, 0.8, 0.3 * k, 0.08, 'lowpass');
        break;
      case 'punch':
        burst(ctx, t, out, 900, 1, 0.5 * k, 0.1, 'lowpass', 200);
        tone(ctx, t, out, 'sine', 160, 0.4 * k, 0.001, 0.09, 50);
        break;
      case 'siren': {
        const osc = tone(ctx, t, out, 'square', 600, 0.14 * k, 0.05, 0.4, 600, 0.9, 1.6);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 1.6;
        const lg = ctx.createGain();
        lg.gain.value = 500;
        lfo.connect(lg).connect(osc.detune);
        lfo.start(t);
        lfo.stop(t + 2.3);
        break;
      }
      case 'phone':
        for (const at of [0, 0.5]) {
          const osc = tone(ctx, t + at, out, 'square', 1400, 0.09 * k, 0.005, 0.05, 1400, 0.9, 0.3);
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 25;
          const lg = ctx.createGain();
          lg.gain.value = 300;
          lfo.connect(lg).connect(osc.detune);
          lfo.start(t + at);
          lfo.stop(t + at + 0.45);
        }
        break;
      case 'door':
        burst(ctx, t, out, 500, 1, 0.4 * k, 0.12, 'lowpass');
        tone(ctx, t, out, 'sine', 150, 0.3 * k, 0.002, 0.15, 70);
        tone(ctx, t + 0.06, out, 'triangle', 1200, 0.08 * k, 0.001, 0.06);
        break;
      case 'engine': {
        const osc = tone(ctx, t, out, 'sawtooth', 60, 0.25 * k, 0.3, 0.5, 220, 0.8, 1.2);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 500;
        osc.disconnect();
        const g = envelope(ctx, t, 0.3 * k, 0.3, 0.5, 0.8, 1.2, 0.5);
        osc.connect(lp).connect(g).connect(out);
        break;
      }
      case 'bell':
        for (const [ratio, level] of [[1, 0.2], [2.4, 0.08], [3.9, 0.05], [5.4, 0.03]] as const) tone(ctx, t, out, 'sine', 660 * k * ratio, level, 0.001, 1.8 / Math.sqrt(ratio));
        break;
      case 'whistle': {
        const osc = tone(ctx, t, out, 'sine', 2200, 0.16 * k, 0.02, 0.1, 2200, 0.9, 0.7);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 30;
        const lg = ctx.createGain();
        lg.gain.value = 120;
        lfo.connect(lg).connect(osc.detune);
        lfo.start(t);
        lfo.stop(t + 1);
        break;
      }
      case 'zap':
        tone(ctx, t, out, 'sawtooth', 3000, 0.2 * k, 0.001, 0.15, 200);
        burst(ctx, t, out, 6000, 2, 0.25 * k, 0.1, 'bandpass', 800);
        break;
      case 'ratchet':
        for (let i = 0; i < 6; i += 1) burst(ctx, t + i * 0.04, out, 2500 + i * 200, 4, 0.18 * k, 0.03, 'bandpass');
        break;
      case 'spray': burst(ctx, t, out, 7000, 0.6, 0.25 * k, 0.5, 'highpass'); break;
      case 'glug':
        for (let i = 0; i < 3; i += 1) tone(ctx, t + i * 0.13, out, 'sine', 160 + i * 40, 0.18 * k, 0.01, 0.1, 420 + i * 60);
        break;
      case 'chuff': burst(ctx, t, out, 420 + 300 * k, 0.9, 0.22 * k, 0.14, 'bandpass'); break;
      case 'hiss': burst(ctx, t, out, 3000, 0.5, 0.2 * k, 0.9, 'highpass'); break;
      case 'notify':
        tone(ctx, t, out, 'sine', 1319, 0.16 * k, 0.002, 0.12);
        tone(ctx, t + 0.11, out, 'sine', 1760, 0.16 * k, 0.002, 0.3);
        break;
      case 'camera':
        burst(ctx, t, out, 3500, 2, 0.3 * k, 0.03, 'bandpass');
        burst(ctx, t + 0.08, out, 2500, 2, 0.2 * k, 0.04, 'bandpass');
        tone(ctx, t, out, 'sine', 4000, 0.08 * k, 0.001, 0.15, 6000);
        break;
      case 'yeet':
        tone(ctx, t, out, 'sawtooth', 300, 0.18 * k, 0.01, 0.35, 1400);
        burst(ctx, t, out, 400, 1.5, 0.3 * k, 0.35, 'bandpass', 4000);
        break;
    }
  }

  function crashStinger(ctx: AudioContext, t: number, out: AudioNode, kind: Crash): void {
    switch (kind) {
      case 'boom': effect(ctx, t, out, 'boom', 1); effect(ctx, t + 0.3, out, 'hiss', 0.6); break;
      case 'pop': effect(ctx, t, out, 'pop', 1.2); effect(ctx, t + 0.02, out, 'boom', 0.4); trombone(ctx, t + 0.5, out, 0.7); break;
      case 'splash': effect(ctx, t, out, 'splash', 1.3); effect(ctx, t + 0.5, out, 'glug', 1); effect(ctx, t + 1.2, out, 'glug', 0.6); break;
      case 'shatter': effect(ctx, t, out, 'shatter', 1.3); effect(ctx, t + 0.05, out, 'thud', 0.8); effect(ctx, t + 0.4, out, 'splash', 0.7); break;
      case 'thud': effect(ctx, t, out, 'thud', 1.4); effect(ctx, t + 0.02, out, 'punch', 1); effect(ctx, t + 0.6, out, 'gasp', 0.8); break;
      case 'flatline':
        effect(ctx, t, out, 'beep', 1);
        tone(ctx, t + 0.25, out, 'square', 990, 0.08, 0.01, 0.1, 990, 0.9, 3.2);
        break;
      case 'trombone': trombone(ctx, t + 0.15, out, 1); break;
      case 'scratch':
        for (let i = 0; i < 4; i += 1) burst(ctx, t + i * 0.09, out, 1200 - i * 150, 3, 0.35, 0.08, 'bandpass', i % 2 ? 3000 : 400);
        effect(ctx, t + 0.4, out, 'gasp', 0.8);
        break;
      case 'crowd': effect(ctx, t, out, 'gasp', 1); effect(ctx, t + 0.5, out, 'boo', 1); break;
      case 'static':
        burst(ctx, t, out, 4000, 0.3, 0.45, 1.2, 'highpass');
        tone(ctx, t, out, 'square', 50, 0.15, 0.001, 0.4, 50, 0.8, 0.6);
        break;
      case 'slam': effect(ctx, t, out, 'door', 1.5); effect(ctx, t + 0.02, out, 'thud', 1); effect(ctx, t + 0.5, out, 'boo', 0.6); break;
      case 'siren': effect(ctx, t, out, 'siren', 1); effect(ctx, t, out, 'boom', 0.5); break;
    }
  }

  function playClip(ctx: AudioContext, key: 'crash' | 'cashout', out: AudioNode): boolean {
    const buffer = clipBuffers[key];
    if (!buffer) return false;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(out);
    src.start();
    return true;
  }

  const clampNum = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
  const live = (): boolean => mode !== 'off' && !hidden && context !== null && fxBus !== null;

  return {
    get mode() {
      return mode;
    },
    get enabled() {
      return mode !== 'off';
    },
    get context() {
      return context;
    },
    get bus() {
      return bus;
    },
    async toggle() {
      if (mode === 'off') {
        const ctx = ensure();
        if (!hidden) await ctx.resume();
        bus!.gain.setTargetAtTime(0.7, ctx.currentTime, 0.05);
        mode = 'on';
        if (hidden) void ctx.suspend();
        else if (phase !== 'crashed') startMusic();
        return mode;
      }
      if (mode === 'on') {
        mode = 'fx';
        stopMusic(false);
        return mode;
      }
      mode = 'off';
      if (context && bus) bus.gain.setTargetAtTime(0, context.currentTime, 0.05);
      stopMusic(false);
      return mode;
    },
    update(nextPhase, nextTension) {
      const before = phase;
      phase = nextPhase;
      tension = clampNum(nextTension, 0, 1);
      if (!live() || !context) return;
      if (before !== phase) {
        if (phase === 'betting' || phase === 'waiting') lastMilestone = 0;
        if ((phase === 'betting' || phase === 'running') && mode === 'on' && (stopped || before === 'crashed')) startMusic();
        if (phase === 'running' && before === 'betting') {
          // The drop: a crash cymbal and a sub hit with the first beat.
          const t = context.currentTime;
          burst(context, t, fxBus!, 6000, 0.5, 0.35, 1.2, 'highpass');
          tone(context, t, fxBus!, 'sine', 90, 0.5, 0.002, 0.4, 35);
          step = 0;
          bar = 0;
          stepAt = t + 0.02;
        }
      }
      if (mode !== 'on' || stopped) return;
      const t = context.currentTime;
      if (filter) filter.frequency.setTargetAtTime(phase === 'running' ? 900 + 9000 * tension * tension : 700, t, 0.3);
      if (riser) {
        const top = phase === 'running' ? clampNum((tension - 0.55) / 0.45, 0, 1) : 0;
        riser.gain.gain.setTargetAtTime(0.05 * top, t, 0.4);
        riser.noise.gain.setTargetAtTime(0.12 * top * top, t, 0.4);
        riser.osc.frequency.setTargetAtTime(midiHz(root) * (1 + 3 * top), t, 0.5);
        riser.filter.frequency.setTargetAtTime(500 + 5000 * top, t, 0.5);
      }
    },
    fx(name, strength = 1) {
      if (!live()) return;
      effect(context!, context!.currentTime, fxBus!, name, strength);
    },
    milestone(index) {
      if (!live() || index <= lastMilestone) return;
      lastMilestone = index;
      const ctx = context!;
      const t = ctx.currentTime;
      const semis = Math.min(index, 8) * 2;
      tone(ctx, t, fxBus!, 'sine', midiHz(88 + semis), 0.18, 0.002, 0.5);
      tone(ctx, t + 0.09, fxBus!, 'sine', midiHz(95 + semis), 0.18, 0.002, 0.7);
      if (index >= 3 && index % 2 === 1) airhorn(ctx, t + 0.05, fxBus!, Math.min(1, 0.5 + index * 0.1));
    },
    cashout() {
      if (!live()) return;
      const ctx = context!;
      const t = ctx.currentTime;
      if (playClip(ctx, 'cashout', fxBus!)) return;
      kaching(ctx, t, fxBus!, 1);
      // A major fanfare over the music, ducked for a beat.
      const chord = [0, 4, 7, 12, 16];
      chord.forEach((semi, i) => tone(ctx, t + 0.15 + i * 0.06, fxBus!, 'square', midiHz(root + 24 + semi), 0.1, 0.005, 0.5 + i * 0.1));
      if (musicBus && mode === 'on' && !stopped) {
        musicBus.gain.cancelScheduledValues(t);
        musicBus.gain.setValueAtTime(musicBus.gain.value, t);
        musicBus.gain.linearRampToValueAtTime(musicLevel * 0.3, t + 0.05);
        musicBus.gain.linearRampToValueAtTime(musicLevel, t + 1);
      }
      crowd(ctx, t + 0.3, fxBus!, 0.7, 'cheer');
    },
    crash(kind = defaultCrash, quiet = false) {
      if (mode === 'off' || !context) return;
      if (mode === 'on') stopMusic(!quiet && !hidden);
      if (quiet || hidden) return;
      const ctx = context;
      if (playClip(ctx, 'crash', fxBus!)) return;
      crashStinger(ctx, ctx.currentTime + 0.05, fxBus!, kind);
    },
    setHidden(value) {
      hidden = value;
      if (!context) return;
      if (hidden) void context.suspend();
      else if (mode !== 'off') {
        void context.resume();
        // The sequencer picks up from now rather than replaying what it missed.
        stepAt = context.currentTime + 0.05;
      }
    },
    close() {
      if (timer) window.clearInterval(timer);
      timer = 0;
      void context?.close();
      context = bus = musicBus = fxBus = filter = drive = room = roomSend = pump = null;
      noise = null;
      bend = null;
      crackle = null;
      riser = null;
      clipMusic = null;
      mode = 'off';
    },
  };
}
