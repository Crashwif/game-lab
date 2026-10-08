import type { SceneView } from './scene';
type Context = CanvasRenderingContext2D;
type Box = { x: number; y: number; w: number; h: number };
/** A close acting view with a wide inset retaining the exit and secondary actors. */
export function portrait(draw: (c: Context, v: SceneView, now: number, close?: boolean) => void, title: string, crop: () => Box, caption: (v: SceneView) => string) {
  let surface: HTMLCanvasElement;
  return (c: Context, v: SceneView, now: number): void => {
    if (c.canvas.clientHeight <= c.canvas.clientWidth || !c.canvas.clientWidth) return draw(c, v, now);
    surface ??= Object.assign(document.createElement('canvas'), { width: 960, height: 540 });
    draw(surface.getContext('2d')!, v, now, true);
    c.save(); c.textBaseline = 'alphabetic'; c.letterSpacing = '0px'; c.setTransform(c.canvas.width / 540, 0, 0, c.canvas.height / 752, 0, 0);
    c.fillStyle = '#142431'; c.fillRect(0, 0, 540, 752);
    const tone = v.cashoutX100 !== null ? '#b8f078' : v.phase === 'crashed' ? '#ff8190' : '#f5eedc';
    c.fillStyle = tone;
    c.textAlign = 'left'; c.font = '900 30px Arial'; c.fillText(title, 22, 41, 496);
    // The live multiplier (the crash point once crashed) stays up after a cash-out; your exit sits beside it.
    c.textAlign = 'right'; c.font = '900 43px Arial'; c.fillStyle = v.phase === 'crashed' ? '#ff8190' : '#f5eedc';
    c.fillText(`${(v.currentX100 / 100).toFixed(2)}×`, 518, 88, 300);
    if (v.cashoutX100 !== null) { c.textAlign = 'left'; c.font = '900 24px Arial'; c.fillStyle = '#b8f078'; c.fillText(`OUT ${(v.cashoutX100 / 100).toFixed(2)}×`, 22, 86, 190); }
    c.fillStyle = tone; c.textAlign = 'center'; c.font = '900 24px Arial'; c.fillText(caption(v), 270, 132, 508);
    const b = crop(), scale = Math.min(540 / b.w, 454 / b.h), w = b.w * scale, h = b.h * scale;
    c.drawImage(surface, b.x, b.y, b.w, b.h, (540 - w) / 2, 154 + (454 - h) / 2, w, h);
    c.drawImage(surface, 0, 180, 960, 340, 82, 616, 376, 133);
    c.restore();
  };
}
