import { clamp, noise, TAU } from './motion';
import { box, ellipse, GOLD, INK, JADE, line, polygon, WHITE, words } from './drawing';

export function sky(c: CanvasRenderingContext2D, time: number, chapter: number, reduced: boolean): void {
  const bg = c.createLinearGradient(0, 0, 0, 540);
  bg.addColorStop(0, '#041a2a'); bg.addColorStop(.58, chapter >= 2 ? '#224757' : '#175366'); bg.addColorStop(1, '#689da6');
  c.fillStyle = bg; c.fillRect(0, 0, 960, 540);
  for (let i = 0; i < 52; i += 1) ellipse(c, 10 + noise(i + 2) * 940, 72 + noise(i + 87) * 211, i % 12 === 0 ? 1.4 : .7, i % 12 === 0 ? 1.4 : .7, '#cfebe0');
  c.save(); c.globalCompositeOperation = 'screen';
  for (let ribbon = 0; ribbon < 3; ribbon += 1) {
    const gradient = c.createLinearGradient(0, 30, 0, 285);
    gradient.addColorStop(0, 'rgba(67,255,170,0)'); gradient.addColorStop(.54, 'rgba(87,249,174,.08)'); gradient.addColorStop(.8, `rgba(75,235,171,${.24 - ribbon * .05})`); gradient.addColorStop(1, 'rgba(105,245,206,0)');
    c.fillStyle = gradient; c.beginPath();
    for (let x = -40; x <= 1000; x += 20) { const y = 68 + ribbon * 39 + Math.sin(x / 204 + time * .18 + ribbon) * 45 + Math.sin(x / 96 - time * .17) * 18; if (x === -40) c.moveTo(x, y); else c.lineTo(x, y); }
    for (let x = 1000; x >= -40; x -= 20) c.lineTo(x, 153 + ribbon * 30 + Math.sin(x / 204 + time * .18 + ribbon) * 45 + Math.sin(x / 96 - time * .17) * 18);
    c.closePath(); c.fill();
  }
  c.restore();
  const moon = c.createRadialGradient(679, 153, 5, 679, 153, 63);
  moon.addColorStop(0, 'rgba(219,255,227,.25)'); moon.addColorStop(1, 'rgba(219,255,227,0)');
  c.fillStyle = moon; c.fillRect(615, 89, 128, 128); ellipse(c, 679, 153, 18, 18, '#e0ead0'); ellipse(c, 686, 148, 16, 16, '#173b46');
  for (let layer = 0; layer < 3; layer += 1) {
    const base = 360 + layer * 40;
    const shift = reduced ? 0 : (time * (7 + layer * 8)) % 170;
    const peaks: [number, number][] = [[-200, base]];
    for (let i = -2; i < 8; i += 1) {
      const x = i * 170 - shift; const top = base - 80 - noise(i + layer * 13) * 110;
      peaks.push([x, base], [x + 82, top], [x + 170, base - 15]);
    }
    peaks.push([1200, 540], [-200, 540]); polygon(c, peaks, ['#376e7b', '#2b5f73', '#1a485d'][layer]!);
    for (let i = -2; i < 8; i += 1) {
      const x = i * 170 - shift; const top = base - 80 - noise(i + layer * 13) * 110;
      polygon(c, [[x + 82, top], [x + 106, top + 46], [x + 88, top + 34], [x + 66, top + 49], [x + 59, top + 42]], ['#bddcd8', '#82b9c3', '#518b9b'][layer]!);
      polygon(c, [[x + 82, top], [x + 97, top + 82], [x + 170, base - 15]], ['#234d64', '#173f57', '#14384b'][layer]!);
    }
  }
  // The forbidden summit remains beyond the moving ice, with a tiny fluorescent office at its peak.
  polygon(c, [[527, 380], [774, 128], [958, 371]], '#548997');
  polygon(c, [[774, 128], [807, 269], [958, 371], [763, 355]], '#295569');
  polygon(c, [[713, 191], [774, 128], [829, 200], [800, 178], [786, 202], [769, 174], [752, 197], [743, 180]], '#d9f0e0');
  box(c, 765, 113, 26, 19, '#d6eecb', 1, 1); c.fillStyle = '#ffdc92'; c.fillRect(772, 117, 12, 9);
  if (chapter > 0) {
    line(c, [[775, 113], [775, 97]], '#accfd0', 2); polygon(c, [[777, 97], [812, 102], [777, 109]], '#ed9680');
  }
}

