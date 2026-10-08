import { pageAudio } from './audio';
import { clamp, noise, settleSpring, spring, stepSpring } from './motion';
import { GROUND, INK, PAD_X, PX_PER_DOUBLING, type Jeet, type Piece, type Pod, camera, createPod, stepPod, disc, drawJeet, drawPieces, drawPod, drawRocket, drawWorld, shred, stepPieces } from './rocket';

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
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void }

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
const RUNGS = [1.3, 1.7, 2.3, 3.2, 5, 8, 15];
const CAPTIONS = ['WE HAVE LIFTOFF', 'THROTTLE UP', 'STAGE ONE SEPARATED', 'PAST THE ATMOSPHERE', 'MOON IN SIGHT', 'ESCAPE VELOCITY', 'NEXT STOP: VALHALLA', 'BEYOND THE CHART'];
const SEPARATION = 3;
const FREEZE_S = 0.07;
const SLOW_S = 0.4;
type Outcome = 'rekt' | 'called' | 'rugged';
type Secured = { x100: number; payout: number | null };

function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  ctx.letterSpacing = `${Math.round(size * 0.1)}px`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.11);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
  ctx.letterSpacing = '0px';
}

function captionFor(view: SceneView, rung: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'RAPID UNSCHEDULED DISASSEMBLY' : outcome === 'called' ? 'CALLED IT FROM THE POD' : 'RUGGED IN ORBIT';
  if (view.phase === 'betting') return 'T-MINUS WEN';
  if (view.phase !== 'running') return 'WEN MOON?';
  if (secured) return 'POD AWAY, BAG SECURED';
  return CAPTIONS[rung]!;
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'synthwave', crash: 'boom' });
  const pop = spring(0);
  const badge = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let alt = 0;
  let wobble = 0, wobbleV = 0, climb = 0;
  const framing = spring(0);
  let booster = true;
  let rung = 0;
  let traffic = 0;
  let shake = 0;
  let freeze = 0;
  let slow = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let pod: Pod | null = null;
  let jeets: Jeet[] = [];
  let pieces: Piece[] = [];
  /** Seconds since the burst; -1 while the rocket is whole. */
  let fire = -1;

  function reset(): void {
    alt = 0; wobble = wobbleV = climb = 0; settleSpring(framing, 0);
    booster = true;
    rung = 0;
    traffic = 0;
    shake = freeze = slow = 0;
    outcome = null;
    secured = null;
    pod = null;
    jeets = [];
    pieces = [];
    fire = -1;
    settleSpring(pop, 0);
    settleSpring(badge, 0);
  }

    function eject(quiet: boolean): void {
    pod = quiet ? { x: -80, h: alt - 900, vx: 0, vy: -55, chute: spring(1), age: 9, angle: spring(0) } : createPod(alt, wobble, climb, wobbleV);
    if (!quiet) {
      audio.cashout();
      audio.fx('pop', 1.2);
    }
  }

    function burst(view: SceneView, quiet: boolean): void {
    outcome = view.stake === null ? 'rugged' : secured ? 'called' : 'rekt';
    fire = quiet ? 3 : 0;
    pieces = quiet ? [] : shred(PAD_X, camera(alt).y, view.currentX100, pod === null);
    if (quiet) {
      pop.x = 1;
      audio.crash('boom', true);
      return;
    }
    shake = 1;
    pop.v = 16;
    if (!reduced) {
      freeze = FREEZE_S;
      slow = SLOW_S;
    }
    audio.crash('boom');
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the burst frame, then the pieces fly slow before time catches up.
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * 0.3;
    }
    time += dt;
    if (view.phase === 'running') time = view.elapsed / 1000;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const growth = Math.log2(multiplier);
    const tension = 1 - Math.exp(-growth / 2.2);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const fresh = previous === null;
    const oldAlt = alt, oldWobble = wobble;
    if (running || crashed) alt = growth * PX_PER_DOUBLING;
    wobble = reduced ? 0 : Math.sin(time * 3) * 0.03 * tension + (view.elapsed > 45000 ? Math.sin(time * Math.PI / 9) * 0.07 : 0);
    if (real > 0 && !fresh) { climb += ((alt - oldAlt) / real - climb) * (1 - Math.exp(-real * 12)); wobbleV = (wobble - oldWobble) / real; }
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      eject(fresh || crashed);
    }
    if (fresh) {
      // The first frame can land anywhere in a round: settle into it rather than play it out.
      previous = view.phase;
      rung = RUNGS.filter((r) => multiplier >= r).length;
      booster = rung < SEPARATION;
      settleSpring(badge, secured ? 1 : 0);
      if (crashed) burst(view, true);
    } else if (view.phase !== previous) {
      if (crashed && fire < 0) burst(view, view.crashAge > 1500);
      if (running && previous === 'betting') {
        audio.fx('engine', 1);
        shake = 0.35;
      }
      if (view.phase === 'betting') reset();
      previous = view.phase;
    }
    audio.update(view.phase, tension);
    const next = RUNGS.filter((r) => multiplier >= r).length;
    if (running && next > rung) {
      for (let k = rung + 1; k <= next; k += 1) {
        audio.milestone(k);
        if (k >= 2) {
          jeets.push({ x: 0, h: alt + 120, vx: (k % 2 ? -1 : 1) * (50 + 20 * noise(k)) });
          audio.fx('scream', 0.35);
        }
        if (k === SEPARATION && booster) {
          booster = false;
          pieces.push({ x: PAD_X, y: camera(alt).y, vx: 30, vy: 140, a: 0, spin: 1.4, kind: 1, s: 1.6 });
          audio.fx('whoosh', 0.8);
        }
      }
      rung = next;
    }
    if (running && multiplier >= 15) {
      traffic += dt;
      if (traffic >= 12) {
        traffic %= 12;
        if (jeets.length < 8) jeets.push({ x: 0, h: alt + 120, vx: Math.sin(time) > 0 ? 65 : -65 });
        audio.fx('whoosh', 0.35);
      }
    }
    const cam = camera(alt);
    const screenY = (h: number): number => GROUND - h + cam.scroll;
    if (pod) {
      // Up and away from the nose, then the chute opens and the pod drifts down out of the picture.
      if (pod.age <= 0.55 && pod.age + dt > 0.55) audio.fx('whoosh', 0.5);
      stepPod(pod, dt, reduced);
    }
    for (const j of jeets) {
      j.x += j.vx * dt;
      j.h -= 70 * dt;
    }
    jeets = jeets.filter((j) => screenY(j.h) < 600);
    stepPieces(pieces, dt);
    if (fire >= 0) fire += dt;
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.5);
    stepSpring(framing, pod && pod.age < 3.5 ? Math.max(0, 220 - screenY(pod.h)) : 0, 6, 1, dt);
    const frog = { fear: crashed && pod === null ? 1 : tension, shades: secured !== null };

    ctx.save();
    if (!reduced) {
      const rumble = running ? tension * tension * 3 : 0;
      ctx.translate(Math.sin(time * 140) * (9 * shake * shake + rumble), Math.cos(time * 117) * (6 * shake * shake + rumble));
    }
    // Reframe the whole world continuously; the pod retains its physical trajectory.
    ctx.translate(0, framing.x);
    drawWorld(ctx, alt, growth, time, reduced, framing.x);
    for (const j of jeets) drawJeet(ctx, PAD_X + j.x, screenY(j.h), time);
    if (fire < 0) {
      ctx.save();
      ctx.translate(PAD_X, cam.y);
      drawRocket(ctx, { booster, piloted: pod === null, frog, flame: running ? 30 + 130 * tension : 0, flicker: reduced ? 0 : noise(Math.floor(time * 40)), wobble });
      ctx.restore();
    } else if (fire < 2) {
      // The fireball blooms and fades.
      const r = 160 * (1 - Math.exp(-fire * 5));
      const fade = clamp(1.6 - fire * 0.8, 0, 1);
      const glow = ctx.createRadialGradient(PAD_X, cam.y - 110, 0, PAD_X, cam.y - 110, r);
      glow.addColorStop(0, `rgba(255, 255, 255, ${fade})`);
      glow.addColorStop(0.4, `rgba(253, 224, 71, ${fade * 0.9})`);
      glow.addColorStop(1, 'rgba(249, 115, 22, 0)');
      disc(ctx, PAD_X, cam.y - 110, r, glow);
    }
    drawPieces(ctx, pieces);
    if (pod) {
      drawPod(ctx, pod, screenY(pod.h), frog, time);
    }
    if (fire >= 0 && fire < 0.3) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.3 - fire) * (reduced ? 0.8 : 2.5)})`;
      ctx.fillRect(0, 0, 960, 540);
    }
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(PAD_X, Math.min(cam.y - 60, 400));
      ctx.rotate(-0.1);
      ctx.scale(clamp(pop.x, 0, 1.3), clamp(pop.x, 0, 1.3));
      memeText(ctx, outcome === 'rekt' ? 'REKT' : outcome === 'called' ? 'CALLED IT' : 'RUGGED', 0, 0, 92, outcome === 'called' ? '#ffe27a' : '#ff4d6d', 'center');
      ctx.restore();
    }
    ctx.restore();

    // The HUD: the caption, the secured badge, the multiplier and the altitude.
    memeText(ctx, captionFor(view, rung, outcome, secured), 400, 64, 40, '#ffffff', 'center', 600);
    if (secured && badge.x > 0.02) {
      ctx.save();
      ctx.translate(400, 104);
      ctx.scale(clamp(badge.x, 0, 1.15), clamp(badge.x, 0, 1.15));
      memeText(ctx, `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`, 0, 0, 26, '#7cf67c', 'center');
      ctx.restore();
    }
    memeText(ctx, `${multiplier.toFixed(2)}×`, 936, 68, 56, outcome === 'rekt' ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a', 'right', 220);
    memeText(ctx, running || crashed ? `ALT ${(alt / 40).toFixed(1)} KM` : 'MISSION $MOON', 24, 520, 22, '#bfe3ff', 'left');
  }

  return { draw };
}
