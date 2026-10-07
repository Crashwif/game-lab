export interface ApplicantPose {
  time: number;
  tension: number;
  stage: number;
  level: number;
  action: number;
  x: number;
  y: number;
  scale: number;
  reduced: boolean;
  mode: 'idle' | 'scan' | 'dance' | 'escape' | 'boxed';
  progress: number;
}

type Point = { x: number; y: number };
const INK = '#142b32';
const CREAM = '#fff4dc';
const SKIN = '#f8dcbc';
const SKIN_SHADE = '#d7a88c';
const CORAL = '#f47b50';
const TEAL = '#39c6b4';
const LIME = '#d4ed71';
const TAU = Math.PI * 2;
const clamp = (n: number, a = 0, b = 1): number => Math.max(a, Math.min(b, n));
const ease = (n: number): number => { const t = clamp(n); return t * t * (3 - 2 * t); };

function openingReaction(pose: ApplicantPose): { active: boolean; grin: number; recoil: number; glance: number } {
  if (pose.mode !== 'scan' || pose.stage !== 0) return { active: false, grin: 0, recoil: 0, glance: 0 };
  if (pose.reduced) return { active: true, grin: 0.55, recoil: 0, glance: 0 };
  const a = clamp(pose.action);
  const grin = ease((a - 0.18) / 0.16) * (1 - ease((a - 0.64) / 0.14));
  const recoil = ease((a - 0.64) / 0.05) * (1 - ease((a - 0.76) / 0.18));
  const glance = ease(a / 0.09) * (1 - ease((a - 0.2) / 0.12));
  return { active: true, grin, recoil, glance };
}

function shape(ctx: CanvasRenderingContext2D, d: string, fill: string | CanvasGradient, width = 2.8, stroke = INK): void {
  const path = new Path2D(d);
  ctx.fillStyle = fill;
  ctx.fill(path);
  if (width > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke(path);
  }
}

function line(ctx: CanvasRenderingContext2D, d: string, colour = INK, width = 2): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke(new Path2D(d));
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, width = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
  if (width) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function joint(root: Point, end: Point, upper: number, lower: number, side: number): Point {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = clamp(distance, Math.abs(upper - lower) + 0.01, upper + lower - 0.01);
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return { x: root.x + (dx * along - dy * bend) / distance, y: root.y + (dy * along + dx * bend) / distance };
}

function limb(ctx: CanvasRenderingContext2D, a: Point, b: Point, c: Point, width: number, colour: string): void {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 5;
  ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
}

function shoe(ctx: CanvasRenderingContext2D, at: Point, side: number, lift: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(side * lift * 0.017);
  ctx.scale(side, 1);
  shape(ctx, 'M-9 -9 Q-2 -13 7 -7 L12 -2 Q24 -2 25 7 Q25 13 17 13 L-11 13 Q-17 9 -13 1 Z', '#344f56', 2.7);
  shape(ctx, 'M-14 5 Q1 9 24 5 L24 11 Q9 16 -12 12 Z', CREAM, 2);
  shape(ctx, 'M-6 -8 L2 -8 L6 1 L-6 0 Z', TEAL, 1.5);
  line(ctx, 'M3 -5 L10 -4 M4 -1 L12 0', CREAM, 1.7);
  line(ctx, 'M-7 10 L-3 10 M2 11 L6 11 M11 10 L15 10', '#bac6ac', 1.1);
  ctx.restore();
}

function hand(ctx: CanvasRenderingContext2D, at: Point, angle: number, open: boolean, side: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  ctx.scale(side, 1);
  if (open) {
    shape(ctx, 'M-7 5 L-8 -3 Q-14 -9 -11 -12 Q-8 -13 -4 -6 L-4 -17 Q-3 -21 0 -18 L2 -8 L3 -21 Q6 -24 8 -20 L8 -7 L11 -17 Q15 -20 16 -15 L13 -3 Q18 -10 20 -6 Q21 -3 15 5 Q11 12 4 12 Q-3 12 -7 5Z', SKIN, 2.3);
    line(ctx, 'M-2 2 Q4 -2 10 2 M3 4 L7 6', SKIN_SHADE, 1.3);
  } else {
    shape(ctx, 'M-7 -7 Q-1 -11 4 -8 Q11 -10 12 -4 L13 4 Q12 11 3 12 Q-7 12 -8 5 L-12 1 Q-14 -5 -10 -5 L-7 -2Z', SKIN, 2.4);
    line(ctx, 'M0 -6 L1 0 M5 -6 L6 0 M-7 3 Q-3 0 0 3', SKIN_SHADE, 1.3);
  }
  ctx.restore();
}

