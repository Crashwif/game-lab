/**
 * The estate: the will's words and the inventory. The dialogue ladder keyed to the displayed multiplier, the
 * overtime codicils, the lines after an exit and at the crash, the captions, and every bequest as an item that
 * lands on the table when it is read and melts as the curve climbs past it, with its puddle, its drips over
 * the table's edge and, at the crash, the lawyer's COLLATERAL stamp. Presentation only: nothing here reads or
 * changes the round's outcome.
 */
import { blob, box, ink, INK, label, poly } from './ink';
import { clamp, fract, mix, noise, smoothstep } from './motion';
import type { Line } from './script';
import { collateralStamp, TABLE } from './study';

export const TITLE = 'THE READING';

/**
 * Peterson reads at a lawyer's clip: each bequest stays up the README's 2.6 s before the next replaces it (the
 * early rungs come faster than anyone can read, so the reading runs a little behind the curve), and a line with
 * nothing after it stays up as long as it takes to read.
 */
const read = (at: number, text: string, extra: Partial<Line> = {}): Line => ({ at, who: 'peterson', text, hold: 2.6, ...extra });

/** The ladder, keyed to the displayed multiplier. `cap` sets the caption once said; `beat` stages the bequest. */
export const LADDER: Line[] = [
  read(1.15, 'Item one: to my son, the house. To my son’s debt, the house: it is not actually available, as it is collateral. Moving on.', { cap: 'GM FAMILY', beat: 'house' }),
  read(1.35, 'Item two: to my daughter, my service for twelve. Twelve of what is not specified. She will know.', { beat: 'service' }),
  { at: 1.36, who: 'mom', text: 'Twelve. The good dining room. She meant the good dining room.', gap: 1 },
  read(1.55, 'Item three: to my grandson, my bags.', { cap: 'ITEM THREE: THE BAGS', beat: 'bags' }),
  { at: 1.56, who: 'dad', text: 'Her what?', gap: 1.5 },
  read(1.57, 'Bags. Spelled out in full. She was competent.', { beat: 'brow' }),
  read(1.8, 'The bags are held in a wallet whose recovery phrase is hidden where I always hid the good chocolate.', { beat: 'kitchen' }),
  { at: 1.81, who: 'kitchen', text: 'Checking the drawers!', gap: 0.8 },
  read(2.1, 'Item four: to the twins, my car. I say “car”. It is a lease. The lease is in the wallet with the bags.', { cap: 'NUMBER GO UP', beat: 'car' }),
  read(2.4, 'Item five: the sampler completes. The missing word is “dumping”.', { beat: 'sampler' }),
  read(2.8, 'Item six: Gerald. Whoever keeps Gerald keeps the house’s walls. Gerald is structural.', { cap: 'SHE WAS COMPETENT', beat: 'gerald' }),
  read(3.2, 'Item seven: my synthetic grandmother, to whoever is newest to the family. She is not a grandmother. She is a chatbot with my voice.', { beat: 'gran' }),
  { at: 3.21, who: 'gran', text: 'HELLO. I AM A CHATBOT FROM 2019, MADE SO SHE COULD ATTEND TWO THINGS AT ONCE. HOW CAN I HELP YOU GRIEVE?', gap: 0.8, beat: 'hello' },
  read(3.8, 'Item eight: my timeshare, which is in three countries, none of which I visited, one of which does not exist.', { beat: 'timeshare' }),
  { at: 3.81, who: 'dad', text: 'Which one has the guest room?', gap: 0.9 },
  read(4.5, 'Item nine: the crypto hoodie my grandson leaves at my house. I am leaving it back to him, washed. It is worth more than the bags.', { cap: 'DIAMOND ESTATE', beat: 'hoodie' }),
  { at: 4.51, who: 'nephew', text: 'Correct, honestly.', gap: 0.9 },
  read(5.5, 'Item ten: my subscription to the genealogy site, so the family can find out where the money came from. It came from the money.', { beat: 'genealogy' }),
  { at: 5.51, who: 'mom', text: 'It came from the conservatory. I know it did.', gap: 0.9 },
  read(7, 'Item eleven: to the notary’s assistant, my condolences, and a week of paid leave, effective the moment this is read aloud.', { beat: 'assistant' }),
  { at: 7.01, who: 'assistant', text: 'Noted.', gap: 1, beat: 'leave' },
  read(9, 'Item twelve: the daily paper, so that someone in this room knows what the market did without opening an app.', { beat: 'paper' }),
  { at: 9.01, who: 'nephew', text: 'I know what the market did. Nobody asked.', gap: 0.9 },
  read(12, 'Item thirteen: whatever is in the freezer. It is not meat. Do not open it. Do not *not* open it.', { beat: 'freezer' }),
  { at: 12.01, who: 'dad', text: 'Nobody open the freezer.', gap: 0.9 },
  read(18, 'Item fourteen: my recovery phrase, in case the chocolate has been found: it is not in the chocolate. Read item one again.', { cap: 'READ ITEM ONE AGAIN', beat: 'phrase' }),
  { at: 18.01, who: 'kitchen', text: 'Found the chocolate! It’s… just chocolate.', gap: 0.9 },
  read(25, 'Item fifteen, final: to the whole family, the chart. It is the only thing I ever actually owned, and now, so do you.', { cap: 'THIS IS FINE', beat: 'chart' }),
];

