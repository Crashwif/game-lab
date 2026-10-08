import { C, bolt, box, hatch, label, line, mono, oval } from './ink';
import { HIT, PEANUT, allocationAt, ease, joltAt, mix, stampReach, type Direction } from './direction';

export interface MinistryView {
  d: Direction; time: number; reduced: boolean; running: boolean; crash: number | null; escaped: boolean;
  /** Smoothed 0–1: the machinery parks after the crash's hit-stop and unparks for the next applicant. */
  park: number;
  /** Smoothed 0–1: applicant props fade once he has left; the exit door fades with it. */
  gone: number;
  /** Integrated conveyor travel, in px. */
  belt: number;
}

/** Fine print rotates under the allocation: the airdrop terms keep getting worse. */
const FINE = ['VESTING: 4-YEAR CLIFF', 'CLAIM FEE: 2 PEANUTS', 'POINTS: SEE SEASON 2', 'SNAPSHOT: LAST WEEK', 'TGE: SOON™'];

function textLines(c: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, size: number, color = C.ink): void {
  c.font = `800 ${size}px Arial, sans-serif`;
  let row = ''; let at = y;
  for (const word of text.split(' ')) {
    if (row && c.measureText(`${row} ${word}`).width > width) { label(c, row, x, at, size, color); row = word; at += size * 1.13; }
    else row += `${row ? ' ' : ''}${word}`;
  }
  if (row) label(c, row, x, at, size, color);
}

export function drawBackdrop(c: CanvasRenderingContext2D, v: MinistryView): void {
  const { d, reduced, crash } = v;
  const wall = c.createLinearGradient(0, 80, 0, 470);
  wall.addColorStop(0, '#ebe0c3'); wall.addColorStop(.75, '#dccca8'); wall.addColorStop(1, '#b9b89c');
  c.fillStyle = wall; c.fillRect(0, 0, 960, 540);
  // Fixed printing marks give the enamel set a tactile grain without a per-frame random source.
  c.fillStyle = '#142e350a';
  for (let y = 100; y < 450; y += 9) for (let x = 5 + (y % 2) * 5; x < 960; x += 11) c.fillRect(x, y, 1, 1);
  for (const x of [15, 306, 714, 943]) {
    line(c, [x, 96, x, 457], '#a69d81', 2);
    for (const y of [112, 430]) bolt(c, x, y, 3);
  }
  // Overhead data pipes arrive from the building, rather than floating as UI ornaments.
  line(c, [40, 105, 40, 92, 921, 92, 921, 279], C.ink, 14);
  line(c, [40, 105, 40, 92, 921, 92, 921, 279], '#75837c', 8);
  line(c, [64, 110, 64, 102, 898, 102, 898, 211], C.brass, 6);
  for (let i = 0; i < 8; i++) {
    const x = 345 + i * 43;
    const active = crash !== null ? i % 2 === 0 : i <= d.level;
    box(c, x, 105, 32, 6, 2, active ? crash !== null ? C.red : C.mint : '#a49f85', C.ink, .7);
  }
  // The floor carries long perspective seams and a conveyor with a readable direction of travel.
  c.fillStyle = '#c2b591'; c.fillRect(0, 426, 960, 50);
  for (let x = -300; x < 1300; x += 120) line(c, [480 + (x - 480) * .72, 426, x, 478], '#9c987f', 1);
  line(c, [0, 449, 960, 449], '#a7a080', 1);
  oval(c, 525, 449, 165, 13, '#19343b26', C.ink, 0);
  box(c, 281, 437, 463, 30, 12, C.ink, C.ink, 2);
  box(c, 288, 437, 449, 13, 6, '#728985', C.ink, 1);
  const belt = reduced ? 0 : v.belt % 28;
  c.save(); c.beginPath(); c.rect(291, 438, 443, 11); c.clip();
  for (let i = -1; i < 20; i++) line(c, [291 + i * 28 + belt, 438, 284 + i * 28 + belt, 449], '#3d5454', 2);
  c.restore();
  for (let x = 300; x < 735; x += 23) oval(c, x, 455, 6, 6, '#586d69', '#8da197', 1);
  hatch(c, 330, 461, 365, 7);
  label(c, 'PROPERTY OF THE MINISTRY', 510, 433, 9, '#526d60', 'center');
}

