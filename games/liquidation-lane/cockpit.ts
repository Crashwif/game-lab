/** The Lambo interior: carbon, acid-yellow stitching, absurd instruments and a very visible Pepe. */
import { CYAN, INK, LIME, MONO, PINK, ellipse, line, panel, poly, text } from './art';
import { clamp, noise, smoothstep } from './motion';

export interface CockpitView {
  time: number;
  tension: number;
  speed: number;
  multiplier: number;
  gear: number;
  /** Engine speed 0 to 1 for the shift lights; `limiter` blinks them, `shift` flashes the gear for a fresh upshift. */
  rpm: number;
  limiter: boolean;
  shift: number;
  steering: number;
  headRoll: number;
  headPitch: number;
  crashAge: number;
  crashed: boolean;
  /** 0 to 1: how much of your own wreck is showing; the tow truck wipes it back to 0. */
  wreck: number;
  cashout: number | null;
  running: boolean;
  reduced: boolean;
  /** 0 to 1: the SEC lights in the mirror, the LIQ PRICE sensor blink and the phone buzz. */
  cops: number;
  pulse: number;
  ring: number;
}

function pepe(ctx: CanvasRenderingContext2D, view: CockpitView): void {
  const wrecked = view.wreck > 0.5;
  ctx.save(); ctx.translate(755, 103);
  // Broad cheeks, high frog eyes and the unmistakably unimpressed mouth.
  ellipse(ctx, 0, 45, 68, 32, '#202c34', '#080e13');
  line(ctx, [[-28, 24], [-16, 45], [16, 45], [28, 24]], '#dec269', 3);
  // The shoulders stay in the seat while the head lags turns and braking.
  ctx.translate(0, 27 + view.headPitch); ctx.rotate(view.headRoll); ctx.translate(0, -27);
  ellipse(ctx, 0, 4, 53, 36, '#548e42', '#18382a');
  ellipse(ctx, -26, -23, 22, 23, '#65a04c', '#18382a'); ellipse(ctx, 24, -24, 23, 24, '#65a04c', '#18382a');
  ellipse(ctx, 0, 19, 43, 17, '#8bb55a');
  ellipse(ctx, -39, 12, 10, 6, '#73a84c'); ellipse(ctx, 38, 12, 10, 6, '#73a84c');
  // Heavy black sunglasses remain on, even after the airbag deploys.
  ctx.save(); ctx.rotate(smoothstep(0.42, 0.7, view.crashAge) * 0.12 * view.wreck);
  for (const x of [-27, 26]) {
    panel(ctx, x - 23, -31, 46, 30, '#101625', '#070b12', 9);
    poly(ctx, [[x - 17, -26], [x - 7, -27], [x + 17, -8], [x + 8, -5]], '#3c6871');
    line(ctx, [[x - 14, -26], [x + 13, -7]], CYAN, 1.5);
  }
  line(ctx, [[-5, -20], [5, -20]], '#080c13', 6);
  line(ctx, [[-48, -23], [-56, -18]], '#080c13', 5); line(ctx, [[47, -23], [56, -19]], '#080c13', 5);
  if (wrecked) line(ctx, [[23, -30], [18, -20], [31, -15], [27, -3]], '#86a3a8', 1);
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(-33, 16);
  ctx.bezierCurveTo(-13, wrecked ? 5 : 25, 20, wrecked ? 7 : 26, 34, 14);
  ctx.strokeStyle = '#31452d'; ctx.lineWidth = 4; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-26, 24); ctx.quadraticCurveTo(5, 34, 27, 22);
  ctx.strokeStyle = '#4b6c35'; ctx.lineWidth = 2; ctx.stroke();
  if (view.tension > 0.6 && !wrecked && view.cashout === null) {
    const fall = (view.time * 1.5) % 1;
    ctx.globalAlpha = smoothstep(0.6, 0.7, view.tension) * Math.sin(fall * Math.PI);
    ellipse(ctx, 51, -4 + fall * 20, 3, 5, CYAN); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function mirror(ctx: CanvasRenderingContext2D, view: CockpitView): void {
  line(ctx, [[758, 0], [758, 39]], '#111521', 15);
  poly(ctx, [[625, 43], [884, 43], [899, 55], [888, 150], [624, 150], [611, 58]], '#080d19', '#818591', 2);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(623, 51, 262, 90, 10); ctx.clip();
  const glass = ctx.createLinearGradient(0, 51, 0, 145);
  glass.addColorStop(0, '#393560'); glass.addColorStop(1, '#77928b');
  ctx.fillStyle = glass; ctx.fillRect(618, 48, 272, 100);
  poly(ctx, [[690, 141], [737, 80], [779, 80], [826, 141]], '#303445');
  line(ctx, [[752, 88], [742, 140]], '#c8bdbc', 2); line(ctx, [[771, 88], [783, 140]], '#c8bdbc', 2);
  // The cops fade in and get closer; their lights alternate, or glow steadily under reduced motion.
  if (view.cops > 0) {
    const blink = view.reduced ? 0 : Math.sin(view.time * 8) * 0.2, r = 16 + view.tension * 12;
    ctx.globalAlpha = view.cops * (0.55 + blink); ellipse(ctx, 639, 108, r * 1.25, r, PINK);
    ctx.globalAlpha = view.cops * (0.55 - blink); ellipse(ctx, 865, 108, r * 1.25, r, CYAN);
    ctx.globalAlpha = view.cops;
    panel(ctx, 628, 111, 27, 16, '#182636', '#bbc8d4', 3); panel(ctx, 851, 111, 27, 16, '#182636', '#bbc8d4', 3);
    ctx.fillStyle = PINK; ctx.fillRect(630, 108, 10, 4); ctx.fillStyle = CYAN; ctx.fillRect(863, 108, 10, 4);
    ctx.globalAlpha = 1;
  }
  pepe(ctx, view);
  ctx.restore();
  line(ctx, [[628, 47], [879, 47]], LIME, 2);
  text(ctx, 'OBJECTS IN MIRROR ARE EXIT LIQUIDITY', 755, 146, 6.8, '#dadbd5', 'center', 250, MONO);
}

function instruments(ctx: CanvasRenderingContext2D, view: CockpitView): void {
  poly(ctx, [[318, 377], [350, 353], [648, 353], [689, 381], [676, 508], [333, 508]], '#0b1120', '#55565b', 2);
  line(ctx, [[346, 504], [658, 504]], '#c6c854', 2);
  const safe = view.cashout !== null;
  const dead = view.crashed && !safe;
  const colour = safe ? LIME : dead ? PINK : view.tension > 0.68 ? '#ff8b54' : CYAN;
  const cx = 489, cy = 443, radius = 80;
  const start = Math.PI * 0.84, sweep = Math.PI * 1.32;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, radius, start, start + sweep); ctx.strokeStyle = '#243044'; ctx.lineWidth = 8; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, radius, start, start + sweep * clamp(dead ? 1 : safe ? 0.08 : 0.07 + view.tension * 0.92, 0.01, 1)); ctx.strokeStyle = colour; ctx.lineWidth = 8; ctx.stroke();
  for (let i = 0; i <= 24; i += 1) {
    const angle = start + sweep * i / 24;
    const outer = radius + 11, inner = outer - (i % 4 ? 4 : 9);
    line(ctx, [[cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner], [cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer]], i > 19 ? PINK : '#718590', 1.6);
  }
  text(ctx, safe ? 'BAG SECURED' : dead ? 'TOTALLED' : 'LEVERAGE', cx, 397, 10, colour, 'center', undefined, MONO);
  text(ctx, `${(view.cashout ?? view.multiplier).toFixed(2)}×`, cx, 438, 43, '#f9fbe9', 'center', 145);
  text(ctx, `${Math.round(view.speed).toString().padStart(3, '0')} KM/H`, cx, 477, 16, colour, 'center', undefined, MONO);
  panel(ctx, 350, 388, 36, 40, view.shift > 0.3 ? '#2b3a2a' : '#1a2334', view.shift > 0.3 ? LIME : '#34455a', 4);
  text(ctx, dead ? 'X' : safe ? 'P' : view.running ? `${view.gear}` : 'N', 368, 407, 26 * (1 + view.shift * 0.3), colour, 'center');
  text(ctx, 'GEAR', 368, 441, 8, '#9aadb5', 'center', undefined, MONO);
  text(ctx, safe ? 'HODL CASH' : 'SEND IT', 368, 477, 8, '#dae6cd', 'center', 59, MONO);
  // The exaggerated acceleration display sits beside speed and leverage.
  const gx = 626, gy = 422;
  ctx.beginPath(); ctx.arc(gx, gy, 32, 0, Math.PI * 2); ctx.strokeStyle = '#3f5360'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.arc(gx, gy, 16, 0, Math.PI * 2); ctx.stroke();
  line(ctx, [[gx - 32, gy], [gx + 32, gy]], '#344652', 1); line(ctx, [[gx, gy - 32], [gx, gy + 32]], '#344652', 1);
  const g = safe ? 0 : dead ? 9.9 : view.running ? 0.3 + view.tension * 3.7 : 0;
  ellipse(ctx, gx + clamp(view.steering * 22, -24, 24), gy + (dead ? -19 : g * 5), 4, 4, colour);
  text(ctx, `${g.toFixed(1)} G`, gx, 471, 18, colour, 'center', undefined, MONO);
  text(ctx, 'G-FORCE', gx, 493, 8, '#9aadb5', 'center', undefined, MONO);
  // Shift lights follow the engine: they drop at each upshift and blink together on the limiter.
  for (let i = 0; i < 11; i += 1) {
    const lit = !safe && !dead && (view.limiter || i < view.rpm * 11);
    ctx.fillStyle = lit ? (view.limiter || i > 8 ? PINK : i > 5 ? '#ffb65c' : LIME) : '#303a36';
    ctx.fillRect(422 + i * 13, 362, 9, 4);
  }
  // The LIQ PRICE proximity sensor blinks with every tension tick.
  panel(ctx, 343, 357, 70, 12, '#e8c93a', INK, 2);
  ellipse(ctx, 351, 363, 3.5, 3.5, view.pulse > 0 ? `rgba(255, 64, 126, ${0.35 + view.pulse * 0.65})` : '#5b2a35');
  text(ctx, 'LIQ PRICE', 382, 363, 7, INK, 'center', 54, MONO);
}

