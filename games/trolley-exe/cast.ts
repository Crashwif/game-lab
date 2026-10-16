/**
 * Who stands on the tracks: every character is a stick figure in phosphor with the few strokes that make it a
 * robot, a podcaster or a cow, drawn standing in rope while the trolley is still coming and flat with crossed
 * eyes and a small ring once it has passed. Presentation only.
 */
export type Kind = 'stranger' | 'robot' | 'mother' | 'influencer' | 'professor' | 'student' | 'billionaire' | 'cow' | 'podcaster' | 'lawyer' | 'inventor' | 'intern' | 'adjuster' | 'politician' | 'voter' | 'bro' | 'god' | 'you' | 'better' | 'ghost' | 'nobody';

const PH = '#9cff8a';
const PH2 = '#5fcf55';
const AMBER = '#ffb347';
const ROPE = '#7a5a2a';
const DIM = '#4e8a4a';

/** How a kind is named on a caption, alone and in a group. */
export const NAMES: Record<Kind, [one: string, many: string]> = {
  stranger: ['A STRANGER', 'STRANGERS'], robot: ['A ROBOT', 'ROBOTS'], mother: ['YOUR MOTHER', 'MOTHERS'], influencer: ['AN INFLUENCER', 'INFLUENCERS'],
  professor: ['THE PROFESSOR', 'PROFESSORS'], student: ['A STUDENT', 'OF HIS STUDENTS'], billionaire: ['A BILLIONAIRE', 'BILLIONAIRES'], cow: ['A COW', 'COWS'],
  podcaster: ['A PODCASTER', 'PODCASTERS'], lawyer: ['THE TROLLEY’S LAWYER', 'LAWYERS'], inventor: ['THE INVENTOR', 'INVENTORS'], intern: ['THE INTERN', 'INTERNS'],
  adjuster: ['YOUR INSURANCE ADJUSTER', 'ADJUSTERS'], politician: ['A POLITICIAN', 'POLITICIANS'], voter: ['AN UNDECIDED VOTER', 'UNDECIDED VOTERS'], bro: ['A CRYPTO BRO', 'CRYPTO BROS'],
  god: ['GOD', 'GODS'], you: ['YOU', 'YOUS'], better: ['A BETTER YOU', 'BETTER YOUS'], ghost: ['A GHOST', 'EVERYONE SO FAR'], nobody: ['NOBODY', 'NOBODY'],
};
/** The caption for a branch: a count and a name. */
export function caption(kinds: Kind[]): string {
  if (kinds.length === 0 || kinds[0] === 'nobody') return 'NOBODY · AN EMPTY TRACK';
  const first = kinds[0]!;
  if (kinds.every((k) => k === first)) return kinds.length === 1 ? NAMES[first][0] : `${kinds.length} ${NAMES[first][1]}`;
  return kinds.map((k) => NAMES[k][0]).join(' + ');
}
/** How many of a branch count as bodies: everyone but nobody. */
export const bodiesOf = (kinds: Kind[]): number => kinds.filter((k) => k !== 'nobody').length;

