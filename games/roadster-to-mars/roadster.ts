/**
 * The world and the car: a Texas pad with an inverted ramp and a row of Teslas, a sky that goes to
 * space, an Earth that recedes to a marble, the cameos on the altitude ladder, the Roadster with its
 * cold-gas jets, the parachute, and the seeded wreckage. Everything draws into the shell's 960 × 540
 * space from the displayed multiplier and the round clock; nothing here reads or changes the outcome.
 */
import { clamp, mix, mulberry32, noise, smoothstep } from './motion';

export const W = 960;
export const H = 540;
export const INK = '#0a0d14';
export const TAU = Math.PI * 2;
/** World x of the ramp lip; the car's screen anchor in flight. */
export const CAR_X = 440;
export const AX = 400;
export const AY = 330;
/** World y of the ramp lip, where the flight begins. */
export const BASE_Y = 130;
/** World pixels per natural-log unit of multiplier: 360 px per doubling. */
const PX_PER_E = 520;
export const worldY = (m: number): number => BASE_Y + PX_PER_E * Math.log(Math.max(1, m));
export const screenX = (wx: number): number => AX + (wx - CAR_X);
export const screenY = (wy: number, cam: number): number => AY - (wy - cam);

/** Thruster nozzles in car-local units (x, y, dx, dy); y runs down, the nose points +x. */
export const NOZZLES: Record<Trim, number[][]> = {
  performance: [],
  thrust: [[-37, 1, -1, 0], [-37, 5, -1, 0]],
  rocket: [[-37, 1, -1, 0], [-37, 5, -1, 0], [-26, 9, 0, 1], [-9, 9, 0, 1], [9, 9, 0, 1], [26, 9, 0, 1], [-26, -5, 0, -1], [22, -7, 0, -1], [37, 2, 1, 0], [37, 6, 1, 0]],
};
export type Trim = 'performance' | 'thrust' | 'rocket';
export const TRIMS: Record<Trim, { label: string; tag: string; note: string }> = {
  performance: { label: 'Performance', tag: 'road ready', note: 'PERFORMANCE: NO THRUSTERS. CLIMBS ON HYPE.' },
  thrust: { label: 'Thrust', tag: 'race ready', note: 'THRUST: REAR COLD GAS. 0-60 IN 0.9 S. 60-0 UNSPECIFIED.' },
  rocket: { label: 'Rocket', tag: 'air ready', note: 'ROCKET: TEN THRUSTERS, ONE SEAT, ZERO ROAD APPROVAL.' },
};

export interface CarDrive {
  /** 0 to 1: how hard the jets fire. */
  thrust?: number;
  nozzles?: number[][];
  ghost?: boolean;
  colour?: string;
  edge?: string;
  shadow?: boolean;
  wheelRot?: number;
  blink?: boolean;
  helmet?: boolean;
  /** 0 to 1 flicker for the jet lengths. */
  flicker?: number;
}

