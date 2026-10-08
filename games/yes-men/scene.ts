/**
 * Composes Yes Men from the room state: the war room, the Leader at the far end of the table, the ministers
 * along the sides, the player at the near end, the agenda that follows the multiplier, the walk-out on an
 * accepted cash-out, the seeded slam on the crash and the photo it ends in, and the HUD. Everything follows
 * the SceneView and the frame time; nothing here changes the committed outcome.
 */
import { pageAudio } from './audio';
import {
  arrive,
  createLeader,
  createPlayer,
  createYesMen,
  drawLeader,
  drawPlayer,
  drawSeatTag,
  drawThrone,
  drawYesMan,
  drawYouChair,
  leave,
  type Leader,
  type Player,
  playerAt,
  resetLeader,
  resetPlayer,
  resetYesMen,
  settleLeader,
  settleYesMen,
  stepLeader,
  stepPlayer,
  stepYesMen,
  stopClapping,
  type YesMan,
  yesManDepth,
} from './cast';
import {
  aside,
  crashRoom,
  createRoom,
  drawAir,
  drawBubbles,
  drawFlash,
  drawPhoto,
  drawRedLight,
  drawRoom,
  drawTable,
  drawTicker,
  dropMedal,
  PHOTO_CIRCLE,
  REGRET,
  resetRoom,
  type Room,
  settleRoom,
  stepRoom,
  walkOut,
} from './court';
import { memeText } from './ink';
import { clamp, mix, settleSpring, spring, stepSpring } from './motion';
import { createPortrait, isPortrait } from './portrait';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** The displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a crash missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}
export interface SceneOptions {
  /** Drops the shake, the flash, the hit-stop and the camera punch. */
  reducedMotion?: boolean;
}
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void }

type Outcome = 'rekt' | 'called' | 'spectator';
type Secured = { x100: number; payout: number | null };
/** The multipliers that ring a milestone ding, the third onward an airhorn. The caption follows the agenda instead. */
const RUNGS = [1.2, 1.5, 2, 2.6, 3.4, 4.5, 6, 8, 11, 15, 22];
/** The slam's hit-stop and camera punch, then slow motion at a third speed. */
const FREEZE_S = 0.15;
const PUNCH_HOLD_S = 0.3;
const PUNCH_ZOOM = 0.1;
const SLOW_S = 0.5;
const SLOW_RATE = 0.3;
/** Where the camera punches in: the Leader's hand on the button. */
const PUNCH_AT = { x: 480, y: 250 } as const;
/** The crashed round's cut back to a fresh table goes through a short fade. */
const WIPE_S = 0.35;

function captionFor(view: SceneView, room: Room, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome && room.photo > 0) return outcome === 'rekt' ? 'YOU’RE IN THE PHOTO' : outcome === 'called' ? 'DODGED THE PHOTO' : 'YOU WATCHED FROM THE HALLWAY';
  if (view.phase === 'betting') return 'TAKE YOUR SEAT';
  if (view.phase === 'waiting') return 'AGENDA: PENDING';
  if (secured) {
    const past = view.currentX100 / secured.x100;
    return past >= 3 ? 'THEY RENAMED THE DOOR' : past >= 2 ? 'YOUR CHAIR WAS FILLED' : past >= 1.5 ? 'THEY KEPT CLAPPING' : 'THAT’S GOING TOO FAR';
  }
  return room.caption || 'THE MEETING BEGINS';
}