function arm(ctx: CanvasRenderingContext2D, shoulder: Point, wrist: Point, side: number, open: boolean, darker: boolean): void {
  const elbow = joint(shoulder, wrist, 29, 30, side);
  const colour = darker ? '#d56445' : CORAL;
  limb(ctx, shoulder, elbow, wrist, 19, colour);
  line(ctx, `M${elbow.x - 4} ${elbow.y - 3} L${elbow.x + 5} ${elbow.y + 1}`, darker ? '#b44b37' : '#d06141', 2.5);
  const angle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x) - Math.PI / 2;
  ctx.save();
  ctx.translate(wrist.x, wrist.y);
  ctx.rotate(angle);
  shape(ctx, 'M-10 -8 L10 -8 L9 2 L-9 2Z', darker ? '#b85039' : '#de603c', 1.8);
  for (let i = -5; i <= 5; i += 5) line(ctx, `M${i} -6 L${i} 0`, '#fca47a', 1);
  ctx.restore();
  hand(ctx, { x: wrist.x + Math.sin(-angle) * 7, y: wrist.y + Math.cos(angle) * 7 }, angle, open, side);
}

function badge(ctx: CanvasRenderingContext2D, time: number, dancing: boolean, tension: number): void {
  const sway = Math.sin(time * (dancing ? 6.3 : 2.1) - 0.8) * (dancing ? 0.23 : 0.045 + tension * 0.025);
  ctx.save();
  ctx.translate(3, -140);
  ctx.rotate(sway);
  line(ctx, 'M-10 0 L-6 35 L5 43 L13 31 L15 -1', INK, 4);
  line(ctx, 'M-10 0 L-6 35 L5 43 L13 31 L15 -1', TEAL, 2);
  ctx.translate(5, 43);
  ctx.rotate(-sway * 0.45);
  shape(ctx, 'M-12 -1 Q-14 -1 -14 2 L-14 24 Q-14 27 -11 27 L14 27 Q17 27 17 24 L17 2 Q17 -1 14 -1Z', CREAM, 1.8);
  shape(ctx, 'M-13 0 L16 0 L16 5 L-13 5 Z', TEAL, 0);
  shape(ctx, 'M-10 9 L-1 9 L-1 19 L-10 19 Z', '#d8e3ce', 0);
  oval(ctx, -5.5, 12, 2, 2, INK);
  shape(ctx, 'M-9 19 Q-9 14 -5 14 Q-2 14 -2 19Z', INK, 0);
  line(ctx, 'M3 10 L12 10 M3 14 L10 14 M3 18 L12 18 M-10 23 L12 23', '#80958d', 1.1);
  for (let i = 0; i < 5; i += 1) line(ctx, `M${-8 + i * 4} 23 L${-8 + i * 4} 25`, INK, i % 2 === 0 ? 1 : 2);
  ctx.restore();
}