/** Fuel drains and gas fees climb with the round. */
function gas(ctx: CanvasRenderingContext2D, view: CockpitView): void {
  poly(ctx, [[733, 370], [843, 374], [825, 413], [742, 408]], '#080e17', '#797d72', 2);
  const gwei = view.cashout !== null ? 0 : Math.round(12 + 1400 * view.tension ** 3);
  text(ctx, 'GAS', 748, 384, 9, '#9aadb5', 'left', undefined, MONO);
  text(ctx, `${gwei} GWEI`, 830, 384, 9, view.tension > 0.6 && view.cashout === null ? PINK : LIME, 'right', 62, MONO);
  const fuel = view.cashout !== null ? 0.7 : 1 - view.tension * 0.88;
  panel(ctx, 750, 394, 74, 7, '#1d2630', undefined, 2);
  panel(ctx, 750, 394, Math.max(3, 74 * fuel), 7, fuel < 0.25 ? PINK : '#c6c854', undefined, 2);
  text(ctx, 'E', 744, 398, 6, '#9aadb5', 'center', undefined, MONO); text(ctx, 'F', 830, 398, 6, '#9aadb5', 'center', undefined, MONO);
}

function steeringWheel(ctx: CanvasRenderingContext2D, view: CockpitView): void {
  ctx.save(); ctx.translate(219, 505);
  const panic = Math.sin(Math.min(view.crashAge, 1) * 4) * 1.1 * view.wreck;
  const turn = Math.max(-0.7, Math.min(0.7, view.steering * 0.27 + panic));
  ctx.rotate(turn);
  ctx.beginPath(); ctx.arc(0, 0, 104, Math.PI * 0.05, Math.PI * 1.95); ctx.strokeStyle = '#030710'; ctx.lineWidth = 30; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 104, Math.PI * 0.05, Math.PI * 1.95); ctx.strokeStyle = '#343a40'; ctx.lineWidth = 19; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 99, Math.PI * 1.12, Math.PI * 1.88); ctx.strokeStyle = '#bfd65c'; ctx.lineWidth = 2; ctx.stroke();
  line(ctx, [[-100, -15], [-37, 6], [0, 48], [37, 6], [100, -15]], '#080d17', 27);
  line(ctx, [[-98, -16], [-37, -2], [0, 31], [37, -2], [98, -16]], '#747b7b', 7);
  ellipse(ctx, 0, 4, 47, 36, '#161e27', '#4a535a');
  poly(ctx, [[-14, -12], [14, -12], [12, 12], [0, 24], [-12, 12]], '#c1a84c', '#e6d373', 1);
  text(ctx, 'L', 0, 3, 21, '#12151b', 'center');
  text(ctx, 'LAMBO', 0, -5, 5, '#eeeabd', 'center');
  line(ctx, [[-7, -114], [7, -114]], LIME, 7);
  ctx.restore();
  // Hands follow the rim, while shoulders stay attached to the driver below the dashboard.

  for (const side of [-1, 1]) {
    const hand = steeringContact(side, turn);
    const root = { x: side < 0 ? 110 : 320, y: 600 };
    const dx = hand.x - root.x, dy = hand.y - root.y, d = Math.hypot(dx, dy);
    const along = (105 * 105 - 108 * 108 + d * d) / (2 * d);
    const bend = Math.sqrt(Math.max(0, 105 * 105 - along * along)) * side;
    const elbow = { x: root.x + dx / d * along - dy / d * bend, y: root.y + dy / d * along + dx / d * bend };
    line(ctx, [[root.x, root.y], [elbow.x, elbow.y], [hand.x, hand.y]], '#48514b', 34);
    line(ctx, [[root.x, root.y], [elbow.x, elbow.y], [hand.x, hand.y]], '#111b26', 29);
    ctx.save(); ctx.translate(hand.x, hand.y); ctx.rotate(turn + side * 0.45);
    ellipse(ctx, 0, 0, 19, 29, '#64984a', '#162e26');
    ellipse(ctx, -side * 13, 4, 9, 14, '#79aa55', '#274530');
    for (let i = 0; i < 3; i += 1) line(ctx, [[-10, -15 + i * 7], [9, -16 + i * 7]], '#385b35', 1.5);
    if (side < 0) { panel(ctx, -19, 25, 38, 12, '#cca74f', '#ffe080', 2); panel(ctx, -6, 23, 15, 16, '#142d31', '#d2b660', 2); }
    ctx.restore();
  }
}

