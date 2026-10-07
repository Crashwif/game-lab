export const isPortrait = (canvas: Pick<HTMLCanvasElement, 'clientWidth' | 'clientHeight'>): boolean => canvas.clientWidth > 0 && canvas.clientHeight > canvas.clientWidth;
/** Game-local portrait compositor. It only rearranges the scene already drawn by the SDK-driven renderer. */
export interface PortraitView { phase: string; currentX100: number; cashoutX100: number | null }
export function createPortrait(title: string, focus: readonly number[], color: string) {
  let frame: HTMLCanvasElement | null = null;
  let background: string | null = null;
  const capture = (c: CanvasRenderingContext2D): void => {
    if (!(c.canvas.clientHeight > c.canvas.clientWidth) || !c.canvas.clientWidth || typeof document === 'undefined') return;
    frame ??= document.createElement('canvas');
    if (frame.width !== c.canvas.width || frame.height !== c.canvas.height) { frame.width = c.canvas.width; frame.height = c.canvas.height; }
    const copy = frame.getContext('2d'); if (!copy) return;
    copy.setTransform(1, 0, 0, 1, 0, 0); copy.drawImage(c.canvas, 0, 0);
  };
  const present = (c: CanvasRenderingContext2D, view: PortraitView, caption: string, label: string, content: string, detail?: readonly number[]): void => {
    if (!(c.canvas.clientHeight > c.canvas.clientWidth) || !c.canvas.clientWidth || typeof document === 'undefined') return;
    if (!frame) return;
    c.save(); c.setTransform(c.canvas.width / 540, 0, 0, c.canvas.height / 800, 0, 0);
    background ??= typeof getComputedStyle === 'function' ? getComputedStyle(c.canvas).getPropertyValue('--bg').trim() || '#151c29' : '#151c29';
    c.globalAlpha = 1; c.fillStyle = background; c.fillRect(0, 0, 540, 800); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillStyle = color; c.font = '900 25px system-ui, sans-serif'; c.fillText(title, 20, 36, 500);
    c.fillStyle = '#ffffff'; c.font = '900 43px system-ui, sans-serif';
    c.fillText(`${((view.cashoutX100 ?? view.currentX100) / 100).toFixed(2)}×`, 20, 88, 340);
    c.font = '700 17px system-ui, sans-serif'; c.textAlign = 'right';
    c.fillText(view.cashoutX100 !== null ? 'CASHED OUT' : view.phase.toUpperCase(), 520, 81, 160); c.textAlign = 'left';
    const wrap = (text: string, top: number, size: number, maxRows: number) => {
      c.font = `700 ${size}px system-ui, sans-serif`; let line = '', row = 0;
      for (const word of text.split(/\s+/)) {
        if (line && c.measureText(line + ' ' + word).width > 492) {
          c.fillText(line, 24, top + row * (size + 7)); line = word; row++; if (row >= maxRows) return;
        } else line += (line ? ' ' : '') + word;
      }
      c.fillText(line, 24, top + row * (size + 7));
    };
    wrap(caption, 120, 23, 2);
    // Close-up carries acting; the overview preserves the location, exit and payoff.
    const crop = detail ?? focus;
    const [x, y, w, h] = crop as [number, number, number, number];
    const scale = Math.min(516 / w, 386 / h), dw = w * scale, dh = h * scale;
    c.drawImage(frame, x / 960 * frame.width, y / 540 * frame.height, w / 960 * frame.width, h / 540 * frame.height, (540 - dw) / 2, 164 + (386 - dh) / 2, dw, dh);
    c.drawImage(frame, 0, 0, frame.width, frame.height, 12, 553, 228, 128.25);
    c.fillStyle = color; c.fillRect(252, 560, 264, 4); c.font = '800 18px system-ui, sans-serif';
    c.fillText(label, 252, 591, 264); c.fillStyle = '#d3dbdf'; c.font = '600 17px system-ui, sans-serif';
    c.fillText(view.cashoutX100 !== null ? 'EXIT ACCEPTED' : view.phase === 'crashed' ? 'ROUND ENDED' : 'LIVE FROM THE SCENE', 252, 624, 264);
    c.fillStyle = '#ffffff'; wrap(content, 715, 25, 3);
    c.restore();
  };
  return { capture, present };
}
