/** Rug Piste: original downhill arcade presentation of the shared, committed crash round. */
import { pageAudio } from './audio';
import { createInput } from './input';
import { clamp, createWorld, stepWorld, type World } from './course';
import { drawSkier, drawYeti, drawYetiHands, drawYetiTeeth, drawTree, drawCoin, drawRock, drawRug, drawRamp, drawSign, drawLift } from './art';
import { yetiPose, reducedCrashAge, ENDING_SECONDS, YETI_SCALE, HOLE_BELOW_SKIER, MOUTH_TOP, MOUTH_BOTTOM } from './yeti-rig';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number; elapsed: number; crashAge: number;
  stake: number | null; cashoutX100: number | null; payout: number | null;
}
export interface SceneOptions { reducedMotion?: boolean }
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void; dispose(): void }
interface Field { x: number; y: number; w: number; h: number }
const C = { ink: '#282348', purple: '#6451be', lime: '#cefa65', snow: '#fafbf5', shade: '#e2e4f0', grey: '#d9d9e1', muted: '#77758b', pink: '#ec759d' };
const formatX = (n: number) => `${(n / 100).toFixed(2)}×`;
const ease = (n: number) => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
// A shell replacement after a short hidden-tab gap can recover local arcade progress.
let live: { world: World; elapsed: number; wall: number; manual: boolean } | null = null;

