/** Original code-drawn sprites: a tiny 1990s ski resort with very questionable tokens. */
export const PALETTE = {
  ink: '#302443', deep: '#453353', purple: '#8655c3', lilac: '#bca8d9',
  snow: '#fffdf9', shadow: '#ddd8eb', ice: '#ece8f5', green: '#bbf55c',
  pine: '#47715e', pineDark: '#315346', mint: '#a4ccb5', pink: '#f179ae',
  gold: '#f4cc63', orange: '#ef956a', white: '#ffffff',
} as const;

type Context = CanvasRenderingContext2D;
type Point = readonly [number, number];

function rect(ctx: Context, colour: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = colour;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function shape(ctx: Context, colour: string, points: readonly Point[]): void {
  ctx.fillStyle = colour;
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fill();
}

/** 3×5 pixel glyphs, one bit per pixel, for the tiny stamped labels. */
const GLYPHS: Record<string, number> = { R: 0o65655, U: 0o55557, G: 0o74557 };
function stamp(ctx: Context, colour: string, label: string, x: number, y: number, px: number): void {
  [...label].forEach((letter, i) => {
    for (let n = 0; n < 15; n++) if (GLYPHS[letter] >> (14 - n) & 1) rect(ctx, colour, x + (i * 4 + n % 3) * px, y + Math.floor(n / 3) * px, px, px);
  });
}

/** Bold type for the yeti's lettering: at its small scale 3×5 glyphs blur, and a V reads as a U. */
function letters(ctx: Context, colour: string, label: string, x: number, y: number, size: number): void {
  ctx.fillStyle = colour;
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
}

function shadow(ctx: Context, width: number, height = 8): void {
  shape(ctx, PALETTE.shadow, [[-width / 2, -height / 2], [-width / 2 + 8, -height], [width / 2 - 8, -height], [width / 2, -height / 2], [width / 2, height / 2], [width / 2 - 8, height], [-width / 2 + 8, height], [-width / 2, height / 2]]);
}

/**
 * Feet at (x, y); jump is elevation in pixels, lean -1..1, stumble 0..1. `stride` is the pole and scarf phase
 * (radians; distance-driven while skiing). Seated, the shins and skis hang from the knees and swing by `dangle`.
 */
export function drawSkier(ctx: Context, x: number, y: number, options: {
  lean: number; jump: number; time: number; stumble: number; scale?: number; shadow?: boolean; seated?: number;
  stride?: number; dangle?: number; degen?: boolean;
}): void {
  const { lean, jump, time, stumble } = options;
  const seat = options.seated ?? 0;
  const swing = (options.dangle ?? 0) * seat;
  const hang = Math.sin(swing) * 18;
  // The still-in degen wears the pink puffer and a gold lid.
  const coat = options.degen ? PALETTE.pink : PALETTE.purple;
  const lid = options.degen ? PALETTE.gold : PALETTE.green;
  const scarf = options.degen ? PALETTE.purple : PALETTE.pink;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(options.scale ?? 1, options.scale ?? 1);
  if (options.shadow !== false) {
    ctx.globalAlpha *= .7;
    shadow(ctx, Math.max(24, 44 - jump * .25), 5);
    ctx.globalAlpha /= .7;
  }
  ctx.translate(0, -jump);
  ctx.rotate(lean * -.12 + Math.sin(time * .04) * stumble * .12);

  // Wide twin tips, contrasting edges, bindings and boot soles.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 9 + hang, -1 + seat * 13);
    ctx.rotate(lean * .14 + side * .025 + stumble * side * .4 + swing);
    shape(ctx, PALETTE.ink, [[-4, -17], [2, -19], [5, -16], [5, 10], [2, 15], [-3, 15], [-5, 11], [-5, -12]]);
    rect(ctx, PALETTE.green, -2, -15, 4, 25);
    rect(ctx, PALETTE.pink, -2, 7, 4, 4);
    rect(ctx, PALETTE.white, 0, -15, 2, 8);
    rect(ctx, PALETTE.ink, -4, -8, 9, 8);
    rect(ctx, PALETTE.purple, -2, -8, 6, 4);
    ctx.restore();
  }

  // Knees follow the carve while the boot endpoints stay on their bindings. Seated, the foreshortened thighs rest
  // at seat height and the shins hang over the bench edge.
  const knee = lean * 3;
  for (const side of [-1, 1]) {
    const x = side * 8, b = x + hang;
    shape(ctx, PALETTE.ink, [[x - 4, -24 + seat * 6], [x + 4, -24 + seat * 6], [x + 5 + knee, -15 + seat * 5], [b + 4, -7 + seat * 15], [b - 4, -7 + seat * 15], [x - 4 + knee, -15 + seat * 5]]);
    shape(ctx, PALETTE.deep, [[x - 2, -22 + seat * 6], [x + 2, -22 + seat * 6], [x + 2 + knee, -14 + seat * 5], [b + 2, -8 + seat * 15], [b - 2, -8 + seat * 15], [x - 2 + knee, -14 + seat * 5]]);
  }
  ctx.translate(lean * 2, Math.abs(lean) * 1.5 + seat * 6);
  // Pole lines are intentionally square, like the sprite itself.
  const sway = Math.round(Math.sin(options.stride ?? time / 180) * 2);
  shape(ctx, PALETTE.ink, [[-19, -30], [-16, -30], [-25, 3 + sway], [-28, 3 + sway]]);
  shape(ctx, PALETTE.ink, [[17, -30], [20, -30], [28, 1 - sway], [25, 1 - sway]]);
  rect(ctx, PALETTE.pink, -30, sway, 10, 3);
  rect(ctx, PALETTE.pink, 22, -2 - sway, 10, 3);

  // Snow pants, purple puffer and neon cuffs.
  shape(ctx, PALETTE.ink, [[-8, -43], [9, -43], [16, -37], [22, -29], [21, -24], [15, -23], [12, -29], [12, -20], [-12, -20], [-12, -29], [-15, -24], [-22, -25], [-22, -31], [-15, -39]]);
  shape(ctx, coat, [[-7, -40], [7, -40], [13, -35], [17, -28], [14, -28], [10, -33], [9, -23], [-9, -23], [-10, -33], [-15, -27], [-18, -28], [-12, -36]]);
  rect(ctx, PALETTE.lilac, -9, -35, 4, 10);
  rect(ctx, PALETTE.green, -22, -30, 6, 5);
  rect(ctx, PALETTE.green, 17, -30, 6, 5);

  // Scarf flaps independently of the skier's joints.
  shape(ctx, PALETTE.ink, [[4, -41], [17, -42], [25, -38 + sway], [25, -32 + sway], [18, -34 + sway], [7, -35]]);
  shape(ctx, scarf, [[7, -40], [16, -40], [23, -37 + sway], [23, -35 + sway], [17, -37 + sway], [7, -37]]);

  // Helmet, visor and the bagholder's little token backpack.
  shape(ctx, PALETTE.ink, [[-7, -59], [6, -59], [10, -55], [12, -45], [8, -39], [-8, -39], [-12, -44], [-11, -54]]);
  shape(ctx, lid, [[-5, -56], [5, -56], [8, -53], [9, -46], [6, -42], [-7, -42], [-9, -46], [-8, -53]]);
  rect(ctx, PALETTE.white, -5, -55, 6, 3);
  rect(ctx, PALETTE.ink, -10, -49, 21, 6);
  rect(ctx, PALETTE.lilac, -6 + Math.round(lean * 2), -48, 7, 3);
  rect(ctx, PALETTE.pink, 3, -48, 4, 3);
  rect(ctx, PALETTE.ink, -7, -36, 15, 13);
  rect(ctx, PALETTE.green, -5, -35, 11, 10);
  rect(ctx, PALETTE.pineDark, -2, -33, 2, 2);
  rect(ctx, PALETTE.pineDark, 2, -33, 2, 2);
  rect(ctx, PALETTE.pineDark, -2, -29, 6, 2);
  ctx.restore();
}

