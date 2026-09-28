/**
 * Composes King of the Hill from the room state: the altitude sky, the
 * bonding-curve hill, the coin, the ape, the Lambo that collects him on an
 * accepted exit, the community that keeps pushing after he leaves, then the
 * HUD. All motion is stepped here with the real frame time, and nothing
 * drawn here changes the committed outcome.
 */
import { type AirdropState, createAirdrop, drawAirdrop, resetAirdrop, sendPlane, stepAirdrop } from './airdrop';
import { type ApeState, brace, createApe, drawApe, resetApe, stepApe } from './ape';
import { pageAudio } from './audio';
import { type CoinDrive, type CoinState, coinPose, crashCoin, createCoin, drawCoin, settleCoin, stepCoin } from './coin';
import { type DevState, cloudAt, createDev, drawDev, pullLever, resetDev, settleDev, stepDev } from './dev';
import { type Camera, type Point, drawHill, drawSky, heightAt, slopeAngle, toScreen } from './hill';
import { clamp, noise, settleSpring, spring, stepSpring } from './motion';

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
/** The multiplier readout's right edge, and the width past which it is squeezed rather than run into the caption. */
const READOUT_X = 930;
const READOUT_MAX = 300;
/** The centre line of the caption and the secured badge. */
const CAPTION_X = 430;
/** World px up the hill per doubling of the multiplier. */
const PX_PER_DOUBLING = 620;
const TICKER = '$CRASH';
/** The flash over each holder who bails, by how many have bailed this round. */
const JEET_LINES = ['JEETED', 'PAPER HANDS', 'SEE YA NERD', 'SOLD FOR A SANDWICH', 'NGMI'];
/** The multipliers a milestone stinger plays at (the caption ladder); the airdrop plane comes from the second on. */
const RUNGS = [1.3, 1.6, 2.5, 4, 6, 12, 25];
const PLANE_FROM = 2;
/**
 * The crash's choreography: the dev pulls the lever, the coin lets go a few frames later (the fuse) and rolls
 * back; when it reaches the ape the picture holds for a hit-stop and the pancake runs slow before time catches up.
 */
const FUSE_S = 0.16;
const FREEZE_S = 0.07;
const SLOW_S = 0.4;
const SLOW_RATE = 0.3;
const CONFETTI = ['#ff4d6d', '#7cf67c', '#8fd3ff', '#ffe27a', '#c084fc'];
type Outcome = 'rekt' | 'called' | 'rugged';
type Secured = { x100: number; payout: number | null };
type LamboMode = 'none' | 'arriving' | 'waiting' | 'leaving';
interface Confetti { x: number; y: number; vx: number; vy: number; angle: number; spin: number; colour: string; age: number; life: number }

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
  if (outcome) return outcome === 'rekt' ? 'DEV SOLD ON YOUR HEAD' : outcome === 'called' ? 'GOOD LUCK, COMMUNITY' : 'RUGGED';
  if (view.phase !== 'running') return 'WEN LAUNCH?';
  if (secured) return "IT'S A CTO NOW";
  if (multiplier < 1.3) return 'PUSH IT';
  if (multiplier < 1.6) return 'SISYPHUS BUT DEGEN';
  if (multiplier < 2.5) return 'KING OF THE HILL';
  if (multiplier < 4) return 'WEN GRADUATION';
  if (multiplier < 6) return 'GRADUATED';
  if (multiplier < 12) return 'DEV IS WATCHING';
  return "DEV'S FINGER ON SELL";
}

