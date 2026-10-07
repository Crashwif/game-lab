/**
 * Composes Exit Liquidity from the room state: the sunset yard, the
 * helicopter, the pool and its water, the party, the dev and his chain, the
 * rug pull, then the HUD. All motion is stepped here with the real frame
 * time, and nothing drawn here changes the committed outcome. The sound is
 * the shared page audio: a eurodance set from the LP booth that tightens
 * with the number, cues from the party's own events, and a splash stinger.
 */
import { pageAudio } from './audio';
import { clamp, noise, settleSpring, spring, stepSpring } from './motion';
import { type PartyState, airdrop, celebrate, createParty, devWrist, devYank, drawConfetti, drawDeckProps, drawFigures, drawHelicopter, drawHoldersBehind, leavePool, resetParty, rugPulled, settleParty, stepParty } from './party';
import { DRAIN, INK, POOL, type PoolState, createPool, drawPoolBack, drawPoolFront, drawWater, pullPlug, resetPool, settlePool, stepPool } from './pool';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a rug pull missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** Drops the screen shake, the hit-stop, the punch-in, the dev's tremble and the camera flash. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const W = 960;
const H = 540;
const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** The readout's right edge and the widest it gets; past that a long multiplier squeezes rather than grow into the caption. */
const READOUT_X = 930;
const READOUT_MAX = 300;
const CAPTION_X = 430;
/** The caption ladder's thresholds: the milestone dings, and from the third the helicopter's passes. */
const RUNGS = [1.3, 1.6, 2.5, 4, 6, 10, 20];
const AIRDROP_FROM = 3;
/** The rug pull's choreography: the dev yanks, the plug holds for a fuse, then the picture freezes and runs slow. */
const FUSE_S = 0.16;
const FREEZE_S = 0.07;
const SLOW_S = 0.4;
const SLOW_RATE = 0.3;
type Outcome = 'rekt' | 'called' | 'rugged';
type Secured = { x100: number; payout: number | null };

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

/** How wide the readout draws, so the caption can keep clear of it. */
function readoutWidth(ctx: CanvasRenderingContext2D, text: string): number {
  ctx.font = `900 66px ${MEME_FONT}`;
  return Math.min(READOUT_MAX, ctx.measureText(text).width);
}

/** The opening ladder gives way to an ongoing broadcast in unusually long rounds. */
const OVERTIME_CAPTIONS = ["POOL PARTY: EXTENDED", "THE WHALE WANTS ANOTHER LAP", "THE DJ WORKS OVERTIME", "ANOTHER SPLASH OF LIQUIDITY", "THE LIFEGUARD IS ON BREAK", "THE PLUG IS STILL THERE", "INFLATABLE CONVICTION", "DEEP END AFTERPARTY"];

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'YOU ARE THE LIQUIDITY' : outcome === 'called' ? 'DRY AND RICH' : 'DOWN THE DRAIN';
  if (view.phase !== 'running') return 'WEN POOL PARTY?';
  if (secured) return 'OUT BEFORE THE DRAIN';
  if (view.elapsed >= 45_000) return OVERTIME_CAPTIONS[Math.floor((view.elapsed - 45_000) / 12_000) % OVERTIME_CAPTIONS.length]!;
  if (multiplier < 1.3) return 'CANNONBALL, DEGENS';
  if (multiplier < 1.6) return 'THE WATER IS FINE';
  if (multiplier < 2.5) return 'WHO PEED IN THE LP';
  if (multiplier < 4) return 'AIRDROP INCOMING';
  if (multiplier < 6) return 'DEV IS SMILING';
  if (multiplier < 10) return 'A WHALE GOT IN';
  if (multiplier < 20) return 'WHY IS THE CHAIN TAUT';
  return 'HAND ON THE PLUG';
}