export function drawBay(c: CanvasRenderingContext2D, v: MinistryView): void {
  const { d, reduced, time, crash, park } = v;
  box(c, 324, 125, 376, 307, 65, '#142e351c', C.ink, 0);
  box(c, 331, 119, 362, 308, 63, C.ink, C.ink, 3);
  const bg = c.createLinearGradient(0, 129, 0, 428);
  bg.addColorStop(0, '#25514f'); bg.addColorStop(1, '#6d9984');
  c.beginPath(); c.roundRect(351, 136, 322, 286, 43); c.fillStyle = bg; c.fill();
  // Ribs and a cathedral-like arch keep the scanner recognisable in silhouette.
  for (let i = 0; i < 5; i++) {
    c.beginPath(); c.roundRect(360 + i * 8, 144 + i * 7, 304 - i * 16, 282 - i * 5, 37);
    c.strokeStyle = i % 2 ? '#bad4b61b' : '#091f261c'; c.lineWidth = 4; c.stroke();
  }
  box(c, 333, 175, 17, 232, 7, C.brass, C.ink, 2);
  box(c, 674, 175, 17, 232, 7, C.brass, C.ink, 2);
  for (const x of [341, 682]) for (const y of [190, 255, 320, 390]) bolt(c, x, y, 3);
  const glow = crash !== null ? C.coral : C.mint;
  for (const x of [356, 669]) { box(c, x, 190, 5, 209, 2, glow, glow, 0); }
  // A smooth travelling scan sheet, never a flashing full-screen overlay.
  if (park < .99) {
    const scanY = reduced ? 283 : 220 + (Math.sin(time * 1.8) * .5 + .5) * 179;
    c.save(); c.globalAlpha *= 1 - park; c.beginPath(); c.roundRect(359, 170, 309, 251, 25); c.clip();
    const g = c.createLinearGradient(0, scanY - 38, 0, scanY + 2);
    g.addColorStop(0, '#75d9c000'); g.addColorStop(1, '#75d9c04d');
    c.fillStyle = g; c.fillRect(359, scanY - 38, 309, 39);
    line(c, [359, scanY, 668, scanY], '#bbffdaa0', 1.5);
    c.restore();
  }
  // The Ministry watches through a mechanical iris directly above the applicant.
  oval(c, 511, 161, 63, 39, '#152c31', C.ink, 3);
  oval(c, 511, 159, 54, 33, C.brass, '#d3c99d', 2);
  oval(c, 511, 157, 39, 27, '#173d40', C.ink, 3);
  // The iris settles on the applicant at the crash; it narrows to a slit as dread rises and flares on a crate twitch.
  const look = reduced ? 0 : Math.sin(time * .9) * 8 * (1 - park);
  const jolt = v.running && !reduced ? joltAt(d.seconds).age : 9;
  oval(c, 511 + look, 157, 24, 22, crash !== null ? C.red : jolt < .35 ? C.coral : '#76c1a5', C.ink, 2);
  oval(c, 511 + look, 157, (12 + Math.sin(d.action * Math.PI) * 3) * (1 - .45 * ease((d.dread - .3) / .5)), 17, C.ink, C.ink, 0);
  oval(c, 506 + look, 151, 5, 5, C.cream, C.cream, 0);
  for (const x of [470, 552]) bolt(c, x, 153, 3);
  box(c, 450, 190, 122, 21, 3, C.paper, C.ink, 2);
  mono(c, 'KYC / SERIES 069', 511, 204, 10, C.ink, 'center');
}

