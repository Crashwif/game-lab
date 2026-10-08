import type { SceneView } from './scene';
import { INK, PAPER, RED, GOLD, label, mono } from './ink';

/** A tall acting shot and a live CRT cutaway share one scene evaluation. */
export function portrait(render: (c: CanvasRenderingContext2D, view: SceneView, now: number, close: boolean) => string) {
  let surface: HTMLCanvasElement | null = null;
  return (c: CanvasRenderingContext2D, view: SceneView, now: number): void => {
    const tall = c.canvas.clientWidth > 0 && c.canvas.clientHeight > c.canvas.clientWidth;
    if (!tall || typeof document === 'undefined') { render(c, view, now, false); return; }
    surface ??= Object.assign(document.createElement('canvas'), { width: 960, height: 540 });
    const caption = render(surface.getContext('2d')!, view, now, true);
    c.save();
    c.setTransform(c.canvas.width / 540, 0, 0, c.canvas.height / 836, 0, 0);
    c.fillStyle = PAPER; c.fillRect(0, 0, 540, 836);
    c.fillStyle = INK; c.fillRect(0, 0, 540, 100);
    label(c, 'RAGE QUIT', 18, 25, 23, RED, 251);
    mono(c, view.phase === 'crashed' ? 'ROUND CRASHED' : view.phase === 'running' ? 'ROUND RUNNING' : view.phase === 'betting' ? 'JOIN ROUND' : 'WAITING', 18, 74, 12, PAPER, 212);
    label(c, `${(view.currentX100 / 100).toFixed(2)}×`, 521, 54, 50, view.phase === 'crashed' ? GOLD : PAPER, 292, 'right');
    const lines: string[] = [];
    c.font = '900 25px "Arial Black", sans-serif';
    let line = '';
    for (const word of caption.split(' ')) {
      if (line && c.measureText(`${line} ${word}`).width > 502) { lines.push(line); line = word; }
      else line += `${line ? ' ' : ''}${word}`;
    }
    if (line) lines.push(line);
    for (let i = 0; i < Math.min(2, lines.length); i += 1) label(c, lines[i], 270, 123 + i * 29, 25, INK, 506, 'center');
    // The close shot keeps the face, shoulders, hands and planted feet together.
    const safe = view.cashoutX100 !== null;
    const tipping = Math.floor(view.elapsed / 6000) % 8 === 6 && view.phase === 'running';
    const cropX = safe ? 0 : tipping ? 90 : 139;
    c.drawImage(surface, cropX, 96, 495, 439, 0, 174, 540, 479);
    c.strokeStyle = INK; c.lineWidth = 4; c.strokeRect(1, 174, 538, 479);
    // A second live view makes the screen's changing gag readable on a phone.
    c.drawImage(surface, 558, 145, 305, 217, 11, 666, 233, 158);
    c.strokeRect(11, 666, 233, 158);
    label(c, safe ? 'CASH-OUT' : view.phase === 'crashed' ? 'USER ERROR.' : 'LIVE FROM', 267, 696, 22, safe ? '#425a34' : RED, 254);
    label(c, safe ? 'CONFIRMED' : view.phase === 'crashed' ? 'TICKET CLOSED.' : 'THE COPE CAVE', 267, 725, 20, INK, 254);
    if (safe) label(c, `${(view.cashoutX100! / 100).toFixed(2)}×`, 267, 765, 27, '#425a34', 254);
    else mono(c, 'Credits have no', 267, 767, 14, INK, 254);
    mono(c, safe ? 'OFFLINE. STAY MAD.' : 'monetary value.', 267, 795, 14, INK, 254);
    c.restore();
  };
}
