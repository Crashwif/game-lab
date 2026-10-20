import { box, clamp, ease, label, line, oval, poly, type Ctx } from './ink';

export function flag(c: Ctx, x: number, t: number, deflate: number) {
  line(c, [x, -260, x, -41], '#142f39', 5);
  line(c, [x + 1, -259, x + 1, -42], '#e8cc8b', 2);
  oval(c, x, -263, 5, 6, '#edc668', '#13333d');
  const width = 132, height = 61;
  const at = (u: number, v: number) => ({ x: x - u * width * (1 - deflate * .55), y: -251 + v * height + Math.sin(t * 2.3 - u * 5 + v) * u * 8 * (1 - deflate) + deflate * u * 59 });
  c.beginPath(); const start = at(0, 0); c.moveTo(start.x, start.y);
  for (let i = 0; i <= 16; i++) { const p = at(i / 16, 0); c.lineTo(p.x, p.y); }
  for (let i = 16; i >= 0; i--) { const p = at(i / 16, 1); c.lineTo(p.x, p.y); }
  c.closePath(); c.fillStyle = '#83cdb5'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#173a43'; c.stroke();
  if (deflate < .65) {
    c.save(); c.translate(x - 70, -230 + Math.sin(t * 2.3 - 2.5) * 4); c.rotate(-.035);
    label(c, 'PEACE', 0, 0, 20, '#184d4c', 118, 'center', 'Georgia');
    label(c, '& CONTENT', 0, 20, 10, '#184d4c', 117);
    c.restore();
  }
}
export function camera(c: Ctx, x: number, y: number, t: number, off = 0) {
  c.save(); c.translate(x, y); c.rotate(off * .95);
  line(c, [0, -5, -20, 38, 0, -5, 23, 38, 0, -5, 0, 39], '#163743', 4);
  box(c, -22, -26, 40, 27, '#213b4b', '#091e2d', 4);
  poly(c, [18, -21, 36, -28, 36, -3, 18, -8], '#132c3b', '#091e2d');
  oval(c, -12, -29, 11, 11, '#49646a', '#132c3b'); oval(c, 10, -30, 12, 12, '#49646a', '#132c3b');
  oval(c, -17, -17, 2.8, 2.8, off ? '#526068' : Math.sin(t * 3) > 0 ? '#ff715c' : '#bf473c');
  label(c, 'LIVE', -3, -11, 6, '#fff0b8', 23);
  c.restore();
}
export function ring(c: Ctx, x: number, y: number, fall: number) {
  c.save(); c.translate(x, y); c.rotate(fall * 1.3);
  line(c, [0, 0, 0, -101, -15, -101], '#244653', 4);
  line(c, [-20, 0, 0, -10, 20, 0], '#244653', 4);
  c.beginPath(); c.arc(0, -111, 22, 0, Math.PI * 2); c.strokeStyle = '#19323d'; c.lineWidth = 8; c.stroke();
  c.strokeStyle = fall > .4 ? '#857b61' : '#fff0b3'; c.lineWidth = 4; c.stroke();
  box(c, -6, -122, 12, 22, '#345c65', '#13313d', 2);
  c.restore();
}
export function drone(c: Ctx, x: number, y: number, scale: number, t: number, off = 0) {
  c.save(); c.translate(x, y); c.scale(scale, scale); c.rotate(Math.sin(t * 1.6) * .05 + off * .3);
  line(c, [-44, -3, 0, 4, 42, -5, 2, 5], '#253c48', 7);
  for (const side of [-1, 1]) {
    oval(c, side * 43, -7, 25, 5, off ? '#40575c' : '#d6e7c38a');
    line(c, [side * 43 - 22, -7 - Math.sin(t * 43) * 3 * (1 - off), side * 43 + 22, -7 + Math.sin(t * 43) * 3 * (1 - off)], '#1d3a45', 2);
  }
  box(c, -18, -7, 36, 17, '#e7dbb7', '#183842', 4);
  line(c, [-10, 10, -14, 19, 11, 19, 10, 10], '#203e47', 3);
  oval(c, 0, 13, 8, 7, '#263b49', '#a3b7a5'); oval(c, 1, 13, 3, 3, '#80daca');
  c.restore();
}
export function fan(c: Ctx, x: number, y: number, t: number, off: number) {
  line(c, [x, y, x, y - 44], '#243c49', 5); line(c, [x - 17, y, x + 17, y], '#243c49', 5);
  c.save(); c.translate(x, y - 67);
  oval(c, 0, 0, 26, 27, '#668a81', '#213e48');
  c.save(); c.rotate(t * 9);
  for (let i = 0; i < 3; i++) { c.rotate(Math.PI * 2 / 3); oval(c, 0, -12, 7, 12, '#d3d8b7', '#294d53'); }
  c.restore();
  for (let i = -2; i <= 2; i++) line(c, [i * 9, -21, i * 9, 21], '#1d404847', 1);
  oval(c, 0, 0, 5, 5, '#dcb963', '#294853');
  c.restore();
}
export function medal(c: Ctx, x: number, y: number, t: number, collapse: number, alpha: number) {
  if (alpha <= 0) return;
  c.save(); c.globalAlpha = alpha; c.translate(x + Math.sin(t * .85) * 6, y + Math.sin(t * 1.3) * 4 + collapse * 104);
  line(c, [0, 40, -8 + Math.sin(t) * 7, 135 - collapse * 75], '#d6bd83', 1.5);
  c.scale(1 + collapse * .2, Math.max(.1, 1 - collapse * .87));
  poly(c, [-17, -36, -23, -68, 0, -55, 23, -68, 17, -36], '#ee8790', '#773c4c');
  oval(c, 0, 0, 48, 49, '#db9b3f', '#63452f');
  oval(c, 0, -2, 41, 41, '#f5d47d', '#ac7735');
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; oval(c, Math.cos(a) * 35, Math.sin(a) * 35 - 2, 1.5, 2, '#a77b3d'); }
  label(c, 'NOBEL', 0, -10, 14, '#83562c', 69, 'center', 'Georgia');
  label(c, 'ME', 0, 12, 25, '#83562c', 62, 'center', 'Georgia');
  line(c, [-30, -21, -22, -31, -11, -35], '#fff1b4', 4);
  c.restore();
}
/** Only a host-revealed crash opens the fictional party crew's case. */
export function moraleCase(c: Ctx, x: number, y: number, age: number | null) {
  const opened = age === null ? 0 : ease((age - .12) / .4);
  c.save(); c.translate(x, y);
  box(c, -47, -29, 94, 30, '#856354', '#183440', 3);
  box(c, -43, -25, 86, 23, '#261f2c', '#d0a173', 2);
  c.save(); c.translate(0, -29); c.scale(1, 1 - opened * 1.85);
  box(c, -48, -4, 96, 31, '#d7b47b', '#17343e', 3);
  label(c, 'EMERGENCY MORALE', 0, 9, 6.5, '#514338', 87);
  line(c, [-30, 23, -30, 28, 30, 28, 30, 23], '#142d39', 3);
  c.restore();
  if (opened > .75) { label(c, 'EMPTY', 0, -14, 15, '#ff917e', 80); }
  box(c, -48, 2, 96, 22, '#352e3b', '#d2ac72', 2);
  label(c, 'FICTIONAL CREW', 0, 8, 6, '#dfceb1', 90);
  label(c, 'COCAINE RESERVE', 0, 17, 6.5, '#efb982', 90);
  c.restore();
}
export function teleprompter(c: Ctx, x: number, y: number, t: number) {
  line(c, [x, y, x, y - 70, x - 27, y - 70, x + 30, y - 70], '#1d3c4a', 4);
  poly(c, [x - 36, y - 120, x + 39, y - 113, x + 32, y - 64, x - 38, y - 69], '#153b46dc', '#7fb9ac');
  label(c, 'BE HUMBLE', x, y - 102, 8, '#b7f0ca', 65);
  label(c, '[APPLAUSE]', x, y - 86, 7, '#d8ddaa', 65);
  const offset = (t * 12) % 8;
  for (let i = 0; i < 2; i++) line(c, [x - 27, y - 75 + i * 5 - offset, x + 23, y - 74 + i * 5 - offset], '#698e83', 1);
}