/** Joint coordinates are in unscaled sprite space, including emergence elevation. */
export interface YetiArm {
  shoulder: { x: number; y: number };
  elbow: { x: number; y: number };
  wrist: { x: number; y: number };
  side: -1 | 1;
  grip: number;
}

function drawArmSegment(ctx: Context, from: YetiArm['shoulder'], to: YetiArm['elbow'], upper: boolean): void {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const startWidth = upper ? 15 : 12;
  const endWidth = upper ? 11 : 9;
  ctx.save();
  ctx.translate(from.x, from.y);
  ctx.rotate(Math.atan2(to.y - from.y, to.x - from.x));
  // Separate tapered bones keep the bend readable even when the elbow folds tightly.
  shape(ctx, PALETTE.ink, [[-8, -startWidth + 5], [-2, -startWidth], [length * .48, -startWidth + 1], [length * .61, -startWidth - 2], [length * .64, -startWidth + 3], [length - 3, -endWidth], [length + 5, -endWidth + 5], [length + 5, endWidth - 4], [length, endWidth], [length * .61, endWidth + 1], [length * .53, endWidth + 5], [length * .47, endWidth + 1], [-3, startWidth], [-8, startWidth - 5]]);
  shape(ctx, PALETTE.snow, [[-4, -startWidth + 6], [0, -startWidth + 4], [length * .48, -startWidth + 5], [length * .59, -startWidth + 2], [length * .62, -startWidth + 7], [length - 2, -endWidth + 4], [length + 1, -endWidth + 6], [length + 1, endWidth - 5], [length - 2, endWidth - 3], [length * .6, endWidth - 2], [length * .53, endWidth], [length * .47, endWidth - 3], [0, startWidth - 4], [-4, startWidth - 7]]);
  shape(ctx, PALETTE.shadow, [[2, 3], [length * .48, endWidth - 7], [length * .6, endWidth - 4], [length, endWidth - 6], [length, endWidth - 3], [length * .6, endWidth - 2], [length * .47, endWidth - 3], [0, startWidth - 4]]);
  if (!upper) {
    // A shaggy wrist cuff moves with the forearm rather than with the torso.
    shape(ctx, PALETTE.lilac, [[length - 10, -endWidth + 3], [length - 7, -endWidth + 3], [length - 5, 0], [length - 7, endWidth - 3], [length - 10, endWidth - 3], [length - 8, 0]]);
  }
  ctx.restore();
}

