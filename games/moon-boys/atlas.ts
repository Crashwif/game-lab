/**
 * One 2048 × 1024 texture drawn with Canvas 2D at start-up, in 256 px cells
 * (eight across, four down). Eight faces for the visors, the moon and the
 * flat earth as painted props (512 px each), the back of the moon, two
 * mouths for the moon's face, and the prints: the rocket's stickers, the
 * WAGMI flag, the clapperboard, the STAGE 69 sign, the SEC badge, the
 * director's chair, the exit sign and the dog house.
 */

export const COLS = 8;
export const ROWS = 4;
export const CELL = 256;

export const FACE = { pepe: 0, wojak: 1, doge: 2, chad: 3, soy: 4, crying: 5, you: 6, lizard: 7 } as const;
export const CROWD_FACES = [FACE.pepe, FACE.wojak, FACE.doge, FACE.chad, FACE.soy, FACE.wojak, FACE.pepe] as const;
/** Print codes: a code above 100 spans two cells each way (512 px). */
export const PRINT = { moon: 108, earth: 110, butt: 112, smile: 14, gawp: 15, sticker: 22, hopium: 23, flag: 24, clapper: 25, sign: 26, sec: 27, dev: 28, exit: 29, copium: 30, doge: 31 } as const;

const INK = '#141018';
const MEME = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';

type Ctx = CanvasRenderingContext2D;

function line(ctx: Ctx, points: number[], width = 6, colour = INK): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i]!, points[i + 1]!);
  ctx.stroke();
}

function curve(ctx: Ctx, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, width = 6, colour = INK): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
}

function eye(ctx: Ctx, x: number, y: number, rx: number, ry: number, look = 0, pupil = 0.4): void {
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + look * rx * 0.4, y + ry * 0.1, rx * pupil, 0, Math.PI * 2);
  ctx.fill();
}

function fill(ctx: Ctx, colour: string, size: number): void {
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, size, size);
}