export function floes(c: CanvasRenderingContext2D, travel: number, time: number, sag: number, crash: number | null, reduced: boolean): void {
  const scroll = ((travel % 240) + 240) % 240;
  for (let i = -1; i < 6; i += 1) {
    const x = i * 240 - scroll;
    const delay = Math.abs(x + 120 - 460) / 930;
    const broken = crash === null ? 0 : reduced ? 1 : clamp((crash - .15 - delay) / .7);
    const dip = Math.exp(-Math.pow((x + 120 - 450) / 250, 2)) * sag;
    c.save(); c.translate(x + 120, 429 + dip);
    c.rotate(broken * (i % 2 ? -.38 : .35)); c.translate(0, broken * (170 + (i % 3 + 3) * 35));
    polygon(c, [[-126, 0], [124, -2], [120, 47], [62, 112], [-53, 97], [-123, 47]], '#296c85', 3);
    polygon(c, [[-126, 0], [-17, 13], [-53, 97], [-123, 47]], '#458f9f');
    polygon(c, [[-14, 13], [124, -2], [120, 47], [62, 112]], '#184e6d');
    polygon(c, [[-128, 0], [-110, -13], [-15, -8], [74, -15], [126, -3], [120, 14], [1, 18], [-124, 11]], '#d8efdf');
    polygon(c, [[-128, 0], [-110, -13], [-15, -8], [74, -15], [126, -3], [6, 5]], '#f3fae9');
    for (let j = 0; j < 5; j += 1) line(c, [[-95 + j * 42, 25], [-84 + j * 43, 48 + (j % 2) * 19]], '#72bac5', 2);
    const breathe = reduced ? .35 : .4 + .35 * Math.sin(time * 2.1 + i * 1.8);
    line(c, [[98, -3], [94, 7], [105, 19], [90, 41]], `rgba(4,38,59,${breathe + broken * .3})`, 2 + broken * 3);
    if (broken > 0) line(c, [[-48, 0], [-16, 12], [-29, 32], [4, 58]], INK, 4);
    c.restore();
  }
}

export function weather(c: CanvasRenderingContext2D, time: number, gale: number): void {
  for (let i = 0; i < 40; i += 1) {
    const x = ((noise(i + 30) * 1150 - time * (28 + gale * 150 + noise(i) * 38)) % 1150 + 1150) % 1150 - 90;
    const y = (noise(i + 68) * 570 + time * (8 + noise(i + 17) * 18)) % 570 - 15;
    ellipse(c, x, y, 1 + noise(i + 12) * (1.7 + gale), .8 + noise(i + 21), 'rgba(234,250,234,.6)', -.25);
    if (gale > .2 && i % 3 === 0) line(c, [[x, y], [x + gale * 42, y - gale * 7]], 'rgba(217,252,238,.22)', 2);
  }
}

export function impactSnow(c: CanvasRenderingContext2D, x: number, y: number, age: number, size = 1): void {
  if (age < 0 || age > 1.25) return;
  c.save(); c.globalAlpha = 1 - clamp(age / 1.25);
  for (let i = 0; i < 20; i += 1) {
    const a = Math.PI + i / 19 * Math.PI; const speed = (45 + noise(i + 305) * 120) * size;
    ellipse(c, x + Math.cos(a) * age * speed, y + Math.sin(a) * age * speed + age * age * 80, (4 + noise(i + 74) * 10 + age * 11) * size, (4 + age * 7) * size, WHITE);
  }
  c.restore();
}