function formatMcap(multiplier: number): string {
  const usd = 5000 * Math.pow(multiplier, 1.9);
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
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
  const audio = pageAudio({ style: 'eurodance', crash: 'slam' });
  const coin: CoinState = createCoin();
  const ape: ApeState = createApe();
  const dev: DevState = createDev();
  const airdrop: AirdropState = createAirdrop();
  const cam = { x: spring(60), y: spring(heightAt(60) + 70) };
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  /** The camera's punch into the pancake. */
  const punch = spring(0);
  /** The dev's cloud, on its way in. */
  const cloud = { x: spring(cloudAt(0, false).x), y: spring(cloudAt(0, false).y) };
  let lambo: { mode: LamboMode; x: number; wheel: number } = { mode: 'none', x: 0, wheel: 0 };
  let confetti: Confetti[] = [];
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
  /** Seconds until the coin lets go after the lever is pulled; -1 with nothing pending. */
  let fuse = -1;
  let freeze = 0;
  let slow = 0;
  /** Sound gates: footsteps, the plane, the Lambo's engine. */
  let stepClock = 0;
  let wasStepping = false;
  let rung = 0;
  let lamboHeard = false;

  /** The Lambo's confetti: forty pieces from where he hops in. */
  function celebrate(at: Point): void {
    confetti = [];
    for (let i = 0; i < 40; i += 1) {
      const n = i * 1.37 + time;
      confetti.push({ x: at.x + (noise(n) - 0.5) * 30, y: at.y + 20, vx: (noise(n + 1) - 0.5) * 300, vy: 160 + noise(n + 2) * 220, angle: noise(n + 3) * 3, spin: (noise(n + 4) - 0.5) * 14, colour: CONFETTI[i % CONFETTI.length]!, age: 0, life: 1.4 + noise(n + 5) * 0.8 });
    }
  }

  /** The coin reaches whoever is still on the hill: the flattening, with its hit-stop, punch-in and thud. */
  function flatten(): void {
    shake = 1;
    pop.v = 16;
    punch.v = 8;
    if (!reduced) {
      freeze = FREEZE_S;
      slow = SLOW_S;
    }
    audio.fx('thud', 1.3);
    audio.fx('punch', 0.9);
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the picture for a few frames, then the pancake runs slow before time catches up.
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
    const growth = Math.log2(multiplier);
    const fear = clamp((growth - 0.35) / 2.8, 0, 1);
    const tension = 1 - Math.exp(-growth / 2.2);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running) audio.cashout();
    }
    const drive: CoinDrive = { x: running || crashed ? 60 + PX_PER_DOUBLING * growth : 60, radius: 40 + 50 * (1 - Math.exp(-growth / 2)), growth, running };
    const ending: Outcome = view.stake === null ? 'rugged' : secured ? 'called' : 'rekt';

    if (previous === null) {
      // A fresh scene (the page joining, or a round first seen after its betting phase) settles into the round
      // as it stands: an exit already taken has the ape gone and the community pushing, and a crash is its quiet
      // aftermath, with the camera held where the dev sold, as it is after a crash watched live.
      previous = view.phase;
      settleCoin(coin, drive);
      resetApe(ape);
      const pose = coinPose(coin);
      settleSpring(cam.x, pose.contact.x + 40);
      settleSpring(cam.y, pose.contact.y + 70);
      if (secured) {
        ape.mode = 'gone';
        settleSpring(badge, 1);
      }
      settleDev(dev, tension, running, crashed);
      settleSpring(cloud.x, cloudAt(tension, running || crashed).x);
      settleSpring(cloud.y, cloudAt(tension, running || crashed).y);
      rung = running ? RUNGS.filter((r) => multiplier >= r).length : 0;
      if (crashed) {
        crashCoin(coin, view.currentX100, true);
        outcome = ending;
        pop.x = 1;
        if (ape.mode === 'gone') {
          communityFlat = true;
          communityX = pose.contact.x;
        } else {
          ape.mode = 'pancake';
          ape.pancakeX = pose.contact.x - pose.r - 40;
        }
        audio.crash('slam', true);
      }
      if (ape.mode === 'push') settleSpring(ape.lean, 0.35 + 0.5 * fear);
    } else if (view.phase !== previous) {
      if (crashed && !coin.crashed && fuse < 0) {
        const quiet = view.crashAge > 1500;
        const pose = coinPose(coin);
        outcome = ending;
        // An exit this scene never drew (the tab was hidden through it) has still taken the ape off the hill.
        if (secured && lambo.mode === 'none') ape.mode = 'gone';
        if (quiet) {
          crashCoin(coin, view.currentX100, true);
          settleDev(dev, tension, false, true);
          if (ape.mode === 'push' || ape.mode === 'boarding') {
            ape.mode = 'pancake';
            ape.pancakeX = pose.contact.x - pose.r - 40;
          } else {
            communityFlat = true;
            communityX = pose.contact.x;
          }
          lambo = { ...lambo, mode: lambo.mode === 'none' ? 'none' : 'leaving' };
          pop.x = 1;
          audio.crash('slam', true);
        } else {
          // The dev pulls the lever; the coin lets go a few frames later.
          pullLever(dev);
          fuse = FUSE_S;
          audio.crash('slam');
          audio.fx('ratchet', 1.1);
        }
      }
      if (view.phase === 'betting') {
        settleCoin(coin, drive);
        resetApe(ape);
        resetDev(dev);
        resetAirdrop(airdrop);
        lambo = { mode: 'none', x: 0, wheel: 0 };
        confetti = [];
        outcome = null;
        secured = null;
        communityFlat = false;
        fuse = -1;
        freeze = slow = 0;
        rung = 0;
        lamboHeard = false;
      }
      previous = view.phase;
    }
    if (fuse >= 0) {
      fuse -= real;
      if (fuse < 0 && !coin.crashed) {
        const pose = coinPose(coin);
        crashCoin(coin, view.currentX100, false);
        if (ape.mode === 'push' || ape.mode === 'boarding') {
          brace(ape, { contactX: pose.contact.x, centre: pose.centre, r: pose.r });
          audio.fx('scream', 0.75);
        } else {
          communityX = pose.contact.x;
        }
        lambo = { ...lambo, mode: lambo.mode === 'none' ? 'none' : 'leaving' };
        shake = Math.max(shake, 0.3);
      }
    }
    audio.update(view.phase, tension);
    if (running) {
      const index = RUNGS.filter((r) => multiplier >= r).length;
      audio.milestone(index);
      if (index > rung) {
        rung = index;
        if (index >= PLANE_FROM) sendPlane(airdrop, { x: cam.x.x, y: cam.y.x });
      }
    }
    if (secured && running && ape.mode === 'push' && lambo.mode === 'none') {
      lambo = { mode: 'arriving', x: coinPose(coin).contact.x - 760, wheel: 0 };
    }

    // Step the coin, the ape and the Lambo choreography.
    stepCoin(coin, drive, dt);
    const pose = coinPose(coin);
    stepApe(ape, { anchor: { contactX: pose.contact.x, centre: pose.centre, r: pose.r }, walking: running, fear, bump: coin.events.bump }, dt);
    // The coin rolling back reaches him: the pancake; or the community, if he got out.
    if (coin.crashed) {
      if (ape.mode === 'brace' && (pose.contact.x - pose.r * 0.35 <= ape.braceX + 6 || coin.crashAge > 2.5)) {
        ape.mode = 'pancake';
        ape.modeAge = 0;
        ape.pancakeX = ape.braceX - 8;
        flatten();
      } else if (ape.mode === 'gone' && !communityFlat && (pose.contact.x <= communityX - 30 || coin.crashAge > 2.5)) {
        communityFlat = true;
        flatten();
      }
    }
    // Footsteps: each foot that lands, thumps.
    const stepping = ape.mode === 'push' && ape.gait.feet.some((f) => f.phase < 1);
    stepClock -= dt;
    if (wasStepping && !stepping && running && stepClock <= 0) {
      stepClock = 0.2;
      audio.fx('stomp', 0.35 + 0.45 * fear);
    }
    wasStepping = stepping;
    if (coin.events.bump) audio.fx('thud', 0.6 + 0.3 * tension);
    if (coin.events.jeet) {
      jeetFlash = 1;
      audio.fx('yeet', 0.9);
    }
    jeetFlash = Math.max(0, jeetFlash - dt / 1.2);
    if (coin.events.bump && !reduced) shake = Math.max(shake, 0.18);
    stepDev(dev, tension, running, dt);
    if (dev.events.notch && running) audio.fx('creak', 0.45 + 0.15 * dev.notches);
    stepAirdrop(airdrop, { x: cam.x.x, y: cam.y.x }, pose.contact.x, dt);
    if (airdrop.events.plane) audio.fx('engine', 0.55);
    if (airdrop.events.landed) audio.fx('thud', 0.5);
    if (lambo.mode === 'arriving') {
      if (!lamboHeard) {
        lamboHeard = true;
        audio.fx('engine', 0.9);
      }
      const target = pose.contact.x - pose.r - 190;
      lambo.x = Math.min(target, lambo.x + 380 * dt);
      lambo.wheel += 380 * dt / 14;
      if (lambo.x >= target - 0.5) { lambo.mode = 'waiting'; ape.mode = 'boarding'; ape.modeAge = 0; }
    } else if (lambo.mode === 'waiting') {
      if (ape.mode === 'boarding' && ape.modeAge > 0.55) {
        ape.mode = 'gone';
        lambo.mode = 'leaving';
        celebrate({ x: lambo.x, y: heightAt(lambo.x) });
      }
    } else if (lambo.mode === 'leaving') {
      lambo.x -= 420 * dt;
      lambo.wheel -= 420 * dt / 14;
    }
    for (const c of confetti) {
      c.age += dt;
      c.vy -= 320 * dt;
      c.vx *= Math.exp(-1.3 * dt);
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.angle += c.spin * dt;
    }
    confetti = confetti.filter((c) => c.age < c.life);

    // Camera keeps the coin in view; after the crash it follows the roll for a moment, then holds.
    const follow = !coin.crashed || coin.crashAge < 0.8;
    if (follow) {
      stepSpring(cam.x, pose.contact.x + 40, 4, 1, dt);
      stepSpring(cam.y, pose.contact.y + 70, 4, 1, dt);
    }
    const camera: Camera = { x: cam.x.x, y: cam.y.x };
    // The REKT holds off until the coin has actually reached someone.
    const landed = outcome !== null && (ape.mode === 'pancake' || communityFlat || (ape.mode === 'gone' && coin.crashAge > 2.5) || fuse < 0 && coin.crashed && ape.mode !== 'brace' && ape.mode !== 'gone');
    stepSpring(pop, landed ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(punch, 0, 9, 0.5, dt);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.5);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 9 * shake * shake, Math.cos(time * 117) * 6 * shake * shake);
    if (!reduced && punch.x > 0.005) {
      // The camera punches in on the pancake and eases back out.
      const k = 1 + 0.07 * clamp(punch.x, 0, 1.2);
      const at = ape.mode === 'pancake' ? toScreen(camera, { x: ape.pancakeX, y: heightAt(ape.pancakeX) }) : toScreen(camera, { x: communityX - pose.r - 40, y: heightAt(communityX - pose.r - 40) });
      ctx.translate(at.x, at.y);
      ctx.scale(k, k);
      ctx.translate(-at.x, -at.y);
    }
    drawSky(ctx, camera, time, growth, reduced);
    drawAirdrop(ctx, airdrop, camera);
    drawHill(ctx, camera);
    if (lambo.mode !== 'none') drawLambo(ctx, camera, lambo.x, lambo.wheel, ape.mode === 'gone');
    if (ape.mode === 'gone') drawCommunity(ctx, camera, communityFlat ? communityX : pose.contact.x, pose.r, time, communityFlat);
    drawApe(ctx, camera, ape, { contactX: pose.contact.x, centre: pose.centre, r: pose.r });
    drawCoin(ctx, camera, coin, TICKER);
    for (const c of confetti) {
      const p = toScreen(camera, { x: c.x, y: c.y });
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(c.angle);
      ctx.globalAlpha = clamp(1.6 * (1 - c.age / c.life), 0, 1);
      ctx.fillStyle = c.colour;
      ctx.fillRect(-3, -2, 6, 4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // The dev's cloud drifts in from the top-left corner: it is in front of everything on the hill, under the HUD.
    stepSpring(cloud.x, cloudAt(tension, running || fuse >= 0 || coin.crashed).x, 1.6, 0.8, dt);
    stepSpring(cloud.y, cloudAt(tension, running || fuse >= 0 || coin.crashed).y, 1.6, 0.8, dt);
    drawDev(ctx, dev, cloud.x.x, cloud.y.x, cloudAt(tension, running || fuse >= 0 || coin.crashed).s, tension, reduced);
    if (jeetFlash > 0) {
      const p = toScreen(camera, pose.centre);
      ctx.globalAlpha = Math.min(1, jeetFlash * 1.5);
      // Up and to the right of the coin: clear of the dev's cloud on the left.
      memeText(ctx, JEET_LINES[clamp(coin.jeeted - 1, 0, JEET_LINES.length - 1)]!, clamp(p.x + pose.r * 0.6, 200, 760), p.y - pose.r - 34 - (1 - jeetFlash) * 30, 22, '#ffe27a', 'center');
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
    const colour = outcome ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    ctx.save();
    if (!running && !outcome) ctx.globalAlpha = 0.85;
    memeText(ctx, readout, READOUT_X, 80, 66, colour, 'right', READOUT_MAX);
    ctx.restore();
    memeText(ctx, `MCAP ${formatMcap(multiplier)}`, 26, 514, 26, outcome ? '#ff9db0' : '#e7f4f0', 'left');
    void W;
  }

  return { draw };
}