/** Past item fifteen the codicils come due every 1.35× of multiplier, in order, forever. */
export const OVERTIME: Omit<Line, 'at'>[] = [
  { who: 'peterson', text: 'Codicil one: the estate has gone up again. Nobody is to say “gains” at the table.', cap: 'CODICIL SEASON', beat: 'brow' },
  { who: 'dad', text: 'That’s the guest room. That’s the guest room going up.' },
  { who: 'gran', text: 'AS A SYNTHETIC GRANDMOTHER I CANNOT HOLD ASSETS. I CAN HOLD A RECIPE. WOULD YOU LIKE A RECIPE?' },
  { who: 'peterson', text: 'Codicil two: should the chart exceed the ceiling, the ceiling is also collateral.', beat: 'page' },
  { who: 'mom', text: 'I’m giving the eulogy in my head. It’s going very well.' },
  { who: 'nephew', text: 'Up another forty percent. I’m just saying it out loud. For the record.', cap: 'NUMBER GO UP' },
  { who: 'peterson', text: 'Codicil three: Gerald is not to be consulted. Gerald has been consulted.', beat: 'gerald' },
  { who: 'twins', text: 'Is it rude to ask if we’re rich? Do we have to drive the lease?' },
  { who: 'kitchen', text: 'Still looking! The drawers are all open now!' },
  { who: 'peterson', text: 'Codicil four: the family is to remain calm and not read the footnotes.', cap: 'DIAMOND ESTATE', beat: 'page' },
  { who: 'gran', text: 'I’M SORRY, I DIDN’T CATCH THAT. DID YOU SAY “INHERITANCE” OR “IN THE FRIDGE”?' },
  { who: 'dad', text: 'Every bequest is a room. We are out of rooms.' },
  { who: 'peterson', text: 'Codicil five: my fee schedule is attached, and has been since item one.', beat: 'brow' },
  { who: 'mom', text: 'She kept the receipts. She always kept the receipts.', cap: 'SHE WAS COMPETENT' },
  { who: 'nephew', text: 'Nobody’s going to look at the chart? Okay. Cool.' },
  { who: 'nephew', text: 'I came straight from the wake. Different Gerald. Same chart.' },
  { who: 'peterson', text: 'Codicil six: the estate continues to appreciate. So do I. Moving on.', cap: 'THIS IS FINE', beat: 'page' },
];

/** Said on the stand-up while bets are open. */
export const BETTING_LINE: Omit<Line, 'at'> = { who: 'peterson', text: 'Dearly — we are here for the reading of the last will and testament of the late Margaret Holdern, who we are told kept excellent records. Item one.', cap: 'THE READING', hold: 2.6 };