/** Draw after the held skier so the closing fingers visibly wrap around the puffer. */
export function drawYetiHands(ctx: Context, x: number, y: number, arms: readonly YetiArm[], scale = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.rect(-260, -300, 520, 302);
  ctx.clip();
  for (const arm of arms) {
    const grip = Math.max(0, Math.min(1, arm.grip));
    const inward = -arm.side;
    const angle = Math.atan2(arm.wrist.y - arm.elbow.y, (arm.wrist.x - arm.elbow.x) * inward);
    ctx.save();
    ctx.translate(arm.wrist.x, arm.wrist.y);
    ctx.scale(inward, 1);
    ctx.rotate(angle * (1 - grip * .85));
    shape(ctx, PALETTE.ink, [[-9, -7], [-5, -11], [5, -11], [10, -6], [11, 5], [5, 11], [-5, 10], [-9, 5]]);
    shape(ctx, PALETTE.snow, [[-5, -6], [-3, -8], [4, -8], [7, -4], [7, 4], [3, 7], [-4, 6]]);
    shape(ctx, PALETTE.shadow, [[-5, 2], [5, 2], [7, 5], [3, 7], [-4, 6]]);
    for (let finger = 0; finger < 3; finger++) {
      const rootY = -7 + finger * 6;
      const spread = (finger - 1) * (1 - grip) * 5;
      const tipX = 19 - grip * 6 - Math.abs(finger - 1) * 2;
      const tipY = rootY + spread;
      // Extended fingers fold at the knuckle into three overlapping hooks.
      shape(ctx, PALETTE.ink, [[3, rootY - 2], [tipX - 5, tipY - 3], [tipX, tipY - 1], [tipX + 1, tipY + 3], [tipX - 3 - grip * 3, tipY + 6], [tipX - 7 - grip * 3, tipY + 3], [3, rootY + 4]]);
      shape(ctx, PALETTE.snow, [[5, rootY], [tipX - 5, tipY], [tipX - 2, tipY + 1], [tipX - 3, tipY + 3], [tipX - 6, tipY + 2], [5, rootY + 2]]);
      if (grip > .45) rect(ctx, PALETTE.lilac, tipX - 7, tipY + 1, 2, 3);
    }
    // The opposing thumb closes from below, completing a readable grasp.
    const thumbX = 4 + grip * 7;
    shape(ctx, PALETTE.ink, [[-3, 5], [1, 5], [thumbX + 4, 10 - grip * 3], [thumbX + 3, 15 - grip * 2], [thumbX - 2, 17 - grip * 2], [-4, 11]]);
    shape(ctx, PALETTE.snow, [[-1, 8], [1, 8], [thumbX + 1, 11 - grip * 2], [thumbX - 1, 13 - grip * 2], [-1, 10]]);
    ctx.restore();
  }
  ctx.restore();
}

/** Front teeth can be layered over a skier entering the mouth. */
export function drawYetiTeeth(ctx: Context, x: number, y: number, options: {
  mouth: number; chew: number; time: number; scale?: number;
}): void {
  const mouth = Math.max(0, Math.min(1, options.mouth));
  const chewing = Math.sin(options.time / 74) * options.chew;
  const jaw = Math.round(10 + mouth * 30 - chewing * 6);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(options.scale ?? 1, options.scale ?? 1);
  for (let i = 0; i < 5; i++) {
    const toothX = -24 + i * 10;
    shape(ctx, PALETTE.white, [[toothX, -87], [toothX + 7, -87], [toothX + 7, -79], [toothX + 4, -75], [toothX + 1, -79]]);
    if (mouth > .25) shape(ctx, PALETTE.white, [[toothX + 2, -74 + jaw], [toothX + 8, -74 + jaw], [toothX + 8, -80 + jaw], [toothX + 5, -83 + jaw], [toothX + 2, -80 + jaw]]);
  }
  ctx.restore();
}

