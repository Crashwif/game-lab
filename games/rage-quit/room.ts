import { box, burst, clamp, ease, face, GOLD, GREEN, INK, label, line, mono, mug, PAPER, RED, shape } from './ink';

export const ANNOYANCES = [
  ['UPDATE AVAILABLE', 'Restart to restart your restart.'],
  ['ARE YOU A ROBOT?', 'Select every square with patience.'],
  ['ONE MORE POP-UP', 'Congratulations! It is another tab.'],
  ['PASSWORD EXPIRED', 'Try the one you just forgot.'],
  ['PRINTER OFFLINE', 'There is no printer in this room.'],
  ['STILL BUFFERING', 'Your patience is very important.'],
  ['ACCEPT COOKIES?', 'There are no actual cookies.'],
  ['KEYBOARD DISCONNECTED', 'Press any key to continue.'],
] as const;

export interface RoomPose {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  time: number;
  tension: number;
  crashAge: number;
  safe: boolean;
  reduced: boolean;
  annoyance: number;
}

function wallpaper(ctx: CanvasRenderingContext2D, pose: RoomPose): void {
  const crashed = pose.phase === 'crashed';
  box(ctx, 24, 116, 647, 308, crashed ? '#f3cfac' : '#e9e3d1', 3);
  ctx.save();
  ctx.beginPath();
  ctx.rect(26, 118, 643, 304);
  ctx.clip();
  // Offset print dots, trim and floorboards build the room without bitmap assets.
  ctx.fillStyle = '#c5bba2';
  for (let x = 37; x < 670; x += 17) {
    for (let y = 128; y < 380; y += 17) ctx.fillRect(x + (y % 2) * 5, y, 1.5, 1.5);
  }
  ctx.fillStyle = '#d4c7a6';
  ctx.fillRect(24, 378, 647, 48);
  line(ctx, [[24, 377], [671, 377]], INK, 3);
  for (let i = 0; i < 9; i += 1) line(ctx, [[74 + i * 78, 378], [34 + i * 89, 429]], '#b2a483', 1.2);
  line(ctx, [[25, 402], [671, 402]], '#b2a483', 1.2);
  // A crooked motivational print and an exhausted desk plant.
  ctx.save();
  ctx.translate(86, 226);
  ctx.rotate(-0.09);
  box(ctx, -36, -44, 72, 90, PAPER, 3);
  label(ctx, 'KEEP', 0, -22, 15, INK, 64, 'center');
  label(ctx, 'CALM', 0, -3, 15, INK, 64, 'center');
  line(ctx, [[-23, 5], [24, -10]], RED, 4);
  label(ctx, 'ISH.', 0, 23, 21, RED, 64, 'center');
  ctx.restore();
  box(ctx, 601, 330, 39, 48, RED, 3);
  line(ctx, [[619, 330], [619, 271], [603, 263]], INK, 4);
  line(ctx, [[619, 300], [638, 282]], INK, 4);
  shape(ctx, [[619, 289], [623, 268], [638, 267], [636, 279]], GREEN, 2);
  shape(ctx, [[619, 314], [597, 295], [593, 310], [613, 322]], GREEN, 2);
  label(ctx, 'TRY.', 620, 351, 13, PAPER, 32, 'center');
  ctx.restore();
}

function monitor(ctx: CanvasRenderingContext2D, pose: RoomPose, x = 477, y = 295, angle = 0): void {
  const crashed = pose.phase === 'crashed';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  shape(ctx, [[-70, -73], [52, -74], [71, -49], [69, 30], [53, 43], [-68, 38], [-79, 16]], '#99947e', 4);
  box(ctx, -66, -61, 115, 80, INK, 3);
  ctx.fillStyle = crashed ? '#e75635' : '#d3dfaa';
  ctx.fillRect(-58, -53, 99, 64);
  if (crashed) {
    line(ctx, [[-55, -49], [-13, -16], [6, -31], [37, 5]], INK, 4);
    line(ctx, [[-13, -16], [-35, 6]], INK, 3);
    line(ctx, [[4, -29], [10, -50]], INK, 3);
    line(ctx, [[-3, -7], [3, 8]], INK, 2);
  } else {
    mono(ctx, 'PLEASE WAIT', -49, -36, 12, INK, 90);
    mono(ctx, pose.phase === 'running' ? '...FOREVER' : '...READY?', -49, -17, 12, INK, 90);
    box(ctx, -49, -2, 76, 7, PAPER, 1.5);
    const cursor = pose.reduced ? 23 : (pose.time * 21) % 52;
    ctx.fillStyle = RED;
    ctx.fillRect(-48 + cursor, -1, 19, 5);
  }
  box(ctx, -14, 41, 27, 17, '#aaa088', 3);
  shape(ctx, [[-40, 57], [35, 57], [45, 68], [-47, 68]], '#aaa088', 3);
  ctx.fillStyle = crashed ? RED : GREEN;
  ctx.fillRect(52, 15, 6, 6);
  for (let i = 0; i < 4; i += 1) line(ctx, [[54, -36 + i * 7], [64, -36 + i * 7]], INK, 1.5);
  ctx.restore();
}

