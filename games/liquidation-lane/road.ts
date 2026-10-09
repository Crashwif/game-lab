/** A perspective highway. Travel and near misses are presentation, never round outcomes. */
import { CYAN, INK, LIME, PINK, ellipse, line, panel, poly, text } from './art';
import { noise, smoothstep } from './motion';

/** One car of background traffic: its own cruising speed, so it keeps moving when you stop. */
export interface Car { z: number; pace: number; side: number; index: number; sec: boolean }

export interface RoadView {
  time: number;
  distance: number;
  tension: number;
  steering: number;
  /** 0 to 1: your skid onto the STOP LOSS barrier, which is hit at 1. */
  wreck: number;
  parked: number;
  cars: readonly Car[];
  /** Round seconds (held through the crash) for the scripted near misses; -1 between rounds. */
  elapsed: number;
  /** 0 to 1: how much of the driving-only spectacle is showing. */
  live: number;
  /** 0 to 1: the helicopter's flight in from the left. */
  heli: number;
  /** Seconds since the current rocket launched, or -1. */
  rocket: number;
  tunnel: { from: number; to: number };
  /** Seconds since someone else's crash after your cash-out, or -1. */
  dodge: number;
  /** 0 to 1: how much of the last crash (your wreck, a dodged one, a tunnel) still shows while the tow truck clears it. */
  aftermath: number;
}

const HORIZON = 153;
/** The same bend drives the road projection and the automatic steering. */
export const roadBend = (distance: number, tension: number): number => Math.sin(distance * 0.0007) * (35 + tension * 55);
const SIGNS = [
  ['NO BRAKES', 'NO KYC', LIME],
  ['DAD\'S PENSION', 'RACING TEAM', PINK],
  ['SLIPPAGE AHEAD', 'WET ROAD. DRY WALLET.', '#ffb65c'],
  ['1000× LEVERAGE', 'WHAT COULD GO WRONG', CYAN],
  ['SELL BUTTON', 'REMOVED FOR YOUR SAFETY', PINK],
  ['RISK MANAGEMENT', 'EXIT CLOSED', '#ffb65c'],
  ['THERAPY', 'YOU MISSED THE EXIT', LIME],
] as const;
const LANES = [-0.69, 0.68, -0.72, 0.72, -0.66];

export const createTraffic = (): Car[] => LANES.map((side, index) => ({ z: index * 321 + 260, pace: 0.35 + noise(index * 5) * 0.1, side, index, sec: false }));

/** Traffic cruises at a share of the round's pace; `speed` is yours. Cars you leave behind come back from under the dash. */
export function stepTraffic(cars: Car[], speed: number, pace: number, tension: number, dt: number): void {
  for (const car of cars) {
    car.z += (car.pace * pace + 20 - speed) * dt * 1.45;
    if (car.z < -20) car.z += 1640;
    else if (car.z > 1620) car.z -= 1640;
    // Liveries only change near the horizon, where a car is a few pixels wide.
    if (car.z > 900) car.sec = car.index === 4 ? tension > 0.5 : car.index === 2 && tension > 0.8;
  }
}

/** Scripted near misses keyed to round time, never to the result: the first at 9 s, then every 12 s. */
export function nearMiss(elapsed: number): { k: number; p: number; side: number } | null {
  if (elapsed < 9) return null;
  const k = Math.floor((elapsed - 9) / 12), p = (elapsed - 9 - k * 12) / 3.2;
  return p < 1 ? { k, p, side: k % 2 ? -1 : 1 } : null;
}

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

function traffic(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, index: number, police: boolean, spin = 0): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ellipse(ctx, 0, 0, 64, 10, '#060815');
  if (spin) { ctx.translate(0, -30); ctx.rotate(spin); ctx.translate(0, 30); }
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

function barrier(ctx: CanvasRenderingContext2D, p: { x: number; y: number; s: number }): void {
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.s, p.s);
  poly(ctx, [[-175, 2], [-159, -90], [156, -90], [177, 2]], '#dad4b8', '#252030', 4);
  for (let i = 0; i < 6; i += 1) poly(ctx, [[-151 + i * 52, -85], [-124 + i * 52, -85], [-153 + i * 52, -9], [-180 + i * 52, -9]], '#d22c5a');
  panel(ctx, -97, -66, 194, 43, '#181e2b', '#eadaba', 2);
  text(ctx, 'STOP LOSS', 0, -43, 26, '#ffe3be', 'center'); ctx.restore();
}

