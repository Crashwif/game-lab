/**
 * The chart on the picture: the night behind it (skyline, moon, price lines, a fading line chart), the
 * support band with its ticker tape and the resistance line, the launchpad, every candle and pickup, the
 * FUD cloud, and the rug pull sweeping in from the right. Drawing only: what is where comes from sky.ts.
 */
import { CYAN, GOLD, INK, LIME, MONO, PINK, ellipse, line, memeText, panel, poly, text } from './art';
import { BIRD_X, CANDLE_W, CEILING, COIN_VALUE, FLOOR, H, W, type Candle, type Pickup } from './sky';
import { endurance } from './endurance';
import { clamp, noise, smoothstep } from './motion';

export interface ChartView {
  seconds?: number;
  time: number;
  distance: number;
  tension: number;
  /** The rug pull's edge, sweeping left; Infinity while the chart stands. */
  rugX: number;
  /** How far the crash has gone, 0 to 1: the floor breaks and the night goes red. */
  dark: number;
  reduced: boolean;
}

const GREEN = '#2fd47a';
const GREEN_DARK = '#158a48';
const RED = '#ff4d6d';
const RED_DARK = '#a4213b';
const TICKER = ['$COPE −69%', '$WAGMI +420%', '$RUG 100% LOCKED (LOL)', '$HOPIUM ▲▲▲', '$DOGWIFHAT GM', 'NFA · DYOR · NGMI', '$LAMBO WEN', 'SUPPORT: TRUST ME BRO', '$COPIUM +1%', 'VOLUME: VIBES'];
const PRICES = ['$0.0420', '$0.0069', '$0.0013', '$0.0004', '$0.0001', '$0.0000'];

// ---- The night ---------------------------------------------------------------------------------------------

function backdrop(ctx: CanvasRenderingContext2D, view: ChartView): void {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#05081c');
  const act = endurance(view.seconds ?? 0);
  const regions = ['#101a48', '#203955', '#302449', '#153a37', '#303953'];
  sky.addColorStop(0.55, regions[act.act]!);
  sky.addColorStop(1, '#1a1f4a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  if (view.dark > 0) {
    ctx.fillStyle = `rgba(120, 10, 40, ${0.35 * view.dark})`;
    ctx.fillRect(0, 0, W, H);
  }
  for (let i = 0; i < 60; i += 1) {
    const x = ((noise(i * 7.3) * 1400 - view.distance * 0.05) % 1000 + 1000) % 1000 - 20;
    const y = noise(i * 3.1) * 300;
    const tw = view.reduced ? 0.7 : 0.45 + 0.55 * Math.abs(Math.sin(view.time * 2 + i));
    ellipse(ctx, x, y, 1.1, 1.1, `rgba(255, 255, 255, ${0.6 * tw})`);
  }
  // Weather fronts and a satellite pass behind the course; their silhouettes cannot hide gap edges.
  if (act.act > 0) {
    ctx.save(); ctx.globalAlpha = .12 + .12 * act.effort;
    const drift = view.reduced ? 0 : view.time * (act.act === 2 ? 9 : 3);
    for (let i = 0; i < 4; i += 1) {
      const x = ((i * 310 + drift) % 1250) - 150;
      ellipse(ctx, x, 290 + i % 2 * 32, 110, 15, act.act === 3 ? '#75d3bb' : '#afc4ed');
    }
    ctx.restore();
    if (act.act === 4) {
      const x = 900 - act.effort * 510;
      panel(ctx, x - 12, 110, 24, 14, '#acb9ce', INK, 2);
      panel(ctx, x - 52, 110, 32, 14, '#345680', '#88b4ce', 0);
      panel(ctx, x + 20, 110, 32, 14, '#345680', '#88b4ce', 0);
    }
  }
  // The moon, which everyone is going to, clear of the HUD's corner.
  ellipse(ctx, 900, 222, 36, 36, '#f3eccb', '#c9bd8a', 2);
  ellipse(ctx, 888, 212, 7, 7, '#e0d8ad');
  ellipse(ctx, 914, 232, 5, 5, '#e0d8ad');
  text(ctx, 'WEN', 900, 225, 13, '#a89c66', 'center');
  // Two skylines, far and near, sliding at their own pace.
  for (const [layer, colour, speed, base] of [[0, '#0d1436', 0.12, 330], [1, '#141c4a', 0.28, 380]] as const) {
    ctx.fillStyle = colour;
    for (let i = 0; i < 30; i += 1) {
      const w = 40 + noise(i * 5 + layer) * 60;
      const x = ((i * 74 - view.distance * speed) % 1100 + 1100) % 1100 - 80;
      const h = 40 + noise(i * 9 + layer * 4) * 120;
      ctx.fillRect(x, base - h, w, h + 120);
    }
  }
  // Price lines and the line chart nobody looks at.
  ctx.setLineDash([4, 8]);
  for (let i = 0; i < PRICES.length; i += 1) {
    const y = CEILING + 20 + i * 76;
    line(ctx, [[0, y], [W, y]], 'rgba(120, 140, 220, 0.18)', 1, 'butt');
    text(ctx, PRICES[i]!, 8, y - 7, 8, 'rgba(140, 160, 230, 0.5)', 'left', undefined, MONO);
  }
  ctx.setLineDash([]);
  const pts: [number, number][] = [];
  for (let x = -20; x <= W + 20; x += 24) {
    const t = (x + view.distance * 0.5) * 0.01;
    pts.push([x, 300 - (Math.sin(t) * 40 + Math.sin(t * 2.7) * 25 + Math.sin(t * 0.4) * 60)]);
  }
  line(ctx, pts, 'rgba(95, 242, 230, 0.14)', 2);
}

