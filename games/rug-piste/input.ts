/** Local arcade controls. Space is reserved for the shared SDK cashout shell. */
import { clamp, LANE } from './course';
export interface Commands { steer: number; target: number | null; jump: boolean; touched: boolean }
export function createInput(canvas: HTMLCanvasElement, horizontal: (clientX: number) => number) {
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-describedby', 'gameplay-help');
  const keys = new Set<string>();
  const held = new Map<number, number>();
  let target: number | null = null;
  // A keyboard or assistive press of LEFT/RIGHT aims one lane over, never at the edge trees.
  let aim: number | null = null;
  let nudge = 0;
  let pointer: number | null = null;
  let jump = false;
  let touched = false;
  const canUse = (event: KeyboardEvent) => !event.altKey && !event.ctrlKey && !event.metaKey &&
    !(event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable=true]'));
  function keydown(event: KeyboardEvent) {
    if (!canUse(event) || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW'].includes(event.code)) return;
    event.preventDefault();
    touched = true;
    keys.add(event.code);
    if (event.code === 'ArrowUp' || event.code === 'KeyW') jump ||= !event.repeat;
    else target = aim = null;
  }
  const keyup = (event: KeyboardEvent) => { keys.delete(event.code); };
  const clear = () => { keys.clear(); held.clear(); target = aim = null; nudge = 0; pointer = null; jump = false; };
  const visibility = () => { if (document.hidden) clear(); };
  function down(event: PointerEvent) {
    if (event.button !== 0 || pointer !== null) return;
    event.preventDefault();
    touched = true;
    pointer = event.pointerId;
    aim = null;
    target = horizontal(event.clientX);
    canvas.focus({ preventScroll: true });
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Capture may be unavailable in a host. */ }
  }
  const move = (event: PointerEvent) => { if (pointer === event.pointerId) target = horizontal(event.clientX); };
  const up = (event: PointerEvent) => {
    held.delete(event.pointerId);
    if (pointer === event.pointerId) { pointer = null; target = null; }
  };
  const cleanups: (() => void)[] = [];
  for (const [id, direction] of [['ski-left', -1], ['ski-right', 1], ['ski-jump', 0]] as const) {
    const button = document.getElementById(id);
    if (!button) continue;
    const press = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      touched = true;
      if (direction) { target = aim = null; held.set(event.pointerId, direction); } else jump = true;
      try { button.setPointerCapture(event.pointerId); } catch { /* Released on window too. */ }
    };
    const click = (event: MouseEvent) => {
      // Keyboard/assistive activation has no preceding pointerdown.
      if (event.detail !== 0) return;
      touched = true;
      if (!direction) jump = true;
      else nudge += direction;
    };
    // A mouse press never moves focus onto a ski key, so Space keeps cashing out.
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
    /** `x` is the skier's current slope position, for lane nudges. */
    take(x: number): Commands {
      if (nudge) { aim = clamp((aim ?? x) + nudge * LANE, 0.14, 0.86); nudge = 0; }
      const steer = Math.max(-1, Math.min(1,
        Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA')) +
        [...held.values()].reduce((a, b) => a + b, 0)));
      const result = { steer, target: target ?? aim, jump, touched };
      jump = false;
      return result;
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
