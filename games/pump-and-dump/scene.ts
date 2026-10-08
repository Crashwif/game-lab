/**
 * Composes Pump & Dump from the room state: the gym, the crowd, the bench
 * and everyone on or around it, the chalk, the poll on the phone, then the
 * HUD, with the sound cued from what they do. All motion is stepped here
 * with the real frame time, and nothing drawn here changes the committed
 * outcome.
 */
import { pageAudio } from './audio';
import { type Bench, PLATE_AT, benchHead, createBench, drawBench, dumpBar, rackBar, resetBench, settleBench, stepBench, tensionFor } from './bench';
import { type Gym, INK, cough, createGym, drawGymBack, drawGymCrowd, drawGymFloor, drawPhoneOverlay, drawPuffs, finishGym, heckle, puff, resetGym, settleTrail, stepGym } from './gym';
import { clamp, mix, settleSpring, spring, stepSpring } from './motion';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a drop missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** Drops the screen shake, the hit-stop, the slow motion and the camera punch. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
type Outcome = 'rekt' | 'called' | 'dumped';
type Secured = { x100: number; payout: number | null };
const HECKLES = ['GO BRO', 'OILED UP', 'SHEEEESH', "HE'S HIM", 'GYATT', 'EGO LIFT', 'ALL NATTY?', 'CALL 911'];
/** The drop's hit-stop and slow motion, and the camera's punch-in: a 10% cut held for 0.3 s, then eased back out. */
const FREEZE_S = 0.15;
const SLOW_S = 0.4;
const SLOW_RATE = 0.3;
const PUNCH_HOLD_S = 0.3;
const PUNCH_ZOOM = 0.1;
/** Where the phone overlay sits; the poll is drawn on its screen under the viewer count. */
const PHONE = { x: 866, y: 44 } as const;

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
const OVERTIME_CAPTIONS = ["THE SET HAS NO END", "SPOTTER FINALLY HELPING", "THE BAR WANTS A DAY OFF", "OVERTIME AT THE IRON BANK", "REP COUNT: LOST TRACK", "CHALK UP AND COPE", "ONE MORE MEANS ONE MORE", "THE GYM IS CLOSING"];

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome === 'called') return 'DODGED THE DUMP';
  if (outcome) return view.currentX100 <= 100 ? 'RUGGED AT THE RACK' : outcome === 'rekt' ? 'SPOTTER SOLD' : 'NO SPOTTER NGMI';
  if (view.phase !== 'running') return 'LOAD THE BAR';
  if (secured) {
    // Took profits: a jeet, and a good call. The ladder ribs him as the number keeps going without him.
    const gone = view.currentX100 / secured.x100;
    return gone < 1.3 ? 'TOOK PROFITS (JEET)' : gone < 2 ? 'DEV TOOK THE BENCH' : gone < 4 ? 'STILL PUMPING. STILL BANKED' : 'PAPER HANDS, BAG SECURED';
  }
  if (view.elapsed >= 45_000) return OVERTIME_CAPTIONS[Math.floor((view.elapsed - 45_000) / 12_000) % OVERTIME_CAPTIONS.length]!;
  // A new line every few seconds through the 1x to 3x stretch, each true to what the spotter is doing at the time.
  if (multiplier < 1.2) return 'PUMP IT';
  if (multiplier < 1.45) return 'ONE MORE REP';
  if (multiplier < 1.9) return 'SPOTTER IS SCROLLING';
  if (multiplier < 2.5) return 'BENCH PRESSING MY BAGS';
  if (multiplier < 3.3) return 'NO PAIN NO GAINZ';
  if (multiplier < 5) return 'THE DEV IS SPOTTING';
  if (multiplier < 7.5) return 'LIGHT WEIGHT BABY';
  if (multiplier < 12) return 'TRT IS KICKING IN';
  if (multiplier < 20) return 'GYATT';
  return 'HIS SPINE IS RUGGING';
}