function support(ctx: CanvasRenderingContext2D, view: ChartView): void {
  const band = ctx.createLinearGradient(0, FLOOR, 0, H);
  band.addColorStop(0, '#132a26');
  band.addColorStop(1, '#0a1512');
  ctx.fillStyle = band;
  ctx.fillRect(0, FLOOR, W, H - FLOOR);
  if (view.dark > 0) {
    // The floor breaks up under the rug pull: slabs tilt and drop.
    for (let i = 0; i < 12; i += 1) {
      const x = i * 84 - (view.distance % 84);
      const drop = view.dark * (30 + noise(i * 2.7) * 90);
      ctx.save();
      ctx.translate(x + 42, FLOOR + 20 + drop);
      ctx.rotate((noise(i) - 0.5) * view.dark * 0.6);
      ctx.fillStyle = '#0a1512';
      ctx.fillRect(-42, -20, 84, 70);
      ctx.restore();
    }
  }
  line(ctx, [[0, FLOOR], [W, FLOOR]], view.dark > 0.3 ? RED : GREEN, 3, 'butt');
  text(ctx, 'SUPPORT', 12, FLOOR + 14, 9, view.dark > 0.3 ? RED : LIME, 'left', undefined, MONO);
  // The ticker tape.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, FLOOR + 24, W, 40);
  ctx.clip();
  ctx.font = `900 13px ${MONO}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const widths = TICKER.map((t) => ctx.measureText(t).width + 40);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = -((view.distance * 0.6 + view.time * 20) % total);
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < TICKER.length; i += 1) {
      const t = TICKER[i]!;
      ctx.fillStyle = t.includes('−') || t.includes('NGMI') ? '#ff8fa3' : t.includes('+') || t.includes('▲') ? '#8be26b' : '#c9d4ff';
      ctx.fillText(t, x, FLOOR + 44);
      x += widths[i]!;
    }
  }
  ctx.restore();
}

function resistance(ctx: CanvasRenderingContext2D, view: ChartView): void {
  ctx.setLineDash([10, 8]);
  line(ctx, [[0, CEILING], [W, CEILING]], `rgba(255, 77, 109, ${0.6 + 0.3 * view.tension})`, 2, 'butt');
  ctx.setLineDash([]);
  text(ctx, 'RESISTANCE', 735, CEILING + 11, 9, '#ff8fa3', 'left', undefined, MONO);
}

/** The launchpad the round leaves from, scrolling away with the chart. */
export function launchpad(ctx: CanvasRenderingContext2D, x: number, time: number): void {
  if (x < -240) return;
  panel(ctx, x - 100, FLOOR - 50, 200, 52, '#28305a', '#4a5590', 6, 2);
  for (let i = 0; i < 6; i += 1) {
    ctx.fillStyle = i % 2 ? GOLD : '#1b1a24';
    ctx.fillRect(x - 96 + i * 32, FLOOR - 50, 32, 7);
  }
  text(ctx, 'LAUNCHPAD', x, FLOOR - 26, 13, GOLD, 'center');
  text(ctx, `T-MINUS: WEN${'.'.repeat(1 + (Math.floor(time * 2) % 3))}`, x, FLOOR - 10, 7.5, '#c9d4ff', 'center', 180, MONO);
  line(ctx, [[x + 118, FLOOR], [x + 118, FLOOR - 120]], '#4a5590', 4);
  panel(ctx, x + 96, FLOOR - 146, 44, 28, '#0e1024', PINK, 4, 2);
  text(ctx, 'GM', x + 118, FLOOR - 132, 13, PINK, 'center');
}

// ---- Candles -----------------------------------------------------------------------------------------------

function candleBody(ctx: CanvasRenderingContext2D, x: number, top: number, bottom: number, fill: string, edge: string, label: string, seed: number): void {
  const h = bottom - top;
  if (h <= 2) return;
  panel(ctx, x - CANDLE_W / 2, top, CANDLE_W, h, fill, INK, 4, 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.fillRect(x - CANDLE_W / 2 + 4, top + 4, 8, Math.max(0, h - 8));
  line(ctx, [[x - CANDLE_W / 2 + 10, top + 3], [x + CANDLE_W / 2 - 10, top + 3]], edge, 2);
  if (h > 40) {
    ctx.save();
    ctx.translate(x, top + h / 2);
    ctx.rotate(-Math.PI / 2);
    text(ctx, label, 0, 0, 11, 'rgba(255, 255, 255, 0.75)', 'center', h - 14, MONO);
    ctx.restore();
  }
  void seed;
}

function candle(ctx: CanvasRenderingContext2D, c: Candle, view: ChartView): void {
  const top = c.gapY - c.gapH / 2;
  const bottom = c.gapY + c.gapH / 2;
  // A green candle claims any gain; a red one can only lose the lot.
  const pct = Math.floor(20 + noise(c.seed * 90) * 400);
  const loss = Math.min(99, pct);
  if (c.smashed) {
    // The rocket went through it: both halves in pieces, flying and fading.
    const k = Math.min(1, c.hitAge / 0.7);
    ctx.save();
    ctx.globalAlpha = 1 - k;
    for (let i = 0; i < 10; i += 1) {
      const dx = (noise(c.seed * 30 + i) - 0.5) * 260 * k;
      const dy = (noise(i * 4 + c.seed) - 0.5) * 200 * k + 300 * k * k;
      const from = i < 5 ? top - 20 - noise(i) * 80 : bottom + 20 + noise(i) * 80;
      panel(ctx, c.x + dx - 12, from + dy, 24, 16, i < 5 ? RED : GREEN, undefined, 2);
    }
    ctx.restore();
    return;
  }
  if (c.rugged >= 0) {
    // Flipped red and falling out of the chart.
    const t = c.rugged;
    const drop = 380 * t * t;
    ctx.save();
    ctx.globalAlpha = clamp(1.4 - t, 0, 1);
    ctx.translate(c.x, 0);
    ctx.rotate((noise(c.seed) - 0.5) * t * 0.8 * (view.reduced ? 0 : 1));
    candleBody(ctx, 0, CEILING + drop, top + drop, RED, RED_DARK, `−${loss}%`, c.seed);
    candleBody(ctx, 0, bottom + drop, FLOOR + drop, RED, RED_DARK, `−${loss}%`, c.seed);
    ctx.restore();
    return;
  }
  ctx.save();
  if (c.hit) ctx.globalAlpha = 0.75;
  candleBody(ctx, c.x, CEILING, top, RED, RED_DARK, `−${loss}%`, c.seed);
  candleBody(ctx, c.x, bottom, FLOOR, GREEN, GREEN_DARK, `+${pct}%`, c.seed);
  if (c.hit) {
    // The crack where the shiba went through.
    const y = top > 100 && noise(c.seed * 3) < 0.5 ? top - 24 : bottom + 24;
    line(ctx, [[c.x - 26, y - 14], [c.x - 8, y + 6], [c.x + 4, y - 10], [c.x + 24, y + 12]], '#fff', 2);
  }
  ctx.restore();
}

// ---- Pickups -----------------------------------------------------------------------------------------------

const COIN_COLOUR: Record<string, [string, string]> = { cope: ['#d38b3a', '#8a5218'], wagmi: ['#ffd23f', '#a67c00'] };

function pickup(ctx: CanvasRenderingContext2D, p: Pickup, view: ChartView): void {
  const { x, y } = p;
  if (p.taken) {
    const k = Math.min(1, p.age / 0.4);
    ctx.save();
    ctx.globalAlpha = 1 - k;
    const colour = p.kind === 'honey' ? PINK : p.kind === 'magnet' || p.kind === 'rocket' ? CYAN : GOLD;
    ctx.beginPath();
    ctx.arc(x, y, 14 + 40 * k, 0, Math.PI * 2);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 3 * (1 - k);
    ctx.stroke();
    const label = p.kind === 'honey' ? '−20% BAG' : p.kind === 'magnet' ? 'INSIDER TIP' : p.kind === 'rocket' ? 'ROCKET' : `+${COIN_VALUE[p.kind]}`;
    text(ctx, label, x, y - 24 - 40 * k, 15, colour, 'center');
    ctx.restore();
    return;
  }
  const spin = view.reduced ? 1 : Math.cos(view.time * 4 + p.seed * 9);
  switch (p.kind) {
    case 'cope':
    case 'wagmi': {
      const [face, rim] = COIN_COLOUR[p.kind]!;
      const radius = p.kind === 'wagmi' ? 16 : 13;
      const halo = ctx.createRadialGradient(x, y, radius * 0.4, x, y, radius * 2.2);
      halo.addColorStop(0, p.kind === 'wagmi' ? 'rgba(255, 210, 63, 0.35)' : 'rgba(211, 139, 58, 0.22)');
      halo.addColorStop(1, 'rgba(255, 210, 63, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x - radius * 2.2, y - radius * 2.2, radius * 4.4, radius * 4.4);
      ellipse(ctx, x, y, Math.max(0.5, radius * Math.abs(spin)), radius, face, rim, 2);
      if (Math.abs(spin) > 0.45) text(ctx, p.kind === 'wagmi' ? 'W' : 'C', x, y + 1, radius * 1.1, rim, 'center');
      break;
    }
    case 'lambo': {
      const radius = 19;
      const halo = ctx.createRadialGradient(x, y, radius * 0.3, x, y, radius * 2.4);
      halo.addColorStop(0, 'rgba(95, 242, 230, 0.45)');
      halo.addColorStop(1, 'rgba(95, 242, 230, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x - radius * 2.4, y - radius * 2.4, radius * 4.8, radius * 4.8);
      const w = Math.max(0.5, radius * Math.abs(spin));
      poly(ctx, [[x, y - radius], [x + w, y], [x, y + radius], [x - w, y]], CYAN, '#0d5b62', 2);
      poly(ctx, [[x, y - radius * 0.55], [x + w * 0.5, y], [x, y + radius * 0.55], [x - w * 0.5, y]], '#e8fffd');
      text(ctx, 'LAMBO', x, y - radius * 1.5, 9, CYAN, 'center');
      break;
    }
    case 'honey': {
      panel(ctx, x - 15, y - 10, 30, 28, '#5cbf3a', '#1f5a14', 6, 2);
      panel(ctx, x - 13, y - 18, 26, 9, '#2a3d1e', '#101a0c', 3, 1);
      ellipse(ctx, x, y + 3, 6, 6, '#fff');
      ellipse(ctx, x - 2.5, y + 2, 1.5, 2, '#1f5a14');
      ellipse(ctx, x + 2.5, y + 2, 1.5, 2, '#1f5a14');
      line(ctx, [[x - 3, y + 8], [x + 3, y + 8]], '#1f5a14', 1.5);
      for (const dx of [-10, 9]) ellipse(ctx, x + dx, y + 18 + (view.reduced ? 0 : ((view.time * 0.6 + p.seed) % 1) * 6), 2, 3, '#8be26b');
      text(ctx, 'HONEYPOT', x, y - 28, 9, '#8be26b', 'center');
      break;
    }
    case 'magnet': {
      panel(ctx, x - 11, y - 18, 22, 36, '#0e1224', '#8a94b8', 4, 1.5);
      panel(ctx, x - 9, y - 15, 18, 26, CYAN, undefined, 2);
      text(ctx, 'TIP', x, y - 2, 9, '#0b2a2a', 'center');
      text(ctx, 'INSIDER TIP', x, y - 28, 9, CYAN, 'center');
      break;
    }
    case 'rocket': {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.6);
      poly(ctx, [[-8, 16], [0, 30 + (view.reduced ? 0 : Math.sin(view.time * 9) * 5)], [8, 16]], '#ffaf42');
      poly(ctx, [[-9, 17], [-8, -10], [0, -24], [8, -10], [9, 17]], '#e5e3d6', '#3d314f', 2);
      ellipse(ctx, 0, -5, 4, 6, PINK);
      ctx.restore();
      text(ctx, 'ROCKET', x, y - 32, 9, PINK, 'center');
      break;
    }
  }
}

// ---- The FUD and the rug pull ----------------------------------------------------------------------------

/** The storm behind the shiba: closer as the heat rises, a bolt when it strikes. */
export function drawFud(ctx: CanvasRenderingContext2D, x: number, y: number, heat: number, strike: number, time: number, reduced: boolean): void {
  if (heat <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = clamp(heat * 2.5, 0, 1);
  ctx.translate(x, y + (reduced ? 0 : Math.sin(time * 1.7) * 6));
  const dark = heat > 0.7 ? '#2a2334' : '#3d3a52';
  for (const [dx, dy, r] of [[-40, 10, 28], [-5, -8, 36], [35, 6, 30], [10, 18, 26], [-30, 22, 22]] as const) ellipse(ctx, dx, dy, r, r * 0.8, dark, '#1a1626', 2);
  memeText(ctx, 'FUD', 0, 4, 26, heat > 0.7 ? PINK : '#c9c2e6', 'center');
  if (strike >= 0 && strike < 0.45 && !reduced) {
    const k = 1 - strike / 0.45;
    ctx.globalAlpha = k;
    line(ctx, [[20, 30], [50, 80], [30, 85], [70, 150]], '#fff8b0', 5);
    line(ctx, [[20, 30], [50, 80], [30, 85], [70, 150]], '#ffe066', 2);
  }
  ctx.restore();
}

function rugPull(ctx: CanvasRenderingContext2D, view: ChartView): void {
  if (!Number.isFinite(view.rugX)) return;
  const x = view.rugX;
  const wash = ctx.createLinearGradient(x, 0, x + 200, 0);
  wash.addColorStop(0, 'rgba(255, 60, 100, 0.35)');
  wash.addColorStop(1, 'rgba(255, 60, 100, 0.05)');
  ctx.fillStyle = wash;
  ctx.fillRect(x, 0, W - x + 200, H);
  line(ctx, [[x, 0], [x, H]], RED, 4, 'butt');
  ctx.save();
  ctx.translate(x + 26, 270);
  ctx.rotate(Math.PI / 2);
  memeText(ctx, 'RUG PULL', 0, 0, 34, RED, 'center');
  ctx.restore();
}

// ---- The chart ---------------------------------------------------------------------------------------------

export interface ChartWorld { candles: Candle[]; pickups: Pickup[] }

/** Draws the night, the chart and the shiba in order: `drawBird` is called between the candles and the pickups' pops. */
export function drawChart(ctx: CanvasRenderingContext2D, w: ChartWorld, view: ChartView, padX: number, drawBird: () => void): void {
  backdrop(ctx, view);
  resistance(ctx, view);
  support(ctx, view);
  launchpad(ctx, padX, view.time);
  for (const c of w.candles) if (c.x > -CANDLE_W && c.x < W + CANDLE_W) candle(ctx, c, view);
  for (const p of w.pickups) if (!p.taken && p.x > -40 && p.x < W + 40) pickup(ctx, p, view);
  drawBird();
  for (const p of w.pickups) if (p.taken) pickup(ctx, p, view);
  rugPull(ctx, view);
}

/** The picture darkens at the edges as the speed climbs. */
export function vignette(ctx: CanvasRenderingContext2D, strength: number): void {
  if (strength <= 0.01) return;
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(3, 5, 20, 0)');
  g.addColorStop(1, `rgba(3, 5, 20, ${clamp(strength, 0, 0.8)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export const rugProgress = (age: number): number => smoothstep(0, 0.75, age);
