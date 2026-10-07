import { box, clamp, ease, INK, leaf, line, noise, oval, shape, text } from './drawing';

let background: HTMLCanvasElement | null = null;

/** The fixed backyard is drawn once, independently of the moving actors and plants. */
export function backdrop(c: CanvasRenderingContext2D) {
  if (!background) {
    background = document.createElement('canvas'); background.width = 960; background.height = 540;
    paintBackdrop(background.getContext('2d')!);
  }
  c.drawImage(background, 0, 0);
}

function paintBackdrop(c: CanvasRenderingContext2D) {
  const sky = c.createLinearGradient(0, 0, 0, 450);
  sky.addColorStop(0, '#262442'); sky.addColorStop(0.43, '#76516d'); sky.addColorStop(0.83, '#efaf83'); sky.addColorStop(1, '#f8d89d');
  c.fillStyle = sky; c.fillRect(0, 0, 960, 540);
  oval(c, 776, 167, 55, 55, '#fce2a1');
  for (let i = 0; i < 26; i++) {
    const x = noise(i + 1) * 960; const y = 95 + noise(i + 22) * 140;
    c.globalAlpha = 0.7;
    oval(c, x, y, 1.3, 1.3, '#fff2bc');
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 13; i++) {
    const x = i * 91 - 34;
    shape(c, [[x, 335], [x + 16, 242 - noise(i) * 34], [x + 30, 235 - noise(i) * 34], [x + 38, 335]], '#463b56', 0);
    oval(c, x + 23, 254 - noise(i) * 34, 56, 48, '#48435e');
  }
  shape(c, [[-30, 272], [88, 177], [215, 269]], '#8c6573', 5);
  box(c, -20, 268, 212, 177, '#b78083', 0, 4);
  box(c, 23, 302, 79, 95, '#614e68', 4, 4);
  box(c, 33, 312, 59, 57, '#f3c280', 2, 3);
  line(c, [[62, 313], [62, 369]], '#614e68', 5); line(c, [[32, 341], [93, 341]], '#614e68', 5);
  box(c, 135, 319, 30, 90, '#724c60', 4); oval(c, 155, 366, 3, 3, '#f1d2a5');
  for (let i = 0; i < 28; i++) {
    const x = i * 36 - 10;
    shape(c, [[x, 433], [x, 321], [x + 16, 305], [x + 32, 321], [x + 32, 433]], i % 2 ? '#b97e67' : '#c38b6e', 2, '#674c55');
    line(c, [[x + 10, 333], [x + 8, 382]], '#a86e60', 1);
    oval(c, x + 16, 345, 2, 2, '#634a53');
  }
  line(c, [[0, 387], [960, 387]], '#775457', 12);
  c.fillStyle = '#326c61'; c.fillRect(0, 424, 960, 116);
  shape(c, [[0, 479], [960, 464], [960, 540], [0, 540]], '#c49b7b', 0);
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

export function plant(c: CanvasRenderingContext2D, x: number, ground: number, growth: number, time: number, seed: number, bustAge: number, reduced: boolean) {
  const height = 34 + growth * 208;
  const sway = reduced ? 0 : Math.sin(time * 1.6 + seed) * (0.015 + growth * 0.025);
  const wilt = bustAge < 0 ? 0 : ease((bustAge - 0.4) / 1.7) * (seed % 2 ? -0.26 : 0.3);
  c.save(); c.translate(x, ground); c.rotate(sway + wilt);
  oval(c, 0, 4, 49 + growth * 27, 9, '#152f3e44');
  line(c, [[0, 0], [-3, -height * 0.36], [5, -height * 0.7], [0, -height]], '#193c37', 9);
  line(c, [[0, 0], [-3, -height * 0.36], [5, -height * 0.7], [0, -height]], '#87bb68', 4);
  const tiers = 2 + Math.floor(growth * 4);
  for (let i = 0; i < tiers; i++) {
    const t = (i + 1) / (tiers + 0.5); const y = -height * t;
    const size = (24 + growth * 52) * (1 - t * 0.34);
    for (const side of [-1, 1]) {
      const end = side * size * 0.7;
      line(c, [[0, y + 13], [end, y - 6]], '#305d40', 3.5);
      leaf(c, end, y - 6, size, side * (0.65 + t * 0.4), i % 2 ? '#69b55b' : '#8ecf5e');
    }
    if (growth > 0.5 && i > 0) {
      for (let j = 0; j < 7; j++) {
        const bx = Math.sin(j * 2.4 + seed) * 9; const by = y - j * 3;
        oval(c, bx, by, 7, 10, j % 2 ? '#c9d676' : '#a6c16a', 1);
        line(c, [[bx - 2, by], [bx + 2, by - 5]], '#dcb189', 1.2);
      }
    }
  }
  leaf(c, 0, -height + 4, 29 + growth * 38, 0, '#b4dc67');
  c.restore();
}

export function beds(c: CanvasRenderingContext2D) {
  for (let i = 0; i < 3; i++) {
    const x = 354 + i * 151;
    shape(c, [[x - 4, 449], [x + 135, 449], [x + 116, 486], [x + 10, 486]], '#996045', 4);
    box(c, x, 449, 131, 13, '#d39b64', 3, 3);
    line(c, [[x + 16, 470], [x + 112, 470]], '#76463f', 2);
    for (const dx of [17, 108]) oval(c, x + dx, 477, 2, 2, '#ead69d');
  }
  c.save(); c.translate(547, 473); c.rotate(-0.045);
  box(c, -53, -11, 106, 22, '#f5dfae', 3, 2); text(c, 'JUST TOMATOES', 0, 5, 10, '#fff4d3', 'center'); c.restore();
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
  if (age < 0 || age > 2.6 || reduced) return;
  for (let i = 0; i < 21; i++) {
    const t = clamp((age - 0.15) / 2.1);
    const x = 530 + (noise(i + 60) - 0.5) * 340 + (noise(i + 90) - 0.5) * 290 * t;
    const y = 345 - (50 + noise(i + 45) * 150) * Math.sin(t * Math.PI) + 130 * t;
    c.globalAlpha = 1 - ease((t - 0.65) / 0.35);
    leaf(c, x, y, 12 + noise(i) * 10, i + age * (i % 2 ? 3 : -3), '#9ecf6a');
  }
  c.globalAlpha = 1;
}
