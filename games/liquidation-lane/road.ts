/** A perspective highway. Travel and near misses are presentation, never round outcomes. */
import { CYAN, INK, LIME, PINK, ellipse, line, panel, poly, text } from './art';
import { clamp, noise } from './motion';

export interface RoadView {
  time: number;
  distance: number;
  tension: number;
  steering: number;
  wreck: number;
  parked: number;
  reduced: boolean;
}

const HORIZON = 153;
const SIGNS = [
  ['NO BRAKES', 'NO KYC', LIME],
  ['DAD\'S PENSION', 'RACING TEAM', PINK],
  ['RISK MANAGEMENT', 'EXIT CLOSED', '#ffb65c'],
  ['1000× LEVERAGE', 'WHAT COULD GO WRONG', CYAN],
  ['SELL BUTTON', 'REMOVED FOR YOUR SAFETY', PINK],
  ['THERAPY', 'YOU MISSED THE EXIT', LIME],
] as const;

function skyline(ctx: CanvasRenderingContext2D, view: RoadView): void {
  const sky = ctx.createLinearGradient(0, 0, 0, 340);
  sky.addColorStop(0, '#0d1235'); sky.addColorStop(0.4, '#53296a'); sky.addColorStop(0.66, '#fc785b'); sky.addColorStop(1, '#181b32');
  ctx.fillStyle = sky; ctx.fillRect(-300, -240, 1560, 900);
  const shift = view.steering * 25;
  ctx.save();
  ctx.beginPath(); ctx.arc(471 + shift, 118, 62, 0, Math.PI * 2); ctx.clip();
  const sun = ctx.createLinearGradient(0, 55, 0, 185);
  sun.addColorStop(0, '#ffdeb0'); sun.addColorStop(1, '#ff4084');
  ctx.fillStyle = sun; ctx.fillRect(380 + shift, 50, 180, 140);
  ctx.fillStyle = '#6d2c68';
  for (let y = 123; y < 180; y += 10) ctx.fillRect(380 + shift, y, 180, (y - 110) / 13);
  ctx.restore();
  for (let i = 0; i < 43; i += 1) {
    const x = i * 29 - 140 + shift * 0.7;
    const height = 18 + noise(i * 9) * 78;
    const w = 16 + noise(i * 3 + 4) * 19;
    ctx.fillStyle = i % 3 ? '#19223d' : '#232440'; ctx.fillRect(x, HORIZON - height, w, height + 20);
    if (i % 4 === 0) line(ctx, [[x + w / 2, HORIZON - height - 21], [x + w / 2, HORIZON - height]], '#29263f', 2);
    ctx.fillStyle = i % 2 ? '#9569a4' : '#c8a474';
    for (let row = 0; row < Math.floor(height / 10); row += 1) for (let col = 0; col < 3; col += 1) {
      if (noise(i * 18 + row * 3 + col) > 0.45) ctx.fillRect(x + 4 + col * 6, HORIZON - height + row * 10 + 5, 2, 3);
    }
  }
  // The exchange tower: a champagne-glass skyline with a liquidation-red ticker.
  poly(ctx, [[178 + shift, 162], [185 + shift, 73], [200 + shift, 46], [215 + shift, 73], [223 + shift, 162]], '#232442', '#9c68a0');
  line(ctx, [[200 + shift, 17], [200 + shift, 46]], '#ffd39a', 2);
  panel(ctx, 167 + shift, 94, 67, 18, '#171326', PINK, 2);
  text(ctx, '$COPE -99%', 200 + shift, 103, 9, PINK, 'center');
}