function face(ctx: CanvasRenderingContext2D, pose: ApplicantPose, time: number, headAngle: number): void {
  const fear = clamp(pose.tension);
  const escaping = pose.mode === 'escape';
  const boxed = pose.mode === 'boxed';
  const scanning = pose.mode === 'scan';
  const clown = pose.level >= 3;
  const reaction = openingReaction(pose);
  ctx.save();
  ctx.rotate(headAngle);
  ctx.scale(1 + reaction.grin * 0.055 + reaction.recoil * 0.105, 1 - reaction.grin * 0.025 - reaction.recoil * 0.1);
  oval(ctx, -31, 2, 7, 11, SKIN_SHADE, 2.4);
  oval(ctx, 31, 3, 6, 10, SKIN, 2.4);
  line(ctx, 'M-33 -1 Q-27 -4 -28 5 M32 0 L30 6', '#b98670', 1.8);
  const skin = ctx.createLinearGradient(-29, -30, 31, 35);
  skin.addColorStop(0, '#fff0d2');
  skin.addColorStop(0.64, SKIN);
  skin.addColorStop(1, '#edbf9b');
  shape(ctx, 'M-29 -18 Q-31 -34 -7 -38 Q20 -39 29 -23 L31 12 Q29 31 12 36 Q-9 40 -23 26 Q-33 15 -29 -18Z', skin, 3.2);
  shape(ctx, 'M-28 4 Q-22 16 -23 22 Q-20 32 -5 36 Q-23 34 -28 23Z', SKIN_SHADE, 0);

  if (pose.level >= 5) {
    shape(ctx, 'M-20 -19 Q-15 -25 -7 -17 Q-4 -3 -8 11 L-18 12 Q-25 -3 -20 -19Z', CREAM, 0);
    shape(ctx, 'M8 -20 Q17 -25 25 -14 L26 7 L13 12 Q6 -1 8 -20Z', CREAM, 0);
    shape(ctx, 'M-21 12 L-12 25 L-8 12Z', TEAL, 0);
    shape(ctx, 'M13 12 L21 26 L26 10Z', TEAL, 0);
  }
  oval(ctx, -17, 11, 7, 3, '#e8baaa');
  oval(ctx, 24, 11, 6, 3, '#e8baaa');

  const blinkClock = time % 5.6;
  const blinking = !pose.reduced && blinkClock > 4.8 && blinkClock < 4.95 && !scanning;
  const eyeH = blinking ? 1.1 : escaping ? 8.6 : boxed ? 12 : 10.8 + fear * 2 + reaction.grin * 2.1 + reaction.recoil * 1.4;
  const look = escaping ? 4 : boxed ? -1 : reaction.active ? reaction.glance * 5 - reaction.recoil * 2 : scanning ? Math.sin(time * 0.6) * 1.3 : Math.sin(time * 0.9) * 2.5;
  for (const [x, width] of [[-13, 10.5], [17, 11.5]]) {
    oval(ctx, x, -1, width, eyeH, '#fffef5', 2.2);
    if (!blinking) {
      oval(ctx, x + look + 1, fear > 0.8 ? -1 : 1, 3.8, Math.min(5, eyeH * 0.68), INK);
      oval(ctx, x + look + 2, -1, 1.1, 1.4, '#ffffff');
    }
    if (!scanning && !boxed && !blinking && fear < 0.35) {
      shape(ctx, `M${x - width} -4 Q${x} ${-12 - fear * 4} ${x + width} -4 Z`, SKIN, 1.2);
    }
    line(ctx, `M${x - width + 3} ${eyeH + 3} Q${x + 1} ${eyeH + 6} ${x + width - 1} ${eyeH + 2}`, '#b98980', 1.4);
  }
  const brow = escaping ? -1 : 2 + fear * 5 + reaction.grin * 5 + reaction.recoil * 4;
  line(ctx, `M-25 ${-17 - brow * 0.2} Q-16 ${-20 - brow} -5 ${-16 - brow}`, INK, 3.4);
  line(ctx, `M8 ${-17 - brow} Q19 ${-23 - brow} 27 ${-17 - brow * 0.3}`, INK, 3.4);

  if (clown) {
    const nose = ctx.createRadialGradient(5, 9, 1, 7, 12, 11);
    nose.addColorStop(0, '#efffa9');
    nose.addColorStop(0.52, LIME);
    nose.addColorStop(1, '#86aa48');
    shape(ctx, 'M-3 11 Q-3 1 7 1 Q19 2 18 12 Q17 22 7 22 Q-3 21 -3 11Z', nose, 2.4);
    oval(ctx, 4, 6, 3, 1.7, '#ffffff');
  } else {
    shape(ctx, 'M3 2 L0 11 Q5 15 11 11', '#efc19b', 1.6, '#bd8c72');
  }

  if (pose.level >= 7) {
    shape(ctx, 'M-10 23 Q4 18 21 23 Q19 36 6 36 Q-6 36 -10 23Z', CREAM, 0);
  }
  if (boxed) {
    shape(ctx, 'M-1 24 Q6 21 13 24 L12 31 L0 31Z', INK, 1.4);
    shape(ctx, 'M0 24 L12 24 L12 27 L0 27Z', CREAM, 0);
  } else if (escaping) {
    shape(ctx, 'M-6 23 Q5 27 20 20 Q17 33 5 32 Q-3 31 -6 23Z', INK, 1.7);
    shape(ctx, 'M-4 24 Q6 27 18 22 L16 27 Q7 30 -1 27Z', CREAM, 0);
  } else if (reaction.active) {
    const spread = 10 + reaction.grin * 15 - reaction.recoil * 3;
    const left = 5 - spread;
    const right = 5 + spread;
    const top = 24 - reaction.grin * 5;
    const depth = 8 + reaction.grin * 6 - reaction.recoil * 4;
    shape(ctx, `M${left} ${top} Q5 ${top + 5} ${right} ${top - 2} Q${right - 2} ${top + depth} 5 ${top + depth + 1} Q${left + 2} ${top + depth} ${left} ${top}Z`, INK, 1.8);
    shape(ctx, `M${left + 2} ${top + 1} Q5 ${top + 6} ${right - 2} ${top} L${right - 4} ${top + 5} Q5 ${top + 9} ${left + 4} ${top + 5}Z`, CREAM, 0);
    for (let i = -2; i <= 2; i += 1) {
      const tooth = 5 + i * spread * 0.26;
      line(ctx, `M${tooth} ${top + 3} L${tooth} ${top + 6}`, '#9bab98', 0.8);
    }
    if (reaction.grin > 0.3) {
      line(ctx, `M${left - 3} ${top - 2} L${left - 1} ${top + 4} M${right + 2} ${top - 4} L${right + 1} ${top + 2}`, '#b98670', 1.5);
    }
  } else if (fear > 0.65 || pose.mode === 'dance') {
    shape(ctx, 'M-4 24 Q6 18 17 24 L16 31 Q7 34 -3 31Z', INK, 1.5);
    shape(ctx, 'M-3 24 Q6 21 16 24 L15 27 L-2 27Z', CREAM, 0);
    line(ctx, 'M2 23 L2 27 M8 23 L8 27', '#8d9a8b', 0.8);
  } else {
    line(ctx, `M-5 27 Q6 ${22 - fear * 5} 16 27`, INK, 2.4);
    line(ctx, 'M-7 25 L-6 29 M16 25 L17 28', SKIN_SHADE, 1.3);
  }
  for (let i = 0; i < 6; i += 1) {
    const x = -14 + i * 6;
    line(ctx, `M${x} 31 L${x + 0.3} 32.7`, '#a78473', 0.9);
  }

  const hairSway = pose.reduced ? 0 : Math.sin(time * 3.1 - 0.5) * (pose.mode === 'dance' ? 3 : 0.8);
  shape(ctx, `M-29 4 Q-36 -6 -31 -23 L-38 -26 L-29 -31 Q-31 -42 -19 -44 L-20 -50 Q-7 -47 1 -52 Q19 -60 37 ${-41 + hairSway} L28 -41 Q39 -32 26 -24 Q7 -18 -12 -30 Q-18 -12 -24 -12 L-24 2Z`, INK, 2.6);
  shape(ctx, 'M-20 -37 Q-1 -40 9 -44 Q18 -47 28 -40 Q7 -37 -1 -33Z', '#36545a', 0);
  line(ctx, 'M-25 -28 Q-18 -37 -10 -37 M-15 -28 Q1 -24 14 -28', '#547177', 1.4);

  if (fear > 0.3 && !escaping) {
    const drop = pose.reduced ? 0.45 : (time * (0.7 + fear * 0.4)) % 1;
    ctx.save();
    ctx.translate(-36, -10 + drop * 27);
    shape(ctx, 'M0 -7 Q-6 1 -4 4 Q0 8 4 4 Q6 1 0 -7Z', '#79d7d2', 1.3);
    line(ctx, 'M-1 0 L-2 3', CREAM, 1.2);
    ctx.restore();
  }
  ctx.restore();
}

