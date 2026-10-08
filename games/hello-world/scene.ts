/**
 * Start here: replace the greeting, colours and drawing with your game.
 * main.ts supplies verified round state and handles player intents through the SDK.
 * This scene only presents that state; it never chooses when a round crashes.
 */
import { pageAudio } from './audio';

/** The shared shell fills this view every frame. Multipliers are in hundredths. */
export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** 150 means 1.50×. This is the final multiplier after a crash. */
  currentX100: number;
  /** Milliseconds since the round started running; held at the crash time. */
  elapsed: number;
  /** Milliseconds since the crash, for an optional ending animation. */
  crashAge: number;
  /** The player's stake in valueless credits, or null when watching. */
  stake: number | null;
  /** Non-null only after the backend confirms this player's cash-out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions { reducedMotion?: boolean }
export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
  /** Add cleanup here if your scene owns listeners or other resources. */
  dispose?(): void;
}

const GREETING = 'Hello, world!';
const COLOURS = {
  background: '#101827', text: '#edf2fa', muted: '#a6b4ca',
  accent: '#82cfff', crashed: '#ff8c9c', cashedOut: '#9ee8b5',
};
const PHASE_LABELS = {
  waiting: 'Waiting for a round', betting: 'Ready to join',
  running: 'Round running', crashed: 'Round crashed',
};
/**
 * Story beats keyed to the multiplier, never to the crash point. Half of all
 * rounds end before 2× (9 s in), so the early beats come a few seconds apart.
 */
const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Lift-off'],
  [150, 'Past 1.5× · a third of rounds end sooner'],
  [200, 'Past 2× · half of all rounds end sooner'],
  [250, 'Past 2.5× · three in five end sooner'],
  [300, 'Past 3× · two in three end sooner'],
  [500, 'Past 5× · one round in five gets here'],
  [1000, 'Past 10× · one round in ten gets here'],
  [10000, 'Past 100× · one round in a hundred'],
  [100000, 'Past 1,000× · one round in a thousand'],
  [1000000, 'Past 10,000× · one round in ten thousand'],
];
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** A font that draws up to 30% larger while `pop` is above 0. */
const popFont = (weight: number, size: number, pop: number) => `${weight} ${size * (1 + 0.3 * pop * pop)}px system-ui, sans-serif`;

/** The bob quickens from 0.64 to 1.9 Hz as the round runs, doubling about 9 s in. */
const BOB_RISE_MS = 13_000;
/** Its swing grows from rest over about half a second, so the round starts without a kick. */
const BOB_SWING_MS = 250;
/**
 * The bob's phase is the integral of its rising rate, so it never jumps. Avoid
 * sin(elapsed * rate): each change of rate would jump the whole history with it.
 */
function bobAngle(elapsed: number): number {
  return (3 * elapsed - 2 * BOB_RISE_MS * (1 - Math.exp(-elapsed / BOB_RISE_MS))) / 250;
}

/** Carry the circle's position and velocity into a quiet, damped landing. */
export function circleBob(view: Pick<SceneView, 'phase' | 'elapsed' | 'crashAge'>, reduced = false): number {
  if (reduced || (view.phase !== 'running' && view.phase !== 'crashed')) return 0;
  const angle = bobAngle(view.elapsed);
  const swing = 12 * (1 - Math.exp(-view.elapsed / BOB_SWING_MS));
  const position = Math.sin(angle) * swing;
  if (view.phase === 'running') return position;
  const age = Math.max(0, view.crashAge / 1000);
  // The velocity in px/s, from the rates of change of bobAngle (radians per second) and of the swing.
  const rate = (3 - 2 * Math.exp(-view.elapsed / BOB_RISE_MS)) * 1000 / 250;
  const velocity = Math.cos(angle) * swing * rate + Math.sin(angle) * (12 - swing) * 1000 / BOB_SWING_MS;
  return (position + (velocity + 10 * position) * age) * Math.exp(-10 * age);
}

/** The line under the label: tell a player apart from someone watching. */
function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) return [`Cashed out at ${formatX(view.cashoutX100)} · ${crashed ? 'dodged it' : 'off the ride'}`, COLOURS.cashedOut];
  if (view.stake === null) return [crashed ? 'Watched it pop · no credits lost' : 'Watching · no credits riding', COLOURS.muted];
  if (crashed) return [`Your ${credits(view.stake)} went down with it`, COLOURS.crashed];
  return [`You're in · ${credits(view.stake)} riding`, COLOURS.accent];
}