function desk(ctx: CanvasRenderingContext2D, pose: RoomPose): void {
  const crashed = pose.phase === 'crashed';
  const end = crashed ? (pose.reduced ? 1 : ease(pose.crashAge / 0.8)) : 0;
  ctx.save();
  ctx.translate(300, 367);
  ctx.rotate(-end * 0.86);
  ctx.translate(-300, -367);
  shape(ctx, [[279, 372], [301, 371], [306, 420], [285, 420]], '#a69b7e', 3);
  shape(ctx, [[558, 372], [579, 371], [571, 420], [554, 420]], '#a69b7e', 3);
  shape(ctx, [[265, 357], [585, 351], [598, 374], [264, 379]], '#bdad85', 4);
  line(ctx, [[280, 367], [571, 361]], INK, 2);
  // The cable follows the table and remains inside the panel during the flip.
  ctx.beginPath();
  ctx.moveTo(535, 348);
  ctx.bezierCurveTo(595, 359, 596, 410, 540, 414);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  const releaseTime = 0.22;
  if (!crashed || (!pose.reduced && pose.crashAge <= releaseTime)) monitor(ctx, pose);
  const keyTap = pose.reduced || pose.phase !== 'running' ? 0 : Math.sin(pose.time * 21) * pose.tension;
  shape(ctx, [[324, 343 + keyTap], [411, 341], [427, 357], [321, 360 + keyTap]], PAPER, 3);
  for (let row = 0; row < 2; row += 1) {
    for (let k = 0; k < 9; k += 1) {
      ctx.fillStyle = k === pose.annoyance ? RED : '#978d75';
      ctx.fillRect(330 + k * 9 + row * 3, 346 + row * 6, 5, 3);
    }
  }
  if (!pose.safe) mug(ctx, 292, 350, pose.time);
  ctx.restore();
  if (crashed && (pose.reduced || pose.crashAge > releaseTime)) {
    // The CRT leaves the desk with the same pose at the release instant.
    const angle = -0.86 * ease(releaseTime / 0.8);
    const releaseX = 300 + 177 * Math.cos(angle) + 72 * Math.sin(angle);
    const releaseY = 367 + 177 * Math.sin(angle) - 72 * Math.cos(angle);
    const flight = pose.reduced ? 1.07 : clamp(pose.crashAge - releaseTime, 0, 1.07);
    monitor(ctx, pose, releaseX + 95 * (1 - Math.exp(-3 * flight)), releaseY - 180 * flight + 225 * flight * flight, angle + flight * 1.5);
  }
}

function body(ctx: CanvasRenderingContext2D, pose: RoomPose): void {
  const crashed = pose.phase === 'crashed';
  const end = crashed ? (pose.reduced ? 1 : ease(pose.crashAge / 0.4)) : 0;
  const time = pose.reduced ? 0 : pose.time;
  const energy = pose.safe ? 0 : pose.tension;
  const pulse = pose.phase === 'running' ? Math.sin(time * 7) * energy : 0;
  const headX = pose.safe ? 179 : 207 + energy * 9;
  const headY = 252 + pulse * 2 - (!pose.safe ? end * 15 : 0);
  // Chair and shoes ground the seated rig.
  box(ctx, 136, 290, 97, 78, '#9eaa9b', 4);
  line(ctx, [[148, 364], [227, 364]], INK, 10);
  line(ctx, [[163, 373], [164, 416]], INK, 6);
  line(ctx, [[219, 371], [237, 416]], INK, 6);
  shape(ctx, [[187, 354], [241, 355], [248, 384], [272, 401], [245, 410], [220, 390], [205, 377]], INK, 3);
  shape(ctx, [[176, 353], [203, 357], [183, 397], [165, 411], [143, 403], [163, 385]], INK, 3);
  line(ctx, [[143, 410], [166, 414], [175, 409]], PAPER, 3);
  line(ctx, [[249, 412], [278, 410]], PAPER, 3);
  shape(ctx, [[165, 290], [212, 288], [245, 311], [246, 358], [171, 362], [153, 332]], pose.safe ? GREEN : RED, 4);
  label(ctx, pose.safe ? 'OFF' : 'ON', 199, 330, 22, pose.safe ? INK : PAPER, 56, 'center');
  face(ctx, headX, headY, 0.92, energy, crashed && !pose.safe, pose.safe, pose.reduced ? 0 : pulse * 0.008 - end * 0.04);
  if (!pose.safe && energy > 0.35) {
    line(ctx, [[147, 218], [137, 211]], RED, 3);
    line(ctx, [[271, 221], [281, 206]], RED, 3);
  }
}

