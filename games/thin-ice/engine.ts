/**
 * The LIQUIDATION ENGINE: a drone with a loudhailer that patrols the far
 * shore. It heckles her through a speech bubble whose lines get meaner as the
 * multiplier climbs, and it closes in on her with the tension (the
 * anticipation the shatter pays off). An accepted exit sends it sulking back
 * to the shore; the crash brings it down over the hole to read the verdict.
 * Nothing here changes the committed outcome: it only reads the view.
 */
import { endurance } from './endurance';
import { type Spring, clamp, settleSpring, spring, stepSpring } from './motion';

const INK = '#1c1f26';
const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** Where it hovers at rest (screen x), how far it comes in for her at full tension, and how low it gets. */
const HOME_X = 760;
const CLOSE_X = 440;
const HOME_Y = 148;
/** How long a line stays up. */
const LINE_S = 3.4;

export interface EngineState {
  x: Spring;
  y: Spring;
  tilt: Spring;
  bubble: Spring;
  line: string;
  lineAge: number;
  time: number;
  /** The red light's phase, integrated so its rate can follow the heat without jumping. */
  blink: number;
}

export interface EngineDrive {
  seconds?: number;
  running: boolean;
  crashed: boolean;
  tension: number;
  /** She is off the ice, or on her way. */
  safe: boolean;
  /** Screen x of the hole once the ice has gone, and hers when she watches the next long go in from the bank. */
  holeX: number | null;
  clearOf: number | null;
  /** What it is saying now. */
  line: string;
}

export function createEngine(): EngineState {
  return { x: spring(HOME_X), y: spring(HOME_Y), tilt: spring(0), bubble: spring(0), line: '', lineAge: LINE_S, time: 0, blink: 0 };
}

/**
 * The line the engine has for a round this far along: it keeps the same ladder as the captions. `exit` is the
 * accepted exit multiplier, for its sour grapes as the round runs on without her; `anon` is a spectator.
 */
export function engineLine(phase: 'waiting' | 'betting' | 'running' | 'crashed', multiplier: number, exit: number | null, outcome: 'rekt' | 'called' | 'crack' | null, anon: boolean): string {
  if (outcome) return outcome === 'rekt' ? 'LIQUIDATED. HAVE A NICE DAY' : outcome === 'called' ? 'SHE GOT AWAY. NEXT.' : 'ANOTHER ONE. NEXT, ANON?';
  if (phase !== 'running') return anon ? 'JUST WATCHING, ANON?' : "SYSTEM ONLINE. WHO'S NEXT?";
  if (exit !== null) {
    const regret = multiplier / exit;
    return regret < 1.25 ? 'ORDER CLOSED. UGH. FINE.' : regret < 2 ? 'PAPER HANDS. SAD!' : regret < 4 ? 'IT KEEPS PUMPING, JEET' : 'STILL GOING. NO REGRETS?';
  }
  if (multiplier < 1.3) return anon ? 'GM ANON. ENJOY THE SHOW' : 'GM. I SEE YOU.';
  if (multiplier < 1.7) return 'MAINTENANCE MARGIN: VIBES';
  if (multiplier < 2.5) return "ADD COLLATERAL. OR DON'T.";
  if (multiplier < 4) return 'FUNDING RATE: ONE KIDNEY';
  if (multiplier < 7) return 'LOADING THE ICE SAW';
  if (multiplier < 12) return 'YOUR MOM HAS BEEN NOTIFIED';
  if (multiplier < 25) return 'LIQUIDATING IN 3… 2…';
  return 'SHE IS… UNLIQUIDATABLE?!';
}

function target(drive: EngineDrive): { x: number; y: number } {
  // Over the hole it reads the verdict from the side with more room (away from her, if she is watching from the bank),
  // far enough out that its bubble clears the REKT.
  if (drive.crashed && drive.holeX !== null && !drive.safe) {
    const right = drive.clearOf !== null ? drive.clearOf < drive.holeX : drive.holeX < 480;
    return { x: clamp(drive.holeX + (right ? 310 : -310), 150, 810), y: 150 };
  }
  if (drive.safe || !drive.running) return { x: HOME_X, y: HOME_Y };
  const act = endurance(drive.seconds ?? 0);
  return { x: HOME_X - (HOME_X - CLOSE_X) * drive.tension + (act.act === 1 ? -70 : act.act === 3 ? 110 : 0) * act.effort,
    y: HOME_Y + 24 * drive.tension + (act.act === 2 ? 72 : act.act === 4 ? 38 : 0) * act.effort };
}

/** How worked up it is: the tension while she skates, full at the crash. */
const heatOf = (drive: EngineDrive): number => drive.running ? drive.tension : drive.crashed ? 1 : 0;

/** Jumps to where a round already under way has it, its line already said. */
export function settleEngine(e: EngineState, drive: EngineDrive): void {
  const t = target(drive);
  settleSpring(e.x, t.x);
  settleSpring(e.y, t.y);
  settleSpring(e.tilt, 0);
  settleSpring(e.bubble, 0);
  e.line = drive.line;
  e.lineAge = LINE_S;
}