export function drawRoad(ctx: CanvasRenderingContext2D, view: RoadView): void {
  ctx.save();
  const wreck = view.wreck * view.aftermath;
  if (wreck > 0) {
    const spin = Math.sin(Math.min(1, wreck) * 2.2) * 0.32;
    ctx.translate(480, 220); ctx.rotate(spin); ctx.translate(-480, -220);
  }
  skyline(ctx, view);
  const curve = roadBend(view.distance, view.tension);
  const lateral = view.steering * 60 - view.parked * 295 + wreck * 220;
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
  // Receding barriers, neon streetlights, advertisements, traffic and the occasional tunnel.
  const objects: { z: number; kind: 'lamp' | 'sign' | 'car' | 'arch'; index: number; side: number; alpha: number; sec: boolean }[] = [];
  for (let i = 0; i < 14; i += 1) objects.push({ z: i * 145 + 35 - view.distance % 145, kind: 'lamp', index: i, side: 0, alpha: 1, sec: false });
  for (let i = 0; i < 4; i += 1) objects.push({ z: i * 550 + 90 - view.distance % 550, kind: 'sign', index: i + Math.floor(view.distance / 550), side: i % 2 ? -1 : 1, alpha: 1, sec: false });
  for (const car of view.cars) objects.push({ ...car, kind: 'car', alpha: 1 });
  // Arches come into view as far off as the lamps; between rounds a tunnel you crashed in fades with the rest of the aftermath.
  const tunnelEnd = Math.min(view.tunnel.to, view.distance + 2100);
  for (let w = view.tunnel.from; w <= tunnelEnd; w += 230) if (w - view.distance > 8) objects.push({ z: w - view.distance, kind: 'arch', index: 0, side: 0, alpha: view.elapsed < 0 ? view.aftermath : 1, sec: false });
  const miss = view.live > 0 ? nearMiss(view.elapsed) : null;
  if (miss) {
    // It drifts into your lane, then swerves clear at the last moment.
    const z = 760 * (1 - miss.p) ** 1.4 - 10;
    const cut = smoothstep(0.35, 0.62, miss.p) * (1 - smoothstep(0.76, 0.92, miss.p));
    const alpha = view.live * smoothstep(0, 0.08, miss.p);
    objects.push({ z, kind: 'car', index: 2, side: miss.side * (0.66 - cut * 0.5), alpha, sec: false });
    objects.push({ z: z + 180, kind: 'car', index: 3, side: -miss.side * 0.68, alpha, sec: false });
  }
  for (const object of objects.sort((a, b) => b.z - a.z)) {
    if (object.z < (object.kind === 'car' ? -20 : 8) || object.alpha <= 0) continue;
    const p = project(object.z, object.side);
    ctx.globalAlpha = object.alpha;
    if (object.kind === 'car') {
      traffic(ctx, p.x, p.y, p.s * 1.05, object.index, object.sec);
    } else if (object.kind === 'arch') {
      const l = project(object.z, -1.12), r = project(object.z, 1.12), roof = l.y - 210 * l.s;
      line(ctx, [[l.x, l.y], [l.x, roof], [r.x, roof], [r.x, r.y]], '#82969f', Math.max(2, 10 * l.s));
      line(ctx, [[l.x + 30 * l.s, roof + 8 * l.s], [r.x - 30 * l.s, roof + 8 * l.s]], '#ffcf7a', Math.max(1, 3 * l.s));
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
  ctx.globalAlpha = 1;
  // The roadside barrier arrives with the skid and is hit at the impact, then fades where it stands as the wreck is
  // towed. Without the roll it stops a little further off, so its sign stays between the pillar, panel and caption.
  if (wreck > 0) {
    ctx.save(); ctx.globalAlpha = view.aftermath;
    barrier(ctx, project(280 * (1 - view.wreck) + 24, -1.08)); ctx.restore();
  }
  // From the valet: a STOP LOSS ahead, and after the crash someone else's Lambo overtakes from under the dash and spins into it.
  const ahead = view.dodge >= 0 ? view.aftermath * Math.max(smoothstep(0.6, 1, view.parked), smoothstep(0, 0.2, view.dodge)) : smoothstep(0.6, 1, view.parked);
  if (ahead > 0) {
    ctx.save(); ctx.globalAlpha = ahead;
    barrier(ctx, project(172, -1.1));
    if (view.dodge >= 0) {
      const slide = smoothstep(0, 0.42, view.dodge), hit = view.dodge - 0.42;
      const rebound = hit > 0 ? Math.exp(-hit * 5) * Math.sin(hit * 14) * 0.08 : 0;
      const car = project(-20 + 170 * (1 - (1 - slide) ** 2), -0.32 - 0.56 * slide + rebound);
      traffic(ctx, car.x, car.y, car.s * 1.05, 1, false, -0.8 * slide - rebound * 4);
      if (hit > 0) {
        ctx.save(); ctx.globalAlpha = ahead * smoothstep(0.05, 0.2, hit);
        panel(ctx, car.x - 24, car.y - 98 * car.s - 9, 48, 15, '#2a1020', PINK, 3);
        text(ctx, 'REKT', car.x, car.y - 98 * car.s - 1, 10, PINK, 'center'); ctx.restore();
        if (hit < 0.2) for (let i = 0; i < 8; i += 1) {
          const a = i * Math.PI / 4, r = (20 + hit * 260) * car.s;
          line(ctx, [[car.x - 50 * car.s + Math.cos(a) * r * 0.4, car.y - 35 * car.s + Math.sin(a) * r * 0.4], [car.x - 50 * car.s + Math.cos(a) * r, car.y - 35 * car.s + Math.sin(a) * r]], '#ffe2a8', 2);
        }
        for (let i = 0; i < 4; i += 1) {
          const age = hit - i * 0.15;
          if (age <= 0) continue;
          ctx.globalAlpha = ahead * 0.55 * Math.exp(-age * 0.9);
          ellipse(ctx, car.x - 30 * car.s + i * 9, car.y - (60 + age * 70) * car.s, (14 + age * 26) * car.s * 1.6, (14 + age * 26) * car.s, '#8d8a99');
        }
      }
    }
    ctx.restore();
  }
  // A surveillance helicopter flies in from the left, and a spectacularly irresponsible rocket.
  if (view.heli > 0) {
    const e = 1 - (1 - view.heli) ** 3;
    const x = -120 + (480 + Math.sin(view.time * 0.7) * 115) * e;
    const y = 82 + Math.sin(view.time * 1.7) * 5;
    ctx.save(); ctx.translate(x, y); ctx.rotate((1 - e) * 0.22);
    ellipse(ctx, 0, 0, 25, 12, '#171c2f', '#8493a4');
    poly(ctx, [[-17, -3], [-56, -9], [-57, -3], [-20, 5]], '#161d31');
    line(ctx, [[0, -13], [0, -23]], '#1c2037', 3);
    line(ctx, [[-43, -24], [43, -24]], '#8aa4b6', 2);
    line(ctx, [[-Math.sin(view.time * 35) * 42, -27], [Math.sin(view.time * 35) * 42, -27]], '#a0b4c9', 2);
    text(ctx, 'SEC', 5, 0, 9, '#fff', 'center');
    ctx.restore();
  }
  if (view.rocket >= 0 && view.rocket < 3.2) {
    // Launched from behind the skyline, it climbs off the top of the frame before the next one goes up.
    const at = (u: number) => [104 + u * 230, HORIZON + 8 - u * 60 - u * u * 280] as const;
    const u = view.rocket / 3.2, [x, y] = at(u), [nx, ny] = at(u + 0.01);
    ctx.save(); ctx.beginPath(); ctx.rect(-300, -300, 1560, HORIZON + 300); ctx.clip();
    for (let i = 1; i <= 6; i += 1) {
      const [tx, ty] = at(Math.max(0, u - i * 0.035));
      ctx.globalAlpha = 0.4 * (1 - i / 7); ellipse(ctx, tx, ty, 3 + i, 3 + i, '#c9b8c8');
    }
    ctx.globalAlpha = 1;
    ctx.translate(x, y); ctx.rotate(Math.atan2(nx - x, y - ny));
    poly(ctx, [[-8, 16], [0, 34 + (Math.sin(view.time * 9) * 5)], [8, 16]], '#ffaf42');
    poly(ctx, [[-9, 17], [-8, -10], [0, -24], [8, -10], [9, 17]], '#e5e3d6', '#3d314f');
    ellipse(ctx, 0, -5, 5, 7, PINK); ctx.restore();
  }
  ctx.restore();
}

/** The crash-to-lobby wipe: a recovery truck hauls the wreck across the windshield. `u` runs 0 to 1. */
export function drawTow(ctx: CanvasRenderingContext2D, u: number, time: number): void {
  ctx.save(); ctx.translate(-470 + u * 1920, 338);
  ellipse(ctx, -120, 0, 300, 18, '#060815');
  poly(ctx, [[-370, -46], [70, -46], [70, -14], [-382, -14]], '#3b3f4f', INK, 3);
  poly(ctx, [[-340, -46], [-318, -86], [-205, -108], [-92, -94], [-40, -46]], '#bfc628', INK, 4);
  poly(ctx, [[-290, -82], [-206, -99], [-120, -88], [-150, -64], [-270, -62]], '#182840', INK, 3);
  line(ctx, [[-232, -96], [-214, -78], [-238, -70], [-220, -60]], '#d4e9e7', 1.5);
  text(ctx, 'LIQUIDATION RECOVERY LLC', -160, -30, 13, '#f2f3e4', 'center', 400);
  poly(ctx, [[70, -14], [70, -160], [188, -160], [236, -96], [246, -14]], '#f2a33a', INK, 4);
  poly(ctx, [[150, -148], [184, -148], [222, -100], [150, -100]], '#182840', INK, 3);
  panel(ctx, 86, -176, 82, 14, '#262a36', INK, 3);
  const flash = Math.sin(time * 18) > 0;
  ellipse(ctx, 104, -169, 9, 5, flash ? '#ffcf3a' : '#7a5a1a'); ellipse(ctx, 150, -169, 9, 5, flash ? '#7a5a1a' : '#ffcf3a');
  text(ctx, 'TOW', 112, -70, 30, INK, 'center');
  ctx.restore();
}
