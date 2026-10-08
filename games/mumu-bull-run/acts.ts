import { box, bubble, clamp, CREAM, ease, GOLD, grain, GREEN, INK, line, mix, oval, poly, RED, shape, star, TAU, text } from './art';
import { CONTACT, floorAt, type Routine } from './motion';
import { bear } from './rig';

const TITLES = ['FUD WALL', 'THE BEARCAST', 'SHORT-BOT 9000', 'THE CHART PROPHET', 'COPIUM EXPRESS', 'THE FUN POLICE'];
const APPROACH = ['SOURCE: TRUST ME, BRO.', 'LET HIM FINISH HIS PODCAST.', 'HE LEVERAGED THE LEVER.', 'THE MODEL HAS FEELINGS.', 'BREATHE IN. COPE HARDER.', 'FUN REQUIRES A PERMIT.'];
const PAYOFF = ['FUD: LOAD-BEARING BULLSHIT.', 'THIS AGED LIKE MILK.', 'RISK MANAGEMENT HAS LEFT.', 'HIS TARGET WAS THE FLOOR.', 'BEAR TEARS. FRESHLY SQUEEZED.', 'PERMISSION DENIED. IGNORED.'];
const SPONSORS = ['SPONSORED BY MY FEELINGS', 'WRONG SINCE BREAKFAST', 'THE CONFIDENCE IS REAL', 'PROFESSIONAL HINDSIGHT', 'CERTIFIED COPE DEALER', 'I WOULD LIKE A MANAGER'];
export function actTitle(r: Routine): string { return TITLES[r.kind]!; }
export function actCaption(r: Routine): string { return r.age < CONTACT ? APPROACH[r.kind]! : PAYOFF[r.kind]!; }

function microphone(c: CanvasRenderingContext2D, x: number, y: number, tilt = 0): void {
  c.save(); c.translate(x, y); c.rotate(tilt);
  line(c, [[0, 0], [-19, -29], [8, -45]], INK, 7);
  box(c, 1, -59, 19, 31, '#6f9186', 9, 3);
  line(c, [[5, -53], [16, -53]], INK, 2); line(c, [[5, -46], [16, -46]], INK, 2);
  c.restore();
}

function fragments(c: CanvasRenderingContext2D, x: number, y: number, t: number, seed: number, reduced: boolean, paper = false): void {
  if (t <= 0 || t > 2.1) return;
  if (reduced) {
    for (let i = 0; i < 5; i += 1) {
      c.save(); c.translate(x - 46 + i * 25, y - 10 + i % 2 * 8); c.rotate(i * 0.6);
      box(c, -17, -5, 34, 10, paper ? CREAM : GOLD, 0, 2); c.restore();
    }
    return;
  }
  for (let i = 0; i < 17; i += 1) {
    const velocity = 35 + grain(seed + i * 9) * 200;
    const side = grain(i * 7 + seed) * 2 - 0.4;
    const fx = x + side * velocity * t;
    const fy = y - 94 - (70 + grain(i + seed) * 190) * t + 145 * t * t;
    c.save(); c.translate(fx, fy); c.rotate((i % 2 ? 1 : -1) * t * (2 + i % 5));
    c.globalAlpha = 1 - ease((t - 1.35) / 0.75);
    const w = 11 + grain(i + 77) * 28;
    box(c, -w / 2, -5, w, paper ? 18 : 8, paper ? CREAM : i % 3 === 0 ? GREEN : GOLD, 1, 2);
    if (paper && i % 3 === 0) text(c, 'NFA', 0, 3, 9, INK, 'center');
    c.restore();
  }
}

function wall(c: CanvasRenderingContext2D, r: Routine, time: number, reduced: boolean): void {
  const x = r.propX, y = floorAt(x), hit = r.age >= CONTACT;
  const t = Math.max(0, r.age - CONTACT);
  if (!hit) {
    bear(c, { x: x + 71, y, time, gesture: Math.sin(time * 2) * 0.35, crown: r.lap > 1, suit: '#bb5458' });
    for (const px of [-94, 82]) box(c, x + px, y - 107, 12, 109, '#8c6045', 2, 3);
    c.save(); c.translate(x, y - 83); c.rotate(reduced ? 0 : Math.sin(time * 8) * 0.025);
    box(c, -113, -54, 226, 109, '#f2b95d', 2, 4);
    text(c, 'BEARISH AF', 0, -20, 31, INK, 'center');
    text(c, 'I DID ZERO RESEARCH', 0, 15, 14, INK, 'center');
    line(c, [[-96, 30], [96, 30]], INK, 2); c.restore();
  } else {
    fragments(c, x, y, t, r.index + 14, reduced);
    const toss = reduced ? 1 : ease(t / 0.6);
    bear(c, { x: x + 82 + toss * 84, y: y - (reduced ? 0 : Math.sin(clamp(t / 1.5) * Math.PI) * 85), time: reduced ? 0 : time, panic: 1, tilt: reduced ? -0.2 : Math.sin(t * 8) * Math.exp(-t * 1.5) * 0.7, suit: '#bb5458' });
    if (t < 1.5) bubble(c, x + 104, y - 196, 'STILL EARLY TO BE WRONG', 236);
  }
}