/** The house rules, screwed to the fence between the left palm and the DJ, clear of where the stamp lands. */
function drawPoolRules(ctx: CanvasRenderingContext2D): void {
  const x = 180;
  const y = 196;
  const w = 128;
  const h = 76;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#fbf8f1'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e63946';
  ctx.beginPath(); ctx.roundRect(x + 5, y + 5, w - 10, 19, 2); ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 15px Impact, "Arial Black", sans-serif';
  ctx.fillText('POOL RULES', x + w / 2, y + 15, w - 16);
  ctx.fillStyle = INK;
  ctx.font = '900 12px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'left';
  for (const [i, line] of ['1. NO SELLING', '2. NO LIFEGUARD', '3. DEV MAY PULL PLUG'].entries()) ctx.fillText(line, x + 9, y + 36 + i * 14, w - 18);
  ctx.fillStyle = '#9aa3ad';
  for (const [sx, sy] of [[x + 4, y + h - 4], [x + w - 4, y + h - 4]] as const) { ctx.beginPath(); ctx.arc(sx, sy, 1.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawYard(ctx: CanvasRenderingContext2D, time: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, POOL.top);
  sky.addColorStop(0, '#5b2a86');
  sky.addColorStop(0.5, '#d9527a');
  sky.addColorStop(1, '#ffb45c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, POOL.top);
  const glow = ctx.createRadialGradient(700, 210, 20, 700, 210, 220);
  glow.addColorStop(0, 'rgba(255, 220, 140, 0.55)');
  glow.addColorStop(1, 'rgba(255, 220, 140, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(400, 0, 600, POOL.top);
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath(); ctx.arc(700, 214, 46, Math.PI, Math.PI * 2); ctx.fill();
  // Fence, palms and a couple of ballooned "$" bunting flags.
  ctx.fillStyle = '#6b4a2e';
  ctx.fillRect(0, 214, W, 60);
  ctx.strokeStyle = '#4a3220';
  ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, 214); ctx.lineTo(x, 274); ctx.stroke(); }
  for (const [px, h, lean] of [[120, 150, -0.15], [860, 170, 0.1], [520, 120, 0.05]] as const) {
    ctx.strokeStyle = '#5a3d24'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px, 274); ctx.quadraticCurveTo(px + lean * 60, 274 - h * 0.6, px + lean * 120, 274 - h); ctx.stroke();
    ctx.fillStyle = '#2e8b57';
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + time * 0.2;
      ctx.beginPath();
      ctx.moveTo(px + lean * 120, 274 - h);
      ctx.quadraticCurveTo(px + lean * 120 + Math.cos(a) * 50, 274 - h + Math.sin(a) * 20 - 10, px + lean * 120 + Math.cos(a) * 70, 274 - h + Math.sin(a) * 34 + 8);
      ctx.quadraticCurveTo(px + lean * 120 + Math.cos(a) * 40, 274 - h + Math.sin(a) * 26, px + lean * 120, 274 - h);
      ctx.fill();
    }
  }
  drawPoolRules(ctx);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(150, 40); ctx.quadraticCurveTo(480, 110, 810, 40); ctx.stroke();
  for (let i = 0; i < 12; i += 1) {
    const t = (i + 0.5) / 12;
    const x = 150 + 660 * t;
    const y = 40 + 140 * t * (1 - t) + Math.sin(time * 3 + i) * 2;
    ctx.fillStyle = ['#ff5d9e', '#7cf67c', '#ffe27a', '#8fd3ff'][i % 4]!;
    ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 16); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // Deck boards.
  ctx.fillStyle = '#c9a66f';
  ctx.fillRect(0, POOL.top - 4, W, H - POOL.top + 4);
  ctx.strokeStyle = 'rgba(90, 60, 30, 0.35)';
  ctx.lineWidth = 2;
  for (let y = POOL.top + 8; y < H; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  void noise;
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'eurodance', crash: 'splash' });
  const pool: PoolState = createPool();
  const party: PartyState = createParty(reduced ? 0 : 1);
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  /** The camera's punch toward the drain. */
  const punch = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let round = 1;
  /** Seconds until the plug gives after the dev's yank; -1 with no pull under way. */
  let fuse = -1;
  let freeze = 0;
  let slow = 0;
  let rung = 0;
  let notches = 0;
  let whaleUp = false;
  let glugAt = 0;

  /** The plug comes out: the drain, the outcome, the stamp, and (loud) the shake, the hit-stop, the punch-in and the stinger. */
  function rug(view: SceneView, ending: Outcome, quiet: boolean): void {
    pullPlug(pool, view.currentX100, quiet);
    outcome = ending;
    rugPulled(party, quiet);
    if (quiet) {
      pop.x = 1;
      audio.crash('splash', true);
      return;
    }
    shake = 1;
    pop.v = 16;
    punch.v = 8;
    if (!reduced) {
      freeze = FREEZE_S;
      slow = SLOW_S;
    }
    audio.crash('splash');
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the picture for a few frames, then the drain opens in slow motion before time catches up.
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
    const tension = clamp(growth / 3.3, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running) {
        audio.cashout();
        celebrate(party, party.avatar.x, party.avatar.y - 30);
      }
    }
    const ending: Outcome = view.stake === null ? 'rugged' : secured ? 'called' : 'rekt';

    // The first frame may land mid-round or after the crash (a page that joins late, or a fresh scene for a
    // round whose betting was missed), so it settles the pool and the party into place instead of playing out
    // the arrivals, the exit and the rug pull it missed.
    if (previous === null) {
      previous = view.phase;
      resetParty(party, 11);
      resetPool(pool);
      if (running || crashed) {
        settlePool(pool, growth);
        settleParty(party, pool, growth, secured !== null);
        rung = RUNGS.filter((r) => multiplier >= r).length + Math.floor(Math.max(0, view.elapsed - 45_000) / 12_000);
        notches = Math.floor(tension * 4);
      }
      if (crashed) rug(view, ending, true);
      settleSpring(badge, secured ? 1 : 0);
    } else if (view.phase !== previous) {
      if (crashed && !pool.draining && fuse < 0) {
        const quiet = view.crashAge > 1500;
        // An exit that landed with the crash, before a running frame saw it, still gets out.
        if (secured) leavePool(party);
        if (quiet) rug(view, ending, true);
        else {
          // The dev is on his feet and yanking; the plug gives a few frames later.
          devYank(party);
          fuse = FUSE_S;
          audio.fx('yeet', 1);
        }
      }
      if (view.phase === 'betting') {
        round += 1;
        resetPool(pool);
        resetParty(party, round * 977);
        outcome = null;
        secured = null;
        fuse = -1;
        freeze = slow = 0;
        rung = 0;
        notches = 0;
        whaleUp = false;
      }
      previous = view.phase;
    }
    if (fuse >= 0) {
      fuse -= real;
      if (fuse < 0 && !pool.draining) rug(view, ending, false);
    }
    if (secured && running) leavePool(party);
    audio.update(view.phase, tension);

    stepPool(pool, growth, running, dt);
    stepParty(party, pool, growth, running, fear, dt);
    // Cues from the party's own events: landings, the helicopter, the whale, the chain, the drain and the selfie.
    if (party.events.splash) {
      if (!reduced) shake = Math.max(shake, party.events.splash.big ? 0.2 : 0.12);
      if (running) audio.fx('splash', party.events.splash.big ? 1 : 0.6);
    }
    if (party.events.heli) audio.fx('whoosh', 0.9);
    if (party.events.drop) audio.fx('scream', 0.7);
    if (party.events.shutter) audio.fx('camera', 1);
    if (running) {
      const index = RUNGS.filter((r) => multiplier >= r).length + Math.floor(Math.max(0, view.elapsed - 45_000) / 12_000);
      audio.milestone(index);
      if (index > rung) {
        if (index >= AIRDROP_FROM) airdrop(party);
        rung = index;
      }
      const notch = Math.floor(tension * 4);
      if (notch > notches) audio.fx('creak', 0.5 + 0.4 * tension);
      notches = Math.max(notches, notch);
      if (pool.whale.active && !whaleUp) audio.fx('airhorn', 0.7);
      whaleUp = pool.whale.active;
    }
    if (pool.draining && pool.drained < 1 && pool.drainAge < 3 && time > glugAt) {
      glugAt = time + 0.38;
      audio.fx('glug', 0.6 + 0.4 * (1 - pool.drained));
    }
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(punch, 0, 9, 0.5, dt);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.5);
    const beat = running ? Math.max(0, Math.sin(time * (4 + 6 * pool.tension) * Math.PI)) * (0.3 + pool.tension) : 0.1;

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 8 * shake * shake, Math.cos(time * 117) * 6 * shake * shake);
    if (!reduced && punch.x > 0.005) {
      // The camera punches in on the drain and eases back out.
      const k = 1 + 0.06 * clamp(punch.x, 0, 1.2);
      ctx.translate(DRAIN.x, pool.level);
      ctx.scale(k, k);
      ctx.translate(-DRAIN.x, -pool.level);
    }
    drawYard(ctx, time);
    drawHelicopter(ctx, party);
    drawPoolBack(ctx);
    drawHoldersBehind(ctx, party, pool);
    drawWater(ctx, pool);
    drawDeckProps(ctx, party, beat);
    drawPoolFront(ctx, pool, devWrist(party));
    drawFigures(ctx, party, pool, fear);
    drawConfetti(ctx, party);
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(480, 250);
      ctx.rotate(-0.12);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, outcome === 'rekt' ? 'REKT' : 'RUGGED', 0, 0, 92, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();

    // The readout grows leftward with every digit, so the caption gets the width left between them (24 clear),
    // squeezed to it once drawn so the pop's scale never pushes it wider.
    const readout = `${multiplier.toFixed(2)}×`;
    if (caption) {
      const room = Math.min(560, 2 * (READOUT_X - readoutWidth(ctx, readout) - 24 - CAPTION_X));
      ctx.save();
      ctx.translate(CAPTION_X, 68);
      const k = 1 + 0.1 * captionPop.x;
      ctx.scale(k, k);
      memeText(ctx, caption, 0, 0, 46, '#ffffff', 'center', room / k);
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
    memeText(ctx, readout, READOUT_X, 80, 66, colour, 'right', READOUT_MAX);
    ctx.restore();
    // A paddling avatar has already sold, so only a floater (or the one left in the puddle) still holds.
    const holders = party.holders.filter((h) => h.mode === 'floating' || h.mode === 'jumping' || h.mode === 'puddle').length + (party.avatar.mode === 'floating' || party.avatar.mode === 'puddle' ? 1 : 0);
    const lp = 12 * Math.pow(multiplier, 1.5) * (pool.draining ? 1 - pool.drained : 1);
    memeText(ctx, `${holders} ${holders === 1 ? 'HOLDER' : 'HOLDERS'} · LP ${lp.toFixed(1)} SOL`, 26, 514, 26, outcome ? '#ff9db0' : '#e7f4f0', 'left');
  }

  return { draw };
}
