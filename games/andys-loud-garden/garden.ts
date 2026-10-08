import { box, clamp, ease, INK, leaf, line, noise, oval, shape, text } from './drawing';

let background: HTMLCanvasElement | null = null;
/** The neighbour's upstairs window, over the fence. */
export const WINDOW = { x: 632, y: 256, w: 44, h: 34 };

/** The fixed backyard is drawn once, independently of the moving actors and plants. It overhangs the frame so a long round can pull the camera back. */
export function backdrop(c: CanvasRenderingContext2D) {
  if (!background) {
    background = document.createElement('canvas'); background.width = 1160; background.height = 650;
    const b = background.getContext('2d')!; b.translate(100, 110); paintBackdrop(b);
  }
  c.drawImage(background, -100, -110);
}

function paintBackdrop(c: CanvasRenderingContext2D) {
  const sky = c.createLinearGradient(0, 0, 0, 450);
  sky.addColorStop(0, '#262442'); sky.addColorStop(0.43, '#76516d'); sky.addColorStop(0.83, '#efaf83'); sky.addColorStop(1, '#f8d89d');
  c.fillStyle = sky; c.fillRect(-100, -110, 1160, 650);
  oval(c, 776, 167, 55, 55, '#fce2a1');
  for (let i = 0; i < 26; i++) {
    const x = noise(i + 1) * 960; const y = 95 + noise(i + 22) * 140;
    c.globalAlpha = 0.7;
    oval(c, x, y, 1.3, 1.3, '#fff2bc');
  }
  c.globalAlpha = 1;
  for (let i = -1; i < 13; i++) {
    const x = i * 91 - 34;
    shape(c, [[x, 335], [x + 16, 242 - noise(i) * 34], [x + 30, 235 - noise(i) * 34], [x + 38, 335]], '#463b56', 0);
    oval(c, x + 23, 254 - noise(i) * 34, 56, 48, '#48435e');
  }
  // The neighbour's house over the fence, with the upstairs window that will light up.
  box(c, 590, 226, 126, 110, '#5d4866', 0, 3); shape(c, [[578, 230], [653, 184], [728, 230]], '#3e3250', 4);
  box(c, WINDOW.x - 4, WINDOW.y - 4, WINDOW.w + 8, WINDOW.h + 8, '#493a55', 3, 3); box(c, WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h, '#2b2540', 2, 2);
  box(c, -100, 292, 96, 153, '#a37078', 0, 4); line(c, [[-104, 292], [-2, 292]], '#7b5563', 7);
  shape(c, [[-30, 272], [88, 177], [215, 269]], '#8c6573', 5);
  box(c, -20, 268, 212, 177, '#b78083', 0, 4);
  box(c, 23, 302, 79, 95, '#614e68', 4, 4);
  box(c, 33, 312, 59, 57, '#f3c280', 2, 3);
  line(c, [[62, 313], [62, 369]], '#614e68', 5); line(c, [[32, 341], [93, 341]], '#614e68', 5);
  box(c, 135, 319, 30, 90, '#724c60', 4); oval(c, 155, 366, 3, 3, '#f1d2a5');
  for (let i = -3; i < 31; i++) {
    const x = i * 36 - 10;
    shape(c, [[x, 433], [x, 321], [x + 16, 305], [x + 32, 321], [x + 32, 433]], i % 2 ? '#b97e67' : '#c38b6e', 2, '#674c55');
    line(c, [[x + 10, 333], [x + 8, 382]], '#a86e60', 1);
    oval(c, x + 16, 345, 2, 2, '#634a53');
  }
  line(c, [[-100, 387], [1060, 387]], '#775457', 12);
  c.fillStyle = '#326c61'; c.fillRect(-100, 424, 1160, 116);
  shape(c, [[-100, 481], [1060, 462], [1060, 540], [-100, 540]], '#c49b7b', 0);
  for (let i = 0; i < 90; i++) oval(c, noise(i + 300) * 960, 484 + noise(i + 330) * 54, 1 + noise(i) * 3, 1, '#a77868');
  c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(164, 215); c.quadraticCurveTo(523, 280, 912, 215); c.stroke();
  for (let i = 0; i < 13; i++) {
    const t = i / 12; const x = 164 + t * 748; const y = 215 + Math.sin(t * Math.PI) * 33;
    line(c, [[x, y], [x, y + 10]], INK, 3);
    const glow = c.createRadialGradient(x, y + 13, 1, x, y + 13, 16);
    glow.addColorStop(0, '#ffeebc65'); glow.addColorStop(1, '#ffeebc00');
    c.fillStyle = glow; c.fillRect(x - 18, y - 5, 36, 36); oval(c, x, y + 13, 4, 6, '#ffe0a0');
  }
  box(c, 812, 383, 115, 47, '#f4d99a', 4, 3);
  text(c, 'PRIVATE', 869, 403, 14, '#fff2c1', 'center'); text(c, 'GARDEN', 869, 420, 16, '#fff2c1', 'center');
  for (let i = 0; i < 18; i++) {
    const x = i < 9 ? i * 17 : 827 + (i - 9) * 18;
    leaf(c, x, 461 + noise(i) * 6, 26 + noise(i + 2) * 15, Math.sin(i) * 0.5, '#56885c');
  }
}

