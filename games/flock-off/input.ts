/**
 * The gun, wired from the game's own files: the pointer aims (hovering with a mouse, dragging on a touch
 * screen), a click or a tap fires at that spot, the arrow keys and WASD move the reticle, F, Enter, J, K or
 * X fire, R reloads, and the FIRE and RELOAD buttons do the same for a keyboard or assistive press. The
 * first shot or aim key takes the gun from the aimbot. Space stays the shell's (Join, Cash out), and the
 * listeners come off with dispose(), as the shell recreates scenes.
 */
export interface GunInput {
  /** The pointer's last position on the canvas, or null before it has been over the picture. */
  pointer: { x: number; y: number } | null;
  /** The reticle to aim at this frame: the pointer where it moved, null to leave it. */
  aim: { x: number; y: number } | null;
  move: { x: number; y: number };
  fire: number;
  reload: boolean;
  /** The player has fired or steered the reticle at least once this page. */
  touched: boolean;
}

const FIRE_KEYS = ['KeyF', 'Enter', 'KeyJ', 'KeyK', 'KeyX', 'ControlLeft', 'ControlRight'];
const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];

export function createInput(canvas: HTMLCanvasElement, toCanvas: (clientX: number, clientY: number) => { x: number; y: number }) {
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-describedby', 'gun-help');
  const keys = new Set<string>();
  let pointer: { x: number; y: number } | null = null;
  let moved = false;
  let fire = 0;
  let reload = false;
  let touched = false;
  let dragging: number | null = null;
  const canUse = (event: KeyboardEvent) => !event.altKey && !event.metaKey &&
    !(event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable=true]'));
  const keydown = (event: KeyboardEvent) => {
    if (!canUse(event)) return;
    if (MOVE_KEYS.includes(event.code)) {
      event.preventDefault();
      touched = true;
      keys.add(event.code);
    } else if (FIRE_KEYS.includes(event.code)) {
      if (event.code === 'Enter' && event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      touched = true;
      if (!event.repeat) fire++;
    } else if (event.code === 'KeyR') {
      event.preventDefault();
      reload = true;
    }
  };
  const keyup = (event: KeyboardEvent) => { keys.delete(event.code); };
  const clear = () => { keys.clear(); dragging = null; fire = 0; reload = false; };
  const visibility = () => { if (document.hidden) clear(); };
  const hover = (event: PointerEvent) => {
    if (dragging !== null && event.pointerId !== dragging) return;
    pointer = toCanvas(event.clientX, event.clientY);
    moved = true;
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    touched = true;
    pointer = toCanvas(event.clientX, event.clientY);
    moved = true;
    fire++;
    dragging = event.pointerId;
    canvas.focus({ preventScroll: true });
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Capture may be unavailable in a host frame. */ }
  };
  const up = (event: PointerEvent) => { if (dragging === event.pointerId) dragging = null; };
  const leave = () => { if (dragging === null) pointer = null; };
  const cleanups: (() => void)[] = [];
  for (const [id, what] of [['fire-button', 'fire'], ['reload-button', 'reload']] as const) {
    const button = document.getElementById(id);
    if (!button) continue;
    const press = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      touched = true;
      if (what === 'fire') fire++; else reload = true;
    };
    const click = (event: MouseEvent) => {
      // A keyboard or assistive activation has no pointer press before it.
      if (event.detail !== 0) return;
      touched = true;
      if (what === 'fire') fire++; else reload = true;
    };
    // A mouse press never moves focus onto a gun button, so Space keeps cashing out.
    const keepFocus = (event: MouseEvent) => event.preventDefault();
    button.addEventListener('mousedown', keepFocus);
    button.addEventListener('pointerdown', press);
    button.addEventListener('click', click);
    cleanups.push(() => {
      button.removeEventListener('mousedown', keepFocus);
      button.removeEventListener('pointerdown', press);
      button.removeEventListener('click', click);
    });
  }
  document.addEventListener('keydown', keydown);
  document.addEventListener('keyup', keyup);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('pointermove', hover);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointerleave', leave);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  return {
    take(): GunInput {
      const move = {
        x: Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA')),
        y: Number(keys.has('ArrowDown') || keys.has('KeyS')) - Number(keys.has('ArrowUp') || keys.has('KeyW')),
      };
      const result: GunInput = { pointer, aim: moved ? pointer : null, move, fire, reload, touched };
      moved = false;
      fire = 0;
      reload = false;
      return result;
    },
    dispose() {
      clear();
      cleanups.forEach(fn => fn());
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointermove', hover);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointerleave', leave);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    },
  };
}