export function createScene(options: SceneOptions = {}): Scene {
  // clips.json is empty: the shared helper makes all sounds locally, opt-in.
  // The helper owns its page lifecycle; do not close it when replacing a scene.
  const audio = pageAudio({ style: 'chiptune', crash: 'pop' });
  const reduced = options.reducedMotion === true;
  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let previousLanding = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    // Tension is a visual/audio parameter only, never a crash prediction. Most
    // rounds end before 3×, so 1 − 1/x escalates there: 0.5 at 2×, 0.67 at 3×.
    const tension = clamp01(1 - 100 / view.currentX100);
    // A slower driver keeps long rounds changing: 0 at 1×, 1 at 1,000×.
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    audio.update(view.phase, tension);
    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    // Counts the circle's landings (the bottom of each bob).
    const landing = Math.floor((bobAngle(view.elapsed) - Math.PI / 2) / (2 * Math.PI));

    // Fire cues once on confirmed changes. A late entry shows the current state
    // without replaying an old cash-out, crash or milestone sound.
    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) audio.cashout();
    if (crashed && previousPhase !== 'crashed') audio.crash('pop', previousPhase === null || view.crashAge > 1500);
    if (running && previousPhase === 'running') {
      if (milestone > previousMilestone) audio.milestone(milestone);
      // A soft tick on each landing quickens with the bob until you cash out.
      if (landing > previousLanding && view.cashoutX100 === null) audio.fx('tick', 0.4 + 0.6 * tension);
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestone;
    previousLanding = landing;

    // The crash plays from crashAge alone, so replays and late entries draw the
    // same frame: the number holds big for 0.12 s and settles, a 6 px shake dies
    // within 0.4 s, and the circle deflates before the next betting phase.
    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed && !reduced ? 6 * clamp01(1 - age / 0.4) ** 2 : 0;
    const punch = crashed && !reduced ? (1 - clamp01((age - 0.12) / 0.25)) ** 2 : 0;
    const settle = crashed ? clamp01(age - 0.6) : 0; // 0 → 1 from 0.6 s to 1.6 s
    const deflate = settle * settle * (3 - 2 * settle);

    // Text pops as the multiplier passes `x100` and settles within about 5% more
    // (0.6 s into a live round). Reduced motion keeps text still.
    const pop = (x100: number) => (running && !reduced ? clamp01(1 - Math.log(view.currentX100 / x100) / 0.05) : 0);

    // The shell scales this 960 × 540 coordinate space to fit any screen.
    ctx.save();
    ctx.fillStyle = COLOURS.background;
    ctx.fillRect(0, 0, 960, 540);
    ctx.translate(shake * Math.sin(age * 70), shake * Math.sin(age * 53));

    // Replace this circle with your character or scene; the text draws over it. It
    // grows with tension and bobs faster as the round runs; reduced motion holds it still.
    const tint = crashed ? COLOURS.crashed : COLOURS.accent;
    const y = 350 + circleBob(view, reduced);
    const radius = 18 + (22 * tension + 6 * depth) * (1 - deflate);
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.arc(480, y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (crashed && !reduced && age < 0.5) {
      // The pop: a ring bursts out of the circle and fades in half a second.
      const burst = age / 0.5;
      ctx.globalAlpha = 1 - burst;
      ctx.lineWidth = 6 * (1 - burst);
      ctx.strokeStyle = COLOURS.crashed;
      ctx.beginPath();
      ctx.arc(480, y, radius + 110 * (1 - (1 - burst) ** 3), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLOURS.text;
    ctx.font = '600 52px system-ui, sans-serif';
    ctx.fillText(GREETING, 480, 108, 840);
    ctx.font = '600 21px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('CREATOR TEMPLATE · YOUR SCENE STARTS HERE', 480, 158, 860);

    ctx.fillStyle = tint;
    ctx.font = `700 ${112 * (1 + 0.25 * punch)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 244, 840);

    // While running, the label shows the latest milestone and pops as it passes.
    const passed = running ? MILESTONES[milestone - 1] : undefined;
    ctx.fillStyle = COLOURS.muted;
    ctx.font = popFont(500, 32, pop(passed?.[0] ?? 100));
    ctx.fillText(passed?.[1] ?? PHASE_LABELS[view.phase], 480, 432, 860);

    // A cash-out stays visible through the crash. The shell clears it for the
    // next round; a button click alone never changes this presentation.
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = popFont(600, 30, view.cashoutX100 !== null ? pop(view.cashoutX100) : 0);
    ctx.fillText(line, 480, 490, 840);
    ctx.restore();
  }

  return { draw };
}
