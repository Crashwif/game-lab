/**
 * A pump.fun-style live trade feed in the top-right corner: buys in green,
 * sells in red, faster as the multiplier climbs, with the story's beats
 * (snipers dumping, jeet waves, the whale, the SEC, your exit, the dev)
 * posted as they happen. Seeded, so a replay prints the same feed.
 */
import { memeText, W } from './hud';
import { mulberry32 } from './motion';

const HANDLES = ['7xKp…q2F', 'jeetmaxxer', 'exitliq.sol', '4Rfz…9aB', 'paperhands69', 'devmom.sol', 'gm_ser', 'Hq3v…Lm1', 'rugdoctor', 'ngmi.sol', 'wifhat_whale', 'Cx8e…T7d', 'copytrader', 'bagholder.sol', 'fomo_andy'];
const ROWS = 5;

interface Trade { text: string; kind: 'buy' | 'sell' | 'news'; age: number }

export interface Feed {
  trades: Trade[];
  next: number;
  random: () => number;
}

export function createFeed(): Feed {
  return { trades: [], next: 0, random: mulberry32(0xfeed) };
}

export function resetFeed(feed: Feed): void {
  feed.trades = [];
  feed.next = 0;
  feed.random = mulberry32(0xfeed);
}

export function post(feed: Feed, text: string, kind: Trade['kind']): void {
  feed.trades.unshift({ text, kind, age: 0 });
  if (feed.trades.length > ROWS) feed.trades.length = ROWS;
}

export function stepFeed(feed: Feed, running: boolean, tension: number, dt: number): void {
  for (const trade of feed.trades) trade.age += dt;
  if (!running) return;
  feed.next -= dt;
  if (feed.next > 0) return;
  const r = feed.random;
  feed.next = 0.9 - 0.65 * tension + r() * 0.3;
  const buy = r() < 0.72 - 0.25 * tension;
  const who = HANDLES[Math.floor(r() * HANDLES.length)]!;
  const sol = (buy ? 0.2 + r() * r() * 9 : 0.1 + r() * 4).toFixed(2);
  post(feed, `${who} ${buy ? 'bought' : 'sold'} ${sol} SOL`, buy ? 'buy' : 'sell');
}

export function drawFeed(ctx: CanvasRenderingContext2D, feed: Feed): void {
  if (feed.trades.length === 0) return;
  const x = W - 16;
  ctx.save();
  ctx.fillStyle = 'rgba(16,6,12,0.55)';
  ctx.beginPath();
  ctx.roundRect(x - 214, 14, 214, 18 + ROWS * 17, 8);
  ctx.fill();
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#c9b3bd';
  ctx.fillText('LIVE TRADES', x - 204, 28);
  feed.trades.forEach((trade, i) => {
    ctx.globalAlpha = Math.min(1, trade.age * 6) * (1 - i * 0.12);
    const colour = trade.kind === 'buy' ? '#86efac' : trade.kind === 'sell' ? '#ff6b86' : '#ffe27a';
    if (trade.kind === 'news') memeText(ctx, trade.text, x - 204, 45 + i * 17, 13, colour, 'left', 196);
    else {
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = colour;
      ctx.fillText(trade.text, x - 204, 45 + i * 17, 196);
    }
  });
  ctx.restore();
}
