/**
 * The runner's controls, wired from the game's own files: arrows or WASD on the keyboard, swipes or a tap
 * on the picture. Space stays the shell's (Join, Cash out). Commands are edge-triggered: each is read once
 * by the frame that consumes it. The listeners come off with dispose(), as the shell recreates scenes.
 */
export interface Commands {
  left: boolean;
  right: boolean;
  jump: boolean;
  slide: boolean;
}

export interface Input {
  /** The commands since the last take, then cleared. */
  take(): Commands;
  /** Whether the player has steered at all on this page. */
  readonly touched: boolean;
  dispose(): void;
}

/** A swipe this long (CSS px) counts; shorter and quicker is a tap, which jumps. */
const SWIPE_PX = 24;
const TAP_MS = 320;

const empty = (): Commands => ({ left: false, right: false, jump: false, slide: false });

export function createInput(canvas: HTMLCanvasElement, onFirst: () => void = () => {}): Input {
  let pending = empty();
  let touched = false;
  const mark = (command: keyof Commands) => {
    pending[command] = true;
    if (!touched) {
      touched = true;
      onFirst();
    }
  };
  const ownsKey = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return true;
    const tag = target.tagName;
    // A control of the shell keeps its own keys; the page, the picture and the buttons share the arrows.
    return tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT';
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !ownsKey(event.target)) return;
    let command: keyof Commands | null = null;
    switch (event.code) {
      case 'ArrowLeft': case 'KeyA': command = 'left'; break;
      case 'ArrowRight': case 'KeyD': command = 'right'; break;
      case 'ArrowUp': case 'KeyW': command = 'jump'; break;
      case 'ArrowDown': case 'KeyS': command = 'slide'; break;
    }
    if (!command) return;
    event.preventDefault();
    if (!event.repeat) mark(command);
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
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_PX || Math.abs(dy) >= SWIPE_PX) {
      mark(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy < 0 ? 'jump' : 'slide');
      start = null;
    } else if (ended) {
      if (performance.now() - start.at < TAP_MS) mark('jump');
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