function podcast(c: CanvasRenderingContext2D, r: Routine, time: number, reduced: boolean): void {
  const x = r.propX, y = floorAt(x), t = Math.max(0, r.age - CONTACT);
  const hit = r.age >= CONTACT;
  const collapse = hit ? reduced ? 1 : ease(t / 0.5) : 0;
  const bounce = hit && !reduced ? Math.sin(clamp(t / 1.2) * Math.PI) * 77 : 0;
  bear(c, { x: x - 35, y: y - 40 - bounce, time, headphones: true, panic: collapse, gesture: !hit ? 0.4 + Math.sin(time * 5) * 0.4 : 0, tilt: collapse * -0.38, suit: '#765899' });
  bear(c, { x: x + 87, y: y - 40 - bounce * 0.7, time: time + 1, headphones: true, panic: collapse, gesture: !hit ? Math.sin(time * 6) * 0.3 : 0, tilt: collapse * 0.42, suit: '#2e7769' });
  box(c, x - 118, y - 232, 238, 39, RED, 5, 3); text(c, 'THE BEARCAST', x + 1, y - 211, 25, CREAM, 'center');
  c.save(); c.translate(x, y - 71 + collapse * 54); c.rotate(collapse * -0.16);
  for (const px of [-87, 86]) { line(c, [[px, 0], [px + collapse * (px < 0 ? -30 : 30), 71 - collapse * 54]], INK, 10); }
  box(c, -126, -12, 262, 28, '#89683f', 3, 4);
  text(c, '2 BEARS · 0 FACTS', 3, 6, 19, CREAM, 'center');
  microphone(c, -37, -10, collapse * 1.8); microphone(c, 84, -10, collapse * -1.5);
  box(c, 14, -46, 24, 32, CREAM, 2, 2); text(c, 'COPE', 26, -31, 9, INK, 'center'); c.restore();
  if (hit) fragments(c, x, y, t, 58 + r.index, reduced, true);
  if (!hit && r.age > 1.1) bubble(c, x - 31, y - 269, 'I AM JUST ASKING QUESTIONS', 261);
}

function mech(c: CanvasRenderingContext2D, r: Routine, time: number, reduced: boolean): void {
  const x = r.propX + 28, y = floorAt(x), hit = r.age >= CONTACT;
  const t = Math.max(0, r.age - CONTACT);
  const fail = hit ? reduced ? 1 : ease(t / 0.7) : 0;
  const swing = hit ? 1 - fail : r.age > 1.4 ? Math.sin(clamp((r.age - 1.4) / 1.15) * Math.PI / 2) : 0;
  for (const px of [-62, 66]) {
    oval(c, x + px, y - 12, 25, 25, INK, 3); oval(c, x + px, y - 12, 11, 11, '#788775', 3);
  }
  c.save(); c.translate(x, y - 33); c.rotate(fail * 0.35);
  box(c, -80, -147, 165, 132, '#718079', 11, 5);
  box(c, -59, -127, 123, 47, INK, 4, 2); text(c, hit ? 'REKT.EXE' : 'SHORT-BOT', 2, -103, 22, hit ? RED : GREEN, 'center');
  text(c, '100× CONFIDENCE', 3, -56, 17, CREAM, 'center');
  for (let i = 0; i < 5; i += 1) oval(c, -46 + i * 24, -33, 5, 5, hit ? RED : GREEN, 2);
  const shoulder: readonly [number, number] = [-81, -98];
  const elbow: readonly [number, number] = [-127 - swing * 23, -114 + swing * 26 + fail * 80];
  const hand: readonly [number, number] = [-118 - swing * 91, -135 + swing * 19 + fail * 121];
  line(c, [shoulder, elbow, hand], INK, 28); line(c, [shoulder, elbow, hand], '#a3b3a0', 17);
  oval(c, elbow[0], elbow[1], 15, 15, GOLD, 4);
  box(c, hand[0] - 36, hand[1] - 20, 57, 42, RED, 14, 4);
  text(c, 'SELL', hand[0] - 7, hand[1] + 1, 16, CREAM, 'center');
  bear(c, { x: 5, y: -154, scale: 0.68, time, panic: fail, gesture: 0.3 + Math.sin(time * 4) * 0.3, suit: '#525968' });
  line(c, [[29, -151], [40 - swing * 29, -180 + swing * 16]], INK, 5); oval(c, 40 - swing * 29, -180 + swing * 16, 8, 8, RED, 3);
  c.restore();
  line(c, [[x + 89, y - 31], [x + 142, y - 3], [x + 170 + fail * 40, y - 13]], INK, 5);
  box(c, x + 166 + fail * 40, y - 24, 22, 17, GOLD, 2, 2);
  if (hit) {
    fragments(c, x, y, t, 114 + r.index, reduced);
    if (t < 1.7) bubble(c, x + 21, y - 283, 'WHO UNPLUGGED MY THESIS?', 257);
  }
}