export function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string | CanvasGradient): void {
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

export function mono(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'left', weight = 500, maxWidth?: number): void {
  ctx.font = `${weight} ${size}px ui-monospace, Menlo, Consolas, "Liberation Mono", monospace`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

/** The Roadster, nose at +x, wheels touching y = 14 in local units. */
export function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, alpha: number, o: CarDrive = {}): void {
  const body = o.colour ?? '#f2f1ec', edge = o.edge ?? '#b9b7ae', thrust = o.thrust ?? 0, noz = o.nozzles ?? [], flicker = o.flicker ?? 0.5;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = alpha;
  if (o.shadow) { ctx.save(); ctx.globalAlpha = alpha * 0.28; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, 15, 40, 4, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  if (thrust > 0 && noz.length) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    noz.forEach((z, i) => {
      const L = (14 + 12 * noise(flicker * 97 + i * 13)) * thrust, ex = z[0] + z[2] * L, ey = z[1] + z[3] * L;
      const g = ctx.createLinearGradient(z[0], z[1], ex, ey);
      g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.35, 'rgba(191,232,255,.55)'); g.addColorStop(1, 'rgba(191,232,255,0)');
      const px = -z[3] * 4, py = z[2] * 4;
      ctx.beginPath(); ctx.moveTo(z[0] + px, z[1] + py); ctx.lineTo(ex, ey); ctx.lineTo(z[0] - px, z[1] - py); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      disc(ctx, z[0], z[1], 2.2, 'rgba(255,255,255,.9)');
    });
    ctx.restore();
  }
  if (o.ghost) ctx.setLineDash([4, 3]);
  const g = ctx.createLinearGradient(0, -12, 0, 8);
  g.addColorStop(0, o.colour ? body : '#ffffff'); g.addColorStop(0.55, body); g.addColorStop(1, o.colour ? body : '#cfcdc4');
  ctx.beginPath(); ctx.moveTo(-36, 8); ctx.lineTo(-34, -3); ctx.lineTo(-16, -12); ctx.lineTo(6, -12); ctx.lineTo(18, -8); ctx.lineTo(36, 0); ctx.lineTo(36, 8); ctx.closePath();
  ctx.fillStyle = o.ghost ? 'rgba(154,163,181,.25)' : g; ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke();
  ctx.setLineDash([]);
  if (!o.ghost) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-36, 5, 72, 3); }
  ctx.beginPath(); ctx.moveTo(-14, -11); ctx.lineTo(4, -11); ctx.lineTo(15, -6); ctx.lineTo(-19, -6); ctx.closePath();
  ctx.fillStyle = o.ghost ? 'rgba(214,170,70,.3)' : 'rgba(214,170,70,.92)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(-12, -10); ctx.lineTo(2, -10); ctx.stroke();
  ctx.fillStyle = '#2a2f3a';
  for (const dx of [-14, -4, 6]) ctx.fillRect(dx, 6, 6, 1.5);
  ctx.strokeStyle = `rgba(232,244,255,${0.35 + thrust * 0.6})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(26, -4); ctx.lineTo(34, -1); ctx.stroke();
  if (!o.ghost) {
    ctx.save();
    if (thrust > 0 || o.blink) { ctx.shadowColor = '#ff3b1f'; ctx.shadowBlur = 8; }
    ctx.fillStyle = o.blink && Math.floor(flicker * 10) % 2 ? '#7a1d10' : '#ff3b1f';
    ctx.fillRect(-36.6, -2, 2.6, 9);
    ctx.restore();
  }
  ctx.fillStyle = '#2a2f3a';
  for (const z of noz) disc(ctx, z[0] - z[2] * 1.2, z[1] - z[3] * 1.2, 1.8, '#2a2f3a');
  for (const wx of [-20, 20]) {
    disc(ctx, wx, 8, 6, '#171a21'); ctx.strokeStyle = '#3c414d'; ctx.stroke();
    ctx.save(); ctx.translate(wx, 8); ctx.rotate(o.wheelRot ?? 0); ctx.strokeStyle = '#6b7384'; ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -4); ctx.stroke(); }
    ctx.restore();
    disc(ctx, wx, 8, 1.6, '#9aa3b5');
  }
  if (o.helmet) { ctx.fillStyle = '#f2f1ec'; ctx.fillRect(-9, -16, 8, 5); disc(ctx, -5, -19, 5, '#f2f1ec'); disc(ctx, -4, -19, 3, 'rgba(214,170,70,.9)'); }
  ctx.restore();
}

/* ---------- Sky ---------- */
const STARS = Array.from({ length: 220 }, (_, i) => ({ x: noise(i * 3.1) * W, y: noise(i * 7.7) * 5200 + 300, r: 0.5 + noise(i * 1.3) * 1.6, p: noise(i * 5.9) * TAU, layer: i % 2 ? 0.35 : 0.6, tint: noise(i * 2.2) < 0.15 ? '#bfe8ff' : noise(i * 2.2) < 0.3 ? '#ffd9b0' : '#f2f1ec' }));
const CLOUDS = Array.from({ length: 14 }, (_, i) => ({ x: 60 + noise(i * 2.3) * 900, y: 200 + noise(i * 4.1) * 850, w: 80 + noise(i * 4.7) * 130, h: 20 + noise(i * 6.3) * 22, k: 0.6 + noise(i * 8.9) * 0.5 }));
const SKY: [number, number[], number[]][] = [[0, [79, 158, 227], [207, 231, 248]], [1.2, [23, 48, 94], [61, 110, 163]], [2.0, [7, 11, 22], [12, 21, 50]], [2.7, [3, 5, 10], [5, 7, 13]]];
function skyAt(lm: number): [string, string] {
  let i = 0;
  while (i < SKY.length - 2 && SKY[i + 1][0] <= lm) i++;
  const a = SKY[i], b = SKY[i + 1], t = clamp((lm - a[0]) / (b[0] - a[0]), 0, 1);
  const rgb = (p: number[], q: number[]) => `rgb(${p.map((v, k) => Math.round(mix(v, q[k], t))).join(',')})`;
  return [rgb(a[1], b[1]), rgb(a[2], b[2])];
}

export function drawSky(ctx: CanvasRenderingContext2D, m: number, cam: number, time: number): void {
  const lm = Math.log(Math.max(1, m));
  const [top, bot] = skyAt(lm);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const dayA = clamp(1 - lm / 1.6, 0, 1);
  if (dayA > 0) {
    const x = 615, y = 80, sg = ctx.createRadialGradient(x, y, 0, x, y, 130);
    sg.addColorStop(0, `rgba(255,250,225,${0.95 * dayA})`); sg.addColorStop(0.25, `rgba(255,240,200,${0.5 * dayA})`); sg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = sg; ctx.fillRect(x - 140, y - 140, 280, 280);
  }
  const starA = clamp((lm - 1.3) / 1.0, 0, 1);
  if (starA > 0) {
    const mw = clamp((lm - 2.6) / 0.8, 0, 1) * 0.14;
    if (mw > 0) {
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.5);
      const mg = ctx.createLinearGradient(0, -120, 0, 120); mg.addColorStop(0, 'rgba(242,241,236,0)'); mg.addColorStop(0.5, `rgba(242,241,236,${mw})`); mg.addColorStop(1, 'rgba(242,241,236,0)');
      ctx.fillStyle = mg; ctx.fillRect(-W, -120, 2 * W, 240); ctx.restore();
    }
    for (const s of STARS) {
      const y = AY - (s.y - cam * s.layer), yy = ((y % (H + 40)) + (H + 40)) % (H + 40) - 20;
      ctx.globalAlpha = starA * (0.45 + 0.55 * Math.abs(Math.sin(time * 1.7 + s.p)));
      ctx.fillStyle = s.tint; ctx.fillRect(s.x, yy, s.r, s.r);
    }
    ctx.globalAlpha = 1;
    const sunA = clamp((lm - 1.8) / 0.8, 0, 1);
    if (sunA > 0) {
      ctx.save(); ctx.globalAlpha = sunA; ctx.globalCompositeOperation = 'lighter';
      disc(ctx, 615, 80, 5, '#fff8e6');
      ctx.strokeStyle = 'rgba(255,248,230,.5)'; ctx.lineWidth = 1;
      for (const an of [0, Math.PI / 2]) { ctx.beginPath(); ctx.moveTo(615 + Math.cos(an) * 28, 80 + Math.sin(an) * 28); ctx.lineTo(615 - Math.cos(an) * 28, 80 - Math.sin(an) * 28); ctx.stroke(); }
      ctx.restore();
    }
    // A shooting star every 9 s or so in deep space, as a pure function of time.
    if (lm > 2.4) {
      const cycle = Math.floor(time / 9), run = (time % 9) / 9;
      if (run < 0.08) {
        const x0 = noise(cycle * 1.7) * W, y0 = noise(cycle * 3.3) * H * 0.5, u = run / 0.08;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const x = x0 + u * 420, y = y0 + u * 160, g2 = ctx.createLinearGradient(x, y, x - 60, y - 23);
        g2.addColorStop(0, `rgba(255,255,255,${1 - u})`); g2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 60, y - 23); ctx.stroke(); ctx.restore();
      }
    }
  }
  const cloudA = clamp(1 - (lm - 1.2) / 0.7, 0, 1);
  if (cloudA > 0) {
    for (const c of CLOUDS) {
      const x = screenX(c.x) + Math.sin(time * 0.1 + c.y) * 12, y = AY - (c.y - cam * 0.85);
      if (y < -80 || y > H + 80) continue;
      ctx.fillStyle = `rgba(255,255,255,${0.17 * cloudA * c.k})`;
      for (const p of [[0, 0, 0.62], [-0.32, 0.12, 0.45], [0.3, 0.1, 0.5], [-0.12, -0.2, 0.4], [0.14, -0.22, 0.36], [-0.5, 0.2, 0.3], [0.5, 0.18, 0.32]]) {
        ctx.beginPath(); ctx.ellipse(x + p[0] * c.w, y + p[1] * c.h, c.w * 0.5 * p[2], c.h * 1.15 * p[2], 0, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = `rgba(120,150,190,${0.12 * cloudA})`; ctx.beginPath(); ctx.ellipse(x, y + c.h * 0.55, c.w * 0.42, c.h * 0.25, 0, 0, TAU); ctx.fill();
    }
  }
}

/* ---------- Earth: curvature from 4×, a marble by the Moon, gone past Mars ---------- */
const CONTINENTS: number[][] = [[-0.35, -0.78, 0.25, 0.12, 0.3], [0.3, -0.86, 0.3, 0.09, -0.2], [0.05, -0.45, 0.22, 0.18, 0.9], [-0.55, -0.1, 0.2, 0.3, 0.2], [0.5, 0.2, 0.3, 0.2, -0.5], [-0.1, 0.55, 0.35, 0.15, 0.1]];
export function drawEarth(ctx: CanvasRenderingContext2D, m: number, time: number): void {
  if (m < 4.2 || m > 140) return;
  let R: number, top: number, alpha = 1;
  if (m < 10) { const t = (m - 4.2) / 5.8; R = mix(5200, 760, t * t); top = mix(H + 40, H - 110, Math.sqrt(t)); }
  else if (m <= 50) { const t = (Math.log(m) - Math.log(10)) / (Math.log(50) - Math.log(10)); R = mix(760, 34, t); top = H - 110; }
  else { const t = (Math.log(m) - Math.log(50)) / (Math.log(140) - Math.log(50)); R = mix(34, 5, t); top = H - 110 + t * 150; alpha = 1 - t * t; }
  const cx = W / 2, cy = top + R, rot = time * 0.03;
  ctx.save(); ctx.globalAlpha = alpha;
  const ag = ctx.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.08 + 12); ag.addColorStop(0, 'rgba(120,190,255,.55)'); ag.addColorStop(1, 'rgba(120,190,255,0)');
  disc(ctx, cx, cy, R * 1.08 + 12, ag);
  const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R); g.addColorStop(0, '#5aa0ea'); g.addColorStop(0.7, '#2b5fb8'); g.addColorStop(1, '#122a63');
  disc(ctx, cx, cy, R, g);
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
  ctx.fillStyle = 'rgba(86,146,78,.9)';
  for (const c of CONTINENTS) { const an = Math.atan2(c[1], c[0]) + rot, d = Math.hypot(c[0], c[1]); ctx.beginPath(); ctx.ellipse(cx + Math.cos(an) * d * R, cy + Math.sin(an) * d * R, c[2] * R, c[3] * R, c[4] + rot, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i < 7; i++) { const an = i * 0.9 + rot * 1.4, d = 0.3 + (i % 3) * 0.22; ctx.beginPath(); ctx.ellipse(cx + Math.cos(an) * d * R, cy + Math.sin(an) * d * R, R * 0.28, R * 0.07, an, 0, TAU); ctx.fill(); }
  const tg = ctx.createLinearGradient(cx - R * 0.2, cy, cx + R, cy); tg.addColorStop(0, 'rgba(0,0,0,0)'); tg.addColorStop(1, 'rgba(0,0,10,.75)');
  ctx.fillStyle = tg; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  ctx.restore();
  ctx.strokeStyle = 'rgba(190,230,255,.5)'; ctx.lineWidth = Math.max(1, R * 0.012); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  ctx.restore();
}

/* ---------- The pad: McGregor, Texas ---------- */
function box(ctx: CanvasRenderingContext2D, wx: number, gy: number, w: number, h: number, colour: string, text: string, win?: number[]): void {
  const x = screenX(wx);
  ctx.fillStyle = colour; ctx.fillRect(x, gy - h, w, h);
  if (win) { ctx.fillStyle = 'rgba(40,50,70,.8)'; ctx.fillRect(x + win[0], gy - (h - 3), win[1], h * 0.35); }
  for (const f of [0.22, 0.78]) disc(ctx, x + w * f, gy, 4, '#171a21');
  mono(ctx, text, x + w / 2, gy - h - 5, 9, 'rgba(242,241,236,.7)', 'center');
}

export function drawGround(ctx: CanvasRenderingContext2D, cam: number, time: number, scrubbed: boolean): void {
  const gy = screenY(0, cam);
  if (gy > H + 80) return;
  const hz = ctx.createLinearGradient(0, gy - 120, 0, gy); hz.addColorStop(0, 'rgba(255,240,210,0)'); hz.addColorStop(1, 'rgba(255,235,200,.35)');
  ctx.fillStyle = hz; ctx.fillRect(0, gy - 120, W, 120);
  ctx.fillStyle = 'rgba(70,80,95,.55)';
  for (const s of [[150, 70, 10], [172, 48, 8], [790, 60, 12], [230, 12, 40], [870, 10, 30]]) ctx.fillRect(screenX(s[0]), gy - s[1], s[2], s[1]);
  disc(ctx, screenX(905), gy - 44, 12, 'rgba(70,80,95,.55)'); ctx.fillStyle = 'rgba(70,80,95,.55)'; ctx.fillRect(screenX(903), gy - 44, 4, 44);
  ctx.fillStyle = 'rgba(60,70,50,.6)';
  for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.ellipse(screenX(100 + i * 52 + (i % 3) * 9), gy - 3, 9, 4, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#6b5a3c'; ctx.fillRect(0, gy, W, H - gy + 10);
  const pg = ctx.createLinearGradient(0, gy, 0, gy + 16); pg.addColorStop(0, '#4d5057'); pg.addColorStop(1, '#3a3c42'); ctx.fillStyle = pg; ctx.fillRect(0, gy, W, 16);
  ctx.strokeStyle = 'rgba(243,201,105,.6)'; ctx.lineWidth = 1; ctx.setLineDash([12, 10]); ctx.beginPath(); ctx.moveTo(0, gy + 8); ctx.lineTo(W, gy + 8); ctx.stroke(); ctx.setLineDash([]);
  // The quarter-pipe, lit, with a coping and the launch beacon.
  const cx = screenX(330), cy = screenY(110, cam), r = 110;
  ctx.beginPath(); ctx.moveTo(screenX(330), gy); ctx.arc(cx, cy, r, Math.PI / 2, 0, true); ctx.lineTo(screenX(440), gy); ctx.closePath();
  const rg = ctx.createLinearGradient(cx, cy - r, cx, gy); rg.addColorStop(0, '#454a56'); rg.addColorStop(1, '#23262d'); ctx.fillStyle = rg; ctx.fill();
  ctx.strokeStyle = '#aab3c5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI / 2, 0, true); ctx.stroke(); ctx.lineWidth = 1;
  disc(ctx, screenX(440), cy, 3, '#8b96ad');
  mono(ctx, 'RAMP · INVERTED, BRIEFLY', screenX(385), gy + 30, 9, 'rgba(242,241,236,.6)', 'center');
  ctx.strokeStyle = '#8b96ad'; ctx.beginPath(); ctx.moveTo(screenX(468), gy); ctx.lineTo(screenX(468), gy - 46); ctx.stroke();
  const beacon = 0.5 + 0.5 * Math.sin(time * 6);
  ctx.save(); ctx.shadowColor = '#e2552a'; ctx.shadowBlur = 10 * beacon; disc(ctx, screenX(468), gy - 48, 3, `rgba(226,85,42,${0.5 + 0.5 * beacon})`); ctx.restore();
  // The crowd, 300 yards back for their ears, filming.
  for (let i = 0; i < 16; i++) {
    const jx = Math.sin(time * 3 + i) * 1.2, x = screenX(110 + (i % 8) * 6 + jx), y = gy - (4 + Math.floor(i / 8) * 6);
    disc(ctx, x, y, 2, i % 3 ? '#c9c7bf' : '#e2552a');
    if (i % 5 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x, y - 4, 1.5, 1.5); }
  }
  mono(ctx, 'CROWD · 300 YD', screenX(132), gy + 30, 9, 'rgba(242,241,236,.6)', 'center');
  const lx = screenX(224);
  ctx.beginPath(); ctx.moveTo(lx, gy); ctx.lineTo(lx + 2, gy - 9); ctx.lineTo(lx + 30, gy - 12); ctx.lineTo(lx + 46, gy - 3); ctx.lineTo(lx + 46, gy); ctx.closePath(); ctx.fillStyle = '#f2f1ec'; ctx.fill();
  ctx.fillStyle = 'rgba(40,50,70,.8)'; ctx.fillRect(lx + 12, gy - 10, 14, 4);
  mono(ctx, 'BOND LOTUS · HIS', lx + 23, gy + 30, 9, 'rgba(242,241,236,.6)', 'center');
  box(ctx, 500, gy, 44, 14, '#9aa3b5', 'MODEL 3', [12, 20]); box(ctx, 556, gy, 46, 17, '#c9c7bf', 'MODEL Y', [12, 22]);
  const tx = screenX(614);
  ctx.beginPath(); ctx.moveTo(tx, gy); ctx.lineTo(tx + 4, gy - 12); ctx.lineTo(tx + 30, gy - 22); ctx.lineTo(tx + 56, gy - 10); ctx.lineTo(tx + 56, gy); ctx.closePath(); ctx.fillStyle = '#aab1bd'; ctx.fill();
  ctx.fillRect(tx + 60, gy - 3, 14, 3);
  mono(ctx, 'CT · +1 PANEL', tx + 28, gy - 27, 9, 'rgba(242,241,236,.7)', 'center');
  box(ctx, 684, gy, 90, 34, '#d7d2c6', 'SEMI · 2017', [4, 18]); box(ctx, 792, gy, 42, 15, '#f3c969', 'CYBERCAB', [10, 22]);
  if (scrubbed) {
    ctx.fillStyle = 'rgba(20,24,34,.55)'; ctx.fillRect(0, 0, W, H * 0.3);
    ctx.strokeStyle = 'rgba(191,232,255,.5)'; ctx.lineWidth = 1;
    for (let i = 0; i < 80; i++) {
      const x = (i * 97 + time * 200) % (W + 40) - 20, y = (i * 53 + time * 500) % (H + 40) - 20;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 16); ctx.stroke();
    }
    // Lightning about every 2.5 s, from the clock, so a replay flashes on the same beats.
    const flash = (time % 2.5) < 0.12 && noise(Math.floor(time / 2.5)) > 0.4;
    if (flash) { ctx.fillStyle = 'rgba(220,235,255,.45)'; ctx.fillRect(0, 0, W, H); }
  }
}

/* ---------- The cameos on the ladder ---------- */
function sphere(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hi: string, mid: string, lo: string): void {
  const g = ctx.createRadialGradient(x - r * 0.42, y - r * 0.42, r * 0.05, x, y, r); g.addColorStop(0, hi); g.addColorStop(0.6, mid); g.addColorStop(1, lo);
  disc(ctx, x, y, r, g);
}
function rimShade(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, k: number): void {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.55, x, y, r * 1.02); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,8,${k})`);
  disc(ctx, x, y, r, g);
}
const ROCKS = Array.from({ length: 9 }, (_, i) => ({ dx: -340 + noise(i * 1.1) * 680, dy: -140 + noise(i * 2.7) * 280, r: 7 + noise(i * 3.9) * 15, rot: noise(i * 5.1) * TAU, spin: (noise(i * 7.3) - 0.5) * 0.4, v: Array.from({ length: 6 + Math.floor(noise(i * 9.7) * 4) }, (_, j) => 0.65 + noise(i * 17 + j) * 0.45) }));
const label = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill = 'rgba(242,241,236,.7)', size = 9): void => mono(ctx, text, x, y, size, fill, 'center');

