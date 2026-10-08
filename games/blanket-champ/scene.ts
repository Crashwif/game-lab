import { type Act, actAt, drawAct } from './acts';
import { createPortrait } from './portrait';
/**
 * Composes Blanket Champ from the room state: the bedroom and its props,
 * the bleachers and the crowd, the bookie's board, the commentary booth, the
 * duvet, then the HUD. All motion is stepped here with the real frame time,
 * and nothing drawn here changes the committed outcome. The sound is the
 * shared page audio: a phonk set that climbs with the tempo, cues from the
 * room's own events, and a sad trombone (or a roar) at the finish.
 */
import { pageAudio } from './audio';
import { type CrowdState, collectWinnings, createCrowd, drawBleachers, drawBooth, drawConfetti, drawCrowd, drawOddsBoard, finishCrowd, resetCrowd, settleCrowd, stepCrowd } from './crowd';
import { clamp, settleSpring, spring, stepSpring } from './motion';
import { INK, type RoomState, createRoom, drawBed, drawFloorAndFurniture, drawWall, finishRoom, resetRoom, setHeadline, settleRoom, stepRoom, tensionAt } from './room';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a finish missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** Drops the screen shake, the hit-stop, the punch-in and the champ's tremble. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** The caption ladder's thresholds, for the milestone dings. */
const RUNGS = [1.3, 1.7, 2.5, 4, 6, 10, 20];
/** The finish: the picture holds, then the collapse runs slow before time catches up. */
const FREEZE_S = 0.16;
const SLOW_S = 0.35;
const SLOW_RATE = 0.3;
/** The camera punches 10% in on the quilt and holds there through the freeze before easing back. */
const PUNCH_HOLD_S = 0.4;
const PUNCH_ZOOM = 0.1;
type Outcome = 'rekt' | 'called' | 'gg';
type Secured = { x100: number; payout: number | null };
type Headline = [string, string];

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
const OVERTIME_CAPTIONS = ["OVERTIME CHAMPION", "THE NEIGHBOURS FILED A TICKET", "STAMINA AUDIT PENDING", "THE CROWD WANTS AN ENCORE", "THE BED NEEDS A PIT STOP", "STILL THE MAIN EVENT", "THE CAT MOVED OUT", "EXTRA TIME, SAME CHAMP"];

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'FINISHED EARLY' : outcome === 'called' ? 'DODGED THE FINISH' : 'GG';
  if (view.phase !== 'running') return 'GM CHAMP';
  if (secured) {
    // Took profits while he keeps going: a short regret ladder by how far past your exit he gets, at peace with it.
    const past = multiplier * 100 / secured.x100;
    return past < 1.25 ? 'DEAL WITH IT' : past < 2 ? 'PROFIT IS PROFIT' : past < 4 ? 'JEETED. NO REGRETS' : past < 10 ? "WE DON'T CHECK THE CHART" : "IT'S FINE. IT'S FINE.";
  }
  if (view.elapsed >= 45_000) return OVERTIME_CAPTIONS[Math.floor((view.elapsed - 45_000) / 12_000) % OVERTIME_CAPTIONS.length]!;
  if (multiplier < 1.3) return 'HE HAS BEGUN';
  if (multiplier < 1.7) return 'ENTERING THE POSITION';
  if (multiplier < 2.5) return 'NO PULLBACKS';
  if (multiplier < 4) return "HE'S GOT LEGS";
  if (multiplier < 6) return 'MAXIMUM LEVERAGE';
  if (multiplier < 10) return 'HISTORIC PACE';
  if (multiplier < 20) return 'LEGENDARY';
  return 'CALL AN AMBULANCE';
}

function boothLine(view: SceneView, multiplier: number, finished: boolean, legendary: boolean, outcome: Outcome | null): string {
  if (finished) return legendary ? 'ONE FOR THE RECORD BOOKS' : outcome === 'called' ? 'SMART MONEY GOT OUT' : "THAT'S A SHORT POSITION";
  if (view.phase !== 'running') return 'WELCOME BACK TO THE MAIN EVENT';
  if (multiplier < 1.4) return "HE'S ENTERED THE MARKET";
  if (multiplier < 2) return 'TEXTBOOK UPTREND';
  if (multiplier < 3) return 'NO STOP LOSS ON THIS MAN';
  if (multiplier < 5) return 'THE CROWD IS ON ITS FEET';
  if (multiplier < 8) return 'THE BED FRAME IS SELLING';
  if (multiplier < 14) return 'CALL THE RECORD BOOKS';
  return 'SOMEONE CHECK HIS PULSE';
}

