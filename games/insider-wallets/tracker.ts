/**
 * The wallet tracker beside the stage. Balances track the displayed
 * multiplier. Each insider flips to PENDING at its own multiplier, the first
 * at 1.15× and the last at 3.1×, so most rounds see several. The allocation pie's
 * family-and-friends slice grows on the same curve. SOLD hits every row
 * in the same frame as the crash, and the pie becomes all of it.
 */
import { clamp } from './motion';

export const INK = '#1c1f26';

/** `pending` is the multiplier the row starts to blink PENDING at. */
export const ROWS: { name: string; salt: number; pending: number }[] = [
  { name: 'COUSIN', salt: 1.15, pending: 1.15 },
  { name: 'DONOR #1', salt: 1.4, pending: 1.3 },
  { name: 'GOLF BUDDY', salt: 1.7, pending: 1.45 },
  { name: 'LOBBYIST', salt: 2.05, pending: 1.65 },
  { name: 'BARBER', salt: 2.4, pending: 1.9 },
  { name: 'DOG WALKER', salt: 2.9, pending: 2.2 },
  { name: 'ANON.SOL', salt: 3.4, pending: 2.6 },
  { name: 'TREASURER', salt: 4.1, pending: 3.1 },
];

/** How many insiders are PENDING at this multiplier: the scene pings each flip. */
export const pendingCount = (multiplier: number): number => ROWS.filter((row) => multiplier >= row.pending).length;
/** 1 in the half second after a row flips to PENDING, fading to 0: keyed to the multiplier, so replays and late joins agree. */
const fresh = (multiplier: number, at: number): number => (multiplier >= at ? clamp(1 - Math.log(multiplier / at) / 0.04, 0, 1) : 0);

export function rowBalance(multiplier: number, salt: number): number {
  return Math.floor(900 * salt * Math.pow(Math.max(1, multiplier), 1.32));
}

export function totalBalance(multiplier: number): number {
  return ROWS.reduce((sum, row) => sum + rowBalance(multiplier, row.salt), 0);
}

export function money(value: number): string {
  if (value >= 1e15) return `$${value.toExponential(1).replace('+', '')}`;
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `$${(value / 1000).toFixed(0)}K`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value}`;
}

/** The family-and-friends share of the supply (tension is 1 - 1/x): a bare majority at launch, 60% at 2×, the meme number near the top, all of it after the dump. */
export function insiderShare(tension: number, crashed: boolean): number {
  return crashed ? 1 : 0.51 + 0.18 * clamp(tension, 0, 1);
}

export function drawTracker(
  ctx: CanvasRenderingContext2D,
  multiplier: number,
  tension: number,
  crashed: boolean,
  crashAge: number,
  /** Your line: still in the crowd, left early, or null for a spectator, who gets no YOU row. */
  you: 'in' | 'left' | null,
  time: number,
  elapsed: number,
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
  const compact = (ctx.canvas?.clientWidth || 960) < 600;
  const live = pendingCount(multiplier);
  if (compact) {
    // The latest insider to flip and the next in line; once all eight are pending, pairs page on the round clock.
    // The crash keeps the pair that was showing, so the same two rows turn SOLD.
    const active = live < ROWS.length ? Math.max(0, live - 1) : Math.floor(elapsed / 3) * 2;
    for (let slot = 0; slot < 2; slot++) {
      const row = ROWS[(active + slot) % ROWS.length]!;
      const y = 64 + slot * 106;
      const ping = crashed ? 0 : fresh(multiplier, row.pending);
      if (ping > 0) { ctx.fillStyle = `rgba(255, 224, 138, ${0.3 * ping})`; ctx.fillRect(6, y - 26, 256, 96); }
      ctx.fillStyle = '#d7dde8'; ctx.font = '700 25px system-ui'; ctx.textAlign = 'left';
      ctx.fillText(row.name, 12, y, 244);
      ctx.fillStyle = crashed ? '#ff4d6d' : '#ffe08a'; ctx.font = '900 23px system-ui';
      ctx.fillText(crashed ? 'SOLD · $0' : multiplier >= row.pending ? 'PENDING' : 'HOLDING', 12, y + 32, 244);
      ctx.fillStyle = crashed ? '#ffb4c2' : '#7cf67c'; ctx.font = '700 22px system-ui';
      ctx.fillText(`${crashed ? 'TOOK ' : ''}${money(rowBalance(multiplier, row.salt))}`, 12, y + 59, 244);
    }
  }
  if (!compact) ROWS.forEach((row, index) => {
    const y = 50 + index * 29;
    const pending = !crashed && multiplier >= row.pending;
    const blink = pending && Math.sin(time * 10 + index) > 0;
    // A row that just flipped lights up for half a second before it settles into the blink.
    const ping = pending ? fresh(multiplier, row.pending) : 0;
    ctx.fillStyle = crashed ? 'rgba(255, 77, 109, 0.18)' : ping > 0 ? `rgba(255, 224, 138, ${0.16 + 0.34 * ping})` : blink ? 'rgba(255, 224, 138, 0.16)' : 'transparent';
    ctx.fillRect(8, y - 15, 252, 27);
    ctx.fillStyle = '#d7dde8';
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(row.name, 14, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = crashed ? '#ff4d6d' : '#7cf67c';
    ctx.fillText(crashed ? '$0' : money(rowBalance(multiplier, row.salt)), 254, y, 92);
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
  ctx.font = compact ? '700 15px ui-monospace, monospace' : '700 10px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8b93a7';
  ctx.fillText('ALLOCATION', 82, 300);
  // The labels give way to the figures on the right, which the phone layout sets large.
  const room = crashed ? 100 : 132;
  ctx.fillStyle = gold;
  ctx.fillText('FAMILY & FRIENDS', 82, 316, room);
  ctx.fillStyle = '#7cf67c';
  ctx.fillText(you ? 'COMMUNITY (YOU)' : 'COMMUNITY', 82, 332, room);
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
  ctx.fillText(crashed ? 'RUGGED' : money(totalBalance(multiplier)), 254, 360, 140);
  ctx.textAlign = 'left';
  ctx.fillStyle = you === 'left' ? '#7cf67c' : you ? '#d7dde8' : '#8b93a7';
  ctx.font = '700 13px ui-monospace, monospace';
  ctx.fillText(you === 'left' ? 'YOU  LEFT EARLY' : you ? 'YOU  IN THE CROWD' : 'NO BAG · JUST WATCHING', 12, 384, 244);
  ctx.restore();
}