/** The flag on Mars grows and unfurls as the multiplier passes 100×, so a replay plants it the same way. */
export function drawFlag(ctx: CanvasRenderingContext2D, x: number, fy: number, m: number, time: number): void {
  const grow = smoothstep(100, 103, m), open = smoothstep(102, 106, m);
  if (grow <= 0) return;
  const px = x + 44, ph = 46 * grow;
  ctx.strokeStyle = '#f2f1ec'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, fy); ctx.lineTo(px, fy - ph); ctx.stroke();
  if (open > 0) {
    const fw = 78 * open, fh = 18;
    ctx.fillStyle = '#f3c969'; ctx.beginPath(); ctx.moveTo(px, fy - ph);
    for (let i = 0; i <= 8; i++) { const u = i / 8; ctx.lineTo(px + fw * u, fy - ph + Math.sin(time * 7 + u * 5) * 2 * u); }
    for (let i = 8; i >= 0; i--) { const u = i / 8; ctx.lineTo(px + fw * u, fy - ph + fh + Math.sin(time * 7 + u * 5) * 2 * u); }
    ctx.closePath(); ctx.fill();
    if (open > 0.9) mono(ctx, '2028, actually', px + fw / 2, fy - ph + 12, 8, INK, 'center');
  }
  const dust = smoothstep(100, 101, m) * (1 - smoothstep(101, 104, m));
  if (dust > 0) { ctx.fillStyle = `rgba(220,140,90,${0.6 * dust})`; ctx.beginPath(); ctx.ellipse(px, fy + 2, 10 + 60 * (1 - dust), 3 + 10 * (1 - dust), 0, 0, TAU); ctx.fill(); }
}