/** The torso narrows at profile; posed limbs remain in screen-local sprite space. */
export function yetiBodyWidth(turn: number): number {
  return .28 + .72 * Math.abs(Math.cos(Math.PI * Math.max(0, Math.min(1, turn))));
}

/** Includes the hole. turn rotates from back (0), through profile (.5), to front (1). */
export function drawYeti(ctx: Context, x: number, y: number, options: {
  rise: number; mouth: number; chew: number; time: number; scale?: number; arms?: readonly YetiArm[];
  turn?: number; turnDirection?: -1 | 1;
}): void {
  const rise = Math.max(0, Math.min(1, options.rise));
  const mouth = Math.max(0, Math.min(1, options.mouth));
  const turn = Math.max(0, Math.min(1, options.turn ?? 1));
  const direction = options.turnDirection ?? 1;
  const bodyWidth = yetiBodyWidth(turn);
  const front = Math.max(0, Math.min(1, (turn - .5) / .25));
  const back = Math.max(0, Math.min(1, (.5 - turn) / .16));
  const chewing = Math.sin(options.time / 74) * options.chew;
  const emergence = (1 - rise) * 165;
  const arms = options.arms ?? ([-1, 1] as const).map(side => ({
    side, grip: 0,
    shoulder: { x: side * 34 * bodyWidth, y: -83 + emergence },
    elbow: { x: side * 65, y: -49 + emergence },
    wrist: { x: side * 50, y: -7 + emergence },
  }));
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(options.scale ?? 1, options.scale ?? 1);
  shape(ctx, PALETTE.shadow, [[-74, -4], [-62, -15], [-32, -20], [35, -20], [65, -12], [76, -2], [65, 10], [31, 18], [-34, 18], [-65, 10]]);
  shape(ctx, PALETTE.ink, [[-65, -3], [-53, -12], [-28, -16], [30, -16], [58, -9], [66, -1], [56, 8], [28, 12], [-30, 12], [-58, 6]]);
  shape(ctx, '#1f1830', [[-51, -3], [-37, -10], [38, -10], [55, -2], [43, 6], [-39, 6]]);

  ctx.save();
  ctx.beginPath();
  ctx.rect(-260, -300, 520, 302);
  ctx.clip();
  for (const arm of arms) drawArmSegment(ctx, arm.shoulder, arm.elbow, true);
  ctx.save();
  ctx.translate(0, emergence);
  ctx.save();
  ctx.scale(bodyWidth, 1);

  // Compact shaggy torso; every arm silhouette now belongs to a moving bone.
  shape(ctx, PALETTE.ink, [[-29, -111], [-39, -98], [-43, -83], [-40, -63], [-42, -43], [-40, -22], [-42, -11], [-33, -8], [-25, -2], [-14, -6], [-6, 0], [4, -5], [14, 0], [26, -5], [37, -4], [44, -15], [40, -34], [43, -51], [40, -70], [43, -86], [36, -103], [27, -113]]);
  shape(ctx, PALETTE.snow, [[-26, -105], [-34, -95], [-37, -81], [-34, -62], [-36, -43], [-34, -22], [-36, -15], [-30, -14], [-25, -8], [-15, -12], [-5, -6], [4, -11], [13, -6], [25, -11], [34, -9], [38, -17], [34, -34], [37, -51], [34, -71], [37, -84], [31, -99], [23, -107]]);
  shape(ctx, PALETTE.shadow, [[25, -89], [36, -78], [34, -61], [37, -51], [31, -37], [33, -20], [26, -15], [18, -16], [21, -28], [17, -44], [26, -62]]);
  shape(ctx, PALETTE.ice, [[-30, -76], [-26, -64], [-30, -48], [-25, -37], [-31, -22], [-34, -38], [-31, -55]]);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    shape(ctx, PALETTE.ink, [[23, -119], [28, -137], [41, -151], [44, -145], [42, -126], [35, -114]]);
    shape(ctx, PALETTE.purple, [[29, -124], [33, -137], [39, -144], [38, -129], [33, -121]]);
    rect(ctx, PALETTE.lilac, 34, -136, 3, 7);
    ctx.restore();
  }

  // The face is broad enough for the skier to disappear into it.
  shape(ctx, PALETTE.ink, [[-28, -132], [-18, -139], [-8, -135], [1, -141], [9, -135], [23, -136], [33, -126], [39, -115], [42, -94], [37, -72], [27, -64], [-28, -65], [-38, -77], [-43, -96], [-39, -117]]);
  shape(ctx, PALETTE.snow, [[-25, -128], [-17, -133], [-7, -129], [1, -135], [10, -129], [21, -130], [29, -122], [34, -112], [36, -95], [31, -76], [24, -70], [-25, -71], [-32, -80], [-37, -97], [-34, -114]]);
  if (back > 0) {
    ctx.save();
    ctx.globalAlpha *= back;
    // A buckle and continuous strap distinguish the back of the head from the glasses.
    shape(ctx, PALETTE.deep, [[-37, -116], [-24, -111], [25, -111], [37, -116], [38, -109], [25, -104], [-25, -104], [-38, -109]]);
    rect(ctx, PALETTE.purple, -25, -110, 50, 3);
    rect(ctx, PALETTE.ink, -7, -113, 14, 12);
    rect(ctx, PALETTE.lilac, -4, -110, 8, 6);
    rect(ctx, PALETTE.deep, -1, -109, 2, 4);
    // Shaggy crown and a long spine remain visible while the skier is behind him.
    shape(ctx, PALETTE.shadow, [[-22, -128], [-16, -124], [-12, -118], [-9, -125], [-3, -119], [2, -128], [8, -120], [14, -126], [22, -122], [16, -133], [8, -129], [1, -135], [-6, -129], [-16, -132]]);
    shape(ctx, PALETTE.shadow, [[-4, -97], [3, -90], [-2, -81], [5, -74], [0, -64], [6, -56], [1, -47], [5, -38], [0, -22], [-5, -30], [-2, -41], [-7, -51], [-3, -61], [-8, -71], [-3, -82], [-8, -90]]);
    shape(ctx, PALETTE.ice, [[-27, -92], [-18, -86], [-21, -74], [-12, -69], [-18, -63], [-27, -74], [-23, -82]]);
    shape(ctx, PALETTE.ice, [[25, -91], [17, -84], [20, -73], [11, -66], [18, -61], [28, -75], [24, -83]]);
    // Jersey lettering: the dev wallet has entered the chat.
    letters(ctx, PALETTE.purple, 'DEV', 0, -79, 18);
    ctx.restore();
  }
  // No face is drawn on the back. It rotates into view only after the profile pose.
  ctx.save();
  ctx.globalAlpha *= front;
  ctx.translate(direction * (1 - front) * 13, 0);
  // Neon shutter shades are the unmistakable memecoin touch.
  rect(ctx, PALETTE.ink, -38, -117, 76, 7);
  shape(ctx, PALETTE.ink, [[-33, -116], [-5, -116], [-5, -99], [-11, -95], [-27, -95], [-33, -101]]);
  shape(ctx, PALETTE.ink, [[5, -116], [33, -116], [33, -101], [27, -95], [11, -95], [5, -100]]);
  rect(ctx, PALETTE.green, -29, -112, 20, 12);
  rect(ctx, PALETTE.green, 9, -112, 20, 12);
  rect(ctx, PALETTE.pineDark, -29, -106, 20, 3);
  rect(ctx, PALETTE.pineDark, 9, -106, 20, 3);
  rect(ctx, PALETTE.white, -26, -112, 5, 3);
  rect(ctx, PALETTE.white, 12, -112, 5, 3);
  shape(ctx, PALETTE.lilac, [[-7, -99], [6, -99], [9, -91], [4, -87], [-4, -87], [-10, -91]]);

  const jaw = Math.round(10 + mouth * 30 - chewing * 6);
  shape(ctx, PALETTE.ink, [[-30, -85], [-23, -91], [25, -91], [32, -83], [31, -78 + jaw], [23, -70 + jaw], [-22, -70 + jaw], [-31, -78 + jaw]]);
  shape(ctx, '#692c53', [[-25, -83], [-20, -87], [21, -87], [27, -81], [25, -79 + jaw], [18, -75 + jaw], [-18, -75 + jaw], [-25, -79 + jaw]]);
  shape(ctx, PALETTE.pink, [[-15, -79 + jaw], [-9, -86 + jaw], [12, -86 + jaw], [20, -80 + jaw], [16, -75 + jaw], [-15, -75 + jaw]]);
  rect(ctx, '#cc638e', -2, -85 + jaw, 3, 7);
  drawYetiTeeth(ctx, 0, 0, { mouth, chew: options.chew, time: options.time });
  // Shaggy cheek pixels and the dev's medallion at the chest.
  rect(ctx, PALETTE.shadow, -37, -83, 5, 9);
  rect(ctx, PALETTE.shadow, 33, -82, 4, 8);
  if (mouth < .5) {
    shape(ctx, PALETTE.gold, [[-17, -57], [-15, -60], [0, -49], [17, -59], [19, -56], [0, -42]]);
    rect(ctx, PALETTE.ink, -16, -49, 32, 17);
    rect(ctx, PALETTE.gold, -14, -47, 28, 13);
    letters(ctx, PALETTE.deep, 'DEV', 0, -40, 12);
  }
  ctx.restore();
  ctx.restore();

  // A side silhouette projects beyond the narrow head, rather than mirroring the face.
  // Its temple, nose and chin make the half-turn readable even at the game's small size.
  const profilePhase = Math.max(0, 1 - Math.abs(turn - .5) * 4);
  const profile = profilePhase * profilePhase * (3 - 2 * profilePhase);
  if (profile > .01) {
    ctx.save();
    ctx.globalAlpha *= profile;
    ctx.scale(direction, 1);
    const edge = 34 * bodyWidth;
    shape(ctx, PALETTE.ink, [[edge - 10, -124], [edge + 3, -117], [edge + 6, -104], [edge + 16, -98], [edge + 16, -90], [edge + 8, -86], [edge + 7, -73], [edge - 3, -66], [edge - 12, -70], [edge - 7, -85], [edge - 11, -107]]);
    shape(ctx, PALETTE.snow, [[edge - 7, -118], [edge - 1, -113], [edge + 1, -101], [edge + 11, -96], [edge + 11, -93], [edge + 3, -90], [edge + 2, -76], [edge - 3, -72], [edge - 7, -74], [edge - 2, -86], [edge - 7, -105]]);
    shape(ctx, PALETTE.lilac, [[edge + 1, -100], [edge + 11, -96], [edge + 11, -93], [edge + 3, -91], [edge - 1, -94]]);
    rect(ctx, PALETTE.ink, edge - 17, -115, 24, 7);
    shape(ctx, PALETTE.ink, [[edge - 4, -116], [edge + 6, -114], [edge + 8, -103], [edge + 2, -99], [edge - 4, -102]]);
    shape(ctx, PALETTE.green, [[edge - 1, -112], [edge + 3, -111], [edge + 4, -105], [edge + 1, -103], [edge - 1, -105]]);
    rect(ctx, PALETTE.pineDark, edge, -108, 4, 2);
    shape(ctx, PALETTE.deep, [[edge + 2, -86], [edge + 8, -85], [edge + 7, -82], [edge + 1, -82]]);
    // The near horn separates from the far horn as the head reaches profile.
    shape(ctx, PALETTE.ink, [[edge - 14, -119], [edge - 13, -133], [edge - 6, -146], [edge, -151], [edge + 2, -143], [edge - 2, -127], [edge - 7, -117]]);
    shape(ctx, PALETTE.purple, [[edge - 10, -125], [edge - 9, -133], [edge - 2, -144], [edge - 5, -129], [edge - 8, -123]]);
    ctx.restore();
  }
  ctx.restore();
  // Forearms rotate independently of the head/jaw and remain in front of the chest.
  for (const arm of arms) drawArmSegment(ctx, arm.elbow, arm.wrist, false);
  if (!options.arms) drawYetiHands(ctx, 0, 0, arms);
  ctx.restore();

  // The foreground rim masks the emergence joint.
  shape(ctx, PALETTE.snow, [[-69, 0], [-58, 3], [-54, 9], [-36, 9], [-28, 13], [30, 13], [39, 8], [57, 7], [62, 0], [70, 1], [62, 13], [32, 20], [-32, 20], [-62, 13]]);
  rect(ctx, PALETTE.lilac, -49, 10, 12, 3);
  rect(ctx, PALETTE.lilac, 35, 11, 11, 3);
  ctx.restore();
}