function hands(ctx: CanvasRenderingContext2D, pose: RoomPose): void {
  if (pose.safe) {
    line(ctx, [[164, 316], [140, 338], [174, 348]], INK, 14);
    line(ctx, [[164, 316], [140, 338], [174, 348]], PAPER, 9);
    line(ctx, [[230, 318], [242, 338], [210, 347]], INK, 14);
    line(ctx, [[230, 318], [242, 338], [210, 347]], PAPER, 9);
    mug(ctx, 198, 350, pose.time, true);
    return;
  }
  const crashed = pose.phase === 'crashed';
  const end = crashed ? (pose.reduced ? 1 : ease(pose.crashAge / 0.35)) : 0;
  const tap = pose.reduced || pose.phase !== 'running' ? 0 : Math.max(0, Math.sin(pose.time * 16)) * (3 + pose.tension * 8);
  const rightX = 345 - end * 55;
  const rightY = 348 - tap - end * 141;
  line(ctx, [[231, 315], [269, 335 - end * 73], [rightX, rightY]], INK, 16);
  line(ctx, [[231, 315], [269, 335 - end * 73], [rightX, rightY]], '#fff9e9', 10);
  shape(ctx, [[rightX - 8, rightY - 5], [rightX + 13, rightY - 7], [rightX + 18, rightY + 5], [rightX - 5, rightY + 9]], PAPER, 3);
  for (let i = 0; i < 3; i += 1) line(ctx, [[rightX + i * 5, rightY - 4], [rightX + i * 5 + 2, rightY + 3]], INK, 1.5);
  const leftY = 351 - end * 75;
  line(ctx, [[166, 317], [147, 342 - end * 38], [283 - end * 177, leftY]], INK, 14);
  line(ctx, [[166, 317], [147, 342 - end * 38], [283 - end * 177, leftY]], PAPER, 9);
  shape(ctx, [[277 - end * 177, leftY - 4], [291 - end * 177, leftY - 8], [298 - end * 177, leftY + 2], [279 - end * 177, leftY + 8]], PAPER, 3);
}

function popup(ctx: CanvasRenderingContext2D, pose: RoomPose): void {
  if (pose.phase !== 'running') return;
  const [heading] = ANNOYANCES[pose.annoyance];
  const bob = pose.reduced ? 0 : Math.sin(pose.time * 2.3) * 2;
  ctx.save();
  ctx.translate(387, 167 + bob);
  box(ctx, 6, 6, 204, 58, INK, 2);
  box(ctx, 0, 0, 204, 58, PAPER, 2.5);
  ctx.fillStyle = RED;
  ctx.fillRect(1, 1, 202, 17);
  label(ctx, 'SYSTEM ANNOYANCE', 8, 9, 10, PAPER, 171);
  line(ctx, [[188, 5], [196, 13]], PAPER, 1.5);
  line(ctx, [[196, 5], [188, 13]], PAPER, 1.5);
  label(ctx, heading, 102, 35, 14, INK, 189, 'center');
  ctx.restore();
}

