import { pageAudio } from './audio';
import { clamp, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
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
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void }

/** Rungs: a caption and a stinger; the booster drops at the second, a jeet bails from the third. */
const RUNGS = [1.25, 1.5, 1.8, 2.2, 2.7, 3.3, 5, 8, 15];
const CAPTIONS = ['GM. FUELED BY HOPIUM', 'DEV IS NOT SELLING', 'DEV WALLET JETTISONED', 'PROBABLY NOTHING', 'FEW UNDERSTAND', 'NUMBER GO UP', "WE'RE SO BACK", 'WAGMI (NFA)', 'NEXT STOP: VALHALLA', 'BEYOND THE CHART'];
const SEPARATION = 2;
const FREEZE_S = 0.15;
const SLOW_S = 0.4;
const ENDINGS = { rekt: ['REKT', 'RAPID UNSCHEDULED DISASSEMBLY', '#ff4d6d'], called: ['CALLED IT', 'CALLED IT FROM THE POD', '#ffe27a'], rugged: ['RUGGED', 'NO BAG, NO PAIN', '#ff4d6d'] };
type Outcome = keyof typeof ENDINGS;
type Secured = { x100: number; payout: number | null };

function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  ctx.letterSpacing = `${Math.round(size * 0.1)}px`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, size * 0.11); ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill; ctx.fillText(text, x, y, maxWidth);
  ctx.letterSpacing = '0px';
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'boom' });
  const pop = spring(0), badge = spring(0), framing = spring(0), squat = spring(0);
  let last: number | null = null;
  let previous: SceneView['phase'] | null = null;
  let time = 0, alt = 0, wobble = 0, wobbleV = 0, climb = 0, rung = 0, traffic = 0, shake = 0, freeze = 0, slow = 0, vent = 0;
  let outcome: Outcome | null = null, stamp: Outcome = 'rekt';
  let secured: Secured | null = null;
  let pod: Pod | null = null;
  let jeets: Jeet[] = [], pieces: Piece[] = [];
  /** Seconds since the burst; -1 while the rocket is whole. */
  let fire = -1;

  function burst(view: SceneView, quiet: boolean): void {
    stamp = outcome = view.stake === null ? 'rugged' : secured ? 'called' : 'rekt';
    fire = quiet ? 3 : 0;
    audio.crash('boom', quiet);
    if (quiet) pop.x = 1;
    else {
      pieces.push(...shred(PAD_X, GROUND - alt, view.currentX100, !secured));
      shake = 1; pop.v = 16;
      { freeze = FREEZE_S; slow = SLOW_S; }
    }
  }
  // Off the hull with a kick, then the chute.
  const bail = (side: number, speed: number): number => jeets.push({ x: side * 20 + 120 * wobble, h: alt + 120, vx: side * speed, vy: climb + 150, t: 0 });

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the burst frame, then plays slow.
    let dt = real;
    if (freeze > 0) { freeze -= real; dt = 0; } else if (slow > 0) { slow -= real; dt = real * 0.3; }
    const running = view.phase === 'running', crashed = view.phase === 'crashed', idle = !running && !crashed;
    time = running ? view.elapsed / 1000 : time + dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    // 0.33 at 1.5×, 0.5 at 2×, 0.67 at 3×.
    const tension = 1 - 1 / multiplier;
    const fresh = previous === null;
    const oldAlt = alt, oldWobble = wobble;
    alt = idle ? (alt * Math.exp(-dt * 9)) : Math.log2(multiplier) * PX_PER_DOUBLING;
    wobble = Math.sin(time * 3) * 0.04 * tension + (view.elapsed > 45000 ? Math.sin(time * Math.PI / 9) * 0.07 : 0);
    if (real > 0 && !fresh) { climb += ((alt - oldAlt) / real - climb) * (1 - Math.exp(-real * 12)); wobbleV = (wobble - oldWobble) / real; }
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (!fresh && !crashed) { pod = createPod(alt, wobble, climb, wobbleV); audio.cashout(); audio.fx('pop', 1.2); }
    }
    const next = RUNGS.filter((r) => multiplier >= r).length;
    if (fresh) {
      // A first frame mid-round settles into it.
      previous = view.phase;
      rung = next;
      settleSpring(badge, secured ? 1 : 0);
      settleSpring(squat, idle ? 4 : 0);
      if (crashed) burst(view, true);
    } else if (view.phase !== previous) {
      if (crashed && fire < 0) burst(view, view.crashAge > 1500);
      if (running && previous === 'betting') { audio.fx('engine', 1); shake = 0.35; }
      // A new rocket; the camera dives back to the pad.
      if (idle) {
        climb = rung = traffic = shake = freeze = slow = 0; fire = -1;
        outcome = secured = null;
        settleSpring(badge, 0);
      }
      previous = view.phase;
    }
    audio.update(view.phase, tension);
    if (running && next > rung) {
      for (let k = rung + 1; k <= next; k += 1) {
        audio.milestone(k);
        if (k > SEPARATION) { bail(k % 2 ? -1 : 1, 50 + 20 * noise(k)); audio.fx('scream', 0.35); }
        if (k === SEPARATION) {
          pieces.push({ x: PAD_X, y: GROUND - alt - 37, vx: 25, vy: -20 - climb, a: wobble, spin: 1.2, kind: 4, s: 1 });
          audio.fx('whoosh', 0.8);
        }
      }
      rung = next;
    }
    if (running && multiplier >= 15) {
      traffic += dt;
      if (traffic >= 12) {
        traffic %= 12;
        bail(Math.sin(time) > 0 ? 1 : -1, 65);
        audio.fx('whoosh', 0.35);
      }
    }
    const cam = camera(alt), by = cam.y - 110;
    const screenY = (h: number): number => GROUND - h + cam.scroll;
    if (pod) {
      // Up from the nose, then the chute opens.
      if (pod.age <= 0.55 && pod.age + dt > 0.55) audio.fx('whoosh', 0.5);
      stepPod(pod, dt);
    }
    for (const j of jeets) {
      j.t += dt;
      if (j.t > 0.15) j.vy += (-70 - j.vy) * (1 - Math.exp(-dt * 6));
      j.x += j.vx * dt; j.h += j.vy * dt;
    }
    // Leftovers fade out as the new rocket fades in.
    const left = idle ? clamp(1 - squat.x / 3, 0, 1) : 1;
    if (!left) pod = null;
    jeets = jeets.filter((j) => left && Math.abs(screenY(j.h) - 270) < 340);
    stepPieces(pieces, dt);
    pieces = pieces.filter((p) => left && Math.abs(p.y + cam.scroll - 320) < 380);
    vent += dt;
    if (fire >= 0) fire += dt;
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(squat, idle ? 4 : 0, 6, 0.45, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.5);
    stepSpring(framing, pod && !idle && pod.age < 3.5 ? Math.max(0, 220 - screenY(pod.h)) : 0, 6, 1, dt);

    ctx.save();
    {
      const rumble = running ? 0.6 + 4 * tension : 0;
      ctx.translate(Math.sin(time * 140) * (9 * shake * shake + rumble), Math.cos(time * 117) * (6 * shake * shake + rumble));
      // The burst punches in through the hit-stop.
      const zoom = fire >= 0 ? 1.1 - 0.1 * smoothstep(0, 0.3, fire) : 1;
      ctx.translate(PAD_X, by); ctx.scale(zoom, zoom); ctx.translate(-PAD_X, -by);
    }
    // Reframe the world to keep the pod in view.
    ctx.translate(0, framing.x);
    drawWorld(ctx, alt, time, framing.x);
    if (fire < 0) {
      ctx.save();
      ctx.translate(PAD_X, screenY(idle ? 0 : alt) + squat.x);
      if (idle) ctx.globalAlpha = 1 - left;
      drawRocket(ctx, { booster: rung < SEPARATION, piloted: !secured, frog: { fear: tension, shades: false }, flame: running ? (30 + 130 * tension) * smoothstep(0, 0.4, time) : 0, flicker: noise(Math.floor(time * 40)), wobble });
      ctx.restore();
    } else if (fire < 2) {
      // The fireball blooms and fades.
      const r = 160 * (1 - Math.exp(-fire * 5)), fade = clamp(1.3 - fire, 0, 1), glow = ctx.createRadialGradient(PAD_X, by, 0, PAD_X, by, r);
      glow.addColorStop(0, `rgba(255, 255, 255, ${fade})`);
      glow.addColorStop(0.4, `rgba(253, 224, 71, ${fade * 0.9})`);
      glow.addColorStop(1, 'rgba(249, 115, 22, 0)');
      disc(ctx, PAD_X, by, r, glow);
    }
    // The pad vents fuel.
    for (let i = 0; i < 6 && squat.x > 0.1; i++) {
      const k = ((vent * 0.5) + i / 6) % 1;
      ctx.globalAlpha = squat.x / 6 * (1 - k);
      disc(ctx, PAD_X + (i % 2 ? 1 : -1) * (26 + 60 * k), screenY(0) - 8 - 24 * k, 7 + 18 * k, '#f1f5f9');
    }
    ctx.globalAlpha = left;
    drawPieces(ctx, pieces, cam.scroll);
    for (const j of jeets) {
      const x = PAD_X + j.x, y = screenY(j.h);
      drawJeet(ctx, x, y, j.t);
      ctx.globalAlpha = clamp(6 - 4 * j.t, 0, left);
      memeText(ctx, j.vx < 0 ? 'JEET' : 'ngmi', x, y - 52, 18, '#fca5a5', 'center');
      ctx.globalAlpha = left;
    }
    if (pod) drawPod(ctx, pod, screenY(pod.h));
    if (fire >= 0 && fire < 0.3) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.3 - fire) * (2.5)})`;
      ctx.fillRect(0, 0, 960, 540);
    }
    if (pop.x > 0.02) {
      const [word, , colour] = ENDINGS[stamp], s = Math.min(pop.x, 1.3);
      ctx.save();
      ctx.translate(PAD_X, Math.min(cam.y - 60, 400));
      ctx.rotate(-0.1);
      ctx.scale(s, s);
      memeText(ctx, word!, 0, 0, 92, colour!, 'center');
      ctx.restore();
    }
    ctx.restore();

    // The HUD.
    memeText(ctx, outcome ? ENDINGS[outcome][1]! : view.phase === 'betting' ? 'T-MINUS WEN' : !running ? 'WEN MOON?' : secured ? 'JEETED. BAG SECURED' : CAPTIONS[rung]!, 400, 64, 40, '#ffffff', 'center', 600);
    if (secured && badge.x > 0.02) {
      ctx.save();
      ctx.translate(400, 104);
      const b = Math.min(badge.x, 1.15);
      ctx.scale(b, b);
      memeText(ctx, `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`, 0, 0, 26, '#7cf67c', 'center');
      ctx.restore();
    }
    memeText(ctx, `${multiplier.toFixed(2)}×`, 936, 68, 56, outcome === 'rekt' ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a', 'right', 220);
    memeText(ctx, idle ? 'MISSION $MOON' : `ALT ${(alt / 40).toFixed(1)} KM`, 24, 520, 22, '#bfe3ff', 'left');
  }

  return { draw };
}