export const CAPTIONS = {
  waiting: 'THE FAMILY GATHERS',
  /** The exit's badge, and the caption while the round keeps running without you. */
  exit: ['ACCEPTED · NOT IN THE CHOCOLATE', 'WILL UNDER ARM'],
  kept: 'THE ESTATE MELTS. THE READING CONTINUES.',
  dodged: 'RUG DODGED — WILL UNDER ARM',
  watched: 'YOU WERE NOT IN THE WILL',
} as const;

/** The crash captions, keyed to the crash clock, then cycled once the ending is complete. */
export const CRASH_CAPTIONS: readonly [number, string][] = [[0, 'DEV SOLD'], [1.0, 'EVERYTHING IS COLLATERAL'], [2.2, 'SHE FROZE THE DIP'], [3.8, 'NGMI']];

/** What is said after an exit, keyed to how far past the exit the multiplier is. */
export const REGRET: [past: number, line: Omit<Line, 'at'>][] = [
  [1.5, { who: 'peterson', text: 'The seat at the end has taken item fourteen, and the will. We continue from the copy.' }],
  [2, { who: 'dad', text: 'They took the will? We were using that.' }],
  [3, { who: 'mom', text: 'They’re the only one who’s actually read it. Should we call them?' }],
  [5, { who: 'nephew', text: 'Smart. Honestly. Smart.' }],
  [10, { who: 'gran', text: 'YOUR RELATIVE HAS LEFT THE CHAT.' }],
];

/** The crash's lines, keyed to seconds of crash age. The nephew says nothing. He is not asked. The lien is read
 * over the items on the table (`lien`) or, when the crash came before anything was read, over the will (`unread`). */
export const CRASH_LINES: [at: number, line: Omit<Line, 'at'>][] = [
  [0.35, { who: 'peterson', text: 'One more filing. Since item one.' }],
  [1.15, { who: 'peterson', text: 'Every bequest today carries a lien. The service, the lease, the washed hoodie, the subscription: collateral. The bank keeps everything.', beat: 'lien' }],
  // Swapped in for the line above when the crash comes before anything was read.
  [1.15, { who: 'peterson', text: 'Every bequest in this will carries a lien. I have not read them yet. It does not matter. The bank keeps everything.', beat: 'unread' }],
  [2.6, { who: 'dad', text: 'She froze the dip.' }],
  [3.4, { who: 'mom', text: 'She was competent.' }],
  [5.0, { who: 'peterson', text: 'That concludes the reading. Your receipt.' }],
];

/** The cash-out: the player's seat accepts item fourteen. */
/** Whether a crash line belongs to this crash: the two readings of the lien depend on what is on the table. */
export const crashLineFits = (line: Omit<Line, 'at'>, itemsRead: boolean): boolean => !((line.beat === 'unread' && itemsRead) || (line.beat === 'lien' && !itemsRead));

export const EXIT_LINE: Omit<Line, 'at'> = { who: 'peterson', text: 'Item fourteen — the recovery phrase hunt — is accepted by the seat at the end. Here. Take the will.' };

export const STAMP = { rekt: 'COLLATERAL', dodged: 'DODGED THE LIEN', watched: 'NOT IN THE WILL' } as const;

// ---- The inventory ----------------------------------------------------------------------------------------

export interface Bequest {
  n: number;
  /** The line beat that reads it out, and its rung (for late entry and for a line the queue dropped). */
  beat: string;
  at: number;
  /** Where it sits on the table (its base), how wide its puddle starts, and what colour it melts into. */
  x: number;
  y: number;
  w: number;
  puddle: string;
  /** Where Grandma's eyes go when it is read. */
  look: { x: number; y: number };
  /** Set pieces carry a tag instead of sitting on the table. */
  tag?: 'sampler' | 'gerald' | 'freezer';
  draw?: (ctx: CanvasRenderingContext2D, time: number) => void;
}