/** Ground-anchored tree, 50 × 73 px. Alternate variants add memecoin ornaments. */
export function drawTree(ctx: Context, x: number, y: number, variant = 0): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  shadow(ctx, 45, 5);
  rect(ctx, PALETTE.ink, -5, -15, 10, 17);
  rect(ctx, '#9f7392', -2, -13, 4, 13);
  shape(ctx, PALETTE.pineDark, [[0, -75], [12, -58], [8, -58], [20, -41], [13, -41], [28, -21], [24, -14], [6, -12], [0, -15], [-13, -11], [-28, -17], [-27, -22], [-15, -41], [-21, -41], [-8, -58], [-12, -58]]);
  shape(ctx, PALETTE.pine, [[0, -69], [9, -56], [4, -55], [17, -38], [9, -38], [23, -21], [8, -20], [0, -24], [-13, -18], [-22, -20], [-9, -38], [-16, -38], [-4, -55], [-9, -55]]);
  shape(ctx, PALETTE.snow, [[0, -75], [12, -58], [7, -54], [0, -57], [-5, -54], [-12, -58]]);
  shape(ctx, PALETTE.snow, [[-10, -48], [-2, -46], [7, -48], [20, -41], [11, -36], [3, -39], [-7, -36], [-21, -41]]);
  shape(ctx, PALETTE.snow, [[-17, -30], [-6, -29], [5, -31], [14, -28], [25, -23], [23, -18], [9, -21], [0, -18], [-13, -15], [-27, -20]]);
  rect(ctx, PALETTE.mint, -3, -48, 4, 4);
  rect(ctx, PALETTE.mint, 4, -29, 4, 4);
  if (variant % 3 === 1) {
    rect(ctx, PALETTE.pink, 10, -37, 5, 5);
    rect(ctx, PALETTE.green, -12, -25, 5, 5);
    rect(ctx, PALETTE.gold, 4, -16, 4, 4);
  }
  ctx.restore();
}