export function drawCameos(ctx: CanvasRenderingContext2D, cam: number, m: number, time: number): void {
  const t = time;
  const at = (mult: number, pad = 300): number | null => { const y = screenY(worldY(mult), cam); return y > -pad && y < H + pad ? y : null; };
  let y: number | null, x: number;
  if ((y = at(2.5)) !== null) {
    x = screenX(300 + Math.sin(t / 2) * 15);
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 4; i++) disc(ctx, -30 - i * 9 - Math.sin(t * 5 + i) * 2, Math.sin(t * 3 + i) * 3, 4 + i * 1.5, 'rgba(255,255,255,.35)');
    ctx.fillStyle = '#f2f1ec'; ctx.fillRect(-18, -6, 36, 12); ctx.fillStyle = '#e2552a'; ctx.fillRect(-18, -6, 12, 12); ctx.fillStyle = '#3b6fd8'; ctx.fillRect(6, -6, 12, 12);
    ctx.fillStyle = '#f2f1ec'; ctx.beginPath();
    for (let i = 0; i < 5; i++) { const an = -Math.PI / 2 + i * TAU / 5; ctx.lineTo(12 + Math.cos(an) * 3, Math.sin(an) * 3); ctx.lineTo(12 + Math.cos(an + TAU / 10) * 1.3, Math.sin(an + TAU / 10) * 1.3); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9c7bf';
    ctx.beginPath(); ctx.moveTo(18, -6); ctx.lineTo(30, 0); ctx.lineTo(18, 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-18, -6); ctx.lineTo(-26, -14); ctx.lineTo(-14, -6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-18, 6); ctx.lineTo(-26, 14); ctx.lineTo(-14, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    label(ctx, 'SKYCYCLE X-2 · STEAM WAS THE MISTAKE', x, y + 26);
  }
  if ((y = at(3.5)) !== null) {
    x = screenX(640);
    ctx.fillStyle = 'rgba(10,13,20,.8)'; ctx.fillRect(x - 80, y - 22, 160, 44); ctx.strokeStyle = '#e2552a'; ctx.lineWidth = 2; ctx.strokeRect(x - 80, y - 22, 160, 44); ctx.lineWidth = 1;
    disc(ctx, x + 72, y - 14, 3, Math.floor(t * 2) % 2 ? '#e2552a' : '#5a2212');
    label(ctx, 'FAA TFR · 5,000 FT CEILING', x, y - 4, '#e2552a', 10); label(ctx, 'PURPOSE: "HAZARDS"', x, y + 12, 'rgba(242,241,236,.85)', 10);
  }
  if ((y = at(5)) !== null) {
    x = ((t * 70) % (W + 400)) - 200;
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-44, 2); ctx.lineTo(-240, 4); ctx.stroke();
    const fg = ctx.createLinearGradient(0, -5, 0, 5); fg.addColorStop(0, '#f4f2ea'); fg.addColorStop(1, '#b9bcc4'); ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(-42, -4); ctx.lineTo(40, -4); ctx.quadraticCurveTo(54, -2, 54, 1); ctx.lineTo(40, 5); ctx.lineTo(-42, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3b4a66'; for (let i = -34; i < 36; i += 6) ctx.fillRect(i, -2.5, 3, 2); ctx.fillRect(42, -3, 7, 2.5);
    ctx.fillStyle = '#d7d2c6'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-28, 17); ctx.lineTo(-14, 17); ctx.lineTo(10, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8b96ad'; ctx.fillRect(-18, 8, 10, 5);
    ctx.fillStyle = '#d7d2c6'; ctx.beginPath(); ctx.moveTo(-42, -4); ctx.lineTo(-52, -18); ctx.lineTo(-40, -18); ctx.lineTo(-32, -4); ctx.closePath(); ctx.fill();
    ctx.restore();
    label(ctx, '737 · FILING A COMPLAINT', x, y + 32);
  }
  if ((y = at(7)) !== null) {
    x = screenX(260) + Math.sin(t * 0.7) * 6;
    const bg = ctx.createRadialGradient(x - 8, y - 40, 2, x, y - 30, 26); bg.addColorStop(0, 'rgba(255,255,255,.95)'); bg.addColorStop(1, 'rgba(200,215,230,.55)');
    disc(ctx, x, y - 30, 24, bg);
    ctx.strokeStyle = '#c9c7bf'; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 14); ctx.stroke();
    ctx.fillStyle = '#9aa3b5'; ctx.fillRect(x - 7, y + 14, 14, 11); ctx.fillStyle = '#2a2f3a'; ctx.fillRect(x - 2, y + 17, 4, 5);
    label(ctx, 'FELIX · "nice"', x, y + 40);
  }
  if ((y = at(10, 60)) !== null) {
    ctx.strokeStyle = 'rgba(191,232,255,.6)'; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]);
    label(ctx, 'KÁRMÁN LINE · 100 KM · TECHNICALLY SPACE · TECHNICALLY A CAR', W / 2, y - 6, 'rgba(191,232,255,.85)', 10);
  }
  if ((y = at(15)) !== null) {
    x = screenX(620);
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#8b96ad'; ctx.fillRect(-96, -1.5, 192, 3);
    for (const dx of [-92, -64, 34, 62]) { const pg = ctx.createLinearGradient(dx, -14, dx + 26, 14); pg.addColorStop(0, '#5c7fd1'); pg.addColorStop(1, '#2a3f78'); ctx.fillStyle = pg; ctx.fillRect(dx, -14, 26, 28); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(dx + 13, -14); ctx.lineTo(dx + 13, 14); ctx.stroke(); }
    ctx.fillStyle = '#e9ecef'; ctx.fillRect(-30, -22, 8, 44); ctx.fillRect(22, -22, 8, 44);
    for (const mod of [[-20, 8], [-8, 7], [4, 8], [16, 7]]) { const mg = ctx.createLinearGradient(0, -mod[1], 0, mod[1]); mg.addColorStop(0, '#f2f1ec'); mg.addColorStop(1, '#9aa3b5'); ctx.fillStyle = mg; ctx.fillRect(mod[0], -mod[1], 12, mod[1] * 2); }
    ctx.restore();
    label(ctx, 'ISS · "PLEASE STOP"', x, y + 32);
  }
  if ((y = at(25)) !== null) {
    for (let i = 0; i < 9; i++) { const sx = screenX(200 + i * 40 + (t * 20 % 40)), sy = y - 30 + i * 7; ctx.fillStyle = '#3b5fb8'; ctx.fillRect(sx - 5, sy - 1, 10, 2); disc(ctx, sx, sy, 2.2, '#f2f1ec'); }
    label(ctx, 'STARLINK TRAIN · SORRY, ASTRONOMERS', screenX(380), y + 46);
  }
  if ((y = at(50, 420)) !== null) {
    x = screenX(720);
    sphere(ctx, x, y, 95, '#e4e1d8', '#b8b5ad', '#5c5a54');
    for (const c of [[-30, -20, 14], [20, 10, 10], [-10, 40, 8], [45, -40, 7], [-55, 25, 6], [10, -55, 5]]) { disc(ctx, x + c[0], y + c[1], c[2], 'rgba(90,88,82,.55)'); disc(ctx, x + c[0] - c[2] * 0.25, y + c[1] - c[2] * 0.25, c[2] * 0.7, 'rgba(150,147,140,.5)'); }
    rimShade(ctx, x, y, 95, 0.7);
    label(ctx, 'THE MOON · "BY 2024"', x, y + 112, 'rgba(242,241,236,.8)', 10);
  }
  if ((y = at(75)) !== null) {
    x = screenX(340 + Math.sin(t / 3) * 20);
    drawCar(ctx, x, y, -0.4 + Math.sin(t / 2) * 0.1, 1, { colour: '#c8102e', edge: '#7a0a1c', helmet: true });
    label(ctx, 'STARMAN · 2018-017A · "DON\'T PANIC"', x, y + 30, 'rgba(242,241,236,.8)'); label(ctx, 'also has not received his car', x, y + 42, 'rgba(242,241,236,.55)');
  }
  const marsY = screenY(worldY(100) + 110, cam);
  if (marsY > -500 && marsY < H + 500) {
    x = screenX(CAR_X);
    const hg = ctx.createRadialGradient(x, marsY, 110, x, marsY, 123); hg.addColorStop(0, 'rgba(226,120,60,.35)'); hg.addColorStop(1, 'rgba(226,120,60,0)');
    disc(ctx, x, marsY, 123, hg);
    sphere(ctx, x, marsY, 110, '#e8744a', '#c1440e', '#5a1e07');
    ctx.save(); ctx.beginPath(); ctx.arc(x, marsY, 110, 0, TAU); ctx.clip();
    for (const c of [[-40, -30, 26, '#a33a0c'], [30, 20, 34, '#b03d0b'], [-10, 60, 18, '#8f330a'], [50, -60, 16, '#d35a1f'], [-70, 10, 14, '#9b3609']] as const) disc(ctx, x + c[0], marsY + c[1], c[2], c[3]);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(x, marsY - 102, 35, 11, 0, 0, TAU); ctx.fill();
    ctx.restore(); rimShade(ctx, x, marsY, 110, 0.65);
    label(ctx, 'MARS · POPULATION: 1 CAR', x, marsY + 130, '#f3c969', 11);
    drawFlag(ctx, x, screenY(worldY(100), cam), m, t);
  }
  if ((y = at(200)) !== null) {
    ROCKS.forEach((r, i) => {
      const rx = screenX(CAR_X + r.dx + Math.sin(t / 4 + i) * 8), ry = (y as number) + r.dy;
      ctx.save(); ctx.translate(rx, ry); ctx.rotate(r.rot + t * r.spin); ctx.beginPath();
      r.v.forEach((v, j) => { const an = j / r.v.length * TAU; ctx.lineTo(Math.cos(an) * r.r * v, Math.sin(an) * r.r * v); });
      ctx.closePath();
      const g = ctx.createRadialGradient(-r.r * 0.3, -r.r * 0.3, 1, 0, 0, r.r); g.addColorStop(0, '#9c927f'); g.addColorStop(1, '#4e4840'); ctx.fillStyle = g; ctx.fill(); ctx.restore();
      if (i === 4) label(ctx, '2018 CN41 · DELETED AFTER 17 H', rx, ry + r.r + 12);
    });
  }
  if ((y = at(500, 400)) !== null) {
    x = screenX(180);
    sphere(ctx, x, y, 140, '#e6cfa6', '#c9a070', '#6d4f33');
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, 140, 0, TAU); ctx.clip();
    for (let i = -5; i <= 5; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(140,96,60,.45)' : 'rgba(255,240,215,.25)';
      const y0 = y + i * 24; ctx.beginPath(); ctx.moveTo(x - 140, y0);
      for (let k = -140; k <= 140; k += 12) ctx.lineTo(x + k, y0 + Math.sin(k / 30 + i) * 4);
      ctx.lineTo(x + 140, y0 + 10);
      for (let k = 140; k >= -140; k -= 12) ctx.lineTo(x + k, y0 + 10 + Math.sin(k / 30 + i + 1) * 4);
      ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.ellipse(x + 60, y + 44, 22, 13, -0.2, 0, TAU); ctx.fillStyle = '#c75b3a'; ctx.fill(); ctx.restore();
    rimShade(ctx, x, y, 140, 0.7);
    label(ctx, 'JUPITER · WHY', x, y + 158, 'rgba(242,241,236,.8)', 10);
  }
  if ((y = at(1000, 400)) !== null) {
    x = screenX(650);
    const yy = y;
    const ring = (front: boolean | null): void => {
      ctx.save();
      if (front !== null) { ctx.beginPath(); ctx.rect(x - 200, front ? yy : yy - 200, 400, 200); ctx.clip(); }
      for (const rr of [[130, 30, 'rgba(217,197,143,.75)', 7], [112, 26, 'rgba(120,105,75,.55)', 3], [148, 34, 'rgba(217,197,143,.35)', 3]] as const) { ctx.strokeStyle = rr[2]; ctx.lineWidth = rr[3]; ctx.beginPath(); ctx.ellipse(x, yy, rr[0], rr[1], -0.25, 0, TAU); ctx.stroke(); }
      ctx.restore();
    };
    ring(false); sphere(ctx, x, yy, 70, '#f1e2b4', '#d9c58f', '#6e6040'); rimShade(ctx, x, yy, 70, 0.6); ring(true);
    label(ctx, 'SATURN · RUNNING ON HYPE', x, yy + 92, 'rgba(242,241,236,.8)', 10);
  }
  // Deep space keeps changing: a comet on a 14 s loop past 1,500×, and the outer planets as the camera reaches them.
  for (const [mult, px, r, hi, mid, lo, name] of [[3000, 260, 60, '#c9f0f5', '#7fcbd6', '#2f6e78', 'URANUS · THE JOKES WRITE THEMSELVES'], [10000, 700, 64, '#8db4ff', '#3b5fd8', '#172a72', 'NEPTUNE · NO REFUND DESK HERE EITHER'], [30000, 420, 22, '#e4d6c3', '#b89f85', '#5a4a3a', 'PLUTO · STILL A PLANET, PER ELON'], [100000, 780, 10, '#dcdcdc', '#9a9a9a', '#444', 'VOYAGER 1 · "YOU ARE NOT SUPPOSED TO BE HERE"']] as const) {
    if ((y = at(mult, 400)) === null) continue;
    x = screenX(px); sphere(ctx, x, y, r, hi, mid, lo); rimShade(ctx, x, y, r, 0.6);
    label(ctx, name, x, y + r + 20, 'rgba(242,241,236,.8)', 10);
  }
  if (m > 1500) {
    const run = (t % 14) / 14, cx2 = -120 + run * (W + 240), cy2 = 120 + Math.sin(run * Math.PI) * 60;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(cx2, cy2, cx2 - 180, cy2 + 40); g.addColorStop(0, 'rgba(200,240,255,.9)'); g.addColorStop(1, 'rgba(200,240,255,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(cx2 - 180, cy2 + 40); ctx.stroke();
    disc(ctx, cx2, cy2, 5, '#ffffff'); ctx.restore();
  }
}

