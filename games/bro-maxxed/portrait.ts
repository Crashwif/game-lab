/**
 * Responsive composition and portrait layout for BRO-MAXXED.
 *
 * Landscape uses the canonical 960 × 540 logical space.
 * Portrait uses a 540 × 800 logical space that brings Rex and Milo closer together,
 * repositions the product trolley and wall screen behind Rex instead of shrinking
 * every asset, and sizes captions for 360px and 390px mobile viewports (Page 6).
 */

import type { Joint } from './motion';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneLayout {
  portrait: boolean;
  width: number;
  height: number;
  floorY: number;
  headerRect: Rect;
  gymSignRect: Rect;
  mirrorRect: Rect;
  rackRect: Rect;
  trolleyRect: Rect;
  monitorRect: Rect;
  adBannerRect: Rect;
  captionRect: Rect;
  commentPillRect: Rect;
  cosmeticBarRect: Rect;
  rexHome: Joint;
  miloHome: Joint;
  rexWedding: Joint;
  miloWedding: Joint;
  sharedHandPoint: Joint;
  exitDoorX: number;
  fonts: {
    title: number;
    multiplier: number;
    status: number;
    sign: number;
    captionSpeaker: number;
    captionBody: number;
    propHero: number;
    comment: number;
    outcomeHeadline: number;
    outcomeSubline: number;
  };
}

/** True when the CSS stage gives the canvas a portrait aspect ratio. */
export function isPortrait(
  canvas: Pick<HTMLCanvasElement, 'clientWidth' | 'clientHeight'> | null | undefined,
): boolean {
  return Boolean(canvas && canvas.clientWidth > 0 && canvas.clientHeight > canvas.clientWidth);
}

export function pointInRect(pt: Joint, r: Rect): boolean {
  return pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
}

/** Compute the active landscape (960×540) or portrait (540×800) scene layout. */
export function getSceneLayout(portrait: boolean): SceneLayout {
  if (portrait) {
    // 540 × 800 portrait layout:
    // Brings Rex and Milo closer together in the main frame, places the product trolley
    // behind Rex, and keeps the primary caption and multiplier large at 360px/390px widths.
    return {
      portrait: true,
      width: 540,
      height: 800,
      floorY: 598,
      headerRect: { x: 0, y: 0, w: 540, h: 92 },
      gymSignRect: { x: 16, y: 100, w: 508, h: 36 },
      adBannerRect: { x: 16, y: 142, w: 508, h: 42 },
      monitorRect: { x: 18, y: 196, w: 168, h: 118 },
      trolleyRect: { x: 18, y: 360, w: 164, h: 170 },
      mirrorRect: { x: 132, y: 192, w: 222, h: 318 },
      rackRect: { x: 334, y: 200, w: 190, h: 320 },
      commentPillRect: { x: 18, y: 604, w: 504, h: 32 },
      captionRect: { x: 16, y: 642, w: 508, h: 98 },
      cosmeticBarRect: { x: 16, y: 746, w: 508, h: 44 },
      rexHome: { x: 214, y: 552 },
      miloHome: { x: 392, y: 540 },
      rexWedding: { x: 236, y: 548 },
      miloWedding: { x: 344, y: 544 },
      sharedHandPoint: { x: 290, y: 452 },
      exitDoorX: 518,
      fonts: {
        title: 24,
        multiplier: 42,
        status: 14,
        sign: 16,
        captionSpeaker: 15,
        captionBody: 22,
        propHero: 15,
        comment: 15,
        outcomeHeadline: 30,
        outcomeSubline: 18,
      },
    };
  }

  // 960 × 540 landscape layout (Page 6 table)
  return {
    portrait: false,
    width: 960,
    height: 540,
    floorY: 426,
    headerRect: { x: 0, y: 0, w: 960, h: 62 },
    gymSignRect: { x: 274, y: 68, w: 412, h: 30 },
    adBannerRect: { x: 696, y: 68, w: 248, h: 48 },
    monitorRect: { x: 24, y: 74, w: 232, h: 148 },
    trolleyRect: { x: 24, y: 242, w: 232, h: 180 },
    mirrorRect: { x: 282, y: 104, w: 324, h: 312 },
    rackRect: { x: 636, y: 120, w: 296, h: 298 },
    commentPillRect: { x: 24, y: 438, w: 244, h: 40 },
    captionRect: { x: 278, y: 434, w: 660, h: 88 },
    cosmeticBarRect: { x: 24, y: 484, w: 244, h: 40 },
    rexHome: { x: 436, y: 404 },
    miloHome: { x: 734, y: 394 },
    rexWedding: { x: 516, y: 402 },
    miloWedding: { x: 644, y: 398 },
    sharedHandPoint: { x: 580, y: 314 },
    exitDoorX: 932,
    fonts: {
      title: 24,
      multiplier: 40,
      status: 13,
      sign: 15,
      captionSpeaker: 14,
      captionBody: 20,
      propHero: 14,
      comment: 13,
      outcomeHeadline: 32,
      outcomeSubline: 17,
    },
  };
}

/** Map client viewport coordinates into the active logical canvas space. */
export function clientToLayout(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  layout: SceneLayout,
): Joint {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  return {
    x: ((clientX - rect.left) / w) * layout.width,
    y: ((clientY - rect.top) / h) * layout.height,
  };
}
