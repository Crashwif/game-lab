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
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;

/** Carry the circle's position and velocity into a quiet, damped landing. */
export function circleBob(view: Pick<SceneView, 'phase' | 'elapsed' | 'crashAge'>, reduced = false): number {
  if (reduced || (view.phase !== 'running' && view.phase !== 'crashed')) return 0;
  const angle = view.elapsed / 250;
  const position = Math.sin(angle) * 12;
  if (view.phase === 'running') return position;
  const age = Math.max(0, view.crashAge / 1000);
  const velocity = Math.cos(angle) * 48;
  return (position + (velocity + 10 * position) * age) * Math.exp(-10 * age);
}

export function createScene(options: SceneOptions = {}): Scene {
  // clips.json is empty: the shared helper makes all sounds locally, opt-in.
  // The helper owns its page lifecycle; do not close it when replacing a scene.
  const audio = pageAudio({ style: 'chiptune', crash: 'pop' });
  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    // Tension is a visual/audio parameter only, never a crash prediction.
    const tension = Math.min(1, Math.max(0, Math.log2(view.currentX100 / 100) / 8));
    audio.update(view.phase, tension);

    // Fire cues once on confirmed changes. A late entry shows the current state
    // without replaying an old cash-out or crash sound.
    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) audio.cashout();
    if (crashed && previousPhase !== 'crashed') audio.crash('pop', previousPhase === null || view.crashAge > 1500);
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;

    // The shell scales this 960 × 540 coordinate space to fit any screen.
    ctx.save();
    ctx.fillStyle = COLOURS.background;
    ctx.fillRect(0, 0, 960, 540);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = COLOURS.text;
    ctx.font = '600 52px system-ui, sans-serif';
    ctx.fillText(GREETING, 480, 108, 840);
    ctx.font = '600 21px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('CREATOR TEMPLATE · YOUR SCENE STARTS HERE', 480, 158, 860);

    ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.accent;
    ctx.font = '700 112px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 244, 840);

    // Replace this circle with your character or scene. Motion follows elapsed
    // round time and keeps going in long rounds; reduced motion holds it still.
    const bob = circleBob(view, options.reducedMotion);
    ctx.beginPath();
    ctx.arc(480, 360 + bob, 18 + tension * 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '500 32px system-ui, sans-serif';
    ctx.fillText(PHASE_LABELS[view.phase], 480, 432);

    // Confirmation remains visible through the crash. The shell clears it for
    // the next round; a button click alone never changes this presentation.
    if (view.cashoutX100 !== null) {
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.font = '600 30px system-ui, sans-serif';
      ctx.fillText(`Cashed out at ${formatX(view.cashoutX100)}`, 480, 490, 840);
    }
    ctx.restore();
  }

  return { draw };
}
