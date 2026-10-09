
import { clamp, mix, mulberry32, noise, smoothstep, type Spring, settleSpring, spring, stepSpring } from './motion';
import type { Thrown } from './rigs';
type Ctx = CanvasRenderingContext2D;
export interface Camera { x: number; y: number }

export const LAYERS = { sky: { fx: 0.02, fy: 0.02 }, far: { fx: 0.12, fy: 0.12 }, mid: { fx: 0.35, fy: 0.35 }, across: { fx: 1, fy: 0.7 }, near: { fx: 1, fy: 1 } } as const;
export const CAM_MAX = 1900;
export const CAM_REST: Camera = { x: 0, y: 0 };
export const MOON = { x: 720, y: 150, r: 22 } as const;
export const BILLBOARD = { x: 130, y: 296, w: 150, h: 60 } as const;

export const SEARCH = { x: 880, y: 600 } as const;

export const ACROSS = { x: 900, w: 300, top: 455 } as const;
export const CANYON = { x: 744, w: 156 } as const;

export const ROW_PX = 72;
export const FLOORS = 40;
const GREEN = '#7cf67c';
const RED = '#ff4d6d';
const INK = '#0b0b12';

interface Strip { w: number; h: number; row: number; ww: number; wh: number; cols: number; pitch: number; x0: number; y0: number; lit: number; wall: string; ledge: number; seed: number }
const OURS: Strip = { w: 744, h: 2600, row: ROW_PX, ww: 54, wh: 44, cols: 10, pitch: 73, x0: 12, y0: 14, lit: 0.35, wall: '#2b2620', ledge: 5, seed: 7 };
const THEIRS: Strip = { w: 300, h: 2000, row: 60, ww: 36, wh: 28, cols: 6, pitch: 48, x0: 14, y0: 16, lit: 0.4, wall: '#262019', ledge: 4, seed: 13 };

export interface Tower { x: number; w: number; top: number; seed: number }
export interface Vignette { floor: number; kind: 'tv' | 'laptop'; snap: Spring; passed: boolean; col: number }export interface Bird { x: number; y: number; vx: number; vy: number; age: number }
export interface CityEvents {
  
  burst: boolean;
}
export interface City {
  stars: { x: number; y: number; r: number; seed: number }[];
  
  far: Tower[];
  mid: Tower[];
  farCells: number[];
  midCells: number[];
  
  chart: number[];
  chartHead: number;
  chartClock: number;
  chartMode: 'pre' | 'live' | 'red';
  chartValue: number;
  
  search: { angle: number; dir: number; aim: number; lock: Spring; pulse: number; target: { x: number; y: number } | null; mode: 'sweep' | 'lock' | 'throw' | 'down' };
  headlights: { x: number; y: number; speed: number }[];
  canyonPigeon: { x: number; y: number; t: number } | null;
  pigeonClock: number;
  vignettes: Vignette[];
  burst: { floor: number; fired: boolean; birds: Bird[] };
  litBoost: number;
  mastPhase: number;
  flicker: number;
  seed: number;
  events: CityEvents;
}
const noEvents = (): CityEvents => ({ burst: false });
function towers(count: number, minW: number, maxW: number, minTop: number, maxTop: number, seed: number, x0: number): Tower[] {
  const rand = mulberry32(seed);
  const out: Tower[] = [];
  let x = x0;
  for (let i = 0; i < count; i += 1) {
    const w = minW + rand() * (maxW - minW);
    out.push({ x, w, top: minTop + rand() * (maxTop - minTop), seed: i });
    x += w + 4 + rand() * 20;
  }
  return out;
}

function cells(list: Tower[], px: number, py: number, x0: number, y0: number, seed: number): number[] {
  const rand = mulberry32(seed);
  const tmp: { x: number; y: number; r: number }[] = [];
  for (const t of list) for (let y = t.top + y0; y < 470; y += py) for (let x = t.x + x0; x < t.x + t.w - x0 - 1; x += px) tmp.push({ x, y, r: rand() });
  tmp.sort((a, b) => a.r - b.r);
  const out: number[] = [];
  for (const c of tmp) out.push(c.x, c.y);
  return out;
}