export function drawDepartment(c: CanvasRenderingContext2D, v: MinistryView): void {
  const { d, crash, escaped, gone } = v;
  // A bolted physical caseboard; supporting copy stays secondary to the applicant and multiplier.
  box(c, 26, 118, 270, 191, 10, '#132c3122', C.ink, 0);
  box(c, 22, 113, 270, 191, 10, C.cream, C.ink, 3);
  box(c, 22, 113, 270, 33, 9, C.ink, C.ink, 0);
  mono(c, `DEPARTMENT ${String(d.stage + 1).padStart(2, '0')} / CASE 000069`, 36, 135, 11, C.cream);
  const title = escaped ? 'CLAIM ABANDONED' : crash !== null ? 'IDENTITY EXPORTED' : d.title;
  textLines(c, title, 38, 175, 237, 22, crash !== null && !escaped ? C.red : C.ink);
  textLines(c, escaped ? 'Paper hands. Intact face.' : crash !== null ? 'Thank you for being the product.' : d.demand, 38, 236, 235, 16, '#5c675c');
  line(c, [38, 273, 274, 273], '#b3b19a', 1);
  mono(c, `PROCEDURE ${String(d.serial + 1).padStart(3, '0')}`, 39, 291, 11, C.ink);
  oval(c, 262, 288, 4, 4, crash !== null ? C.red : C.mint, C.ink, 1);
  // A witness desk morphs into a paper mountain as the audit grows; the exit door fades in over it.
  if (gone < .99) drawDesk(c, d);
  if (gone > .01) {
    c.save(); c.globalAlpha *= gone;
    box(c, 74, 313, 139, 125, 12, '#87ba9c', C.ink, 3);
    box(c, 83, 322, 121, 106, 7, '#284844', C.mint, 2);
    label(c, 'EXIT', 143, 336, 13, C.lime, 'center');
    c.restore();
  }
}

function drawDesk(c: CanvasRenderingContext2D, d: Direction): void {
  box(c, 46, 397, 236, 20, 2, C.brass, C.ink, 3);
  box(c, 61, 417, 12, 46, 1, C.ink, C.ink, 0);
  box(c, 255, 417, 12, 46, 1, C.ink, C.ink, 0);
  const pile = Math.min(14, 3 + Math.floor(d.seconds / 4));
  for (let i = 0; i < pile; i++) {
    const offset = Math.sin(i * 2.7) * 6;
    box(c, 188 + offset, 389 - i * 4, 79, 5, 1, i % 3 ? C.cream : '#d4c49f', C.ink, .8);
  }
  const stampY = 389 - (pile - 1) * 4 - 22;
  box(c, 229, stampY, 33, 22, 3, C.red, C.ink, 2);
  box(c, 239, stampY - 11, 12, 15, 4, C.ink, C.ink, 1);
  mono(c, 'CONSENT ASSUMED', 157, 451, 10, C.ink, 'center');
}

