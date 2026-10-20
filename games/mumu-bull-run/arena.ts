import { box, clamp, CREAM, ease, frac, GOLD, grain, GREEN, INK, line, mix, oval, poly, RED, star, TAU, text } from './art';
import { floorAt, type Routine } from './motion';
import { bear } from './rig';

const SPONSORS = ['TRUST ME BRO RESEARCH', 'BEARS HAVE A PODCAST NOW', 'MY THESIS IS STILL VALID', 'COPIUM IS A LIFESTYLE', 'ALL OPINIONS. NO REFUNDS.'];
/** `roar` lifts the crowd to its feet after each contact; the big board keeps the running score. */
export function arena(c: CanvasRenderingContext2D, time: number, lap: number, roar = 0, sign = 'MUMU BULL RUN'): void {
  const gradient = c.createLinearGradient(0, 0, 0, 540);
  gradient.addColorStop(0, '#11291f'); gradient.addColorStop(0.58, '#306b48'); gradient.addColorStop(1, '#b2ad64');
  c.fillStyle = gradient; c.fillRect(-15, -15, 990, 570);
  c.save(); c.globalAlpha = 0.22;
  for (let i = 0; i < 7; i += 1) {
    const pivot = i * 175 - 50;
    const sway = Math.sin(time * 0.29 + i) * 83;
    poly(c, [[pivot, 9], [pivot + sway - 130, 330], [pivot + sway + 130, 330]], i % 2 ? '#a8ff9a' : '#ffe990', 0);
  }
  c.restore();
  oval(c, 498, 202, 690, 181, '#193e2d', 7);
  oval(c, 498, 180, 651, 160, '#215239', 4);
  for (let row = 0; row < 3; row += 1) {
    const y = 160 + row * 43;
    for (let i = 0; i < 29; i += 1) {
      const x = i * 36 + row * 14 - 36;
      const cheer = clamp(0.5 + 0.5 * Math.sin(time * (2.6 + i % 3 * 0.4) + i * 1.4) + roar * 0.8);
      const cy = y + Math.abs(i - 14) * 1.5 - cheer * 7 - roar * (8 + i % 3 * 5);
      const skin = [CREAM, '#bb945f', '#84b383', '#ad9abb'][i % 4]!;
      line(c, [[x - 7, cy + 18], [x - 15, cy + 10 - cheer * 16], [x - 19, cy + 3 - cheer * 23]], skin, 4);
      line(c, [[x + 7, cy + 17], [x + 16, cy + 9 - cheer * 14], [x + 21, cy + 3 - cheer * 23]], skin, 4);
      box(c, x - 9, cy + 8, 19, 25, i % 2 ? '#2d7750' : '#435b3c', 5, 1);
      oval(c, x, cy, 8, 10, skin, 2);
      if (i % 7 === 0) { box(c, x + 18, cy - 26 - cheer * 7, 9, 15, INK, 2, 1); box(c, x + 20, cy - 24 - cheer * 7, 5, 10, GREEN, 1, 0); }
    }
    line(c, [[0, y + 36], [960, y + 36]], '#0e281c', 5);
  }
  c.save(); c.translate(490, 133); c.rotate(-0.012);
  box(c, -286, -46, 572, 76, '#072619', 9, 5);
  text(c, sign, 0, -9, 51, '#91ed8f', 'center', 543);
  c.restore();
  const banner = SPONSORS[Math.floor(time / 6.8 + lap) % SPONSORS.length]!;
  box(c, 34, 279, 892, 43, '#d9c982', 4, 4);
  text(c, banner, 480, 302, 25, INK, 'center', 852);
  line(c, [[0, 325], [960, 325]], INK, 10);
  for (let x = 10; x < 960; x += 96) { line(c, [[x, 322], [x, 395]], '#163b28', 8); }
  const floor = c.createLinearGradient(0, 323, 0, 540);
  floor.addColorStop(0, '#768d58'); floor.addColorStop(1, '#c2a66b');
  c.fillStyle = floor; c.fillRect(-15, 345, 990, 210);
  for (let i = 0; i < 30; i += 1) {
    const x = grain(i + 234) * 1020 - 30;
    const y = 353 + grain(i + 82) * 178;
    line(c, [[x, y], [x + 9 + i % 6, y - 2]], '#87905b', 2);
  }
}