function prophet(c: CanvasRenderingContext2D, r: Routine, time: number, reduced: boolean): void {
  const x = r.propX, y = floorAt(x), hit = r.age >= CONTACT;
  const t = Math.max(0, r.age - CONTACT), fold = hit ? reduced ? 1 : ease(t / 0.5) : 0;
  c.save(); c.translate(x + 62, y); c.rotate(fold * 1.1);
  poly(c, [[-45, 0], [-36, -147], [38, -147], [59, 0]], '#9857a3', 4);
  oval(c, 0, -169, 39, 37, '#c68d5a', 4);
  poly(c, [[-33, -163], [-12, -140], [32, -159], [17, -97], [-9, -74], [-35, -132]], CREAM, 4);
  box(c, -33, -177, 63, 18, GOLD, 3, 3); line(c, [[-9, -184], [8, -184]], INK, 3);
  poly(c, [[-34, -193], [-23, -227], [25, -227], [34, -193]], '#352746', 3);
  text(c, 'GURU', 0, -211, 17, CREAM, 'center'); c.restore();
  c.save(); c.translate(x - 16, y - 95 + fold * 47); c.rotate(-fold * 0.2);
  box(c, -126, -62, 242, 124, '#d3b67f', 3, 4);
  text(c, hit ? 'I HAVE NO IDEA' : 'MY MODEL SAYS...', -4, -36, 25, INK, 'center', 225);
  if (!hit) {
    line(c, [[-104, 34], [-69, 21], [-47, 25], [-21, 1], [4, 6], [42, -10], [86, -10]], '#487456', 5);
    poly(c, [[76, -24], [103, -10], [76, 5]], '#487456', 2);
    text(c, 'DRAWN IN CRAYON', 0, 47, 12, INK, 'center');
  } else { text(c, 'PLEASE BUY MY COURSE', -3, 8, 17, INK, 'center'); text(c, 'NO REFUNDS, OBVIOUSLY', -3, 36, 12, INK, 'center'); }
  c.restore();
  if (hit) fragments(c, x, y, t, 80 + r.index, reduced, true);
  else if (r.age > 1.3) bubble(c, x + 45, y - 271, 'THE ARROW IS SCIENCE', 228);
}

function kiosk(c: CanvasRenderingContext2D, r: Routine, time: number, reduced: boolean): void {
  const x = r.propX, y = floorAt(x), hit = r.age >= CONTACT;
  const t = Math.max(0, r.age - CONTACT), spill = hit ? reduced ? 1 : ease(t / 0.8) : 0;
  bear(c, { x: x + 25 + spill * 40, y: y - 70 - (reduced ? 0 : Math.sin(spill * Math.PI) * 48), time, panic: spill, headphones: false, suit: '#92c78a', gesture: Math.sin(time * 4) * 0.2 });
  box(c, x - 118, y - 77, 234, 73, '#7968a2', 5, 4);
  text(c, 'BEAR TEARS', x, y - 41, 30, CREAM, 'center'); text(c, 'COLD-PRESSED. HOT TAKES.', x, y - 14, 12, CREAM, 'center');
  for (const px of [-111, 111]) line(c, [[x + px, y - 80], [x + px + spill * (px < 0 ? -30 : 30), y - 227 + spill * 132]], INK, 7);
  c.save(); c.translate(x, y - 231 + spill * 105); c.rotate(spill * -0.25);
  box(c, -135, -24, 270, 51, GOLD, 6, 4); text(c, 'COPIUM EXPRESS', 0, 3, 27, INK, 'center'); c.restore();
  for (let i = 0; i < 5; i += 1) {
    const lift = hit && !reduced ? Math.sin(clamp(t / 1.5) * Math.PI) * (80 + i * 19) : 0;
    c.save(); c.translate(x - 82 + i * 43 + spill * (i - 2) * 16, y - 79 - lift); c.rotate(hit ? spill * (i - 2) * 0.8 : 0);
    poly(c, [[-11, -27], [11, -27], [8, 0], [-7, 0]], CREAM, 2); line(c, [[2, -19], [8, -40]], GREEN, 3); c.restore();
  }
  if (hit) fragments(c, x, y, t, 210 + r.index, reduced, true);
  if (!hit && r.age > 1.2) bubble(c, x + 17, y - 283, 'IT IS A HEALTHY CORRECTION', 255);
}