/* ---------- The parachute ---------- */
export function drawChute(ctx: CanvasRenderingContext2D, x: number, y: number, open: number): void {
  const k = clamp(open, 0, 1);
  if (k <= 0.02) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  for (let i = 0; i < 6; i++) { const a0 = Math.PI + i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(0, -46); ctx.arc(0, -46, 36, a0, a0 + Math.PI / 6); ctx.closePath(); ctx.fillStyle = i % 2 ? '#f3c969' : '#f2f1ec'; ctx.fill(); }
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -46, 36, Math.PI, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(242,241,236,.8)';
  for (const dx of [-34, -14, 14, 34]) { ctx.beginPath(); ctx.moveTo(dx, -46); ctx.lineTo(0, -10); ctx.stroke(); }
  ctx.restore();
  if (k > 0.8) mono(ctx, 'REFUNDABLE', x, y - 52 * k, 8, INK, 'center');
}

/* ---------- Particles: world coordinates, y up ---------- */
export type PuffKind = 'gas' | 'ice' | 'hype' | 'fire' | 'smoke' | 'spark' | 'dust';
export interface Puff { kind: PuffKind; x: number; y: number; vx: number; vy: number; life: number; max: number; r: number }
export interface Debris { x: number; y: number; vx: number; vy: number; rot: number; vr: number; kind: 'car' | 'copv'; life: number; puff: number }