function phone(ctx: CanvasRenderingContext2D, view: CockpitView): void {
  ctx.save(); ctx.translate(785, 412); ctx.rotate(0.08 + (view.reduced ? 0 : Math.sin(view.time * 70) * 0.03 * view.ring));
  panel(ctx, -7, -10, 119, 167, '#060b13', '#717878', 13);
  panel(ctx, 0, 0, 105, 149, '#172431', '#273c45', 8);
  panel(ctx, 35, 3, 35, 5, '#05090e', undefined, 3);
  text(ctx, 'DEGEN OS', 52, 20, 8, '#8ea5ad', 'center', undefined, MONO);
  const dead = view.crashed && view.cashout === null;
  const contact = dead ? 'INSURANCE' : view.cashout !== null ? 'OFFSHORE BANK' : view.tension >= 0.6 ? 'MARGIN CALL' : 'MOM';
  ellipse(ctx, 52, 48, 17, 17, dead ? '#9b294d' : '#3d5961');
  text(ctx, dead ? '!' : '$', 52, 48, 20, '#fff', 'center');
  text(ctx, contact, 52, 78, 11, '#f5f5e9', 'center', 99);
  text(ctx, dead ? 'CLAIM DENIED' : view.cashout !== null ? 'BAG RECEIVED' : `${3 + Math.floor(view.tension * 66)} MISSED CALLS`, 52, 98, 8, dead ? PINK : LIME, 'center', 99, MONO);
  panel(ctx, 13, 116, 79, 20, dead ? '#5d2441' : '#4c2838', undefined, 5);
  text(ctx, dead ? 'LMAO' : 'DECLINE', 52, 126, 9, '#ff91a9', 'center');
  ctx.restore();
}