export function track(c: CanvasRenderingContext2D, time: number, crashed: boolean, age: number): void {
  const size = 180;
  const scroll = (time * 252) % size;
  for (let i = -1; i < 7; i += 1) {
    const x = i * size - scroll;
    const y = floorAt(x);
    const nearTrap = Math.abs(x + size / 2 - 403) < 280;
    const fall = crashed && nearTrap ? ease((age - 0.18 - Math.abs(x - 360) * 0.0005) / 0.8) : 0;
    c.save(); c.translate(x, y);
    c.translate(0, fall * 115); c.rotate(fall * (i % 2 ? 0.55 : -0.65));
    poly(c, [[-2, 0], [size + 2, -size * 0.047], [size + 2, 43], [-2, 53]], '#264d36', 4);
    poly(c, [[-2, 0], [size + 2, -size * 0.047], [size + 2, 11], [-2, 21]], GREEN, 3);
    line(c, [[7, 3], [size - 8, -size * 0.047 + 3]], CREAM, 2);
    for (const rx of [17, 158]) oval(c, rx, 30 - rx * 0.047, 4, 4, GOLD, 2);
    line(c, [[73, 30], [91, 20], [87, 31], [107, 21]], '#5b9a57', 4);
    c.restore();
  }
  if (crashed) {
    const open = ease((age - 0.18) / 0.55);
    oval(c, 410, 469, 145 * open, 30 * open, '#10140f', 5);
    if (open > 0.8) { text(c, 'TERMS UPDATED', 411, 473, 21, RED, 'center', 257); }
  }
}

export function dust(c: CanvasRenderingContext2D, time: number, x: number, y: number, strength: number): void {
  for (let i = 0; i < 14; i += 1) {
    const u = frac(time * 2 + i / 14);
    c.globalAlpha = (1 - u) * strength * 0.57;
    oval(c, x - 112 - u * 172, y - u * 25 + Math.sin(i * 2) * 5, 8 + u * 21, 5 + u * 13, '#e4d2a0', 0);
  }
  c.globalAlpha = 1;
}

export function impact(c: CanvasRenderingContext2D, x: number, y: number, age: number, word = 'BONK!'): void {
  if (age < 0 || age > 0.58) return;

  const u = clamp(age / 0.58);
  c.save(); c.globalAlpha = 1 - ease(u);
  c.translate(x, y - 63); c.rotate(-0.13); c.scale(0.7 + Math.sin(u * Math.PI) * 0.5, 0.7 + Math.sin(u * Math.PI) * 0.5);
  star(c, 0, 0, 74, CREAM, 10); text(c, word, 0, 3, 48, RED, 'center', 200, true); c.restore();
  c.save(); c.globalAlpha = (1 - u) * 0.7; c.strokeStyle = CREAM; c.lineWidth = 4 * (1 - u) + 1;
  c.beginPath(); c.ellipse(x, y + 14, 23 + u * 145, 4 + u * 23, 0, 0, TAU); c.stroke(); c.restore();
}

export function crashStamp(c: CanvasRenderingContext2D, age: number): void {
  const down = ease(age / 0.29);
  const rebound = Math.sin(clamp((age - 0.29) / 0.66) * Math.PI) * 23 * Math.exp(-Math.max(0, age - 0.29));
  const y = mix(-220, 386, down) - rebound;
  c.save(); c.translate(387, y); c.rotate(-0.065);
  box(c, -35, -286, 70, 210, '#94805b', 10, 5);
  oval(c, 0, -272, 66, 42, '#97623f', 5);
  for (let i = 0; i < 4; i += 1) oval(c, -48 + i * 33, -306 + Math.abs(i - 1.5) * 6, 22, 23, '#ad7647', 4);
  box(c, -121, -89, 242, 87, '#a35550', 9, 6);
  box(c, -135, -20, 270, 30, INK, 6, 4);
  text(c, 'TERMS UPDATED', 0, -51, 27, CREAM, 'center', 229);
  text(c, 'YOU CLICKED AGREE', 0, -28, 13, '#f4bf92', 'center');
  c.restore();
}

