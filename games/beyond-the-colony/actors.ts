import { type Act, between, clamp, noise, recoil, smooth, TAU, windowAt } from './motion';
import { balloon, box, burst, CORAL, ellipse, GOLD, INK, JADE, line, polygon, WHITE, words } from './drawing';

function minion(c: CanvasRenderingContext2D, x: number, y: number, time: number, shout: boolean, scale: number): void {
  const jump = shout ? Math.max(0, Math.sin(time * 6)) * 12 : Math.sin(time * 2) * 2;
  c.save(); c.translate(x, y - jump); c.scale(scale, scale);
  line(c, [[-11, -8], [-15, 0]], GOLD, 8); line(c, [[11, -8], [18, 0]], GOLD, 8);
  ellipse(c, 0, -35, 26, 37, '#0b293d', 0, 3); ellipse(c, 5, -29, 16, 26, WHITE);
  ellipse(c, 0, -65, 22, 21, '#0c2c3e', 0, 3); ellipse(c, 7, -60, 14, 14, WHITE);
  ellipse(c, 10, -66, 3, shout ? 5 : 3, INK); polygon(c, [[16, -61], [33, -56], [16, -52]], GOLD, 2);
  if (shout) { ellipse(c, 9, -47, 6, 7, INK); line(c, [[-20, -48], [-39, -70 - Math.sin(time * 6) * 15]], '#082536', 9); }
  else line(c, [[-18, -45], [-23, -22]], '#082536', 9);
  polygon(c, [[-9, -44], [7, -44], [10, -11], [-4, -2], [-9, -15]], CORAL, 2);
  c.restore();
}
export function herd(c: CanvasRenderingContext2D, time: number, act: Act, active: boolean, reduced: boolean): void {
  const loud = active && act.kind === 0;
  const t = reduced ? 0 : time;
  const n = 5 + Math.min(4, act.tier);
  for (let i = 0; i < n; i += 1) {
    const x = 55 + (i % 3) * 48 + Math.floor(i / 3) * 5;
    const y = 417 - Math.floor(i / 3) * 25;
    minion(c, x, y, t + i, loud, .64 + i % 2 * .11);
  }
  const bob = reduced ? 0 : Math.sin(t * 4) * (loud ? 8 : 2);
  line(c, [[115, 330 + bob], [111, 398]], '#bc9574', 6);
  c.save(); c.translate(126, 312 + bob); c.rotate(reduced ? -.03 : Math.sin(t * 3) * .07);
  box(c, -104, -32, 207, 61, '#eaddb7', 2, 4);
  words(c, loud ? act.prop : 'RETURN TO WORK', 0, -4, 23, INK, 192);
  c.restore();
  if (loud && act.age > 1.5 && act.age < 5.5) balloon(c, act.tier > 1 ? 'WE ARE A FAMILY!' : 'HE THINKS HE IS SPECIAL!', 159, 214, 275, WHITE, 19);
}

