/**
 * Composes Boiler Room from the room state: the engine room, the boiler and
 * its machinery, the stoker and his shield, two layers of particles, the
 * blow-out (a short fuse, a hit-stop with a punch-in, slow motion and a
 * whiteout), then the HUD. All motion is stepped here with the real frame
 * time, and nothing drawn here changes the committed outcome: every warning
 * follows the displayed multiplier, never the crash point.
 */
import { pageAudio } from './audio';
import { DOME, type EngineDrive, type EngineState, blowEngine, createEngine, drawBoiler, drawMachine, drawMaintenance, resetEngine, settleEngine, stepEngine } from './engine';
import { clamp, mix, noise, smoothstep, spring, stepSpring } from './motion';
import { type Particles, createParticles, drawParticles, emit, fadeOut, sparks, stepParticles } from './particles';
import { type Sound, pageSound } from './sound';
import { type StokerState, bladePoint, blastStoker, callShield, createStoker, drawShield, drawShovelOnFloor, drawStoker, inFrontOfShield, settleStoker, standUp, startStoking, startle, stepStoker } from './stoker';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a blow-out missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** The sound to play; by default the page's own, which the Sound button turns on. */
  sound?: Sound;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const W = 960;
const H = 540;
const FLOOR_Y = 470;
const INK = '#1c1f26';
const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** The multiplier readout's right edge, and the width past which it is squeezed rather than run into the caption. */
const READOUT_X = 930;
const READOUT_MAX = 300;
/** The centre line of the caption and the secured badge. */
const CAPTION_X = 430;
/** The multipliers a milestone stinger plays at. */
const RUNGS = [1.3, 1.7, 2.5, 4, 7, 12, 25];
/** The crash is called: the needle slams and the whistle screams for this long before the valve goes. */
const FUSE_MS = 120;
/** The hit-stop at the blow-out, then the slow motion easing back to full speed. */
const FREEZE = 0.14;
const SLOW = 0.45;
/** The punch-in's centre: between the dome and the stoker, so both stay in frame. */
const PUNCH = { x: 360, y: 280 };
type Outcome = 'rekt' | 'called' | 'kaboom';
type Secured = { x100: number; payout: number | null };

/** Meme caption lettering: heavy, white, black-bordered. */
function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.13);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

/** The opening ladder gives way to an ongoing broadcast in unusually long rounds. */
const OVERTIME_CAPTIONS = ["THE NIGHT SHIFT CLOCKED IN", "COAL BUDGET: EXTENDED", "ANOTHER PRESSURE CHECK", "THE PRINTER NEEDS A HOLIDAY", "STEAM POWERED OVERTIME", "THE GAUGE RAN OUT OF NUMBERS", "SHIFT CHANGE: MORE RETAIL", "BRRR HAS NO OFF SWITCH"];

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome === 'called') return 'OFFSHORE BEFORE THE RAID';
  if (outcome) return view.currentX100 <= 100 ? 'RUGGED AT 0 PSI' : outcome === 'rekt' ? 'ABSOLUTELY COOKED' : 'MONEY PRINTER GO BOOM';
  if (view.phase !== 'running') return 'WEN PRINT?';
  if (secured) {
    // He jeeted, and it was the right call: the regret only creeps in as the printer keeps going without him.
    const regret = view.currentX100 / secured.x100;
    return regret < 1.25 ? 'JEETED OFFSHORE' : regret < 1.8 ? 'PROFIT TAKEN. NO REGRETS' : regret < 3 ? 'OK, A FEW REGRETS' : regret < 6 ? 'IT WAS A GOOD TRADE' : 'NOT CHECKING THE GAUGE';
  }
  if (view.elapsed >= 45_000) return OVERTIME_CAPTIONS[Math.floor((view.elapsed - 45_000) / 12_000) % OVERTIME_CAPTIONS.length]!;
  if (multiplier < 1.15) return 'SHOVEL IN THE RETAIL';
  if (multiplier < 1.3) return 'FIRE UP THE PRINTER';
  if (multiplier < 1.5) return 'PRINTER GO BRRR';
  if (multiplier < 1.7) return 'THAT HISS IS BULLISH';
  if (multiplier < 2) return 'MORE RETAIL, BOYS';
  if (multiplier < 2.5) return 'PROBABLY NOTHING';
  if (multiplier < 3) return 'SELL IT TO GRANDMA';
  if (multiplier < 4) return 'THE RED ZONE IS FUD';
  if (multiplier < 7) return 'INFINITE MONEY GLITCH';
  if (multiplier < 12) return 'COMPLIANCE IS ASLEEP';
  if (multiplier < 25) return 'PRINTER GO BRRRRRRRR';
  return 'HYPERINFLATION SPEEDRUN';
}