export const HEADS = {
  peterson: { x: 366, y: 226 },
  dad: { x: 664, y: 266 },
  mom: { x: 576, y: 270 },
  twins: { x: 470, y: 290 },
  nephew: { x: 236, y: 368 },
  assistant: { x: 830, y: 268 },
  you: { x: 806, y: 404 },
  kitchen: { x: 930, y: 236 },
  gran: { x: 870, y: 352 },
} as const;

function house(ctx: CanvasRenderingContext2D): void {
  box(ctx, -15, -20, 30, 20, 1, '#efe2c4', 2);
  box(ctx, 6, -34, 6, 10, 1, '#8a4a3a', 1.5);
  poly(ctx, [-19, -19, 0, -36, 19, -19], '#a8453a', 2);
  box(ctx, -3, -11, 6, 11, 1, '#6a3a24', 1.5);
  box(ctx, -12, -16, 6, 5, 1, '#8ac0d8', 1.2);
  box(ctx, 6, -16, 6, 5, 1, '#8ac0d8', 1.2);
}

function service(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < 4; i += 1) {
    blob(ctx, 0, -3 - i * 4, 18, 4.5, '#f7f4ee', 1.8);
    ctx.strokeStyle = '#5a7ab0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, -3 - i * 4, 13, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  box(ctx, -6, -28, 12, 10, 3, '#f7f4ee', 1.8);
  ink(ctx, 1.5);
  ctx.beginPath();
  ctx.arc(7, -23, 3, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.fillStyle = '#5a7ab0';
  ctx.fillRect(-6, -25, 12, 2);
}

function sack(ctx: CanvasRenderingContext2D, x: number, s: number): void {
  ctx.save();
  ctx.translate(x, 0);
  ctx.scale(s, s);
  ctx.fillStyle = '#c8a46a';
  ink(ctx, 1.8);
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.quadraticCurveTo(-14, -12, -5, -18);
  ctx.lineTo(5, -18);
  ctx.quadraticCurveTo(14, -12, 10, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  poly(ctx, [-6, -18, -9, -24, 9, -24, 6, -18], '#d8b47a', 1.5);
  ctx.strokeStyle = '#6a4a2a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-6, -18);
  ctx.lineTo(6, -18);
  ctx.stroke();
  // A generic token glyph, stencilled.
  ctx.strokeStyle = '#6a4a2a';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, -8, 4.5, 0, Math.PI * 2);
  ctx.moveTo(-2.5, -8);
  ctx.lineTo(2.5, -8);
  ctx.stroke();
  ctx.restore();
}

function bags(ctx: CanvasRenderingContext2D): void {
  sack(ctx, -12, 0.85);
  sack(ctx, 12, 0.85);
  sack(ctx, 0, 1);
}

function car(ctx: CanvasRenderingContext2D, time: number): void {
  poly(ctx, [-9, -10, 7, -10, 11, -17, -5, -17], '#cfe4ee', 1.5);
  box(ctx, -18, -11, 36, 8, 3, '#c83a3a', 1.8);
  blob(ctx, -10, -2, 4, 4, '#2a2a2a', 1.5);
  blob(ctx, 10, -2, 4, 4, '#2a2a2a', 1.5);
  // The tag on a string: it is a lease.
  ctx.save();
  ctx.translate(14, -12);
  ctx.rotate(0.3 + 0.08 * Math.sin(time * 2));
  ctx.strokeStyle = '#d8cfb8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(6, 6);
  ctx.stroke();
  box(ctx, 3, 5, 22, 9, 1, '#f3e3b8', 1);
  label(ctx, 'LEASE', 14, 9.5, 6, '#7a2430', 900, 20);
  ctx.restore();
}

/** The synthetic grandmother: a 2019 smart display with a cartoon face. A chatbot, never a person. */
export function drawGranBot(ctx: CanvasRenderingContext2D, time: number, talk: number): void {
  poly(ctx, [-9, 0, 9, 0, 5, -8, -5, -8], '#3a3a44', 1.8);
  box(ctx, -17, -34, 34, 27, 4, '#2a2a34', 2);
  box(ctx, -14, -31, 28, 19, 2, '#bfe8f0', 1);
  ctx.fillStyle = '#2a4a5a';
  const blink = fract(time * 0.23) > 0.96 ? 0.3 : 1;
  ctx.fillRect(-7, -26, 3, 4 * blink);
  ctx.fillRect(4, -26, 3, 4 * blink);
  ctx.strokeStyle = '#2a4a5a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= 8; i += 1) {
    const px = -7 + i * 1.75;
    const py = -17 + (talk > 0.05 ? Math.sin(time * 22 + i * 1.3) * 2.5 * talk : 0);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.fillStyle = talk > 0.05 ? '#5ae0ff' : '#3a8a9a';
  ctx.fillRect(-12, -9, 24, 1.6);
  label(ctx, 'GRAN.BOT 2019', 0, -38, 5.5, '#e8f6fa', 900, 34);
}

function timeshare(ctx: CanvasRenderingContext2D): void {
  poly(ctx, [-16, 0, -16, -22, -5, -19, -5, 2], '#f3f0e6', 1.5);
  poly(ctx, [-5, 2, -5, -19, 6, -22, 6, 0], '#e6e2d6', 1.5);
  poly(ctx, [6, 0, 6, -22, 17, -19, 17, 2], '#f3f0e6', 1.5);
  const flags = [['#3a6ac8', '#f3f0e6'], ['#e0b64a', '#3a9a5a'], ['#9a9aa4', '#9a9aa4']] as const;
  flags.forEach(([a, b], i) => {
    const fx = -14 + i * 11;
    ctx.fillStyle = a;
    ctx.fillRect(fx, -16, 7, 3);
    ctx.fillStyle = b;
    ctx.fillRect(fx, -13, 7, 3);
  });
  label(ctx, '?', 11.5, -14, 7, '#2a2a34', 900);
  label(ctx, 'TIMESHARE', 0, -6, 4.5, '#2a2a34', 900, 30);
}

function hoodie(ctx: CanvasRenderingContext2D): void {
  box(ctx, -17, -10, 34, 10, 3, '#2a2a34', 1.8);
  box(ctx, -12, -16, 24, 7, 3, '#34343f', 1.8);
  blob(ctx, 0, -5, 4, 4, '#4ae07a', 1.2);
  ctx.strokeStyle = '#d8d8e0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-4, -10);
  ctx.lineTo(-5, -3);
  ctx.moveTo(4, -10);
  ctx.lineTo(5, -3);
  ctx.stroke();
  box(ctx, 10, -20, 16, 7, 1, '#f3e3b8', 1);
  label(ctx, 'WASHED', 18, -16.5, 4.5, '#2a4a8a', 900, 15);
}

function genealogy(ctx: CanvasRenderingContext2D): void {
  box(ctx, -13, -20, 26, 20, 1, '#f3ecd8', 1.5);
  ctx.strokeStyle = '#6a4a2a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(0, -10);
  ctx.moveTo(0, -8);
  ctx.lineTo(-5, -12);
  ctx.moveTo(0, -8);
  ctx.lineTo(5, -12);
  ctx.stroke();
  blob(ctx, 0, -14, 8, 4.5, '#6aa05a', 1.2);
  label(ctx, '$ → $', 0, -4, 4.5, '#6a4a2a', 900, 22);
}

function condolences(ctx: CanvasRenderingContext2D): void {
  box(ctx, -14, -12, 28, 12, 1, '#f6f2ea', 1.5);
  ctx.strokeStyle = '#1d1418';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-12, -10, 24, 8);
  ctx.beginPath();
  ctx.moveTo(-14, -12);
  ctx.lineTo(0, -5);
  ctx.lineTo(14, -12);
  ctx.stroke();
  box(ctx, 4, -18, 16, 7, 1, '#ffe27a', 1);
  label(ctx, '1 WK', 12, -14.5, 4.5, '#2a2a34', 900, 14);
}