function volatile() {
  const search: City['search'] = { angle: 40, dir: 1, aim: Math.PI / 2, lock: spring(0), pulse: 0, target: null, mode: 'sweep' };
  const vignettes: Vignette[] = [];
  const birds: Bird[] = [];
  return { chart: new Array<number>(160).fill(0), chartHead: 0, chartClock: 0, chartMode: 'pre' as const, chartValue: 1, search, canyonPigeon: null, pigeonClock: 0, vignettes, burst: { floor: 28, fired: false, birds }, litBoost: 0, seed: 1, events: noEvents() };
}
export function createCity(): City {
  const rand = mulberry32(2024);
  const stars: City['stars'] = [];
  for (let i = 0; i < 48; i += 1) stars.push({ x: rand() * 960, y: rand() * 300, r: 1 + Math.round(rand()), seed: rand() });
  // A blocky hillside town: one broad hill under the moon, the roofs stepping down with it, no glass towers.
  const farRaw = towers(26, 30, 64, 250, 330, 11, -40);
  const far: Tower[] = farRaw.map((t, i) => ({ ...t, top: 330 - 80 * Math.sin((i / (farRaw.length - 1)) * Math.PI) + (t.top - 250) * 0.25 }));
  const midRest: Tower[] = [{ x: -30, w: 120, top: 346, seed: 0 }, { x: 105, w: 170, top: 376, seed: 1 }];
  const midHill = towers(9, 50, 110, 330, 430, 23, 318).map((t, i) => ({ ...t, top: 330 + 100 * (i / 8) + (t.top - 330) * 0.2, seed: i + 2 }));
  const mid: Tower[] = [...midRest, ...midHill];
  return { stars, far, mid, farCells: cells(far, 6, 7, 3, 6, 31), midCells: cells(mid, 9, 10, 5, 12, 37), headlights: [{ x: 760, y: 508, speed: 1 }, { x: 830, y: 530, speed: -1 }, { x: 870, y: 514, speed: 1.3 }, { x: 790, y: 524, speed: -0.8 }, { x: 890, y: 534, speed: -1.1 }], mastPhase: 0, flicker: 0, ...volatile() };
}

export function resetCity(c: City): void {
  Object.assign(c, volatile());
}

export interface CityDrive {
  running: boolean;
  crashed: boolean;
  multiplier: number;
  tension: number;
  time: number;
  elapsed: number;
  reduced: boolean;
  escaped: boolean;
  target: { x: number; y: number } | null;
  crashT: number;
  thrown: Thrown | null;
  camY: number;
}

