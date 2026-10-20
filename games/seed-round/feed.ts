/**
 * A pump.fun-style live trade feed in the top-right corner: buys in green,
 * sells in red, faster as the multiplier climbs, with the story's beats
 * (snipers dumping, jeet waves, the whale, the SEC, your exit as
 * paperhands69, the dev)
 * posted as they happen, and the rumours that come out at each rung of the
 * multiplier (1 WALLET 69%, INFLUENCER SOLD HIS MOM'S BAG, DEV WENT DARK).
 * Seeded, so a replay prints the same feed.
 */
import { memeText, W } from './hud';
import { mulberry32 } from './motion';

const HANDLES = ['7xKp…q2F', 'jeetmaxxer', 'exitliq.sol', '4Rfz…9aB', 'diamondtails.sol', 'devmom.sol', 'gm_ser', 'Hq3v…Lm1', 'rugdoctor', 'ngmi.sol', 'wifhat_whale', 'Cx8e…T7d', 'loadmaxxer', 'bagholder.sol', 'swimteam.sol'];
const ROWS = 5;
/** The rumours, in the order the multiplier lets them out. A scene joining late skips the ones already out. */
const RUMOURS: [number, string][] = [
  [1.15, '300M HOLDERS · 1 WALLET 69%'],
  [1.6, "INFLUENCER SOLD HIS MOM'S BAG"],
  [2.2, 'DEV WENT DARK'],
  [2.9, 'DEV BACK: "WAS AT THE GYM"'],
  [3.8, 'TOP HOLDER SENT 69% TO A CEX'],
  [5.2, 'AUDIT: "SEEMS FINE"'],
  [6.9, 'GRADUATED · DEV BACK AT THE GYM'],
  [8.5, 'MOM WANTS HER BAG BACK'],
  [12, 'DEV WENT DARK AGAIN'],
  [18, 'SEC INTERN JOINED THE CHAT'],
  [30, 'EGG HAS A BOYFRIEND'],
];

interface Trade { text: string; kind: 'buy' | 'sell' | 'news'; age: number }

export interface Feed {
  trades: Trade[];
  next: number;
  random: () => number;
  /** The next rumour due. */
  rumour: number;
}

export function createFeed(): Feed {
  return { trades: [], next: 0, random: mulberry32(0xfeed), rumour: 0 };
}

export function resetFeed(feed: Feed): void {
  feed.trades = [];
  feed.next = 0;
  feed.random = mulberry32(0xfeed);
  feed.rumour = 0;
}

/** Joins a round in progress: what the multiplier already let out is not posted again. */
export function settleFeed(feed: Feed, multiplier: number): void {
  feed.rumour = RUMOURS.filter(([at]) => multiplier >= at).length;
}

export function post(feed: Feed, text: string, kind: Trade['kind']): void {
  feed.trades.unshift({ text, kind, age: 0 });
  if (feed.trades.length > ROWS) feed.trades.length = ROWS;
}

/** Steps the feed; returns true when a rumour came out this step. */
export function stepFeed(feed: Feed, running: boolean, tension: number, dt: number, multiplier: number): boolean {
  for (const trade of feed.trades) trade.age += dt;
  if (!running) return false;
  const due = RUMOURS[feed.rumour];
  if (due && multiplier >= due[0]) {
    feed.rumour += 1;
    post(feed, due[1], 'news');
    return true;
  }
  feed.next -= dt;
  if (feed.next > 0) return false;
  const r = feed.random;
  feed.next = 0.9 - 0.65 * tension + r() * 0.3;
  const buy = r() < 0.72 - 0.25 * tension;
  const who = HANDLES[Math.floor(r() * HANDLES.length)]!;
  const sol = (buy ? 0.2 + r() * r() * 9 : 0.1 + r() * 4).toFixed(2);
  post(feed, `${who} ${buy ? 'bought' : 'sold'} ${sol} SOL`, buy ? 'buy' : 'sell');
  return false;
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