/** A support desk turns the wreck into a lasting scene, complete with hold music and paperwork. */
export function supportDesk(c: CanvasRenderingContext2D, age: number, front: boolean): void {
  const entry = ease((age - 0.65) / 0.9);
  const x = mix(1110, 701, entry), y = 466;
  const time = age;
  if (!front) {
    box(c, x - 146, 238, 290, 243, '#7e8375', 7, 5);
    box(c, x - 136, 251, 270, 171, '#c2ba95', 2, 3);
    box(c, x - 147, 235, 291, 38, RED, 4, 4);
    text(c, 'LIVE SUPPORT', x, 255, 28, CREAM, 'center');
    box(c, x + 90, 289, 33, 35, CREAM, 0, 2);
    text(c, '404', x + 107, 307, 14, INK, 'center');
    line(c, [[x - 110, 274], [x - 110, 418]], '#8b886e', 3);
    return;
  }
  box(c, x - 151, 423, 304, 18, '#d9c08b', 3, 4);
  box(c, x - 141, 440, 281, 57, '#5a6c5a', 2, 4);
  text(c, 'YOUR TICKET: #404', x - 2, 459, 22, CREAM, 'center');
  text(c, 'YOUR CALL IS NOT IMPORTANT TO US', x - 2, 483, 12, '#d8c890', 'center', 262);
  box(c, x + 66, 393, 58, 30, '#243b32', 4, 3);
  line(c, [[x + 72, 398], [x + 113, 398]], '#708573', 6);
  c.save(); c.translate(x + 95, 390); c.rotate(Math.sin(time * 15) * 0.045);
  box(c, -22, -8, 44, 11, INK, 5, 2); c.restore();
  for (let i = 0; i < 4; i += 1) {
    const u = frac(age * 0.14 + i / 4);
    c.save(); c.translate(x - 133 + u * 17, 410 + u * 80); c.rotate(u * 0.2);
    box(c, -15, -6, 30, 42, CREAM, 0, 1); line(c, [[-9, 2], [9, 2], [-9, 9], [7, 9]], '#657464', 1); c.restore();
  }
}

export function parade(c: CanvasRenderingContext2D, time: number, progress: number, front: boolean): void {
  const x = mix(1100, 750, ease(progress));
  const bob = Math.sin(time * 7) * 4;
  if (!front) {
    for (const [bx, offset] of [[x - 93, 0], [x + 74, 2]] as const) {
      bear(c, { x: bx, y: 496, scale: 0.58, time: time + offset, panic: 0.45, gesture: 1, suit: '#607396' });
    }
    box(c, x - 140, 403 + bob, 261, 30, GOLD, 7, 4);
    poly(c, [[x - 124, 405 + bob], [x - 116, 343 + bob], [x - 84, 369 + bob], [x - 53, 338 + bob], [x - 38, 405 + bob]], '#b89b44', 4);
    return;
  }
  box(c, x - 143, 420 + bob, 267, 49, '#163728', 6, 4);
  text(c, 'LEFT THE CHAT', x - 10, 445 + bob, 31, GREEN, 'center', 245);
  if (progress >= 1) {
    for (let i = 0; i < 18; i += 1) {
      const u = frac(time * 0.29 + i / 18);
      const cx = x - 146 + grain(i + 33) * 276 + Math.sin(time * 2 + i) * 18;
      const cy = 197 + u * 212;
      c.save(); c.translate(cx, cy); c.rotate(time * 3 + i); box(c, -3, -5, 6, 10, i % 2 ? GOLD : GREEN, 0, 0); c.restore();
    }
  }
}
