import { type Act, type ActorPose, type ActingInput } from './acting';
import { drawFace } from './actor';
import { box, burst, clamp, ease, GOLD, GREEN, INK, label, line, mono, PAPER, RED, shape } from './ink';

const SKY = '#343c5c';

export function drawBackground(c: CanvasRenderingContext2D, input: ActingInput, act: Act): void {
  const t = input.reduced ? 0 : input.phase === 'waiting' || input.phase === 'betting' ? input.clock : input.elapsed;
  const collapse = input.phase === 'crashed' ? ease((input.crashAge - 0.8) / 0.7) : 0;
  c.fillStyle = '#ddd2b6'; c.fillRect(0, 0, 960, 540);
  const wall = c.createLinearGradient(0, 95, 0, 452);
  wall.addColorStop(0, '#eee6d1'); wall.addColorStop(1, '#cbb896');
  c.fillStyle = wall; c.fillRect(0, 95, 960, 355);
  for (let y = 121; y < 445; y += 22) for (let x = 11; x < 960; x += 22) {
    c.fillStyle = '#c9ba9c'; c.fillRect(x + y % 3, y, 2, 2);
  }
  // City layers slide at different rates behind the blinds.
  box(c, 27, 132, 193, 241, INK, 5);
  c.save(); c.beginPath(); c.rect(34, 139, 179, 227); c.clip();
  c.fillStyle = SKY; c.fillRect(34, 139, 179, 227);
  c.fillStyle = '#eec589'; c.beginPath(); c.arc(166, 170, 19, 0, Math.PI * 2); c.fill();
  for (let layer = 0; layer < 2; layer += 1) {
    for (let i = -1; i < 7; i += 1) {
      const x = 14 + i * 47 - (t * (2 + layer * 3) % 47);
      const y = 238 + (i * 27 % 63) + layer * 46;
      box(c, x, y, 39, 160, layer ? '#222b38' : '#586282', 2);
      for (let j = 0; j < 5; j += 1) { c.fillStyle = j % 3 ? '#9e8774' : GOLD; c.fillRect(x + 8, y + 9 + j * 19, 7, 8); }
    }
  }
  for (let i = 0; i < 6; i += 1) line(c, [[30, 150 + i * 20], [220, 150 + i * 20 + Math.sin(t * 0.9 + i) * 5]], '#aba590', 9);
  c.restore();
  line(c, [[227, 135], [229, 356]], INK, 3);
  box(c, 822, 172 + collapse * 40, 103, 100, PAPER, 4);
  label(c, 'HUMAN', 874, 194 + collapse * 40, 18, INK, 94, 'center');
  label(c, 'RESOURCES', 874, 217 + collapse * 40, 14, INK, 94, 'center');
  label(c, 'OPTIONAL', 874, 246 + collapse * 40, 16, RED, 94, 'center');
  // Fan blades and their casing react to the same physical desk impacts.
  c.save(); c.translate(758, 116 + collapse * 230);
  c.rotate(collapse * 0.9 + act.impact * 0.025);
  line(c, [[0, -55], [0, 0]], INK, 8);
  for (let i = 0; i < 3; i += 1) {
    c.save(); c.rotate(t * 2.6 + i * Math.PI * 2 / 3);
    shape(c, [[0, -6], [91, -11], [101, 3], [25, 12]], '#7f887a', 3); c.restore();
  }
  box(c, -12, -8, 24, 18, GOLD, 3); c.restore();
  c.fillStyle = '#a47657'; c.fillRect(0, 452, 960, 88);
  line(c, [[0, 450], [960, 450]], INK, 5);
  for (let i = -1; i < 12; i += 1) line(c, [[i * 94, 451], [i * 134 - 160, 540]], '#72513c', 2);
  line(c, [[0, 486], [960, 486]], '#72513c', 2);
  line(c, [[0, 527], [960, 527]], '#72513c', 2);
  if (collapse > 0) {
    const w = 90 * collapse;
    shape(c, [[591, 121], [615 - w, 199], [627 - w, 278], [590, 359], [734, 434], [898, 398], [854 + w, 292], [870, 162]], '#393c47', 5);
    for (let i = 0; i < 4; i += 1) {
      box(c, 641, 210 + i * 37, 159, 28, '#626d68', 3);
      label(c, ['COPE CLOUD', 'VIBES SERVER', 'EXIT NOT FOUND', 'HUMAN ERROR'][i], 720, 224 + i * 37, 13, i === 3 ? GOLD : GREEN, 145, 'center');
    }
  }
}