/** The NATTY OR NOT poll on the phone: NOT wins more of it the higher the bar goes, and all of it once it comes down. */
function drawPoll(ctx: CanvasRenderingContext2D, not: number, live: boolean, time: number, reduced: boolean): void {
  ctx.save();
  ctx.translate(PHONE.x, PHONE.y);
  ctx.textBaseline = 'alphabetic';
  // On the phone's screen (8 to 142 down), under the viewer count.
  ctx.fillStyle = '#ffffff'; ctx.font = '900 11px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('NATTY?', 38, 66);
  const rows: [string, number, string][] = [['YES', 1 - not, '#2e8b57'], ['NOT', not, '#e63946']];
  for (const [i, [name, share, colour]] of rows.entries()) {
    const y = 72 + i * 22;
    ctx.fillStyle = '#14181f'; ctx.beginPath(); ctx.roundRect(10, y, 56, 14, 4); ctx.fill();
    ctx.fillStyle = colour; ctx.beginPath(); ctx.roundRect(10, y, Math.max(5, 56 * share), 14, 4); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = '900 10px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${name} ${Math.round(share * 100)}%`, 14, y + 11);
  }
  ctx.textAlign = 'center'; ctx.font = '900 9px Impact, "Arial Black", sans-serif';
  if (!live || not > 0.985) {
    const k = reduced ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(time * 4));
    ctx.fillStyle = `rgba(255, 120, 140, ${k})`;
    ctx.fillText('SEC WATCHING', 38, 130);
  } else if (not > 0.6) {
    ctx.fillStyle = '#ffe27a';
    ctx.fillText('SUS', 38, 130);
  }
  ctx.restore();
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'hardstyle', crash: 'slam' });
  const gym: Gym = createGym();
  const bench: Bench = createBench();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  /** The camera's punch into the drop, and how much longer it holds before easing out. */
  const punch = spring(0);
  let punchHold = 0;
  /** The poll's NOT share. */
  const natty = spring(0.12);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let heckleAt = 0;
  let freeze = 0;
  let slow = 0;
  /** The green of an accepted exit, fading. */
  let flash = 0;
  let clangAt = 0;
  let clangs = 0;
  let notified = false;
  let heckles = 0;
  /** When the next strain heartbeat is due, until the player takes profits. */
  let pulseAt = 0;
  /** The dip from black that covers the reset into a new betting phase. */
  let fade = 0;

  /** The crash: the bar comes down on whoever is under it. `quiet` settles into a drop that already happened. */
  function drop(view: SceneView, multiplier: number, quiet: boolean): void {
    outcome = view.stake === null ? 'dumped' : secured ? 'called' : 'rekt';
    if (quiet) settleBench(bench, multiplier, secured !== null);
    // An exit accepted on the same frame as the crash still makes the hooks: nobody is under the bar.
    else if (secured) rackBar(bench);
    dumpBar(bench, view.currentX100, quiet);
    finishGym(gym, outcome === 'called', quiet);
    if (quiet) {
      pop.x = 1;
      audio.crash('slam', true);
      return;
    }
    // The bar is falling; everything else waits for it to land.
    audio.fx('whoosh', 0.9);
  }

  /** The bar lands: the shake, the hit-stop and the slow motion, the punch-in, the chalk, the stinger. */
  function impact(): void {
    shake = 1;
    pop.v = 16;
    if (!reduced) {
      freeze = FREEZE_S;
      slow = SLOW_S;
      settleSpring(punch, 1);
      punchHold = PUNCH_HOLD_S;
    }
    // Chalk off the bar, low enough that it drifts up past his chin rather than over the KO face.
    puff(gym, { x: 480, y: bench.barY.x + (bench.hitLifter ? 16 : 0) }, 10, '#ffffff', 3);
    heckle(gym, 'NOT NATTY', false);
    audio.crash('slam');
    audio.fx('scream', 0.8);
    clangs = 0;
    clangAt = time + 0.15;
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the picture for a few frames, then the drop runs slow before time catches up.
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * SLOW_RATE;
    }
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    // `growth` (log2) paces the slow, long-round drivers: rep rate and the mirror chart. `tension` sweeps 0 to 0.67
    // across 1x to 3x, where most rounds end, and keeps creeping up after.
    const growth = Math.log2(multiplier);
    const tension = tensionFor(multiplier);
    const poll = 0.12 + 0.88 * (1 - multiplier ** -0.9);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running) { audio.cashout(); flash = 1; }
    }

    // A round met late (a first frame, which may land mid-round or after the crash, or a drop missed while the
    // tab was hidden) settles into place instead of playing out what it missed.
    let settle = false;
    if (previous === null) {
      previous = view.phase;
      settle = running || crashed;
      resetGym(gym);
      resetBench(bench);
      if (running) settleBench(bench, multiplier, secured !== null);
      if (crashed) drop(view, multiplier, true);
    } else if (view.phase !== previous) {
      if (crashed && !bench.dumped) {
        settle = view.crashAge > 1500;
        drop(view, multiplier, settle);
      }
      if (view.phase === 'betting') {
        if (previous === 'crashed') fade = 1;
        resetGym(gym);
        resetBench(bench);
        outcome = null;
        secured = null;
        heckleAt = pulseAt = heckles = 0;
        freeze = slow = punchHold = 0;
        settleSpring(punch, 0);
        notified = false;
        settleSpring(natty, 0.12);
      }
      previous = view.phase;
    }
    if (settle) {
      // The mirror chart follows the round's authoritative elapsed time.
      settleTrail(gym, view.elapsed, growth);
      settleSpring(badge, secured ? 1 : 0);
      settleSpring(natty, running ? poll : 1);
      notified = true;
    }
    if (secured && running) rackBar(bench);
    audio.update(view.phase, tension);

    stepBench(bench, { running, multiplier, growth, tension, seconds: view.elapsed / 1000 }, dt);
    stepGym(gym, { running, tension, multiplier, growth, elapsed: view.elapsed, cracks: 0 }, dt);
    if (bench.events.impact) impact();
    if (bench.events.plate) { heckle(gym, HECKLES[bench.nextPlate % HECKLES.length]!, bench.nextPlate % 3 === 0); heckleAt = Math.max(heckleAt, time + 1.6); if (!reduced) shake = Math.max(shake, 0.2); audio.fx('clang', 0.7); }
    if (running) audio.milestone(PLATE_AT.filter((p) => multiplier >= p).length);
    if (bench.events.rep && running) { if (!reduced) shake = Math.max(shake, 0.05 + 0.2 * tension); audio.fx('chuff', 0.35 + 0.5 * tension); }
    // The fake-out stall: the bar creaks and the shot shudders while he grinds it.
    if (bench.events.stall) { if (!reduced) shake = Math.max(shake, 0.12 + 0.2 * tension); audio.fx('creak', 0.35 + 0.35 * tension); }
    // A heartbeat that quickens with the load, until the player takes profits.
    if (running && !secured && tension > 0.2 && time >= pulseAt) { pulseAt = time + mix(1.4, 0.35, tension); audio.fx('heartbeat', 0.25 + 0.3 * tension); }
    if (bench.events.racked) {
      // Re-racked: a chalk cloud so big the crowd coughs, and the flex.
      puff(gym, { x: 480, y: 370 }, 30, '#ffffff', 1, 1.7);
      cough(gym);
      heckle(gym, 'GYATT', true);
      audio.fx('clang', 1);
      audio.fx('spray', 0.9);
    }
    if (bench.events.swapped) { puff(gym, { x: 480, y: 400 }, 16, '#ffffff', 2); audio.fx('creak', 0.6); }
    // Plates hitting the floor: a clang each, spaced out, and only the first few.
    if (bench.events.bounce > 0 && bench.dumpAge > 0.12 && time > clangAt && clangs < 6) { clangAt = time + 0.12; clangs += 1; audio.fx('clang', 0.3 + 0.1 * Math.min(3, bench.events.bounce)); }
    // The crowd chimes in every few seconds from about 1.2x, gentle at first, alarmed as the load climbs.
    if (running && tension > 0.15 && time > heckleAt) { heckleAt = time + mix(3.6, 2.2, tension); heckle(gym, HECKLES[Math.min(HECKLES.length - 1, Math.floor(tension * HECKLES.length) + (heckles++ % 2))]!, false); }
    stepSpring(natty, running ? poll : outcome ? 1 : 0.12, 3, 0.8, dt);
    if (running && !notified && natty.x > 0.5) { notified = true; audio.fx('notify', 0.6); }
    // The outcome word waits for the bar to land.
    stepSpring(pop, outcome && !bench.impactPending ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    punchHold = Math.max(0, punchHold - real);
    if (punchHold <= 0) stepSpring(punch, 0, 7, 1, real);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.45);
    if (flash > 0) flash = Math.max(0, flash - real / 0.6);

    const head = benchHead();
    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 7 * shake * shake, Math.cos(time * 117) * 5 * shake * shake);
    if (!reduced && punch.x > 0.005) {
      // The camera punches in on the bar landing and eases back out.
      const k = 1 + PUNCH_ZOOM * clamp(punch.x, 0, 1);
      ctx.translate(head.x, head.y);
      ctx.scale(k, k);
      ctx.translate(-head.x, -head.y);
    }
    drawGymBack(ctx, gym, outcome !== null);
    drawGymCrowd(ctx, gym, outcome === 'called');
    drawGymFloor(ctx);
    drawBench(ctx, bench);
    drawPuffs(ctx, gym);
    if (outcome && pop.x > 0.02) {
      ctx.save();
      // Low enough to leave the spotter's SELL notification readable above it.
      ctx.translate(head.x, head.y - 40);
      ctx.rotate(-0.1);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      const text = outcome === 'rekt' ? 'REKT' : outcome === 'called' ? 'LIGHT WEIGHT' : 'DUMPED';
      memeText(ctx, text, 0, 0, outcome === 'called' ? 72 : 96, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();
    if (flash > 0.01) { ctx.fillStyle = `rgba(124, 246, 124, ${0.3 * flash})`; ctx.fillRect(0, 0, 960, 540); }
    if (fade > 0) fade = Math.max(0, fade - real / 0.35);
    drawPhoneOverlay(ctx, gym, !outcome);
    drawPoll(ctx, clamp(natty.x, 0, 1), !outcome, time, reduced);

    if (caption) {
      ctx.save();
      ctx.translate(430, 78);
      const k = 1 + 0.1 * captionPop.x;
      ctx.scale(k, k);
      memeText(ctx, caption, 0, 0, 44, '#ffffff', 'center', 600);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      // Under the caption, on the mirror: off the bench, where the re-rack and the flex are the beat.
      ctx.translate(480, 118 + Math.sin(time * 2) * 3);
      ctx.rotate(-0.02);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, text, 0, 0, 28, '#7cf67c', 'center');
      ctx.restore();
    }
    const colour = outcome ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    ctx.save();
    if (!running && !outcome) ctx.globalAlpha = 0.85;
    // Both readouts keep to their own half of the floor however long the round runs.
    memeText(ctx, `${multiplier.toFixed(2)}×`, 24, 514, 56, colour, 'left', 420);
    ctx.restore();
    const plates = Math.min(PLATE_AT.length, bench.nextPlate);
    memeText(ctx, `${Math.round(45 + multiplier * 100)} LBS · ${plates * 2} PLATES`, 936, 514, 24, outcome ? '#ff9db0' : '#e7f4f0', 'right', 420);
    if (fade > 0.01) { ctx.fillStyle = `rgba(28, 31, 38, ${fade * fade})`; ctx.fillRect(0, 0, 960, 540); }
  }

  return { draw };
}
