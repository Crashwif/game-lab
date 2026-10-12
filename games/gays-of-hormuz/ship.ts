/**
 * The SS Sashay, a pride cruise ship drawn in profile, bow toward +x, origin at midship on the waterline,
 * y up the screen negative, at the near lane's scale (the scene scales it with depth). The ship's pose is
 * a frame (where midship sits on screen, its scale, a pitch about a pivot and a drop); while she sails the
 * pitch comes from the swell and hits, and after the backend's crash `sinkPose` takes her under as a pure
 * function of crash time, so a replay or a late entry draws the same frame.
 */
import { PRIDE, drawDisco, drawPerson, sparkle, text, mixColor } from './art';

export interface ShipFrame { x: number; y: number; scale: number; angle: number; pivot: number; drop: number }

/** Hull px to screen px through a frame, the same transform `applyFrame` puts on the context. */
export function toScreen(frame: ShipFrame, lx: number, ly: number): { x: number; y: number } {
  const c = Math.cos(frame.angle);
  const s = Math.sin(frame.angle);
  const px = lx - frame.pivot;
  return { x: frame.x + (frame.pivot + px * c - ly * s) * frame.scale, y: frame.y + (frame.drop + px * s + ly * c) * frame.scale };
}

export function applyFrame(ctx: CanvasRenderingContext2D, frame: ShipFrame): void {
  ctx.translate(frame.x, frame.y);
  ctx.scale(frame.scale, frame.scale);
  ctx.translate(frame.pivot, frame.drop);
  ctx.rotate(frame.angle);
  ctx.translate(-frame.pivot, 0);
}

export interface ShipLook {
  /** Scene seconds, for the flags, the smoke, the radar and the disco ball. */
  clock: number;
  /** The dance, in beats. */
  beat: number;
  /** 0 at anchor to 1 at full speed. */
  speed: number;
  /** Dancers on deck, up to the twelve spots. */
  crowd: number;
  /** 0..1: everyone ducks after a hit. */
  duck: number;
  /** The player's figure on the foredeck, while they have a bet aboard. */
  you: boolean;
  night: number;
  /** 0..1 as she floods: the lights fail and the party stops. */
  flood: number;
  shield: number;
  scars: readonly { local: number; y: number; age: number }[];
}

const SLATE = '#d9dbe8';
const NAVY = '#1d2550';
/** Where dancers stand, in the order they fill: the sun deck, then the foredeck, then the stern. */
export const DANCE_SPOTS: readonly (readonly [number, number])[] = [
  [-26, -88], [0, -88], [-58, -88], [-42, -88], [-12, -88], [24, -88], [-96, -88], [-108, -88],
  [84, -50], [122, -51], [-140, -45], [-128, -45],
];
/** The player stands on the foredeck, where the helicopter winches them up. */
export const YOU_SPOT = [102, -50] as const;
/** Lifeboats along deck B, in pride order; the sinking drops two of them. */
export const LIFEBOATS: readonly number[] = [-112, -88, -64, -40, -16, 8];

function hullPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-144, 22);
  ctx.lineTo(-150, -44);
  ctx.quadraticCurveTo(-10, -42, 126, -50);
  ctx.lineTo(158, -57);
  ctx.quadraticCurveTo(147, -26, 128, 22);
  ctx.closePath();
}

function windows(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, night: number, flood: number, salt: number): void {
  for (let x = x0, i = 0; x <= x1; x += 8, i++) {
    const lit = night > 0 && ((i * 7 + salt) % 5 !== 0) && (flood < 0.3 || Math.sin(i * 12.9 + salt + flood * 40) > flood * 2 - 0.4);
    ctx.fillStyle = lit ? mixColor('#3b5a9a', '#ffe08a', night) : '#3b5a9a';
    ctx.fillRect(x, y, 5, 4.5);
  }
}

