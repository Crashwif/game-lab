/**
 * Responsive component layout for Rage Bait.
 *
 * Landscape uses the canonical 960 × 540 logical space (upper strip for header,
 * left ~38% for character and room, right ~60% for the social feed and draft).
 * Portrait uses a game-local 540 × 800 logical space stacking header, feed,
 * draft, and a close view of the character.
 *
 * Client coordinates are mapped through the active layout before hit testing.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FontSpec {
  title: number;
  subtitle: number;
  multiplier: number;
  status: number;
  accountName: number;
  accountHandle: number;
  post: number;
   postLineHeight: number;
  reply: number;
  replyLineHeight: number;
  draft: number;
  badge: number;
  stamp: number;
}

export interface SceneLayout {
  portrait: boolean;
  width: number;
  height: number;
  headerRect: Rect;
  roomRect: Rect;
  feedRect: Rect;
  prevPeekRect: Rect;
  nextPeekRect: Rect;
  cardRect: Rect;
  repliesHitRect: Rect;
  composerRect: Rect;
  postButtonRect: Rect;
  stampRect: Rect;
  tutorialRect: Rect;
  fonts: FontSpec;
}

/** CSS selects portrait when the stage makes the canvas taller than wide. */
export function isPortrait(canvas: Pick<HTMLCanvasElement, 'clientWidth' | 'clientHeight'> | null | undefined): boolean {
  return Boolean(canvas && canvas.clientWidth > 0 && canvas.clientHeight > canvas.clientWidth);
}

/** Check if a logical point lies inside a rectangle. */
export function pointInRect(pt: { x: number; y: number }, r: Rect): boolean {
  return pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
}

/** Compute the active landscape (960×540) or portrait (540×800) layout. */
export function getLayout(portrait: boolean, threadExpanded = false): SceneLayout {
  if (portrait) {
    // 540 × 800 portrait composition:
    // At 360 CSS px viewport (scale = 2/3), post = 28px (18.7 CSS px >= 18),
    // topReply = 22px (14.7 CSS px >= 14), repliesHitRect = 492×76 (>= 44×44 CSS px even at 320px).
    const cardH = threadExpanded ? 290 : 254;
    const cardY = 128;
    const replyH = threadExpanded ? 116 : 76;
    const replyY = cardY + cardH - replyH - 6;
    return {
      portrait: true,
      width: 540,
      height: 800,
      headerRect: { x: 0, y: 0, w: 540, h: 102 },
      feedRect: { x: 12, y: 108, w: 516, h: 374 },
      prevPeekRect: { x: 24, y: 111, w: 492, h: 14 },
      cardRect: { x: 20, y: cardY, w: 500, h: cardH },
      repliesHitRect: { x: 26, y: replyY, w: 488, h: Math.max(76, replyH) },
      nextPeekRect: { x: 24, y: cardY + cardH + 3, w: 492, h: 12 },
      composerRect: { x: 20, y: 422, w: 500, h: 52 },
      postButtonRect: { x: 468, y: 427, w: 44, h: 42 },
      roomRect: { x: 12, y: 490, w: 516, h: 298 },
      stampRect: { x: 34, y: 696, w: 472, h: 82 },
      tutorialRect: { x: 20, y: 724, w: 500, h: 58 },
      fonts: {
        title: 26,
        subtitle: 12,
        multiplier: 46,
        status: 15,
        accountName: 18,
        accountHandle: 14,
        post: 28,
        postLineHeight: 33,
        reply: 22,
        replyLineHeight: 26,
        draft: 20,
        badge: 13,
        stamp: 30,
      },
    };
  }

  // 960 × 540 landscape composition:
  // Upper strip (0..68) for title, current multiplier, and personal result.
  // Left ~38% (16..380) for character and room.
  // Right ~60% (392..944) for social feed and draft composer.
  const cardH = threadExpanded ? 338 : 302;
  const cardY = 104;
  const replyH = threadExpanded ? 132 : 84;
  const replyY = cardY + cardH - replyH - 8;

  return {
    portrait: false,
    width: 960,
    height: 540,
    headerRect: { x: 0, y: 0, w: 960, h: 68 },
    roomRect: { x: 16, y: 76, w: 364, h: 450 },
    feedRect: { x: 392, y: 76, w: 552, h: 450 },
    prevPeekRect: { x: 408, y: 81, w: 520, h: 18 },
    cardRect: { x: 404, y: cardY, w: 528, h: cardH },
    repliesHitRect: { x: 414, y: replyY, w: 508, h: Math.max(76, replyH) },
    nextPeekRect: { x: 408, y: cardY + cardH + 4, w: 520, h: 16 },
    composerRect: { x: 404, y: 458, w: 528, h: 56 },
    postButtonRect: { x: 878, y: 465, w: 44, h: 42 },
    stampRect: { x: 26, y: 432, w: 344, h: 84 },
    tutorialRect: { x: 24, y: 454, w: 348, h: 64 },
    fonts: {
      title: 26,
      subtitle: 11,
      multiplier: 44,
      status: 14,
      accountName: 17,
      accountHandle: 13,
      post: 24,
      postLineHeight: 30,
      reply: 17,
      replyLineHeight: 22,
      draft: 18,
      badge: 12,
      stamp: 28,
    },
  };
}

/**
 * Convert client (CSS viewport) coordinates into the active scene's logical
 * coordinate space (960×540 in landscape, 540×800 in portrait).
 */
export function clientToScene(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  layout?: SceneLayout,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const active = layout ?? getLayout(isPortrait(canvas), false);
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  return {
    x: ((clientX - rect.left) / w) * active.width,
    y: ((clientY - rect.top) / h) * active.height,
  };
}