/** Center-anchored collectible. No connection to balance or cashout value. */
export function drawCoin(ctx: Context, x: number, y: number, time: number): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y + Math.sin(time / 210) * 2));
  const width = .7 + Math.abs(Math.cos(time / 330)) * .3;
  ctx.scale(width, 1);
  shape(ctx, PALETTE.ink, [[-5, -11], [5, -11], [10, -6], [10, 6], [5, 11], [-5, 11], [-10, 6], [-10, -6]]);
  shape(ctx, PALETTE.gold, [[-4, -8], [4, -8], [7, -4], [7, 4], [4, 8], [-4, 8], [-7, 4], [-7, -4]]);
  rect(ctx, PALETTE.white, -4, -7, 5, 2);
  rect(ctx, '#b48145', -2, -5, 4, 10);
  rect(ctx, '#b48145', -5, -2, 10, 4);
  rect(ctx, PALETTE.gold, -3, -1, 6, 2);
  ctx.restore();
}

export function drawRock(ctx: Context, x: number, y: number): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  shadow(ctx, 39, 5);
  shape(ctx, PALETTE.ink, [[-20, -5], [-17, -18], [-7, -25], [7, -25], [17, -17], [21, -4], [13, 1], [-12, 1]]);
  shape(ctx, '#9f91ae', [[-16, -7], [-13, -17], [-5, -22], [5, -21], [14, -14], [17, -5], [10, -3], [-11, -3]]);
  shape(ctx, PALETTE.snow, [[-17, -17], [-7, -27], [8, -25], [16, -16], [9, -13], [2, -16], [-5, -12]]);
  rect(ctx, '#756284', 3, -11, 8, 4);
  ctx.restore();
}