function foil(ctx: CanvasRenderingContext2D, time: number, reduced: boolean): void {
  const flutter = reduced ? 0 : Math.sin(time * 12) * 4;
  const silver = ctx.createLinearGradient(-55, -135, 52, -65);
  silver.addColorStop(0, '#d5e6dc');
  silver.addColorStop(0.28, '#ffffed');
  silver.addColorStop(0.48, '#77979b');
  silver.addColorStop(0.58, '#eef8e1');
  silver.addColorStop(1, '#9cb8b5');
  shape(ctx, `M-14 -157 L17 -159 L45 -137 L${61 + flutter} -67 L27 -76 L15 -58 L-6 -71 L-43 -61 L-51 -81 L-38 -138Z`, silver, 3);
  shape(ctx, 'M-14 -151 L-32 -130 L-8 -111 L-22 -71 L-2 -95 L5 -125Z', '#eff4e2', 0);
  shape(ctx, 'M17 -151 L13 -121 L34 -94 L25 -132Z', '#729596', 0);
  line(ctx, 'M-32 -130 L-8 -111 L-2 -95 M13 -121 L34 -94 L43 -74 M-39 -91 L-22 -101 M-14 -151 L5 -125 L-1 -72 M24 -144 L35 -127 L40 -132', '#5d7f81', 1.4);
  line(ctx, 'M-25 -120 L-37 -127 M0 -143 L6 -134 M23 -111 L30 -104 M14 -86 L21 -78', '#ffffff', 2);
  shape(ctx, 'M-5 -148 L8 -148 L9 -140 L-5 -140Z', TEAL, 1.8);
}

