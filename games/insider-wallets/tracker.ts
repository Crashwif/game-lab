/**
 * The wallet tracker beside the stage. Balances track the displayed
 * multiplier. PENDING blinks as tension rises. The allocation pie's
 * family-and-friends slice grows on the same curve. SOLD hits every row
 * in the same frame as the crash, and the pie becomes all of it.
 */
import { clamp } from './motion';

export const INK = '#1c1f26';

export const ROWS: { name: string; salt: number; pending: number }[] = [
  { name: 'COUSIN', salt: 1.15, pending: 0.28 },
  { name: 'DONOR #1', salt: 1.4, pending: 0.34 },
  { name: 'GOLF BUDDY', salt: 1.7, pending: 0.4 },
  { name: 'LOBBYIST', salt: 2.05, pending: 0.48 },
  { name: 'BARBER', salt: 2.4, pending: 0.54 },
  { name: 'DOG WALKER', salt: 2.9, pending: 0.6 },
  { name: 'ANON.SOL', salt: 3.4, pending: 0.66 },
  { name: 'TREASURER', salt: 4.1, pending: 0.72 },
];

export function rowBalance(multiplier: number, salt: number): number {
  return Math.floor(900 * salt * Math.pow(Math.max(1, multiplier), 1.32));
}

export function totalBalance(multiplier: number): number {
  return ROWS.reduce((sum, row) => sum + rowBalance(multiplier, row.salt), 0);
}

function money(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `$${(value / 1000).toFixed(0)}K`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value}`;
}

/** The family-and-friends share of the supply: a bare majority at launch, the meme number near the top, all of it after the dump. */
export function insiderShare(tension: number, crashed: boolean): number {
  return crashed ? 1 : 0.51 + 0.18 * clamp(tension, 0, 1);
}

export function drawTracker(
  ctx: CanvasRenderingContext2D,
  multiplier: number,
  tension: number,
  crashed: boolean,
  crashAge: number,
  youLeft: boolean,
  time: number,
): void {
  ctx.save();
  ctx.translate(676, 86);
  ctx.fillStyle = 'rgba(8, 12, 20, 0.88)';
  ctx.strokeStyle = '#f0c14a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(0, 0, 268, 400, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f0c14a';
  ctx.font = '900 16px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('INSIDER WALLETS', 12, 24);
  ROWS.forEach((row, index) => {
    const y = 50 + index * 29;
    const pending = !crashed && tension >= row.pending;
    const blink = pending && Math.sin(time * 10 + index) > 0;
    ctx.fillStyle = crashed ? 'rgba(255, 77, 109, 0.18)' : blink ? 'rgba(255, 224, 138, 0.16)' : 'transparent';
    ctx.fillRect(8, y - 15, 252, 27);
    ctx.fillStyle = '#d7dde8';
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(row.name, 14, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = crashed ? '#ff4d6d' : '#7cf67c';
    ctx.fillText(crashed ? '$0' : money(rowBalance(multiplier, row.salt)), 254, y);
    ctx.font = '700 10px ui-monospace, monospace';
    ctx.fillStyle = crashed ? '#ffb4c2' : pending ? '#ffe08a' : '#8b93a7';
    ctx.textAlign = 'left';
    ctx.fillText(crashed ? 'SOLD' : pending ? 'PENDING' : 'HOLDING', 112, y);
  });
  // The allocation pie. The community's slice is what is left; after the dump it is the bag.
  const share = insiderShare(tension, crashed);
  const px = 44;
  const py = 316;
  const pr = 24;
  const gold = crashed ? '#ff4d6d' : '#f0c14a';
  ctx.fillStyle = '#7cf67c';
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.arc(px, py, pr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * share);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = '700 10px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8b93a7';
  ctx.fillText('ALLOCATION', 82, 300);
  ctx.fillStyle = gold;
  ctx.fillText('FAMILY & FRIENDS', 82, 316);
  ctx.fillStyle = '#7cf67c';
  ctx.fillText('COMMUNITY (YOU)', 82, 332);
  ctx.textAlign = 'right';
  ctx.fillStyle = gold;
  ctx.fillText(crashed ? 'SOLD' : `${Math.round(share * 100)}%`, 254, 316);
  ctx.fillStyle = '#7cf67c';
  ctx.fillText(crashed ? 'THE BAG' : `${100 - Math.round(share * 100)}%`, 254, 332);
  const flash = crashed ? clamp(1 - crashAge / 0.28, 0, 1) : 0;
  if (flash > 0.02) {
    ctx.globalAlpha = flash * 0.55;
    ctx.fillStyle = '#fff';
    ctx.fillRect(8, 36, 252, 310);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = crashed ? '#ff4d6d' : '#f0c14a';
  ctx.font = '900 16px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(crashed ? 'TOTAL RUGGED' : 'TOTAL', 12, 360);
  ctx.textAlign = 'right';
  ctx.fillText(crashed ? 'RUGGED' : money(totalBalance(multiplier)), 254, 360);
  ctx.textAlign = 'left';
  ctx.fillStyle = youLeft ? '#7cf67c' : '#d7dde8';
  ctx.font = '700 13px ui-monospace, monospace';
  ctx.fillText(youLeft ? 'YOU  LEFT EARLY' : 'YOU  IN THE CROWD', 12, 384);
  ctx.restore();
}
