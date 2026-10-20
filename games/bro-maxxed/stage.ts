/**
 * Gym changing room, vanity mirror, squat rack -> wedding altar conversion,
 * Coach Apex wall monitor, product trolley, bounded particle pool (<= 120),
 * high-contrast caption box, and optional cosmetic bar for BRO-MAXXED.
 */

import {
  drawMiloFigure,
  drawRexFigure,
  drawSupportingCast,
  type CastPose,
} from './cast';
import {
  OUTFIT_PALETTES,
  SPONSOR_STICKERS,
  type OutfitPalette,
} from './content';
import type { DirectedBeat } from './director';
import { clamp, mix, mulberry32 } from './motion';
import type { Rect, SceneLayout } from './portrait';

export const MAX_PARTICLES = 120;

export interface StageParticle {
  active: boolean;
  kind: 'petal' | 'confetti' | 'sparkle' | 'spray';
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  spin: number;
  age: number;
  life: number;
  color: string;
}

export interface StageState {
  particles: StageParticle[];
  cursor: number;
  lastSpawnTick: number;
  paletteIndex: number;
  stickerIndex: number;
  cleanLanguage: boolean;
  endingPreviewIndex: number | null;
}

export function createStage(): StageState {
  const particles: StageParticle[] = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push({
      active: false,
      kind: 'petal',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 5,
      angle: 0,
      spin: 0,
      age: 0,
      life: 1,
      color: '#f43f5e',
    });
  }
  return {
    particles,
    cursor: 0,
    lastSpawnTick: -1,
    paletteIndex: 0,
    stickerIndex: 0,
    cleanLanguage: false,
    endingPreviewIndex: null,
  };
}

export function resetStageParticles(stage: StageState): void {
  for (const p of stage.particles) {
    p.active = false;
  }
  stage.lastSpawnTick = -1;
}

function spawnParticle(
  stage: StageState,
  kind: StageParticle['kind'],
  x: number,
  y: number,
  vx: number,
  vy: number,
  size: number,
  life: number,
  color: string,
): void {
  const p = stage.particles[stage.cursor % MAX_PARTICLES]!;
  stage.cursor = (stage.cursor + 1) % MAX_PARTICLES;
  p.active = true;
  p.kind = kind;
  p.x = x;
  p.y = y;
  p.vx = vx;
  p.vy = vy;
  p.size = size;
  p.angle = (stage.cursor * 0.7) % (Math.PI * 2);
  p.spin = (stage.cursor % 2 === 0 ? 1 : -1) * 2.8;
  p.age = 0;
  p.life = life;
  p.color = color;
}

export function stepStage(
  stage: StageState,
  beat: DirectedBeat,
  layout: SceneLayout,
  dt: number,
  isLateEntry = false,
): void {
  const safeDt = clamp(dt, 0, 0.1);

  // Advance active pooled particles
  for (const p of stage.particles) {
    if (!p.active) continue;
    p.age += safeDt;
    if (p.age >= p.life) {
      p.active = false;
      continue;
    }
    p.x += p.vx * safeDt;
    p.y += p.vy * safeDt;
    p.angle += p.spin * safeDt;
    if (p.kind === 'petal' || p.kind === 'confetti') {
      p.vy += 45 * safeDt;
      p.vx += Math.sin(p.age * 5 + p.size) * 12 * safeDt;
    }
  }

  if (isLateEntry) return;

  // Deterministic 10Hz tick emission for wedding petals, G03 spray tan, and upgrade sparkles
  const tickBase =
    beat.mode === 'crashed'
      ? Math.floor((beat.crashStage === 'wedding' || beat.crashStage === 'opportunist' ? 1 : 0) * 100 + stage.cursor)
      : Math.floor(beat.slotAgeMs / 120);

  if (
    beat.mode === 'crashed' &&
    (beat.crashStage === 'wedding' || beat.crashStage === 'opportunist')
  ) {
    const rng = mulberry32(tickBase * 31 + 17);
    const colors = ['#fb7185', '#fda4af', '#fef08a', '#f472b6', '#ffffff'];
    for (let i = 0; i < 2; i++) {
      spawnParticle(
        stage,
        i % 2 === 0 ? 'petal' : 'confetti',
        layout.sharedHandPoint.x + (rng() - 0.5) * 320,
        layout.mirrorRect.y + rng() * 60,
        (rng() - 0.5) * 50,
        35 + rng() * 55,
        4 + rng() * 4,
        2.2 + rng() * 1.2,
        colors[Math.floor(rng() * colors.length)]!,
      );
    }
  } else if (beat.mode === 'running' && beat.gag.id === 'G03' && tickBase !== stage.lastSpawnTick) {
    stage.lastSpawnTick = tickBase;
    const rng = mulberry32(beat.slotIndex * 97 + tickBase);
    for (let i = 0; i < 3; i++) {
      spawnParticle(
        stage,
        'spray',
        layout.rexHome.x - 45 + rng() * 35,
        layout.rexHome.y - 120 + (rng() - 0.5) * 45,
        30 + rng() * 40,
        (rng() - 0.5) * 25,
        5 + rng() * 5,
        0.75,
        'rgba(234, 88, 12, 0.55)',
      );
    }
  }
}

