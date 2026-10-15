/**
 * The helm, wired from the game's own files: Up / W steers to port (toward Iran, up the picture), Down / S
 * to starboard (toward Oman, down the picture); dragging on the picture steers to the depth under the
 * pointer; the PORT and STARBOARD buttons steer while held. Space stays the shell's (Join, Cash out), and
 * the listeners come off with dispose(), as the shell recreates scenes.
 */
export interface HelmInput { steer: number; target: number | null; touched: boolean }

/** A keyboard or assistive press of a helm button moves one lane. */
const NUDGE = 0.19;

export function createInput(canvas: HTMLCanvasElement, depthAt: (clientY: number) => number) {
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-describedby', 'helm-help');
  const keys = new Set<string>();
  const held = new Map<number, number>();
  let pointer: number | null = null;
  let target: number | null = null;
  let aim: number | null = null;
  let nudge = 0;
  let touched = false;
  const canUse = (event: KeyboardEvent) => !event.altKey && !event.ctrlKey && !event.metaKey &&
    !(event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable=true]'));
  const keydown = (event: KeyboardEvent) => {
    if (!canUse(event) || !['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(event.code)) return;
    event.preventDefault();
    touched = true;
    keys.add(event.code);
    target = aim = null;
  };
  const keyup = (event: KeyboardEvent) => { keys.delete(event.code); };
  const clear = () => { keys.clear(); held.clear(); pointer = null; target = aim = null; nudge = 0; };
  const visibility = () => { if (document.hidden) clear(); };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || pointer !== null) return;
    event.preventDefault();
    touched = true;
    pointer = event.pointerId;
    aim = null;
    target = depthAt(event.clientY);
    canvas.focus({ preventScroll: true });
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Capture may be unavailable in a host frame. */ }
  };
  const move = (event: PointerEvent) => { if (pointer === event.pointerId) target = depthAt(event.clientY); };
  const up = (event: PointerEvent) => {
    held.delete(event.pointerId);
    if (pointer === event.pointerId) { pointer = null; target = null; }
  };
  const cleanups: (() => void)[] = [];
  for (const [id, direction] of [['helm-port', -1], ['helm-starboard', 1]] as const) {
    const button = document.getElementById(id);
    if (!button) continue;
    const press = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      touched = true;
      target = aim = null;
      held.set(event.pointerId, direction);
      try { button.setPointerCapture(event.pointerId); } catch { /* Released on the window too. */ }
    };
    const click = (event: MouseEvent) => {
      // A keyboard or assistive activation has no pointer press before it: move one lane.
      if (event.detail !== 0) return;
      touched = true;
      nudge += direction;
    };
    // A mouse press never moves focus onto a helm button, so Space keeps cashing out.
    const keepFocus = (event: MouseEvent) => event.preventDefault();
    button.addEventListener('mousedown', keepFocus);
    button.addEventListener('pointerdown', press);
    button.addEventListener('click', click);
    button.addEventListener('lostpointercapture', up);
    cleanups.push(() => {
      button.removeEventListener('mousedown', keepFocus);
      button.removeEventListener('pointerdown', press);
      button.removeEventListener('click', click);
      button.removeEventListener('lostpointercapture', up);
    });
  }
  document.addEventListener('keydown', keydown);
  document.addEventListener('keyup', keyup);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('lostpointercapture', up);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  return {
    /** `depth` is where the ship is now, for lane nudges. */
    take(depth: number): HelmInput {
      if (nudge) { aim = Math.max(0.05, Math.min(0.95, (aim ?? depth) + nudge * NUDGE)); nudge = 0; }
      if (aim !== null && Math.abs(aim - depth) < 0.01) aim = null;
      const steer = Math.max(-1, Math.min(1,
        Number(keys.has('ArrowDown') || keys.has('KeyS')) - Number(keys.has('ArrowUp') || keys.has('KeyW')) +
        [...held.values()].reduce((a, b) => a + b, 0)));
      return { steer, target: target ?? aim, touched };
    },
    dispose() {
      clear();
      cleanups.forEach(fn => fn());
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('lostpointercapture', up);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    },
  };
}