function drone(c: CanvasRenderingContext2D, time: number, act: Act, reduced: boolean): void {
  const enter = reduced ? 1 : between(0, .9, act.age) * (1 - between(5.5, 7, act.age));
  const x = 1030 - enter * (354 + Math.sin(time * 1.7) * 62);
  const y = 180 + (reduced ? 0 : Math.sin(time * 4) * 19);
  c.save();
  const beam = c.createLinearGradient(x, y + 20, x, 433); beam.addColorStop(0, 'rgba(244,213,123,.31)'); beam.addColorStop(1, 'rgba(244,213,123,0)');
  polygon(c, [[x - 25, y + 10], [x + 30, y + 10], [x + 178, 426], [x - 243, 426]], beam);
  c.translate(x, y); c.rotate(reduced ? 0 : Math.sin(time * 3) * .1);
  line(c, [[-42, -5], [-81, -33]], '#aed2c9', 9); line(c, [[42, -5], [81, -33]], '#aed2c9', 9);
  for (const side of [-1, 1]) {
    box(c, side * 81 - 16, -42, 32, 13, '#214853', 5, 3);
    ellipse(c, side * 81, -48, 51, reduced ? 4 : 3 + Math.abs(Math.sin(time * 69)) * 4, '#badedb', 0, 2);
    ellipse(c, side * 81, -48, 8, 7, INK);
  }
  box(c, -53, -28, 108, 66, '#cdddc5', 16, 4);
  box(c, -39, -17, 80, 35, '#12343d', 6, 2); words(c, act.tier > 1 ? 'MBA' : 'H.R.', 0, 1, 25, '#f9ca91', 67);
  ellipse(c, 0, 34, 20, 13, INK); ellipse(c, 1, 35, 8, 7, CORAL);
  c.restore();
  if (act.age > .9 && act.age < 5.8) balloon(c, act.prop, x, y + 83, 242, GOLD, 24);
  if (act.tier > 0) {
    c.save(); c.globalAlpha = .7; c.translate(-260, 38); ellipse(c, x, y, 39, 14, '#b6d6c5', 0, 3); ellipse(c, x - 28, y - 11, 26, 3, WHITE); ellipse(c, x + 28, y - 11, 26, 3, WHITE); words(c, 'HR 2', x, y, 11, INK, 55); c.restore();
  }
}

function seal(c: CanvasRenderingContext2D, time: number, act: Act, reduced: boolean): void {
  const enter = reduced ? 1 : between(0, .8, act.age) * (1 - between(5.8, 7, act.age));
  const x = 1030 - enter * 258; const y = 417;
  const windup = reduced ? .2 : windowAt(act.age, .8, 2.1, .35);
  const hit = reduced ? .6 : between(2.05, 2.18, act.age) * (1 - between(3.0, 3.7, act.age));
  c.save(); c.translate(x, y);
  ellipse(c, 0, 7, 121, 14, 'rgba(0,22,36,.25)');
  const squash = reduced ? 0 : recoil(act.age - 2.15, 9);
  ellipse(c, 0, -47 + squash, 96, 57, '#879a8c', -.1, 4);
  ellipse(c, -37, -48 + squash, 67, 41, '#b0b79b');
  polygon(c, [[72, -25], [133, -43], [117, -10], [88, 4], [67, -3]], '#7c8f85', 3);
  const headY = -111 - windup * 16 + hit * 13;
  ellipse(c, -43, headY, 51, 51, '#a6b09a', -.12, 4); ellipse(c, -65, headY + 20, 30, 20, '#d1cdb0', 0, 2);
  ellipse(c, -81, headY + 7, 10, 7, INK);
  box(c, -75, headY - 15, 31, 19, '#092d39', 4, 3); box(c, -32, headY - 15, 26, 19, '#092d39', 4, 3); line(c, [[-44, headY - 9], [-32, headY - 9]], INK, 4);
  line(c, [[-83, headY + 28], [-103, headY + 22]], '#375958', 2); line(c, [[-83, headY + 31], [-103, headY + 32]], '#375958', 2);
  polygon(c, [[-29, -72], [-5, -78], [13, -21], [-4, -4], [-24, -25]], CORAL, 3);
  c.save(); c.translate(-61, -56); c.rotate(-.3 - windup * 1.1 + hit * .8);
  ellipse(c, -26, -2, 45, 16, '#7e9587', 0, 3);
  box(c, -99, -73, 89, 100, '#c38e65', 4, 4); box(c, -89, -64, 69, 79, '#f4e7bf', 2);
  words(c, 'REVIEW', -54, -45, 17, INK, 64); words(c, act.tier ? 'NO.' : '1/10', -54, -13, 32, CORAL, 62); box(c, -67, -80, 29, 14, '#75978c', 3, 2);
  c.restore();
  if (act.tier > 1) { polygon(c, [[-87, headY - 43], [-90, headY - 74], [-62, headY - 55], [-41, headY - 83], [-22, headY - 57], [4, headY - 72], [0, headY - 40]], GOLD, 3); }
  c.restore();
  if (act.age > .8 && act.age < 5.8) balloon(c, act.prop, 756, 186, 303, WHITE, 22);
  if (!reduced && act.age > 2.1 && act.age < 2.5) { burst(c, 597, 389, 59, GOLD); words(c, 'STAMP!', 595, 390, 22, INK, 100); }
}