function drawRoom(ctx: CanvasRenderingContext2D, e: EngineState, time: number): void {
  const wall = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  wall.addColorStop(0, '#20242d');
  wall.addColorStop(1, '#343946');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, FLOOR_Y);
  // Overhead pipes with brackets.
  ctx.lineCap = 'round';
  for (const [y, width, colour] of [[42, 18, '#3d424e'], [80, 10, '#474c59']] as const) {
    ctx.strokeStyle = INK; ctx.lineWidth = width + 4;
    ctx.beginPath(); ctx.moveTo(-10, y); ctx.lineTo(W + 10, y); ctx.stroke();
    ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke();
    ctx.strokeStyle = '#5a606d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10, y - width * 0.3); ctx.lineTo(W + 10, y - width * 0.3); ctx.stroke();
    ctx.fillStyle = '#2b2f38';
    for (let x = 90; x < W; x += 180) { ctx.fillRect(x - 5, y - width / 2 - 4, 10, width + 8); }
  }
  // A barred window with a little daylight.
  ctx.fillStyle = '#5d7ea6';
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(120, 112, 70, 56, 4); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#2b2f38'; ctx.lineWidth = 3;
  for (const x of [143, 166]) { ctx.beginPath(); ctx.moveTo(x, 112); ctx.lineTo(x, 168); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(120, 140); ctx.lineTo(190, 140); ctx.stroke();
  // The house rules, hung crooked from a nail between the window and the chimney.
  ctx.save();
  ctx.translate(238, 124);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-18, 14); ctx.lineTo(0, 0); ctx.lineTo(18, 14); ctx.stroke();
  ctx.fillStyle = '#2b2f38';
  ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(-0.05);
  ctx.fillStyle = '#5a3d24'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-33, 10, 66, 42, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d6ccb0';
  ctx.fillRect(-28, 15, 56, 32);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `12px ${MEME_FONT}`;
  ctx.fillStyle = '#b8323f';
  ctx.fillText('NO KYC', 0, 29, 52);
  ctx.font = `10px ${MEME_FONT}`;
  ctx.fillStyle = INK;
  ctx.fillText('NO REFUNDS', 0, 42, 52);
  ctx.restore();
  // The hanging lamp swings with the engine's thumps and lights the wall.
  const swing = e.lamp.x;
  const lx = 770 + Math.sin(swing) * 70;
  const ly = 52 + Math.cos(swing) * 70;
  const light = ctx.createRadialGradient(lx, ly + 10, 6, lx, ly + 10, 210);
  light.addColorStop(0, 'rgba(255, 214, 140, 0.32)');
  light.addColorStop(1, 'rgba(255, 214, 140, 0)');
  ctx.fillStyle = light;
  ctx.fillRect(lx - 220, ly - 40, 440, 300);
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(770, 52); ctx.lineTo(lx, ly); ctx.stroke();
  ctx.fillStyle = '#3d424e'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(lx - 22, ly + 10); ctx.lineTo(lx - 8, ly - 6); ctx.lineTo(lx + 8, ly - 6); ctx.lineTo(lx + 22, ly + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath(); ctx.arc(lx, ly + 12, 6, 0, Math.PI * 2); ctx.fill();
  // Floor plates.
  ctx.fillStyle = '#3a3f4a';
  ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, FLOOR_Y); ctx.lineTo(W, FLOOR_Y); ctx.stroke();
  ctx.strokeStyle = '#2b2f38'; ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += 120) { ctx.beginPath(); ctx.moveTo(x, FLOOR_Y); ctx.lineTo(x, H); ctx.stroke(); }
  ctx.fillStyle = '#4c5260';
  for (let x = 20; x < W; x += 40) for (const y of [486, 516]) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); }
  // Firelight spilling onto the floor and the wall behind the door.
  const flame = clamp(e.flame, 0, 1.2);
  const spill = ctx.createRadialGradient(336, FLOOR_Y, 10, 336, FLOOR_Y, 220);
  spill.addColorStop(0, `rgba(255, 140, 50, ${0.35 * flame})`);
  spill.addColorStop(1, 'rgba(255, 120, 40, 0)');
  ctx.fillStyle = spill;
  ctx.fillRect(100, 300, 480, 240);
  void time;
}