/** Articulated applicant; presentation follows the supplied room pose. */
export function drawApplicant(ctx: CanvasRenderingContext2D, pose: ApplicantPose): void {
  const t = pose.reduced ? 0 : pose.time;
  const fear = clamp(pose.tension);
  const dancing = pose.mode === 'dance';
  const escaping = pose.mode === 'escape';
  const boxed = pose.mode === 'boxed';
  const scanning = pose.mode === 'scan';
  const reaction = openingReaction(pose);
  const cycle = pose.reduced ? 0 : clamp(pose.action) * TAU;
  const groove = Math.sin(t * (dancing ? 6.3 : escaping ? 13 : 2.1));
  const sway = dancing ? groove * 11 : escaping ? 7 : Math.sin(t * 1.2) * 2.5;
  const bounce = dancing ? Math.abs(groove) * -6 : escaping ? -Math.abs(groove) * 5 : Math.sin(t * 2.1) * 1.6;
  const hip = { x: sway * 0.4, y: -67 + bounce };
  const chest = { x: sway, y: -132 + bounce };
  const headX = chest.x + (scanning && pose.stage % 3 === 1 ? 7 : 3) + reaction.glance * 3 - reaction.recoil * 2;
  const headY = -184 + bounce + (boxed ? clamp(pose.progress) * 9 : 0) - reaction.grin * 3 + reaction.recoil * 7;
  const headAngle = escaping ? 0.05 : boxed ? -0.045 : dancing ? -groove * 0.105 : reaction.active ? reaction.glance * 0.085 - reaction.recoil * 0.07 : scanning ? Math.sin(cycle) * 0.06 : Math.sin(t * 1.2 - 0.7) * 0.03;

  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.scale(pose.scale, pose.scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (boxed) {
    ctx.translate(headX, headY);
    shape(ctx, 'M-14 29 L-14 50 L18 50 L15 29Z', SKIN, 2.5);
    face(ctx, pose, t, headAngle);
    ctx.restore();
    return;
  }

  for (const side of [-1, 1]) {
    const step = dancing ? Math.sin(t * 6.3 + side * Math.PI / 2) : escaping ? Math.sin(t * 13 + (side < 0 ? Math.PI : 0)) : 0;
    const lift = Math.max(0, step) * (dancing ? 12 : escaping ? 20 : 0);
    const foot = { x: side * (dancing ? 29 : 19) + step * (escaping ? 19 : 5), y: -11 - lift };
    const pelvis = { x: hip.x + side * 13, y: hip.y };
    const knee = joint(pelvis, foot, 33, 34, side);
    limb(ctx, pelvis, knee, foot, side < 0 ? 17 : 18, side < 0 ? '#20393f' : '#2a444c');
    line(ctx, `M${knee.x - 4} ${knee.y + 1} L${knee.x + 4} ${knee.y + 3}`, '#567077', 1.5);
    shoe(ctx, foot, side, lift);
  }

  const leftShoulder = { x: chest.x - 28, y: chest.y + 5 };
  const rightShoulder = { x: chest.x + 26, y: chest.y + 6 };
  let left = { x: chest.x - 44, y: -83 + bounce + Math.sin(t * 2.1 - 0.6) * 3 };
  let right = { x: chest.x + 44, y: -88 + bounce - Math.sin(t * 2.1 - 0.6) * 3 };
  let open = scanning || dancing;
  if (dancing) {
    const disco = Math.sin(t * 3.15);
    left = { x: chest.x - 51 - groove * 9, y: chest.y - 13 + disco * 25 };
    right = { x: chest.x + 50 - groove * 9, y: chest.y - 13 - disco * 25 };
  } else if (scanning) {
    const station = pose.stage % 3;
    if (station === 0) {
      left = { x: chest.x - 48, y: chest.y - 32 + Math.sin(cycle) * 4 };
      right = { x: chest.x + 47, y: chest.y - 30 - Math.sin(cycle) * 4 };
    } else if (station === 1) {
      left = { x: chest.x - 24, y: chest.y - 43 };
      right = { x: chest.x + 51, y: chest.y + 29 };
    } else {
      left = { x: chest.x - 56, y: chest.y + 6 + Math.sin(cycle) * 5 };
      right = { x: chest.x + 55, y: chest.y - 5 - Math.sin(cycle) * 7 };
    }
  } else if (escaping) {
    left = { x: chest.x - 43 + groove * 7, y: chest.y + 19 + groove * 14 };
    right = { x: chest.x + 46 - groove * 7, y: chest.y + 12 - groove * 14 };
    open = false;
  }

  arm(ctx, leftShoulder, left, -1, open, true);
  ctx.save();
  ctx.translate(chest.x, bounce);
  shape(ctx, 'M-17 -145 Q-32 -147 -37 -129 Q-41 -108 -34 -82 L-30 -66 Q2 -56 33 -68 L35 -103 Q35 -126 25 -139 L14 -146Z', CORAL, 3);
  shape(ctx, 'M-34 -123 Q-27 -110 -23 -80 L-13 -64 L-30 -67 L-35 -84Z', '#d96545', 0);
  shape(ctx, 'M-16 -145 Q-27 -150 -28 -160 Q-4 -167 20 -158 Q26 -151 17 -142 L5 -136Z', '#cc5a40', 2.8);
  shape(ctx, 'M-12 -157 L-10 -144 Q2 -134 16 -145 L15 -159Z', SKIN_SHADE, 2.3);
  shape(ctx, 'M-23 -73 Q4 -68 33 -76 L32 -65 Q4 -57 -29 -65Z', '#df6341', 2.2);
  for (let i = -20; i < 28; i += 7) line(ctx, `M${i} -67 L${i} -62`, '#f9a07b', 1);
  shape(ctx, 'M-13 -99 Q3 -103 21 -100 L26 -83 Q4 -77 -20 -84Z', '#ed7049', 1.8, '#c5563c');
  line(ctx, 'M-13 -98 L-18 -86 M20 -99 L24 -87', '#ffa982', 1.8);
  line(ctx, 'M-12 -141 L-11 -119 M16 -141 L19 -119', CREAM, 2.2);
  line(ctx, 'M-11 -121 L-11 -116 M19 -121 L20 -116', INK, 2.8);
  shape(ctx, 'M-29 -120 L-20 -123 L-18 -115 L-28 -112Z', CREAM, 1.2);
  line(ctx, 'M-25 -119 L-23 -114 M-28 -116 L-21 -117', INK, 1.3);
  badge(ctx, t, dancing, fear);
  if (escaping) foil(ctx, t, pose.reduced);
  ctx.restore();
  arm(ctx, rightShoulder, right, 1, open, false);

  ctx.save();
  ctx.translate(headX, headY);
  if (escaping) {
    shape(ctx, 'M-42 14 L-39 -18 L-10 -58 L14 -63 L42 -24 L42 17 L27 30 L-25 31Z', '#adc7c4', 3);
    shape(ctx, 'M-39 -18 L-10 -58 L-18 -14 L-30 20Z', '#f3f6df', 0);
    line(ctx, 'M14 -63 L11 -42 L32 -25 M-10 -58 L-5 -44 M35 -8 L40 17 L27 30', '#6f9395', 1.4);
  }
  face(ctx, pose, t, headAngle);
  ctx.restore();
  ctx.restore();
}

/** The witness remains unimpressed by the applicant's verification ordeal. */
export function drawDog(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, tension: number, reduced: boolean): void {
  const t = reduced ? 0 : time;
  const bob = Math.sin(t * 1.4) * 0.5;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  line(ctx, `M-15 -12 Q-32 ${-12 - Math.sin(t * 2) * 4} -29 -28`, INK, 8);
  line(ctx, `M-15 -12 Q-32 ${-12 - Math.sin(t * 2) * 4} -29 -28`, '#c9a17d', 4);
  shape(ctx, 'M-15 -28 Q-24 -13 -17 -4 L-19 0 L-6 0 L-3 -12 L1 0 L15 0 L12 -6 Q17 -22 10 -29Z', '#ead1aa', 2.4);
  shape(ctx, 'M-10 -28 L8 -28 L6 -14 L-4 -12Z', CREAM, 0);
  shape(ctx, 'M-17 -49 Q-1 -59 17 -47 L17 -25 Q11 -15 -7 -18 Q-22 -23 -17 -49Z', '#ead1aa', 2.4);
  shape(ctx, 'M-15 -49 Q-31 -46 -29 -29 Q-29 -19 -19 -22 L-12 -44Z', '#725a48', 2.3);
  shape(ctx, 'M12 -49 Q24 -45 24 -31 Q25 -25 18 -23 L12 -42Z', '#725a48', 2.3);
  shape(ctx, 'M-12 -37 Q-4 -44 4 -34 L12 -30 Q17 -23 6 -20 Q-10 -19 -14 -26Z', CREAM, 0);
  oval(ctx, -5, -35, 3, 3.5, INK);
  oval(ctx, 10, -35, 2.5, 3.5, INK);
  line(ctx, 'M-10 -38 L-1 -37 M7 -38 L13 -39', INK, 2.6);
  shape(ctx, 'M-3 -29 Q3 -32 7 -29 Q8 -26 3 -24 Q-2 -25 -3 -29Z', INK, 1);
  line(ctx, 'M3 -24 L3 -21 M-1 -21 L8 -21', INK, 1.4);
  shape(ctx, 'M-7 -16 L8 -16 L6 -11 L-5 -11Z', TEAL, 1.5);
  shape(ctx, 'M0 -13 L5 -12 L6 -2 L2 2 L-2 -2Z', INK, 1.3);
  line(ctx, 'M1 -8 L3 -6', TEAL, 1.2);
  if (tension > 0.6) line(ctx, 'M-9 -43 Q-4 -45 0 -42', INK, 1.8);
  ctx.restore();
}
