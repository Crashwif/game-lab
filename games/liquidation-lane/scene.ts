/** First-person financial irresponsibility. The room supplies every result and accepted exit. */
import { pageAudio, type Effect } from './audio';
import { CYAN, FONT, LIME, MONO, PINK, line, panel, text } from './art';
import { drawCockpit, drawDamage, type CockpitView } from './cockpit';
import { clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { createTraffic, drawRoad, drawTow, nearMiss, roadBend, stepTraffic } from './road';
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
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void; dispose(): void }

/** Dense early beats: most rounds end before 3×, so something new lands every couple of seconds until then. */
const STAGES: readonly { at: number; caption: string; alert: string; detail: string; cue?: Effect }[] = [
  { at: 1, caption: 'ENGINE ON. BRAIN OFF.', alert: 'TRACTION CONTROL', detail: 'UNINSTALLED FOR THE CULTURE.' },
  { at: 1.15, caption: 'BRAKES ARE A BEARISH SIGNAL.', alert: 'MOM IS CALLING', detail: 'SHE DOES NOT UNDERSTAND THE VISION.', cue: 'phone' },
  { at: 1.3, caption: 'SEATBELTS ARE FOR PAPER HANDS.', alert: 'SEC IN THE MIRROR', detail: 'OBJECTS IN MIRROR ARE CLOSER THAN THEY APPEAR.' },
  { at: 1.5, caption: 'MY RISK MANAGER IS A FROG.', alert: 'PORTFOLIO DIVERSIFIED', detail: '100% CAR. 0% COMMON SENSE.' },
  { at: 1.75, caption: 'STOP LOSS? NEVER HEARD OF HER.', alert: 'LEVERAGE RAISED', detail: 'RISK DISCLOSURE SKIPPED. FONT TOO SMALL.' },
  { at: 2.1, caption: 'DAD\'S PENSION HAS ENTERED THE CHAT.', alert: 'SEC ENTERED THE LOBBY', detail: 'THEY ARE NOT HERE FOR A SELFIE.', cue: 'siren' },
  { at: 2.5, caption: 'THE SELL BUTTON IS A SOCIAL CONSTRUCT.', alert: 'MARGIN CALL INCOMING', detail: 'DECLINED. BAD VIBES.', cue: 'phone' },
  { at: 3, caption: 'THIS IS A GENERATIONAL BAD DECISION.', alert: 'CHECK ENGINE', detail: 'CHECK YOUR ENTIRE LIFE, ACTUALLY.' },
  { at: 4.5, caption: 'FUNDING RATE: YES.', alert: 'GAS FEES > CAR', detail: 'STILL CHEAPER THAN THERAPY.' },
  { at: 7, caption: 'INSIDER TRADING. OUTSIDE THE SPEED LIMIT.', alert: 'INSURANCE CANCELLED', detail: 'EVEN THEY HAVE A STOP LOSS.' },
  { at: 20, caption: 'YOUR NET WORTH HAS NO CRUMPLE ZONE.', alert: 'PHYSICS HAS LOGGED ON', detail: 'YOU CANNOT BLOCK THIS ACCOUNT.' },
  { at: 60, caption: 'WE ARE SO BACK. WE CANNOT STOP.', alert: 'SPEEDOMETER DEPEGGED', detail: 'KM/H IS A LEGACY UNIT.' },
  { at: 300, caption: 'FEW UNDERSTAND THIS SPEED.', alert: 'HELICOPTER FILED A REPORT', detail: 'IT JUST SAYS "LMAO".' },
  { at: 2000, caption: 'ESCAPE VELOCITY. STILL NO SEATBELT.', alert: 'LAMBO.EXE NOT RESPONDING', detail: 'ALL CONVICTION. NO TRACTION.' },
];
/** After a cash-out, keyed to how far the round has run past your exit. */
const REGRET = [
  [1.2, 'PAPER HANDS. CAR INTACT.'],
  [1.6, 'JEETED. STILL HAVE A CAR THOUGH.'],
  [2.5, 'THEY\'RE STILL SENDING. YOU\'RE STILL SOLVENT.'],
  [5, 'MILD REGRET. FULL WINDSHIELD.'],
  [Infinity, 'SOLD EARLY. KEPT BOTH KIDNEYS.'],
] as const;
/** Gears 2 to 7 engage at these multipliers; top gear then revs into the limiter at LIMIT. */
const SHIFTS = [1.1, 1.35, 1.65, 2.05, 3.4, 7], LIMIT = 25;
const IMPACT = 0.42, HIT_STOP = 0.14, TOW = 0.9;