export function puff(list: Puff[], kind: PuffKind, x: number, y: number, vx: number, vy: number, life: number, r: number): void {
  list.push({ kind, x, y, vx, vy, life, max: life, r });
  if (list.length > 700) list.splice(0, list.length - 700);
}

/** Cold gas from each nozzle: a soft puff and, every third, an ice sparkle. `random` is the scene's ambient generator. */
export function emitJets(list: Puff[], x: number, y: number, angle: number, noz: number[][], count: number, random: () => number): void {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  for (let i = 0; i < count; i++) {
    const z = noz[i % noz.length];
    const lx = z[0] * cos - z[1] * sin, ly = z[0] * sin + z[1] * cos;
    const dx = z[2] * cos - z[3] * sin, dy = z[2] * sin + z[3] * cos;
    const sp = 240 + random() * 180;
    puff(list, 'gas', x + lx, y - ly, dx * sp + (random() - 0.5) * 70, -dy * sp + (random() - 0.5) * 70, 0.5 + random() * 0.2, 2.5 + random() * 2.5);
    if (i % 3 === 0) puff(list, 'ice', x + lx, y - ly, dx * sp * 1.4 + (random() - 0.5) * 120, -dy * sp * 1.4 + (random() - 0.5) * 120, 0.3, 1.2);
  }
}