function traffic(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, index: number, police: boolean): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ellipse(ctx, 0, 0, 64, 10, '#060815');
  const colour = police ? '#e6e6dd' : ['#fc4c91', '#7b49ea', '#eeae36', '#26c9cc'][index % 4]!;
  poly(ctx, [[-54, -8], [-52, -35], [-34, -60], [31, -60], [52, -36], [58, -8]], colour, INK, 4);
  poly(ctx, [[-29, -55], [27, -55], [40, -36], [-41, -36]], '#182840', INK, 3);
  line(ctx, [[-50, -17], [49, -17]], '#272036', 6);
  line(ctx, [[-46, -30], [-26, -28]], '#ff325b', 6); line(ctx, [[27, -28], [46, -30]], '#ff325b', 6);
  panel(ctx, -16, -20, 32, 12, '#eee8bf', undefined, 1);
  text(ctx, police ? 'SEC' : ['RUGPULL', 'NGMI', 'WAGMI', 'EXIT LP'][index % 4]!, 0, -14, 6, '#121323', 'center');
  if (police) {
    panel(ctx, -23, -67, 46, 8, '#141622', undefined, 2);
    ctx.fillStyle = '#ff407e'; ctx.fillRect(-21, -66, 18, 6); ctx.fillStyle = CYAN; ctx.fillRect(3, -66, 18, 6);
  }
  ctx.restore();
}