function kiosk(c: CanvasRenderingContext2D, time: number, act: Act, reduced: boolean, bureaucratic: boolean): void {
  const enter = reduced ? 1 : between(0, .7, act.age) * (1 - between(6, 7, act.age));
  const x = 1040 - enter * 277;
  c.save(); c.translate(x, 421);
  box(c, -83, -216, 173, 224, bureaucratic ? '#598187' : '#d28979', 5, 4);
  polygon(c, [[-106, -215], [3, -264], [112, -215]], bureaucratic ? '#7aa3a4' : '#efc08a', 4);
  box(c, -71, -194, 149, 120, '#102e41', 4, 3);
  if (bureaucratic) {
    const open = reduced ? .7 : .15 + .75 * between(1.3, 2.7, act.age) * (1 - between(5, 6, act.age));
    box(c, -68, -191, 66 * (1 - open), 111, '#a3b9aa', 1, 2); box(c, 75 - 69 * (1 - open), -191, 69 * (1 - open), 111, '#9bb1a6', 1, 2);
    minion(c, 10, -80, reduced ? 0 : time, false, 1.05);
    words(c, act.tier > 0 ? 'SOUL SUPPORT' : 'SUMMIT HR', 4, -238, 20, INK, 154);
  } else {
    const glow = reduced ? .65 : .5 + Math.sin(time * 3) * .2;
    ellipse(c, 1, -137, 51, 40, `rgba(192,239,188,${glow})`);
    words(c, 'INNER', 3, -160, 24, INK, 129); words(c, 'PEACE™', 3, -126, 30, INK, 134);
    words(c, 'NIRVANA', 4, -238, 23, INK, 165);
  }
  box(c, -72, -67, 149, 50, '#eee7bf', 3, 3); words(c, bureaucratic ? 'TAKE A NUMBER' : act.tier ? 'UPGRADE REQUIRED' : 'CARD REQUIRED', 3, -41, 15, INK, 140);
  box(c, -43, -16, 91, 19, '#162e3b', 2, 2); words(c, bureaucratic ? '∞ + 1' : 'FREE*', 3, -5, 14, GOLD, 81);
  c.restore();
  if (act.age > 1.1 && act.age < 5.9) balloon(c, act.prop, 748, 125, 322, WHITE, 20);
  if (bureaucratic && !reduced && act.age > 2) {
    for (let i = 0; i < 12; i += 1) {
      const u = (act.age * .6 + i / 12) % 1; const px = x - u * 430; const py = 313 - Math.sin(u * Math.PI) * 90 + Math.sin(i * 7) * 40;
      c.save(); c.translate(px, py); c.rotate(u * 8 + i); box(c, -12, -17, 24, 34, WHITE, 1, 1); line(c, [[-7, -5], [6, -5]], '#748d8c', 1); line(c, [[-7, 3], [6, 3]], '#748d8c', 1); c.restore();
    }
  }
}

function fan(c: CanvasRenderingContext2D, time: number, act: Act, reduced: boolean): void {
  const enter = reduced ? 1 : between(0, .8, act.age) * (1 - between(5.9, 7, act.age));
  const x = 1040 - enter * 259;
  c.save(); c.translate(x, 295);
  line(c, [[0, 80], [0, 128]], '#aec9c1', 16); box(c, -68, 126, 134, 14, '#89a99f', 6, 3);
  ellipse(c, 0, 0, 99, 96, '#88bcbf', 0, 4); ellipse(c, 0, 0, 88, 86, '#123f53', 0, 3);
  c.save(); c.rotate(reduced ? .3 : time * 12);
  for (let i = 0; i < 4; i += 1) { c.rotate(TAU / 4); ellipse(c, 28, 34, 26, 54, '#accfc6', -.5, 3); }
  c.restore();
  for (let i = -2; i <= 2; i += 1) { const y = i * 30; const span = Math.sqrt(86 * 86 - y * y); line(c, [[-span, y], [span, y]], '#335a67', 3); }
  ellipse(c, 0, 0, 15, 15, GOLD, 0, 3); words(c, 'FEEDBACK', 0, 116, 20, WHITE, 185, 'center', true);
  c.restore();
  if (act.age > 1 && act.age < 6) balloon(c, act.prop, 748, 153, 274, WHITE, 22);
}

