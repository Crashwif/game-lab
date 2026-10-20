/**
 * Feed-only pointer capture, 12 CSS px swipe vs tap discrimination, wheel
 * scrolling, keyboard navigation (`ArrowUp`, `ArrowDown`, `Escape`), and
 * listener cleanup (`dispose()`) for Rage Bait.
 */

import { clientToScene, pointInRect, type SceneLayout } from './layout';

export const SWIPE_THRESHOLD_CSS_PX = 12;
const WHEEL_COOLDOWN_MS = 180;

export interface InputCallbacks {
  getLayout: () => SceneLayout;
  onScrollPrevious: () => void;
  onScrollNext: () => void;
  onToggleReplies: (forceCollapse?: boolean) => void;
}

export interface InputController {
  dispose: () => void;
}

export function attachFeedInput(
  canvas: HTMLCanvasElement,
  callbacks: InputCallbacks,
): InputController {
  // Make the canvas focusable for ArrowUp / ArrowDown / Escape keyboard controls
  // without altering the canonical `<canvas aria-label="...">` HTML source check.
  if (!canvas.hasAttribute('tabindex')) {
    canvas.tabIndex = 0;
  }

  let activePointerId: number | null = null;
  let startClientX = 0;
  let startClientY = 0;
  let swiped = false;
  let lastWheelAtMs = -1_000;

  function releaseCapture(): void {
    if (activePointerId !== null) {
      try {
        if (typeof canvas.hasPointerCapture === 'function' && canvas.hasPointerCapture(activePointerId)) {
          canvas.releasePointerCapture(activePointerId);
        }
      } catch {
        // Ignore if pointer was already released by the browser
      }
    }
    activePointerId = null;
    swiped = false;
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== undefined && e.button !== 0) return;
    const layout = callbacks.getLayout();
    const scenePt = clientToScene(canvas, e.clientX, e.clientY, layout);

    // Begin pointer capture ONLY when pointerdown lands inside `layout.feedRect` (Page 15).
    if (!pointInRect(scenePt, layout.feedRect)) {
      return;
    }

    activePointerId = e.pointerId;
    startClientX = e.clientX;
    startClientY = e.clientY;
    swiped = false;

    try {
      canvas.focus({ preventScroll: true });
    } catch {
      // Ignore focus errors in headless environments
    }

    try {
      if (typeof canvas.setPointerCapture === 'function') {
        canvas.setPointerCapture(e.pointerId);
      }
    } catch {
      // Synthetic PointerEvents in tests may not have an active browser pointerId
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (activePointerId === null || e.pointerId !== activePointerId) return;
    const dy = e.clientY - startClientY;
    const dx = e.clientX - startClientX;

    // A vertical movement > 12 CSS px becomes a swipe and suppresses tap activation on pointerup (Page 15).
    if (!swiped && Math.abs(dy) > SWIPE_THRESHOLD_CSS_PX && Math.abs(dy) >= Math.abs(dx) * 0.7) {
      swiped = true;
      if (dy < 0) {
        // Dragging finger upward pulls the next card up into view
        callbacks.onScrollNext();
      } else {
        // Dragging finger downward scrolls back to the previous card
        callbacks.onScrollPrevious();
      }
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (activePointerId === null || e.pointerId !== activePointerId) return;
    const dy = e.clientY - startClientY;
    const dx = e.clientX - startClientX;
    const wasSwiped =
      swiped || (Math.abs(dy) > SWIPE_THRESHOLD_CSS_PX && Math.abs(dy) >= Math.abs(dx) * 0.7);

    if (!wasSwiped && Math.abs(dy) > SWIPE_THRESHOLD_CSS_PX) {
      if (dy < 0) {
        callbacks.onScrollNext();
      } else {
        callbacks.onScrollPrevious();
      }
    } else if (!wasSwiped) {
      // Tap inside the feed: check if it landed inside `repliesHitRect` (never `postButtonRect`, which is non-interactive)
      const layout = callbacks.getLayout();
      const scenePt = clientToScene(canvas, e.clientX, e.clientY, layout);
      if (
        pointInRect(scenePt, layout.repliesHitRect) &&
        !pointInRect(scenePt, layout.postButtonRect)
      ) {
        callbacks.onToggleReplies(false);
      }
    }

    releaseCapture();
  }

  function onPointerCancel(): void {
    releaseCapture();
  }

  function onWindowBlur(): void {
    releaseCapture();
  }

  function onWheel(e: WheelEvent): void {
    const layout = callbacks.getLayout();
    const scenePt = clientToScene(canvas, e.clientX, e.clientY, layout);
    if (!pointInRect(scenePt, layout.feedRect)) return;

    if (Math.abs(e.deltaY) < 4) return;
    e.preventDefault();

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastWheelAtMs < WHEEL_COOLDOWN_MS) return;
    lastWheelAtMs = now;

    if (e.deltaY > 0) {
      callbacks.onScrollNext();
    } else {
      callbacks.onScrollPrevious();
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    // Preserve `Space` for the shell's primary bet/cash-out button (Page 11 & 15)
    if (e.code === 'Space' || e.key === ' ') {
      return;
    }

    if (e.key === 'Escape') {
      callbacks.onToggleReplies(true);
      return;
    }

    // Only intercept ArrowUp / ArrowDown when focus is on the canvas or document body
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    const isInputFocused =
      activeEl instanceof HTMLInputElement ||
      activeEl instanceof HTMLSelectElement ||
      activeEl instanceof HTMLTextAreaElement ||
      activeEl instanceof HTMLButtonElement;
    if (isInputFocused) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      callbacks.onScrollNext();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      callbacks.onScrollPrevious();
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('blur', onWindowBlur);

  return {
    dispose(): void {
      releaseCapture();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onWindowBlur);
    },
  };
}