/** The wreckage, seeded from the crash point so a replay scatters the same way. */
export function shred(list: Puff[], debris: Debris[], x: number, y: number, crashX100: number): void {
  const random = mulberry32(crashX100 * 7919 + 17);
  for (let i = 0; i < 36; i++) { const a = random() * TAU, sp = 260 + random() * 520; puff(list, 'spark', x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.5 + random() * 0.6, 1.5); }
  for (let i = 0; i < 30; i++) { const a = random() * TAU, sp = 60 + random() * 300; puff(list, 'fire', x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.5 + random() * 0.6, 5 + random() * 7); }
  for (let i = 0; i < 30; i++) { const a = random() * TAU, sp = 40 + random() * 220; puff(list, 'gas', x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.8 + random() * 0.8, 4 + random() * 7); }
  for (let i = 0; i < 26; i++) { const a = random() * TAU, sp = 20 + random() * 120; puff(list, 'smoke', x, y, Math.cos(a) * sp, Math.sin(a) * sp + 30, 1.6 + random() * 1.4, 8 + random() * 10); }
  for (let i = 0; i < 9; i++) {
    const a = random() * TAU, sp = 140 + random() * 300;
    debris.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 180, rot: random() * TAU, vr: (random() - 0.5) * 14, kind: i < 3 ? 'car' : 'copv', life: 4, puff: 0 });
  }
}