function block(ctx: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, nose: number): void {
  ctx.fillStyle = '#fbfbff';
  ctx.beginPath();
  ctx.moveTo(x0, y1);
  ctx.lineTo(x0, y0);
  ctx.lineTo(x1 - nose, y0);
  ctx.quadraticCurveTo(x1, y0, x1, y1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = SLATE;
  ctx.fillRect(x0, y1 - 2, x1 - x0, 2);
}

/** The flag at the stern streams back from the pole, six stripes waving. */
function flag(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, clock: number, wind: number): void {
  const n = 10;
  for (let k = 0; k < PRIDE.length; k++) {
    ctx.fillStyle = PRIDE[k]!;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const wave = Math.sin(clock * 7 - u * 5) * 3 * u * wind;
      const px = x - u * w * (0.85 + 0.15 * wind);
      const py = y + (k * h) / PRIDE.length + wave + u * (1 - wind) * 8;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    for (let i = n; i >= 0; i--) {
      const u = i / n;
      const wave = Math.sin(clock * 7 - u * 5) * 3 * u * wind;
      const px = x - u * w * (0.85 + 0.15 * wind);
      const py = y + ((k + 1) * h) / PRIDE.length + wave + u * (1 - wind) * 8 + 0.4;
      ctx.lineTo(px, py);
    }
    ctx.fill();
  }
}

function bunting(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, night: number, flood: number, clock: number): void {
  ctx.strokeStyle = 'rgba(60, 50, 90, 0.7)';
  ctx.lineWidth = 0.7;
  const sag = 7;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag, x1, y1);
  ctx.stroke();
  const n = Math.max(3, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 8));
  for (let i = 1; i < n; i++) {
    const u = i / n;
    const x = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * (x0 + x1) / 2 + u * u * x1;
    const y = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * ((y0 + y1) / 2 + sag) + u * u * y1;
    ctx.fillStyle = PRIDE[i % PRIDE.length]!;
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x + 2, y);
    ctx.lineTo(x, y + 3.5);
    ctx.fill();
    if (night > 0 && flood < 0.6 && Math.sin(clock * 4 + i * 1.7) > -0.2) {
      ctx.fillStyle = `rgba(255, 245, 200, ${night * (1 - flood)})`;
      ctx.fillRect(x - 0.8, y - 1.6, 1.6, 1.6);
    }
  }
}

