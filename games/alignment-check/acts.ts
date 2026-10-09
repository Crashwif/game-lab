/**
 * Elapsed-time presentation acts in Family Meeting's actAt shape (nothing here reads the outcome): 32 s a pigeon lands
 * on the heavy, 52 s a drone lowers a bubble tea, 75 s the pizza guy, 100 s the radio crackles, 125 s the lieutenant
 * sits, 145 s his headband blows off; from 170 s stages 1..6 recur every 24 s with the effort dip.
 */
import { mix, smoothstep } from './motion';

const STARTS = [0, 32, 52, 75, 100, 125, 145] as const;
const LINES = ['Simple question.', 'A pigeon lands on the heavy', 'A drone delivers a bubble tea', 'The pizza guy finds the roof', 'HQ crackles, nobody answers', 'The lieutenant takes a seat', 'The headband blows off'];
export function actAt(elapsed: number, reduced = false) {
  const seconds = Math.max(0, elapsed / 1000);
  let stage = 0;
  for (let i = 1; i < STARTS.length; i++) if (seconds >= STARTS[i]!) stage = i;
  const loop = seconds >= 170;
  const cycle = loop ? Math.floor((seconds - 170) / 24) : 0;
  const age = loop ? (seconds - 170) % 24 : seconds - STARTS[stage]!;
  if (loop) stage = 1 + (cycle % 6);
  const ramp = Math.min(1, age / 5);
  const release = Math.max(0, 1 - Math.abs(age - 5) / 5);
  const effort = stage === 0 ? 1 : Math.min(1, 0.3 + 0.03 * stage + (1 - release) * 0.52);
  return { stage, age, loop, effort, reach: reduced ? 1 : ramp * ramp * (3 - 2 * ramp), pulse: reduced ? 0 : Math.sin(age * 2.1), line: LINES[stage]! };
}
export type Act = ReturnType<typeof actAt>;
/** World px anchors; the suspect's head and hand when known. */
export interface ActAnchors { heavyHead: { x: number; y: number }; leadX: number; time: number; suspectHead?: { x: number; y: number } | null; suspectHand?: { x: number; y: number } | null }

const INK = '#202432';
const SKIN = '#f1c9a5';
const BAND = '#2f8f3a';
const TAU = Math.PI * 2;