export function drawRoad(ctx: CanvasRenderingContext2D, view: RoadView): void {
  ctx.save();
  if (view.wreck > 0) {
    const spin = view.reduced ? 0 : Math.sin(Math.min(1, view.wreck) * 2.2) * 0.32;
    ctx.translate(480, 220); ctx.rotate(spin); ctx.translate(-480, -220);
  }
  skyline(ctx, view);
  const curve = Math.sin(view.distance * 0.0007) * (35 + view.tension * 55);
  const lateral = view.steering * 60 - view.parked * 295 + view.wreck * 220;
  const project = (z: number, side: number) => {
    const s = 1 / (1 + Math.max(-30, z) / 90);
    return { x: 480 + curve * (1 - s) ** 2 + lateral * s + side * 540 * s, y: HORIZON + 221 * s, s };
  };
  ctx.fillStyle = '#29213b'; ctx.fillRect(-300, HORIZON + 3, 1560, 460);
  const advance = view.distance % 30;
  for (let i = 70; i >= 0; i -= 1) {
    const z = i * 30 - advance;
    const far = project(z + 30, 0); const near = project(z, 0);
    const strip = (a: number, b: number, colour: string) => poly(ctx, [[project(z + 30, a).x, far.y], [project(z + 30, b).x, far.y], [project(z, b).x, near.y], [project(z, a).x, near.y]], colour);
    const alternating = (i + Math.floor(view.distance / 30)) % 2 === 0;
    strip(-1.13, 1.13, alternating ? '#b0a6be' : '#bb3867');
    strip(-1, 1, alternating ? '#242837' : '#272b3b');
    strip(-0.99, -0.98, CYAN); strip(0.98, 0.99, PINK);
    if (alternating) for (const lane of [-1 / 3, 1 / 3]) strip(lane - 0.006, lane + 0.006, '#eee4c5');
    if (view.parked > 0.1) strip(1.14, 1.65, '#344540');
  }
  // Receding barriers, neon streetlights and advertisements.
  const objects: { z: number; kind: 'lamp' | 'sign' | 'car'; index: number; side: number }[] = [];
  for (let i = 0; i < 14; i += 1) objects.push({ z: i * 145 + 35 - view.distance % 145, kind: 'lamp', index: i, side: 0 });
  for (let i = 0; i < 4; i += 1) objects.push({ z: i * 550 + 90 - view.distance % 550, kind: 'sign', index: i + Math.floor(view.distance / 550), side: i % 2 ? -1 : 1 });
  for (let i = 0; i < 5; i += 1) objects.push({ z: ((i * 321 + 260 - view.distance * (0.4 + i * 0.04)) % 1600 + 1600) % 1600, kind: 'car', index: i, side: [-0.69, 0.68, -0.72, 0.72, -0.66][i]! });
  for (const object of objects.sort((a, b) => b.z - a.z)) {
    if (object.z < 8) continue;
    const p = project(object.z, object.side);
    if (object.kind === 'car') {
      traffic(ctx, p.x, p.y, p.s * 1.05, object.index, object.index === 4 && view.tension > 0.5);
    } else if (object.kind === 'lamp') {
      for (const side of [-1, 1]) {
        const base = project(object.z, side * 1.17);
        const top = base.y - 275 * p.s;
        line(ctx, [[base.x, base.y], [base.x, top], [base.x - side * 75 * p.s, top + 8 * p.s]], '#77718f', Math.max(1, 5 * p.s));
        line(ctx, [[base.x - side * 32 * p.s, top + 3 * p.s], [base.x - side * 74 * p.s, top + 8 * p.s]], side < 0 ? CYAN : PINK, Math.max(1, 4 * p.s));
      }
    } else {
      const base = project(object.z, object.side * 1.5);
      const [headline, sub, colour] = SIGNS[object.index % SIGNS.length]!;
      ctx.save(); ctx.translate(base.x, base.y); ctx.scale(p.s, p.s);
      line(ctx, [[-60, 0], [-60, -185]], '#55536c', 10); line(ctx, [[60, 0], [60, -185]], '#55536c', 10);
      panel(ctx, -136, -222, 272, 91, '#121a2f', colour, 4);
      text(ctx, headline, 0, -191, 22, colour, 'center', 248); text(ctx, sub, 0, -158, 13, '#e9e7f5', 'center', 244);
      ctx.restore();
    }
  }
  // The roadside barrier rushes into view as the car slides off the highway.
  if (view.wreck > 0) {
    const p = project(280 * (1 - view.wreck) + 24, -1.08);
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.s, p.s);
    poly(ctx, [[-175, 2], [-159, -90], [156, -90], [177, 2]], '#dad4b8', '#252030', 4);
    for (let i = 0; i < 6; i += 1) poly(ctx, [[-151 + i * 52, -85], [-124 + i * 52, -85], [-153 + i * 52, -9], [-180 + i * 52, -9]], '#d22c5a');
    panel(ctx, -97, -66, 194, 43, '#181e2b', '#eadaba', 2);
    text(ctx, 'STOP LOSS', 0, -43, 26, '#ffe3be', 'center'); ctx.restore();
  }
  // A surveillance helicopter and a spectacularly irresponsible rocket.
  if (view.tension > 0.32) {
    const x = 360 + Math.sin(view.time * 0.7) * 115;
    const y = 82 + Math.sin(view.time * 1.7) * 5;
    ctx.save(); ctx.translate(x, y);
    ellipse(ctx, 0, 0, 25, 12, '#171c2f', '#8493a4');
    poly(ctx, [[17, -3], [56, -9], [57, -3], [20, 5]], '#161d31');
    line(ctx, [[0, -13], [0, -23]], '#1c2037', 3);
    line(ctx, [[-43, -24], [43, -24]], '#8aa4b6', 2);
    if (!view.reduced) line(ctx, [[-Math.sin(view.time * 35) * 42, -27], [Math.sin(view.time * 35) * 42, -27]], '#a0b4c9', 2);
    text(ctx, 'SEC', -5, 0, 9, '#fff', 'center');
    ctx.restore();
  }
  if (view.tension > 0.6) {
    const x = 104 + ((view.time * 27) % 150);
    const y = 119 - ((view.time * 9) % 95);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.55);
    poly(ctx, [[-8, 16], [0, 34 + Math.sin(view.time * 9) * 5], [8, 16]], '#ffaf42');
    poly(ctx, [[-9, 17], [-8, -10], [0, -24], [8, -10], [9, 17]], '#e5e3d6', '#3d314f');
    ellipse(ctx, 0, -5, 5, 7, PINK); ctx.restore();
  }
  if (view.parked > 0.35) {
    ctx.save(); ctx.globalAlpha = clamp((view.parked - 0.35) * 2, 0, 1);
    panel(ctx, 346, 179, 277, 76, '#12332b', '#8bdd7e', 5);
    text(ctx, 'OFFSHORE VALET', 484, 202, 23, LIME, 'center');
    text(ctx, 'PAPER HANDS. LEATHER SEATS.', 484, 232, 12, '#d2e2ca', 'center'); ctx.restore();
  }
  ctx.restore();
}
