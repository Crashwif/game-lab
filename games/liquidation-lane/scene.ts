/** First-person financial irresponsibility. The room supplies every result and accepted exit. */
import { pageAudio } from './audio';
import { CYAN, FONT, LIME, MONO, PINK, line, panel, text } from './art';
import { drawCockpit, drawDamage, type CockpitView } from './cockpit';
import { clamp, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { drawRoad } from './road';
import { engineSound } from './sound';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number;
  elapsed: number;
  crashAge: number;
  stake: number | null;
  cashoutX100: number | null;
  payout: number | null;
}
export interface SceneOptions { reducedMotion?: boolean }
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void; dispose(): void }

const STAGES = [
  { at: 1, caption: 'ENGINE ON. BRAIN OFF.', alert: 'TRACTION CONTROL', detail: 'UNINSTALLED FOR THE CULTURE.' },
  { at: 1.3, caption: 'BRAKES ARE A BEARISH SIGNAL.', alert: 'MOM IS CALLING', detail: 'SHE DOES NOT UNDERSTAND THE VISION.' },
  { at: 1.8, caption: 'MY RISK MANAGER IS A FROG.', alert: 'PORTFOLIO DIVERSIFIED', detail: '100% CAR. 0% COMMON SENSE.' },
  { at: 2.7, caption: 'DAD\'S PENSION HAS ENTERED THE CHAT.', alert: 'SEC ENTERED THE LOBBY', detail: 'THEY ARE NOT HERE FOR A SELFIE.' },
  { at: 4, caption: 'THE SELL BUTTON IS A SOCIAL CONSTRUCT.', alert: 'MARGIN CALL INCOMING', detail: 'DECLINED. BAD VIBES.' },
  { at: 6, caption: 'THIS IS A GENERATIONAL BAD DECISION.', alert: 'CHECK ENGINE', detail: 'CHECK YOUR ENTIRE LIFE, ACTUALLY.' },
  { at: 10, caption: 'INSIDER TRADING. OUTSIDE THE SPEED LIMIT.', alert: 'INSURANCE CANCELLED', detail: 'EVEN THEY HAVE A STOP LOSS.' },
  { at: 20, caption: 'YOUR NET WORTH HAS NO CRUMPLE ZONE.', alert: 'PHYSICS HAS LOGGED ON', detail: 'YOU CANNOT BLOCK THIS ACCOUNT.' },
] as const;

