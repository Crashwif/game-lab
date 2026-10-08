import { box, CREAM, GOLD, GREEN, INK, RED, text } from './art';
import type { SceneView } from './scene';

export interface Framing { x: number; y: number; opponentX: number; opponentY: number; caption: string; encounter: string }
export const isPortrait = (canvas: HTMLCanvasElement): boolean =>
  canvas.clientWidth > 0 && (canvas.clientHeight > canvas.clientWidth || typeof matchMedia === 'function' && matchMedia('(max-width:600px)').matches);

/** A tall acting frame keeps the bull large and gives the current antagonist a separate close-up. */
export function presentPortrait(c: CanvasRenderingContext2D, surface: HTMLCanvasElement, view: SceneView, frame: Framing): void {
  c.save(); c.setTransform(c.canvas.width / 540, 0, 0, c.canvas.height / 820, 0, 0);
  c.fillStyle = INK; c.fillRect(0, 0, 540, 820);
  text(c, 'MUMU BULL RUN', 20, 28, 28, GREEN);
  text(c, view.phase === 'crashed' ? 'ROUND CRASHED' : view.phase === 'running' ? 'LIVE FROM THE SHITSHOW' : 'HORNS UP. EGO OUT.', 20, 61, 14, CREAM);
  text(c, `${(view.currentX100 / 100).toFixed(2)}×`, 521, 102, 53, view.phase === 'crashed' ? RED : CREAM, 'right', 500);
  if (view.cashoutX100 !== null) text(c, `CASHED OUT ${(view.cashoutX100 / 100).toFixed(2)}×`, 20, 135, 21, GREEN, 'left', 500);
  else text(c, frame.encounter, 20, 138, 24, GOLD, 'left', 500);
  const cropX = Math.max(0, Math.min(410, frame.x - 223));
  const cropY = Math.max(85, Math.min(125, frame.y - 325));
  c.drawImage(surface, cropX, cropY, 550, 410, 0, 159, 540, 403);
  c.fillStyle = '#0b251a'; c.fillRect(0, 563, 540, 257);
  const detailX = Math.max(0, Math.min(640, frame.opponentX - 160));
  const detailY = Math.max(100, Math.min(180, frame.opponentY - 255));
  c.drawImage(surface, detailX, detailY, 320, 300, 348, 577, 181, 170);
  box(c, 18, 582, 311, 28, GREEN, 3, 0);
  text(c, view.cashoutX100 !== null ? 'EXIT CONFIRMED' : view.phase === 'crashed' ? 'WELCOME TO SUPPORT' : 'THE CURRENT DISASTER', 174, 596, 15, INK, 'center', 295);
  const words = frame.caption.split(' ');
  let row = '', rowY = 646;
  c.font = '900 29px Impact, "Arial Black", system-ui, sans-serif';
  for (const word of words) {
    if (row && c.measureText(`${row} ${word}`).width > 303) { text(c, row, 21, rowY, 29, CREAM, 'left', 305); rowY += 35; row = word; }
    else row += `${row ? ' ' : ''}${word}`;
  }
  if (row) text(c, row, 21, rowY, 29, CREAM, 'left', 305);
  text(c, view.cashoutX100 !== null ? 'LET THEM FIGHT IN THE REPLIES.' : view.phase === 'crashed' ? 'YOUR CALL IS NOT IMPORTANT TO US.' : 'VALUELESS CREDITS. PRICELESS NONSENSE.', 270, 792, 15, '#a6c198', 'center', 504);
  c.restore();
}