export function drawDispenser(c: CanvasRenderingContext2D, v: MinistryView): void {
  const { crash, time, reduced, d, escaped } = v;
  box(c, 739, 168, 189, 274, 24, '#16323825', C.ink, 0);
  box(c, 733, 159, 185, 277, 22, '#f1bd75', C.ink, 3);
  box(c, 742, 167, 166, 253, 17, '#ffe0a3', C.brass, 1.5);
  box(c, 753, 179, 144, 59, 6, C.ink, C.ink, 2);
  mono(c, 'YOUR ALLOCATION', 825, 196, 10, C.mint, 'center');
  // An eligibility checker, keyed to the multiplier: a false hope at 2×, then the usual answer.
  // After a crash it keeps processing until the peanut drops, so the payoff is not spoiled.
  const status = escaped ? { text: crash === null ? 'JEETED' : 'DODGED', hope: true, bad: false }
    : crash !== null ? { text: crash < PEANUT ? 'PROCESSING…' : '1 PEANUT', hope: crash >= PEANUT, bad: false } : allocationAt(d.x100);
  label(c, status.text, 825, 223, 21, escaped ? C.mint : status.hope ? C.lime : status.bad ? C.coral : C.cream, 'center', 134);
  for (const x of [747, 904]) for (const y of [174, 417]) bolt(c, x, y, 3);
  // The peanut is always visible: the absurd reward is legible before a short round ends.
  oval(c, 825, 290, 55, 42, '#cf9658', C.ink, 2);
  oval(c, 825, 287, 49, 36, '#213c3c', '#eacc8e', 3);
  const bob = reduced ? 0 : Math.sin(time * 1.7) * 2;
  if (crash === null || crash < PEANUT || escaped) drawPeanut(c, 825, 288 + bob, 1.2, -.28);
  c.beginPath(); c.ellipse(807, 273, 10, 5, -.5, 0, Math.PI * 2); c.fillStyle = '#fff8dc24'; c.fill();
  box(c, 772, 342, 108, 15, 5, C.ink, C.ink, 2);
  mono(c, FINE[Math.floor(time / 2.4) % FINE.length]!, 826, 353, 8, C.mint, 'center', 100);
  box(c, 763, 372, 126, 32, 5, '#c38b58', C.ink, 2);
  line(c, [772, 397, 880, 397], '#f6d395', 2);
  mono(c, 'LIFE-CHANGING.', 825, 426, 11, C.ink, 'center');
  if (crash !== null && crash >= PEANUT && !escaped) {
    const age = crash - PEANUT;
    const fall = reduced ? 1 : ease(age / .4);
    const bounce = age > .4 ? Math.exp(-(age - .4) * 5) * Math.abs(Math.sin((age - .4) * 15)) * 12 : 0;
    drawPeanut(c, mix(825, 815, fall), mix(351, 385, fall) - (reduced ? 0 : bounce), .74, fall * .6);
    // The receipt stamps in beside the crate with the peanut.
    const pop = reduced ? 1 : 1 + .18 * (1 - ease(age / .2));
    c.save(); c.globalAlpha *= reduced ? 1 : ease(age / .08); c.translate(684, 389); c.rotate(reduced ? -.05 : -.05 * ease(age / .35)); c.scale(pop, pop);
    box(c, -70, -51, 140, 99, 3, C.cream, C.ink, 2);
    mono(c, 'FINAL ALLOCATION', 0, -30, 11, C.ink, 'center');
    label(c, '1', -13, 17, 51, C.ink, 'right');
    drawPeanut(c, 17, -3, .9, -.3);
    line(c, [-57, 27, 57, 27], C.brass, 1);
    label(c, 'THAT’S IT.', 0, 42, 13, C.red, 'center');
    c.restore();
  }
  // A data receipt prints continuously; the amount of paper is capped, the content keeps rotating.
  c.save(); c.translate(890, 324); c.rotate(-.09);
  const length = 17 + Math.min(53, d.seconds * 1.2);
  box(c, -6, 0, 32, length, 0, C.cream, C.ink, 1);
  for (let y = 7; y < length - 3; y += 6) line(c, [-1, y, 19 - y % 8, y], '#8b8c74', 1);
  c.restore();
}

export function drawPeanut(c: CanvasRenderingContext2D, x: number, y: number, size: number, turn: number): void {
  c.save(); c.translate(x, y); c.rotate(turn); c.scale(size, size);
  c.beginPath(); c.moveTo(0, -18); c.bezierCurveTo(17, -21, 19, -9, 12, 0); c.bezierCurveTo(22, 16, 8, 26, 0, 17);
  c.bezierCurveTo(-14, 23, -23, 11, -12, 0); c.bezierCurveTo(-21, -13, -11, -23, 0, -18);
  c.fillStyle = '#dca46a'; c.fill(); c.strokeStyle = C.ink; c.lineWidth = 2; c.stroke();
  for (const y of [-10, -4, 4, 11]) line(c, [-7, y, 8, y + 1], '#a67249', 1);
  line(c, [-3, -14, -5, 14], '#a67249', 1); line(c, [4, -14, 5, 14], '#f8d394', 1);
  c.restore();
}