function caption(ctx: CanvasRenderingContext2D, message: string, colour: string): void {
  ctx.font = `900 23px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#080e1c'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
  ctx.strokeText(message, 480, 297, 670); ctx.fillStyle = colour; ctx.fillText(message, 480, 297, 670);
}

function hud(ctx: CanvasRenderingContext2D, view: SceneView, car: CockpitView, stage: number, alertAge: number, exit: number): void {
  text(ctx, 'DEGEN MOTORSPORT DIVISION', 78, 26, 9, LIME, 'left', undefined, MONO);
  text(ctx, 'LIQUIDATION LANE', 77, 51, 27, '#f2f3e4', 'left', 370);
  text(ctx, 'LAMBOS. LEVERAGE. LAST WORDS.', 79, 77, 9, '#b4c9d0', 'left', undefined, MONO);
  panel(ctx, 464, 19, 116, 23, '#131b29', '#566163', 4);
  text(ctx, car.cashout !== null ? 'BAG SECURED' : car.crashed ? 'SIGNAL LOST' : car.running ? 'LIVE • FULL SEND' : 'AWAITING SEND', 522, 31, 8, car.crashed && car.cashout === null ? PINK : LIME, 'center', 106, MONO);
  if (car.cashout !== null) {
    caption(ctx, exit < 0.9 ? 'TAKING THE OFFSHORE EXIT.' : 'PAPER HANDS. CAR INTACT.', LIME);
    panel(ctx, 362, 99, 229, 36, '#172922', '#648750', 5);
    text(ctx, `${view.payout !== null ? `+${view.payout} CREDITS · ` : ''}${car.cashout.toFixed(2)}×`, 476, 117, 15, LIME, 'center', 215, MONO);
  } else if (car.crashed) {
    if (car.crashAge > 0.6) {
      ctx.save(); ctx.globalAlpha = smoothstep(0.6, 0.95, car.crashAge);
      panel(ctx, 298, 173, 366, 107, 'rgba(17, 13, 26, .94)', PINK, 7);
      text(ctx, 'LIQUIDATED', 480, 204, 39, '#ff527f', 'center', 347);
      text(ctx, `${car.multiplier.toFixed(2)}×  //  INSURANCE SAID LOL.`, 480, 242, 13, '#fff0d7', 'center', 340, MONO);
      ctx.restore();
    }
    caption(ctx, car.crashAge < 0.6 ? 'OH, THAT\'S A WALL.' : 'YOUR LAMBO IS NOW A SHITCOIN.', '#ffe9d5');
  } else {
    caption(ctx, car.running ? STAGES[stage]!.caption : 'ENGINE ON. BRAIN OFF.', '#f0ffcf');
    if (!car.running) {
      panel(ctx, 332, 195, 292, 56, '#141e2bdf', '#657162', 5);
      text(ctx, 'WEN LAMBO? RIGHT NOW.', 478, 214, 18, LIME, 'center');
      text(ctx, 'JOIN THE ROUND. CASH OUT BEFORE THE WRECK.', 478, 237, 8, '#bfcad0', 'center', 274, MONO);
    } else if (alertAge < 4) {
      const alert = STAGES[stage]!;
      ctx.save(); ctx.globalAlpha = Math.min(1, (4 - alertAge) * 2);
      panel(ctx, 93, 187, 239, 52, 'rgba(11, 20, 34, .91)', stage > 3 ? PINK : CYAN, 5);
      ctx.fillStyle = stage > 3 ? PINK : CYAN; ctx.fillRect(94, 198, 3, 29);
      text(ctx, alert.alert, 108, 203, 12, stage > 3 ? PINK : CYAN, 'left', 211);
      text(ctx, alert.detail, 108, 224, 7.5, '#d6e3d8', 'left', 211, MONO);
      ctx.restore();
    }
  }
  if (car.running || car.crashed) text(ctx, `ROUND ${car.multiplier.toFixed(2)}×`, 873, 172, 9, '#eef2d6', 'right', undefined, MONO);
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'phonk', bpm: 132, tempoRise: 0.3, crash: 'shatter', music: 0.58 });
  const engine = engineSound(audio);
  const speed = spring(0), steering = spring(0), parked = spring(0);
  let previous: SceneView['phase'] | null = null;
  let last: number | null = null;
  let time = 0, distance = 0, crashAge = 0;
  let secured: number | null = null;
  let stage = 0, alertAge = 10, lastGear = 1;
  let impactPlayed = false;

  function reset(): void {
    settleSpring(speed, 0); settleSpring(steering, 0); settleSpring(parked, 0);
    distance = 0; crashAge = 0; secured = null; stage = 0; alertAge = 10; lastGear = 1; impactPlayed = false;
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now; time += dt; alertAge += dt;
    const first = previous === null;
    const running = view.phase === 'running', crashed = view.phase === 'crashed';
    const multiplier = Math.max(1, view.currentX100 / 100);
    const growth = Math.log2(multiplier);
    const tension = clamp(1 - Math.exp(-growth / 2.3), 0, 1);
    const targetSpeed = 64 + growth * 91;
    if (view.phase === 'betting' && previous !== 'betting') reset();
    if (view.cashoutX100 !== null && secured === null) {
      secured = view.cashoutX100 / 100;
      if (first || crashed) { settleSpring(parked, 1); settleSpring(speed, 0); }
      else { audio.cashout(); audio.fx('whoosh', 0.6); }
    }
    if (first && running && secured === null) {
      settleSpring(speed, targetSpeed);
      distance = view.elapsed / 1000 * targetSpeed * 1.25;
    }
    if (crashed && previous !== 'crashed') {
      const quiet = first || view.crashAge > 1500;
      crashAge = quiet ? Math.max(3, view.crashAge / 1000) : 0;
      impactPlayed = quiet || secured !== null;
      if (quiet) { settleSpring(speed, 0); settleSpring(steering, 0.7); }
      if (secured === null) {
        audio.crash('scratch', quiet);
      } else audio.crash('crowd', true);
    } else if (crashed) crashAge += dt;
    if (crashed && secured === null && !impactPlayed && crashAge >= 0.42) {
      audio.fx('shatter', 0.85); audio.fx('thud', 0.8); impactPlayed = true;
    }
    if (running && previous !== 'running' && !first) alertAge = 0;
    previous = view.phase;
    const nextStage = Math.max(0, STAGES.filter(s => multiplier >= s.at).length - 1);
    if (running && nextStage > stage) {
      stage = nextStage; alertAge = 0;
      if (secured === null) { audio.milestone(stage); audio.fx(stage === 3 ? 'siren' : 'notify', 0.45); }
    }
    const driving = running && secured === null;
    stepSpring(speed, driving ? targetSpeed : 0, crashed ? 7 : secured !== null ? 3.5 : 2.5, 1, dt);
    stepSpring(parked, secured === null ? 0 : 1, 3, 1, dt);
    const steer = driving ? Math.sin(time * (0.9 + tension)) * (0.09 + tension * 0.3) + (reduced ? 0 : Math.sin(time * 7) * tension ** 3 * 0.2) : secured !== null ? Math.sin(parked.x * Math.PI) * -1.15 : crashed ? 0.7 : 0;
    stepSpring(steering, steer, 8, 0.85, dt);
    distance += Math.max(0, speed.x) * dt * 1.45;
    const gear = Math.min(7, 1 + Math.floor(growth / 0.65));
    if (driving && gear > lastGear) audio.fx('engine', 0.3);
    lastGear = gear;
    engine.update(driving ? 0.3 + (growth / 0.65 % 1) * 0.6 : 0.1, driving || view.phase === 'betting' || view.phase === 'waiting');
    audio.update(view.phase, secured === null ? tension : 0.05);

    const car: CockpitView = { time, tension, speed: Math.max(0, speed.x), multiplier, gear, steering: steering.x, crashAge, crashed, cashout: secured, running, reduced };
    const wreck = crashed && secured === null;
    ctx.save();
    if (!reduced) {
      const shake = wreck ? Math.exp(-crashAge * 3) * 10 : driving ? tension ** 3 * 1.9 : 0;
      ctx.translate(Math.sin(time * 73) * shake, Math.cos(time * 59) * shake * 0.65);
    }
    drawRoad(ctx, { time, distance, tension, steering: steering.x, wreck: wreck ? smoothstep(0, 0.65, crashAge) : 0, parked: parked.x, reduced });
    if (driving && tension > 0.3 && !reduced) {
      ctx.save(); ctx.globalAlpha = tension * 0.15;
      for (let i = 0; i < 20; i += 1) {
        const angle = noise(i * 3) * Math.PI * 2;
        const r = 150 + ((time * (160 + tension * 220) + i * 69) % 480);
        line(ctx, [[480 + Math.cos(angle) * r, 157 + Math.sin(angle) * r * 0.55], [480 + Math.cos(angle) * (r + 45), 157 + Math.sin(angle) * (r + 45) * 0.55]], '#e8dbe3', 1.5);
      }
      ctx.restore();
    }
    drawCockpit(ctx, car); drawDamage(ctx, car);
    if (wreck && crashAge >= 0.42 && crashAge < 0.75) {
      ctx.fillStyle = `rgba(255, 204, 160, ${(1 - (crashAge - 0.42) / 0.33) * (reduced ? 0.07 : 0.28)})`;
      ctx.fillRect(0, 0, 960, 540);
    }
    ctx.restore();
    hud(ctx, view, car, stage, alertAge, parked.x);
  }
  return { draw, dispose: engine.dispose };
}