export function drawRug(ctx: Context, x: number, y: number): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  shadow(ctx, 63, 5);
  shape(ctx, PALETTE.ink, [[-28, -25], [24, -25], [35, -6], [30, 1], [-29, 1], [-36, -6]]);
  shape(ctx, PALETTE.pink, [[-25, -22], [21, -22], [30, -7], [26, -3], [-26, -3], [-31, -7]]);
  shape(ctx, PALETTE.purple, [[-19, -18], [17, -18], [23, -8], [-23, -8]]);
  stamp(ctx, PALETTE.gold, 'RUG', -11, -18, 2);
  for (let i = -24; i <= 24; i += 8) rect(ctx, PALETTE.ink, i, 0, 3, 5);
  rect(ctx, PALETTE.lilac, -22, -21, 43, 2);
  ctx.restore();
}

export function drawRamp(ctx: Context, x: number, y: number): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  shadow(ctx, 66, 5);
  shape(ctx, PALETTE.ink, [[-31, 0], [-24, -35], [22, -35], [33, -1], [28, 4], [-27, 4]]);
  shape(ctx, PALETTE.purple, [[-26, -1], [-20, -31], [19, -31], [28, -1]]);
  shape(ctx, PALETTE.lilac, [[-20, -30], [18, -30], [21, -23], [-22, -23]]);
  rect(ctx, PALETTE.green, -23, -7, 48, 5);
  shape(ctx, PALETTE.green, [[-3, -11], [-3, -21], [-11, -18], [0, -28], [11, -18], [4, -21], [4, -11]]);
  rect(ctx, PALETTE.snow, -18, -35, 36, 3);
  ctx.restore();
}

/** Resort sign; a second line makes the board taller, and `warn` paints it as a hazard notice. */
export function drawSign(ctx: Context, x: number, y: number, label: string, sub = '', warn = false): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  shadow(ctx, 31, 4);
  rect(ctx, PALETTE.ink, -4, -44, 8, 45);
  rect(ctx, '#b18ba3', -1, -40, 3, 40);
  ctx.font = 'bold 10px monospace';
  const width = Math.max(50, Math.min(108, Math.ceil(Math.max(ctx.measureText(label).width, ctx.measureText(sub).width)) + 16));
  const tall = sub ? 12 : 0;
  rect(ctx, PALETTE.ink, -width / 2 - 3, -61 - tall, width + 6, 27 + tall);
  rect(ctx, warn ? PALETTE.gold : PALETTE.green, -width / 2, -58 - tall, width, 21 + tall);
  rect(ctx, PALETTE.snow, -width / 2, -61 - tall, width - 8, 3);
  if (warn) for (const side of [-1, 1]) rect(ctx, PALETTE.pink, side < 0 ? -width / 2 : width / 2 - 4, -55 - tall, 4, 15 + tall);
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, -47 - tall, width - 12);
  if (sub) ctx.fillText(sub, 0, -46, width - 12);
  if (!warn) {
    rect(ctx, PALETTE.ink, -width / 2 + 3, -49 - tall / 2, 2, 2);
    rect(ctx, PALETTE.ink, width / 2 - 5, -49 - tall / 2, 2, 2);
  }
  ctx.restore();
}