/** The whole ship in hull coordinates. */
export function drawShip(ctx: CanvasRenderingContext2D, look: ShipLook): void {
  const { clock, night, flood } = look;
  const party = 1 - flood;
  // The caller's alpha: the underwater pass draws the whole ship faintly through the sea.
  const base = ctx.globalAlpha;

  // Laser show from the sun deck after dark.
  if (night > 0.2 && party > 0.3) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + Math.sin(clock * (0.7 + k * 0.23) + k * 2) * 0.9;
      ctx.strokeStyle = PRIDE[(k * 2 + Math.floor(clock * 0.5)) % 6]!;
      ctx.globalAlpha = base * 0.28 * night * party;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-10, -96);
      ctx.lineTo(-10 + Math.cos(a) * 420, -96 + Math.sin(a) * 420);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Funnel smoke, pastel, streaming aft with the speed.
  for (let k = 0; k < 7; k++) {
    const age = (clock * 0.55 + k / 7) % 1;
    const x = -48 - age * (30 + 70 * look.speed) - k * 2;
    const y = -136 - age * 26 + Math.sin(k * 3 + clock) * 2;
    ctx.globalAlpha = base * (1 - age) * 0.5;
    ctx.fillStyle = PRIDE[k % 6]!;
    ctx.beginPath();
    ctx.arc(x, y, 3 + age * 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = base;

  // The funnel, raked aft, in stripes.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-72, -86);
  ctx.lineTo(-40, -86);
  ctx.lineTo(-34, -131);
  ctx.lineTo(-62, -131);
  ctx.closePath();
  ctx.clip();
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = PRIDE[k]!;
    ctx.fillRect(-75, -131 + k * 7.6, 44, 7.8);
  }
  ctx.restore();
  ctx.fillStyle = '#20202a';
  ctx.beginPath();
  ctx.moveTo(-62.5, -131); ctx.lineTo(-33.5, -131); ctx.lineTo(-33, -135); ctx.lineTo(-62, -135);
  ctx.fill();

  // Mast, radar and the masthead light.
  ctx.strokeStyle = '#8a8fa6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, -100); ctx.lineTo(64, -142);
  ctx.stroke();
  const sweep = Math.cos(clock * 3) * 9;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(64 - sweep, -128); ctx.lineTo(64 + sweep, -128);
  ctx.stroke();
  ctx.fillStyle = night > 0.3 && Math.sin(clock * 4) > 0 ? '#ff4f6a' : '#c9c9d6';
  ctx.beginPath();
  ctx.arc(64, -143, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Bunting from the masthead to the bow and the funnel, and on to the stern.
  bunting(ctx, 64, -142, 156, -58, night, flood, clock);
  bunting(ctx, 64, -142, -36, -133, night, flood, clock);
  bunting(ctx, -62, -133, -149, -101, night, flood, clock);

  // Superstructure, stepping back deck by deck.
  block(ctx, -138, 120, -60, -44, 12);
  block(ctx, -130, 106, -74, -60, 12);
  block(ctx, -118, 92, -88, -74, 12);
  block(ctx, 34, 98, -102, -88, 8);
  windows(ctx, -132, 110, -57, night, flood, 1);
  windows(ctx, -124, 96, -71, night, flood, 2);
  windows(ctx, -112, 82, -85, night, flood, 3);
  ctx.fillStyle = night > 0 && flood < 0.5 ? mixColor('#26355f', '#7ad9ff', night * 0.6) : '#26355f';
  ctx.fillRect(40, -99, 54, 6);
  // The captain at the wheel, in a white cap.
  ctx.fillStyle = '#d9a27a';
  ctx.beginPath();
  ctx.arc(80, -95.5, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(77.5, -98.6, 5, 1.6);
  // Railings along the sun deck and the foredeck.
  ctx.strokeStyle = 'rgba(70, 70, 100, 0.55)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-116, -92); ctx.lineTo(32, -92);
  ctx.moveTo(98, -53); ctx.lineTo(150, -59);
  ctx.stroke();
  // The pool and the water slide.
  ctx.fillStyle = '#4de1ff';
  ctx.fillRect(-78, -90, 50, 2.4);
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = PRIDE[(k * 2) % 6]!;
    ctx.beginPath();
    ctx.arc(-100, -97 - k * 7, 7 - k, Math.PI * (0.1 + k * 0.2), Math.PI * (1.2 + k * 0.2));
    ctx.stroke();
  }
  ctx.strokeStyle = '#8a8fa6';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-100, -88); ctx.lineTo(-100, -118);
  ctx.stroke();
  // The DJ booth.
  ctx.fillStyle = '#2a2140';
  ctx.fillRect(10, -94, 12, 6);
  ctx.fillStyle = PRIDE[Math.floor(look.beat * 2) % 6]!;
  ctx.fillRect(12, -93, 2, 2);
  ctx.fillRect(18, -93, 2, 2);

  // Lifeboats on their davits, colour-coded.
  LIFEBOATS.forEach((x, k) => {
    ctx.strokeStyle = '#555a70';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 2, -72); ctx.lineTo(x + 2, -67);
    ctx.moveTo(x + 15, -72); ctx.lineTo(x + 15, -67);
    ctx.stroke();
    ctx.fillStyle = PRIDE[k]!;
    ctx.beginPath();
    ctx.ellipse(x + 8.5, -64.5, 9, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(x + 3, -66, 11, 1);
  });

  // The hull: white, a pride stripe sweeping up to the bow, portholes and the name.
  ctx.save();
  hullPath(ctx);
  ctx.fillStyle = '#fbfbff';
  ctx.fill();
  ctx.clip();
  for (let k = 0; k < PRIDE.length; k++) {
    ctx.fillStyle = PRIDE[k]!;
    ctx.beginPath();
    const top = -33 + k * 2.7;
    ctx.moveTo(-160, top);
    ctx.lineTo(40, top);
    ctx.quadraticCurveTo(110, top, 170, top - 10);
    ctx.lineTo(170, top - 10 + 2.9);
    ctx.quadraticCurveTo(110, top + 2.9, 40, top + 2.9);
    ctx.lineTo(-160, top + 2.9);
    ctx.fill();
  }
  ctx.fillStyle = NAVY;
  ctx.fillRect(-160, -6, 330, 30);
  ctx.fillStyle = 'rgba(0, 0, 30, 0.12)';
  ctx.fillRect(-160, -44, 330, 4);
  ctx.restore();
  for (let x = -138; x <= 80; x += 10) {
    const lit = night > 0 && flood < 0.4 && (x * 13) % 7 !== 0;
    ctx.fillStyle = lit ? mixColor(NAVY, '#ffe08a', night) : NAVY;
    ctx.beginPath();
    ctx.arc(x, -39, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  text(ctx, 'SS SASHAY', 116, -40, 6.5, NAVY, 'center', 40, 900);
  ctx.fillStyle = '#3a3f55';
  ctx.beginPath();
  ctx.arc(144, -40, 2.4, 0, Math.PI * 2);
  ctx.fill();

  // Flags: the big one at the stern, a small one at the bow.
  ctx.strokeStyle = '#8a8fa6';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-149, -44); ctx.lineTo(-149, -101);
  ctx.moveTo(156, -57); ctx.lineTo(156, -74);
  ctx.stroke();
  const wind = 0.5 + 0.5 * look.speed;
  flag(ctx, -149, -101, 36, 22, clock, wind);
  flag(ctx, 156, -74, 12, 8, clock + 1, wind);

  // The party: dancers on the beat, ducking after a hit, still once she floods.
  const crowd = Math.min(DANCE_SPOTS.length, Math.max(0, Math.round(look.crowd)));
  for (let i = 0; i < crowd; i++) {
    const [x, y] = DANCE_SPOTS[i]!;
    const phase = look.beat + i * 0.37;
    ctx.save();
    ctx.translate(x, y);
    drawPerson(ctx, {
      skin: i * 5 + 1, shirt: i * 3 + 2, arms: party * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2)),
      bob: party * Math.abs(Math.sin(phase * Math.PI)) * 1.4, duck: Math.max(look.duck, flood * 0.8),
    });
    ctx.restore();
  }
  // The DJ, headphones on.
  ctx.save();
  ctx.translate(16, -94);
  drawPerson(ctx, { skin: 3, shirt: 5, arms: party * (0.3 + 0.3 * Math.sin(look.beat * Math.PI * 4)), bob: party * Math.abs(Math.sin(look.beat * Math.PI)) , duck: look.duck });
  ctx.restore();

  // The player, in a captain's hat and a pride sash, on the foredeck.
  if (look.you) {
    ctx.save();
    ctx.translate(YOU_SPOT[0], YOU_SPOT[1]);
    drawPerson(ctx, { skin: 4, shirt: 6, arms: 0.3 + 0.2 * Math.sin(clock * 3), bob: 0, duck: look.duck });
    ctx.fillStyle = PRIDE[0]!;
    ctx.fillRect(-2.2, -8, 4.4, 1.2);
    ctx.fillStyle = PRIDE[4]!;
    ctx.fillRect(-2.2, -6.8, 4.4, 1.2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2.6, -14.4, 5.2, 1.8);
    ctx.fillStyle = NAVY;
    ctx.fillRect(-2.8, -12.8, 5.6, 0.8);
    ctx.restore();
  }

  // Miss Demeanor at the very bow, arms out like she owns the strait; she clings on as the ship floods.
  ctx.save();
  ctx.translate(147, -57);
  ctx.scale(1.35, 1.35);
  ctx.fillStyle = '#ff4fa3';
  ctx.beginPath();
  ctx.moveTo(-3.5, 0); ctx.lineTo(3.5, 0); ctx.lineTo(1.6, -8); ctx.lineTo(-1.6, -8);
  ctx.fill();
  ctx.strokeStyle = '#c68e64';
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  const spread = 1 - flood;
  ctx.beginPath();
  ctx.moveTo(-1.5, -7); ctx.lineTo(-6 * spread - 1.5 * (1 - spread), -8.5 - 2 * (1 - spread));
  ctx.moveTo(1.5, -7); ctx.lineTo(6 * spread + 1.5 * (1 - spread), -8.5 - 2 * (1 - spread));
  ctx.stroke();
  ctx.fillStyle = '#c68e64';
  ctx.beginPath();
  ctx.arc(0, -10, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b26bff';
  ctx.beginPath();
  ctx.arc(0, -12.2, 2.8, Math.PI * 0.9, Math.PI * 2.1);
  ctx.arc(-1.8, -10.5, 1.6, 0, Math.PI * 2);
  ctx.arc(1.8, -10.5, 1.6, 0, Math.PI * 2);
  ctx.fill();
  // A feather boa streaming aft.
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-1, -8);
  for (let i = 1; i <= 5; i++) ctx.lineTo(-1 - i * 2.2, -8 + Math.sin(clock * 9 - i) * 1.2 + i * 0.4);
  ctx.stroke();
  ctx.restore();

  // The disco ball on its pole above the sun deck.
  ctx.strokeStyle = '#8a8fa6';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-6, -88); ctx.lineTo(-6, -113);
  ctx.stroke();
  ctx.save();
  ctx.translate(-6, -121);
  drawDisco(ctx, 7.5, clock, 0.5 + 0.5 * night * party);
  ctx.restore();

  // Scorch marks where the strait landed a hit; the fresh ones still burn.
  for (const scar of look.scars) {
    const fade = Math.max(0, 1 - scar.age / 16);
    ctx.globalAlpha = base * 0.75 * fade;
    ctx.fillStyle = '#2b2430';
    ctx.beginPath();
    ctx.ellipse(scar.local, scar.y, 7, 4, 0.3, 0, Math.PI * 2);
    ctx.ellipse(scar.local + 4, scar.y - 2, 4, 3, -0.4, 0, Math.PI * 2);
    ctx.fill();
    if (scar.age < 3) {
      const burn = 1 - scar.age / 3;
      for (let k = 0; k < 3; k++) {
        ctx.globalAlpha = base * burn * (0.6 + 0.4 * Math.sin(clock * 20 + k));
        ctx.fillStyle = k % 2 ? '#ffb347' : '#ff5a36';
        ctx.beginPath();
        ctx.ellipse(scar.local - 3 + k * 3, scar.y - 4 - Math.abs(Math.sin(clock * 13 + k)) * 4, 2, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let k = 0; k < 4; k++) {
        const age = (clock * 0.8 + k / 4) % 1;
        ctx.globalAlpha = base * burn * (1 - age) * 0.5;
        ctx.fillStyle = '#4a4458';
        ctx.beginPath();
        ctx.arc(scar.local - age * 22, scar.y - 8 - age * 30, 3 + age * 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = base;

  // The disco shield: a mirrorball bubble with a sparkle.
  if (look.shield > 0) {
    ctx.save();
    ctx.globalAlpha = base * look.shield;
    for (let k = 0; k < PRIDE.length; k++) {
      ctx.strokeStyle = PRIDE[k]!;
      ctx.globalAlpha = base * look.shield * (0.18 + 0.1 * Math.sin(clock * 6 + k));
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(4, -62, 176 + k * 2.5, 92 + k * 2, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = base * look.shield;
    for (let k = 0; k < 6; k++) {
      const a = Math.PI + ((clock * 0.4 + k / 6) % 1) * Math.PI;
      sparkle(ctx, 4 + Math.cos(a) * 178, -62 + Math.sin(a) * 94, 4 + 2 * Math.sin(clock * 9 + k), '#ffffff');
    }
    ctx.restore();
  }
}

/** Foam where the hull meets the water: the bow wave and the wake, drawn on the sea before the ship. */
export function drawWake(ctx: CanvasRenderingContext2D, speed: number, clock: number, width: number): void {
  if (speed <= 0.01) return;
  ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * speed})`;
  ctx.beginPath();
  ctx.moveTo(-146, 0);
  ctx.quadraticCurveTo(-146 - width * 0.6, -3 - 2 * speed, -146 - width, -1);
  ctx.lineTo(-146 - width, 5 + 4 * speed);
  ctx.quadraticCurveTo(-146 - width * 0.6, 4 + 3 * speed, -146, 3);
  ctx.closePath();
  ctx.fill();
  for (let k = 0; k < 9; k++) {
    const u = (clock * (0.6 + speed) + k / 9) % 1;
    ctx.globalAlpha = (1 - u) * 0.6 * speed;
    ctx.beginPath();
    ctx.ellipse(-150 - u * width, 1 + Math.sin(k * 2.1) * 3 * u, 4 + u * 9, 1.5 + u * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // The bow wave curls white off the stem.
  ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + 0.45 * speed})`;
  ctx.beginPath();
  ctx.moveTo(150, -1);
  ctx.quadraticCurveTo(158 + 6 * speed, -6 - 5 * speed, 164 + 10 * speed, 0);
  ctx.quadraticCurveTo(150, 4, 110, 3);
  ctx.quadraticCurveTo(130, 1, 150, -1);
  ctx.fill();
}

// ---- The sinking --------------------------------------------------------------------------------------------

const ease = (n: number): number => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };

/** How long the ending takes before the next voyage may fade in. */
export const SINK_SECONDS = 5.4;

export interface SinkPose { angle: number; drop: number; pivot: number; flood: number }

/**
 * The sinking as a pure function of crash time (after the hit-stop): a recoil, then the hit end goes down
 * and the other end lifts clear, then she slides under. `impact` is the hull px the killing blow landed on:
 * forward of midship she goes bow first, aft of it stern first.
 */
export function sinkPose(t: number, impact: number): SinkPose {
  const dir = impact >= 0 ? 1 : -1;
  const recoil = 0.05 * Math.sin(t * 10) * Math.exp(-t * 3);
  return {
    angle: dir * 0.44 * Math.pow(ease((t - 0.7) / 3.4), 1.3) + recoil,
    drop: 14 * ease(t / 1) + 280 * Math.pow(ease((t - 1.3) / 3.7), 1.6),
    pivot: impact * 0.5,
    flood: ease((t - 0.2) / 3),
  };
}
