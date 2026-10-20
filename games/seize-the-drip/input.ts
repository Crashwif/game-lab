import { KINDS, type Choice, type Haul } from './loot';
import { contains, type Layout } from './layout';

export function attachInput(canvas: HTMLCanvasElement, choose: (kind: Choice) => void) {
  if (typeof document === 'undefined' || !canvas.addEventListener) return { sync(_haul: Haul, _layout: Layout) {}, dispose() {} };
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-describedby', 'loot-help story');
  let enabled = true;
  let geometry: Layout | null = null;
  let lastChoice = '', lastEnabled: boolean | null = null;
  const cleanups: (() => void)[] = [];
  const choices: Choice[] = [...KINDS, 'auto'];
  for (const choice of choices) {
    const button = document.getElementById('loot-' + choice);
    const click = () => { if (enabled) choose(choice); };
    button?.addEventListener('click', click);
    cleanups.push(() => button?.removeEventListener('click', click));
  }
  const keydown = (event: KeyboardEvent) => {
    if (!enabled || event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return;
    const choice = event.key === '0' ? 'auto' : KINDS[Number(event.key) - 1];
    if (choice) { choose(choice); event.preventDefault(); }
  };
  const pointer = (event: PointerEvent) => {
    if (!enabled || !geometry || event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (event.clientX - rect.left) / rect.width * geometry.w;
    const y = (event.clientY - rect.top) / rect.height * geometry.h;
    const card = geometry.cards.find(card => contains(card, x, y));
    if (card) choose(card.kind);
  };
  document.addEventListener('keydown', keydown);
  canvas.addEventListener('pointerup', pointer);
  return {
    sync(haul: Haul, next: Layout) {
      enabled = haul.enabled; geometry = next;
      if (lastChoice === haul.choice && lastEnabled === enabled) return;
      for (const choice of choices) {
        const button = document.getElementById('loot-' + choice);
        button?.setAttribute('aria-pressed', String(choice === haul.choice));
        button?.setAttribute('aria-disabled', String(!enabled));
      }
      lastChoice = haul.choice; lastEnabled = enabled;
    },
    dispose() {
      cleanups.forEach(dispose => dispose());
      document.removeEventListener('keydown', keydown);
      canvas.removeEventListener('pointerup', pointer);
    },
  };
}
