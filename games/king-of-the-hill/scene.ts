/**
 * Composes King of the Hill from the room state: the altitude sky, the
 * bonding-curve hill, the coin, the ape, the Lambo that collects him on an
 * accepted exit, the community that keeps pushing after he leaves, then the
 * HUD. All motion is stepped here with the real frame time, and nothing
 * drawn here changes the committed outcome.
 */
import { type ApeState, createApe, drawApe, resetApe, stepApe } from './ape';
import { type CoinDrive, type CoinState, coinPose, crashCoin, createCoin, drawCoin, resetCoin, settleCoin, stepCoin } from './coin';
import { type Camera, type Point, drawHill, drawSky, heightAt, slopeAngle, toScreen } from './hill';
import { clamp, settleSpring, spring, stepSpring } from './motion';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
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
  /** Drops the screen shake and twinkle. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const W = 960;
const INK = '#1c1f26';
const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** World px up the hill per doubling of the multiplier. */
const PX_PER_DOUBLING = 620;
const TICKER = '$CRASH';
type Outcome = 'rekt' | 'called' | 'rugged';
type Secured = { x100: number; payout: number | null };
type LamboMode = 'none' | 'arriving' | 'waiting' | 'leaving';

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

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'DEV SOLD' : outcome === 'called' ? 'CALLED IT' : 'RUGGED';
  if (view.phase !== 'running') return 'WEN LAUNCH?';
  if (secured) return 'DEAL WITH IT';
  if (multiplier < 1.3) return 'PUSH IT';
  if (multiplier < 1.6) return 'NUMBER GO UP';
  if (multiplier < 2.5) return 'KING OF THE HILL';
  if (multiplier < 4) return 'WEN GRADUATION';
  if (multiplier < 6) return 'GRADUATED';
  if (multiplier < 12) return 'TO THE MOON';
  return 'THIS IS FINE';
}

function formatMcap(multiplier: number): string {
  const usd = 5000 * Math.pow(multiplier, 1.9);
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
  return `$${(usd / 1e3).toFixed(1)}K`;
}