/** What DEGEN NEWS is running on the wall TV. */
function headlineFor(view: SceneView, multiplier: number, catGone: boolean, outcome: Outcome | null, legendary: boolean): Headline {
  if (outcome) return legendary ? ['RECORD BOOKS', 'UPDATED'] : outcome === 'rekt' ? ['BREAKING:', "IT'S OVER (?)"] : outcome === 'called' ? ['PAPER HANDS', 'DODGED IT'] : ['BREAKING:', "IT'S OVER"];
  if (view.phase !== 'running') return ['TONIGHT:', 'THE MAIN EVENT'];
  if (view.elapsed >= 45_000) {
    const headlines: Headline[] = [['EXTRA TIME', 'STILL GOING'], ['BED FRAME', 'ON OVERTIME'], ['NEIGHBOURS', 'STILL AWAKE'], ['CAT REQUESTS', 'A TRANSFER'], ['CROWD CHANTS', 'ONE MORE'], ['LIVE FROM', 'THE NIGHT SHIFT']];
    return headlines[Math.floor((view.elapsed - 45_000) / 10_000) % headlines.length]!;
  }
  if (multiplier < 1.3) return ['BREAKING:', 'HE HAS BEGUN'];
  if (multiplier < 1.7) return ['SOURCES SAY', 'STILL GOING'];
  if (multiplier < 2.5) return ['ANALYSTS:', 'NO PULLBACK'];
  if (multiplier < 4) return catGone ? ['CAT FLEES', 'THE BUILDING'] : ['NEIGHBOURS', 'FILE COMPLAINT'];
  if (multiplier < 6) return ['BED FRAME', 'RATED JUNK'];
  if (multiplier < 10) return ['CROWD ON', 'ITS FEET'];
  if (multiplier < 20) return ['FIRE BRIGADE', 'EN ROUTE'];
  return ['PULSE STATUS:', 'UNKNOWN'];
}

