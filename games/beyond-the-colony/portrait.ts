import type { SceneView } from './scene';
import { GOLD, INK, JADE, WHITE, words } from './drawing';

type Context = CanvasRenderingContext2D;
/** Width-selected portrait staging keeps the acting close and the surrounding threat in a wide inset. */
export function portrait(draw: (c: Context, v: SceneView, now: number, close?: boolean) => void, heroX: () => number, caption: (v: SceneView) => string) {
  let surface: HTMLCanvasElement | null = null;
  return (c: Context, v: SceneView, now: number): void => {
    if (!c.canvas.clientWidth || c.canvas.clientHeight <= c.canvas.clientWidth) return draw(c, v, now);
    surface ??= Object.assign(document.createElement('canvas'), { width: 960, height: 540 });
    draw(surface.getContext('2d')!, v, now, true);
    c.save(); c.setTransform(c.canvas.width / 540, 0, 0, c.canvas.height / 752, 0, 0);
    c.fillStyle = '#071e2c'; c.fillRect(0, 0, 540, 752);
    words(c, 'BEYOND THE COLONY', 22, 28, 29, WHITE, 496, 'left');
    words(c, v.phase === 'crashed' ? 'ROUND CRASHED' : v.phase === 'running' ? 'FREE WILL: QUESTIONABLE' : 'NIETZSCHEAN PENGUIN', 23, 64, 14, '#acc7bd', 250, 'left');
    words(c, `${(v.currentX100 / 100).toFixed(2)}×`, 515, 74, 43, v.phase === 'crashed' ? GOLD : JADE, 254, 'right');
    const x = Math.max(0, Math.min(480, heroX() - 230));
    c.drawImage(surface, x, 116, 480, 348, 0, 121, 540, 391.5);
    const title = caption(v);
    c.fillStyle = INK; c.fillRect(0, 507, 540, 78);
    const splitAt = title.length > 25 ? title.lastIndexOf(' ', Math.floor(title.length * .55)) : -1;
    if (splitAt > 0) {
      words(c, title.slice(0, splitAt), 270, 532, 30, v.cashoutX100 !== null ? JADE : WHITE, 508);
      words(c, title.slice(splitAt + 1), 270, 564, 30, v.cashoutX100 !== null ? JADE : WHITE, 508);
    } else words(c, title, 270, 547, 31, WHITE, 508);
    c.drawImage(surface, 0, 100, 960, 371, 18, 588, 504, 139);
    c.strokeStyle = '#508777'; c.lineWidth = 2; c.strokeRect(18, 588, 504, 139);
    words(c, v.cashoutX100 !== null ? `CASHED OUT AT ${(v.cashoutX100 / 100).toFixed(2)}×` : 'THE ENTIRE EXISTENTIAL INCIDENT ↑', 270, 741, 13, v.cashoutX100 !== null ? JADE : '#99bab3', 508);
    c.restore();
  };
}