function paper(ctx: CanvasRenderingContext2D): void {
  poly(ctx, [-19, 0, 17, 0, 19, -10, -17, -10], '#e9e5d8', 1.6);
  label(ctx, 'THE DAILY', 0, -7, 4.5, '#2a2a34', 900, 30);
  ctx.fillStyle = '#8a8a90';
  ctx.fillRect(-14, -4, 12, 1);
  ctx.fillRect(2, -4, 12, 1);
  ctx.fillRect(-14, -2, 28, 1);
}

function phrase(ctx: CanvasRenderingContext2D): void {
  box(ctx, -15, -6, 16, 6, 1, '#5a3020', 1.5);
  ctx.strokeStyle = 'rgba(255, 220, 180, 0.4)';
  ctx.lineWidth = 1;
  for (const gx of [-11, -7, -3]) {
    ctx.beginPath();
    ctx.moveTo(gx, -6);
    ctx.lineTo(gx, 0);
    ctx.stroke();
  }
  poly(ctx, [-2, 0, 15, 0, 13, -12, -4, -12], '#fbf6ea', 1.5);
  label(ctx, 'NOT IN', 5.5, -8, 4, '#7a2430', 900, 16);
  label(ctx, 'HERE', 5.5, -4, 4, '#7a2430', 900, 16);
}