/** A face in a 256 px cell, opaque: the visor's colour is the face's own. */
function drawFace(ctx: Ctx, kind: number): void {
  switch (kind) {
    case FACE.pepe:
      fill(ctx, '#4f9a43', CELL);
      eye(ctx, 92, 118, 32, 22, 0.35, 0.32);
      eye(ctx, 168, 118, 32, 22, 0.35, 0.32);
      // heavy lids
      ctx.fillStyle = '#4f9a43';
      ctx.beginPath(); ctx.ellipse(92, 104, 34, 14, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(168, 104, 34, 14, 0, Math.PI, 0); ctx.fill();
      line(ctx, [60, 104, 124, 104], 4); line(ctx, [136, 104, 200, 104], 4);
      ctx.fillStyle = '#8c3846';
      ctx.beginPath(); ctx.moveTo(52, 174); ctx.quadraticCurveTo(128, 214, 204, 174); ctx.quadraticCurveTo(128, 190, 52, 174); ctx.fill();
      curve(ctx, 52, 174, 128, 214, 204, 174, 5);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(118, 150, 4, 0, Math.PI * 2); ctx.arc(138, 150, 4, 0, Math.PI * 2); ctx.fill();
      break;
    case FACE.wojak:
      fill(ctx, '#efe0cf', CELL);
      line(ctx, [72, 100, 108, 110], 5); line(ctx, [148, 110, 184, 100], 5);
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(96, 124, 7, 5, 0, 0, Math.PI * 2); ctx.ellipse(160, 124, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
      curve(ctx, 128, 130, 138, 150, 124, 160, 4);
      curve(ctx, 100, 184, 128, 172, 156, 184, 5);
      break;
    case FACE.doge:
      fill(ctx, '#e2b96b', CELL);
      eye(ctx, 94, 118, 17, 17, 1, 0.45);
      eye(ctx, 162, 118, 17, 17, 1, 0.45);
      ctx.fillStyle = 'rgba(255,120,150,0.5)';
      ctx.beginPath(); ctx.arc(66, 156, 12, 0, Math.PI * 2); ctx.arc(190, 156, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(128, 154, 13, 9, 0, 0, Math.PI * 2); ctx.fill();
      curve(ctx, 104, 180, 128, 196, 152, 180, 5);
      ctx.fillStyle = '#c7995a'; ctx.beginPath(); ctx.moveTo(34, 40); ctx.lineTo(70, 30); ctx.lineTo(72, 80); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(222, 40); ctx.lineTo(186, 30); ctx.lineTo(184, 80); ctx.closePath(); ctx.fill();
      break;
    case FACE.chad:
      fill(ctx, '#f0d9bf', CELL);
      line(ctx, [66, 96, 112, 102], 9); line(ctx, [144, 102, 190, 96], 9);
      line(ctx, [80, 118, 112, 118], 6); line(ctx, [144, 118, 176, 118], 6);
      line(ctx, [96, 178, 160, 178], 6);
      line(ctx, [70, 140, 92, 206, 164, 206, 186, 140], 5);
      ctx.fillStyle = 'rgba(20,16,24,0.3)';
      for (let i = 0; i < 40; i += 1) { ctx.beginPath(); ctx.arc(84 + ((i * 37) % 90), 186 + ((i * 13) % 18), 1.8, 0, Math.PI * 2); ctx.fill(); }
      break;
    case FACE.soy:
      fill(ctx, '#efe0cf', CELL);
      ctx.strokeStyle = INK; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(94, 120, 22, 0, Math.PI * 2); ctx.moveTo(184, 120); ctx.arc(162, 120, 22, 0, Math.PI * 2); ctx.stroke();
      line(ctx, [116, 120, 140, 120], 4);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(94, 122, 5, 0, Math.PI * 2); ctx.arc(162, 122, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a1e1e'; ctx.beginPath(); ctx.ellipse(128, 180, 28, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(108, 158, 40, 12);
      ctx.fillStyle = 'rgba(20,16,24,0.35)';
      for (let i = 0; i < 46; i += 1) { ctx.beginPath(); ctx.arc(60 + ((i * 41) % 140), 196 + ((i * 17) % 34), 2.2, 0, Math.PI * 2); ctx.fill(); }
      break;
    case FACE.crying:
      fill(ctx, '#efe0cf', CELL);
      line(ctx, [68, 96, 108, 114], 6); line(ctx, [148, 114, 188, 96], 6);
      curve(ctx, 78, 130, 96, 118, 114, 130, 5); curve(ctx, 142, 130, 160, 118, 178, 130, 5);
      line(ctx, [92, 136, 88, 250], 10, '#5ab8ff'); line(ctx, [164, 136, 168, 250], 10, '#5ab8ff');
      ctx.fillStyle = '#5a1e26';
      ctx.beginPath(); ctx.moveTo(86, 168); ctx.quadraticCurveTo(128, 160, 170, 168); ctx.quadraticCurveTo(160, 222, 128, 224); ctx.quadraticCurveTo(96, 222, 86, 168); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
      break;
    case FACE.you:
      fill(ctx, '#c9f76b', CELL);
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.roundRect(62, 102, 56, 34, 10); ctx.roundRect(138, 102, 56, 34, 10); ctx.fill();
      line(ctx, [118, 112, 138, 112], 6); line(ctx, [40, 108, 62, 112], 6); line(ctx, [194, 112, 216, 108], 6);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(70, 108, 14, 6); ctx.fillRect(146, 108, 14, 6);
      curve(ctx, 96, 178, 130, 200, 166, 170, 6);
      break;
    default:
      fill(ctx, '#3f9a3a', CELL);
      ctx.strokeStyle = '#2b7529'; ctx.lineWidth = 3;
      for (let row = 0; row < 9; row += 1) for (let col = 0; col < 9; col += 1) {
        ctx.beginPath(); ctx.arc(col * 32 + (row % 2 ? 16 : 0), row * 32, 16, 0, Math.PI); ctx.stroke();
      }
      ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(92, 116, 26, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(164, 116, 26, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.fillRect(89, 102, 6, 28); ctx.fillRect(161, 102, 6, 28);
      curve(ctx, 66, 174, 128, 186, 190, 174, 5);
      line(ctx, [128, 182, 128, 208], 5, '#e0323c'); line(ctx, [128, 208, 118, 222], 4, '#e0323c'); line(ctx, [128, 208, 138, 222], 4, '#e0323c');
      break;
  }
}

/** A seeded generator so the craters and continents draw the same every time. */
function generator(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The moon, 512 px: a painted prop with its shading painted on, craters, and its prop number. */
function drawMoon(ctx: Ctx, size: number): void {
  const c = size / 2;
  const g = ctx.createRadialGradient(c * 0.7, c * 0.7, c * 0.1, c, c, c);
  g.addColorStop(0, '#f2f0ea');
  g.addColorStop(0.7, '#cfccc5');
  g.addColorStop(1, '#8f8b86');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
  const random = generator(69);
  for (let i = 0; i < 18; i += 1) {
    const a = random() * Math.PI * 2;
    const d = Math.sqrt(random()) * c * 0.8;
    const x = c + Math.cos(a) * d;
    const y = c + Math.sin(a) * d;
    const r = 10 + random() * 30;
    ctx.fillStyle = '#a19d97';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e9e6df'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.strokeStyle = '#7b7772';
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
  }
  // A painted terminator: the shadow side, brushed on.
  ctx.fillStyle = 'rgba(40,36,48,0.28)';
  ctx.beginPath(); ctx.arc(c, c, c, -Math.PI * 0.42, Math.PI * 0.42); ctx.quadraticCurveTo(c * 1.25, c, c + Math.cos(-Math.PI * 0.42) * c, c + Math.sin(-Math.PI * 0.42) * c); ctx.fill();
  ctx.font = `900 22px ${MEME}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(60,56,64,0.85)';
  ctx.fillText('PROP #69 · DO NOT LEAN', c, size * 0.9);
}

/** The flat earth, 512 px: a painted disc with continents, clouds and the ice wall round the rim. */
function drawEarth(ctx: Ctx, size: number): void {
  const c = size / 2;
  ctx.fillStyle = '#2c6bd6';
  ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
  const blob = (points: number[], colour: string) => {
    ctx.fillStyle = colour;
    ctx.strokeStyle = '#2f6b2a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(points[0]! * size, points[1]! * size);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i]! * size, points[i + 1]! * size);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  blob([0.2, 0.28, 0.3, 0.22, 0.4, 0.3, 0.36, 0.42, 0.3, 0.5, 0.36, 0.6, 0.32, 0.72, 0.26, 0.64, 0.24, 0.52, 0.18, 0.42], '#5a9e45');
  blob([0.5, 0.24, 0.62, 0.2, 0.78, 0.26, 0.82, 0.38, 0.72, 0.46, 0.64, 0.42, 0.56, 0.36, 0.48, 0.34], '#5a9e45');
  blob([0.56, 0.5, 0.66, 0.5, 0.7, 0.62, 0.64, 0.72, 0.56, 0.66, 0.52, 0.56], '#c9a85a');
  blob([0.72, 0.62, 0.8, 0.6, 0.82, 0.68, 0.76, 0.72], '#c9a85a');
  const random = generator(420);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 26; i += 1) {
    const a = random() * Math.PI * 2;
    const d = Math.sqrt(random()) * c * 0.8;
    ctx.beginPath(); ctx.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, 12 + random() * 26, 6 + random() * 10, random() * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#f4f8ff';
  ctx.lineWidth = size * 0.07;
  ctx.beginPath(); ctx.arc(c, c, c * 0.955, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#c8dcf5';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(c, c, c * 0.92, 0, Math.PI * 2); ctx.stroke();
  ctx.font = `900 20px ${MEME}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#12305e';
  ctx.fillText('ICE WALL', c, size * 0.955);
  ctx.fillStyle = '#e0323c';
  ctx.beginPath(); ctx.arc(c, c, 7, 0, Math.PI * 2); ctx.fill();
}

/** The back of the moon prop, 512 px. Two cheeks. */
function drawButt(ctx: Ctx, size: number): void {
  const c = size / 2;
  ctx.fillStyle = '#f0c4a3';
  ctx.fillRect(0, 0, size, size);
  for (const x of [c - c * 0.3, c + c * 0.3]) {
    const g = ctx.createRadialGradient(x - 40, c - 60, 10, x, c, c * 0.58);
    g.addColorStop(0, '#fbe0c8');
    g.addColorStop(1, '#d09070');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#8f5a44';
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.arc(x, c, c * 0.56, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  curve(ctx, c, c * 0.5, c * 1.03, c, c, c * 1.56, 20, '#8f5a44');
  ctx.fillStyle = '#8f5a44';
  ctx.beginPath(); ctx.arc(c + c * 0.4, c - c * 0.22, 8, 0, Math.PI * 2); ctx.fill();
  ctx.font = `900 34px ${MEME}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(120,70,50,0.7)';
  ctx.fillText('THIS SIDE DOWN', c, size * 0.93);
}

/** Draws inside a cell (or a 2 × 2 block), squashed to a quad's aspect: `fn` draws in a box `aspect` times wider than tall. */
function print(ctx: Ctx, code: number, aspect: number, fn: (w: number, h: number) => void): void {
  const span = Math.floor(code / 100) + 1;
  const cell = code % 100;
  const size = CELL * span;
  ctx.save();
  ctx.translate((cell % COLS) * CELL, Math.floor(cell / COLS) * CELL);
  ctx.beginPath();
  ctx.rect(0, 0, size, size);
  ctx.clip();
  ctx.scale(1 / aspect, 1);
  fn(size * aspect, size);
  ctx.restore();
}

function text(ctx: Ctx, str: string, x: number, y: number, px: number, colour: string, stroke?: string): void {
  ctx.font = `900 ${px}px ${MEME}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (stroke) {
    ctx.lineWidth = px * 0.12;
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = colour;
  ctx.fillText(str, x, y);
}

export function createAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * CELL;
  canvas.height = ROWS * CELL;
  const ctx = canvas.getContext('2d')!;
  for (let kind = 0; kind < 8; kind += 1) {
    ctx.save();
    ctx.translate(kind * CELL, 0);
    ctx.beginPath();
    ctx.rect(0, 0, CELL, CELL);
    ctx.clip();
    drawFace(ctx, kind);
    ctx.restore();
  }
  print(ctx, PRINT.moon, 1, (w) => drawMoon(ctx, w));
  print(ctx, PRINT.earth, 1, (w) => drawEarth(ctx, w));
  print(ctx, PRINT.butt, 1, (w) => drawButt(ctx, w));
  // The moon's mouths, cut out: the quad shows only the drawn part.
  print(ctx, PRINT.smile, 2, (w, h) => {
    curve(ctx, w * 0.1, h * 0.35, w * 0.5, h * 0.95, w * 0.9, h * 0.35, 30, '#3a2a3a');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w * 0.44, h * 0.55, w * 0.12, h * 0.2);
  });
  print(ctx, PRINT.gawp, 2, (w, h) => {
    ctx.fillStyle = '#3a2a3a';
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.2, h * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8b2a2a';
    ctx.beginPath(); ctx.ellipse(w / 2, h * 0.56, w * 0.13, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w * 0.4, h * 0.14, w * 0.2, h * 0.12);
  });
  print(ctx, PRINT.sticker, 1, (w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.roundRect(0, 0, w, h, 30); ctx.fill();
    ctx.strokeStyle = '#d3202a'; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.roundRect(10, 10, w - 20, h - 20, 26); ctx.stroke();
    text(ctx, '$MOON', w / 2, h * 0.36, 88, '#d3202a');
    text(ctx, 'BOYS', w / 2, h * 0.7, 88, INK);
  });
  const tank = (code: number, bg: string, name: string, sub: string) => print(ctx, code, 1.6, (w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = INK;
    for (let i = -2; i < 12; i += 1) {
      ctx.beginPath(); ctx.moveTo(i * 60, 0); ctx.lineTo(i * 60 + 30, 0); ctx.lineTo(i * 60 + 60, 34); ctx.lineTo(i * 60 + 30, 34); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(i * 60, h - 34); ctx.lineTo(i * 60 + 30, h - 34); ctx.lineTo(i * 60 + 60, h); ctx.lineTo(i * 60 + 30, h); ctx.closePath(); ctx.fill();
    }
    text(ctx, name, w / 2, h * 0.46, 96, INK);
    text(ctx, sub, w / 2, h * 0.72, 30, INK);
  });
  tank(PRINT.hopium, '#f4c531', 'HOPIUM', 'PRESSURISED DELUSION');
  tank(PRINT.copium, '#5b8fe0', 'COPIUM', 'STRAP-ON BOOSTER');
  print(ctx, PRINT.flag, 1.5, (w, h) => {
    ctx.fillStyle = '#2eaa5e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    text(ctx, 'WAGMI', w / 2, h * 0.5, 110, '#ffffff');
  });
  print(ctx, PRINT.clapper, 1.3, (w, h) => {
    ctx.fillStyle = '#111114';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f4f4f4';
    for (let i = -1; i < 8; i += 1) { ctx.beginPath(); ctx.moveTo(i * 60, 0); ctx.lineTo(i * 60 + 30, 0); ctx.lineTo(i * 60 + 62, 52); ctx.lineTo(i * 60 + 32, 52); ctx.closePath(); ctx.fill(); }
    text(ctx, 'MOON LANDING', w / 2, h * 0.36, 40, '#ffffff');
    text(ctx, 'SCENE 1 · TAKE 69', w / 2, h * 0.56, 30, '#ffffff');
    text(ctx, 'DIR: DEV · CAM: MOM', w / 2, h * 0.74, 26, '#ffffff');
    text(ctx, 'BUDGET: YOUR BAG', w / 2, h * 0.9, 24, '#ffd24a');
  });
  print(ctx, PRINT.sign, 2.4, (w, h) => {
    ctx.fillStyle = '#f7f7f4';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = INK; ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    text(ctx, 'STAGE 69', w / 2, h * 0.5, 150, INK);
  });
  print(ctx, PRINT.sec, 1, (w, h) => {
    ctx.fillStyle = '#12305e';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.42, 0, Math.PI * 2); ctx.stroke();
    text(ctx, 'SEC', w / 2, h * 0.5, 104, '#ffffff');
  });
  print(ctx, PRINT.dev, 1.3, (w, h) => {
    ctx.fillStyle = '#111114';
    ctx.fillRect(0, 0, w, h);
    text(ctx, 'DEV', w / 2, h * 0.42, 120, '#ffffff');
    text(ctx, '(DIRECTOR)', w / 2, h * 0.74, 34, '#c9c9d0');
  });
  print(ctx, PRINT.exit, 2.2, (w, h) => {
    ctx.fillStyle = '#1c9a4a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 12;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    text(ctx, 'EXIT', w / 2, h * 0.5, 150, '#ffffff');
  });
  print(ctx, PRINT.doge, 1.6, (w, h) => {
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#6a4220'; ctx.lineWidth = 6;
    for (let y = 60; y < h; y += 64) line(ctx, [0, y, w, y], 6, '#6a4220');
    text(ctx, 'DOGE', w / 2, h * 0.5, 120, '#f3e2b0', '#4a2c14');
  });
  return canvas;
}