function police(c: CanvasRenderingContext2D, r: Routine, time: number, reduced: boolean): void {
  const x = r.propX, y = floorAt(x), hit = r.age >= CONTACT;
  const t = Math.max(0, r.age - CONTACT), topple = hit ? reduced ? 1 : ease(t / 0.85) : 0;
  box(c, x - 106, y - 70, 208, 20, RED, 3, 4);
  for (let i = 0; i < 7; i += 1) poly(c, [[x - 100 + i * 30, y - 70], [x - 87 + i * 30, y - 70], [x - 71 + i * 30, y - 50], [x - 84 + i * 30, y - 50]], CREAM, 0);
  for (const px of [-89, 87]) line(c, [[x + px, y - 51], [x + px + topple * 30, y]], INK, 6);
  c.save(); c.translate(x + 88, y - 23); c.rotate(topple * 0.7);
  oval(c, 0, 5, 24, 24, INK, 3); oval(c, 0, 5, 10, 10, '#889790', 3);
  bear(c, { x: 0, y: -8, scale: 0.85, time, panic: topple, suit: '#467684', gesture: 0.8 });
  box(c, -33, -143, 68, 14, '#426779', 3, 3); box(c, -24, -158, 49, 19, '#426779', 3, 3); star(c, 1, -148, 7, GOLD, 5);
  line(c, [[-41, -71], [-87, -173]], INK, 6);
  poly(c, [[-126, -221], [-71, -224], [-50, -204], [-49, -166], [-70, -146], [-121, -146], [-143, -167], [-145, -199]], RED, 4);
  text(c, 'NO FUN', -97, -186, 22, CREAM, 'center'); c.restore();
  if (hit && t < 1.7) bubble(c, x + 65, y - 261, 'I AM CALLING COMPLIANCE', 258);
}

export function drawAct(c: CanvasRenderingContext2D, r: Routine, time: number, reduced: boolean): void {
  if (r.propX < -270 || r.propX > 1190) return;
  if (r.kind === 0) wall(c, r, time, reduced);
  else if (r.kind === 1) podcast(c, r, time, reduced);
  else if (r.kind === 2) mech(c, r, time, reduced);
  else if (r.kind === 3) prophet(c, r, time, reduced);
  else if (r.kind === 4) kiosk(c, r, time, reduced);
  else police(c, r, time, reduced);
  if (r.lap > 0 && r.age < CONTACT) {
    const y = floorAt(r.propX);
    box(c, r.propX - 112, y + 8, 226, 23, RED, 2, 2);
    text(c, SPONSORS[(r.kind + r.lap) % SPONSORS.length]!, r.propX, y + 21, 12, CREAM, 'center', 216);
  }
}

/** The opening gag stays active during waiting and betting. */
export function idleBear(c: CanvasRenderingContext2D, time: number, reduced: boolean): void {
  const x = 782, y = 407;
  bear(c, { x, y: y - 25, time: reduced ? 0 : time, headphones: true, gesture: reduced ? 0.4 : Math.sin(time * 3) * 0.8, suit: '#8657a1' });
  box(c, x - 118, y - 33, 253, 71, '#54475e', 5, 4);
  text(c, 'BEARISH SINCE BIRTH', x + 7, y - 6, 19, CREAM, 'center');
  text(c, 'PODCAST #8,431', x + 7, y + 21, 14, '#e9be72', 'center');
  microphone(c, x - 19, y - 32, reduced ? 0 : Math.sin(time * 2) * 0.07);
  const phase = Math.floor(time / 2.4) % 3;
  bubble(c, x - 28, 205, ['IT IS GOING TO ZERO.', 'THAT BULL IS A PSYOP.', 'STOP HAVING FUN.'][phase]!, 251);
}