/** `extra` keeps a long round's jungle climbing past the fence; `raid` is the time since the raid began (negative before). */
export function plant(c: CanvasRenderingContext2D, x: number, ground: number, growth: number, time: number, seed: number, raid: number, reduced: boolean, extra = 0) {
  const height = 34 + growth * 208 + extra;
  const sway = reduced ? 0 : Math.sin(time * 1.6 + seed) * (0.015 + growth * 0.025);
  const wilt = raid < 0 ? 0 : ease((raid - 0.3) / 1.2) * (seed % 2 ? -0.26 : 0.3);
  c.save(); c.translate(x, ground); c.rotate(sway + wilt);
  oval(c, 0, 4, 49 + growth * 27, 9, '#152f3e44');
  line(c, [[0, 0], [-3, -height * 0.36], [5, -height * 0.7], [0, -height]], '#193c37', 9);
  line(c, [[0, 0], [-3, -height * 0.36], [5, -height * 0.7], [0, -height]], '#87bb68', 4);
  const tiers = 2 + Math.floor(growth * 4) + Math.floor(extra / 50);
  for (let i = 0; i < tiers; i++) {
    const t = (i + 1) / (tiers + 0.5); const y = -height * t;
    const size = (24 + growth * 52) * (1 - t * 0.34);
    for (const side of [-1, 1]) {
      const end = side * size * 0.7;
      line(c, [[0, y + 13], [end, y - 6]], '#305d40', 3.5);
      leaf(c, end, y - 6, size, side * (0.65 + t * 0.4), i % 2 ? '#69b55b' : '#8ecf5e');
    }
    // The buds bloom into $ANDY: a little run of green candles on every tier, only ever going up.
    const bloom = i > 0 ? clamp((growth - 0.49) / 0.1) : 0;
    for (let j = 0; bloom > 0 && j < 4; j++) {
      const bx = -13 + j * 8.5; const by = y + 5 - j * 7; const h = (9 + noise(seed * 7 + i * 4 + j) * 8) * bloom;
      line(c, [[bx, by - h / 2 - 5 * bloom], [bx, by + h / 2 + 4 * bloom]], '#1f4a2c', 1.8);
      box(c, bx - 3.5, by - h / 2, 7, h, j % 2 ? '#8fe36e' : '#5fcf62', 1.5, 1.4);
    }
  }
  leaf(c, 0, -height + 4, 29 + growth * 38, 0, '#b4dc67');
  c.restore();
}