function keyboard(c: CanvasRenderingContext2D, p: ActorPose, time: number, reduced: boolean): void {
  c.save(); c.translate(p.keyboard.x, p.keyboard.y); c.rotate(p.keyboardAngle);
  shape(c, [[-65, -12], [59, -16], [78, 8], [-76, 14]], PAPER, 4);
  for (let row = 0; row < 3; row += 1) for (let k = 0; k < 11; k += 1) {
    const hot = !reduced && (Math.floor(time * 7) + row * 3) % 11 === k;
    c.fillStyle = hot ? RED : '#908574'; c.fillRect(-58 + k * 10 + row * 2, -8 + row * 6, 7, 4);
  }
  c.restore();
}

function display(c: CanvasRenderingContext2D, input: ActingInput, act: Act): void {
  const index = input.phase === 'running' || input.phase === 'crashed' ? act.index : -1;
  const t = input.reduced ? 0 : act.clock;
  c.save(); c.beginPath(); c.rect(-88, -76, 169, 129); c.clip();
  c.fillStyle = index === 2 ? '#e4c977' : index === 5 ? '#e99b81' : '#bbcc92'; c.fillRect(-88, -76, 169, 129);
  if (index === 1) {
    label(c, 'I AM NOT AN IDIOT', -2, -61, 13, INK, 160, 'center');
    for (let row = 0; row < 3; row += 1) for (let col = 0; col < 3; col += 1) {
      const x = -77 + col * 51, y = -44 + row * 30;
      box(c, x, y, 46, 26, ((row + col + Math.floor(t)) % 3) ? '#dae4c1' : RED, 2);
      label(c, ['EXIT', 'COPE', '???'][(row * 3 + col + Math.floor(act.number / 8)) % 3], x + 23, y + 13, 10, INK, 41, 'center');
    }
  } else if (index === 2) {
    const nod = Math.sin(t * 4) * 6;
    drawFace(c, -39, -13 + nod, 0.5, -0.1, 0.5 + Math.sin(t * 8) * 0.3, 0.6, 0, true, t);
    label(c, 'COACH', 33, -39, 17, INK, 82, 'center');
    label(c, 'COPE', 33, -17, 22, RED, 82, 'center');
    label(c, 'BUY MY', 33, 9, 13, INK, 82, 'center');
    label(c, 'FAILURE', 33, 26, 14, INK, 82, 'center');
  } else if (index === 3) {
    label(c, 'UPDATING YOUR LIFE', -3, -53, 13, INK, 160, 'center');
    for (let i = 0; i < 4; i += 1) {
      box(c, -74 + i * 7, -38 + i * 19, 130, 27, i % 2 ? PAPER : GOLD, 2);
      mono(c, `RESTART #${1 + i + Math.floor(input.elapsed)}`, -68 + i * 7, -24 + i * 19, 11, INK, 114);
    }
  } else if (index === 5) {
    drawFace(c, -4 + Math.sin(t * 2.8) * 12, -15, 0.99, Math.sin(t * 2.8) * 0.17, 0.85, 1.5, 0.95, false, t);
  } else if (index === 4) {
    label(c, 'MINE.', -2, -45, 38, INK, 156, 'center');
    drawFace(c, -1, 30, 0.57, 0, 0.85, 0.8, 0.9, false, t);
  } else if (index === 7) {
    label(c, 'MINDFULNESS', -2, -50, 16, INK, 160, 'center');
    label(c, 'TRIAL EXPIRED', -2, -21, 18, RED, 160, 'center');
    label(c, 'BREATHE PREMIUM', -2, 11, 13, INK, 160, 'center');
    label(c, 'CANCEL: UNAVAILABLE', -2, 34, 10, INK, 160, 'center');
  } else {
    label(c, index === 6 ? 'CHAIR.EXE' : 'VERY REAL JOB', -2, -51, 18, INK, 158, 'center');
    label(c, index === 6 ? 'NOT RESPONDING' : 'STILL BUFFERING', -2, -22, 15, INK, 158, 'center');
    box(c, -73, 4, 140, 15, PAPER, 2);
    const width = 13 + ((t * 33) % 115);
    c.fillStyle = RED; c.fillRect(-70, 7, width, 9);
    mono(c, '99% forever', -69, 37, 13, INK, 145);
  }
  c.restore();
}