/** A yeti footprint pressed into the snow, toes pointing along `dir`. */
export function drawPrint(ctx: Context, x: number, y: number, dir: number): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(dir, 1);
  shape(ctx, '#cfd2e4', [[-14, -6], [4, -9], [11, -5], [12, 3], [5, 8], [-14, 6], [-17, 0]]);
  shape(ctx, '#e1e3ef', [[-11, -3], [4, -5], [8, -2], [8, 2], [4, 4], [-11, 3]]);
  for (const toe of [-6, 0, 6]) rect(ctx, '#cfd2e4', 14, toe - 2, 5, 4);
  ctx.restore();
}

/** The chair's sideways sway, shared with whoever rides it. */
export const liftSway = (time: number) => Math.sin(time / 440) * 2;

/** A seated KOL in chair space, legs over the bench, phone out. */
function drawKol(ctx: Context): void {
  rect(ctx, PALETTE.ink, 24, -27, 6, 22);
  rect(ctx, PALETTE.ink, 32, -27, 6, 22);
  rect(ctx, PALETTE.ink, 22, -50, 18, 25);
  rect(ctx, PALETTE.gold, 24, -48, 14, 21);
  rect(ctx, PALETTE.ink, 23, -64, 16, 15);
  rect(ctx, PALETTE.orange, 25, -62, 12, 12);
  rect(ctx, PALETTE.ink, 22, -67, 18, 5);
  rect(ctx, PALETTE.pink, 24, -66, 14, 3);
  rect(ctx, PALETTE.ink, 25, -58, 12, 4);
  rect(ctx, PALETTE.green, 26, -57, 4, 2);
  rect(ctx, PALETTE.green, 32, -57, 4, 2);
  rect(ctx, PALETTE.ink, 17, -45, 9, 12);
  rect(ctx, PALETTE.white, 19, -43, 5, 8);
}

/** Ground-anchored rescue chairlift, approximately 106 × 140 px. A KOL rides along; `bubble` picks his speech side. */
export function drawLift(ctx: Context, x: number, y: number, time: number, bubble: -1 | 1 = 1): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  shadow(ctx, 76, 6);
  ctx.translate(liftSway(time), -5);
  rect(ctx, PALETTE.ink, -3, -133, 6, 57);
  rect(ctx, PALETTE.lilac, -1, -129, 2, 47);
  shape(ctx, PALETTE.ink, [[-3, -79], [4, -82], [40, -58], [44, -54], [44, -10], [37, -10], [37, -53]]);
  shape(ctx, PALETTE.ink, [[-39, -64], [35, -64], [35, -25], [-39, -25]]);
  rect(ctx, PALETTE.purple, -35, -60, 66, 32);
  rect(ctx, PALETTE.lilac, -32, -57, 60, 4);
  rect(ctx, PALETTE.deep, -32, -37, 60, 6);
  shape(ctx, PALETTE.ink, [[-44, -26], [34, -26], [44, -11], [39, -5], [-39, -5], [-46, -10]]);
  shape(ctx, PALETTE.green, [[-39, -22], [31, -22], [37, -12], [-39, -12]]);
  rect(ctx, PALETTE.ink, -43, -47, 5, 40);
  rect(ctx, PALETTE.ink, -42, -12, 86, 5);
  rect(ctx, PALETTE.ink, -48, -49, 16, 5);
  rect(ctx, PALETTE.ink, 32, -49, 16, 5);
  ctx.fillStyle = PALETTE.green;
  ctx.textAlign = 'center';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('EXIT LIFT', -1, -43);
  rect(ctx, PALETTE.green, -13, -139, 26, 8);
  rect(ctx, PALETTE.ink, -16, -142, 32, 3);
  drawKol(ctx);
  // He is still shilling as the jeet sits down.
  const left = bubble > 0 ? 12 : -110;
  rect(ctx, PALETTE.ink, left, -122, 98, 31);
  rect(ctx, PALETTE.white, left + 2, -120, 94, 27);
  const tail = bubble > 0 ? left + 18 : left + 80;
  shape(ctx, PALETTE.ink, [[tail - 7, -92], [tail + 7, -92], [29, -66]]);
  shape(ctx, PALETTE.white, [[tail - 4, -94], [tail + 4, -94], [29, -71]]);
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('WHY SELL?', left + 49, -113, 90);
  ctx.fillText('100× SOON, SER', left + 49, -101, 90);
  ctx.restore();
}