export function stepCity(c: City, drive: CityDrive, dt: number): void {
  c.events = noEvents();
  c.litBoost = 0.2 * clamp(drive.elapsed / 150000, 0, 1);
  c.chartValue = drive.multiplier;
  if (drive.running && c.chartMode === 'pre') c.chartMode = 'live';
  if (drive.running) {
    c.chartClock += dt;
    while (c.chartClock >= 0.25) {
      c.chartClock -= 0.25;
      c.chart[c.chartHead] = Math.log(Math.max(1, drive.multiplier));
      c.chartHead = (c.chartHead + 1) % c.chart.length;
    }
  }
  c.mastPhase = (c.mastPhase + dt * mix(1, 6, drive.tension)) % 1000;
  c.flicker = (c.flicker + dt * 0.2 * (1 + 4 * drive.tension) * (drive.reduced ? 0.3 : 1)) % 1000;
  // The searchlight: sweep, lock past tension 0.78, track the throw, 3 s down the canyon.
  const s = c.search;
  const T = drive.thrown?.times;
  s.target = drive.target;
  s.mode = T && drive.crashT >= 0 ? (drive.crashT < T.back ? 'throw' : drive.crashT < T.back + 3 ? 'down' : 'sweep') : drive.running && !drive.escaped && drive.tension >= 0.78 && drive.target ? 'lock' : 'sweep';
  s.angle += (s.dir * 280 * dt) / mix(9, 2.5, smoothstep(0, 0.75, drive.tension));
  if (s.angle > 160) {
    s.angle = 160;
    s.dir = -1;
  } else if (s.angle < 20) {
    s.angle = 20;
    s.dir = 1;
  }
  let want = s.aim;
  if (s.mode === 'down') want = Math.PI / 2;
  else if (s.target && s.mode !== 'sweep') {
    const cam = cameraFor(drive.thrown, drive.crashT);
    want = Math.atan2(SEARCH.y - cam.y * LAYERS.mid.fy - (s.target.y - cam.y), s.target.x - cam.x - (SEARCH.x - cam.x * LAYERS.mid.fx));
  }
  if (s.lock.x < 0.02) s.aim = want;
  else s.aim += clamp(want - s.aim, -5 * dt, 5 * dt);
  stepSpring(s.lock, s.mode === 'sweep' ? 0 : 1, s.mode === 'throw' ? 14 : 6, 0.8, dt);
  s.pulse = (s.pulse + dt * mix(1.5, 2.5, clamp((drive.elapsed - 44000) / 60000, 0, 1))) % 1000;
  for (const h of c.headlights) {
    h.x += h.speed * mix(12, 20, drive.tension) * dt;
    if (h.x > CANYON.x + CANYON.w + 8) h.x = CANYON.x - 8;
    else if (h.x < CANYON.x - 8) h.x = CANYON.x + CANYON.w + 8;
  }
  if (drive.running && drive.multiplier >= 3.4) {
    c.pigeonClock += dt;
    if (c.pigeonClock > 20 && !c.canyonPigeon) {
      c.pigeonClock = 0;
      c.canyonPigeon = { x: 912, y: 440, t: 0 };
    }
  }
  const p = c.canyonPigeon;
  if (p) {
    p.t += dt;
    p.x = 912 - p.t * 62;
    p.y = 440 + Math.sin(p.t * 3) * 10 + p.t * 6;
    if (p.t > 3) c.canyonPigeon = null;
  }
  // The vignettes snap as he passes their floor; the burst fires once.
  const th = drive.thrown;
  if (th && drive.camY > 0) {
    const floor = th.y < 540 ? FLOORS : FLOORS - 1 - Math.floor((th.y - 540) / ROW_PX);
    for (const v of c.vignettes) {
      if (!v.passed && floor <= v.floor) v.passed = true;
      stepSpring(v.snap, v.passed ? 1 : 0, 25, 0.5, dt);
    }
    if (!c.burst.fired && floor <= c.burst.floor) {
      c.burst.fired = true;
      c.events.burst = true;
      for (let i = 0; i < 3; i += 1) c.burst.birds.push({ x: th.x - 80 + i * 30, y: 534 + (FLOORS - c.burst.floor) * ROW_PX, vx: -50 + i * 40, vy: -300 - i * 70, age: 0 });
    }
  }
  for (const b of c.burst.birds) {
    b.age += dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  c.burst.birds = c.burst.birds.filter((b) => b.age < 1.5);
}

export function settleCity(c: City, settle: { multiplier: number; tension: number; running: boolean; crashed: boolean; escaped: boolean }): void {
  c.chartMode = settle.running || settle.crashed ? 'live' : 'pre';
  c.chart.fill(Math.log(Math.max(1, settle.multiplier)));
  c.chartValue = settle.multiplier;
  const locked = settle.running && !settle.escaped && settle.tension >= 0.78;
  settleSpring(c.search.lock, locked ? 1 : 0);
  c.search.mode = locked ? 'lock' : 'sweep';
}

export function crashCity(c: City, seed: number): void {
  const rand = mulberry32(seed + 17);
  c.seed = seed;
  c.chartMode = 'red';
  c.vignettes = [
    { floor: 18 + Math.floor(rand() * 13), kind: 'tv', snap: spring(0), passed: false, col: 9 },
    { floor: 20 + Math.floor(rand() * 13), kind: 'laptop', snap: spring(0), passed: false, col: 8 },
  ];
  c.burst = { floor: 24 + Math.floor(rand() * 11), fired: false, birds: [] };
}

export function cameraFor(thrown: Thrown | null, crashT: number): Camera {
  if (!thrown || crashT < 0 || crashT >= thrown.times.back) return { x: 0, y: 0 };
  const x = 160 * smoothstep(0, 1, clamp((crashT - thrown.times.follow) / 0.5, 0, 1));
  const y = crashT >= thrown.times.fall ? clamp(thrown.y - (250 + 0.08 * thrown.vy), 0, CAM_MAX) : 0;
  return { x, y };
}

export const floorAt = (camY: number): number => FLOORS - Math.floor(Math.max(0, camY) / ROW_PX);
// ---- Drawing ----
function layer(ctx: Ctx, cam: Camera, l: { fx: number; fy: number }): void {
  ctx.translate(-cam.x * l.fx, -cam.y * l.fy);
}
function seg(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function R(ctx: Ctx, fill: string | CanvasGradient, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}
function disc(ctx: Ctx, x: number, y: number, r: number, fill: string | CanvasGradient): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, rot = 0): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

function glow(ctx: Ctx, x: number, y: number, r0: number, r1: number, rgb: string, inner: number): void {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  g.addColorStop(0, `rgba(${rgb},${inner.toFixed(3)})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  disc(ctx, x, y, r1, g);
}

export function drawSky(ctx: Ctx, c: City, cam: Camera, tension: number, time: number): void {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, 340);
  g.addColorStop(0, '#0d0f14');
  g.addColorStop(0.88, '#251a12');
  g.addColorStop(1, '#38291a');
  R(ctx, g, 0, 0, 960, 540);
  R(ctx, 'rgba(52,38,24,0.5)', 0, 300, 960, 40);
  layer(ctx, cam, LAYERS.sky);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < c.stars.length; i += 1) {
    const s = c.stars[i]!;
    ctx.globalAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * (0.8 + s.seed * 2.4) + i * 1.7));
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
  glow(ctx, MOON.x, MOON.y, MOON.r, 72, '239,231,201', 0.2);
  const halo = smoothstep(0.85, 1, tension) * 0.35;
  if (halo > 0.01) {
    ctx.strokeStyle = `rgba(239,231,201,${halo.toFixed(3)})`;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(MOON.x, MOON.y, 40 + 3 * Math.sin(time * 1.5), 0, Math.PI * 2);
    ctx.stroke();
  }
  disc(ctx, MOON.x, MOON.y, MOON.r, '#efe7c9');
  disc(ctx, MOON.x - 7, MOON.y - 4, 5, '#e2d9b8');
  ctx.restore();
}

function windows(ctx: Ctx, list: number[], w: number, h: number, lit: number, colour: string, body: string, flicker: number, toggles: number): void {
  const n = list.length >> 1;
  const L = Math.floor(n * clamp(lit, 0, 1));
  const k = Math.floor(flicker * 40);
  ctx.fillStyle = colour;
  ctx.beginPath();
  for (let i = 0; i < L; i += 1) ctx.rect(list[2 * i]!, list[2 * i + 1]!, w, h);
  for (let j = 0; j < toggles; j += 1) {
    const idx = Math.floor(noise(k * 1.37 + j * 7.1) * n);
    if (idx >= L) ctx.rect(list[2 * idx]!, list[2 * idx + 1]!, w, h);
  }
  ctx.fill();
  if (toggles > 0 && L > 0) {
    ctx.fillStyle = body;
    ctx.beginPath();
    for (let j = 0; j < toggles; j += 1) {
      const idx = Math.floor(noise(k * 2.11 + j * 3.3) * L);
      ctx.rect(list[2 * idx]!, list[2 * idx + 1]!, w, h);
    }
    ctx.fill();
  }
}

export function drawSkyline(ctx: Ctx, c: City, cam: Camera, which: 'far' | 'mid', tension: number, time: number): void {
  ctx.save();
  layer(ctx, cam, LAYERS[which]);
  const list = which === 'far' ? c.far : c.mid;
  const body = which === 'far' ? '#242019' : '#191510';
  ctx.fillStyle = body;
  ctx.beginPath();
  for (const t of list) ctx.rect(t.x, t.top, t.w, 600 - t.top);
  ctx.fill();
  if (which === 'far') {
    windows(ctx, c.farCells, 2, 3, 0.18, 'rgba(255,196,110,0.6)', body, c.flicker, 14);
    // Rooftop water tanks and satellite dishes
    for (const t of list) {
      const wx = t.x + t.w * 0.3;
      if (t.seed % 3 === 1) {
        R(ctx, '#2e2921', wx, t.top - 12, 12, 12);
        R(ctx, '#3a342a', wx - 1, t.top - 13, 14, 2);
        R(ctx, '#241f18', wx + 4, t.top - 16, 4, 4);
      } else if (t.seed % 3 === 2) {
        ctx.strokeStyle = '#332d24';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(wx + 5, t.top - 2, 4.5, Math.PI, 0);
        ctx.stroke();
        seg(ctx, wx + 5, t.top - 2, wx + 5, t.top);
      }
    }
    // The minaret: a thin cylinder, a balcony
    R(ctx, '#332d24', 297, 190, 7, 130);
    R(ctx, '#403a2e', 293, 226, 15, 5);
    R(ctx, '#332d24', 294, 178, 13, 14);
    R(ctx, '#3f382c', 292, 174, 17, 5);
    ctx.fillStyle = '#d8c274';
    ctx.beginPath();
    ctx.arc(300.5, 168, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#241f18';
    ctx.beginPath();
    ctx.arc(302, 166.8, 3, 0, Math.PI * 2);
    ctx.fill();
    if (c.mastPhase % 1 < 0.5) {
      glow(ctx, 300, 167, 1, 9, '255,214,130', 0.5);
    }
  } else {
    for (const t of list) {
      // Flat roofs with parapets, tanks and AC c
      R(ctx, '#2a2419', t.x, t.top, t.w, 6);
      R(ctx, '#38301f', t.x, t.top, t.w, 1.5);
      const wx = t.x + t.w * 0.35;
      if (t.seed % 3 === 0) {
        R(ctx, '#2e2921', wx, t.top - 10, 11, 10);
        R(ctx, '#241f18', wx + 3, t.top - 13, 4, 3);
        R(ctx, '#38301f', wx - 2, t.top - 1, 15, 1);
      } else if (t.seed !== 1) {
        R(ctx, '#241f18', wx, t.top - 5, 9, 5);
        R(ctx, '#2e2921', wx + t.w * 0.3, t.top - 4, 7, 4);
      }
    }
    windows(ctx, c.midCells, 4, 5, 0.3 + 0.3 * tension + c.litBoost, 'rgba(255,196,110,0.85)', body, 0, 0);
    billboard(ctx, c, time);
  }
  ctx.restore();
}

function billboard(ctx: Ctx, c: City, time: number): void {
  const b = BILLBOARD;
  const red = c.chartMode === 'red';
  const col = red ? RED : GREEN;
  R(ctx, '#222633', b.x - 5, b.y - 5, b.w + 10, b.h + 10);
  ctx.strokeStyle = red ? 'rgba(255,77,109,0.55)' : 'rgba(124,246,124,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(b.x - 2.5, b.y - 2.5, b.w + 5, b.h + 5);
  R(ctx, '#0b0f1e', b.x, b.y, b.w, b.h);
  ctx.fillStyle = col;
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(c.chartMode === 'pre' ? '$ALIGN  PRE-LAUNCH' : '$ALIGN', b.x + 6, b.y + 13);
  if (c.chartMode === 'pre') {
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 3);
    ctx.fillRect(b.x + 6, b.y + b.h - 9, b.w - 12, 1);
    ctx.globalAlpha = 1;
    return;
  }
  const n = c.chart.length;
  let top = Math.log(2);
  for (const v of c.chart) if (v > top) top = v;
  ctx.strokeStyle = col;
  ctx.lineJoin = 'round';
  for (const [width, alpha] of [[3.5, 0.25], [1.5, 1]]) {
    ctx.lineWidth = width!;
    ctx.globalAlpha = alpha!;
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const x = b.x + 6 + (i / (n - 1)) * (b.w - 12);
      const y = b.y + b.h - 8 - (c.chart[(c.chartHead + i) % n]! / top) * (b.h - 26);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    if (red) ctx.lineTo(b.x + b.w - 6, b.y + b.h - 6);
    ctx.stroke();
  }
  ctx.textAlign = 'right';
  const v = c.chartValue;
  ctx.fillText(red ? '-100 %' : `${v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `${(v / 1e3).toFixed(1)}k` : v.toFixed(2)}×`, b.x + b.w - 6, b.y + b.h - 6);
}

export function drawSearchlight(ctx: Ctx, c: City, cam: Camera, time: number): void {
  const s = c.search;
  const lock = clamp(s.lock.x, 0, 1);
  const a = mix((s.angle * Math.PI) / 180, s.aim, lock);
  const sx = SEARCH.x - cam.x * LAYERS.mid.fx;
  const sy = SEARCH.y - cam.y * LAYERS.mid.fy;
  const alpha = mix(0.06, mix(0.06, 0.12, 0.5 + 0.5 * Math.sin(s.pulse * Math.PI * 2)), lock);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = '#fff8e0';
  for (const [half, k] of [[0.122, 1], [0.045, 0.7]]) {
    ctx.globalAlpha = alpha * k!;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a - half!) * 1300, sy - Math.sin(a - half!) * 1300);
    ctx.lineTo(sx + Math.cos(a + half!) * 1300, sy - Math.sin(a + half!) * 1300);
    ctx.fill();
  }
  ctx.restore();
}

function bird(ctx: Ctx, x: number, y: number, flap: number, dir: number, colour = '#8a8d96'): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  oval(ctx, 0, 0, 5, 3, colour);
  disc(ctx, 5, -1.5, 2.3, colour);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-1, -1);
  ctx.lineTo(-5, -1 - 8 * flap);
  ctx.moveTo(1, -1);
  ctx.lineTo(-2, -1 - 6 * flap);
  ctx.stroke();
  ctx.restore();
}

function paintStrip(g: Ctx, s: Strip): void {
  R(g, s.wall, 0, 0, s.w, s.h);
  for (let r = 0; r * s.row < s.h; r += 1) {
    const ry = r * s.row;
    for (let col = 0; col < s.cols; col += 1) {
      const x = s.x0 + col * s.pitch;
      const k = noise(s.seed + r * 131.7 + col * 17.3);
      R(g, k < s.lit ? (noise(k * 97.1) > 0.3 ? 'rgba(255,206,124,0.6)' : 'rgba(255,232,190,0.5)') : '#181410', x, ry + s.y0, s.ww, s.wh);
      R(g, 'rgba(10,8,6,0.55)', x + s.ww / 2 - 1, ry + s.y0, 2, s.wh);
    }
    if (r % s.ledge === s.ledge - 1) {
      R(g, '#3d352a', 0, ry + s.row - 6, s.w, 5);
      R(g, '#4a4234', 0, ry + s.row - 6, s.w, 1);
      R(g, 'rgba(0,0,0,0.35)', 0, ry + s.row - 1, s.w, 3);
    }
  }
  R(g, s === OURS ? '#211d17' : '#181410', s === OURS ? s.w - 6 : 0, 0, 6, s.h);
}

let STRIPS: { ours: HTMLCanvasElement | null; across: HTMLCanvasElement | null } | null = null;

function facade(ctx: Ctx, which: 'ours' | 'across'): void {
  if (!STRIPS) {
    STRIPS = { ours: null, across: null };
    try {
      for (const [key, strip] of [['ours', OURS], ['across', THEIRS]] as const) {
        const cv = document.createElement('canvas');
        cv.width = strip.w;
        cv.height = strip.h;
        const g = cv.getContext('2d');
        if (g) {
          paintStrip(g, strip);
          STRIPS[key] = cv;
        }
      }
    } catch {
      STRIPS.ours = STRIPS.across = null;
    }
  }
  const strip = which === 'ours' ? OURS : THEIRS;
  const ox = which === 'ours' ? 0 : ACROSS.x;
  const oy = which === 'ours' ? 540 : ACROSS.top;
  const img = STRIPS[which];
  if (img) ctx.drawImage(img, ox, oy);
  else R(ctx, strip.wall, ox, oy, strip.w, strip.h);
}

export function drawStreet(ctx: Ctx, c: City, cam: Camera, time: number): void {
  const A = ACROSS;
  ctx.save();
  layer(ctx, cam, LAYERS.across);
  facade(ctx, 'across');
  R(ctx, '#262019', A.x, A.top, A.w, 12);
  R(ctx, '#332a1d', A.x, A.top, A.w, 3);
  R(ctx, '#332c20', A.x + 44, A.top - 14, 30, 16);
  R(ctx, '#41382a', A.x + 44, A.top - 14, 30, 3);
  // The minaret on the across-the-street blo
  R(ctx, '#332d24', A.x + 128, A.top - 54, 8, 56);
  R(ctx, '#403a2e', A.x + 123, A.top - 30, 18, 5);
  R(ctx, '#3f382c', A.x + 126, A.top - 58, 12, 5);
  ctx.fillStyle = '#d8c274';
  ctx.beginPath();
  ctx.arc(A.x + 132, A.top - 62, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#241f18';
  ctx.beginPath();
  ctx.arc(A.x + 133.3, A.top - 63, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  layer(ctx, cam, LAYERS.near);
  const g = ctx.createLinearGradient(0, 372, 0, 440);
  g.addColorStop(0, 'rgba(12,8,4,0.5)');
  g.addColorStop(1, '#120d08');
  R(ctx, g, CANYON.x, 372, CANYON.w, 68);
  R(ctx, '#120d08', CANYON.x, 440, CANYON.w, 2300);
  const fade = clamp(1 - cam.y / 60, 0, 1);
  if (fade > 0) {
    ctx.beginPath();
    ctx.rect(CANYON.x, 372, CANYON.w, 220);
    ctx.clip();
    ctx.globalAlpha = fade;
    for (const h of c.headlights) {
      R(ctx, h.speed > 0 ? '#fff2c0' : '#ff5a5a', h.x, h.y, 2, 2);
      ctx.fillRect(h.x + 4, h.y, 2, 2);
    }
    if (c.canyonPigeon) bird(ctx, c.canyonPigeon.x, c.canyonPigeon.y, Math.sin(time * 50), -1, '#6f7380');
  }
  ctx.restore();
}

function vignette(ctx: Ctx, v: Vignette, time: number): void {
  const x = OURS.x0 + v.col * OURS.pitch;
  const y = 540 + (FLOORS - 1 - v.floor) * ROW_PX + OURS.y0;
  const s = clamp(v.snap.x, 0, 1.2);
  if (v.kind === 'tv') {
    R(ctx, `rgba(150,200,255,${(0.4 + 0.15 * noise(Math.floor(time * 9))).toFixed(3)})`, x, y, OURS.ww, OURS.wh);
    R(ctx, '#e4f1ff', x + 6, y + 18, 14, 10);
    R(ctx, INK, x + 27 + s * 2, y + 24, 14, 20);
    disc(ctx, x + 32 + s * 5, y + 17, 6.5, INK);
    if (s > 0.05) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + 40, y + 27);
      ctx.lineTo(x + 46 + s * 2, y + 27 - s * 14 + Math.sin(time * 14) * 3 * s);
      ctx.stroke();
    }
    return;
  }
  R(ctx, 'rgba(80,110,90,0.45)', x, y, OURS.ww, OURS.wh);
  R(ctx, '#2a2a34', x + 16, y + 28, 18, 3);
  R(ctx, '#0e1a12', x + 17, y + 16, 16, 12);
  ctx.strokeStyle = v.passed ? RED : GREEN;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 19, v.passed ? y + 19 : y + 26);
  ctx.lineTo(x + 25, v.passed ? y + 21 : y + 23);
  ctx.lineTo(x + 31, v.passed ? y + 27 : y + 18);
  ctx.stroke();
  R(ctx, INK, x + 35, y + 22 - s * 3, 13, 22);
  disc(ctx, x + 41, y + 15 - s * 3, 6.5, INK);
  if (s > 0.05) {
    ctx.fillRect(x + 48, y + 26 - s * 12, 4, 10);
    disc(ctx, x + 50, y + 25 - s * 12, 2.5, INK);
  }
}

export function drawFacades(ctx: Ctx, c: City, cam: Camera, time: number): void {
  ctx.save();
  layer(ctx, cam, LAYERS.near);
  if (cam.y < 1) R(ctx, OURS.wall, 0, 540, OURS.w, 40);
  else {
    facade(ctx, 'ours');
    for (const v of c.vignettes) vignette(ctx, v, time);
    for (const b of c.burst.birds) bird(ctx, b.x, b.y, Math.sin(time * 60 + b.x), b.vx < 0 ? -1 : 1);
  }
  ctx.restore();
}

function pigeon(ctx: Ctx, t: number): void {
  const down = t < 0.35 ? smoothstep(0.15, 0.35, t) : 1 - smoothstep(0.35, 0.5, t);
  const cx = 480;
  oval(ctx, cx - 44, 420, 24, 42, '#767a88', 0.15);
  oval(ctx, cx + 44, 420, 24, 42, '#767a88', -0.15);
  oval(ctx, cx, 418, 60, 50, '#8c909c');
  oval(ctx, cx, 430, 38, 34, '#a3a7b3');
  oval(ctx, cx, 374 + down * 10, 25, 22, '#4f8a78');
  disc(ctx, cx, 346 + down * 18, 26, '#8c909c');
  disc(ctx, cx, 342 + down * 12, 22, '#969aa6');
  const ey = 342 + down * 26;
  const cere = 354 + down * 24;
  ctx.fillStyle = '#2a2a30';
  ctx.beginPath();
  ctx.moveTo(cx - 6, cere - 2);
  ctx.lineTo(cx + 6, cere - 2);
  ctx.lineTo(cx, cere + 12);
  ctx.fill();
  oval(ctx, cx, cere - 1, 6, 3, '#e8e8ec');
  const blink = t >= 0.5 && t < 0.65 ? Math.floor((t - 0.5) / 0.05) : -1;
  for (const sgn of [-1, 1]) {
    const ex = cx + sgn * (17 - down * 4);
    disc(ctx, ex, ey, 8, '#c45a12');
    disc(ctx, ex, ey, 7, '#ff9a2e');
    disc(ctx, ex, ey, 3.2, '#101018');
    if (blink === 1) disc(ctx, ex, ey, 8.5, '#8c909c');
    else if (blink >= 0) R(ctx, '#8c909c', ex - 9, ey - 9, 18, 9);
  }
  ctx.fillStyle = '#e07a6c';
  for (const fx of [cx - 24, cx + 20]) for (let i = 0; i < 3; i += 1) ctx.fillRect(fx + i * 3, 462, 2, 8);
}

export function drawInsert(ctx: Ctx, c: City, t: number, reduced: boolean): void {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, 430);
  g.addColorStop(0, '#141a3a');
  g.addColorStop(1, '#2a2343');
  R(ctx, g, 0, 0, 960, 540);
  glow(ctx, 700, 120, 0, 90, '239,231,201', 0.4);
  ctx.fillStyle = 'rgba(20,26,64,0.3)';
  for (const tw of c.mid) {
    const w = tw.w * 1.6;
    const x = 480 + (tw.x + tw.w / 2 - 480) * 1.6 - w / 2;
    const top = 150 + (tw.top - 290) * 1.3;
    for (let k = 3; k >= 0; k -= 1) ctx.fillRect(x - k * 6, top - k * 6, w + k * 12, 500);
  }
  if (t >= 0.05 && t < 0.17) {
    const u = (t - 0.05) / 0.12;
    const x = 560 + 30 * u;
    const y = mix(-140, 540, u);
    if (!reduced) R(ctx, 'rgba(16,16,24,0.25)', x - 12, y - 180, 24, 180);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(u * 7);
    R(ctx, '#101018', -9, -22, 18, 46);
    disc(ctx, 0, -31, 10, '#101018');
    ctx.strokeStyle = '#101018';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [x0, y0, x1, y1] of [[-8, -14, -26, -32], [8, -14, 28, -4], [-5, 22, -20, 46], [5, 22, 18, 48]]) {
      ctx.moveTo(x0!, y0!);
      ctx.lineTo(x1!, y1!);
    }
    ctx.stroke();
    ctx.restore();
  }
  R(ctx, '#3a3942', 0, 430, 960, 110);
  R(ctx, '#4a4852', 0, 430, 960, 3);
  if (t >= 0.45) {
    const f = Math.min(2, Math.floor((t - 0.45) / 0.05));
    const jx = 596 + (noise(c.seed + f) - 0.5) * 4;
    const r = [2.5, 3.5, 3][f]!;
    ctx.globalAlpha = 0.5 - f * 0.1;
    disc(ctx, jx, 433, r, '#9a9aa4');
    disc(ctx, jx - 6, 435, r * 0.8, '#9a9aa4');
    disc(ctx, jx + 6, 435, r * 0.8, '#9a9aa4');
    ctx.globalAlpha = 1;
  }
  if (t >= 0.4) {
    const y = mix(426, 380, clamp((t - 0.4) / 0.5, 0, 1));
    ctx.globalAlpha = clamp((t - 0.4) / 0.08, 0, 1);
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#202432';
    ctx.strokeText('?', 596, y);
    ctx.fillStyle = '#ffe27a';
    ctx.fillText('?', 596, y);
    ctx.globalAlpha = 1;
  }
  pigeon(ctx, t);
  ctx.restore();
}