/** Fixed links with a configured bend side, independent of animated tool targets. */
export function mechanicalElbow(base: [number, number], end: [number, number], side: number, upper = 90, lower = 95): [number, number] {
  const dx = end[0] - base[0], dy = end[1] - base[1], d = Math.max(.001, Math.hypot(dx, dy));
  const along = (upper ** 2 - lower ** 2 + d ** 2) / (2 * d);
  const h = Math.sqrt(Math.max(0, upper ** 2 - along ** 2)) * side;
  return [base[0] + dx / d * along - dy / d * h, base[1] + dy / d * along + dx / d * h];
}

/** Three linked segments form each arm, with a counterweight and a distinct inspection tool. */
export function drawArm(c: CanvasRenderingContext2D, base: [number, number], elbow: [number, number], end: [number, number], tool: 'camera' | 'probe' | 'stamp', active: boolean, angle: number): void {
  elbow = mechanicalElbow(base, end, base[0] < 500 ? -1 : 1, tool === 'stamp' ? 90 : 65, tool === 'stamp' ? 95 : 85);
  const p = [...base, ...elbow, ...end];
  line(c, p, C.ink, 19); line(c, p, '#b6c9b6', 12); line(c, [base[0] - 3, base[1] - 3, elbow[0] - 3, elbow[1] - 3], '#edf0cf', 2);
  for (const joint of [base, elbow]) { oval(c, ...joint, 12, 12, C.brass, C.ink, 2); bolt(c, ...joint, 5); }
  c.save(); c.translate(...end); c.rotate(angle);
  if (tool === 'camera') {
    box(c, -19, -15, 38, 30, 7, C.ink, C.ink, 2);
    oval(c, 0, 0, 12, 12, active ? C.mint : C.pale, C.brass, 2);
    oval(c, 0, 0, 5, 7, C.ink, C.ink, 0); oval(c, -3, -3, 2, 2, C.cream, C.cream, 0);
  } else if (tool === 'probe') {
    box(c, -7, -13, 14, 27, 4, C.coral, C.ink, 2); line(c, [0, 13, 0, 26], C.cream, 5); oval(c, 0, 27, 6, 4, C.mint, C.ink, 1);
  } else {
    box(c, -8, -22, 16, 29, 6, C.red, C.ink, 2); box(c, -30, 3, 60, 19, 5, C.ink, C.ink, 2);
    box(c, -27, 19, 54, 5, 0, C.red, C.ink, 1);
  }
  c.restore();
}

