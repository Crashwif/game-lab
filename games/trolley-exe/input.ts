/**
 * The lever, wired from the game's own files: ArrowUp/W or ArrowDown/S on the keyboard, a tap on the top or
 * the bottom half of the picture, or a vertical swipe. Space stays the shell's (Join, Cash out). Commands are
 * edge-triggered: each is read once by the frame that consumes it. The listeners come off with dispose(), as
 * the shell recreates scenes.
 */
export type Side = 'up' | 'down';
export interface Commands {
  up: boolean;
  down: boolean;
}
export interface Input {
  /** The commands since the last take, then cleared. */
  take(): Commands;
  /** Whether the player has thrown the lever at all on this page. */
  readonly touched: boolean;
  dispose(): void;
}

const SWIPE_PX = 24;
const TAP_MS = 320;
const empty = (): Commands => ({ up: false, down: false });

export function createInput(canvas: HTMLCanvasElement, onFirst: () => void = () => {}): Input {
  let pending = empty();
  let touched = false;
  const mark = (side: Side) => {
    pending[side] = true;
    if (!touched) {
      touched = true;
      onFirst();
    }
  };
  const ownsKey = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return true;
    const tag = target.tagName;
    return tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT';
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !ownsKey(event.target)) return;
    let side: Side | null = null;
    switch (event.code) {
      case 'ArrowUp': case 'KeyW': side = 'up'; break;
      case 'ArrowDown': case 'KeyS': side = 'down'; break;
    }
    if (!side) return;
    event.preventDefault();
    if (!event.repeat) mark(side);
  };
  let start: { x: number; y: number; at: number; id: number } | null = null;
  const onDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    start = { x: event.clientX, y: event.clientY, at: performance.now(), id: event.pointerId };
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nicety: a swipe that leaves the picture still ends on the window.
    }
  };
  const settle = (event: PointerEvent, ended: boolean) => {
    if (!start || event.pointerId !== start.id) return;
    const dy = event.clientY - start.y;
    if (Math.abs(dy) >= SWIPE_PX) {
      mark(dy < 0 ? 'up' : 'down');
      start = null;
    } else if (ended) {
      if (performance.now() - start.at < TAP_MS) {
        // A tap: the half of the picture it landed on.
        const box = canvas.getBoundingClientRect();
        mark(start.y - box.top < box.height / 2 ? 'up' : 'down');
      }
      start = null;
    }
  };
  const onMove = (event: PointerEvent) => settle(event, false);
  const onUp = (event: PointerEvent) => settle(event, true);
  const onCancel = () => { start = null; };
  document.addEventListener('keydown', onKey);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  return {
    take() {
      const out = pending;
      pending = empty();
      return out;
    },
    get touched() {
      return touched;
    },
    dispose() {
      document.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
    },
  };
}