export function countActiveParticles(stage: StageState): number {
  let count = 0;
  for (const p of stage.particles) {
    if (p.active) count++;
  }
  return count;
}

// ---- Text Wrapping Helper ---------------------------------------------------

export function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 3,
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) {
        // Put remaining words on final line
        const restIdx = words.indexOf(word);
        lines.push(words.slice(restIdx).join(' '));
        return lines.slice(0, maxLines);
      }
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

// ---- Stage & Prop Rendering -------------------------------------------------

function drawMonitorScreen(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  beat: DirectedBeat,
  weddingActive: boolean,
): void {
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = weddingActive ? '#f472b6' : '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 8);
  ctx.fill();
  ctx.stroke();

  // Page 6 rule: "When the wedding begins, stop the news screen, ticker and phone commentary."
  if (weddingActive) {
    ctx.fillStyle = '#fdf2f8';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      beat.crashVariant?.id === 'R05' ? 'ALPHA PAIR BONDING' : 'LIVE STREAM PAUSED',
      r.x + r.w / 2,
      r.y + r.h / 2 - 8,
    );
    ctx.fillStyle = '#f472b6';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText('TWO GROOMS · ZERO SPONSORS', r.x + r.w / 2, r.y + r.h / 2 + 12);
    ctx.restore();
    return;
  }

  // Top bar of monitor
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(r.x + 3, r.y + 3, r.w - 6, 20);
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(r.x + 13, r.y + 13, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const monitorTitle = beat.lateProgram
    ? beat.lateProgram.spec.id + ' · ' + beat.lateProgram.phase.toUpperCase()
    : 'COACH APEX · LIVE PODCAST';
  ctx.fillText(monitorTitle, r.x + 22, r.y + 16, r.w - 30);

  // Coach Apex figure on monitor
  const cx = r.x + r.w * 0.42;
  const cy = r.y + r.h * 0.72;
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.roundRect(cx - 22, cy - 28, 44, 38, 6);
  ctx.fill();
  ctx.fillStyle = '#e2b492';
  ctx.beginPath();
  ctx.arc(cx, cy - 40, 12, 0, Math.PI * 2);
  ctx.fill();
  // Dark sunglasses indoors
  ctx.fillStyle = '#090d16';
  ctx.fillRect(cx - 10, cy - 44, 20, 6);
  // Podcast microphone on boom arm
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(cx + 14, cy - 32, 6, 14);

  // G07: Studio backdrop slides aside to reveal Mom's laundry rack & Mom's hand with sandwich!
  if (beat.gag.id === 'G07' || (beat.lateProgram && beat.lateProgram.spec.id === 'LP03')) {
    // Laundry rack on right side of monitor
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x + r.w - 58, r.y + 34, 44, 52);
    // Pink socks hanging on rack
    ctx.fillStyle = '#f472b6';
    ctx.fillRect(r.x + r.w - 50, r.y + 38, 8, 14);
    ctx.fillRect(r.x + r.w - 34, r.y + 38, 8, 14);

    // Mom's floral sleeve reaching in with a triangle sandwich
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(r.x + r.w - 48, cy - 20, 44, 10);
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(cx + 22, cy - 24);
    ctx.lineTo(cx + 38, cy - 24);
    ctx.lineTo(cx + 30, cy - 10);
    ctx.closePath();
    ctx.fill();
  }

  // Bottom monitor ticker
  ctx.fillStyle = '#bef264';
  ctx.font = '700 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const sub = beat.lateProgram
    ? beat.lateProgram.spec.introBanner
    : 'CODE: SOLOALPHA ($89/MO)';
  ctx.fillText(sub, r.x + r.w / 2, r.y + r.h - 10, r.w - 16);

  ctx.restore();
}