export function drawCockpit(ctx: CanvasRenderingContext2D, view: CockpitView): void {
  // Acid yellow hood, structural pillars and a stitched carbon dashboard.
  poly(ctx, [[0, 310], [229, 318], [329, 336], [634, 336], [736, 318], [960, 307], [960, 384], [0, 384]], '#bfc628', '#151b17', 3);
  line(ctx, [[72, 322], [233, 330], [305, 345]], '#eff87b', 3); line(ctx, [[659, 345], [739, 330], [917, 318]], '#eff87b', 3);
  const dash = ctx.createLinearGradient(0, 327, 0, 540);
  dash.addColorStop(0, '#4c4f46'); dash.addColorStop(0.12, '#262f32'); dash.addColorStop(0.7, '#0b121e'); dash.addColorStop(1, '#060c15');
  ctx.beginPath(); ctx.moveTo(0, 331); ctx.bezierCurveTo(167, 320, 261, 337, 352, 344);
  ctx.lineTo(634, 344); ctx.bezierCurveTo(748, 325, 832, 322, 960, 332); ctx.lineTo(960, 540); ctx.lineTo(0, 540); ctx.closePath(); ctx.fillStyle = dash; ctx.fill();
  ctx.save(); ctx.strokeStyle = 'rgba(122, 145, 138, .12)'; ctx.lineWidth = 1;
  for (let x = -200; x < 1160; x += 13) { ctx.beginPath(); ctx.moveTo(x, 350); ctx.lineTo(x + 160, 540); ctx.stroke(); }
  ctx.restore();
  ctx.setLineDash([4, 5]); line(ctx, [[0, 349], [229, 347], [330, 364]], '#c6c974', 1); line(ctx, [[662, 362], [770, 346], [960, 352]], '#c6c974', 1); ctx.setLineDash([]);
  poly(ctx, [[52, 370], [162, 374], [144, 413], [61, 408]], '#080e17', '#797d72', 2);
  for (let i = 0; i < 4; i += 1) line(ctx, [[69, 379 + i * 7], [145 - i * 3, 382 + i * 7]], '#58605e', 2);
  instruments(ctx, view); gas(ctx, view); steeringWheel(ctx, view); phone(ctx, view);
  panel(ctx, 568, 521, 97, 24, '#753543', '#bc6463', 4); text(ctx, 'SELL / EJECT', 617, 533, 9, '#ffccba', 'center');
  text(ctx, 'NO TRACTION. ALL CONVICTION.', 70, 387, 7, '#9aaba2', 'left', 115, MONO);
  poly(ctx, [[0, 0], [35, 0], [143, 326], [86, 349], [0, 139]], '#101723', '#555a5f', 2);
  poly(ctx, [[960, 0], [928, 0], [830, 326], [907, 349], [960, 155]], '#101723', '#555a5f', 2);
  line(ctx, [[35, 12], [136, 319]], '#bcc637', 2); line(ctx, [[925, 12], [838, 319]], '#bcc637', 2);
  mirror(ctx, view);
}