export function createScene(options: SceneOptions = {}): Scene {
  const { capture, present } = createPortrait('YES MEN', [160, 110, 640, 400], '#e0b64a');
  const reduced = options.reducedMotion === true;
  // A brass band that marches harder with the multiplier; the crash is the klaxon.
  const audio = pageAudio({ style: 'military', crash: 'siren' });
  const room: Room = createRoom();
  const leader: Leader = createLeader();
  const men: YesMan[] = createYesMen();
  const player: Player = createPlayer('YOU');
  const loyalist: Player = createPlayer('NEW');
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const punch = spring(0);
  const seized = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let freeze = 0;
  let slow = 0;
  let punchHold = 0;
  let landClock = 0;
  /** The player's pulse under the band, the regret lines said after the walk-out, the clap rhythm and the cut's fade. */
  let pulseClock = 0;
  let regret = 0;
  let lastClap = 0;
  let wipe = 0;
  /** True from a crash met late until the next round: the aftermath is shown, not replayed, so no cues play for it. */
  let muted = false;

  function reset(): void {
    resetRoom(room);
    resetLeader(leader);
    resetYesMen(men);
    resetPlayer(player, 'YOU');
    resetPlayer(loyalist, 'NEW');
    outcome = null;
    secured = null;
    shake = 0;
    freeze = slow = punchHold = 0;
    settleSpring(punch, 0);
    settleSpring(seized, 0);
    muted = false;
    landClock = pulseClock = regret = 0;
  }

  function beginCrash(view: SceneView, quiet: boolean): void {
    const harmless = secured !== null;
    outcome = view.stake === null ? 'spectator' : harmless ? 'called' : 'rekt';
    crashRoom(room, view.currentX100, quiet, harmless);
    if (quiet) {
      // Met late: the slam is done, the room is red, everyone is on their knees and the photo is on the wall.
      pop.x = 1;
      seized.x = 1;
      muted = true;
      settleSpring(leader.slam, 1);
      settleSpring(leader.raise, 1);
      settleSpring(leader.pride, 1.15);
      for (const m of men) {
        settleSpring(m.kneel, 1);
        settleSpring(m.stand, 0);
        m.clapping = 0;
      }
      settleSpring(player.slump, 1);
      settleSpring(player.hunch, 1);
      settleSpring(loyalist.slump, 1);
      audio.crash('siren', true);
      return;
    }
    pop.v = 16;
    shake = 1;
    if (!reduced) {
      // Freeze on the slam with the camera punched in, hold it, then the papers fly slow.
      freeze = FREEZE_S;
      slow = SLOW_S;
      punchHold = PUNCH_HOLD_S;
      settleSpring(punch, 1);
    }
    audio.crash('siren');
    audio.fx('thud', 1);
    audio.fx('crowd', 0.9);
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the frame the button goes down, then the papers fly slow before time catches up.
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
    // 1 − 1/x: 0.33 at 1.5×, 0.5 at 2×, 0.67 at 3×, 0.9 at 10×, so the 1×–3× window escalates. Nothing lowers it.
    const tension = 1 - 1 / multiplier;
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const fresh = previous === null;
    const rung = RUNGS.filter((r) => multiplier >= r).length;
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      // Seen land while the round runs: the player stands up, says it, and walks out of the door.
      if (running && !fresh && !room.crashed) {
        walkOut(room);
        leave(player);
        audio.cashout();
        audio.fx('creak', 0.9);
        audio.fx('gasp', 0.9);
      } else {
        player.mode = 'gone';
        player.walk = 1;
        loyalist.mode = 'seated';
        loyalist.walk = 0;
      }
    }

    if (fresh) {
      // A fresh scene can open on a round already under way (a page load mid-round, or a round first seen
      // after its betting window), so it settles into the round as it stands instead of playing out what it
      // missed: the decrees stamped, the chair filled if the player walked out, and a crash as the aftermath.
      previous = view.phase;
      if (running || crashed) {
        settleRoom(room, multiplier, tension, secured !== null);
        settleLeader(leader, tension, multiplier);
        settleYesMen(men, tension, multiplier);
        settleSpring(player.hunch, secured ? 0 : clamp(tension, 0, 1));
        if (secured) badge.x = 1;
      }
      if (crashed) beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (crashed && !room.crashed) beginCrash(view, view.crashAge > 1500);
      if (view.phase === 'betting') {
        // Through a waiting spell or a missed crash too, whatever meeting was on fades to the fresh one.
        if (room.crashed || room.nextLine > 0) wipe = 1;
        reset();
      }
      previous = view.phase;
    }
    audio.update(view.phase, tension);

    stepRoom(room, { running, multiplier, tension, time, reduced, left: secured !== null }, dt);
    if (secured && running && !room.crashed) {
      // The round keeps pumping after the walk-out: the regret ladder, said about the empty chair.
      const past = view.currentX100 / secured.x100;
      while (regret < REGRET.length && past >= REGRET[regret]![0]) {
        const [, who, text, head] = REGRET[regret++]!;
        if (!fresh) aside(room, who, text, head);
      }
    }
    const rev = room.events;
    const decree = rev.decree;
    if (rev.line?.cap === 'WHO STOPPED CLAPPING' && !fresh) stopClapping(men);
    const newest = room.bubbles.at(-1);
    const said = (by: number): number => room.bubbles.reduce((age, b) => (b.who === 'yes' && b.by === by ? Math.min(age, b.age) : age), 9);
    const leaderSaid = room.bubbles.reduce((age, b) => (b.who === 'leader' ? Math.min(age, b.age) : age), 9);
    const photo = room.photo > 0;
    const stamped = stepLeader(leader, { running, tension, multiplier, said: leaderSaid, decree, crashed: room.crashed, photo, time, reduced }, dt);
    const mev = stepYesMen(men, { running, tension, multiplier, time, reduced, decree, talker: newest?.who ?? null, talkAge: newest?.age ?? 9, said, crashed: room.crashed, photo }, dt);
    const pev = stepPlayer(player, { running, tension, decree, crashed: room.crashed, time }, dt);
    const lev = stepPlayer(loyalist, { running, tension: 0, decree: false, crashed: room.crashed, time }, dt);
    if (pev.gone && !fresh) arrive(loyalist);
    // The door swings for whoever is going through it.
    room.doorOpen = Math.max(pev.door, lev.door, mev.door);

    if (!fresh && !muted) {
      // Every event is a cue: a bubble, the stamp, a medal, the chyron, the glass, the applause, the door, the camera.
      if (rev.line) audio.fx('pop', rev.line.who === 'leader' ? 0.8 : rev.line.who === 'you' ? 0.45 : 0.55);
      if (stamped) audio.fx('thud', 0.7);
      if (decree) audio.fx('coin', 0.5);
      if (rev.headline) audio.fx('notify', 0.5);
      if (rev.cover) audio.fx('creak', 0.9);
      if (rev.yearOne) audio.fx('clang', 0.8);
      if (rev.drop) {
        dropMedal(room, room.medals);
        audio.fx('coin', 0.35);
      }
      if (mev.clapping) audio.fx('crowd', 0.5);
      if (mev.ovation) {
        audio.fx('cheer', 0.8);
        audio.fx('stomp', 0.8);
      }
      if (mev.kneel) audio.fx('thud', 0.5);
      if (mev.taken) {
        audio.fx('whoosh', 0.8);
        audio.fx('scream', 0.5);
      }
      if (mev.replaced || pev.sat || lev.sat) audio.fx('door', 0.5);
      if (pev.stood) audio.fx('creak', 0.6);
      if (pev.gone) audio.fx('door', 0.9);
      if (rev.photo) audio.fx('camera', 1);
      // The clap keeps time under the band, quickening with the room.
      const clap = men[0]!.clap;
      if (men[0]!.clapping > 0.5 && clap < lastClap && !room.crashed) audio.fx('tick', 0.3 + 0.5 * clamp(men[0]!.zeal.x, 0, 1));
      lastClap = clap;
      landClock = Math.max(0, landClock - dt);
      if (rev.landed > 0 && landClock === 0) {
        landClock = 0.09;
        audio.fx('thud', 0.35);
      }
      if (running) audio.milestone(rung);
      // The player's pulse under the band, quickening with the tension, until the walk-out or the slam.
      const beat = mix(1.4, 0.35, tension);
      if (running && !secured && !room.crashed && (pulseClock += dt) >= beat) {
        pulseClock -= beat;
        audio.fx('heartbeat', 0.15 + 0.3 * tension);
      }
    }
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(seized, room.crashed && room.crashT > 0.3 ? 1 : 0, 18, 0.4, dt);
    // The punch runs on real time, so it holds through the freeze and eases out after it.
    punchHold = Math.max(0, punchHold - real);
    if (punchHold === 0) stepSpring(punch, 0, 9, 0.85, real);
    room.flash = Math.max(0, room.flash - real * 3.5);
    const nextCaption = captionFor(view, room, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.5);

    ctx.save();
    const rumble = running && !reduced && !room.crashed && !secured ? clamp(leader.hover.x - 0.6, 0, 0.4) * 3 : 0;
    if (!reduced && (shake > 0 || rumble > 0)) ctx.translate(Math.sin(time * 90) * (8 * shake + rumble), Math.cos(time * 70) * 5 * shake);
    if (!reduced && punch.x > 0.005) {
      const k = 1 + PUNCH_ZOOM * clamp(punch.x, 0, 1.2);
      ctx.translate(PUNCH_AT.x, PUNCH_AT.y);
      ctx.scale(k, k);
      ctx.translate(-PUNCH_AT.x, -PUNCH_AT.y);
    }
    drawRoom(ctx, room, time, reduced);
    drawThrone(ctx);
    drawLeader(ctx, leader, room.medals, time, reduced);
    drawTable(ctx, room, time);
    // The ministers and whoever is walking, nearest last; whoever is in the chair sits behind its back.
    const seatedFigure = player.mode === 'seated' || player.mode === 'standing' ? player : loyalist.mode === 'seated' ? loyalist : null;
    const items: { y: number; draw: () => void }[] = men.map((m) => ({ y: yesManDepth(m), draw: () => drawYesMan(ctx, m, time, reduced) }));
    for (const f of [player, loyalist]) if (f.mode === 'walking' || f.mode === 'arriving') items.push({ y: playerAt(f).y, draw: () => drawPlayer(ctx, f, time, reduced) });
    items.sort((a, b) => a.y - b.y);
    for (const item of items) item.draw();
    if (seatedFigure) drawPlayer(ctx, seatedFigure, time, reduced);
    drawYouChair(ctx);
    if (!isPortrait(ctx.canvas)) drawBubbles(ctx, room);
    drawAir(ctx, room);
    if (seatedFigure) drawSeatTag(ctx, seatedFigure, time, reduced);
    drawRedLight(ctx, room, time, reduced);
    ctx.restore();
    drawFlash(ctx, room);
    if (room.crashed) drawPhoto(ctx, room, PHOTO_CIRCLE, room.harmless ? 'not you' : 'you');
    if (outcome && pop.x > 0.02 && (view.phase !== 'crashed' || view.crashAge >= 1300)) {
      ctx.save();
      ctx.translate(480, outcome === 'called' ? 158 : 116);
      ctx.rotate(-0.08);
      const scale = clamp(pop.x, 0, 1.25);
      ctx.scale(scale, scale);
      const word = outcome === 'rekt' ? 'YOU CLAPPED' : outcome === 'called' ? 'NOT IN THE PHOTO' : 'YOU LET HIM COOK';
      memeText(ctx, word, 0, 0, outcome === 'rekt' ? 44 : 36, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center', 700);
      ctx.restore();
    }
    if (wipe > 0) {
      wipe = Math.max(0, wipe - real / WIPE_S);
      ctx.fillStyle = `rgba(26, 15, 20, ${wipe})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    // The HUD: the caption, the walked-out badge, the multiplier (stamped SEIZED after the slam), the spine, the
    // approval rating and the STATE TV chyron.
    capture(ctx);
    if (caption) {
      ctx.save();
      ctx.translate(430, 62);
      const scale = 1 + 0.08 * captionPop.x;
      ctx.scale(scale, scale);
      memeText(ctx, caption, 0, 0, 40, '#ffffff', 'center', 540);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× WALKED OUT`;
      ctx.save();
      ctx.translate(430, 104);
      ctx.scale(clamp(badge.x, 0, 1.2), clamp(badge.x, 0, 1.2));
      memeText(ctx, text, 0, 0, 24, '#7cf67c', 'center');
      ctx.restore();
    }
    const colour = outcome === 'rekt' || outcome === 'spectator' ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    memeText(ctx, `${multiplier.toFixed(2)}×`, 936, 72, 56, colour, 'right', 220);
    if (seized.x > 0.02) {
      ctx.save();
      ctx.translate(846, 96);
      ctx.rotate(-0.18);
      const s = clamp(seized.x, 0, 1.3);
      ctx.scale(s, s);
      ctx.strokeStyle = '#ff2d4a';
      ctx.lineWidth = 3;
      ctx.strokeRect(-62, -16, 124, 32);
      memeText(ctx, 'SEIZED', 0, 9, 26, '#ff2d4a', 'center');
      ctx.restore();
    }
    const spine = secured ? 100 : room.crashed && !room.harmless ? 0 : Math.round((1 - clamp(player.hunch.x, 0, 1)) * 100);
    memeText(ctx, `SPINE ${spine}%`, 24, 498, 22, spine < 40 ? '#ffb4c2' : '#f3e9d6', 'left');
    const approval = room.crashed ? 100 : 99.9 + 0.2 * tension + 45 * clamp(Math.log10(multiplier) / 3, 0, 1);
    memeText(ctx, `APPROVAL ${approval.toFixed(1)}%${room.crashed ? ' FOREVER' : ''}`, 936, 498, 22, approval > 100.05 ? '#ffd36b' : '#f3e9d6', 'right', 360);
    drawTicker(ctx, room, room.crashed);
    present(ctx, view, caption, `APPROVAL ${approval.toFixed(1)}%`, room.bubbles.at(-1)?.text ?? 'The agenda is long and the door is right there.', view.phase === 'crashed' ? [200, 140, 560, 390] : undefined);
  }

  return { draw };
}
