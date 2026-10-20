import { STUNTS, type Choice, type Production } from './production';

export function attachInput(canvas: HTMLCanvasElement, choose: (choice: Choice) => void) {
  if (typeof document === 'undefined' || !canvas.addEventListener) return { sync(_p: Production) {}, dispose() {} };
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-describedby', 'stunt-help story');
  let enabled = true, last = '';
  const choices: Choice[] = [...STUNTS, 'auto'];
  const cleanup: (() => void)[] = [];
  for (const choice of choices) {
    const button = document.getElementById('stunt-' + choice);
    const click = () => { if (enabled) choose(choice); };
    button?.addEventListener('click', click);
    cleanup.push(() => button?.removeEventListener('click', click));
  }
  const key = (e: KeyboardEvent) => {
    if (!enabled || e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return;
    const choice = e.key === '0' ? 'auto' : STUNTS[Number(e.key) - 1];
    if (choice) { choose(choice); e.preventDefault(); }
  };
  document.addEventListener('keydown', key);
  return {
    sync(p: Production) {
      enabled = p.enabled;
      const signature = p.choice + ':' + enabled;
      if (signature === last) return;
      for (const choice of choices) {
        const button = document.getElementById('stunt-' + choice);
        button?.setAttribute('aria-pressed', String(p.choice === choice));
        button?.setAttribute('aria-disabled', String(!enabled));
      }
      last = signature;
    },
    dispose() { cleanup.forEach(fn => fn()); document.removeEventListener('keydown', key); },
  };
}
