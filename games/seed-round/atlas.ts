/**
 * One 1024 × 512 texture drawn with Canvas 2D at start-up: eight meme faces
 * for the swimmers' heads (128 px cells, four across, two down, top left) and
 * the brand printed on the latex (the top right half).
 */

export const FACE = { wojak: 0, frog: 1, chad: 2, soy: 3, doge: 4, crying: 5, you: 6, smug: 7 } as const;
export const CROWD_FACES = [FACE.wojak, FACE.frog, FACE.chad, FACE.soy, FACE.doge, FACE.smug] as const;

const INK = '#1a0b12';

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look = 0): void {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + look * r * 0.45, y + r * 0.1, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
}

function drawFace(ctx: CanvasRenderingContext2D, kind: number): void {
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  const line = (points: number[]) => {
    ctx.beginPath();
    ctx.moveTo(points[0]!, points[1]!);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i]!, points[i + 1]!);
    ctx.stroke();
  };
  switch (kind) {
    case FACE.wojak:
      line([34, 44, 54, 38]); line([74, 38, 94, 44]);
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(46, 56, 6, 4, 0, 0, Math.PI * 2); ctx.ellipse(82, 56, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
      line([40, 50, 52, 49]); line([76, 49, 88, 50]);
      line([52, 88, 76, 88]);
      break;
    case FACE.frog:
      ctx.lineWidth = 4;
      eye(ctx, 44, 50, 16, 0.3); eye(ctx, 84, 50, 16, 0.3);
      ctx.fillStyle = '#e8506a';
      ctx.beginPath(); ctx.moveTo(30, 82); ctx.quadraticCurveTo(64, 104, 98, 82); ctx.quadraticCurveTo(64, 92, 30, 82); ctx.fill(); ctx.stroke();
      break;
    case FACE.chad:
      line([34, 48, 56, 44]); line([72, 44, 94, 48]);
      line([38, 58, 54, 57]); line([74, 57, 90, 58]);
      line([46, 86, 70, 88, 84, 82]);
      ctx.fillStyle = 'rgba(26,11,18,0.35)';
      for (let i = 0; i < 26; i += 1) { ctx.beginPath(); ctx.arc(34 + ((i * 37) % 60), 96 + ((i * 13) % 14), 1.6, 0, Math.PI * 2); ctx.fill(); }
      break;
    case FACE.soy:
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(44, 50, 15, 0, Math.PI * 2); ctx.moveTo(99, 50); ctx.arc(84, 50, 15, 0, Math.PI * 2); ctx.stroke();
      line([59, 50, 69, 50]);
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(44, 52, 4, 0, Math.PI * 2); ctx.arc(84, 52, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6b1a2c';
      ctx.beginPath(); ctx.ellipse(64, 90, 18, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      break;
    case FACE.doge:
      ctx.lineWidth = 4;
      eye(ctx, 46, 54, 11, 1); eye(ctx, 82, 54, 11, 1);
      ctx.fillStyle = 'rgba(255,120,150,0.55)';
      ctx.beginPath(); ctx.arc(34, 76, 9, 0, Math.PI * 2); ctx.arc(94, 76, 9, 0, Math.PI * 2); ctx.fill();
      line([52, 84, 64, 90, 76, 84]);
      break;
    case FACE.crying:
      line([36, 44, 54, 50]); line([74, 50, 92, 44]);
      line([38, 60, 46, 55, 54, 60]); line([74, 60, 82, 55, 90, 60]);
      ctx.strokeStyle = '#5ab8ff';
      line([44, 64, 42, 96]); line([84, 64, 86, 96]);
      ctx.strokeStyle = INK;
      ctx.fillStyle = '#6b1a2c';
      ctx.beginPath(); ctx.moveTo(48, 98); ctx.quadraticCurveTo(64, 76, 80, 98); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case FACE.you:
      ctx.lineWidth = 6;
      line([32, 38, 56, 50]); line([72, 50, 96, 38]);
      ctx.lineWidth = 4;
      eye(ctx, 46, 60, 10, 0); eye(ctx, 82, 60, 10, 0);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.rect(46, 82, 36, 14); ctx.fill(); ctx.stroke();
      line([58, 82, 58, 96]); line([70, 82, 70, 96]); line([46, 89, 82, 89]);
      break;
    default:
      line([36, 50, 54, 48]); line([74, 46, 92, 42]);
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(46, 58, 5, 3, 0, 0, Math.PI * 2); ctx.ellipse(82, 56, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(32, 76); ctx.quadraticCurveTo(64, 112, 100, 72); ctx.quadraticCurveTo(64, 88, 32, 76); ctx.fill(); ctx.stroke();
      break;
  }
}

function drawPrint(ctx: CanvasRenderingContext2D): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.font = '900 132px Impact, "Arial Black", sans-serif';
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText('SAFU', 256, 104);
  ctx.fillStyle = '#d4143c';
  ctx.fillText('SAFU', 256, 104);
  ctx.font = '900 40px Impact, "Arial Black", sans-serif';
  ctx.fillText('™', 420, 50);
  ctx.font = '900 30px Impact, "Arial Black", sans-serif';
  ctx.lineWidth = 6;
  ctx.strokeText('ULTRA THIN · FUNDS ARE SAFU', 256, 196);
  ctx.fillStyle = '#7a0b25';
  ctx.fillText('ULTRA THIN · FUNDS ARE SAFU', 256, 196);
}

export function createAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  for (let kind = 0; kind < 8; kind += 1) {
    ctx.save();
    ctx.translate((kind % 4) * 128, Math.floor(kind / 4) * 128);
    drawFace(ctx, kind);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(512, 0);
  drawPrint(ctx);
  ctx.restore();
  return canvas;
}
