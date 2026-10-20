/**
 * The AIRDROP: at each milestone a cargo plane crosses the sky and pushes
 * crates out on parachutes, which drift down onto the hill behind the coin.
 * Airdrop farmers sprint in from downhill the moment one lands, fight over
 * it, and drag it away; their legs cycle with the ground they cover, so they
 * stand still once they stop. Everything is capped: three crates in the air,
 * two farmers per crate. Nothing here changes the committed outcome.
 */
import { type Camera, heightAt, slopeAngle, toScreen } from './hill';
import { clamp, mix, noise } from './motion';

const INK = '#1c1f26';
const MAX_CRATES = 3;
const PLANE_SPEED = 340;
/** Screen y of the plane: open sky on the left, under the dev's cloud, behind the hill on the right. */
const PLANE_Y = 250;

export interface Plane { x: number; dropped: number; age: number }
export interface Crate {
  /** World position; falling under a chute until `landed`, then carried off. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  sway: number;
  landed: boolean;
  age: number;
  farmers: Farmer[];
  carried: boolean;
  /** Speed downhill while carried off, ramping up from a standstill. */
  carry: number;
}
/** `vx` is a farmer's top speed and `v` his speed now; `phase` advances with distance, `stride` fades out when he stops. */
export interface Farmer { x: number; vx: number; v: number; tone: number; phase: number; stride: number; arrived: boolean }

export interface AirdropState {
  plane: Plane | null;
  crates: Crate[];
  events: { plane: boolean; landed: number; farmed: number };
  time: number;
}

export function createAirdrop(): AirdropState {
  return { plane: null, crates: [], events: { plane: false, landed: 0, farmed: 0 }, time: 0 };
}

export function resetAirdrop(a: AirdropState): void {
  a.plane = null;
  a.crates = [];
}

/** A milestone: send the plane, from off the left of the screen. */
export function sendPlane(a: AirdropState, cam: Camera): void {
  if (a.plane) return;
  a.plane = { x: cam.x - 560, dropped: 0, age: 0 };
  a.events.plane = true;
}

/** Steps the plane, the chutes, the farmers. `contactX` is where the coin is, so crates land behind it. */
export function stepAirdrop(a: AirdropState, cam: Camera, contactX: number, dt: number): void {
  a.time += dt;
  a.events = { plane: false, landed: 0, farmed: 0 };
  if (a.plane) {
    const p = a.plane;
    p.x += PLANE_SPEED * dt;
    p.age += dt;
    // Two crates, pushed out over the slope behind the coin.
    const dropAt = [contactX - 210, contactX - 110];
    while (p.dropped < dropAt.length && p.x >= dropAt[p.dropped]!) {
      if (a.crates.length < MAX_CRATES) {
        const skyY = cam.y + (300 - PLANE_Y);
        a.crates.push({ x: p.x, y: skyY - 10, vx: 20, vy: 0, sway: noise(a.time * 7 + p.dropped) * Math.PI * 2, landed: false, age: 0, farmers: [], carried: false, carry: 0 });
      }
      p.dropped += 1;
    }
    if (p.x > cam.x + 700) a.plane = null;
  }
  for (const c of a.crates) {
    c.age += dt;
    if (!c.landed) {
      // A chute: it opens after a short drop, then it floats down, swinging.
      c.vy = c.age < 0.35 ? c.vy - 500 * dt : mix(c.vy, -95, 1 - Math.exp(-dt * 4));
      c.sway += dt * 2.4;
      c.x += (c.vx + Math.sin(c.sway) * 30) * dt;
      c.y += c.vy * dt;
      const ground = heightAt(Math.max(0, c.x));
      if (c.y <= ground) {
        c.y = ground;
        c.landed = true;
        c.age = 0;
        a.events.landed += 1;
        // Two farmers sprint in from downhill.
        for (let i = 0; i < 2; i += 1) c.farmers.push({ x: c.x - 320 - i * 60, vx: 300 + noise(c.x + i) * 120, v: 0, tone: noise(c.x * 1.3 + i), phase: noise(i + c.x) * 6, stride: 0, arrived: false });
      }
      continue;
    }
    // Landed: the farmers sprint up (speeding up, then braking into the crate), squabble for a beat, then drag it
    // off downhill, getting it moving over a few tenths of a second.
    let all = c.farmers.length > 0;
    for (const f of c.farmers) {
      const from = f.x;
      if (!f.arrived) {
        f.v = Math.min(f.v + 1400 * dt, f.vx, 30 + 6 * (c.x - 18 - f.x));
        f.x = Math.min(c.x - 18, f.x + f.v * dt);
        if (f.x >= c.x - 18.5) { f.arrived = true; f.v = 0; }
        else all = false;
      }
      if (!c.carried) stride(f, f.x - from, dt);
    }
    if (all && !c.carried && c.age > 1.1) {
      c.carried = true;
      a.events.farmed += 1;
    }
    if (c.carried) {
      c.carry = Math.min(150, c.carry + 500 * dt);
      c.x -= c.carry * dt;
      c.y = heightAt(Math.max(0, c.x));
      for (const f of c.farmers) {
        const from = f.x;
        f.x = c.x - 18;
        stride(f, f.x - from, dt);
      }
    }
  }
  a.crates = a.crates.filter((c) => c.x > cam.x - 620 && c.age < 30);
}