export function drawProcedure(c: CanvasRenderingContext2D, v: MinistryView, front: boolean): void {
  const { d, reduced, time, park, gone } = v;
  const motion = reduced ? 0 : Math.sin(d.action * Math.PI * 2);
  const inspect = reduced ? .5 : Math.sin(Math.PI * d.action) ** 2;
  // After a crash the arms fold against the bay and the props fade; after a cash-out they keep scanning the empty booth.
  const fade = 1 - Math.max(park, front ? gone : 0);
  if (!front) {
    if (fade > .01) {
      c.save(); c.globalAlpha *= fade;
      if (d.stage === 3) drawAncestry(c, time, reduced);
      if (d.stage === 4) {
        for (let i = 0; i < 4; i++) {
          const on = i === Math.floor((reduced ? 0 : time * 1.6) % 4);
          box(c, 407 + i * 49, 414, 42, 17, 4, on ? C.lime : '#739d8b', C.ink, 1.5);
          label(c, ['←', '↑', '↓', '→'][i]!, 428 + i * 49, 427, 15, C.ink, 'center');
        }
      }
      if (d.stage >= 5) {
        const count = d.stage === 7 ? 7 : 4;
        for (let i = 0; i < count; i++) {
          const a = (reduced ? 0 : time * .35) + i * Math.PI * 2 / count;
          const x = 511 + Math.cos(a) * 137; const y = 274 + Math.sin(a) * 76;
          if (Math.sin(a) > .1) continue;
          oval(c, x, y, 15, 9, C.cream, C.ink, 2); oval(c, x + Math.sin(a) * 2, y, 6, 7, C.red, C.ink, 1);
          line(c, [x - 20, y, x - 30, y - 5], C.ink, 2); line(c, [x + 20, y, x + 30, y - 5], C.ink, 2);
        }
      }
      c.restore();
    }
    const leftY = d.stage === 1 ? 285 : d.stage === 4 ? 355 : 260;
    drawArm(c, [340, 328], [377, 302 + motion * 7], [mix(429 + inspect * 15, 392, park), mix(leftY + motion * 6, 238, park)], d.stage === 1 ? 'probe' : 'camera', inspect > .4 && park < .5, .1 + motion * .1);
    drawArm(c, [682, 337], [645, 326 - motion * 8], [mix(591 - inspect * 10, 632, park), mix(d.stage === 5 ? 241 : 289 + motion * 12, 240, park)], 'camera', inspect < .7 && park < .5, -.15);
    return;
  }
  if (fade <= .01) return;
  c.save(); c.globalAlpha *= fade;
  // Stages 0–2 each end their first cycle with the stamp arm landing a label on the applicant; it fades out as the ancestry arrives.
  const retire = d.serial <= 2 ? 1 : d.serial === 3 && !reduced ? 1 - ease(d.age / .5) : 0;
  if (retire > 0) {
    const reach = reduced ? 0 : stampReach(d);
    const [x, y] = STAMP_TARGETS[Math.min(2, d.stage)]!;
    // At rest the arm hangs high on its wall mount, clear of the dental index.
    c.save(); c.globalAlpha *= retire;
    drawArm(c, [681, 343], [639, 257], [mix(620, x, reach), mix(198, y, reach)], 'stamp', reach > .8, -.05);
    c.restore();
  }
  if (d.stage === 0 || d.stage === 1) {
    // The projected brackets frame a face rather than imitating an actionable account-verification form.
    for (const [x, sign] of [[470, 1], [552, -1]] as const) {
      line(c, [x + sign * 10, 225, x, 225, x, 236], '#d5ffba', 2);
      line(c, [x + sign * 10, 286, x, 286, x, 275], '#d5ffba', 2);
    }
    if (d.stage === 1) {
      box(c, 576, 233, 65, 36, 5, C.cream, C.ink, 2);
      for (let i = 0; i < 6; i++) box(c, 583 + i * 8, 244 + Math.abs(i - 2.5), 7, 13, 3, '#fdfbf0', C.ink, 1);
      mono(c, 'TEETH INDEX', 608, 227, 8, C.cream, 'center');
    }
  }
  if (d.stage === 2) {
    // A microphone reaches the witness desk; the applicant can see his dog turn state's evidence.
    line(c, [282, 397, 282, 368, 175, 356], C.ink, 4); oval(c, 176, 356, 9, 5, C.ink, '#739d8b', 1);
    // The card stands clear of the labels already stamped on his hoodie.
    c.save(); c.translate(631, 360); c.rotate(-.08);
    box(c, -41, -22, 82, 56, 2, C.cream, C.ink, 2); mono(c, 'TESTIMONY', 0, -7, 9, C.ink, 'center');
    label(c, 'WOOF.', 0, 15, 16, C.red, 'center'); c.restore();
  }
  if (d.stage === 4) {
    for (let i = 0; i < 3; i++) {
      const y = 255 + i * 42; const x = 600 + (reduced ? 0 : Math.sin(time * 2 + i) * 6);
      oval(c, x, y, 19, 19, i === Math.floor(time / 1.8) % 3 ? C.lime : C.cream, C.ink, 2);
      label(c, ['↑', '←', '↓'][i]!, x, y + 7, 23, C.ink, 'center');
    }
  }
  if (d.stage === 5) {
    c.save(); c.translate(511, 231 + motion * 3);
    c.beginPath(); c.ellipse(0, 0, 48, 25, 0, Math.PI, Math.PI * 2); c.lineTo(48, 4); c.lineTo(-48, 4); c.closePath();
    c.fillStyle = '#a7d1bbd0'; c.fill(); c.strokeStyle = C.ink; c.lineWidth = 3; c.stroke();
    for (let i = 0; i < 5; i++) oval(c, -30 + i * 15, -12 - Math.sin(i / 4 * Math.PI) * 7, 4, 5, C.lime, C.ink, 1);
    line(c, [0, -25, 0, -38, 23, -38], C.ink, 3); c.restore();
    box(c, 578, 308, 77, 45, 3, C.ink, C.mint, 1.5);
    for (let i = 0; i < 13; i++) line(c, [584 + i * 5, 333, 584 + i * 5, 333 - Math.abs(Math.sin(i * 2 + time)) * 12], C.mint, 2);
    mono(c, 'VIBES ONLY', 617, 349, 8, C.cream, 'center');
  }
  if (d.stage === 6) {
    const y = 252 - (reduced ? 12 : Math.sin(d.action * Math.PI) * 23);
    c.save(); c.globalAlpha *= .67;
    c.beginPath(); c.moveTo(592, y + 55); c.bezierCurveTo(574, y + 12, 605, y - 15, 623, y); c.bezierCurveTo(639, y + 14, 637, y + 41, 651, y + 55);
    c.lineTo(637, y + 49); c.lineTo(626, y + 58); c.lineTo(614, y + 50); c.lineTo(605, y + 60); c.closePath();
    c.fillStyle = '#c7ffe0'; c.fill(); c.strokeStyle = C.mint; c.lineWidth = 2; c.stroke();
    oval(c, 607, y + 18, 3, 5, C.ink, C.ink, 0); oval(c, 622, y + 18, 3, 5, C.ink, C.ink, 0);
    oval(c, 616, y + 33, 4, 6, C.ink, C.ink, 0); c.restore();
    c.save(); c.translate(628, y + 66); c.rotate(.16); box(c, -32, -4, 64, 20, 2, C.cream, C.ink, 1.5); mono(c, 'PRE-OWNED', 0, 10, 9, C.red, 'center'); c.restore();
    c.beginPath(); c.moveTo(548, 296); c.bezierCurveTo(591, 340, 586, 264, 605, y + 31); c.strokeStyle = '#c7ffe057'; c.lineWidth = 3; c.stroke();
  }
  if (d.stage === 7) {
    drawArm(c, [680, 223], [631, 169], [604, 204 + inspect * 80], 'stamp', true, -.12);
    c.save(); c.translate(610, 358); c.rotate(-.12); box(c, -43, -23, 86, 62, 3, C.cream, C.ink, 2);
    label(c, 'FINAL', 0, 0, 20, C.red, 'center'); label(c, 'FINAL?', 0, 23, 17, C.red, 'center'); c.restore();
  }
  c.restore();
}

