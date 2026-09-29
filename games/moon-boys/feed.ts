/**
 * Mission control is a voice chat in the top-right corner: the dev, a mod
 * who is asleep, a moonboy, mom, and whoever else joins. Chatter comes
 * faster with the multiplier, holders join and leave the call as they climb
 * aboard and let go, and the beats of the round are announced as they
 * happen, with a line at each rung of the multiplier (DEV: BRB, MOM: DINNER
 * IS READY, DEV HAS LEFT THE CALL). Seeded, so a replay prints the same chat.
 */
import { W, memeText } from './hud';
import { mulberry32 } from './motion';

const HANDLES = ['jeetmaxxer', 'gm_ser', 'wifhat_whale', 'bagholder.sol', 'paperhands69', 'loadmaxxer', 'rugdoctor', 'ngmi.sol', 'moonboy420', 'flatearth.sol', 'nasa_intern', 'exitliq.sol'];
const CHATTER = ['gm', 'wen moon', 'ser', 'i sold my house for this', 'dev is based', 'this is the one', 'shorting it', 'my wife left', 'is this a rug', 'no', 'yes', 'buying more', 'cooking', 'ngmi', 'wagmi', 'lfg', 'ape in', 'took profit', 'first time?', 'mod pls', 'is dev here', 'dev?', 'the moon looks fake', 'NASA is bullish', 'flat earth was right', 'jeets crying', 'shut up', 'i can see my house', 'why is the sky a wall', 'hold the railing'];
const ROWS = 6;
/** The lines the multiplier lets out, in order. A scene joining late skips the ones already said. */
const RUNGS: [number, string, string][] = [
  [1.12, 'dev', 'gm. we are so back'],
  [1.6, 'moonboy69', 'WEN MOON SER'],
  [2.2, 'mod', 'zzz'],
  [2.9, 'dev', 'brb'],
  [3.8, 'mom', 'dinner is ready'],
  [5.2, 'dev', 'the wire is a feature'],
  [6.9, 'moonboy69', 'nice'],
  [8.5, 'mom', 'is that my good rug'],
  [12, 'dev', '(left the call)'],
  [18, 'mod', 'who is flying this thing'],
  [30, 'moonboy69', 'i can see my house. it is flat'],
  [50, 'mom', 'your father is home'],
  [100, 'dev', '(joined the call) gm'],
];

export type Kind = 'chat' | 'news' | 'join' | 'leave';
interface Line { who: string; text: string; kind: Kind; age: number }

export interface Feed {
  lines: Line[];
  next: number;
  random: () => number;
  /** The next rung line due. */
  rung: number;
}

export function createFeed(): Feed {
  return { lines: [], next: 0.6, random: mulberry32(0x6d00), rung: 0 };
}

export function resetFeed(feed: Feed): void {
  feed.lines = [];
  feed.next = 0.6;
  feed.random = mulberry32(0x6d00);
  feed.rung = 0;
}

/** Joins a round in progress: what the multiplier already let out is not said again. */
export function settleFeed(feed: Feed, multiplier: number): void {
  feed.rung = RUNGS.filter(([at]) => multiplier >= at).length;
}

export function post(feed: Feed, who: string, text: string, kind: Kind = 'chat'): void {
  feed.lines.unshift({ who, text, kind, age: 0 });
  if (feed.lines.length > ROWS) feed.lines.length = ROWS;
}

/** Steps the chat; returns true when a rung line came out this step. */
export function stepFeed(feed: Feed, running: boolean, tension: number, dt: number, multiplier: number): boolean {
  for (const line of feed.lines) line.age += dt;
  if (!running) return false;
  const due = RUNGS[feed.rung];
  if (due && multiplier >= due[0]) {
    feed.rung += 1;
    post(feed, due[1], due[2], 'news');
    return true;
  }
  feed.next -= dt;
  if (feed.next > 0) return false;
  const r = feed.random;
  feed.next = 1.1 - 0.7 * tension + r() * 0.5;
  const who = HANDLES[Math.floor(r() * HANDLES.length)]!;
  const roll = r();
  if (roll < 0.12) post(feed, who, 'joined the call', 'join');
  else if (roll < 0.2 + 0.25 * tension) post(feed, who, 'left the call', 'leave');
  else post(feed, who, CHATTER[Math.floor(r() * CHATTER.length)]!, 'chat');
  return false;
}

const colourOf = (who: string, kind: Kind): string => {
  if (kind === 'join') return '#86efac';
  if (kind === 'leave') return '#ff6b86';
  if (who === 'dev') return '#c9f76b';
  if (who === 'mom') return '#ff9ad5';
  if (who === 'mod') return '#ffd24a';
  if (who === 'moonboy69') return '#8ff0ff';
  return '#c9d2e6';
};

export function drawFeed(ctx: CanvasRenderingContext2D, feed: Feed): void {
  if (feed.lines.length === 0) return;
  const x = W - 16;
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,22,0.6)';
  ctx.beginPath();
  ctx.roundRect(x - 226, 14, 226, 20 + ROWS * 17, 8);
  ctx.fill();
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#b9c3d6';
  ctx.fillText('MISSION CONTROL · voice', x - 216, 29);
  ctx.fillStyle = '#86efac';
  ctx.beginPath();
  ctx.arc(x - 24, 25, 4, 0, Math.PI * 2);
  ctx.fill();
  feed.lines.forEach((line, i) => {
    ctx.globalAlpha = Math.min(1, line.age * 6) * (1 - i * 0.11);
    const colour = colourOf(line.who, line.kind);
    const text = line.kind === 'chat' || line.kind === 'news' ? `${line.who}: ${line.text}` : `${line.who} ${line.text}`;
    if (line.kind === 'news') memeText(ctx, text.toUpperCase(), x - 216, 47 + i * 17, 13, colour, 'left', 208);
    else {
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = colour;
      ctx.fillText(text, x - 216, 47 + i * 17, 208);
    }
  });
  ctx.restore();
}