/** World-space act props, drawn after the rigs; nothing is written on any of them. */
export function drawAct(c: CanvasRenderingContext2D, a: Act, at: ActAnchors): void {
  if (!a.stage) return;
  const t = at.time;
  const age = a.age;
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const ink = (w: number): void => { c.strokeStyle = INK; c.lineWidth = w; };
  const fin = (col: string): void => { c.fillStyle = col; ink(2); c.fill(); c.stroke(); };
  const oval = (x: number, y: number, rx: number, ry: number, col: string, rot = 0): void => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); fin(col); };
  const box = (x: number, y: number, w: number, h: number, col: string, r = 3): void => { c.beginPath(); c.roundRect(x, y, w, h, r); fin(col); };
  const dot = (x: number, y: number, r: number, col: string): void => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
  const seg = (x: number, y: number, x2: number, y2: number, col: string, w: number): void => {
    for (const [ww, cc] of [[w + 2, INK], [w, col]] as const) { c.strokeStyle = cc; c.lineWidth = ww; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); }
  };
  const poly = (pts: number[], col: string): void => { c.beginPath(); c.moveTo(pts[0]!, pts[1]!); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i]!, pts[i + 1]!); c.closePath(); fin(col); };
  const cup = (x: number, y: number): void => {
    seg(x + 2, y - 2, x + 7, y - 16, '#e46aa0', 3);
    poly([x - 8, y, x + 8, y, x + 6, y + 22, x - 6, y + 22], '#efd9c3');
    for (let i = 0; i < 4; i++) dot(x - 4 + i * 2.6, y + 18 - (i % 2) * 2.5, 1.5, '#3a2a2a');
    box(x - 9, y - 3, 18, 4, '#d8c9b4', 1);
  };

  // 1+: the pigeon on the heavy's head.
  if (a.stage >= 1) {
    let away = 0;
    if (a.stage === 1 && age < 2.2) away = a.loop && age < 0.7 ? smoothstep(0, 0.7, age) : 1 - smoothstep(a.loop ? 0.7 : 0, 2.2, age);
    const px = at.heavyHead.x + 70 * away;
    const py = at.heavyHead.y - 24 - 70 * away + (away > 0.02 ? 0 : Math.sin(t * 3) * 0.6);
    const flap = away > 0.02 ? Math.sin(t * 50) * 0.9 : 0;
    seg(px - 3, py + 2, px - 5, py + 6, '#e8923a', 2);
    seg(px + 3, py + 2, px + 5, py + 6, '#e8923a', 2);
    oval(px, py, 11, 7, '#8a8d96');
    if (flap) for (const s of [-1, 1]) oval(px - 2, py - 3, 10, 3.5, '#9ea2ab', s * (0.5 + flap) * -0.5);
    const bob = Math.floor(t * 2) % 2 ? 2 : 0;
    oval(px + 9 + bob, py - 6, 5, 5, '#8a8d96');
    dot(px + 6 + bob, py - 3, 2, '#5f9a8a');
    c.fillStyle = '#e8923a';
    c.beginPath();
    c.moveTo(px + 13 + bob, py - 7);
    c.lineTo(px + 18 + bob, py - 5);
    c.lineTo(px + 13 + bob, py - 4);
    c.fill();
    dot(px + 10 + bob, py - 7, 1.2, INK);
  }
  // 2: the drone lowers the cup; the suspect takes it at 4.5 s and sips.
  if (a.stage === 2) {
    const sx = at.suspectHead?.x ?? 690;
    const sy = at.suspectHead?.y ?? 270;
    const inU = smoothstep(0, 2, age);
    const outU = smoothstep(4.6, 7.4, age);
    if (age < 7.4) {
      const dx = mix(1010, sx + 56, inU) + 340 * outU;
      const dy = mix(140, sy - 86, inU) - 120 * outU + Math.sin(t * 2.2) * 4;
      c.save();
      c.translate(dx, dy);
      c.rotate(-0.2 * (1 - inU) + 0.2 * outU);
      seg(-22, -2, 22, -2, '#454955', 4);
      for (const s of [-1, 1]) {
        c.globalAlpha = 0.75;
        oval(s * 20, -7, 11 * Math.abs(Math.sin(t * 45 + s)) + 3, 2, '#b8bcc6');
        c.globalAlpha = 1;
        seg(s * 20, -6, s * 20, -1, '#454955', 3);
        seg(s * 10, 4, s * 12, 9, '#454955', 2);
      }
      box(-13, -4, 26, 9, '#5a5e6a');
      dot(0, 0.5, 2, Math.floor(t * 2) % 2 ? '#ff4d6d' : '#7cf67c');
      c.restore();
      if (age < 4.5) {
        const drop = 40 * smoothstep(2, 3.4, age);
        seg(dx, dy + 5, dx, dy + 8 + drop, '#dfe3ea', 1);
        cup(dx, dy + 10 + drop);
      }
    }
    if (age >= 4.5 && at.suspectHand) {
      const sip = (age - 4.5) % 4;
      cup(at.suspectHand.x, at.suspectHand.y - 10 - 18 * smoothstep(0, 0.4, sip) * (1 - smoothstep(1.2, 1.6, sip)));
    }
  }
  // 3: the pizza guy leaves the box on the AC at 4 s (the roof draws it there).
  if (a.stage === 3 && age < 6) {
    const open = smoothstep(0, 0.5, age) * (1 - smoothstep(4.9, 5.5, age));
    if (open > 0.02) {
      box(36, 292, 58, 108, '#15141a', 0);
      c.fillStyle = `rgba(255,184,102,${(0.2 * open).toFixed(3)})`;
      c.fillRect(36, 292, 58, 108);
      const lx = 34 - 26 * open;
      poly([34, 290, lx, 290 + 10 * open, lx, 400 + 10 * open, 34, 400], '#4a4d57');
      seg(mix(34, lx, 0.15), 345 + 4 * open, mix(34, lx, 0.85), 345 + 8 * open, '#9aa0ab', 3);
    }
    const alpha = smoothstep(0.5, 0.9, age) * (1 - smoothstep(5, 5.3, age));
    if (alpha > 0.02) {
      let gx = mix(44, 66, smoothstep(0.5, 1.2, age));
      gx = mix(gx, 150, smoothstep(3.4, 4, age));
      gx = mix(gx, 66, smoothstep(4, 4.7, age));
      gx = mix(gx, 44, smoothstep(4.8, 5.3, age));
      const moving = (age > 0.5 && age < 1.2) || (age > 3.4 && age < 4.7) || (age > 4.8 && age < 5.3);
      const swing = moving ? Math.sin(age * 16) * 7 : 0;
      const up = age >= 1.2 && age < 3.4;
      const carry = age >= 3.4 && age < 4;
      c.globalAlpha = alpha;
      seg(gx - 4, 352, gx - 6 + swing, 400, '#3b3f4a', 6);
      seg(gx + 4, 352, gx + 6 - swing, 400, '#3b3f4a', 6);
      box(gx - 11, 316, 22, 40, '#e9e4d6');
      const bob = up ? Math.sin(t * 4) * 2 : 0;
      const hx = up ? [gx - 9, gx + 9] : carry ? [gx + 14, gx + 16] : [gx - 13, gx + 13];
      const hy = up ? 282 + bob : carry ? 332 : 354;
      seg(gx - 10, 322, hx[0]!, hy, SKIN, 5);
      seg(gx + 10, 322, hx[1]!, hy, SKIN, 5);
      if (up || carry) box(up ? gx - 22 : gx + 2, (up ? 268 + bob : 322) - 6, 44, 12, '#c98557');
      oval(gx, 300, 12, 12, SKIN);
      c.beginPath();
      c.arc(gx, 298, 12, Math.PI, TAU);
      c.closePath();
      fin('#c94c3b');
      seg(gx + 6, 297, gx + 20, 297, '#c94c3b', 4);
      oval(gx + 6, 303, 2.5, 2.5, SKIN);
      dot(gx + 3, 300, 1.3, INK);
      c.globalAlpha = 1;
    }
  }
  // 4: the belt radio crackles.
  if (a.stage === 4 && age < 1.6) {
    c.strokeStyle = '#e8e2d0';
    c.lineWidth = 2;
    c.globalAlpha = Math.floor(t * 12) % 2 ? 0.9 : 0.35;
    for (const r of [8, 13, 18]) { c.beginPath(); c.arc(at.leadX - 17, 330, r, -2.2, -0.9); c.stroke(); }
    c.globalAlpha = 1;
  }
  // 5: the chair unfolds under the lieutenant.
  if (a.stage === 5) {
    c.save();
    c.translate(at.leadX, 436);
    c.scale(mix(0.2, 1, smoothstep(0, 0.6, age)), 1);
    seg(-24, -50, -20, 0, '#6a6e78', 3);
    seg(14, -50, 8, 0, '#6a6e78', 3);
    seg(-22, -26, 11, -26, '#6a6e78', 2);
    seg(-26, -52, -31, -118, '#6a6e78', 3);
    seg(-18, -52, -23, -118, '#6a6e78', 3);
    box(-34, -120, 14, 34, '#7a7e88', 2);
    box(-27, -55, 43, 7, '#7a7e88', 2);
    c.restore();
  }
  // 6: the headband blows off, is caught and retied (the rig hides its own for 3 s). Plain green.
  if (a.stage === 6 && age < 3) {
    const hx = at.leadX + 2;
    const hy = 275;
    const cx = at.leadX + 46;
    const cy = 300;
    let x: number;
    let y: number;
    if (age < 0.5) {
      const u = smoothstep(0, 0.5, age);
      x = mix(hx, hx + 70, u);
      y = mix(hy - 20, hy - 60, u);
    } else if (age < 1) {
      const u = smoothstep(0.5, 1, age);
      x = mix(hx + 70, cx, u);
      y = mix(hy - 60, cy, u) - Math.sin(u * Math.PI) * 18;
    } else if (age < 1.9) {
      x = cx;
      y = cy;
    } else {
      const u = smoothstep(1.9, 2.8, age);
      x = mix(cx, hx, u);
      y = mix(cy, hy - 20, u);
    }
    c.save();
    c.translate(x, y);
    c.rotate(Math.sin(t * 9) * 0.35 + (age < 1 ? 0.6 : 0));
    for (const [w, col] of [[7, INK], [5, BAND]] as const) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.ellipse(0, 0, 20, 6, 0, 0, TAU); c.stroke(); }
    for (const s of [0, 1]) seg(18, 2, 34 + 4 * s, 6 + 10 * s + Math.sin(t * 11 + s) * 4, BAND, 3);
    c.restore();
  }
  c.restore();
}