/** Where the stamp face meets each label: the hoodie hem, the right shoulder, the ID badge. */
const STAMP_TARGETS: [number, number][] = [[514, 334], [531, 284], [521, 308]];

function drawAncestry(c: CanvasRenderingContext2D, time: number, reduced: boolean): void {
  const y0 = 225; const positions = [[414, y0], [605, y0], [386, y0 + 66], [632, y0 + 66], [511, y0 + 129]];
  for (const [x, y] of positions) line(c, [x!, y!, x!, 371, 511, 371], '#dce4b879', 2);
  for (let i = 0; i < positions.length; i++) {
    const [x, y] = positions[i]!; c.save(); c.translate(x!, y! + (reduced ? 0 : Math.sin(time + i) * 2)); c.rotate((i % 2 ? 1 : -1) * .07);
    box(c, -21, -25, 42, 47, 2, C.cream, C.brass, 3);
    oval(c, 0, -6, 12, 13, i % 2 ? '#cab58e' : '#bead98', C.ink, 1);
    line(c, [-6, -8, -2, -8], C.ink, 2); line(c, [3, -8, 7, -8], C.ink, 2);
    line(c, [-4, 1, 4, -1], C.ink, 1.5); box(c, -12, 9, 24, 9, 3, '#657f71', C.ink, 1);
    if (i === 0) { box(c, -15, -20, 30, 5, 1, C.ink, C.ink, 0); box(c, -9, -28, 18, 10, 1, C.ink, C.ink, 0); }
    c.restore();
  }
}

