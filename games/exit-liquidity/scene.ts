/**
 * Composes Exit Liquidity from the room state: the sunset yard, the pool
 * and its water, the party, the dev and his chain, the rug pull, then the
 * HUD. All motion is stepped here with the real frame time, and nothing
 * drawn here changes the committed outcome.
 */
import { clamp, noise, spring, stepSpring } from './motion';
import { type PartyState, createParty, devWrist, drawDeckProps, drawFigures, drawHoldersBehind, leavePool, resetParty, rugPulled, stepParty } from './party';
import { INK, POOL, type PoolState, createPool, drawPoolBack, drawPoolFront, drawWater, pullPlug, resetPool, stepPool } from './pool';

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
  /** Drops the screen shake and flicker. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const W = 960;
const H = 540;
const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
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

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'EXIT LIQUIDITY' : outcome === 'called' ? 'CALLED IT' : 'RUG PULL';
  if (view.phase !== 'running') return 'WEN POOL PARTY?';
  if (secured) return 'DEAL WITH IT';
  if (multiplier < 1.3) return 'APE IN';
  if (multiplier < 1.6) return 'NUMBER GO UP';
  if (multiplier < 2.5) return 'HODL';
  if (multiplier < 4) return 'WAGMI';
  if (multiplier < 6) return 'DIAMOND HANDS';
  if (multiplier < 10) return 'BIG IF TRUE';
  if (multiplier < 20) return 'TO THE MOON';
  return 'THIS IS FINE';
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
  const pool: PoolState = createPool();
  const party: PartyState = createParty();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let round = 1;

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

    if (previous === null) {
      previous = view.phase;
      resetParty(party, 11);
      resetPool(pool);
      if (running || crashed) {
        pool.fill = 0.35 + 0.65 * (1 - Math.exp(-growth / 2));
        pool.level = POOL.floor - pool.fill * (POOL.floor - 320);
        for (let i = 0; i < Math.min(22, 2 + Math.floor(growth * 5)); i += 1) {
          party.holders.push({ x: 230 + party.rng() * 520, y: pool.level, tube: '#7cf67c', tone: party.rng(), phase: party.rng() * 6, mode: 'floating', t: 1, fromX: 0, toX: 0, spin: 0, scale: 1 });
        }
      }
      if (crashed) {
        pullPlug(pool, view.currentX100, true);
        rugPulled(party, true);
        outcome = 'rugged';
        pop.x = 1;
      }
    } else if (view.phase !== previous) {
      if (crashed && !pool.draining) {
        const quiet = view.crashAge > 1500;
        pullPlug(pool, view.currentX100, quiet);
        outcome = view.stake === null ? 'rugged' : secured ? 'called' : 'rekt';
        rugPulled(party, quiet);
        if (quiet) pop.x = 1;
        else { shake = 1; pop.v = 16; }
      }
      if (view.phase === 'betting') {
        round += 1;
        resetPool(pool);
        resetParty(party, round * 977);
        outcome = null;
        secured = null;
      }
      previous = view.phase;
    }
    if (secured && running) leavePool(party);

    stepPool(pool, growth, running, dt);
    stepParty(party, pool, growth, running, fear, dt);
    if (party.events.splash && !reduced) shake = Math.max(shake, 0.12);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
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
    drawYard(ctx, time);
    drawPoolBack(ctx);
    drawHoldersBehind(ctx, party, pool);
    drawWater(ctx, pool);
    drawDeckProps(ctx, party, beat);
    drawPoolFront(ctx, pool, devWrist(party));
    drawFigures(ctx, party, pool, fear);
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
    const holders = party.holders.filter((h) => h.mode === 'floating' || h.mode === 'jumping' || h.mode === 'puddle').length + (party.avatar.mode === 'floating' || party.avatar.mode === 'paddling' || party.avatar.mode === 'puddle' ? 1 : 0);
    const lp = 12 * Math.pow(multiplier, 1.5) * (pool.draining ? 1 - pool.drained : 1);
    memeText(ctx, `${holders} ${holders === 1 ? 'HOLDER' : 'HOLDERS'} · LP ${lp.toFixed(1)} SOL`, 26, 514, 26, outcome ? '#ff9db0' : '#e7f4f0', 'left');
  }

  return { draw };
}