function chart(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(8, 0);
  ctx.stroke();
  box(ctx, -22, -40, 44, 34, 2, '#c9a14a', 2);
  box(ctx, -17, -35, 34, 24, 1, '#fbf6ea', 1);
  ctx.strokeStyle = '#3a9a4a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-14, -14);
  ctx.lineTo(-7, -18);
  ctx.lineTo(-2, -16);
  ctx.lineTo(5, -25);
  ctx.lineTo(9, -23);
  ctx.lineTo(14, -32);
  ctx.stroke();
}

export const BEQUESTS: Bequest[] = [
  { n: 1, beat: 'house', at: 1.15, x: 664, y: 388, w: 34, puddle: '#c9a274', look: HEADS.dad, draw: house },
  { n: 2, beat: 'service', at: 1.35, x: 582, y: 390, w: 36, puddle: '#a9bcd8', look: HEADS.mom, draw: service },
  { n: 3, beat: 'bags', at: 1.55, x: 742, y: 386, w: 40, puddle: '#a8844e', look: HEADS.nephew, draw: bags },
  { n: 4, beat: 'car', at: 2.1, x: 470, y: 392, w: 38, puddle: '#c03a3a', look: HEADS.twins, draw: car },
  { n: 5, beat: 'sampler', at: 2.4, x: 790, y: 150, w: 0, puddle: '', look: { x: 790, y: 150 }, tag: 'sampler' },
  { n: 6, beat: 'gerald', at: 2.8, x: 665, y: 126, w: 0, puddle: '', look: { x: 665, y: 120 }, tag: 'gerald' },
  { n: 7, beat: 'gran', at: 3.2, x: 872, y: 374, w: 32, puddle: '#5a6a7a', look: HEADS.you },
  { n: 8, beat: 'timeshare', at: 3.8, x: 624, y: 400, w: 34, puddle: '#6aaed0', look: HEADS.dad, draw: timeshare },
  { n: 9, beat: 'hoodie', at: 4.5, x: 784, y: 398, w: 36, puddle: '#3a3a46', look: HEADS.nephew, draw: hoodie },
  { n: 10, beat: 'genealogy', at: 5.5, x: 528, y: 396, w: 28, puddle: '#78a868', look: HEADS.mom, draw: genealogy },
  { n: 11, beat: 'assistant', at: 7, x: 830, y: 364, w: 28, puddle: '#d4c6a4', look: HEADS.assistant, draw: condolences },
  { n: 12, beat: 'paper', at: 9, x: 438, y: 398, w: 38, puddle: '#bcb4a0', look: { x: 620, y: 300 }, draw: paper },
  { n: 13, beat: 'freezer', at: 12, x: 918, y: 240, w: 0, puddle: '', look: { x: 960, y: 230 }, tag: 'freezer' },
  { n: 14, beat: 'phrase', at: 18, x: 704, y: 400, w: 30, puddle: '#6a4030', look: HEADS.you, draw: phrase },
  { n: 15, beat: 'chart', at: 25, x: 622, y: 374, w: 46, puddle: '#c9a14a', look: { x: 620, y: 290 }, draw: chart },
];