/** Legs cycle with the distance covered (a longer stride at a sprint), and settle to a stand when he stops. */
function stride(f: Farmer, dx: number, dt: number): void {
  if (dt <= 0) return;
  const ds = Math.abs(dx);
  f.phase += ds / (12 + 0.05 * ds / dt) * Math.PI;
  f.stride += ((ds > 0.01 ? 1 : 0) - f.stride) * (1 - Math.exp(-dt / 0.12));
}

function drawFarmer(ctx: CanvasRenderingContext2D, f: Farmer, time: number, carrying: boolean): void {
  const run = Math.sin(f.phase) * f.stride;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-4 - run * 5, 0); ctx.moveTo(0, -10); ctx.lineTo(4 + run * 5, 0); ctx.stroke();
  ctx.strokeStyle = '#2f3f5c'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = f.tone > 0.5 ? '#f97316' : '#c084fc';
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(-5, -21, 10, 12, 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  // Running, the arm pumps with the legs; at the crate, the two of them tug at it.
  const reach = carrying ? 1 : f.arrived ? 0.7 : 0.4;
  const arm = carrying ? 0 : f.arrived ? Math.sin(time * 12 + f.tone * 6) * 3 : run * 3;
  ctx.beginPath(); ctx.moveTo(4, -18); ctx.lineTo(4 + 12 * reach, -18 - 4 * reach + arm); ctx.stroke();
  ctx.strokeStyle = '#f3dccb'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#f3dccb';
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, -26, 4.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(1, -27, 0.9, 0, Math.PI * 2); ctx.arc(3.5, -27, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(2.5, -23.5, 1.8, 1.2, 0, 0, Math.PI * 2); ctx.fill();
}

export function drawAirdrop(ctx: CanvasRenderingContext2D, a: AirdropState, cam: Camera): void {
  ctx.lineJoin = 'round';
  if (a.plane) {
    const px = 480 + (a.plane.x - cam.x);
    ctx.save();
    ctx.translate(px, PLANE_Y + Math.sin(a.time * 3) * 2);
    ctx.fillStyle = '#6b7280';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-46, -4); ctx.lineTo(-30, -12); ctx.lineTo(36, -12); ctx.lineTo(50, -2); ctx.lineTo(36, 8); ctx.lineTo(-30, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-40, -6); ctx.lineTo(-50, -19); ctx.lineTo(-37, -19); ctx.lineTo(-24, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(-22, 22); ctx.lineTo(16, 22); ctx.lineTo(22, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9fd3ff';
    ctx.beginPath(); ctx.roundRect(28, -9, 12, 5, 2); ctx.fill();
    ctx.fillStyle = '#ffe27a';
    ctx.font = '900 9px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AIRDROP', 2, -2, 56);
    // Propeller blur.
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(50, -2, 3, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  for (const c of a.crates) {
    const p = toScreen(cam, { x: c.x, y: c.y });
    if (!c.landed) {
      // The chute above the crate, canted with the swing.
      const swing = Math.sin(c.sway) * 0.25;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(swing);
      if (c.age > 0.25) {
        const open = clamp((c.age - 0.25) / 0.3, 0, 1);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-9, -8); ctx.lineTo(-24 * open, -44 * open); ctx.moveTo(9, -8); ctx.lineTo(24 * open, -44 * open); ctx.stroke();
        ctx.fillStyle = '#e63946';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-26 * open, -44 * open); ctx.quadraticCurveTo(0, -70 * open, 26 * open, -44 * open); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(-9 * open, -50 * open); ctx.quadraticCurveTo(0, -66 * open, 9 * open, -50 * open); ctx.closePath(); ctx.fill();
      }
      ctx.rotate(-swing * 0.5);
      drawCrate(ctx);
      ctx.restore();
      continue;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-slopeAngle(c.x));
    ctx.translate(0, c.carried ? -10 + Math.sin(a.time * 14) * 2 : 0);
    drawCrate(ctx);
    ctx.restore();
    for (const f of c.farmers) {
      const fp = toScreen(cam, { x: f.x, y: heightAt(Math.max(0, f.x)) });
      ctx.save();
      ctx.translate(fp.x, fp.y);
      ctx.rotate(-slopeAngle(f.x));
      drawFarmer(ctx, f, a.time, c.carried);
      ctx.restore();
    }
  }
}

function drawCrate(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#b8864b';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-11, -20, 22, 20, 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(80, 50, 20, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-11, -10); ctx.lineTo(11, -10); ctx.moveTo(0, -20); ctx.lineTo(0, 0); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = '900 6px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AIRDROP', 0, -14.5, 20);
  ctx.fillText('$', 0, -5, 20);
}