function drawCoalPile(ctx: CanvasRenderingContext2D): void {
  // A stake driven into the pile's flank, the part in the coal hidden by it.
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(48, 468); ctx.lineTo(34, 418); ctx.stroke();
  ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.fillStyle = '#1b1b1f';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(40, FLOOR_Y); ctx.quadraticCurveTo(70, 400, 110, 412); ctx.quadraticCurveTo(150, 420, 168, FLOOR_Y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#34343a';
  for (let i = 0; i < 14; i += 1) {
    const x = 52 + noise(i * 1.3) * 108;
    const y = FLOOR_Y - 6 - noise(i * 2.1) * (40 - Math.abs(x - 110) * 0.35);
    ctx.beginPath(); ctx.arc(x, y, 3 + noise(i * 3.7) * 4, 0, Math.PI * 2); ctx.fill();
  }
  // What the coal really is: a crude plank on the stake, sprayed through a stencil.
  ctx.save();
  ctx.translate(31, 408);
  ctx.rotate(-0.14);
  ctx.fillStyle = '#9c7a52'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-25, -10); ctx.lineTo(23, -11); ctx.lineTo(25, 9); ctx.lineTo(-24, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-20, -7); ctx.lineTo(-8, -7.5); ctx.moveTo(10, 6.5); ctx.lineTo(20, 6); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `14px ${MEME_FONT}`;
  ctx.fillStyle = 'rgba(27, 27, 31, 0.3)';
  ctx.fillText('RETAIL', 0.8, 1.3, 42);
  ctx.fillStyle = '#1b1b1f';
  ctx.fillText('RETAIL', 0, 0.5, 42);
  ctx.restore();
}

function drawReadout(ctx: CanvasRenderingContext2D, view: SceneView, text: string, dead: boolean): void {
  const colour = dead ? '#ff4d6d' : view.phase === 'running' ? '#ffffff' : '#ffe08a';
  ctx.save();
  if (view.phase !== 'running' && !dead) ctx.globalAlpha = 0.85;
  memeText(ctx, text, READOUT_X, 80, 66, colour, 'right', READOUT_MAX);
  ctx.restore();
}