export function drawDamage(ctx: CanvasRenderingContext2D, view: CockpitView): void {
  const age = view.crashAge;
  if (view.wreck <= 0 || age < 0.42) return;
  // The crack is there on the impact frame and finishes spreading just after it.
  const spread = 0.55 + 0.45 * smoothstep(0.42, 0.52, age);
  ctx.save(); ctx.globalAlpha = 0.85 * view.wreck;
  const center = { x: 541, y: 220 };
  for (let i = 0; i < 13; i += 1) {
    const a = i * Math.PI * 2 / 13;
    const points: [number, number][] = [[center.x, center.y]];
    for (let step = 1; step <= 5; step += 1) {
      const r = step * (23 + noise(i * 7) * 17) * spread;
      points.push([center.x + Math.cos(a + noise(i + step) * 0.18) * r, center.y + Math.sin(a) * r * 0.62]);
    }
    line(ctx, points, '#d4e9e7', 1.1);
    if (i % 2 === 0) line(ctx, [points[2]!, [points[2]![0] + 21, points[2]![1] - 23]], '#d4e9e7', 0.7);
  }
  for (let ring = 1; ring <= 3; ring += 1) {
    const points: [number, number][] = [];
    for (let i = 0; i <= 13; i += 1) {
      const a = i * Math.PI * 2 / 13, radius = (ring * 24 + noise(i * 9 + ring) * 12) * spread;
      points.push([center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius * 0.7]);
    }
    line(ctx, points, '#d5e6e4', 0.8);
  }
  ctx.restore();
  // The airbag fires just after the impact, overshoots, and deflates as the wreck is towed.
  const bag = smoothstep(0.46, 0.66, age) * (view.reduced ? 1 : 1 + 0.1 * Math.sin(Math.PI * clamp((age - 0.56) / 0.4, 0, 1))) * (0.55 + 0.45 * view.wreck);
  if (bag > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(1, view.wreck * 1.5); ctx.translate(255, 474); ctx.scale(bag, bag);
    const airbag = ctx.createRadialGradient(-40, -40, 2, 0, 0, 180);
    airbag.addColorStop(0, '#fffbea'); airbag.addColorStop(1, '#9ba5a5');
    ctx.fillStyle = airbag; ctx.beginPath(); ctx.ellipse(0, 0, 168, 118, -0.06, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#727e80'; ctx.lineWidth = 2; ctx.stroke();
    for (const side of [-1, 1]) {
      line(ctx, [[side * 136, -41], [side * 109, -26], [side * 122, -7]], '#b3bcb5', 2);
      line(ctx, [[side * 116, 58], [side * 86, 42], [side * 78, 57]], '#b3bcb5', 2);
    }
    text(ctx, 'NOT FINANCIAL', 0, -19, 21, '#344142', 'center');
    text(ctx, 'ADVICE', 0, 10, 32, '#344142', 'center');
    text(ctx, 'THIS IS AN AIRBAG.', 0, 46, 10, '#617172', 'center', undefined, MONO);
    ctx.restore();
  }
}

/** Hand contact points remain on the same rim locations for every steering angle. */
export function steeringContact(side: number, turn: number): { x: number; y: number } {
  return { x: 219 + side * 88 * Math.cos(turn) + 54 * Math.sin(turn), y: 505 + side * 88 * Math.sin(turn) - 54 * Math.cos(turn) };
}
