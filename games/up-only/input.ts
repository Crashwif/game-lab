/**
 * The one control, wired from the game's own files: a flap. A tap or click on the picture, or ArrowUp, W,
 * X or Enter on the keyboard. Space stays the shell's (Join, Cash out). Flaps are counted between reads,
 * so a frame never drops one. The listeners come off with dispose(), as the shell recreates scenes.
 */
export interface Input {
  /** How many flaps arrived since the last take, then cleared. */
  take(): number;
  /** Whether the player has flapped at all on this page. */
  readonly touched: boolean;
  dispose(): void;
}

export function createInput(canvas: HTMLCanvasElement, onFirst: () => void = () => {}): Input {
  let pending = 0;
  let touched = false;
  const flap = () => {
    pending += 1;
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
    if (event.code !== 'ArrowUp' && event.code !== 'KeyW' && event.code !== 'KeyX' && event.code !== 'Enter') return;
    // Enter on a focused button is that button's click; the shell's buttons keep it.
    if (event.code === 'Enter' && event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    if (!event.repeat) flap();
  };
  const onDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    flap();
  };
  document.addEventListener('keydown', onKey);
  canvas.addEventListener('pointerdown', onDown);
  return {
    take() {
      const out = pending;
      pending = 0;
      return out;
    },
    get touched() {
      return touched;
    },
    dispose() {
      document.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', onDown);
    },
  };
}