/** A lime Lambo on the slope, drawn in the slope's frame at a world x. */
function drawLambo(ctx: CanvasRenderingContext2D, cam: Camera, x: number, wheelSpin: number, apeInside: boolean): void {
  const p = toScreen(cam, { x, y: heightAt(x) });
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-slopeAngle(x));
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#b6ff3b';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-78, -6); ctx.lineTo(-74, -20); ctx.lineTo(-40, -24); ctx.lineTo(-12, -42); ctx.lineTo(30, -42); ctx.lineTo(58, -24); ctx.lineTo(80, -18); ctx.lineTo(82, -6); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#233';
  ctx.beginPath(); ctx.moveTo(-8, -40); ctx.lineTo(28, -40); ctx.lineTo(50, -25); ctx.lineTo(-30, -25); ctx.closePath(); ctx.fill();
  if (apeInside) {
    ctx.fillStyle = '#3b2f2f';
    ctx.beginPath(); ctx.arc(14, -32, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9b99b';
    ctx.beginPath(); ctx.ellipse(16, -30, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#7bd12a';
  ctx.beginPath(); ctx.roundRect(-84, -30, 14, 5, 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-76, -20); ctx.lineTo(-76, -30); ctx.stroke();
  ctx.fillStyle = '#ffe27a';
  ctx.fillRect(74, -16, 8, 5);
  for (const wx of [-46, 46]) {
    ctx.beginPath(); ctx.arc(wx, -2, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#1b1b1f'; ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(wx, -2); ctx.rotate(wheelSpin);
    ctx.strokeStyle = '#c9d1d9'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 5; i += 1) { const a = (i / 5) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.stroke(); }
    ctx.restore();
  }
  ctx.restore();
}

/** Tiny community pushers who take over after the ape leaves. */
function drawCommunity(ctx: CanvasRenderingContext2D, cam: Camera, contactX: number, r: number, time: number, flattened: boolean): void {
  for (let i = 0; i < 3; i += 1) {
    const x = contactX - r - 30 - i * 26;
    const p = toScreen(cam, { x, y: heightAt(x) });
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-slopeAngle(x));
    if (flattened) { ctx.scale(1, 0.2); }
    const bob = Math.sin(time * 6 + i) * 2;
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -4 + bob); ctx.lineTo(4, -22 + bob); ctx.stroke();
    ctx.strokeStyle = ['#e63946', '#3b82f6', '#7cf67c'][i]!; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(4, -18 + bob); ctx.lineTo(16, -14 + bob); ctx.moveTo(4, -14 + bob); ctx.lineTo(15, -8 + bob); ctx.stroke();
    ctx.beginPath(); ctx.arc(6, -28 + bob, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#f3dccb'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const coin: CoinState = createCoin();
  const ape: ApeState = createApe();
  const cam = { x: spring(60), y: spring(heightAt(60) + 70) };
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  let lambo: { mode: LamboMode; x: number; wheel: number } = { mode: 'none', x: 0, wheel: 0 };
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let jeetFlash = 0;
  let communityFlat = false;
  let communityX = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const growth = Math.log2(multiplier);
    const fear = clamp((growth - 0.35) / 2.8, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null) secured = { x100: view.cashoutX100, payout: view.payout };
    const drive: CoinDrive = { x: running || crashed ? 60 + PX_PER_DOUBLING * growth : 60, radius: 40 + 50 * (1 - Math.exp(-growth / 2)), growth, running };

    if (previous === null) {
      previous = view.phase;
      settleCoin(coin, drive);
      resetApe(ape);
      if (crashed) {
        crashCoin(coin, view.currentX100, true);
        outcome = 'rugged';
        pop.x = 1;
        ape.mode = 'pancake';
        ape.pancakeX = drive.x - 120;
      }
      const pose = coinPose(coin);
      settleSpring(cam.x, pose.contact.x + 40);
      settleSpring(cam.y, pose.contact.y + 70);
    } else if (view.phase !== previous) {
      if (crashed && !coin.crashed) {
        const quiet = view.crashAge > 1500;
        const pose = coinPose(coin);
        crashCoin(coin, view.currentX100, quiet);
        outcome = view.stake === null ? 'rugged' : secured ? 'called' : 'rekt';
        if (ape.mode === 'push' || ape.mode === 'boarding') {
          ape.mode = 'pancake';
          ape.pancakeX = pose.contact.x - pose.r - 40;
        } else {
          communityFlat = true;
          communityX = pose.contact.x;
        }
        lambo = { ...lambo, mode: lambo.mode === 'none' ? 'none' : 'leaving' };
        if (quiet) pop.x = 1;
        else { shake = 1; pop.v = 16; }
      }
      if (view.phase === 'betting') {
        resetCoin(coin);
        resetApe(ape);
        lambo = { mode: 'none', x: 0, wheel: 0 };
        outcome = null;
        secured = null;
        communityFlat = false;
      }
      previous = view.phase;
    }
    if (secured && running && ape.mode === 'push' && lambo.mode === 'none') {
      lambo = { mode: 'arriving', x: coinPose(coin).contact.x - 760, wheel: 0 };
    }

    // Step the coin, the ape and the Lambo choreography.
    const before = coinPose(coin).contact.x;
    stepCoin(coin, drive, dt);
    const pose = coinPose(coin);
    const speed = dt > 0 ? (pose.contact.x - before) / dt : 0;
    stepApe(ape, { speed: running ? Math.max(0, speed) + 30 : 0, fear, bump: coin.events.bump }, dt);
    if (coin.events.jeet) jeetFlash = 1;
    jeetFlash = Math.max(0, jeetFlash - dt / 1.2);
    if (coin.events.bump && !reduced) shake = Math.max(shake, 0.18);
    if (lambo.mode === 'arriving') {
      const target = pose.contact.x - pose.r - 190;
      lambo.x = Math.min(target, lambo.x + 380 * dt);
      lambo.wheel += 380 * dt / 14;
      if (lambo.x >= target - 0.5) { lambo.mode = 'waiting'; ape.mode = 'boarding'; ape.modeAge = 0; }
    } else if (lambo.mode === 'waiting') {
      if (ape.mode === 'boarding' && ape.modeAge > 0.55) { ape.mode = 'gone'; lambo.mode = 'leaving'; }
    } else if (lambo.mode === 'leaving') {
      lambo.x -= 420 * dt;
      lambo.wheel -= 420 * dt / 14;
    }

    // Camera keeps the coin in view; after the crash it follows the roll for a moment, then holds.
    const follow = !coin.crashed || coin.crashAge < 0.8;
    if (follow) {
      stepSpring(cam.x, pose.contact.x + 40, 4, 1, dt);
      stepSpring(cam.y, pose.contact.y + 70, 4, 1, dt);
    }
    const camera: Camera = { x: cam.x.x, y: cam.y.x };
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.5);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 9 * shake * shake, Math.cos(time * 117) * 6 * shake * shake);
    drawSky(ctx, camera, time, growth, reduced);
    drawHill(ctx, camera);
    if (lambo.mode !== 'none') drawLambo(ctx, camera, lambo.x, lambo.wheel, ape.mode === 'gone');
    if (ape.mode === 'gone') drawCommunity(ctx, camera, communityFlat ? communityX : pose.contact.x, pose.r, time, communityFlat);
    drawApe(ctx, camera, ape, { contactX: pose.contact.x, centre: pose.centre, r: pose.r });
    drawCoin(ctx, camera, coin, TICKER);
    if (jeetFlash > 0) {
      const p = toScreen(camera, pose.centre);
      ctx.globalAlpha = Math.min(1, jeetFlash * 1.5);
      memeText(ctx, 'JEETED', p.x - pose.r - 40, p.y - pose.r - 20 - (1 - jeetFlash) * 30, 22, '#ffe27a', 'center');
      ctx.globalAlpha = 1;
    }
    if (outcome && pop.x > 0.02) {
      const at: Point = ape.mode === 'pancake' ? toScreen(camera, { x: ape.pancakeX, y: heightAt(ape.pancakeX) }) : toScreen(camera, pose.centre);
      ctx.save();
      ctx.translate(clamp(at.x, 170, 790), clamp(at.y - 110, 150, 420));
      ctx.rotate(-0.12);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, outcome === 'rekt' ? 'REKT' : 'DUST', 0, 0, 92, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();

    // HUD in screen space.
    if (caption) {
      ctx.save();
      ctx.translate(430, 68);
      const k = 1 + 0.1 * captionPop.x;
      ctx.scale(k, k);
      memeText(ctx, caption, 0, 0, 46, '#ffffff', 'center', 560);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
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
    memeText(ctx, `${multiplier.toFixed(2)}×`, 930, 80, 66, colour, 'right');
    ctx.restore();
    memeText(ctx, `MCAP ${formatMcap(multiplier)}`, 26, 514, 26, outcome ? '#ff9db0' : '#e7f4f0', 'left');
    void W;
  }

  return { draw };
}
