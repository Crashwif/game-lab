/**
 * The ridge, the mud, the loot and the seeded cloud. Comedy only:
 * whole frogs, no insignia, no gore. The cloud is the committed crash.
 */
import { clamp, mulberry32, noise } from './motion';

export const INK = '#1c1f26';

export function advanceOf(multiplier: number): number {
  return clamp(Math.log2(Math.max(1, multiplier)) / 4, 0, 1);
}

export function ridgeY(x: number, steep: number): number {
  const base = 250 - Math.sin((x - 200) / 180) * 30;
  return base - steep * 70 * clamp((x - 180) / 500, 0, 1);
}

interface Bit { x: number; y: number; vy: number; age: number; life: number; }

export interface Field {
  bits: Bit[];
  cloud: number;
  crater: number;
  crashed: boolean;
}

export function createField(): Field {
  return { bits: [], cloud: 0, crater: 0, crashed: false };
}

export function resetField(f: Field): void {
  f.bits = [];
  f.cloud = 0;
  f.crater = 0;
  f.crashed = false;
}

export function nukeField(f: Field, seed: number, quiet: boolean): void {
  if (f.crashed) return;
  f.crashed = true;
  if (quiet) {
    f.cloud = 1;
    f.crater = 1;
    return;
  }
  const rand = mulberry32(seed);
  for (let i = 0; i < 14; i += 1) {
    f.bits.push({ x: 620 + rand() * 160, y: 180, vy: 40 + rand() * 80, age: 0, life: 1.4 + rand() });
  }
}

export function stepField(f: Field, dt: number): void {
  if (!f.crashed) return;
  f.cloud = Math.min(1, f.cloud + dt * 0.8);
  f.crater = Math.min(1, f.crater + dt * 0.5);
  for (const bit of f.bits) {
    bit.age += dt;
    bit.y += bit.vy * dt;
  }
  f.bits = f.bits.filter((bit) => bit.age < bit.life);
}

export function drawField(ctx: CanvasRenderingContext2D, f: Field, multiplier: number, time: number, reduced: boolean): void {
  const steep = advanceOf(multiplier);
  const sky = ctx.createLinearGradient(0, 0, 0, 320);
  sky.addColorStop(0, '#243044');
  sky.addColorStop(1, '#c47a4a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 960, 540);
  // Shell bursts. Positions are deterministic so a replay looks the same.
  const bursts = 2 + Math.floor(steep * 6);
  for (let i = 0; i < bursts; i += 1) {
    const x = 180 + noise(i * 9) * 640;
    const y = 40 + noise(i * 4) * 120;
    const a = reduced ? 0.35 : 0.25 + 0.25 * Math.sin(time * 3 + i);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    ctx.arc(x, y, 8 + (i % 3) * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Ridge.
  ctx.beginPath();
  ctx.moveTo(0, 320);
  for (let x = 0; x <= 960; x += 16) ctx.lineTo(x, ridgeY(x, f.crashed ? steep * (1 - f.crater) : steep));
  ctx.lineTo(960, 430);
  ctx.lineTo(0, 430);
  ctx.closePath();
  ctx.fillStyle = '#6d5a3a';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Loot on the ridge, closer as the squad advances.
  const lootX = 700 - steep * 40;
  const lootY = ridgeY(lootX, steep) - 10;
  ctx.fillStyle = '#f0c14a';
  ctx.fillRect(lootX, lootY - 16, 18, 14);
  ctx.strokeRect(lootX, lootY - 16, 18, 14);
  ctx.fillStyle = '#c6f135';
  ctx.beginPath();
  ctx.ellipse(lootX + 46, lootY - 6, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f4efe2';
  ctx.beginPath();
  ctx.arc(lootX + 80, lootY - 22, 10, 0, Math.PI * 2);
  ctx.fill();
  // Mud and trench.
  ctx.fillStyle = '#3d3428';
  ctx.fillRect(0, 400, 960, 140);
  ctx.fillStyle = '#2a241c';
  ctx.beginPath();
  ctx.moveTo(0, 430);
  ctx.lineTo(960, 430);
  ctx.lineTo(960, 500);
  ctx.lineTo(0, 500);
  ctx.fill();
  if (f.crater > 0.05) {
    ctx.fillStyle = '#4a4034';
    ctx.beginPath();
    ctx.ellipse(680, ridgeY(680, 0) + 20, 50 * f.crater, 16 * f.crater, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (f.cloud > 0.02) {
    ctx.save();
    ctx.translate(690, 120 - f.cloud * 30);
    ctx.globalAlpha = clamp(f.cloud, 0, 1);
    ctx.fillStyle = '#f2efe6';
    ctx.beginPath();
    ctx.ellipse(0, 0, 36 + f.cloud * 20, 28, 0, 0, Math.PI * 2);
    ctx.ellipse(-28, 16, 22, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(30, 14, 24, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillRect(-8, 20, 16, 40 + f.cloud * 30);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  for (const bit of f.bits) {
    ctx.globalAlpha = 1 - bit.age / bit.life;
    ctx.fillStyle = '#6d5a3a';
    ctx.beginPath();
    ctx.arc(bit.x, bit.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
