/**
 * Where everything in MAFO sits. The world is one side view of a single-wide trailer in cutaway (its front wall
 * removed), its yard, and the night behind it. World units are the cooking show's pixels: the close-up camera
 * maps them one to one onto the 960 × 540 frame, so the kitchen is drawn at the frame's own scale and the yard,
 * the sky and the explosion live around it. The cameras below frame the show, the cousin's walk out to the
 * truck and the blast. Layout only: nothing here reads or changes the round's outcome.
 */
import { clamp, mix } from './motion';

/** The trailer: its end walls, roof line, ceiling, floor, the underside of the floor and the yard it stands on. */
export const TRAILER = { left: -760, right: 1300, roof: -14, ceil: 40, floor: 600, base: 628, ground: 720 } as const;
/** The rooms: the living room left of the post, the kitchen, the bathroom right of its wall. */
export const ROOMS = { post: -40, bath: 1000 } as const;

// ─── The kitchen (the cooking show's set) ───────────────────────────────────────────────────────────────────────
export const COUNTER = { left: 220, right: 830, top: 344, edge: 12 } as const;
/** The turkey fryer: its centre, the rim and base of the body, and its half width. */
export const POT = { x: 560, rim: 236, base: 326, rx: 72 } as const;
/** The burner stand under the pot, on the counter. */
export const STAND = { top: 326, bottom: COUNTER.top } as const;
/** The canoe paddle's hole in the lid: the pivot it stirs about. */
export const PIVOT = { x: 548, y: 216 } as const;
/** The funnel taped low on the pot's side (its hose feeds the bottom), the jiggler valve, the gauge's pipe. */
export const FUNNEL = { x: 468, y: 300 } as const;
export const JIGGLER = { x: 586, y: 220 } as const;
export const GAUGE = { x: 610, y: 182, pipe: 218 } as const;
/** The burner's knob on the stand's front. */
export const KNOB = { x: 616, y: 336 } as const;
/** The copper coil leaves the pot's shoulder and ends over the mason jar. */
export const COIL = { from: { x: 630, y: 250 }, spout: { x: 726, y: 282 } } as const;
export const JAR = { x: 726, base: COUNTER.top, w: 42, h: 54 } as const;
/** The jugs on the counter (by the handle's foot) and his beer in its koozie. */
export const JUGS = { xxx: { x: 276, y: COUNTER.top }, mystery: { x: 318, y: COUNTER.top } } as const;
export const BEER = { x: 372, y: COUNTER.top } as const;
/** The propane tank stands on the floor in front of the counter's right end. */
export const TANK = { x: 776, top: 468, base: TRAILER.floor, r: 34 } as const;
/** The kitchen window (its inner opening) and the box fan in its top corner. */
export const WINDOW = { x0: 650, x1: 862, y0: 88, y1: 238 } as const;
export const FAN = { x: 690, y: 128, r: 30 } as const;
export const FRIDGE = { x0: 876, x1: 1010, top: 118 } as const;
export const SHELF = { x0: 150, x1: 342, y: 158 } as const;
export const BULB = { x: 520, cord: TRAILER.ceil, y: 80 } as const;
/** The mounted bass over the cousin's chair. */
export const BASS = { x: 92, y: 96 } as const;
/** The recipe taped to the fridge door. */
export const RECIPE = { x: 916, y: 246 } as const;

/** Junior stands behind the counter: his centre line, hip, shoulders and head. */
export const JUNIOR = { x: 420, hip: 372, shoulder: 240, head: 184, headR: 31 } as const;
/** The cousin's lawn chair at the left of the kitchen, facing the stove. */
export const CHAIR = { x: 118, seat: 516 } as const;
/** The possum lives on top of the fridge. */
export const POSSUM = { x: 948, y: FRIDGE.top } as const;

// ─── The living room and the bathroom ───────────────────────────────────────────────────────────────────────────
export const COUCH = { x0: -640, x1: -330 } as const;
export const TV = { x: -190 } as const;
export const TOILET = { x: 1150 } as const;
export const HEATER = { x: 1250 } as const;
/**
 * The cutaway opens only the kitchen: the living room and the bathroom keep their front wall, with a window each.
 * The front door is in the living room's wall, with wooden steps down to the yard.
 */
export const FRONT = { cut0: ROOMS.post, cut1: ROOMS.bath } as const;
export const DOOR = { x0: -540, x1: -460, top: 330 } as const;
export const STEPS = { x0: -566, x1: -434 } as const;
export const LIVING_WINDOW = { x0: -310, x1: -140, y0: 150, y1: 290 } as const;
export const BATH_WINDOW = { x0: 1110, x1: 1210, y0: 150, y1: 240 } as const;

// ─── The yard (in front of the trailer) and the night behind it ─────────────────────────────────────────────────
/** The pickup parked in front of the living room, facing left: bumper to tailgate, and where its wheels stand. */
export const TRUCK = { x0: -1240, x1: -650, ground: 806 } as const;
/** Where the cousin crouches: between the truck and the trailer, his head over the bed rail. */
export const HIDE = { x: -868, ground: 760 } as const;
export const DOG = { x: -250, y: 778 } as const;
export const POOL = { x: 1610, y: 846, rx: 170, ry: 34 } as const;
export const TREE = { x: 2060, branch: { x: 1930, y: 262 } } as const;
export const DISH = { x: 1392 } as const;
/** The far field's horizon behind the trailer, and the dirt road across it. */
export const HORIZON = 200;
export const ROAD = { y: 228 } as const;
/** Miss Darlene's trailer across the road, small and far: it shows in the kitchen window. */
export const NEIGHBOUR = { x0: 742, x1: 852, roof: 178, base: 224 } as const;
export const MOON = { x: 1700, y: -560, r: 78 } as const;

// ─── Cameras ────────────────────────────────────────────────────────────────────────────────────────────────────
/** A camera: the world point at the frame's centre and the scale from world units to frame pixels. */
export interface Cam { cx: number; cy: number; s: number }
/** The cooking show: the kitchen, one to one. */
export const SHOW: Cam = { cx: 480, cy: 270, s: 1 };
/** After the cousin walks out: the truck on the left, the kitchen in its cutaway on the right. */
export const EXIT: Cam = { cx: -150, cy: 250, s: 0.4 };
/** The blast: the yard from the truck to the tree, and the sky the roof goes up into. */
export const BLAST: Cam = { cx: 360, cy: 140, s: 0.26 };

/** Between two cameras: the centre moves straight, the zoom geometrically, so a pull-out feels even. */
export function mixCam(a: Cam, b: Cam, t: number): Cam {
  const u = clamp(t, 0, 1);
  return { cx: mix(a.cx, b.cx, u), cy: mix(a.cy, b.cy, u), s: Math.exp(mix(Math.log(a.s), Math.log(b.s), u)) };
}

/** Applies a camera to the frame's context (call inside save/restore). */
export function applyCam(ctx: CanvasRenderingContext2D, cam: Cam): void {
  ctx.translate(480, 270);
  ctx.scale(cam.s, cam.s);
  ctx.translate(-cam.cx, -cam.cy);
}

/** A world point on the frame, through a camera. */
export const toScreen = (cam: Cam, p: { x: number; y: number }): { x: number; y: number } => ({ x: 480 + (p.x - cam.cx) * cam.s, y: 270 + (p.y - cam.cy) * cam.s });