function strokes(ctx: CanvasRenderingContext2D, colour = PH, width = 2.5): void {
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}
function line(ctx: CanvasRenderingContext2D, ...pts: number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
  ctx.stroke();
}
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill = false): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) ctx.fill();
  else ctx.stroke();
}
function rope(ctx: CanvasRenderingContext2D, ys: number[], rx = 5.5): void {
  ctx.save();
  strokes(ctx, ROPE, 1.5);
  for (const ry of ys) {
    ctx.beginPath();
    ctx.ellipse(0, ry, rx, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
function eyes(ctx: CanvasRenderingContext2D, y: number, wide: number, dx = 2.4): void {
  ctx.beginPath();
  ctx.arc(-dx, y, 0.9 + 0.8 * wide, 0, Math.PI * 2);
  ctx.arc(dx, y, 0.9 + 0.8 * wide, 0, Math.PI * 2);
  ctx.fill();
}
function tag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, colour = AMBER): void {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.font = '700 9px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** A person standing in rope: legs, body, bound arms, head. */
function person(ctx: CanvasRenderingContext2D, wide: number, scale = 1): void {
  ctx.save();
  ctx.scale(scale, scale);
  line(ctx, -5, 0, 0, -12, 5, 0);
  line(ctx, 0, -12, 0, -30);
  line(ctx, -6, -24, 0, -19, 6, -24);
  ring(ctx, 0, -37, 6.5);
  eyes(ctx, -38, wide);
  rope(ctx, [-16, -22, -27]);
  ctx.restore();
}

/** A fallen figure along the rail: flat, crossed eyes, a ring rising. */
function fallen(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(0, -4);
  line(ctx, -6, 0, 22, 0);
  line(ctx, 4, 0, 10, -8);
  line(ctx, 14, 0, 20, -7);
  ring(ctx, -11, 0, 6);
  ctx.lineWidth = 1.5;
  line(ctx, -14, -3, -10, 1);
  line(ctx, -10, -3, -14, 1);
  ctx.strokeStyle = AMBER;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.ellipse(-11, -16, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function cow(ctx: CanvasRenderingContext2D, dead: boolean, time: number, seed: number): void {
  ctx.save();
  if (dead) {
    ctx.translate(0, -3);
    ctx.beginPath();
    ctx.ellipse(0, -6, 18, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    line(ctx, -8, -2, -8, 6, 8, -2, 8, 6);
    ring(ctx, 22, -8, 6);
    ctx.lineWidth = 1.5;
    line(ctx, 20, -10, 24, -6);
    line(ctx, 24, -10, 20, -6);
    ctx.strokeStyle = AMBER;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(22, -22, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const wag = Math.sin(time * 9 + seed * 6) * 0.5;
  ctx.beginPath();
  ctx.ellipse(0, -16, 18, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (const lx of [-11, -4, 4, 11]) line(ctx, lx, -8, lx, 0);
  ring(ctx, 21, -22, 7);
  eyes(ctx, -23, 0, 2.2);
  line(ctx, 18, -28, 15, -34);
  line(ctx, 25, -28, 28, -34);
  ctx.globalAlpha = 0.6;
  ring(ctx, -5, -16, 4, true);
  ring(ctx, 6, -12, 2.5, true);
  ctx.globalAlpha = 1;
  line(ctx, -18, -18, -26, -26 - 6 * wag);
  rope(ctx, [-16], 8);
  ctx.restore();
}

/** Draws one character at (x, y) with its feet on the rail. `wriggle` 0..1 is how near the trolley is. */
export function drawCharacter(ctx: CanvasRenderingContext2D, kind: Kind, x: number, y: number, dead: boolean, wriggle: number, time: number, seed: number): void {
  if (kind === 'nobody') return;
  ctx.save();
  ctx.translate(x, y);
  strokes(ctx);
  const t = time * (2.2 + 2.6 * wriggle) + seed * 6.28;
  const lean = dead ? 0 : Math.sin(t) * (0.04 + 0.22 * wriggle);
  if (kind === 'cow') {
    ctx.rotate(lean * 0.3);
    cow(ctx, dead, time, seed);
    ctx.restore();
    return;
  }
  if (kind === 'ghost') ctx.globalAlpha = 0.45;
  if (dead) {
    fallen(ctx);
    if (kind === 'robot') {
      ctx.strokeStyle = PH2;
      line(ctx, -14, -16, -8, -24);
    }
    ctx.restore();
    return;
  }
  ctx.rotate(lean);
  person(ctx, wriggle, kind === 'god' ? 1.12 : 1);
  // The strokes that make the kind.
  switch (kind) {
    case 'robot':
      ctx.fillStyle = '#0d1a0e';
      ctx.fillRect(-7, -44, 14, 14);
      ctx.strokeRect(-7, -44, 14, 14);
      ctx.fillStyle = AMBER;
      ctx.fillRect(-5, -40, 3, 3);
      ctx.fillRect(2, -40, 3, 3);
      line(ctx, 0, -44, 0, -50);
      ring(ctx, 0, -51, 1.5, true);
      ctx.strokeRect(-6, -29, 12, 16);
      break;
    case 'mother':
      ring(ctx, 0, -45, 3.5, true);
      ctx.strokeRect(6, -22, 7, 6);
      break;
    case 'influencer':
      ctx.strokeStyle = AMBER;
      ring(ctx, 14, -40, 9);
      ctx.strokeStyle = PH;
      ctx.fillStyle = '#0d1a0e';
      ctx.fillRect(11, -44, 5, 8);
      ctx.strokeRect(11, -44, 5, 8);
      break;
    case 'professor':
      ctx.lineWidth = 1.3;
      ring(ctx, -2.6, -38, 2.6);
      ring(ctx, 2.6, -38, 2.6);
      ctx.lineWidth = 2;
      ctx.strokeRect(6, -24, 7, 9);
      break;
    case 'student':
      ctx.strokeRect(-11, -29, 5, 10);
      line(ctx, -7, -43, 6, -43, 9, -41);
      break;
    case 'billionaire':
      ctx.fillStyle = '#0d1a0e';
      ctx.fillRect(-7, -56, 14, 12);
      ctx.strokeRect(-7, -56, 14, 12);
      line(ctx, -10, -44, 10, -44);
      ring(ctx, 11, -18, 5);
      tag(ctx, '$', 11, -15, PH);
      break;
    case 'podcaster':
      ctx.beginPath();
      ctx.arc(0, -39, 8.5, Math.PI, 0);
      ctx.stroke();
      ctx.fillRect(-10, -40, 3, 5);
      ctx.fillRect(7, -40, 3, 5);
      line(ctx, 12, -8, 12, -30);
      ring(ctx, 12, -32, 3, true);
      break;
    case 'lawyer':
      ctx.strokeRect(7, -20, 10, 7);
      ctx.fillStyle = AMBER;
      ctx.beginPath();
      ctx.moveTo(-2, -30);
      ctx.lineTo(2, -30);
      ctx.lineTo(0, -19);
      ctx.closePath();
      ctx.fill();
      break;
    case 'inventor':
      line(ctx, -7, -42, -5, -48, -2, -43, 1, -49, 4, -43, 7, -47);
      line(ctx, 8, -22, 14, -28);
      ring(ctx, 15, -29, 2.5);
      break;
    case 'intern':
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 1.2;
      line(ctx, -3, -31, 0, -18, 3, -31);
      ctx.fillStyle = AMBER;
      ctx.fillRect(-2, -19, 4, 5);
      ctx.strokeStyle = PH;
      ctx.lineWidth = 2;
      ctx.strokeRect(6, -24, 7, 9);
      ctx.strokeStyle = '#6fb0ff';
      ctx.lineWidth = 1.2;
      line(ctx, 8, -15, 8, -11);
      line(ctx, 11, -15, 11, -9);
      break;
    case 'adjuster':
      ctx.strokeRect(-14, -26, 8, 10);
      ctx.lineWidth = 1.2;
      line(ctx, -12, -22, -8, -22);
      line(ctx, -12, -19, -8, -19);
      ctx.lineWidth = 2;
      ctx.fillStyle = AMBER;
      ctx.beginPath();
      ctx.moveTo(-2, -30);
      ctx.lineTo(2, -30);
      ctx.lineTo(0, -20);
      ctx.closePath();
      ctx.fill();
      break;
    case 'politician':
      ctx.fillStyle = '#b38cff';
      ctx.beginPath();
      ctx.moveTo(-2, -30);
      ctx.lineTo(2, -30);
      ctx.lineTo(0, -18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = AMBER;
      ctx.fillRect(-7, -28, 3, 3);
      break;
    case 'voter':
      tag(ctx, '?', 0, -47, AMBER);
      ctx.strokeRect(6, -22, 6, 8);
      break;
    case 'bro':
      line(ctx, -8, -43, 6, -43, 8, -46);
      ctx.fillStyle = '#0d1a0e';
      ctx.fillRect(10, -30, 5, 8);
      ctx.strokeRect(10, -30, 5, 8);
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 1.2;
      line(ctx, -16, -8, -12, -14, -9, -11, -4, -17);
      break;
    case 'god':
      ctx.strokeStyle = AMBER;
      ctx.beginPath();
      ctx.ellipse(0, -52, 9, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = PH;
      line(ctx, -5, -36, -3, -28, 0, -26, 3, -28, 5, -36);
      line(ctx, -8, -12, -10, 0);
      line(ctx, 8, -12, 10, 0);
      break;
    case 'you':
      tag(ctx, 'YOU', 0, -48);
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 1;
      line(ctx, -6, -46, 6, -46);
      break;
    case 'better':
      tag(ctx, 'YOU, BUT BETTER', 0, -48);
      ctx.fillStyle = AMBER;
      ring(ctx, 0, -24, 2.5, true);
      break;
    case 'ghost':
      ctx.strokeStyle = DIM;
      ctx.setLineDash([2, 3]);
      ring(ctx, 0, -37, 9);
      ctx.setLineDash([]);
      break;
    default:
      break;
  }
  ctx.restore();
}