function drawFireBrigade(ctx: CanvasRenderingContext2D, time: number, k: number): void {
  // A helmet and a ladder top at the window once things get out of hand.
  ctx.save();
  ctx.translate(790, 190 - 40 * k + Math.sin(time * 3) * 2);
  ctx.strokeStyle = '#c9a44a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-30, 60); ctx.lineTo(-30, -30); ctx.moveTo(30, 60); ctx.lineTo(30, -30); ctx.stroke();
  ctx.lineWidth = 3;
  for (let y = -20; y < 60; y += 16) { ctx.beginPath(); ctx.moveTo(-30, y); ctx.lineTo(30, y); ctx.stroke(); }
  ctx.fillStyle = '#e63946'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, -8, 20, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-26, -10, 52, 8, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f3dccb';
  ctx.beginPath(); ctx.ellipse(0, 6, 14, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(-5, 4, 2, 0, Math.PI * 2); ctx.arc(5, 4, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 12, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function createScene(options: SceneOptions = {}): Scene {
  const { capture, present } = createPortrait("BLANKET CHAMP", [170, 150, 590, 345], '#f0d99c');
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'phonk', crash: 'trombone' });
  const room: RoomState = createRoom(reduced ? 0 : 1);
  const crowd: CrowdState = createCrowd(reduced ? 0 : 1);
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const brigade = spring(0);
  /** The camera's punch toward the quilt at the finish, held for `punchHold` seconds of real time. */
  const punch = spring(0);
  let punchHold = 0;
  /** The act props: the act on show, the one fading out under it, the crossfade, and the fade for the finish or a cash-out. */
  let actShown: Act = actAt(0);
  let actPrev: Act | null = null;
  let actBlend = 1;
  let actFade = 0;
  /** What the stamp and the badge said, so they can shrink away when the next round clears them. */
  let stamp = '';
  let shownSecured: Secured | null = null;
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let legendary = false;
  let freeze = 0;
  let slow = 0;
  let brigadeOn = false;
  /** A headline that jumps the queue for a few seconds: the glass, the fist. */
  let bulletin: { lines: Headline; until: number } | null = null;

  /** The champ finishes: the puff, the shake, the hit-stop and the stinger, or with `quiet` the aftermath, already settled. */
  function finish(view: SceneView, multiplier: number, quiet: boolean): void {
    legendary = multiplier >= 5;
    outcome = view.stake === null ? 'gg' : secured ? 'called' : 'rekt';
    // The cat's verdict on its way back in.
    const sign = outcome === 'called' ? 'PAPER' : outcome === 'gg' && legendary ? 'GG' : 'NGMI';
    finishRoom(room, quiet, legendary && !quiet, sign);
    finishCrowd(crowd, outcome !== 'rekt', quiet);
    // The TV drops whatever bulletin was on to break the result.
    bulletin = null;
    stamp = outcome === 'rekt' ? 'REKT' : outcome === 'called' ? 'DODGED' : legendary ? 'LEGENDARY' : 'GG';
    if (quiet) {
      settleSpring(pop, 1);
      audio.crash('trombone', true);
      return;
    }
    shake = 1;
    // The stamp lands oversized on the held frame and slams down to size.
    pop.x = 1.4;
    pop.v = 0;
    if (!reduced) {
      freeze = FREEZE_S;
      slow = SLOW_S;
      punchHold = PUNCH_HOLD_S;
    }
    audio.crash(outcome === 'rekt' ? 'trombone' : 'crowd');
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    // Over a second since the last frame: the tab was hidden (or the picture stalled) and the round moved on.
    const resumed = last !== null && now - last > 1000;
    last = now;
    // The hit-stop holds the picture for a few frames, then the collapse runs slow before time catches up.
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
    const act = actAt(view.elapsed, reduced);
    const growth = Math.log2(multiplier);
    // The tension follows the number alone: 1×–3× sweeps 0–0.67. The acts never take it down.
    const tension = tensionAt(multiplier);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    // The act props show while the champ runs on without you having sold.
    const actLive = running && view.cashoutX100 === null && act.stage > 0;
    // A round met late settles the room to the number instead of playing out what it missed: a first frame that
    // lands mid-round or after the crash, a crash missed while the tab was hidden, or the first frame back.
    const first = previous === null;
    if (view.cashoutX100 !== null && !secured) {
      secured = shownSecured = { x100: view.cashoutX100, payout: view.payout };
      // An exit taken before the scene met the round is already settled: no fanfare and no bulletin.
      if (running && !first) {
        audio.cashout();
        bulletin = { lines: ['INSIDER SOLD', 'BEFORE THE TOP'], until: time + 4 };
      }
    }

    if (first) {
      previous = view.phase;
      resetRoom(room);
      resetCrowd(crowd);
      if (running || crashed) {
        settleRoom(room, multiplier, running, view.elapsed);
        settleCrowd(crowd, tension, multiplier, running, secured !== null);
        settleSpring(brigade, running && multiplier >= 10 ? 1 : 0);
        brigadeOn = brigade.x > 0.5;
        settleSpring(badge, secured ? 1 : 0);
      }
      if (crashed) finish(view, multiplier, true);
      settleSpring(crowd.tag, view.stake !== null ? 1 : 0);
      actShown = act;
      actFade = actLive ? 1 : 0;
    } else if (view.phase !== previous) {
      if (crashed && !room.finished) {
        const quiet = view.crashAge > 1500;
        // Met late, or on the first frame back, the props are still where the last frame left them.
        if (quiet || resumed) settleRoom(room, multiplier, false, view.elapsed);
        finish(view, multiplier, quiet);
      }
      if (view.phase === 'betting') {
        // Between rounds the bodies spring back, the old damage fades and your supporter walks back to his seat.
        resetRoom(room, !resumed);
        resetCrowd(crowd, !resumed);
        outcome = null;
        secured = null;
        legendary = false;
        freeze = slow = punchHold = 0;
        bulletin = null;
      }
      previous = view.phase;
    }
    if (resumed && running) settleRoom(room, multiplier, true, view.elapsed);
    if (secured && running) collectWinnings(crowd);
    audio.update(view.phase, tension);

    // While an act catches its breath the quilt's tempo eases by up to 12%; the tension stays where the number puts it.
    stepRoom(room, growth, running, dt, 1 - 0.12 * act.release);
    stepCrowd(crowd, tension, multiplier, view.stake, running, dt);
    if (room.events.beat && !reduced) shake = Math.max(shake, 0.06 + 0.18 * tension);
    if ((room.events.glassFell || room.events.fist) && !reduced) shake = Math.max(shake, 0.2);
    // Cues from the room's and the crowd's own events; the knocks go quieter once you are out.
    if (room.events.beat && running) audio.fx('thud', (0.45 + 0.5 * tension) * (secured ? 0.5 : 1));
    if (room.events.crack) audio.fx('creak', 0.5);
    // A glass that skids off just after the finish still breaks, but the TV stays on the result.
    if (room.events.glassFell) { audio.fx('shatter', 0.8); if (!outcome) bulletin = { lines: ['GLASS OF H2O', 'DELISTED'], until: time + 3 }; }
    if (room.events.fist) { audio.fx('punch', 0.9); bulletin = { lines: ['WALL BREACHED', 'BY A FIST'], until: time + 3 }; }
    if (room.events.catBack) audio.fx('squeak', 0.7);
    if (crowd.events.wave) audio.fx('cheer', 0.5);
    if (crowd.events.collected) audio.fx('coin', 1);
    stepSpring(brigade, running && multiplier >= 10 ? 1 : 0, 4, 0.8, dt);
    const brigadeUp = brigade.x > 0.5;
    if (brigadeUp && !brigadeOn) audio.fx('siren', 0.8);
    brigadeOn = brigadeUp;
    if (running) audio.milestone(RUNGS.filter((r) => multiplier >= r).length);
    // The TV: the bulletin of the moment, else the stage the number has reached.
    const lines = bulletin && time < bulletin.until ? bulletin.lines : headlineFor(view, multiplier, room.catGone, outcome, legendary);
    if (setHeadline(room, lines)) {
      if (first) settleSpring(room.slide, 1);
      else audio.fx('notify', 0.5);
    }
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    // The punch runs on real time, so it lands during the freeze.
    punchHold = Math.max(0, punchHold - real);
    stepSpring(punch, punchHold > 0 ? 1 : 0, punchHold > 0 ? 22 : 6, punchHold > 0 ? 0.75 : 1, real);
    // The act props fade in with a new act, crossfade between acts, and fade out at the finish or a cash-out.
    if (actLive && act.stage !== actShown.stage) { actPrev = actShown; actBlend = 0; }
    if (actLive) actShown = act;
    actBlend = Math.min(1, actBlend + dt / 0.5);
    actFade = actLive ? Math.min(1, actFade + dt / 0.35) : Math.max(0, actFade - dt / 0.5);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.4);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 7 * shake * shake, Math.cos(time * 117) * 5 * shake * shake);
    if (!reduced && punch.x > 0.005) {
      // The camera punches in on the quilt and eases back out.
      const k = 1 + PUNCH_ZOOM * clamp(punch.x, 0, 1.2);
      ctx.translate(470, 310);
      ctx.scale(k, k);
      ctx.translate(-470, -310);
    }
    drawWall(ctx, room);
    if (brigade.x > 0.02) drawFireBrigade(ctx, time, clamp(brigade.x, 0, 1));
    drawBleachers(ctx);
    drawCrowd(ctx, crowd, room.finished, outcome !== 'rekt');
    drawOddsBoard(ctx, crowd, multiplier, running, room.finished);
    drawBooth(ctx, crowd, boothLine(view, multiplier, room.finished, legendary, outcome));
    drawConfetti(ctx, crowd);
    drawFloorAndFurniture(ctx, room);
    drawBed(ctx, room);
    if (actFade > 0.01) {
      if (actPrev && actBlend < 1) drawAct(ctx, actPrev, actFade * (1 - actBlend));
      drawAct(ctx, actShown, actFade * actBlend);
    }
    if (stamp && pop.x > 0.02) {
      ctx.save();
      ctx.translate(514, 350);
      ctx.rotate(-0.06);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, stamp, 0, 0, stamp === 'LEGENDARY' ? 42 : 58, stamp === 'REKT' ? '#ff4d6d' : '#ffe27a', 'center', 235);
      ctx.restore();
    }
    ctx.restore();

    capture(ctx);
    if (caption) {
      ctx.save();
      ctx.translate(430, 68);
      const k = 1 + 0.1 * captionPop.x;
      ctx.scale(k, k);
      memeText(ctx, caption, 0, 0, 46, '#ffffff', 'center', 600);
      ctx.restore();
    }
    if (shownSecured && badge.x > 0.02) {
      const text = `${shownSecured.payout !== null ? `+${shownSecured.payout} · ` : ''}${(shownSecured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(430, 114 + Math.sin(time * 2) * 3);
      ctx.rotate(-0.03);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, text, 0, 0, 28, '#7cf67c', 'center');
      ctx.restore();
    }
    const colour = outcome ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    ctx.save();
    if (!running && !outcome) ctx.globalAlpha = 0.85;
    // Squeezed rather than run into the stamina clock in an absurdly long round.
    memeText(ctx, `${multiplier.toFixed(2)}×`, 930, 514, 56, colour, 'right', 660);
    ctx.restore();
    // Once crashed, the clock shows how long the curve took to reach the crash point, so a round first met
    // after the crash reads right too.
    const seconds = Math.floor(view.elapsed / 1000);
    memeText(ctx, `STAMINA ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, 26, 514, 26, outcome ? '#ff9db0' : '#e7f4f0', 'left');
    present(ctx, view, actLive ? act.line : caption, "ROOM NEWS", room.headline.join(' · '));

  }

  return { draw };
}