export function stepParticles(list: Puff[], debris: Debris[], dt: number): void {
  if (dt <= 0) return;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.kind === 'spark' || p.kind === 'dust') { p.vy -= 700 * dt; p.vx *= 0.985; }
    else if (p.kind === 'smoke') { p.vx *= 0.97; p.vy = p.vy * 0.97 + 25 * dt; }
    else { p.vx *= 0.96; p.vy *= 0.96; }
    if (p.life <= 0) list.splice(i, 1);
  }
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i]; d.x += d.vx * dt; d.y += d.vy * dt; d.vy -= 560 * dt; d.rot += d.vr * dt; d.life -= dt; d.puff += dt;
    // Pieces that reach the pavement bounce once and skid to a stop.
    if (d.y < 6) { d.y = 6; if (d.vy < -90) d.vy *= -0.35; else d.vy = 0; d.vx *= Math.exp(-4 * dt); d.vr *= Math.exp(-4 * dt); }
    if (d.puff > 0.07 && d.life > 2.2) { d.puff = 0; puff(list, 'smoke', d.x, d.y, (noise(d.life * 13) - 0.5) * 20, 20, 0.9, 3 + noise(d.life * 7) * 3); }
    if (d.life <= 0) debris.splice(i, 1);
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D, list: Puff[], debris: Debris[], cam: number, layer: 'back' | 'front'): void {
  if (layer === 'back') {
    for (const p of list) {
      if (p.kind !== 'smoke' && p.kind !== 'gas' && p.kind !== 'dust') continue;
      const t = p.life / p.max, x = screenX(p.x), y = screenY(p.y, cam);
      if (p.kind === 'smoke') disc(ctx, x, y, p.r * (1 + (1 - t) * 2.2), `rgba(120,125,135,${t * 0.45})`);
      else if (p.kind === 'dust') disc(ctx, x, y, p.r * (1 + (1 - t) * 1.5), `rgba(170,150,110,${t * 0.5})`);
      else disc(ctx, x, y, p.r * (1 + (1 - t) * 2.6), `rgba(233,246,255,${t * 0.7})`);
    }
    for (const d of debris) {
      ctx.save(); ctx.translate(screenX(d.x), screenY(d.y, cam)); ctx.rotate(d.rot);
      if (d.kind === 'car') { ctx.beginPath(); ctx.moveTo(-13, 7); ctx.lineTo(10, -9); ctx.lineTo(13, 7); ctx.closePath(); ctx.fillStyle = '#f2f1ec'; ctx.fill(); ctx.strokeStyle = '#b9b7ae'; ctx.stroke(); ctx.fillStyle = 'rgba(214,170,70,.9)'; ctx.fillRect(-2, -2, 8, 3); }
      else { ctx.fillStyle = '#d7d2c6'; ctx.beginPath(); ctx.roundRect(-8, -3.5, 16, 7, 3); ctx.fill(); ctx.fillStyle = '#e2552a'; ctx.fillRect(-6, -3.5, 2.5, 7); ctx.fillRect(3.5, -3.5, 2.5, 7); }
      ctx.restore();
    }
    return;
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of list) {
    const t = p.life / p.max, x = screenX(p.x), y = screenY(p.y, cam);
    if (p.kind === 'fire') { const r = p.r * (0.5 + t), g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,230,160,${t})`); g.addColorStop(0.5, `rgba(255,120,40,${t * 0.8})`); g.addColorStop(1, 'rgba(200,40,10,0)'); disc(ctx, x, y, r, g); }
    else if (p.kind === 'spark') { ctx.strokeStyle = `rgba(255,220,150,${t})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 0.03, y + p.vy * 0.03); ctx.stroke(); }
    else if (p.kind === 'ice') { ctx.fillStyle = `rgba(255,255,255,${t})`; ctx.fillRect(x - 1, y - 1, 2.2, 2.2); }
    else if (p.kind === 'hype') disc(ctx, x, y, p.r * (0.6 + t), `rgba(243,201,105,${t})`);
  }
  ctx.restore();
}