/** `plot` tags the player's own bed; a spectator's garden has no tag. */
export function beds(c: CanvasRenderingContext2D, plot: string | null) {
  for (let i = 0; i < 3; i++) {
    const x = 354 + i * 151;
    shape(c, [[x - 4, 449], [x + 135, 449], [x + 116, 486], [x + 10, 486]], '#996045', 4);
    box(c, x, 449, 131, 13, '#d39b64', 3, 3);
    line(c, [[x + 16, 470], [x + 112, 470]], '#76463f', 2);
    for (const dx of [17, 108]) oval(c, x + dx, 477, 2, 2, '#ead69d');
  }
  c.save(); c.translate(547, 473); c.rotate(-0.045);
  box(c, -58, -11, 116, 22, '#f5dfae', 3, 2); text(c, 'NOT A SECURITY', 0, 5, 10, '#fff4d3', 'center', 104); c.restore();
  if (plot) { c.save(); c.translate(404, 474); c.rotate(0.04); box(c, -38, -10, 76, 20, '#c6ec9a', 3, 2); text(c, plot, 0, 4, 9, '#fbffe9', 'center', 68); c.restore(); }
}

/** The neighbour's window lights up, then she appears in it with a phone at her ear. */
export function neighbour(c: CanvasRenderingContext2D, lit: number, caller: number, time: number) {
  if (lit <= 0) return;
  const { x, y, w, h } = WINDOW;
  c.save();
  const glow = c.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, 70);
  glow.addColorStop(0, '#ffd88a55'); glow.addColorStop(1, '#ffd88a00');
  c.globalAlpha = lit; c.fillStyle = glow; c.fillRect(x - 60, y - 60, w + 120, h + 120);
  box(c, x, y, w, h, '#ffd98c', 2, 2);
  c.beginPath(); c.roundRect(x, y, w, h, 2); c.clip();
  if (caller > 0) {
    c.globalAlpha = lit * caller;
    const sy = y + 8 + (1 - caller) * 14 + Math.sin(time * 1.3) * 0.8;
    shape(c, [[x + 10, y + h], [x + 13, sy + 15], [x + 33, sy + 15], [x + 36, y + h]], '#3f2c45', 0);
    oval(c, x + 23, sy + 6, 8, 9, '#3f2c45'); oval(c, x + 25, sy - 1, 9, 5, '#3f2c45');
    oval(c, x + 32, sy + 5, 7, 7, '#d8fbff66'); box(c, x + 29, sy, 5, 11, '#d8fbff', 1, 1);
  }
  c.globalAlpha = lit; shape(c, [[x, y], [x + 12, y], [x + 8, y + h], [x, y + h]], '#d0717a', 0);
  line(c, [[x + w / 2 + 6, y], [x + w / 2 + 6, y + h]], '#493a55', 3); line(c, [[x, y + h / 2], [x + w, y + h / 2]], '#493a55', 3);
  c.restore();
}

/** A small, bounded moth patrol visits the full-grown beds throughout a long round. */
export function pollinators(c: CanvasRenderingContext2D, time: number) {
  for (let i = 0; i < 4; i++) {
    const phase = time * 0.32 + i * Math.PI / 2;
    const x = 570 + Math.sin(phase) * (125 + i * 18);
    const y = 270 + Math.cos(phase * 1.5 + i) * 55;
    const wing = 2 + 5 * Math.abs(Math.sin(time * 15 + i));
    c.save(); c.translate(x, y); c.rotate(Math.sin(phase) * 0.35);
    oval(c, -4, -2, wing, 4, '#f6d894', 1);
    oval(c, 4, -2, wing, 4, '#ecd2f4', 1);
    oval(c, 0, 0, 2, 5, '#554353');
    c.restore();
  }
}

export function flyingLeaves(c: CanvasRenderingContext2D, age: number, reduced: boolean) {
  if (age < 0 || age > 1.7 || reduced) return;
  for (let i = 0; i < 21; i++) {
    const t = clamp((age - 0.05) / 1.6);
    const x = 530 + (noise(i + 60) - 0.5) * 340 + (noise(i + 90) - 0.5) * 290 * t;
    const y = 345 - (50 + noise(i + 45) * 150) * Math.sin(t * Math.PI) + 130 * t;
    c.globalAlpha = 1 - ease((t - 0.65) / 0.35);
    leaf(c, x, y, 12 + noise(i) * 10, i + age * (i % 2 ? 3 : -3), '#9ecf6a');
  }
  c.globalAlpha = 1;
}