function drawProductTrolley(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  beat: DirectedBeat,
  sticker: string,
): void {
  ctx.save();
  // Trolley frame & shelves
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 24, r.w, r.h - 24, 8);
  ctx.fill();
  ctx.stroke();

  // Shelf divider
  ctx.beginPath();
  ctx.moveTo(r.x + 8, r.y + r.h * 0.58);
  ctx.lineTo(r.x + r.w - 8, r.y + r.h * 0.58);
  ctx.stroke();

  // Hero prop on top of trolley (Page 21 & 25: "Keep one hero label; simplify the rest")
  const topY = r.y + 24;
  // Gold/magenta serum bottles & giant BASIC supplement tub (Band 4+)
  ctx.fillStyle = '#eab308';
  ctx.fillRect(r.x + 18, topY - 22, 22, 22);
  ctx.fillStyle = '#ec4899';
  ctx.fillRect(r.x + 48, topY - 28, 24, 28);

  if (beat.band >= 4 || beat.gag.id === 'G03') {
    // Huge BASIC supplement tub delivered by mini forklift (Page 7)
    ctx.fillStyle = '#f97316';
    ctx.strokeStyle = '#111318';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(r.x + 82, topY - 42, 68, 42, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111318';
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BASIC', r.x + 116, topY - 17);
  } else {
    // Gym bag on trolley/bench
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(r.x + 88, topY - 26, 62, 26, 8);
    ctx.fill();
  }

  // Hero Gag Prop Label on Trolley Front
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(r.x + 10, r.y + 34, r.w - 20, 38);
  ctx.fillStyle = '#d5fb6d';
  ctx.font = '800 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(beat.gag.propLabel, r.x + r.w / 2, r.y + 57, r.w - 28);

  // Sponsor sticker badge on lower shelf
  ctx.fillStyle = '#ec4899';
  ctx.beginPath();
  ctx.roundRect(r.x + 16, r.y + r.h - 44, r.w - 32, 28, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 11px system-ui, sans-serif';
  ctx.fillText(`SPONSORED BY ${sticker}`, r.x + r.w / 2, r.y + r.h - 26, r.w - 40);

  ctx.restore();
}

function drawMirrorStation(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  pose: CastPose,
  beat: DirectedBeat,
  palette: OutfitPalette,
): void {
  ctx.save();

  // Outer chrome vanity frame
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = beat.band >= 4 ? '#eab308' : '#94a3b8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 12);
  ctx.fill();
  ctx.stroke();

  // Inner reflective glass surface
  const glassX = r.x + 10;
  const glassY = r.y + 28;
  const glassW = r.w - 20;
  const glassH = r.h - 38;

  const grad = ctx.createLinearGradient(glassX, glassY, glassX + glassW, glassY + glassH);
  if (beat.mode === 'crashed' && beat.crashStage !== 'freeze') {
    grad.addColorStop(0, '#3b1d38');
    grad.addColorStop(0.5, '#4c1d4b');
    grad.addColorStop(1, '#2e1530');
  } else {
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(0.5, '#29374d');
    grad.addColorStop(1, '#172030');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(glassX, glassY, glassW, glassH);

  // Clip inside mirror glass to render Rex's reflection from the same rig state (Page 21)
  ctx.save();
  ctx.beginPath();
  ctx.rect(glassX, glassY, glassW, glassH);
  ctx.clip();

  // Diagonal reflection sheen lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(glassX + 20, glassY + glassH);
  ctx.lineTo(glassX + glassW - 20, glassY);
  ctx.stroke();

  // Reflected Rex figure (stays flexing alone on E01 or R08!)
  const showReflectedRex =
    beat.mode !== 'cashout' || pose.reflectionSoloFlex > 0.1 || beat.cashoutAgeSec < 0.75;
  if (showReflectedRex) {
    drawRexFigure(ctx, pose.rexReflection, beat, palette, true);
  }

  // R08: Sponsor offers the abandoned reflection an exclusive deal (Page 12)
  if (beat.mode === 'crashed' && beat.crashVariant?.id === 'R08') {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(glassX + 16, glassY + glassH - 46, glassW - 32, 34);
    ctx.fillStyle = '#d5fb6d';
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('REFLECTION SIGNED EXCLUSIVE BRAND DEAL', glassX + glassW / 2, glassY + glassH - 25);
  }

  ctx.restore();

  // Vanity bulbs along mirror top & sides when ringLights >= 1
  if (beat.bandSpec.ringLights >= 1) {
    const bulbs = 7;
    for (let i = 0; i < bulbs; i++) {
      const bx = r.x + 24 + ((r.w - 48) * i) / (bulbs - 1);
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(bx, r.y + 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Mirror Diagnostic Header Strip (Page 4 & 10: REASON FOR STARING: RECALCULATING)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(r.x + 8, r.y + 6, r.w - 16, 20);
  ctx.fillStyle =
    beat.mode === 'crashed'
      ? '#fda4af'
      : beat.mode === 'cashout'
        ? '#bef264'
        : '#38bdf8';
  ctx.font = '800 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(beat.mirrorHeadline, r.x + r.w / 2, r.y + 19, r.w - 24);

  ctx.restore();
}

function drawSquatRackOrWeddingAltar(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  beat: DirectedBeat,
): void {
  const isWedding =
    beat.mode === 'crashed' &&
    (beat.crashStage === 'wedding' || beat.crashStage === 'opportunist');

  ctx.save();

  // Squat rack steel uprights & crossbar
  ctx.strokeStyle = isWedding ? '#475569' : '#334155';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(r.x + 28, r.y + r.h);
  ctx.lineTo(r.x + 28, r.y + 14);
  ctx.lineTo(r.x + r.w - 28, r.y + 14);
  ctx.lineTo(r.x + r.w - 28, r.y + r.h);
  ctx.stroke();

  // Barbell across rack at chest height
  const barY = r.y + r.h * 0.48;
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(r.x + 8, barY);
  ctx.lineTo(r.x + r.w - 8, barY);
  ctx.stroke();

  // Weight plates on barbell ends
  ctx.fillStyle = '#111318';
  for (const sideX of [r.x + 16, r.x + r.w - 24]) {
    ctx.fillRect(sideX, barY - 22, 8, 44);
    ctx.fillRect(sideX + (sideX < r.x + r.w / 2 ? 9 : -7), barY - 16, 6, 32);
  }

  // Sign on Squat Rack Crossbar ("OPTIMAL" from Page 1 concept art!)
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = isWedding ? '#f472b6' : '#64748b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(r.x + r.w / 2 - 54, r.y + 2, 108, 24, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = isWedding ? '#fbcfe8' : '#e2e8f0';
  ctx.font = '900 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isWedding ? 'OPTIMAL UNION' : 'OPTIMAL', r.x + r.w / 2, r.y + 18);

  // Wedding Altar Floral Arch Conversion (Page 1, 10, 12, 21)
  if (isWedding) {
    const rosetteColors = ['#f43f5e', '#fb7185', '#fda4af', '#fef08a', '#ffffff', '#4ade80'];
    // Lush floral arch along both uprights and top bar
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      const archX = mix(r.x + 24, r.x + r.w - 24, u);
      const archY = r.y + 14 - Math.sin(u * Math.PI) * 14;
      ctx.fillStyle = rosetteColors[i % rosetteColors.length]!;
      ctx.beginPath();
      ctx.arc(archX, archY, 10 + (i % 3) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let j = 0; j < 8; j++) {
      const vy = r.y + 26 + j * 28;
      for (const ux of [r.x + 28, r.x + r.w - 28]) {
        ctx.fillStyle = rosetteColors[(j + 2) % rosetteColors.length]!;
        ctx.beginPath();
        ctx.arc(ux, vy, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Pride-Dumbbell Flag Banner on the right upright (matching Page 1 right panel!)
    const flagX = r.x + r.w - 58;
    const flagY = r.y + 68;
    const stripes = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
    for (let s = 0; s < stripes.length; s++) {
      ctx.fillStyle = stripes[s]!;
      ctx.fillRect(flagX, flagY + s * 6, 42, 6);
    }
    // Dumbbell icon on flag
    ctx.fillStyle = '#111318';
    ctx.fillRect(flagX + 10, flagY + 16, 22, 4);
    ctx.fillRect(flagX + 8, flagY + 12, 4, 12);
    ctx.fillRect(flagX + 30, flagY + 12, 4, 12);
  }

  ctx.restore();
}

/**
 * Draw the complete BRO-MAXXED stage, characters, active physical gag,
 * captions, and outcome overlays.
 */
export function drawStage(
  ctx: CanvasRenderingContext2D,
  stage: StageState,
  pose: CastPose,
  beat: DirectedBeat,
  layout: SceneLayout,
  time: number,
): void {
  const palette = OUTFIT_PALETTES[stage.paletteIndex % OUTFIT_PALETTES.length]!;
  const sticker = SPONSOR_STICKERS[stage.stickerIndex % SPONSOR_STICKERS.length]!;
  const isWedding =
    beat.mode === 'crashed' &&
    (beat.crashStage === 'wedding' || beat.crashStage === 'opportunist');
  const isCashout = beat.mode === 'cashout';

  ctx.save();

  // 1. Background Room Wall & Floor
  const wallGrad = ctx.createLinearGradient(0, 0, 0, layout.floorY);
  if (isWedding) {
    // Warmer romantic lighting (Page 21)
    wallGrad.addColorStop(0, '#2e162b');
    wallGrad.addColorStop(1, '#4a1d3d');
  } else if (isCashout) {
    // Daylight door open (TOUCH GRASS)
    wallGrad.addColorStop(0, '#162c3d');
    wallGrad.addColorStop(1, '#1e3a2f');
  } else {
    wallGrad.addColorStop(0, '#141720');
    wallGrad.addColorStop(1, '#1f2433');
  }
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, layout.width, layout.floorY);

  // Gym rubber floor & wedding rose-petal runner aisle
  ctx.fillStyle = isWedding ? '#271726' : '#181b22';
  ctx.fillRect(0, layout.floorY, layout.width, layout.height - layout.floorY);
  ctx.strokeStyle = isWedding ? '#f472b6' : '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, layout.floorY);
  ctx.lineTo(layout.width, layout.floorY);
  ctx.stroke();

  if (isWedding) {
    // White wedding aisle runner between Rex and Milo
    ctx.fillStyle = 'rgba(253, 242, 248, 0.22)';
    ctx.fillRect(layout.rexWedding.x - 60, layout.floorY, 240, layout.height - layout.floorY);
  }

  // Daylight Exit Door on right for TOUCH GRASS cashouts
  if (isCashout) {
    const doorX = layout.exitDoorX - 42;
    const doorY = layout.floorY - 168;
    const skyGrad = ctx.createLinearGradient(doorX, doorY, doorX, doorY + 168);
    skyGrad.addColorStop(0, '#bae6fd');
    skyGrad.addColorStop(0.75, '#dcfce7');
    skyGrad.addColorStop(1, '#4ade80');
    ctx.fillStyle = skyGrad;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(doorX, doorY, 56, 168, 4);
    ctx.fill();
    ctx.stroke();

    // Sunburst rays & grass blades at threshold
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(doorX + 2, doorY + 148, 52, 18);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(doorX + 4, doorY - 18, 48, 15);
    ctx.fillStyle = '#86efac';
    ctx.font = '900 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', doorX + 28, doorY - 8);
  }

  // 2. Upper Gym Sign & Fictional Product Ad Banner (stopped during wedding per Page 6)
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = isWedding ? '#f472b6' : isCashout ? '#86efac' : '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(
    layout.gymSignRect.x,
    layout.gymSignRect.y,
    layout.gymSignRect.w,
    layout.gymSignRect.h,
    6,
  );
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isWedding ? '#fbcfe8' : isCashout ? '#bbf7d0' : '#f8fafc';
  ctx.font = `900 ${layout.fonts.sign}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const signText = isWedding
    ? 'MOGGED BY LOVE · GYM WEDDING CHAPEL'
    : isCashout
      ? `TOUCH GRASS · ${beat.cashoutVariant?.name.toUpperCase() ?? 'EXIT'}`
      : beat.bandSpec.gymSign;
  ctx.fillText(
    signText,
    layout.gymSignRect.x + layout.gymSignRect.w / 2,
    layout.gymSignRect.y + layout.gymSignRect.h / 2,
    layout.gymSignRect.w - 16,
  );

  if (!isWedding) {
    // Fictional product advertisement banner (Page 18)
    const adR = layout.adBannerRect;
    ctx.fillStyle = '#1e1b4b';
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(adR.x, adR.y, adR.w, adR.h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e879f9';
    ctx.font = '900 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `${beat.product.brand} · ${beat.product.priceTag}`,
      adR.x + 10,
      adR.y + 15,
      adR.w - 20,
    );
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText(beat.product.primaryCopy, adR.x + 10, adR.y + 33, adR.w - 20);
  }

  // 3. Left Middle Distance: Monitor Screen & Product Trolley
  drawMonitorScreen(ctx, layout.monitorRect, beat, isWedding);
  drawProductTrolley(ctx, layout.trolleyRect, beat, sticker);

  // 4. Right Middle Distance: Squat Rack / Wedding Altar
  drawSquatRackOrWeddingAltar(ctx, layout.rackRect, beat);

  // 5. Center Foreground: Vanity Mirror (with Rex's live reflection)
  drawMirrorStation(ctx, layout.mirrorRect, pose, beat, palette);

  // 6. Supporting Cast (Bea, Vera, Best Man, Ring-Bearer Dog)
  drawSupportingCast(ctx, beat, layout, time);

  // 7. Lead Characters: Milo and Rex
  drawMiloFigure(ctx, pose.milo, beat);
  drawRexFigure(ctx, pose.rex, beat, palette, false);

  // 8. Shared Hand-Hold Sparkle / Tiny Weight-Plate Wedding Rings (Page 10, 12, 21)
  if (pose.handHoldBlend > 0.65) {
    const hx = pose.sharedHandWorld.x;
    const hy = pose.sharedHandWorld.y;
    ctx.save();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(hx, hy, 12 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
    ctx.stroke();

    if (isWedding) {
      // Tiny 1.25kg weight-plate wedding rings above joined hands (Page 12 R01)
      ctx.fillStyle = '#eab308';
      ctx.strokeStyle = '#111318';
      ctx.lineWidth = 1.5;
      for (const rx of [hx - 7, hx + 7]) {
        ctx.beginPath();
        ctx.arc(rx, hy - 20, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath();
        ctx.arc(rx, hy - 20, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#eab308';
      }
    }
    ctx.restore();
  }

  // 9. G12 Intimate Tripod extending between Rex and Milo, then pushed aside (Page 9)
  if (beat.mode === 'running' && beat.gag.id === 'G12') {
    const tx = pose.sharedHandWorld.x + (beat.gagStage === 'reaction' ? 42 : 0);
    const ty = layout.floorY;
    const topY = pose.sharedHandWorld.y - (beat.gagStage === 'setup' ? 10 : 38);
    ctx.save();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tx - 16, ty);
    ctx.lineTo(tx, topY);
    ctx.lineTo(tx + 16, ty);
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(tx - 12, topY - 12, 24, 14);
    ctx.restore();
  }

  // 10. Pooled Particles (rose petals, confetti, spray tan)
  for (const p of stage.particles) {
    if (!p.active) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 11. Rotating Rear-Wall Crowd Comment Pill (stopped during wedding per Page 6)
  if (!isWedding) {
    const cr = layout.commentPillRect;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cr.x, cr.y, cr.w, cr.h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = `800 ${layout.fonts.comment - 1}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(beat.crowdComment.speakerLabel, cr.x + 10, cr.y + 13, cr.w - 20);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `600 ${layout.fonts.comment - 1}px system-ui, sans-serif`;
    ctx.fillText(beat.crowdCommentText, cr.x + 10, cr.y + 29, cr.w - 20);
  }

  // 12. Primary High-Contrast Solid Caption Box (Page 6, 23, 25, 26)
  const cap = layout.captionRect;
  ctx.fillStyle = 'rgba(11, 15, 25, 0.95)';
  ctx.strokeStyle = isWedding
    ? '#f472b6'
    : isCashout
      ? '#bef264'
      : '#d5fb6d';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(cap.x, cap.y, cap.w, cap.h, 10);
  ctx.fill();
  ctx.stroke();

  // Speaker & Outcome Badge inside Caption Box
  ctx.fillStyle = isWedding ? '#f472b6' : '#d5fb6d';
  ctx.font = `900 ${layout.fonts.captionSpeaker}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const badgeLine = beat.outcomeHeadline
    ? `${beat.outcomeHeadline} · ${beat.captionSpeaker}`
    : beat.captionSpeaker;
  ctx.fillText(badgeLine, cap.x + 16, cap.y + 10, cap.w - 32);

  // Deliberate Multi-line Wrapped Caption Body
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${layout.fonts.captionBody}px system-ui, -apple-system, sans-serif`;
  const lines = wrapTextLines(ctx, beat.captionText, cap.w - 32, 2);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(
      lines[i]!,
      cap.x + 16,
      cap.y + 32 + i * (layout.fonts.captionBody + 5),
      cap.w - 32,
    );
  }

  // Opportunist / Subline Tag at bottom-right of Caption Box
  if (beat.opportunistLine) {
    ctx.fillStyle = '#fef08a';
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(beat.opportunistLine, cap.x + cap.w - 14, cap.y + 10, cap.w * 0.52);
  }

  // 13. Between-Round Cosmetic & Clean-Language Selector Pill (Page 6 & 26)
  const cos = layout.cosmeticBarRect;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cos.x, cos.y, cos.w, cos.h, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const langLabel = stage.cleanLanguage ? 'CLEAN' : 'SPICY';
  ctx.fillText(
    `FIT: ${palette.label} · ${sticker} · ${langLabel}`,
    cos.x + cos.w / 2,
    cos.y + cos.h / 2,
    cos.w - 16,
  );

  ctx.restore();
}