/** Where the portrait looks for the beats that are not bequests. */
export const LOOKS: Record<string, { x: number; y: number }> = { kitchen: { x: 940, y: 240 }, leave: HEADS.assistant };

/** How melted an item is, from the multiplier now against the multiplier it was read at: gone by 3.2× past it. */
export const meltOf = (multiplier: number, placedAt: number): number => clamp(Math.log(Math.max(1, multiplier / placedAt)) / Math.log(3.2), 0, 1);

export interface Placed { b: Bequest; x100: number; pop: number }
/** The bequests are drawn a size up from their authored shapes, so they read across the room. */
const ITEM_SCALE = 1.3;

/**
 * An item on the table: dropped in with `pop` (0 → 1), squashed and slumping as it melts, its puddle running to
 * the table's edge and dripping over it, a lot sticker with its number, and at the crash the COLLATERAL stamp.
 */
export function drawBequest(ctx: CanvasRenderingContext2D, p: Placed, multiplier: number, depth: number, time: number, stamp: number, talk: number): void {
  const b = p.b;
  const m = meltOf(multiplier, p.x100 / 100);
  // Dropped onto the table: down from above, a squash on landing, a small overshoot back.
  const u = clamp(p.pop, 0, 1);
  if (u < 0.02) return;
  const k = u >= 1 ? 1 : 1 + 2.4 * (u - 1) ** 3 + 1.4 * (u - 1) ** 2;
  const drop = -42 * (1 - u) ** 2;
  // The puddle, the run to the table's edge, and a few drips hanging over it.
  if (m > 0.02) {
    const pw = b.w * (0.5 + 0.7 * m) * ITEM_SCALE + 8 * depth;
    blob(ctx, b.x, b.y + 1, pw, 2.5 + 4.5 * m, b.puddle, 1.5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(b.x - pw * 0.5, b.y - 1, pw * 0.4, 1.4);
    if (m > 0.25 && b.y < TABLE.front) {
      const run = smoothstep(0.25, 0.6, m);
      const rw = 4 + 7 * m;
      poly(ctx, [b.x - rw, b.y + 2, b.x + rw, b.y + 2, b.x + rw * 0.8, mix(b.y, TABLE.front + 1, run), b.x - rw * 0.8, mix(b.y, TABLE.front + 1, run)], b.puddle, 0);
    }
    if (m > 0.45) {
      // Drips: wide where they leave the edge, a narrow neck, a heavy drop; longer with the slow driver, bounded.
      const len = (6 + 18 * smoothstep(0.45, 1, m)) * (1 + 0.6 * depth);
      for (const [dx, seed] of [[-0.22, 1], [0.18, 2], [0.02, 3]] as const) {
        if (seed === 3 && m < 0.8) continue;
        const x = b.x + dx * b.w * ITEM_SCALE;
        const l = len * (0.6 + 0.5 * noise(b.n * 3 + seed));
        const top = TABLE.front - 1;
        ctx.fillStyle = b.puddle;
        ink(ctx, 1.4);
        ctx.beginPath();
        ctx.moveTo(x - 6, top);
        ctx.quadraticCurveTo(x - 2, top + l * 0.4, x - 1.6, top + l - 3);
        ctx.arc(x, top + l, 4, Math.PI * 1.15, Math.PI * 1.85, true);
        ctx.quadraticCurveTo(x + 2, top + l * 0.4, x + 6, top);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // A drop lets go now and then, and falls to the rug.
        if (m > 0.7) {
          const u = fract(time * (0.4 + 0.2 * noise(b.n + seed)) + noise(b.n * 7 + seed));
          if (u < 0.9) blob(ctx, x, top + l + 4 + u * u * (500 - top - l), 2, 2.8, b.puddle, 1);
        }
      }
    }
  }
  ctx.save();
  ctx.translate(b.x, b.y + drop);
  ctx.globalAlpha *= clamp(u * 3, 0, 1);
  // Melting: lower and wider, leaning as it slumps, with a wobble.
  const lean = 0.35 * m * Math.sin(b.n * 2.3) + 0.04 * m * Math.sin(time * 1.3 + b.n);
  ctx.transform(1, 0, -lean, 1, 0, 0);
  ctx.scale(ITEM_SCALE * (1 + 0.35 * m) * (0.7 + 0.3 * k), ITEM_SCALE * (1 - 0.68 * m) * k);
  if (b.beat === 'gran') drawGranBot(ctx, time, talk);
  else b.draw?.(ctx, time);
  // The wax line where it is turning to puddle.
  if (m > 0.15) {
    ctx.fillStyle = b.puddle;
    ctx.globalAlpha *= 0.85;
    ctx.beginPath();
    ctx.moveTo(-b.w * 0.55, 0);
    for (let i = 0; i <= 6; i += 1) ctx.lineTo(-b.w * 0.55 + (i * b.w * 1.1) / 6, -4 - 10 * m * (0.5 + 0.5 * noise(b.n * 9 + i)) - (i % 2) * 3 * m);
    ctx.lineTo(b.w * 0.55, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // The lot sticker.
  if (k > 0.6 && m < 0.98) {
    const sx = b.x + b.w * 0.5 * ITEM_SCALE + 2;
    const sy = b.y - 18 * (1 - 0.6 * m);
    blob(ctx, sx, sy, 6.5, 6.5, '#ffe9a8', 1.4);
    label(ctx, String(b.n), sx, sy + 0.5, 7, INK, 900, 11);
  }
  if (stamp > 0) collateralStamp(ctx, b.x, b.y - 10, noise(b.n * 13 + 1) * 0.5 - 0.25, stamp);
}

/** The will: in Peterson's hands, on the table, or, at the end, a long receipt. */
export function drawReceipt(ctx: CanvasRenderingContext2D, x: number, y: number, u: number): void {
  // `u` 0..1: the will curls out into a till receipt hanging over the table's edge to the floor.
  const len = 20 + 84 * smoothstep(0, 1, u);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.4, 1.4);
  box(ctx, -14, -6, 28, 10, 1, '#fbfbf6', 1.6);
  ctx.fillStyle = '#fbfbf6';
  ink(ctx, 1.6);
  ctx.beginPath();
  ctx.moveTo(-12, 4);
  ctx.lineTo(12, 4);
  ctx.lineTo(12 + 2 * Math.sin(len * 0.05), 4 + len);
  for (let i = 0; i < 6; i += 1) ctx.lineTo(10 - i * 4.4, 4 + len + (i % 2 ? 3 : 0));
  ctx.lineTo(-12, 4 + len);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6a6a74';
  const rows = Math.floor(len / 9);
  for (let i = 0; i < rows; i += 1) {
    const ry = 10 + i * 9;
    ctx.fillRect(-9, ry, 9 + 5 * noise(i), 1.4);
    ctx.fillRect(4, ry, 5, 1.4);
  }
  if (u > 0.6) {
    label(ctx, 'TOTAL', -3, 4 + len - 12, 5, '#2a2a34', 900, 16);
    label(ctx, '0.00', 7, 4 + len - 12, 5, '#d42a36', 900, 12);
  }
  label(ctx, 'RECEIPT', 0, -1, 5.5, '#2a2a34', 900, 26);
  ctx.restore();
}

/** The table's inventory readout: which item the reading is on and how much of the estate has melted. */
export function inventoryText(items: readonly Placed[], multiplier: number, codicils: number): { item: string; melted: number } {
  const onTable = items.filter((p) => p.b.w > 0);
  const melted = onTable.length === 0 ? 0 : onTable.reduce((sum, p) => sum + meltOf(multiplier, p.x100 / 100), 0) / onTable.length;
  const read = items.reduce((n, p) => Math.max(n, p.b.n), 0);
  return { item: codicils > 0 ? `CODICIL ${codicils}` : `ITEM ${String(read).padStart(2, '0')} OF 15`, melted };
}