/** Steps the hover; true when it just started a new line (for its squawk). */
export function stepEngine(e: EngineState, drive: EngineDrive, dt: number): boolean {
  e.time += dt;
  e.blink += dt * (4 + 16 * heatOf(drive));
  const t = target(drive);
  const vx = e.x.v;
  stepSpring(e.x, t.x, 2.2, 0.75, dt);
  stepSpring(e.y, t.y, 2.6, 0.7, dt);
  // It leans into its own motion, and shakes with anger the closer it gets.
  stepSpring(e.tilt, clamp(vx * 0.0012, -0.3, 0.3) + (drive.running ? Math.sin(e.time * 17) * 0.05 * drive.tension : 0), 8, 0.6, dt);
  let spoke = false;
  if (drive.line !== e.line) {
    e.line = drive.line;
    e.lineAge = 0;
    e.bubble.v = 12;
    spoke = true;
  }
  e.lineAge += dt;
  stepSpring(e.bubble, e.lineAge < LINE_S ? 1 : 0, 14, 0.5, dt);
  return spoke;
}

export function drawEngine(ctx: CanvasRenderingContext2D, e: EngineState, drive: EngineDrive): void {
  const bob = Math.sin(e.time * 2.3) * 3 + Math.sin(e.time * 5.1) * 1.2;
  const x = e.x.x;
  const y = e.y.x + bob;
  const heat = heatOf(drive);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(e.tilt.x);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Rotor arms and the blur of the rotors.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-30, -6); ctx.lineTo(30, -6); ctx.stroke();
  ctx.fillStyle = 'rgba(200, 215, 235, 0.55)';
  for (const rx of [-30, 30]) {
    const spin = e.time * 40;
    ctx.beginPath(); ctx.ellipse(rx, -9, 16, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(rx - Math.cos(spin) * 14, -9 - Math.sin(spin) * 2); ctx.lineTo(rx + Math.cos(spin) * 14, -9 + Math.sin(spin) * 2); ctx.stroke();
  }
  // Body: a dark box with the eye, a red light that runs faster the closer it is.
  ctx.fillStyle = '#2b3442';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-22, -8, 44, 20, 5); ctx.fill(); ctx.stroke();
  const blink = 0.55 + 0.45 * Math.sin(e.blink);
  ctx.fillStyle = `rgba(255, 60, 60, ${0.35 + 0.65 * blink})`;
  ctx.beginPath(); ctx.arc(14, -12, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9fd3ff';
  ctx.beginPath(); ctx.arc(-8, 2, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = `rgb(${Math.round(120 + 135 * heat)}, ${Math.round(40 + 60 * (1 - heat))}, 60)`;
  ctx.beginPath(); ctx.arc(-8 - 1.5 * heat, 2, 2.2, 0, Math.PI * 2); ctx.fill();
  // The loudhailer, aimed down the lake at her.
  ctx.save();
  ctx.translate(-22, 6);
  ctx.rotate(0.35 + 0.25 * heat);
  ctx.fillStyle = '#c9d1d9';
  ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(-20, -11); ctx.lineTo(-20, 11); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e63946';
  ctx.beginPath(); ctx.rect(-4, -4, 5, 8); ctx.fill();
  if (e.lineAge < 0.9) {
    // Sound rings while it is talking.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k += 1) {
      const p = ((e.lineAge * 2.2 + k / 3) % 1);
      ctx.globalAlpha = 1 - p;
      ctx.beginPath(); ctx.arc(-20, 0, 10 + p * 26, Math.PI * 0.7, Math.PI * 1.3); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // The name plate under the body.
  ctx.fillStyle = '#ffe27a';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-38, 14, 76, 13, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `900 9px ${MEME_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LIQUIDATION ENGINE', 0, 20.5, 70);
  ctx.restore();
  // The speech bubble, under and to the left of the drone, over the far shore, clear of the HUD above.
  const k = clamp(e.bubble.x, 0, 1.2);
  if (k > 0.03 && e.line) {
    ctx.save();
    ctx.font = `900 13px ${MEME_FONT}`;
    const w = Math.min(320, ctx.measureText(e.line).width) + 18;
    const bx = clamp(x - 30, w / 2 + 12, 960 - w / 2 - 12);
    const by = y + 52;
    ctx.translate(bx, by);
    ctx.scale(k, k);
    ctx.fillStyle = 'rgba(20, 24, 36, 0.92)';
    ctx.strokeStyle = heat > 0.66 ? '#ff4d6d' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-w / 2, -12, w, 24, 6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(clamp(x - bx, -w / 2 + 12, w / 2 - 12) - 6, -12); ctx.lineTo(clamp(x - bx, -w / 2 + 12, w / 2 - 12), -22); ctx.lineTo(clamp(x - bx, -w / 2 + 12, w / 2 - 12) + 6, -12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = heat > 0.66 ? '#ff9db0' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.line, 0, 1, w - 14);
    ctx.restore();
  }
}