function crt(c: CanvasRenderingContext2D, input: ActingInput, act: Act, x: number, y: number, rotation = 0, destroyed = false): void {
  c.save(); c.translate(x, y); c.rotate(rotation);
  shape(c, [[-114, -94], [93, -96], [125, -66], [121, 74], [92, 93], [-107, 84], [-126, 48]], '#9e9e82', 5);
  box(c, -98, -85, 189, 150, INK, 4);
  if (!destroyed) display(c, input, act);
  else {
    c.fillStyle = '#f17b48'; c.fillRect(-88, -76, 169, 129);
    line(c, [[-85, -71], [-34, -30], [-15, 8], [77, 45]], INK, 6);
    line(c, [[-15, 8], [-72, 53]], INK, 5);
    line(c, [[-34, -30], [15, -73]], INK, 4);
    label(c, 'USER', -2, -42, 20, INK, 155, 'center');
    label(c, 'ERROR', 0, 10, 36, INK, 155, 'center');
  }
  box(c, -19, 93, 37, 29, '#868671', 4);
  shape(c, [[-63, 121], [62, 121], [76, 135], [-74, 135]], '#aaa186', 4);
  for (let i = 0; i < 5; i += 1) line(c, [[100, -44 + i * 11], [116, -44 + i * 11]], INK, 2);
  box(c, 97, 44, 10, 9, destroyed ? RED : GREEN, 1);
  c.restore();
}

export function drawDesk(c: CanvasRenderingContext2D, input: ActingInput, act: Act, p: ActorPose): void {
  const dead = input.phase === 'crashed';
  const age = input.reduced && dead ? 4 : input.crashAge;
  const flip = dead ? ease((age - 0.24) / 0.55) : 0;
  const shake = input.reduced ? 0 : dead ? Math.sin(age * 40) * Math.exp(-age * 3) * 6 : act.impact * 5;
  c.save(); c.translate(452, 410 + shake); c.rotate(-flip * 2.8); c.translate(-452, -410);
  shape(c, [[452, 414], [481, 413], [479, 513], [457, 513]], '#837155', 4);
  shape(c, [[793, 414], [821, 412], [815, 513], [793, 513]], '#837155', 4);
  shape(c, [[430, 395], [820, 388], [844, 419], [432, 428]], '#bc9b6e', 5);
  line(c, [[451, 410], [820, 403]], '#6e593f', 2);
  if (!dead) {
    keyboard(c, p, act.clock, input.reduced);
    crt(c, input, act, 687 + shake * 0.7, 257 + shake, -0.025 + shake * 0.006);
  }
  c.restore();
  if (!dead) {
    c.save();
    c.beginPath(); c.moveTo(791, 339);
    if (act.index === 4) c.bezierCurveTo(773, 247, p.keyboard.x + 130, p.keyboard.y - 10, p.keyboard.x + 64, p.keyboard.y);
    else c.bezierCurveTo(866, 406, 685, 488 + shake * 3, 609, 494);
    c.strokeStyle = INK; c.lineWidth = act.index === 4 ? 11 : 5; c.stroke();
    if (act.index === 4) { c.strokeStyle = '#7c795c'; c.lineWidth = 6; c.stroke(); }
    c.restore();
  } else {
    // The monitor follows the desk contact, flies, hits the wall, and settles on the floor.
    const launch = clamp((age - 0.24) / 0.8);
    const fall = ease((age - 1.03) / 0.82);
    const x = 687 + 70 * Math.sin(launch * Math.PI) - fall * 8;
    const y = 257 - 191 * Math.sin(launch * Math.PI / 2) + fall * 306;
    const spin = -launch * 1.8 + fall * 2.02;
    crt(c, input, act, x, y, spin, age > 1.03);
    if (age > 1.03) {
      const dust = input.reduced ? 4 : age - 1.03;
      for (let i = 0; i < 30; i += 1) {
        const a = i * 2.3999, speed = 60 + (i * 37 % 200);
        const u = Math.min(dust, 1.4);
        const px = 701 + Math.cos(a) * speed * u;
        const py = Math.min(518 - i % 8, 94 + Math.sin(a) * speed * u + 205 * u * u);
        c.save(); c.translate(px, py); c.rotate(a + u * 4);
        box(c, -4, -3, 8 + i % 9, 6 + i % 5, i % 3 ? PAPER : GOLD, 2); c.restore();
      }
    }
  }
}