function debris(ctx: CanvasRenderingContext2D, pose: RoomPose): void {
  if (pose.phase !== 'crashed' || pose.reduced || pose.crashAge > 1.9) return;
  const t = Math.max(0, pose.crashAge);
  ctx.save();
  ctx.globalAlpha = clamp((1.9 - t) * 2);
  for (let i = 0; i < 23; i += 1) {
    const a = i * 2.39996;
    const speed = 75 + (i * 37 % 115);
    const x = 449 + Math.cos(a) * speed * t;
    const y = 294 + Math.sin(a) * speed * t - 107 * t + 87 * t * t;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + t * (i % 2 ? 5 : -5));
    box(ctx, -4, -3, 7 + i % 5, 5 + i % 4, i % 3 === 0 ? RED : PAPER, 1.5);
    ctx.restore();
  }
  ctx.restore();
}

export function drawRoom(ctx: CanvasRenderingContext2D, pose: RoomPose): void {
  wallpaper(ctx, pose);
  ctx.save();
  ctx.beginPath();
  ctx.rect(26, 118, 643, 304);
  ctx.clip();
  const crashShake = pose.phase === 'crashed' && !pose.reduced ? Math.exp(-7 * pose.crashAge) * 7 : 0;
  ctx.translate(Math.sin(pose.crashAge * 56) * crashShake, Math.cos(pose.crashAge * 63) * crashShake);
  if (pose.phase === 'crashed') {
    for (let i = 0; i < 16; i += 1) {
      const a = i * Math.PI * 2 / 16;
      line(ctx, [[422 + Math.cos(a) * 195, 294 + Math.sin(a) * 100], [422 + Math.cos(a) * 291, 294 + Math.sin(a) * 161]], '#ca7b52', 2);
    }
  }
  body(ctx, pose);
  desk(ctx, pose);
  hands(ctx, pose);
  popup(ctx, pose);
  debris(ctx, pose);
  if (pose.phase === 'crashed') {
    burst(ctx, 438, 178, 126, pose.safe ? GREEN : GOLD);
    label(ctx, pose.safe ? 'NOT MY PROBLEM.' : 'FUUUU—', 438, 178, pose.safe ? 19 : 39, INK, 206, 'center');
  } else if (pose.safe) {
    box(ctx, 57, 134, 231, 36, GREEN, 2);
    label(ctx, 'PEACE HAS BEEN CHOSEN.', 173, 152, 15, INK, 215, 'center');
  } else {
    const speech = pose.phase === 'running' ? 'THIS IS FINE. PROBABLY.' : pose.phase === 'betting' ? 'ONE ROUND. WHAT COULD HAPPEN?' : 'DEEP BREATH. FRESH DESK.';
    box(ctx, 43, 133, 317, 33, PAPER, 2);
    label(ctx, speech, 201, 150, 14, INK, 301, 'center');
  }
  if (pose.phase === 'running' && !pose.safe) {
    label(ctx, 'TAP', 313, 392, 14, INK, 47);
    label(ctx, pose.tension > 0.45 ? 'TAPTAPTAP' : 'TAP', 361, 409, 13, INK, 115);
  }
  ctx.restore();
}

export function drawComic(ctx: CanvasRenderingContext2D, pose: RoomPose): void {
  const titles = ['01 / JUST ONE ROUND', '02 / A TINY PROBLEM', '03 / STILL FINE...', pose.safe ? '04 / CHOSE PEACE' : pose.phase === 'crashed' ? '04 / RAGE QUIT' : '04 / TO BE CONTINUED'];
  for (let i = 0; i < 4; i += 1) {
    const x = 24 + i * 232;
    const active = i === 3 ? pose.phase === 'crashed' || pose.safe : pose.phase === 'running' && i === Math.min(2, Math.floor(pose.tension * 4));
    box(ctx, x, 444, 215, 78, i === 3 && pose.safe ? GREEN : active ? '#f4dfbd' : PAPER, active ? 3 : 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 2, 446, 211, 73);
    ctx.clip();
    label(ctx, titles[i], x + 10, 455, 10.5, INK, 197);
    face(ctx, x + 44, 492, 0.3, i / 3, i === 3 && pose.phase === 'crashed' && !pose.safe, i === 3 && pose.safe);
    const captions = ['A fresh start.', 'Another pop-up.', 'I am very calm.', pose.safe ? 'Tea > chaos.' : pose.phase === 'crashed' ? 'Desk has left.' : 'Your move.'];
    label(ctx, captions[i], x + 77, 488, 13, i === 3 && pose.phase === 'crashed' && !pose.safe ? RED : INK, 127);
    line(ctx, [[x + 78, 503], [x + 191, 503]], '#cfc3a7', 2);
    ctx.restore();
  }
}