function drivetrain(multiplier: number): { gear: number; rpm: number } {
  const gear = 1 + SHIFTS.filter(at => multiplier >= at).length;
  const low = SHIFTS[gear - 2] ?? 1, high = SHIFTS[gear - 1] ?? LIMIT;
  return { gear, rpm: 0.3 + 0.65 * clamp(Math.log(multiplier / low) / Math.log(high / low), 0, 1) };
}

function caption(ctx: CanvasRenderingContext2D, message: string, colour: string, scale = 1): void {
  ctx.save(); ctx.translate(480, 297); ctx.scale(scale, scale);
  ctx.font = `900 23px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#080e1c'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
  ctx.strokeText(message, 0, 0, 670); ctx.fillStyle = colour; ctx.fillText(message, 0, 0, 670);
  ctx.restore();
}

/** `dodged` is the valet sign's line once a round dies after your exit; it stays until the next round starts. */
interface Hud { stage: number; alertAge: number; exit: number; towAge: number; dodged: string | null; miss: number }

function hud(ctx: CanvasRenderingContext2D, view: SceneView, car: CockpitView, h: Hud): void {
  const spectator = view.stake === null, m = car.multiplier.toFixed(2);
  text(ctx, 'DEGEN MOTORSPORT DIVISION', 78, 26, 9, LIME, 'left', undefined, MONO);
  text(ctx, 'LIQUIDATION LANE', 77, 51, 27, '#f2f3e4', 'left', 370);
  text(ctx, 'LAMBOS. LEVERAGE. LAST WORDS.', 79, 77, 9, '#b4c9d0', 'left', undefined, MONO);
  panel(ctx, 464, 19, 116, 23, '#131b29', '#566163', 4);
  const status = car.cashout !== null ? (car.crashed ? 'DODGED' : 'BAG SECURED') : car.crashed ? (spectator ? 'CLIP SAVED' : 'SIGNAL LOST') : car.running ? (spectator ? 'PASSENGER PRINCESS' : 'LIVE • FULL SEND') : spectator ? 'AWAITING SEND' : 'LAUNCH CONTROL';
  text(ctx, status, 522, 31, 8, car.crashed && car.cashout === null ? PINK : LIME, 'center', 106, MONO);
  // The valet sign fades with the exit lane, including the merge back after a dodged round.
  const valet = car.cashout !== null ? clamp((h.exit - 0.35) * 2, 0, 1) : clamp((h.exit - 0.6) * 4, 0, 1);
  if (valet > 0) {
    const dodged = h.dodged !== null && !(car.crashed && car.crashAge <= 0.6);
    ctx.save(); ctx.globalAlpha = valet;
    panel(ctx, 346, 179, 277, 76, '#12332b', '#8bdd7e', 5);
    text(ctx, dodged ? 'DODGED' : 'OFFSHORE VALET', 484, 202, 23, LIME, 'center');
    text(ctx, dodged ? h.dodged! : 'PAPER HANDS. LEATHER SEATS.', 484, 232, 12, '#d2e2ca', 'center', 262);
    ctx.restore();
  }
  if (car.cashout !== null) {
    const regret = REGRET.find(([below]) => car.multiplier / car.cashout! < below)![1];
    caption(ctx, car.crashed ? (car.crashAge < IMPACT ? 'NGMI JUST HIT 100% SLIPPAGE.' : 'THEIR LAMBO: LIQUIDATED. YOU: VALET TICKET.') : h.exit < 0.9 ? 'TAKING PROFITS. TAKING THE OFFSHORE EXIT.' : regret, LIME);
    panel(ctx, 362, 99, 229, 36, '#172922', '#648750', 5);
    text(ctx, `${view.payout !== null ? `+${view.payout} CREDITS · ` : ''}${car.cashout.toFixed(2)}×`, 476, 117, 15, LIME, 'center', 215, MONO);
  } else if (car.crashed) {
    const instant = car.multiplier < 1.01;
    if (car.crashAge > 0.6) {
      ctx.save(); ctx.globalAlpha = smoothstep(0.6, 0.95, car.crashAge);
      panel(ctx, 298, 173, 366, 107, 'rgba(17, 13, 26, .94)', PINK, 7);
      text(ctx, spectator ? 'TOTALLED' : 'LIQUIDATED', 480, 204, 39, '#ff527f', 'center', 347);
      text(ctx, `${m}×  //  ${instant ? 'DIDN\'T EVEN LEAVE THE LOT.' : spectator ? 'PASSENGER PRINCESS UNHARMED.' : 'INSURANCE SAID LOL.'}`, 480, 242, 13, '#fff0d7', 'center', 340, MONO);
      ctx.restore();
    }
    caption(ctx, car.crashAge < IMPACT ? 'SLIPPAGE: 100%.' : car.crashAge < 1 ? 'OH, THAT\'S A WALL.' : instant ? 'LIQUIDATED IN THE PARKING LOT.' : spectator ? 'SOMEONE ELSE\'S LAMBO. GREAT CONTENT.' : 'YOUR LAMBO IS NOW A SHITCOIN.', '#ffe9d5');
  } else if (!car.running) {
    caption(ctx, h.towAge < 2 ? (h.dodged === null ? 'NEW LAMBO. SAME DRIVER.' : 'SAME LAMBO. NEW ROUND.') : 'ENGINE ON. BRAIN OFF.', '#f0ffcf');
    ctx.save(); ctx.globalAlpha = 1 - valet;
    panel(ctx, 332, 195, 292, 56, '#141e2bdf', '#657162', 5);
    text(ctx, spectator ? 'WEN LAMBO? RIGHT NOW.' : 'SEATBELT? NFA.', 478, 214, 18, LIME, 'center');
    text(ctx, spectator ? 'JOIN THE ROUND. CASH OUT BEFORE THE WRECK.' : 'YOU\'RE IN. CASH OUT BEFORE THE STOP LOSS.', 478, 237, 8, '#bfcad0', 'center', 274, MONO);
    ctx.restore();
  } else {
    const near = h.miss >= 0.66, fresh = 1 + 0.12 * (1 - (near ? smoothstep(0.66, 0.72, h.miss) : smoothstep(0, 0.22, h.alertAge)));
    caption(ctx, near ? 'NEAR MISS. STILL SENDING.' : STAGES[h.stage]!.caption, '#f0ffcf', fresh);
    if (h.alertAge < 4) {
      const alert = STAGES[h.stage]!, colour = alert.at >= 2.1 ? PINK : CYAN;
      ctx.save(); ctx.globalAlpha = Math.min(1, h.alertAge * 6, (4 - h.alertAge) * 2);
      ctx.translate(-26 * (1 - smoothstep(0, 0.25, h.alertAge)), 0);
      panel(ctx, 93, 187, 239, 52, 'rgba(11, 20, 34, .91)', colour, 5);
      ctx.fillStyle = colour; ctx.fillRect(94, 198, 3, 29);
      text(ctx, alert.alert, 108, 203, 12, colour, 'left', 211);
      text(ctx, alert.detail, 108, 224, 7.5, '#d6e3d8', 'left', 211, MONO);
      ctx.restore();
    }
  }
  if (car.running || car.crashed) text(ctx, `ROUND ${m}×`, 873, 172, 9, '#eef2d6', 'right', undefined, MONO);
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'phonk', bpm: 132, tempoRise: 0.3, crash: 'shatter', music: 0.58 });
  const engine = engineSound(audio);
  const speed = spring(0), steering = spring(0), parked = spring(0);
  const headRoll = spring(0), headPitch = spring(0);
  const traffic = createTraffic();
  let previous: SceneView['phase'] | null = null;
  let last: number | null = null;
  // `time` is a dt-integrated ambient clock that never jumps; round beats read the room's elapsed time instead.
  let time = 0, distance = 0, crashAge = 0;
  let secured: number | null = null, wrecked = true, dodged: string | null = null;
  let stage = 0, alertAge = 10, lastGear = 1, shiftAge = 1, limiter = 0;
  let impactPlayed = false, hitStop = 0, impactAge = 9, towAge = 9;
  let heli = 0, cops = 0, live = 0, cruise = 64, streak = 0, beat = 0, pulse = 0, rocket = -1;
  let miss = { k: -1, p: 0 }, tunnel = { k: -1, from: 0, to: -1 };

  // reset() leaves the last round's wreck, dodge and tunnel for the tow truck to clear during the lobby.
  function reset(): void {
    settleSpring(speed, 0);
    secured = null; stage = 0; alertAge = 10; lastGear = 1; impactPlayed = false; hitStop = 0; beat = 0;
    miss = { k: -1, p: 0 };
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const raw = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // Hit-stop: the world holds for a beat at impact while the camera keeps punching.
    const frozen = Math.min(hitStop, raw);
    hitStop -= frozen;
    const dt = raw - frozen;
    time += raw; alertAge += dt; shiftAge += dt; impactAge += raw; towAge += raw;
    const first = previous === null;
    const running = view.phase === 'running', crashed = view.phase === 'crashed', idle = !running && !crashed;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const growth = Math.log2(multiplier);
    // 1 - 1/x sweeps 0 to 0.67 across the 1×-3× window where most rounds end; the log-based pace keeps long rounds changing.
    const tension = 1 - 1 / multiplier;
    const deep = clamp(Math.log10(multiplier) / 3, 0, 1);
    const pace = 64 + growth * 91;
    if (idle && previous !== 'betting' && previous !== 'waiting') {
      if (previous === 'crashed') towAge = 0;
      reset();
    } else if (running && previous === 'crashed') reset();
    if (view.cashoutX100 !== null && secured === null) {
      secured = view.cashoutX100 / 100;
      if (first || crashed) { settleSpring(parked, 1); settleSpring(speed, 0); }
      else { audio.cashout(); audio.fx('whoosh', 0.6); }
    }
    if (first && running && secured === null) {
      settleSpring(speed, pace);
      distance = view.elapsed / 1000 * pace * 1.25;
    }
    if (crashed && previous !== 'crashed') {
      const quiet = first || view.crashAge > 1500;
      crashAge = quiet ? Math.max(3, view.crashAge / 1000) : 0;
      wrecked = secured === null;
      dodged = secured === null ? null : `ROUND DIED AT ${multiplier.toFixed(2)}×. YOU LEFT AT ${secured.toFixed(2)}×.`;
      impactPlayed = quiet;
      if (quiet) { settleSpring(speed, 0); settleSpring(steering, wrecked ? 0.7 : 0); }
      if (wrecked) audio.crash('scratch', quiet);
      else audio.crash('crowd', true);
    } else if (crashed) crashAge += dt;
    if (crashed && !impactPlayed && crashAge >= IMPACT) {
      impactPlayed = true;
      if (wrecked) {
        audio.fx('shatter', 0.85); audio.fx('thud', 0.8);
        hitStop = HIT_STOP; impactAge = 0;
        { headPitch.v += 90; headRoll.v -= 1.4; }
      } else audio.fx('thud', 0.35);
    }
    if (running && previous !== 'running' && !first) { alertAge = 0; dodged = null; tunnel = { k: -1, from: 0, to: -1 }; }
    previous = view.phase;
    const nextStage = Math.max(0, STAGES.filter(s => multiplier >= s.at).length - 1);
    if (running && nextStage > stage) {
      stage = nextStage; alertAge = 0;
      if (!first && secured === null) { audio.milestone(stage); audio.fx(STAGES[stage]!.cue ?? 'notify', 0.45); }
    }
    const driving = running && secured === null;
    const roundTime = running || crashed ? view.elapsed / 1000 : -1;
    const { gear, rpm } = drivetrain(multiplier);
    if (driving && gear > lastGear && !first) {
      audio.fx('engine', 0.3); shiftAge = 0;
      headPitch.v += 60;
    }
    lastGear = gear;
    const limited = driving && rpm >= 0.95;
    limiter = limited ? limiter + dt * 9 : 0;
    const revs = driving ? rpm - (limited && limiter % 1 < 0.5 ? 0.07 : 0) : idle ? 0.12 + 0.3 * Math.max(0, Math.sin(time * 1.9)) ** 8 : 0.1;
    engine.update(revs, driving || idle);
    audio.update(view.phase, secured === null ? tension : 0.05);

    // Spectacle state is integrated so nothing pops on or off at a threshold or a phase change.
    const ease = (value: number, target: number, rate: number): number => first ? target : value + (target - value) * (1 - Math.exp(-rate * dt));
    live = ease(live, driving ? 1 : 0, 5);
    // Scripted near misses: tyres squeal as it cuts in, the camera sidesteps, and it whooshes past.
    const near = roundTime >= 0 ? nearMiss(roundTime) : null;
    if (near && driving) {
      const was = near.k === miss.k ? miss.p : first || near.p > 0.3 ? near.p : 0;
      if (was < 0.55 && near.p >= 0.55) audio.fx('squeak', 0.5);
      if (was < 0.85 && near.p >= 0.85) audio.fx('whoosh', 0.5);
      miss = { k: near.k, p: near.p };
    }
    // The camera sidesteps away from the intruder while the wheel jerks the other way.
    const swerve = near ? near.side * 0.45 * smoothstep(0.5, 0.66, near.p) * (1 - smoothstep(0.8, 1, near.p)) * live : 0;

    stepSpring(speed, driving ? pace : 0, crashed ? 7 : secured !== null ? 3.5 : 2.5, 1, dt);
    stepSpring(parked, secured === null ? 0 : 1, 3, 1, dt);
    const steer = driving ? roadBend(distance, tension) / 180 : secured !== null ? Math.sin(parked.x * Math.PI) * -1.15 : crashed ? 0.7 : 0;
    stepSpring(steering, steer, 8, 0.85, dt);
    const restingRoll = crashed && wrecked ? -0.12 : 0;
    if (first) settleSpring(headRoll, restingRoll);
    stepSpring(headRoll, restingRoll + (clamp(-steering.v * 0.07 - steering.x * Math.min(1, speed.x / 200) * 0.12 + swerve * 0.25, -0.18, 0.18)), 9, 0.65, dt);
    stepSpring(headPitch, clamp(-speed.v * 0.025, -4, 7), 11, 0.7, dt);
    distance += Math.max(0, speed.x) * dt * 1.45;
    // Traffic eases to the lobby's pace instead of braking in one frame when a long round ends.
    cruise = ease(cruise, pace, 1.5);
    stepTraffic(traffic, Math.max(0, speed.x), cruise, tension, dt);

    const heliTarget = idle ? 0 : smoothstep(0.32, 0.42, tension);
    heli = first ? heliTarget : clamp(heli + clamp(heliTarget - heli, -dt / 1.6, dt / 1.2), 0, 1);
    cops = ease(cops, secured === null && !idle ? smoothstep(0.22, 0.38, tension) : 0, 3);
    streak += dt * (160 + tension * 220);
    if (rocket >= 0) rocket += dt;
    if (rocket > mix(5.6, 3.6, deep)) rocket = -1;
    if (rocket < 0 && running && tension > 0.6) rocket = 0;
    if (driving && roundTime >= 60) {
      const k = Math.floor((roundTime - 60) / 40);
      if (k > tunnel.k) tunnel = first ? { k, from: 0, to: -1 } : { k, from: distance + 2100, to: distance + 2100 + speed.x * 10 };
    }
    // A LIQ PRICE proximity tick that speeds up with the multiplier while your money is on the road.
    if (driving) {
      beat += dt / mix(1.4, 0.35, tension);
      if (beat >= 1) { beat %= 1; pulse = 1; audio.fx('tick', 0.35 + 0.4 * tension); }
    }
    pulse = Math.max(0, pulse - dt * 4);

    // Your own wreck or a dodged one stays until the tow truck wipes it during the next lobby.
    const aftermath = crashed ? 1 : 1 - smoothstep(0.3, 0.6, towAge);
    const wreck = wrecked ? aftermath : 0;
    const jitter = (Math.sin(time * 7.3) + 0.6 * Math.sin(time * 12.1 + 1)) / 1.6 * (0.02 + 0.12 * tension * tension) * live;
    const ring = STAGES[stage]!.cue === 'phone' && driving && alertAge < 1.4 ? 1 : 0;
    const car: CockpitView = {
      time, tension, speed: Math.max(0, speed.x), multiplier, gear, rpm: driving || idle ? revs : 0, limiter: limited && limiter % 1 < 0.5,
      shift: 1 - clamp(shiftAge / 0.35, 0, 1), steering: steering.x + jitter - swerve, headRoll: headRoll.x, headPitch: headPitch.x,
      crashAge, crashed, wreck, cashout: secured, running, cops, pulse: pulse, ring,
    };
    ctx.save();
    {
      const after = crashAge - IMPACT;
      const shake = crashed && wrecked ? (after < 0 ? 3 : 12 * Math.exp(-after * 6)) : (0.4 + 2.6 * tension * tension) * live;
      const punch = crashed && wrecked ? 0.1 * (impactAge < 0.3 ? 1 : Math.exp(-(impactAge - 0.3) * 7)) : 0;
      // A constant 1% overscan keeps the frame edges covered while the camera shakes.
      const zoom = 1.01 + punch;
      ctx.translate(541, 220); ctx.scale(zoom, zoom); ctx.translate(-541, -220);
      ctx.translate(Math.sin(time * 73) * shake, Math.cos(time * 59) * shake * 0.65 + 2 * Math.sin(Math.PI * clamp(shiftAge / 0.12, 0, 1)));
    }
    drawRoad(ctx, {
      time, distance, tension, steering: steering.x + jitter + swerve, wreck: wrecked ? smoothstep(0, IMPACT, crashAge) : 0, parked: parked.x, cars: traffic,
      elapsed: roundTime, live, heli, rocket, tunnel, dodge: wrecked || aftermath <= 0 ? -1 : crashAge, aftermath,
    });
    if (live > 0 && tension > 0.3) {
      const count = 20 + Math.round(deep * 16);
      for (let i = 0; i < count; i += 1) {
        const angle = noise(i * 3) * Math.PI * 2, u = ((streak + i * 69) % 480) / 480, r = 150 + u * 480;
        ctx.globalAlpha = smoothstep(0.3, 0.6, tension) * 0.2 * live * Math.sin(u * Math.PI);
        line(ctx, [[480 + Math.cos(angle) * r, 157 + Math.sin(angle) * r * 0.55], [480 + Math.cos(angle) * (r + 45), 157 + Math.sin(angle) * (r + 45) * 0.55]], '#e8dbe3', 1.5);
      }
      ctx.globalAlpha = 1;
    }
    if (towAge < TOW) drawTow(ctx, towAge / TOW, time);
    drawCockpit(ctx, car); drawDamage(ctx, car);
    if (wreck > 0 && crashed && crashAge >= IMPACT && crashAge < 0.75) {
      ctx.fillStyle = `rgba(255, 204, 160, ${(1 - (crashAge - IMPACT) / 0.33) * (0.28)})`;
      ctx.fillRect(-60, -60, 1080, 660);
    }
    if (towAge < TOW) {
      ctx.fillStyle = `rgba(8, 10, 22, ${Math.sin(Math.PI * towAge / TOW) * (0.5)})`;
      ctx.fillRect(-60, -60, 1080, 660);
    }
    ctx.restore();
    hud(ctx, view, car, { stage, alertAge, exit: parked.x, towAge, dodged, miss: near ? near.p : -1 });
  }
  return { draw, dispose: engine.dispose };
}