export function createScene(options: SceneOptions = {}): Scene {
  const audio = pageAudio({ style: 'techno', crash: 'boom', music: 0.55 });
  const sound = options.sound ?? pageSound(audio);
  const engine: EngineState = createEngine();
  const ps: Particles = createParticles();
  const stoker: StokerState = createStoker();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  /** Seconds since the valve went (real time), or -1: drives the hit-stop, the slow motion, the punch-in and the whiteout. */
  let impact = -1;
  let fusing = false;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';

  /** The safety valve lets go, at the end of the fuse or straight away for a crash met late. */
  function blow(x100: number, quiet: boolean): void {
    fusing = false;
    blowEngine(engine, ps, x100, quiet);
    blastStoker(stoker, quiet);
    if (quiet) pop.x = 1;
    else {
      shake = 1;
      pop.v = 16;
      impact = 0;
      sound.blast();
    }
    audio.crash('boom', quiet);
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The world's own time step: stopped for the hit-stop, then slowed and eased back to full speed.
    let wdt = dt;
    if (impact >= 0) {
      impact += dt;
      wdt = impact < FREEZE ? 0 : dt * mix(0.3, 1, smoothstep(FREEZE, FREEZE + SLOW, impact));
    }
    time += dt;
    if (view.phase === 'running') time = view.elapsed / 1000;
    if (view.phase === 'running') engine.time = stoker.time = view.elapsed / 1000;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const growth = Math.log2(multiplier);
    // Tension follows 1 − 1/x: 0.33 at 1.5×, 0.5 at 2×, 0.67 at 3×, 0.9 at 10×, so the window most rounds live in
    // visibly and audibly escalates. The log2 growth still drives what long rounds keep changing.
    const tension = 1 - 1 / multiplier;
    const fear = clamp((tension - 0.12) / 0.75, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null && !secured && (running || crashed)) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running) audio.cashout();
    }
    const drive: EngineDrive = { running, crashed, pressure: running || crashed ? tension : 0, multiplier, fuse: fusing };
    const verdict: Outcome = view.stake === null ? 'kaboom' : secured ? 'called' : 'rekt';

    // Phase edges: joining late, the blow-out, and a fresh fire for the next round.
    if (previous === null) {
      // A fresh scene (the page joining, or a round first seen after its betting phase) settles into the round
      // as it stands: a crash is the quiet aftermath, and an exit already taken has him behind the shield.
      previous = view.phase;
      engine.time = stoker.time = time = view.elapsed / 1000;
      settleEngine(engine, drive);
      settleStoker(stoker, running, crashed, secured !== null, drive.pressure);
      if (crashed) {
        blowEngine(engine, ps, view.currentX100, true);
        outcome = verdict;
        pop.x = 1;
        audio.crash('boom', true);
      }
      if (secured) badge.x = 1;
    } else if (view.phase !== previous) {
      if (crashed && !engine.blown) {
        outcome = verdict;
        // An exit this scene never drew (the tab was hidden) still gets him behind the shield.
        if (secured) callShield(stoker);
        // A crash met late blows at once and quietly; otherwise a 120 ms fuse sells it first.
        if (view.crashAge > 1500) blow(view.currentX100, true);
        else {
          fusing = true;
          startle(stoker);
        }
      }
      if (view.phase === 'betting' || view.phase === 'waiting') {
        // The next round: a new valve cap drops in, he gets up, and the steam thins out rather than vanishing.
        resetEngine(engine);
        standUp(stoker);
        fadeOut(ps);
        outcome = null;
        secured = null;
        fusing = false;
        impact = -1;
      }
      previous = view.phase;
    }
    // Back to work once he is up: also after a get-up that ran past a short betting phase.
    if (running) startStoking(stoker);
    if (fusing && crashed && view.crashAge >= FUSE_MS) blow(view.currentX100, false);
    if (secured && (stoker.mode === 'stoking' || stoker.mode === 'idle') && running) callShield(stoker);

    drive.fuse = fusing;
    stepEngine(engine, drive, ps, wdt);
    if (engine.events.reversal) sound.chuff(running ? 0.4 + engine.pressure : 0.25);
    if (engine.events.leak >= 0) {
      sound.ping();
      shake = Math.max(shake, 0.25);
    }
    if (engine.events.scare) {
      // A fake-out keyed to the multiplier: the boiler groans and he flinches, then it settles.
      audio.fx('creak', 0.9);
      startle(stoker);
      shake = Math.max(shake, 0.3);
    }
    // His pace picks up with the tension, and a little more as long rounds keep doubling.
    const rate = running ? 0.5 + 0.85 * tension + 0.25 * (1 - Math.exp(-growth / 4)) : 0;
    stoker.you = view.stake !== null;
    stepStoker(stoker, { rate, fear: fusing ? 1 : fear, pressure: engine.pressure }, wdt);
    if (stoker.events.slam) {
      audio.fx('clang', 0.8);
      shake = Math.max(shake, 0.4);
    }
    if (stoker.events.land) audio.fx('thud', 0.6);
    if (stoker.events.throw) {
      const blade = bladePoint(stoker);
      for (let i = 0; i < 5; i += 1) {
        emit(ps, { kind: 'coal', layer: 1, x: blade.x + (noise(time * 7 + i) - 0.5) * 12, y: blade.y - 6, vx: 140 + noise(time * 11 + i) * 120, vy: -60 - noise(time * 13 + i) * 80, r: 3, life: 0.22, angle: noise(i) * 3, spin: 8, tone: 0 });
      }
      sparks(ps, 340, 418, 14, 260, time * 17);
      engine.flame = Math.min(1.3, engine.flame + 0.3);
    }
    stepParticles(ps, wdt, -4 + 6 * Math.sin(time * 0.3));
    sound.update(engine.pressure, running, fusing ? 1 : 0);
    audio.update(view.phase, tension);
    if (running) audio.milestone(RUNGS.filter((r) => multiplier >= r).length);

    stepSpring(pop, outcome && engine.blown ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      if (caption) captionPop.v = 6;
      caption = nextCaption;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.6);
    // The flash peaks inside the hit-stop and clears within about a second, so the aftermath reads.
    // The blow-out flashes sharply, then fades.
    const rise = 0.08;
    const white = impact < 0 ? 0 : (0.7) * smoothstep(0, rise, impact) * Math.exp(-Math.max(0, impact - rise) / 0.5);
    // A low rumble from the start of every round that grows with the pressure; the fuse shakes the whole room.
    const vibration = engine.blown ? 0 : fusing ? 4 : running ? 0.6 + 3 * engine.pressure * engine.pressure : 0;
    const punch = impact < 0 ? 0 : smoothstep(0, 0.03, impact) * (1 - smoothstep(0.3, 0.75, impact));

    ctx.save();
    if (punch > 0) {
      ctx.translate(PUNCH.x, PUNCH.y);
      ctx.scale(1 + 0.1 * punch, 1 + 0.1 * punch);
      ctx.translate(-PUNCH.x, -PUNCH.y);
    }
    if (shake > 0) ctx.translate(Math.sin(time * 140) * 10 * shake * shake, Math.cos(time * 117) * 7 * shake * shake);
    if (vibration > 0) ctx.translate(Math.sin(time * 80) * vibration, Math.cos(time * 95) * vibration * 0.6);
    drawRoom(ctx, engine, time);
    drawParticles(ctx, ps, 0);
    drawBoiler(ctx, engine);
    drawMaintenance(ctx, engine);
    drawMachine(ctx, engine);
    drawCoalPile(ctx);
    // Thrown into the shield he lands in front of it; hiding, he is behind it.
    const front = inFrontOfShield(stoker);
    if (front) drawShield(ctx);
    drawStoker(ctx, stoker);
    if (!front) drawShield(ctx);
    // A dropped shovel stays in front of him, as it was in his hands and will be again when he picks it up.
    if (stoker.shovelDropped) drawShovelOnFloor(ctx, stoker);
    drawParticles(ctx, ps, 1);
    if (white > 0.005) {
      ctx.fillStyle = `rgba(244, 246, 248, ${white})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(DOME.x - 40, DOME.y + 60);
      ctx.rotate(-0.12);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, outcome === 'rekt' ? 'REKT' : outcome === 'called' ? 'DODGED!' : 'KABOOM!', 0, 0, 92, outcome === 'rekt' ? '#ff4d6d' : outcome === 'called' ? '#7cf67c' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();

    // HUD in screen space. The readout is measured first so the centred caption stays 24 units clear of it.
    const readout = `${multiplier.toFixed(2)}×`;
    ctx.font = `900 66px ${MEME_FONT}`;
    const readoutWidth = Math.min(READOUT_MAX, ctx.measureText(readout).width);
    if (caption) {
      ctx.save();
      ctx.translate(CAPTION_X, 68);
      const k = 1 + 0.1 * captionPop.x;
      ctx.scale(k, k);
      memeText(ctx, caption, 0, 0, 46, '#ffffff', 'center', Math.min(560, 2 * (READOUT_X - readoutWidth - 24 - CAPTION_X)) / k);
      ctx.restore();
    }
    if (view.stake === null && !outcome && view.phase !== 'waiting') {
      // A spectator has no stoker of their own in this: just a seat in the gallery.
      ctx.save();
      ctx.globalAlpha = 0.85;
      memeText(ctx, 'SPECTATING · NO BAGS', CAPTION_X, 106, 22, '#cfd6e0', 'center');
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(CAPTION_X, 114 + Math.sin(time * 2) * 3);
      ctx.rotate(-0.03);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, text, 0, 0, 28, '#7cf67c', 'center');
      ctx.restore();
    }
    drawReadout(ctx, view, readout, outcome !== null);
    memeText(ctx, `${Math.round(clamp(engine.pressure, 0, 1) * 100)} PSI`, 26, 514, 26, engine.pressure > 0.67 ? '#ff9db0' : engine.pressure > 0.45 ? '#ffd27a' : '#e7f4f0', 'left');
  }

  return { draw };
}