export function avalanche(c: CanvasRenderingContext2D, age: number, reduced: boolean): void {
  if (reduced || age < .18 || age > 1.4) return;
  const t = age;
  const lead = 1030 - Math.max(0, t - .18) * 1830;
  c.save(); c.globalAlpha = 1 - clamp((t - 1.05) / .35);
  for (let i = 0; i < 18; i += 1) {
    const x = lead + i * 67;
    const y = 372 + Math.sin(i * 3.1) * 67;
    ellipse(c, x, y, 84 + noise(i) * 57, 87 + noise(i + 44) * 99, i % 2 ? '#d8f0e7' : '#eef8e8');
  }
  for (let i = 0; i < 26; i += 1) {
    const x = lead - 80 + noise(i + 6) * 420; const y = 190 + noise(i + 88) * 350;
    c.save(); c.translate(x, y); c.rotate(t * (i % 2 ? 3 : -4) + i);
    polygon(c, [[-9, -7], [13, -3], [6, 12], [-13, 7]], '#b6e2e2', 2); c.restore();
  }
  c.restore();
}

export function office(c: CanvasRenderingContext2D, age: number, reduced: boolean): void {
  const q = reduced ? 1 : clamp((age - .87) / .23);
  if (q <= 0) return;
  c.save(); c.translate(0, (1 - q) * 380);
  polygon(c, [[185, 468], [225, 293], [707, 289], [763, 473]], '#25505c', 4);
  box(c, 258, 301, 412, 141, '#35646b', 6, 4);
  for (let x = 268; x < 661; x += 35) line(c, [[x, 310], [x, 442]], '#497479', 2);
  box(c, 281, 345, 320, 102, '#294852', 3, 4);
  polygon(c, [[268, 424], [634, 423], [666, 457], [244, 457]], '#f0d8a5', 4);
  box(c, 268, 456, 14, 42, '#334a48', 1, 2); box(c, 623, 456, 14, 42, '#334a48', 1, 2);
  box(c, 570, 353, 82, 60, '#12313e', 5, 3); box(c, 579, 362, 64, 43, '#abcaa9', 2);
  words(c, 'INBOX', 611, 375, 12, INK, 61); words(c, '999+', 611, 393, 17, INK, 61);
  box(c, 603, 415, 14, 14, '#27444b', 1); box(c, 586, 429, 51, 5, '#27444b', 1);
  box(c, 279, 324, 109, 49, '#ecdfa9', 3, 3); words(c, 'WE MISSED', 334, 340, 13, INK, 100); words(c, 'YOUR LABOUR', 334, 357, 14, INK, 101);
  ellipse(c, 697, 317, 32, 32, '#ddedcf', 0, 4); line(c, [[697, 299], [697, 317], [713, 322]], INK, 3);
  words(c, 'COLONY INC.', 467, 280, 26, GOLD, 390, 'center', true);
  c.restore();
}

export function cloudSeat(c: CanvasRenderingContext2D, x: number, y: number, time: number, reduced: boolean): void {
  ellipse(c, x, y + 5, 150, 28, '#9ac6c6');
  for (let i = 0; i < 6; i += 1) ellipse(c, x - 112 + i * 43, y, 40, 27 + i % 2 * 9, WHITE);
  box(c, x - 40, y - 56, 102, 55, '#d67c6f', 10, 3); box(c, x - 64, y - 23, 125, 21, '#eeac87', 7, 3);
  line(c, [[x + 99, y], [x + 99, y - 140]], '#eecca6', 5);
  polygon(c, [[x + 14, y - 121], [x + 96, y - 180], [x + 189, y - 121]], '#ee8a73', 3);
  polygon(c, [[x + 96, y - 180], [x + 96, y - 119], [x + 47, y - 121]], '#f5c99a', 2);
  const bob = reduced ? 0 : Math.sin(time * 2) * 2;
  box(c, x + 110, y - 29 + bob, 17, 28, '#f4dfbb', 3, 2); line(c, [[x + 119, y - 30 + bob], [x + 131, y - 45 + bob]], JADE, 3);
}