/**
 * The crate: side walls creep up around the applicant before the crash, and its flaps hang open outward.
 * At the crash the front rises, the dossier is swept in and the flaps close. An empty crate ships after a cash-out.
 */
export function drawCrate(c: CanvasRenderingContext2D, wall: number, front: number, close: number, empty: boolean): void {
  if (wall < 1 && front < 1) return;
  const top = 441 - wall;
  // Open flaps droop outward and grow with the walls; closing swings them up and over the top.
  const flap = mix(Math.min(72, wall * 1.6), 72, close);
  for (const x of [439, 572]) box(c, x, top, 12, wall, 2, '#a97a48', C.ink, 2);
  c.save(); c.translate(439, top); c.rotate(mix(-3.66, 0, close)); box(c, 0, -6, flap, 7, 0, '#caa570', C.ink, 2); c.restore();
  c.save(); c.translate(584, top); c.rotate(mix(3.66, 0, close)); box(c, -flap, -6, flap, 7, 0, '#caa570', C.ink, 2); c.restore();
  if (front < 1) return;
  box(c, 439, 441 - front, 145, front, 3, '#b58753', C.ink, 3);
  if (front > 90) {
    box(c, 464, 365, 96, 48, 1, C.cream, C.ink, 1);
    mono(c, 'IDENTITY', 512, 380, 11, C.ink, 'center');
    label(c, empty ? 'NOT FOUND' : 'SOLD', 512, 402, empty ? 17 : 23, C.red, 'center', 88);
    mono(c, 'THIS WAY UP ↑', 510, 431, 8, '#483f2f', 'center');
    for (let i = 0; i < 8; i++) line(c, [452 + i * 3, 354, 452 + i * 3, 364], C.ink, i % 3 === 0 ? 2 : 1);
  }
  if (close === 1) {
    box(c, 502, 323, 19, 120, 0, '#d8c49b88', C.ink, 0);
    mono(c, empty ? 'RETURN TO SENDER' : 'HANDLE WITHOUT CARE', 512, 458, 10, C.cream, 'center');
  }
}

/** Crash packing on the crash clock, continuous with the crate's pre-crash wall height. */
export function drawPacking(c: CanvasRenderingContext2D, age: number, reduced: boolean, wall: number, empty: boolean): void {
  const collect = empty ? 0 : ease((age - .3) / .6);
  if (collect > 0 && collect < 1) {
    for (let i = 0; i < 14; i++) {
      const a = i * 2.399; const r = (1 - collect) * (65 + i * 4);
      const x = 512 + Math.cos(a + collect * 4) * r; const y = 345 + Math.sin(a + collect * 4) * r * .55;
      c.save(); c.translate(x, y); c.rotate(reduced ? 0 : a + collect * 6);
      box(c, -11, -7, 23, 15, 1, i % 2 ? C.cream : C.mint, C.ink, 1); line(c, [-6, -2, 6, -2], C.ink, 1); c.restore();
    }
  }
  const rise = ease((age - HIT) / .4);
  drawCrate(c, mix(wall, 112, rise), rise * 112, ease((age - .8) / .35), empty);
}