function text(ctx: CanvasRenderingContext2D, line: string, x: number, y: number, size = 14, color = C.ink, align: CanvasTextAlign = 'left', max = 1000) {
  ctx.fillStyle = color; ctx.font = `bold ${size}px "Courier New", monospace`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(line, x, y, max);
}
function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color = C.grey) {
  ctx.fillStyle = C.ink; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = '#fff'; ctx.fillRect(x + 3, y + 3, w - 6, 2); ctx.fillRect(x + 3, y + 3, 2, h - 6);
  ctx.fillStyle = '#aaa8bd'; ctx.fillRect(x + w - 5, y + 5, 2, h - 8); ctx.fillRect(x + 5, y + h - 5, w - 8, 2);
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'chiptune', bpm: 132, crash: 'boom', music: 0.35, tempoRise: 0.12 });
  const canvas = document.querySelector('canvas')!;
  let field: Field = { x: 14, y: 78, w: 682, h: 410 };
  let width = 960;
  const input = createInput(canvas, clientX => {
    const box = canvas.getBoundingClientRect();
    return clamp(((clientX - box.left) / Math.max(1, box.width) * width - field.x) / field.w, 0.055, 0.945);
  });
  let world = createWorld();
  let manual = false;
  let previous: SceneView['phase'] | null = null;
  let last = 0;
  let lastElapsed = 0;
  let secured: number | null = null;
  let escapeAt = 0;
  let escapeX = 0.5;
  let toast = '';
  let toastUntil = 0;
  let ariaAt = -1;
  let crashAngle = 0;
  let ending: { view: SceneView; startedAt: number } | null = null;

  function draw(ctx: CanvasRenderingContext2D, incoming: SceneView, now: number) {
    // A live host may reopen betting after two seconds. Finish this presentation during betting,
    // while the untouched shell already offers the next round's controls. Never delay a running round.
    if (incoming.phase === 'crashed') ending = { view: { ...incoming }, startedAt: now - incoming.crashAge };
    else if (incoming.phase === 'running' || document.documentElement.dataset.mode === 'replay') ending = null;
    const previousEnding = incoming.phase !== 'crashed' && ending !== null && now - ending.startedAt < ENDING_SECONDS * 1000;
    const view = previousEnding && ending ? { ...ending.view, crashAge: Math.max(0, now - ending.startedAt) } : incoming;
    if (!previousEnding && incoming.phase !== 'crashed') ending = null;
    const first = previous === null;
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const reset = view.phase === 'betting' && previous !== 'betting' || running && (previous === 'crashed' || view.elapsed < lastElapsed - 200);
    let dt = last ? clamp((now - last) / 1000, 0, 0.1) : 0;
    last = now;
    if (reset) {
      world = createWorld(); secured = null; escapeAt = 0; toast = ''; live = null;
    }
    if (first && (running || crashed)) {
      const same = live && running && view.elapsed >= live.elapsed && Math.abs(view.elapsed - live.elapsed - (Date.now() - live.wall)) < 4000;
      if (same && live) { world = live.world; manual = live.manual; }
      else world = createWorld(view.elapsed);
    }
    const command = input.take();
    manual ||= command.touched;
    command.touched = manual;
    // Only the host-confirmed cashout changes the ending. An input never sets secured.
    if (view.cashoutX100 !== null && secured === null) {
      secured = view.cashoutX100; escapeX = world.x;
      escapeAt = first || crashed ? now - 2200 : now;
      if (!first && running) audio.cashout();
    }
    if (crashed && previous !== 'crashed') {
      crashAngle = -world.lean * 0.12 + Math.sin(now * 0.04) * world.stumble * 0.12;
      audio.crash('boom', first || view.crashAge > 1500);
    }
    audio.update(view.phase, clamp(Math.log2(Math.max(1, view.currentX100 / 100)) / 7, 0, 1));
    if (running && secured === null) {
      // Substeps keep contacts consistent at low frame rates; hidden gaps never fast-forward collisions.
      while (dt > 0.000001) {
        const step = Math.min(dt, 1 / 60);
        for (const event of stepWorld(world, step, command)) {
          if (event === 'coin') audio.fx('coin', 0.28);
          if (event === 'bonk') { audio.fx('thud', 0.55); toast = 'PAPER KNEES!  -25 STYLE'; toastUntil = now + 1200; }
          if (event === 'jump') audio.fx('whoosh', 0.3);
          if (event === 'ramp') { audio.fx('ding', 0.45); toast = 'SEND IT!  +50 STYLE'; toastUntil = now + 1100; }
        }
        command.jump = false;
        dt -= step;
      }
    }
    if (running) live = { world, elapsed: view.elapsed, wall: Date.now(), manual };
    previous = view.phase; lastElapsed = view.elapsed;
    const rect = canvas.getBoundingClientRect();
    const portrait = rect.width / Math.max(1, rect.height) < 1;
    width = portrait ? 600 : 960;
    const height = portrait ? 750 : 540;
    field = portrait ? { x: 12, y: 190, w: 576, h: 516 } : { x: 14, y: 78, w: 682, h: 410 };
    const scale = field.w / 640;
    const skierY = field.y + field.h * (portrait ? 0.38 : 0.39);
    const skierX = field.x + world.x * field.w;
    const yetiX = clamp(skierX, field.x + 66 * scale, field.x + field.w - 66 * scale);
    const crashAge = reduced && crashed ? reducedCrashAge(view.crashAge / 1000) : view.crashAge / 1000;
    const escape = secured === null ? 0 : ease((now - escapeAt) / (reduced ? 1 : 1800));
    const visualTime = reduced ? 0 : now;

    ctx.save();
    ctx.scale(960 / width, 540 / height);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = C.grey; ctx.fillRect(0, 0, width, height);
    panel(ctx, 2, 2, width - 4, height - 4);
    ctx.fillStyle = C.ink; ctx.fillRect(7, 7, width - 14, 29);
    ctx.fillStyle = C.lime; ctx.fillRect(15, 14, 14, 14);
    text(ctx, 'RUG PISTE', 39, 22, 18, '#fff');
    text(ctx, portrait ? 'v1.0' : 'DEGEN ALPINE CLUB / EST. 1991', width - 84, 22, 11, '#c9c1e9', 'right');
    panel(ctx, width - 65, 11, 24, 21); text(ctx, '−', width - 53, 21, 18, C.ink, 'center');
    panel(ctx, width - 37, 11, 24, 21); text(ctx, '×', width - 25, 22, 18, C.ink, 'center');
    text(ctx, 'BLACK DIAMOND', 17, 55, portrait ? 16 : 13);
    text(ctx, '// BAGHOLDER BASIN', portrait ? 158 : 169, 55, portrait ? 14 : 12, C.muted);
    text(ctx, manual ? 'MANUAL' : 'DEMO', width - 20, 55, portrait ? 14 : 12, C.purple, 'right');
    ctx.fillStyle = '#aaa8bd'; ctx.fillRect(10, 69, width - 20, 2);

    // Snowfield: world-space marks scroll uphill while the skier carves downhill.
    ctx.save();
    ctx.beginPath(); ctx.rect(field.x, field.y, field.w, field.h); ctx.clip();
    ctx.fillStyle = C.snow; ctx.fillRect(field.x, field.y, field.w, field.h);
    ctx.strokeStyle = C.shade; ctx.lineWidth = 1;
    const scroll = world.distance * scale;
    for (let row = -1; row < Math.ceil(field.h / 52) + 1; row++) {
      const y = field.y + row * 52 - scroll % 52;
      for (let col = 0; col < 12; col++) {
        const x = field.x + col * 67 + (row % 2) * 23;
        ctx.fillStyle = (row + col) % 3 ? '#e9eaf1' : '#d9dce9';
        ctx.fillRect(x, y, 3, 2); ctx.fillRect(x + 14, y + 27, 8, 1);
      }
    }
    // Alternating resort rope posts and powder banks delineate the playable slope.
    for (const edge of [0, 1]) {
      const x = field.x + edge * field.w;
      ctx.fillStyle = '#ececf4'; ctx.fillRect(x - (edge ? 17 : 0), field.y, 17, field.h);
      for (let n = -1; n < Math.ceil(field.h / 92) + 1; n++) {
        const y = field.y + n * 92 - scroll % 92;
        ctx.fillStyle = C.purple; ctx.fillRect(x + (edge ? -9 : 6), y, 3, 22);
        ctx.fillStyle = C.pink; ctx.fillRect(x + (edge ? -16 : 9), y, 10, 7);
      }
    }
    if (world.distance < 260) {
      const sy = skierY - 100 - world.distance * scale;
      ctx.fillStyle = '#dcebc5'; ctx.fillRect(field.x + 32, sy - 8, field.w - 64, 2);
      text(ctx, '↓  APES ONLY. NO REFUNDS.  ↓', field.x + field.w / 2, sy - 26, portrait ? 14 : 16, C.purple, 'center');
    }
    for (const trail of world.trails) {
      const y = skierY + (trail.z - world.distance) * scale;
      const x = field.x + trail.x * field.w;
      ctx.fillStyle = '#d5d8e8';
      for (const offset of [-7, 7]) ctx.fillRect(x + offset * scale, y - 3, 2 * scale, 8 * scale);
    }
    // Depth sorting makes trees pass naturally in front of the skier.
    const objects = world.objects.filter(o => (o.kind !== 'coin' || !o.used) && Math.abs(o.z - world.distance) < 650)
      .map(o => ({ object: o, y: skierY + (o.z - world.distance) * scale }));
    let skierDrawn = false;
    const drawPlayer = () => {
      if (secured !== null || crashed) return;
      ctx.save(); ctx.translate(skierX, skierY); ctx.scale(scale, scale);
      drawSkier(ctx, 0, 0, { lean: world.lean, jump: world.jump * 46, time: visualTime, stumble: world.stumble });
      ctx.restore();
    };
    for (const entry of objects.sort((a, b) => a.y - b.y)) {
      if (!skierDrawn && entry.y > skierY) { drawPlayer(); skierDrawn = true; }
      if (entry.y < field.y - 90 || entry.y > field.y + field.h + 95) continue;
      const o = entry.object;
      ctx.save(); ctx.translate(field.x + o.x * field.w, entry.y); ctx.scale(scale, scale);
      if (o.kind === 'tree') drawTree(ctx, 0, 0, o.id % 3);
      if (o.kind === 'coin') drawCoin(ctx, 0, -10, visualTime + o.id * 200);
      if (o.kind === 'rock') drawRock(ctx, 0, 0);
      if (o.kind === 'rug') drawRug(ctx, 0, 0);
      if (o.kind === 'ramp') drawRamp(ctx, 0, 0);
      ctx.restore();
    }
    if (!skierDrawn) drawPlayer();
    if (world.stumble > 0 && running && secured === null) text(ctx, 'REKT!', skierX, skierY - 80 * scale, 15, C.purple, 'center');
    if (!running && !crashed) {
      drawSign(ctx, field.x + field.w - 92, field.y + field.h - 50, 'WEN SNOW');
      panel(ctx, field.x + 36, field.y + field.h - 91, field.w - 72, 62, '#f1f3e7');
      text(ctx, view.phase === 'betting' ? 'GM. THE SLOPE IS OPEN.' : 'NEXT RUN LOADING...', field.x + field.w / 2, field.y + field.h - 68, portrait ? 19 : 20, C.ink, 'center');
      text(ctx, 'CARVE • COLLECT • CASH OUT', field.x + field.w / 2, field.y + field.h - 46, 13, C.purple, 'center');
    }
    if (secured !== null) {
      const liftX = field.x + escapeX * field.w + (field.w * 0.77 - escapeX * field.w) * escape;
      const liftY = skierY + 15 - escape * 84 * scale;
      ctx.save(); ctx.translate(liftX, liftY); ctx.scale(scale, scale);
      drawLift(ctx, 0, 0, visualTime);
      drawSkier(ctx, 0, -8, { lean: 0, jump: 0, time: visualTime, stumble: 0, scale: 0.72 });
      ctx.restore();
      text(ctx, 'BAGS SECURED', liftX, liftY + 28 * scale, 13, C.purple, 'center');
    }
    if (crashed) {
      const holeY = skierY + HOLE_BELOW_SKIER * scale;
      const pose = yetiPose(crashAge, { skierOffsetX: (skierX - yetiX) / scale, jumpHeight: world.jump * 46, angle: crashAngle, escaped: secured !== null });
      // The hole is created only after the authoritative phase changes to crashed.
      ctx.save(); ctx.translate(yetiX, holeY); ctx.scale(scale * YETI_SCALE, scale * YETI_SCALE);
      const face = { mouth: pose.mouth, chew: pose.chew, time: reduced ? 0 : view.crashAge };
      const heldSkier = () => {
        if (!pose.skier.visible) return;
        ctx.save();
        if (pose.skier.clipMouth) {
          // The skier stays full size: the mouth and lower jaw occlude each part as it is eaten.
          ctx.beginPath();
          ctx.rect(-500, -600, 1000, 600 + MOUTH_TOP);
          ctx.rect(-24, MOUTH_TOP, 48, MOUTH_BOTTOM - MOUTH_TOP);
          ctx.clip();
        }
        ctx.translate(pose.skier.torso.x, pose.skier.torso.y);
        ctx.rotate(pose.skier.angle);
        ctx.scale(pose.skier.scale * pose.skier.width, pose.skier.scale);
        drawSkier(ctx, 0, 30, { lean: 0, jump: 0, time: visualTime, stumble: 0, shadow: false });
        ctx.restore();
      };
      // Back-facing grab: the skier is behind the torso. The turn brings them around in front.
      if (pose.skier.behind) heldSkier();
      drawYeti(ctx, 0, 0, { rise: pose.rise, ...face, arms: pose.arms, turn: pose.turn, turnDirection: pose.turnDirection });
      if (!pose.skier.behind) heldSkier();
      // Foreground teeth and wrapping fingers keep the grip and the bite visible.
      if (pose.turn === 1 && (pose.skier.clipMouth || !pose.skier.visible)) drawYetiTeeth(ctx, 0, 0, face);
      drawYetiHands(ctx, 0, 0, pose.arms);
      if (!reduced && crashAge < 0.8) {
        for (let i = 0; i < 10; i++) {
          const dx = (i - 4.5) * 19 * crashAge;
          const dy = -Math.sin(Math.PI * crashAge / 0.8) * (35 + i % 3 * 13);
          ctx.fillStyle = i % 2 ? '#ffffff' : '#c5c0dc';
          ctx.fillRect(dx - 3, dy - 3, 6, 5);
        }
      }
      ctx.restore();
      if (pose.captionReady) {
        const label = secured === null ? 'BURP. DIAMOND HANDS, PAPER SKIS.' : 'THE YETI MISSED YOUR BAGS.';
        const bw = Math.min(field.w - 40, 470);
        panel(ctx, field.x + (field.w - bw) / 2, field.y + field.h - 91, bw, 67, secured === null ? '#eee5f6' : '#e7f3d5');
        text(ctx, secured === null ? 'GOBBLED AT ' + formatX(view.currentX100) : 'CASHED OUT AT ' + formatX(secured), field.x + field.w / 2, field.y + field.h - 66, portrait ? 23 : 25, C.ink, 'center');
        text(ctx, label, field.x + field.w / 2, field.y + field.h - 42, portrait ? 11 : 12, C.purple, 'center');
      }
    } else if (toast && now < toastUntil) {
      panel(ctx, field.x + 42, field.y + field.h - 48, field.w - 84, 31, C.lime);
      text(ctx, toast, field.x + field.w / 2, field.y + field.h - 32, 14, C.ink, 'center');
    }
    ctx.restore();
    ctx.strokeStyle = '#9391ac'; ctx.lineWidth = 2; ctx.strokeRect(field.x, field.y, field.w, field.h);

    const status = previousEnding ? `PREVIOUS RUN • ${incoming.phase === 'betting' ? 'NEXT ROUND OPEN' : 'FINISHING'}` : secured !== null ? 'LIFT EXIT CONFIRMED' : crashed ? 'YETI HAS ENTERED CHAT' : running ? 'FULL SEND, FREN.' : 'WELCOME TO THE TRENCHES';
    if (portrait) {
      panel(ctx, 12, 78, 280, 101, C.ink);
      text(ctx, previousEnding ? 'PREVIOUS ROUND' : crashed ? 'ROUND CRASHED' : 'ROUND MULTIPLIER', 28, 96, 15, '#c2b9e3');
      text(ctx, formatX(view.currentX100), 28, 136, 44, crashed ? C.pink : C.lime, 'left', 246);
      panel(ctx, 302, 78, 286, 101, '#ececf3');
      text(ctx, '$SLOPE', 318, 98, 16, C.purple); text(ctx, `${world.coins}`, 568, 99, 24, C.ink, 'right');
      text(ctx, 'STYLE', 318, 129, 16, C.purple); text(ctx, String(world.style).padStart(5, '0'), 568, 129, 23, C.ink, 'right');
      text(ctx, 'ARCADE POINTS ONLY', 318, 160, 14, C.muted);
    } else {
      const x = 710, w = 236;
      panel(ctx, x, 78, w, 112, C.ink);
      text(ctx, previousEnding ? 'PREVIOUS ROUND' : crashed ? 'ROUND CRASHED' : 'ROUND MULTIPLIER', x + 14, 100, 12, '#c2b9e3');
      text(ctx, formatX(view.currentX100), x + 14, 143, 49, crashed ? C.pink : C.lime, 'left', w - 28);
      text(ctx, secured !== null ? `EXIT ${formatX(secured)} CONFIRMED` : crashed ? 'ROUND ENDED. NGMI.' : 'CASH OUT BEFORE THE CHOMP', x + 14, 177, 10, '#ded7ed');
      panel(ctx, x, 201, w, 115, '#ececf3');
      text(ctx, 'COIN BAG', x + 14, 219, 11, C.purple);
      text(ctx, String(world.coins).padStart(2, '0'), x + 14, 248, 31); text(ctx, '$SLOPE', x + w - 15, 250, 15, C.purple, 'right');
      ctx.fillStyle = '#c9c7d8'; ctx.fillRect(x + 14, 271, w - 28, 1);
      text(ctx, 'STYLE', x + 14, 292, 12, C.purple); text(ctx, String(world.style).padStart(5, '0'), x + w - 15, 292, 23, C.ink, 'right');
      panel(ctx, x, 327, w, 87, '#e6e8d9');
      text(ctx, 'SLOPE BULLETIN', x + 14, 345, 11, C.purple);
      const bulletins = [['DEV SOLD THE CHALET.', 'SAYS HE IS STILL IN.'], ['BUY THE DIP?', 'THIS IS A MOUNTAIN.'], ['DIAMOND HANDS.', 'QUESTIONABLE KNEES.'], ['AUDIT: TRUST ME BRO.', 'YETI: TRUST ME, BRO.'], ['WEN LAMBO?', 'BEST WE CAN DO: SKIS.']];
      const lines = bulletins[Math.floor(view.elapsed / 9000) % bulletins.length];
      text(ctx, lines[0], x + 14, 372, 12); text(ctx, lines[1], x + 14, 392, 12);
      text(ctx, manual ? 'YOU ARE AT THE WHEEL.' : 'DEMO • STEER TO TAKE OVER', x + w / 2, 436, 11, C.purple, 'center');
      text(ctx, '← → CARVE   ↑ JUMP', x + w / 2, 458, 13, C.ink, 'center');
      text(ctx, 'COINS = ARCADE POINTS ONLY', x + w / 2, 481, 10, C.muted, 'center');
    }
    const footerY = height - 28;
    panel(ctx, 12, footerY, width - 24, 21, '#e4e3eb');
    ctx.fillStyle = crashed ? C.pink : C.purple; ctx.fillRect(19, footerY + 7, 7, 7);
    text(ctx, status, 34, footerY + 11, portrait ? 14 : 12);
    text(ctx, `${Math.floor(world.distance / 10)}m  ↓`, width - 24, footerY + 11, 12, C.purple, 'right');
    ctx.restore();
    if (Math.floor(now / 1000) !== ariaAt) {
      ariaAt = Math.floor(now / 1000);
      canvas.setAttribute('aria-label', `Rug Piste. ${previousEnding ? 'Previous round ending; current round is ' + incoming.phase + '.' : view.phase} ${formatX(view.currentX100)}. ${world.coins} arcade coins, ${world.style} style points. ${manual ? 'Manual steering.' : 'Demo skiing; use arrow keys or drag to steer.'}${secured !== null ? ` Cashout confirmed at ${formatX(secured)}.` : ''}`);
    }
  }
  return { draw, dispose: () => input.dispose() };
}
