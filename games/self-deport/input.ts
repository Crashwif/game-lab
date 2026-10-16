/**
 * Memo's two controls, wired from the game's own files. Cone mode: down arrow, S or C, a tap, or a swipe
 * that is not upward. The ally: up arrow, W or A, or a swipe up. Space stays the shell's (Join,
 * Self-deport). Commands are edge-triggered: each is read once by the frame that consumes it. The
 * listeners come off with dispose(), as the shell recreates scenes.
 */
export interface Commands {
  duck: boolean;
  ally: boolean;
}

export interface Input {
  /** The commands since the last take, then cleared. */
  take(): Commands;
  /** Whether the player has steered at all on this page. */
  readonly touched: boolean;
  dispose(): void;
}

/** A swipe this long (CSS px) counts; shorter and quicker is a tap. */
const SWIPE_PX = 24;
const TAP_MS = 320;

export function createInput(canvas: HTMLCanvasElement, onFirst: () => void = () => {}): Input {
  let pending: Commands = { duck: false, ally: false };
  let touched = false;
  const mark = (command: keyof Commands) => {
    pending[command] = true;
    if (!touched) { touched = true; onFirst(); }
  };
  const ownsKey = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return true;
    const tag = target.tagName;
    return tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT';
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !ownsKey(event.target)) return;
    let command: keyof Commands | null = null;
    switch (event.code) {
      case 'ArrowDown': case 'KeyS': case 'KeyC': command = 'duck'; break;
      case 'ArrowUp': case 'KeyW': case 'KeyA': command = 'ally'; break;
    }
    if (!command) return;
    event.preventDefault();
    if (!event.repeat) mark(command);
  };
  let start: { x: number; y: number; at: number; id: number } | null = null;
  const onDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    start = { x: event.clientX, y: event.clientY, at: performance.now(), id: event.pointerId };
    try { canvas.setPointerCapture(event.pointerId); } catch { /* capture is a nicety */ }
  };
  const settle = (event: PointerEvent, ended: boolean) => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_PX || Math.abs(dy) >= SWIPE_PX) { mark(dy < 0 && Math.abs(dy) > Math.abs(dx) ? 'ally' : 'duck'); start = null; }
    else if (ended) { if (performance.now() - start.at < TAP_MS) mark('duck'); start = null; }
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
    take() { const out = pending; pending = { duck: false, ally: false }; return out; },
    get touched() { return touched; },
    dispose() {
      document.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
    },
  };
}