function cosmic(c: CanvasRenderingContext2D, time: number, act: Act, reduced: boolean): void {
  const power = reduced ? .7 : windowAt(act.age, .6, 6.6, 1);
  if (power <= 0) return;
  c.save(); c.globalAlpha = power;
  const x = 481; const y = 305;
  const glow = c.createRadialGradient(x, y, 21, x, y, 211); glow.addColorStop(0, 'rgba(212,255,166,.17)'); glow.addColorStop(.6, 'rgba(120,247,183,.13)'); glow.addColorStop(1, 'rgba(120,247,183,0)'); c.fillStyle = glow; c.fillRect(x - 216, y - 216, 432, 432);
  for (let i = 0; i < 16; i += 1) {
    const a = i * TAU / 16 + (reduced ? 0 : time * .11); const r = 124 + (reduced ? 0 : Math.sin(time * 7 + i) * 13);
    line(c, [[x + Math.cos(a) * r, y + Math.sin(a) * r], [x + Math.cos(a) * (r + 58), y + Math.sin(a) * (r + 58)]], i % 2 ? GOLD : JADE, 3);
  }
  ellipse(c, 466, 174, 55, 12, 'rgba(255,222,149,.08)', 0, 3); c.strokeStyle = GOLD; c.lineWidth = 5; c.beginPath(); c.ellipse(466, 174, 55, 12, 0, 0, TAU); c.stroke();
  words(c, act.prop, 486, 111, 28, GOLD, 600, 'center', true);
  c.restore();
}

function fish(c: CanvasRenderingContext2D, time: number, act: Act, reduced: boolean): void {
  const enter = reduced ? .6 : between(.2, 3.9, act.age);
  const depart = reduced ? 0 : between(5, 7, act.age);
  const x = 1080 - enter * 370 - depart * 1150;
  const y = 277 + (reduced ? 0 : Math.sin(time * 5) * 22);
  const size = 1 + Math.min(2, act.tier) * .12;
  c.save(); c.translate(x, y); c.scale(size, size); c.rotate(reduced ? -.1 : Math.sin(time * 3) * .13);
  polygon(c, [[77, 0], [143, -52], [128, 0], [145, 54]], CORAL, 4);
  ellipse(c, 0, 0, 106, 55, '#a9bba5', -.08, 4); ellipse(c, -30, 16, 73, 26, '#e0d9b4');
  polygon(c, [[-3, -47], [28, -79], [45, -47]], '#678a85', 3);
  ellipse(c, -68, -12, 22, 24, WHITE, 0, 3); ellipse(c, -76, -8, 8, 10, INK);
  polygon(c, [[-103, 12], [-71, 8], [-98, 35]], INK, 2);
  for (let i = 0; i < 6; i += 1) line(c, [[-16 + i * 18, -28], [-27 + i * 18, -10], [-18 + i * 18, 8]], '#7b9b8e', 2);
  words(c, act.tier > 0 ? 'FOLLOW-UP' : 'URGENT', 11, 17, 19, INK, 121);
  c.restore();
  if (act.age > 1 && act.age < 5.4) words(c, act.prop, 680, 161, 25, GOLD, 492, 'center', true);
}

export function setpiece(c: CanvasRenderingContext2D, time: number, act: Act, reduced: boolean): void {
  switch (act.kind) {
    case 1: drone(c, time, act, reduced); break;
    case 2: seal(c, time, act, reduced); break;
    case 3: kiosk(c, time, act, reduced, false); break;
    case 4: fan(c, time, act, reduced); break;
    case 5: cosmic(c, time, act, reduced); break;
    case 6: kiosk(c, time, act, reduced, true); break;
    case 7: fish(c, time, act, reduced); break;
  }
}