export function drawProps(c: CanvasRenderingContext2D, input: ActingInput, act: Act): void {
  const time = input.reduced ? 0 : act.clock;
  const dead = input.phase === 'crashed';
  const age = input.reduced && dead ? 4 : input.crashAge;
  const tumble = dead ? ease((age - 0.63) / 0.9) : 0;
  // The plant is a horrified witness, with leaves trailing the pot's bounce.
  c.save(); c.translate(886 - tumble * 21, 442 + (input.reduced ? 0 : act.impact * 8) + tumble * 36);
  c.rotate(-tumble * 1.4 + (input.reduced ? 0 : act.impact * 0.06));
  shape(c, [[-28, -40], [30, -40], [21, 17], [-21, 17]], '#bf4a36', 4);
  const leaf = input.reduced ? 0 : Math.sin(time * 4 - 0.7) * 9 + act.impact * 15;
  line(c, [[0, -40], [leaf, -99], [leaf - 29, -113]], '#4b6146', 7);
  shape(c, [[leaf, -84], [leaf + 28, -122], [leaf + 38, -113], [leaf + 19, -89]], GREEN, 3);
  shape(c, [[leaf - 7, -103], [leaf - 54, -128], [leaf - 51, -107], [leaf - 18, -89]], GREEN, 3);
  box(c, -17, -20, 9, 10, PAPER, 2); box(c, 8, -20, 9, 10, PAPER, 2);
  line(c, [[-10, 2], [0, -2], [10, 2]], INK, 3); c.restore();
  // A printer ejects a whole bureaucracy when the updater gets involved.
  box(c, 767, 462, 112, 57, '#b5b4a0', 4); box(c, 780, 470, 86, 12, INK, 2);
  label(c, 'COPIUM', 823, 500, 15, INK, 96, 'center');
  if (!dead && act.index === 3 && input.reduced) {
    for (let i = 0; i < 4; i += 1) box(c, 746 + i * 3, 445 - i * 7, 101, 12, PAPER, 2);
  }
  if (!dead && act.index === 3 && !input.reduced) {
    for (let i = 0; i < 8; i += 1) {
      const u = input.reduced ? (i + 0.5) / 8 : (act.age * 0.36 + i / 8) % 1;
      const x = 817 - 360 * u + Math.sin(u * 9 + i) * 45;
      const y = 468 - Math.sin(u * Math.PI) * 298;
      c.save(); c.translate(x, y); c.rotate(Math.sin(u * 8 + i) * 0.5);
      box(c, -28, -34, 56, 68, PAPER, 2);
      label(c, ['URGENT', 'UPDATE', 'AGAIN', 'WHY?'][i % 4], 0, -19, 10, RED, 49, 'center');
      for (let j = 0; j < 4; j += 1) line(c, [[-19, -2 + j * 9], [19, -2 + j * 9]], '#a69982', 1.5);
      c.restore();
    }
  }
  if (dead && age > 1.45) {
    const feed = ease((age - 1.45) / 1.0);
    shape(c, [[787, 476], [858, 476], [853, 426 - feed * 87], [801, 420 - feed * 85]], PAPER, 3);
    label(c, 'SUPPORT', 827, 427 - feed * 74, 12, INK, 63, 'center');
    label(c, 'TICKET', 827, 444 - feed * 74, 13, INK, 63, 'center');
    label(c, 'CLOSED', 827, 462 - feed * 74, 14, RED, 65, 'center');
  }
}

export function drawForeground(c: CanvasRenderingContext2D, input: ActingInput, act: Act, p: ActorPose): void {
  if (input.safe && p.exit > 0.75) {
    box(c, 15, 102, 290, 43, GREEN, 3);
    label(c, 'UNPLUGGED. UNBOTHERED.', 160, 124, 18, INK, 277, 'center');
    line(c, [[225, 350], [263, 338]], INK, 5);
    shape(c, [[263, 328], [280, 328], [280, 350], [263, 350]], GOLD, 3);
    line(c, [[280, 332], [290, 332]], INK, 3); line(c, [[280, 345], [290, 345]], INK, 3);
    return;
  }
  if (input.phase === 'crashed') {
    const age = input.reduced ? 4 : input.crashAge;
    if (age < 1.1) {
      burst(c, 483, 188, 159, GOLD);
      label(c, 'FUCK THIS.', 483, 188, 42, INK, 258, 'center');
    } else if (age > 1.8) {
      const stamp = ease((age - 1.8) / 0.5);
      c.save(); c.translate(500, 151 - 170 * (1 - stamp)); c.rotate(-0.065);
      box(c, -198, -30, 396, 61, PAPER, 5);
      label(c, 'HAVE YOU TRIED CALMING DOWN?', 0, 1, 22, RED, 375, 'center'); c.restore();
      const steam = input.reduced ? 0 : age;
      for (let i = 0; i < 6; i += 1) {
        const u = input.reduced ? i / 6 : (steam * 0.45 + i / 6) % 1;
        c.globalAlpha = (1 - u) * 0.45;
        c.fillStyle = '#ede4d2'; c.beginPath(); c.ellipse(679 + Math.sin(u * 7 + i) * 31, 342 - u * 103, 17 + u * 23, 14 + u * 19, 0, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    }
  } else if (input.phase === 'running' && !input.reduced && act.impact > 0.45 && [0, 7].includes(act.index)) {
    c.save(); c.translate(532, 354); c.rotate(-0.16);
    label(c, act.index === 7 ? 'CALM!' : 'CLACK!', 0, 0, 25, RED, 145, 'center'); c.restore();
    for (let i = 0; i < 5; i += 1) line(c, [[499 + i * 15, 387], [493 + i * 18, 371 - (i % 2) * 9]], GOLD, 4);
  }
}
